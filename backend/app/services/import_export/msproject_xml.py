"""
MS Project XML (MSPDI) importer and exporter.

Handles reading and writing Microsoft Project Data Interchange (MSPDI) XML files
compatible with MS Project 2003/2007/2010/2013/2016/2019/365.

References:
  - MSPDI schema: https://schemas.microsoft.com/project/2007
  - Key elements: Project > Tasks > Task, Resources > Resource, PredecessorLink
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from xml.etree import ElementTree as ET

from app.services.import_export.schemas import (
    ImportAction,
    ImportPreview,
    ImportFormat,
    ResourcePreview,
    TaskFieldMapping,
    TaskPreview,
)

logger = logging.getLogger(__name__)

# MSPDI XML namespace (optional — some files use it, some don't)
NS = ""

# MSPDI Constraint Type mapping
MSPDI_CONSTRAINT_MAP = {
    "0": "ASAP",   # As Soon As Possible
    "1": "ALAP",   # As Late As Possible
    "2": "MSO",    # Must Start On
    "3": "MFO",    # Must Finish On
    "4": "SNET",   # Start No Earlier Than
    "5": "SNLT",   # Start No Later Than
    "6": "FNET",   # Finish No Earlier Than
    "7": "FNLT",   # Finish No Later Than
}

CONSTRAINT_TO_MSPDI = {v: k for k, v in MSPDI_CONSTRAINT_MAP.items()}

# MSPDI Dependency Type mapping
MSPDI_DEP_TYPE_MAP = {
    "0": "FF",  # Finish-to-Finish
    "1": "FS",  # Finish-to-Start
    "2": "SF",  # Start-to-Finish
    "3": "SS",  # Start-to-Start
}

DEP_TYPE_TO_MSPDI = {v: k for k, v in MSPDI_DEP_TYPE_MAP.items()}

# MSPDI Task Type
MSPDI_TASK_TYPE_MAP = {
    "0": "fixed_units",    # Fixed Units
    "1": "fixed_duration", # Fixed Duration
    "2": "fixed_work",     # Fixed Work
}

# MSPDI Resource Type mapping
MSPDI_RESOURCE_TYPE_MAP = {
    "0": "material",  # Material
    "1": "human",     # Work (human)
    "2": "cost",      # Cost
}

RESOURCE_TYPE_TO_MSPDI = {v: k for k, v in MSPDI_RESOURCE_TYPE_MAP.items()}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _text(el: Optional[ET.Element], tag: str, default: str = "") -> str:
    """Safely extract text from a child element."""
    if el is None:
        return default
    child = el.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return default


def _text_float(el: Optional[ET.Element], tag: str, default: float = 0.0) -> float:
    """Extract a float value from a child element."""
    val = _text(el, tag, "")
    if val:
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    return default


def _text_int(el: Optional[ET.Element], tag: str, default: int = 0) -> int:
    """Extract an integer value from a child element."""
    val = _text(el, tag, "")
    if val:
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return default
    return default


def _text_date(el: Optional[ET.Element], tag: str) -> Optional[date]:
    """Extract a date value from a child element (handles MS Project datetime format)."""
    val = _text(el, tag, "")
    if not val:
        return None
    # MS Project uses ISO 8601: "2025-01-15T08:00:00" or "2025-01-15"
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    logger.warning(f"Cannot parse date: {val}")
    return None


def _text_datetime(el: Optional[ET.Element], tag: str) -> Optional[datetime]:
    """Extract a datetime value from a child element."""
    val = _text(el, tag, "")
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def _format_datetime(val: str, default_time: str = "T08:00:00") -> str:
    """Format a date/datetime string for MSPDI XML output.
    If the value already has a time component, return as-is.
    Otherwise append the default_time suffix."""
    if not val:
        return ""
    # Already has time component (contains 'T' followed by ':')
    if "T" in val:
        return val
    return f"{val}{default_time}"


def _duration_to_days(duration_str: str) -> float:
    """
    Convert MS Project duration string to days.
    Formats: "PT8H0M0S" (ISO 8601 duration), "5" (days), "5 days"
    """
    if not duration_str:
        return 1.0

    # ISO 8601 duration: PT8H0M0S, P1DT0H0M0S, P5D
    if duration_str.startswith("P"):
        days = 0
        hours = 0
        minutes = 0

        # Parse P[n]D part
        if "D" in duration_str:
            d_part = duration_str.split("D")[0].replace("P", "")
            if d_part:
                try:
                    days = int(d_part)
                except ValueError:
                    pass

        # Parse T[n]H[n]M[n]S part
        if "T" in duration_str:
            t_part = duration_str.split("T")[1]
            if "H" in t_part:
                h_part = t_part.split("H")[0]
                if h_part:
                    try:
                        hours = int(h_part)
                    except ValueError:
                        pass
            if "M" in t_part:
                m_part = t_part.split("H")[-1].split("M")[0] if "H" in t_part else t_part.split("M")[0]
                if m_part:
                    try:
                        minutes = int(m_part)
                    except ValueError:
                        pass

        return days + hours / 8.0 + minutes / 480.0

    # Plain number (days)
    try:
        return float(duration_str)
    except (ValueError, TypeError):
        return 1.0


def _days_to_mspdi_duration(days: float) -> str:
    """Convert days to MSPDI ISO 8601 duration string."""
    total_minutes = int(days * 8 * 60)  # 8-hour work day
    h = total_minutes // 60
    m = total_minutes % 60
    return f"PT{h}H{m}M0S"


def _detect_namespace(root: ET.Element) -> str:
    """Detect if the XML uses a namespace."""
    tag = root.tag
    if "}" in tag:
        return tag.split("}")[0] + "}"
    return ""


# ---------------------------------------------------------------------------
# MS Project XML Parser (Import)
# ---------------------------------------------------------------------------

class MSProjectParser:
    """Parse MS Project XML (MSPDI) file into ImportPreview."""

    def parse(self, xml_content: bytes, filename: str = "import.xml") -> ImportPreview:
        """
        Parse MS Project XML and return a validated ImportPreview.
        Performs three-layer validation: format → field → business rules.
        """
        warnings: list[str] = []
        errors: list[str] = []

        # ── Layer 1: Format validation ──
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            return ImportPreview(
                preview_token=str(uuid.uuid4()),
                format=ImportFormat.MSPROJECT_XML,
                filename=filename,
                errors=[f"Invalid XML: {e}"],
            )

        # Detect namespace
        global NS
        NS = _detect_namespace(root)

        if root.tag.replace(NS, "") != "Project":
            return ImportPreview(
                preview_token=str(uuid.uuid4()),
                format=ImportFormat.MSPROJECT_XML,
                filename=filename,
                errors=["Not a valid MS Project XML file: root element is not <Project>"],
            )

        # ── Project-level info ──
        project_name = _text(root, f"{NS}Name", filename.replace(".xml", ""))
        project_start = _text_date(root, f"{NS}StartDate")

        # Calendar info
        calendar_info = self._parse_calendar(root)

        # ── Layer 2: Field-level parsing and validation ──
        # Parse resources first (tasks reference them)
        resource_map, res_warnings = self._parse_resources(root)
        warnings.extend(res_warnings)

        # Parse tasks
        tasks, task_warnings = self._parse_tasks(root)
        warnings.extend(task_warnings)

        # ── Layer 3: Business rule validation ──
        tasks, dep_errors = self._validate_dependencies(tasks)
        errors.extend(dep_errors)

        tasks, cycle_warnings = self._check_cycles(tasks)
        warnings.extend(cycle_warnings)

        # Compute summary counts
        valid_tasks = sum(1 for t in tasks if t.action in (ImportAction.CREATE, ImportAction.UPDATE))
        skipped_tasks = sum(1 for t in tasks if t.action == ImportAction.SKIP)
        conflict_tasks = sum(1 for t in tasks if t.action == ImportAction.CONFLICT)

        valid_resources = sum(1 for r in resource_map.values() if r.action in (ImportAction.CREATE, ImportAction.UPDATE))

        # If there are fatal errors, no valid tasks
        if errors and not tasks:
            return ImportPreview(
                preview_token=str(uuid.uuid4()),
                format=ImportFormat.MSPROJECT_XML,
                filename=filename,
                errors=errors,
                warnings=warnings,
            )

        return ImportPreview(
            preview_token=str(uuid.uuid4()),
            format=ImportFormat.MSPROJECT_XML,
            filename=filename,
            total_tasks=len(tasks),
            valid_tasks=valid_tasks,
            skipped_tasks=skipped_tasks,
            conflict_tasks=conflict_tasks,
            total_resources=len(resource_map),
            valid_resources=valid_resources,
            warnings=warnings,
            errors=errors,
            tasks=tasks,
            resources=list(resource_map.values()),
            project_name=project_name,
            project_start_date=project_start,
            project_calendar=calendar_info,
        )

    def _parse_calendar(self, root: ET.Element) -> dict:
        """Parse project calendar defaults."""
        cal_info: dict = {}
        calendars_el = root.find(f"{NS}Calendars")
        if calendars_el is None:
            return cal_info

        for cal in calendars_el.findall(f"{NS}Calendar"):
            is_base = _text(cal, f"{NS}IsBaseCalendar")
            if is_base == "1":
                cal_info["name"] = _text(cal, f"{NS}Name", "Standard")
                weekdays_el = cal.find(f"{NS}WeekDays")
                if weekdays_el is not None:
                    work_days = []
                    for wd in weekdays_el.findall(f"{NS}WeekDay"):
                        day_type = _text_int(wd, f"{NS}DayType", 0)
                        day_working = _text(wd, f"{NS}DayWorking")
                        if day_working == "1":
                            work_days.append(day_type)
                    cal_info["work_days"] = work_days
                break

        return cal_info

    def _parse_resources(self, root: ET.Element) -> tuple[dict[str, ResourcePreview], list[str]]:
        """Parse <Resources> section. Returns {UID: ResourcePreview}."""
        resource_map: dict[str, ResourcePreview] = {}
        warnings: list[str] = []

        res_el = root.find(f"{NS}Resources")
        if res_el is None:
            return resource_map, warnings

        for res in res_el.findall(f"{NS}Resource"):
            uid = _text(res, f"{NS}UID", "")
            if not uid:
                uid = _text(res, f"{NS}ID", str(len(resource_map)))

            name = _text(res, f"{NS}Name", "")
            if not name:
                warnings.append(f"Resource UID={uid} has no name, skipping")
                continue

            # Resource type
            res_type_code = _text(res, f"{NS}Type", "1")
            resource_type = MSPDI_RESOURCE_TYPE_MAP.get(res_type_code, "human")

            rp = ResourcePreview(
                source_id=uid,
                name=name,
                resource_type=resource_type,
                standard_rate=_text_float(res, f"{NS}StandardRate"),
                overtime_rate=_text_float(res, f"{NS}OvertimeRate"),
                cost_per_use=_text_float(res, f"{NS}CostPerUse"),
                max_units=_text_float(res, f"{NS}MaxUnits", 1.0),
                group_name=_text(res, f"{NS}Group") or None,
                email=_text(res, f"{NS}EmailAddress") or None,
                action=ImportAction.CREATE,
            )

            # Validate
            if rp.standard_rate < 0:
                rp.issues.append(f"Negative standard rate ({rp.standard_rate}), set to 0")
                rp.standard_rate = 0.0
            if rp.max_units <= 0 or rp.max_units > 10:
                rp.issues.append(f"Invalid max_units ({rp.max_units}), defaulting to 1.0")
                rp.max_units = 1.0

            resource_map[uid] = rp

        return resource_map, warnings

    def _parse_tasks(self, root: ET.Element) -> tuple[list[TaskPreview], list[str]]:
        """Parse <Tasks> section with field-level validation."""
        tasks: list[TaskPreview] = []
        warnings: list[str] = []

        tasks_el = root.find(f"{NS}Tasks")
        if tasks_el is None:
            warnings.append("No <Tasks> element found in the XML file")
            return tasks, warnings

        for task_el in tasks_el.findall(f"{NS}Task"):
            uid = _text(task_el, f"{NS}UID", "")
            if not uid:
                uid = _text(task_el, f"{NS}ID", str(len(tasks)))

            name = _text(task_el, f"{NS}Name", "")
            if not name:
                # Summary/placeholder tasks may have no name
                is_summary = _text(task_el, f"{NS}Summary")
                if is_summary == "1":
                    name = f"Summary_{uid}"
                else:
                    warnings.append(f"Task UID={uid} has no name, skipping")
                    continue

            # Skip project summary task (UID=0, OutlineLevel=0)
            if uid == "0" and _text_int(task_el, f"{NS}OutlineLevel", 1) == 0:
                continue

            # Schedule fields
            start_date = _text_date(task_el, f"{NS}Start")
            finish_date = _text_date(task_el, f"{NS}Finish")
            duration_str = _text(task_el, f"{NS}Duration", "")
            duration_days = _duration_to_days(duration_str) if duration_str else 1.0

            # Milestone detection
            is_milestone = _text(task_el, f"{NS}Milestone") == "1"
            if is_milestone:
                duration_days = 0.0

            # Summary task
            is_summary = _text(task_el, f"{NS}Summary") == "1"

            # Progress
            pct_complete = _text_float(task_el, f"{NS}PercentComplete", 0.0) / 100.0
            pct_work_complete = _text_float(task_el, f"{NS}PercentWorkComplete", 0.0) / 100.0
            if pct_complete == 0 and pct_work_complete > 0:
                pct_complete = pct_work_complete

            actual_start = _text_date(task_el, f"{NS}ActualStart")
            actual_finish = _text_date(task_el, f"{NS}ActualFinish")

            # Constraint
            constraint_code = _text(task_el, f"{NS}ConstraintType", "0")
            constraint_type = MSPDI_CONSTRAINT_MAP.get(constraint_code, "ASAP")
            constraint_date = _text_date(task_el, f"{NS}ConstraintDate")

            # Cost
            fixed_cost = _text_float(task_el, f"{NS}FixedCost", 0.0)

            # WBS / Outline
            wbs = _text(task_el, f"{NS}WBS", "")
            outline_level = _text_int(task_el, f"{NS}OutlineLevel", 1)

            # Notes
            notes = _text(task_el, f"{NS}Notes", "") or None

            # Dependencies (PredecessorLink)
            deps: list[tuple[str, str, float]] = []
            for pred_link in task_el.findall(f"{NS}PredecessorLink"):
                pred_uid = _text(pred_link, f"{NS}PredecessorUID", "")
                dep_type_code = _text(pred_link, f"{NS}Type", "1")
                dep_type = MSPDI_DEP_TYPE_MAP.get(dep_type_code, "FS")
                lag_minutes = _text_int(pred_link, f"{NS}LinkLag", 0)
                # LinkLag is in tenths of a minute in MSPDI
                lag_days = lag_minutes / (8 * 60 * 10) if lag_minutes else 0.0
                if pred_uid:
                    deps.append((pred_uid, dep_type, lag_days))

            # Resource assignments — collected from <Assignments> section
            assigned_resources: list[str] = []

            # Build task preview
            tp = TaskPreview(
                source_id=uid,
                name=name,
                wbs_code=wbs,
                outline_level=outline_level,
                parent_source_id=None,  # resolved later via outline level
                start_date=start_date,
                end_date=finish_date,
                duration_days=duration_days,
                is_milestone=is_milestone,
                percent_complete=pct_complete,
                actual_start=actual_start,
                actual_end=actual_finish,
                constraint_type=constraint_type,
                constraint_date=constraint_date,
                fixed_cost=fixed_cost,
                notes=notes,
                dependencies=deps,
                assigned_resources=assigned_resources,
                action=ImportAction.CREATE,
            )

            # ── Field-level validation ──
            if tp.start_date and tp.end_date and tp.start_date > tp.end_date:
                tp.issues.append(f"Start date ({tp.start_date}) is after end date ({tp.end_date}), swapped")
                tp.start_date, tp.end_date = tp.end_date, tp.start_date

            if tp.duration_days < 0:
                tp.issues.append(f"Negative duration ({tp.duration_days}), set to 1 day")
                tp.duration_days = 1.0

            if tp.percent_complete < 0 or tp.percent_complete > 1:
                tp.issues.append(f"Invalid percent complete ({tp.percent_complete}), clamped to 0-1")
                tp.percent_complete = max(0.0, min(1.0, tp.percent_complete))

            if is_summary:
                tp.issues.append("Summary task — will be imported as a container")

            # Store extra info
            if is_summary:
                tp.issues.append("summary_task")

            tasks.append(tp)

        # ── Resolve parent relationships from outline levels ──
        self._resolve_parents(tasks)

        # ── Resolve resource assignments ──
        self._resolve_assignments(root, tasks)

        return tasks, warnings

    def _resolve_parents(self, tasks: list[TaskPreview]):
        """Resolve parent_source_id from outline levels."""
        stack: list[TaskPreview] = []
        for task in tasks:
            # Pop stack until we find a parent (outline_level - 1)
            while stack and stack[-1].outline_level >= task.outline_level:
                stack.pop()

            if stack:
                task.parent_source_id = stack[-1].source_id

            stack.append(task)

    def _resolve_assignments(self, root: ET.Element, tasks: list[TaskPreview]):
        """Parse <Assignments> and map resources to tasks."""
        task_uid_map = {t.source_id: t for t in tasks}
        assignments_el = root.find(f"{NS}Assignments")
        if assignments_el is None:
            return

        for assign in assignments_el.findall(f"{NS}Assignment"):
            task_uid = _text(assign, f"{NS}TaskUID", "")
            res_uid = _text(assign, f"{NS}ResourceUID", "")
            if task_uid in task_uid_map and res_uid:
                if res_uid not in task_uid_map[task_uid].assigned_resources:
                    task_uid_map[task_uid].assigned_resources.append(res_uid)

    def _validate_dependencies(
        self, tasks: list[TaskPreview]
    ) -> tuple[list[TaskPreview], list[str]]:
        """Validate dependency references exist."""
        errors: list[str] = []
        uid_set = {t.source_id for t in tasks}

        for task in tasks:
            valid_deps = []
            for pred_uid, dep_type, lag in task.dependencies:
                if pred_uid in uid_set:
                    valid_deps.append((pred_uid, dep_type, lag))
                else:
                    errors.append(
                        f"Task '{task.name}' (UID={task.source_id}) references "
                        f"non-existent predecessor UID={pred_uid}, dependency removed"
                    )
            task.dependencies = valid_deps

        return tasks, errors

    def _check_cycles(self, tasks: list[TaskPreview]) -> tuple[list[TaskPreview], list[str]]:
        """Check for circular dependencies using DFS."""
        warnings: list[str] = []
        adj: dict[str, list[str]] = {}
        for task in tasks:
            adj[task.source_id] = [pred_uid for pred_uid, _, _ in task.dependencies]

        # Simple cycle detection
        visited = set()
        rec_stack = set()
        has_cycle = False

        def dfs(node: str) -> bool:
            nonlocal has_cycle
            visited.add(node)
            rec_stack.add(node)
            for neighbor in adj.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    has_cycle = True
                    return True
            rec_stack.discard(node)
            return False

        for task in tasks:
            if task.source_id not in visited:
                dfs(task.source_id)

        if has_cycle:
            warnings.append(
                "Circular dependency detected in the import file. "
                "Some dependencies may be removed to break cycles."
            )

        return tasks, warnings


# ---------------------------------------------------------------------------
# MS Project XML Builder (Export)
# ---------------------------------------------------------------------------

class MSProjectExporter:
    """Build MS Project XML (MSPDI) from project data."""

    def build(
        self,
        project_name: str,
        tasks: list[dict],
        resources: list[dict],
        dependencies: list[dict],
        project_start: Optional[date] = None,
        calendar_info: Optional[dict] = None,
    ) -> bytes:
        """
        Build a complete MSPDI XML document.

        Args:
            project_name: Project name
            tasks: List of task dicts with keys:
                id, name, wbs_code, outline_level, start_date, end_date,
                duration_days, is_milestone, percent_complete, constraint_type,
                constraint_date, fixed_cost, actual_start, actual_end
            resources: List of resource dicts with keys:
                id, name, resource_type, standard_rate, overtime_rate,
                cost_per_use, max_units, group_name, email
            dependencies: List of dependency dicts with keys:
                predecessor_id, successor_id, dependency_type, lag_days
            project_start: Project start date
            calendar_info: Calendar configuration dict
        """
        root = ET.Element("Project")
        root.set("xmlns", "http://schemas.microsoft.com/project/2007")

        # ── Project header ──
        self._add_text(root, "Name", project_name)
        self._add_text(root, "SaveVersion", "14")  # MS Project 2010+
        start = project_start or date.today()
        self._add_text(root, "StartDate", f"{start.isoformat()}T08:00:00")
        self._add_text(root, "CalendarUID", "1")
        self._add_text(root, "ScheduleFromStart", "1")
        self._add_text(root, "MinutesPerDay", "480")  # 8 hours
        self._add_text(root, "MinutesPerWeek", "2400")  # 5 days
        self._add_text(root, "DaysPerMonth", "20")
        self._add_text(root, "DefaultStartTime", "08:00:00")
        self._add_text(root, "DefaultFinishTime", "17:00:00")

        # ── Calendar ──
        self._build_calendar(root, calendar_info)

        # ── Resources ──
        res_uid_map: dict[str, int] = {}
        if resources:
            resources_el = ET.SubElement(root, "Resources")
            for idx, res in enumerate(resources, 1):
                res_uid_map[str(res["id"])] = idx
                res_el = ET.SubElement(resources_el, "Resource")
                self._add_text(res_el, "UID", str(idx))
                self._add_text(res_el, "ID", str(idx))
                self._add_text(res_el, "Name", res.get("name", f"Resource {idx}"))

                res_type = res.get("resource_type", "human")
                self._add_text(res_el, "Type", RESOURCE_TYPE_TO_MSPDI.get(res_type, "1"))

                self._add_text(res_el, "MaxUnits", str(res.get("max_units", 1.0)))
                self._add_text(res_el, "StandardRate", str(res.get("standard_rate", 0.0)))
                self._add_text(res_el, "OvertimeRate", str(res.get("overtime_rate", 0.0)))
                self._add_text(res_el, "CostPerUse", str(res.get("cost_per_use", 0.0)))

                if res.get("group_name"):
                    self._add_text(res_el, "Group", res["group_name"])
                if res.get("email"):
                    self._add_text(res_el, "EmailAddress", res["email"])

        # ── Tasks ──
        task_uid_map: dict[str, int] = {}
        if tasks:
            tasks_el = ET.SubElement(root, "Tasks")

            # Project summary task (UID=0)
            summary_el = ET.SubElement(tasks_el, "Task")
            self._add_text(summary_el, "UID", "0")
            self._add_text(summary_el, "ID", "0")
            self._add_text(summary_el, "Name", project_name)
            self._add_text(summary_el, "Summary", "1")
            self._add_text(summary_el, "OutlineLevel", "0")

            for idx, task in enumerate(tasks, 1):
                task_uid_map[str(task["id"])] = idx
                task_el = ET.SubElement(tasks_el, "Task")
                self._add_text(task_el, "UID", str(idx))
                self._add_text(task_el, "ID", str(idx))
                self._add_text(task_el, "Name", task.get("name", f"Task {idx}"))

                # WBS / Outline
                wbs = task.get("wbs_code", "")
                if wbs:
                    self._add_text(task_el, "WBS", wbs)
                self._add_text(task_el, "OutlineLevel", str(task.get("outline_level", 1)))

                # Dates
                start_date = task.get("start_date")
                end_date = task.get("end_date")
                if start_date:
                    self._add_text(task_el, "Start", _format_datetime(start_date, "T08:00:00"))
                if end_date:
                    self._add_text(task_el, "Finish", _format_datetime(end_date, "T17:00:00"))

                # Duration
                dur = task.get("duration_days", 1.0)
                self._add_text(task_el, "Duration", _days_to_mspdi_duration(dur))
                self._add_text(task_el, "ManualDuration", _days_to_mspdi_duration(dur))

                # Milestone
                self._add_text(task_el, "Milestone", "1" if task.get("is_milestone") else "0")

                # Summary
                self._add_text(task_el, "Summary", "1" if task.get("is_summary") else "0")

                # Progress
                pct = task.get("percent_complete", 0.0)
                self._add_text(task_el, "PercentComplete", str(int(pct * 100)))
                self._add_text(task_el, "PercentWorkComplete", str(int(pct * 100)))

                # Actual dates
                actual_start = task.get("actual_start")
                actual_end = task.get("actual_end")
                if actual_start:
                    self._add_text(task_el, "ActualStart", _format_datetime(actual_start, "T08:00:00"))
                if actual_end:
                    self._add_text(task_el, "ActualFinish", _format_datetime(actual_end, "T17:00:00"))

                # Constraint
                constraint_type = task.get("constraint_type", "ASAP")
                self._add_text(task_el, "ConstraintType", CONSTRAINT_TO_MSPDI.get(constraint_type, "0"))
                constraint_date = task.get("constraint_date")
                if constraint_date and constraint_type not in ("ASAP", "ALAP"):
                    self._add_text(task_el, "ConstraintDate", _format_datetime(constraint_date, "T08:00:00"))

                # Cost
                self._add_text(task_el, "FixedCost", str(task.get("fixed_cost", 0.0)))
                self._add_text(task_el, "Cost", str(task.get("fixed_cost", 0.0)))

                # Notes
                notes = task.get("notes", "")
                if notes:
                    self._add_text(task_el, "Notes", notes)

                # Critical
                self._add_text(task_el, "Critical", "1" if task.get("is_critical") else "0")

                # Float
                total_float = task.get("total_float")
                if total_float is not None:
                    # MSPDI stores float in tenths of minutes
                    self._add_text(task_el, "TotalSlack", str(int(total_float * 8 * 60 * 10)))

                # CPM dates
                for field, mspdi_field in [
                    ("early_start", "EarlyStart"),
                    ("early_finish", "EarlyFinish"),
                    ("late_start", "LateStart"),
                    ("late_finish", "LateFinish"),
                ]:
                    val = task.get(field)
                    if val:
                        self._add_text(task_el, mspdi_field, _format_datetime(val, "T08:00:00"))

        # ── Dependencies (PredecessorLink inside each Task) ──
        if dependencies and task_uid_map:
            # Group by successor
            succ_deps: dict[str, list[dict]] = {}
            for dep in dependencies:
                succ_id = str(dep.get("successor_id", ""))
                if succ_id not in succ_deps:
                    succ_deps[succ_id] = []
                succ_deps[succ_id].append(dep)

            # Find task elements and add predecessor links
            tasks_el = root.find("Tasks")
            if tasks_el is not None:
                for task_el in tasks_el.findall("Task"):
                    task_uid = _text(task_el, "UID", "")
                    # Reverse lookup: find the task's internal ID from UID
                    task_internal_id = None
                    for internal_id, uid in task_uid_map.items():
                        if str(uid) == task_uid:
                            task_internal_id = internal_id
                            break

                    if task_internal_id and task_internal_id in succ_deps:
                        for dep in succ_deps[task_internal_id]:
                            pred_uid = task_uid_map.get(str(dep.get("predecessor_id", "")))
                            if pred_uid:
                                link_el = ET.SubElement(task_el, "PredecessorLink")
                                self._add_text(link_el, "PredecessorUID", str(pred_uid))
                                dep_type = dep.get("dependency_type", "FS")
                                self._add_text(link_el, "Type", DEP_TYPE_TO_MSPDI.get(dep_type, "1"))
                                lag_days = dep.get("lag_days", 0.0)
                                # Convert to tenths of minutes
                                lag_tenths = int(lag_days * 8 * 60 * 10)
                                self._add_text(link_el, "LinkLag", str(lag_tenths))
                                self._add_text(link_el, "CrossProject", "0")

        # ── Assignments ──
        if resources and tasks:
            assignments_el = ET.SubElement(root, "Assignments")
            assign_idx = 0
            for task in tasks:
                task_internal_id = str(task.get("id", ""))
                task_uid = task_uid_map.get(task_internal_id)
                if not task_uid:
                    continue

                assigned_res = task.get("assigned_resource_ids", [])
                for res_internal_id in assigned_res:
                    res_uid = res_uid_map.get(str(res_internal_id))
                    if res_uid:
                        assign_idx += 1
                        assign_el = ET.SubElement(assignments_el, "Assignment")
                        self._add_text(assign_el, "UID", str(assign_idx))
                        self._add_text(assign_el, "TaskUID", str(task_uid))
                        self._add_text(assign_el, "ResourceUID", str(res_uid))
                        self._add_text(assign_el, "Units", str(task.get("units", 1.0)))

        # Serialize to bytes
        xml_str = ET.tostring(root, encoding="unicode", xml_declaration=False)
        xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
        return (xml_declaration + xml_str).encode("utf-8")

    def _build_calendar(self, root: ET.Element, calendar_info: Optional[dict]):
        """Build the <Calendars> section."""
        calendars_el = ET.SubElement(root, "Calendars")
        cal_el = ET.SubElement(calendars_el, "Calendar")
        self._add_text(cal_el, "UID", "1")
        self._add_text(cal_el, "Name", (calendar_info or {}).get("name", "Standard"))
        self._add_text(cal_el, "IsBaseCalendar", "1")

        weekdays_el = ET.SubElement(cal_el, "WeekDays")
        work_days = (calendar_info or {}).get("work_days", [2, 3, 4, 5, 6])  # Mon-Fri in MSPDI (1=Sun)

        for day_num in range(1, 8):  # 1=Sunday, 2=Monday, ..., 7=Saturday
            wd_el = ET.SubElement(weekdays_el, "WeekDay")
            self._add_text(wd_el, "DayType", str(day_num))
            is_working = "1" if day_num in work_days else "0"
            self._add_text(wd_el, "DayWorking", is_working)

    def _add_text(self, parent: ET.Element, tag: str, value: str):
        """Add a child element with text content."""
        el = ET.SubElement(parent, tag)
        el.text = str(value)
