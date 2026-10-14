"""
CSV import/export handler for PM Extension.

Exports project tasks, resources, and dependencies to CSV.
Imports tasks from CSV with preview/commit validation.
"""

from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import date, datetime
from typing import Optional

from app.services.import_export.schemas import (
    ImportAction,
    ImportFormat,
    ImportPreview,
    ResourcePreview,
    TaskFieldMapping,
    TaskPreview,
)

logger = logging.getLogger(__name__)

# CSV column definitions (header names → internal field names)
CSV_COLUMNS = [
    ("WBS", "wbs_code"),
    ("Task Name", "name"),
    ("Duration (days)", "duration_days"),
    ("Start Date", "start_date"),
    ("End Date", "end_date"),
    ("Progress %", "percent_complete"),
    ("Milestone", "is_milestone"),
    ("Constraint Type", "constraint_type"),
    ("Constraint Date", "constraint_date"),
    ("Actual Start", "actual_start"),
    ("Actual End", "actual_end"),
    ("Fixed Cost", "fixed_cost"),
    ("Predecessors", "predecessors"),  # e.g. "1FS,3SS+2"
    ("Resources", "assigned_resources"),  # e.g. "Zhang Wei,Li Ming"
    ("Notes", "notes"),
]

# Reverse lookup for export
FIELD_TO_HEADER = {field: header for header, field in CSV_COLUMNS}


# ---------------------------------------------------------------------------
# CSV Parser (Import)
# ---------------------------------------------------------------------------

class CSVParser:
    """Parse CSV file into ImportPreview with three-layer validation."""

    def parse(self, csv_content: str, filename: str = "import.csv") -> ImportPreview:
        """
        Parse CSV content and return a validated ImportPreview.
        Expected columns: Task Name (required), plus optional columns.
        """
        warnings: list[str] = []
        errors: list[str] = []
        tasks: list[TaskPreview] = []
        resources: dict[str, ResourcePreview] = {}

        # ── Layer 1: Format validation ──
        if not csv_content or not csv_content.strip():
            return ImportPreview(
                preview_token=str(uuid.uuid4()),
                format=ImportFormat.CSV,
                filename=filename,
                errors=["CSV file is empty"],
            )

        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            if reader.fieldnames is None:
                return ImportPreview(
                    preview_token=str(uuid.uuid4()),
                    format=ImportFormat.CSV,
                    filename=filename,
                    errors=["Cannot parse CSV: no header row found"],
                )

            # Normalize header names
            header_map = self._build_header_map(reader.fieldnames)

            # Check for required column
            if "name" not in header_map.values():
                return ImportPreview(
                    preview_token=str(uuid.uuid4()),
                    format=ImportFormat.CSV,
                    filename=filename,
                    errors=[
                        "Required column 'Task Name' not found. "
                        f"Available columns: {', '.join(reader.fieldnames)}"
                    ],
                )

        except csv.Error as e:
            return ImportPreview(
                preview_token=str(uuid.uuid4()),
                format=ImportFormat.CSV,
                filename=filename,
                errors=[f"CSV parsing error: {e}"],
            )

        # ── Layer 2: Field-level parsing ──
        for row_idx, row in enumerate(reader, 2):  # row 2 = first data row
            task = self._parse_row(row, header_map, row_idx, warnings)
            if task:
                tasks.append(task)

                # Collect resources from assignments column
                for res_name in task.assigned_resources:
                    if res_name and res_name not in resources:
                        resources[res_name] = ResourcePreview(
                            source_id=res_name,
                            name=res_name,
                            resource_type="human",
                            action=ImportAction.CREATE,
                        )

        if not tasks:
            warnings.append("No valid tasks found in the CSV file")

        # ── Layer 3: Business rule validation ──
        tasks = self._validate_predecessors(tasks, warnings)

        # Auto-generate WBS if missing
        self._auto_generate_wbs(tasks)

        # Compute summary counts
        valid_tasks = sum(1 for t in tasks if t.action in (ImportAction.CREATE, ImportAction.UPDATE))
        skipped_tasks = sum(1 for t in tasks if t.action == ImportAction.SKIP)
        conflict_tasks = sum(1 for t in tasks if t.action == ImportAction.CONFLICT)

        return ImportPreview(
            preview_token=str(uuid.uuid4()),
            format=ImportFormat.CSV,
            filename=filename,
            total_tasks=len(tasks),
            valid_tasks=valid_tasks,
            skipped_tasks=skipped_tasks,
            conflict_tasks=conflict_tasks,
            total_resources=len(resources),
            valid_resources=len(resources),
            warnings=warnings,
            errors=errors,
            tasks=tasks,
            resources=list(resources.values()),
            project_name=filename.replace(".csv", ""),
        )

    def _build_header_map(self, fieldnames: list[str]) -> dict[str, str]:
        """
        Map CSV header names to internal field names.
        Handles variations like "Task Name", "Name", "Task", etc.
        """
        header_map: dict[str, str] = {}
        aliases = {
            "wbs": "wbs_code",
            "wbs code": "wbs_code",
            "outline level": "outline_level",
            "task name": "name",
            "name": "name",
            "title": "name",
            "task": "name",
            "duration": "duration_days",
            "duration (days)": "duration_days",
            "duration_days": "duration_days",
            "start date": "start_date",
            "start": "start_date",
            "start_date": "start_date",
            "end date": "end_date",
            "finish": "end_date",
            "finish date": "end_date",
            "end_date": "end_date",
            "progress %": "percent_complete",
            "progress": "percent_complete",
            "% complete": "percent_complete",
            "percent complete": "percent_complete",
            "percent_complete": "percent_complete",
            "milestone": "is_milestone",
            "is milestone": "is_milestone",
            "is_milestone": "is_milestone",
            "constraint type": "constraint_type",
            "constraint": "constraint_type",
            "constraint_type": "constraint_type",
            "constraint date": "constraint_date",
            "constraint_date": "constraint_date",
            "actual start": "actual_start",
            "actual_start": "actual_start",
            "actual end": "actual_end",
            "actual finish": "actual_end",
            "actual_end": "actual_end",
            "fixed cost": "fixed_cost",
            "cost": "fixed_cost",
            "fixed_cost": "fixed_cost",
            "predecessors": "predecessors",
            "predecessor": "predecessors",
            "resources": "assigned_resources",
            "assigned to": "assigned_resources",
            "assigned_resources": "assigned_resources",
            "notes": "notes",
            "description": "notes",
        }

        for fieldname in fieldnames:
            normalized = fieldname.strip().lower()
            if normalized in aliases:
                header_map[fieldname] = aliases[normalized]

        return header_map

    def _parse_row(
        self,
        row: dict[str, str],
        header_map: dict[str, str],
        row_idx: int,
        warnings: list[str],
    ) -> Optional[TaskPreview]:
        """Parse a single CSV row into a TaskPreview."""
        # Build field values from header map
        values: dict[str, str] = {}
        for csv_header, internal_field in header_map.items():
            val = (row.get(csv_header) or "").strip()
            values[internal_field] = val

        name = values.get("name", "")
        if not name:
            warnings.append(f"Row {row_idx}: Empty task name, skipping")
            return None

        # Duration
        duration_str = values.get("duration_days", "1")
        try:
            duration_days = float(duration_str) if duration_str else 1.0
        except (ValueError, TypeError):
            duration_days = 1.0
            warnings.append(f"Row {row_idx}: Invalid duration '{duration_str}', defaulting to 1 day")

        # Dates
        start_date = self._parse_date(values.get("start_date", ""), row_idx, "Start Date", warnings)
        end_date = self._parse_date(values.get("end_date", ""), row_idx, "End Date", warnings)
        actual_start = self._parse_date(values.get("actual_start", ""), row_idx, "Actual Start", warnings)
        actual_end = self._parse_date(values.get("actual_end", ""), row_idx, "Actual End", warnings)
        constraint_date = self._parse_date(values.get("constraint_date", ""), row_idx, "Constraint Date", warnings)

        # Progress (handle both 0-1 and 0-100 ranges)
        pct_str = values.get("percent_complete", "0")
        try:
            pct = float(pct_str) if pct_str else 0.0
            if pct > 1:
                pct = pct / 100.0  # Assume percentage format (0-100)
        except (ValueError, TypeError):
            pct = 0.0
            warnings.append(f"Row {row_idx}: Invalid progress '{pct_str}', defaulting to 0")

        # Milestone
        milestone_str = values.get("is_milestone", "").lower()
        is_milestone = milestone_str in ("yes", "true", "1", "y")

        if is_milestone:
            duration_days = 0.0

        # Constraint type
        constraint_type = (values.get("constraint_type", "ASAP") or "ASAP").upper()
        valid_constraints = {"ASAP", "ALAP", "MSO", "MFO", "SNET", "SNLT", "FNET", "FNLT"}
        if constraint_type not in valid_constraints:
            warnings.append(f"Row {row_idx}: Invalid constraint '{constraint_type}', defaulting to ASAP")
            constraint_type = "ASAP"

        # Cost
        cost_str = values.get("fixed_cost", "0")
        try:
            fixed_cost = float(cost_str) if cost_str else 0.0
        except (ValueError, TypeError):
            fixed_cost = 0.0

        # WBS
        wbs_code = values.get("wbs_code", "")
        outline_level = wbs_code.count(".") + 1 if wbs_code else 0

        # Predecessors (parse "1FS,3SS+2" format)
        deps = self._parse_predecessors(values.get("predecessors", ""), row_idx, warnings)

        # Resources
        res_str = values.get("assigned_resources", "")
        assigned_resources = [r.strip() for r in res_str.split(",") if r.strip()] if res_str else []

        # Notes
        notes = values.get("notes", "")

        tp = TaskPreview(
            source_id=str(row_idx),
            name=name,
            wbs_code=wbs_code,
            outline_level=outline_level,
            start_date=start_date,
            end_date=end_date,
            duration_days=max(0.0, duration_days),
            is_milestone=is_milestone,
            percent_complete=max(0.0, min(1.0, pct)),
            actual_start=actual_start,
            actual_end=actual_end,
            constraint_type=constraint_type,
            constraint_date=constraint_date,
            fixed_cost=fixed_cost,
            notes=notes or None,
            dependencies=deps,
            assigned_resources=assigned_resources,
            action=ImportAction.CREATE,
        )

        # Validation
        if tp.start_date and tp.end_date and tp.start_date > tp.end_date:
            tp.issues.append(f"Start ({tp.start_date}) after end ({tp.end_date}), swapped")
            tp.start_date, tp.end_date = tp.end_date, tp.start_date

        return tp

    def _parse_date(
        self, val: str, row_idx: int, field_name: str, warnings: list[str]
    ) -> Optional[date]:
        """Parse a date string with multiple format attempts."""
        if not val:
            return None
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
        warnings.append(f"Row {row_idx}: Cannot parse {field_name} '{val}', leaving empty")
        return None

    def _parse_predecessors(
        self, val: str, row_idx: int, warnings: list[str]
    ) -> list[tuple[str, str, float]]:
        """
        Parse predecessor string like "1FS,3SS+2,5FF-1".
        Format: <row_number><type>[+/-lag_days]
        """
        if not val:
            return []

        deps = []
        for part in val.split(","):
            part = part.strip()
            if not part:
                continue

            # Try to parse: digits + optional type + optional lag
            import re
            match = re.match(r"(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?", part, re.IGNORECASE)
            if match:
                pred_id = match.group(1)
                dep_type = (match.group(2) or "FS").upper()
                lag_str = match.group(3) or "0"
                lag_days = float(lag_str)
                deps.append((pred_id, dep_type, lag_days))
            else:
                warnings.append(f"Row {row_idx}: Cannot parse predecessor '{part}'")

        return deps

    def _validate_predecessors(
        self, tasks: list[TaskPreview], warnings: list[str]
    ) -> list[TaskPreview]:
        """Validate predecessor references exist (by source_id = row number)."""
        source_ids = {t.source_id for t in tasks}
        for task in tasks:
            valid_deps = []
            for pred_id, dep_type, lag in task.dependencies:
                if pred_id in source_ids:
                    valid_deps.append((pred_id, dep_type, lag))
                else:
                    warnings.append(
                        f"Task '{task.name}' references non-existent predecessor row {pred_id}"
                    )
            task.dependencies = valid_deps
        return tasks

    def _auto_generate_wbs(self, tasks: list[TaskPreview]):
        """Auto-generate WBS codes for tasks that don't have them."""
        has_any_wbs = any(t.wbs_code for t in tasks)
        if has_any_wbs:
            return  # Don't overwrite existing WBS

        for idx, task in enumerate(tasks, 1):
            if not task.wbs_code:
                task.wbs_code = str(idx)
                task.outline_level = 1


# ---------------------------------------------------------------------------
# CSV Builder (Export)
# ---------------------------------------------------------------------------

class CSVExporter:
    """Export project data to CSV format."""

    def build(
        self,
        tasks: list[dict],
        resources: list[dict],
        dependencies: list[dict],
    ) -> str:
        """
        Build CSV content with tasks, including predecessors and resources.

        Args:
            tasks: List of task dicts
            resources: List of resource dicts
            dependencies: List of dependency dicts
        """
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header row
        headers = [h for h, _ in CSV_COLUMNS]
        writer.writerow(headers)

        # Build lookup maps
        # task_id → row number (1-based, for predecessor references)
        task_row_map: dict[str, int] = {}
        for idx, task in enumerate(tasks, 1):
            task_row_map[str(task.get("id", ""))] = idx

        # task_id → list of resource names
        task_resources: dict[str, list[str]] = {}
        res_id_map = {str(r["id"]): r["name"] for r in resources}
        for task in tasks:
            res_ids = task.get("assigned_resource_ids", [])
            task_resources[str(task.get("id", ""))] = [
                res_id_map.get(str(rid), "") for rid in res_ids if str(rid) in res_id_map
            ]

        # successor_id → list of (predecessor_row, type, lag)
        succ_deps: dict[str, list[tuple[int, str, float]]] = {}
        for dep in dependencies:
            succ_id = str(dep.get("successor_id", ""))
            pred_id = str(dep.get("predecessor_id", ""))
            pred_row = task_row_map.get(pred_id, 0)
            if pred_row and succ_id:
                if succ_id not in succ_deps:
                    succ_deps[succ_id] = []
                succ_deps[succ_id].append((
                    pred_row,
                    dep.get("dependency_type", "FS"),
                    dep.get("lag_days", 0.0),
                ))

        # Data rows
        for idx, task in enumerate(tasks, 1):
            task_id = str(task.get("id", ""))

            # Format predecessors
            preds = succ_deps.get(task_id, [])
            pred_str = ",".join(
                f"{row}{dtype}" + (f"+{lag}" if lag > 0 else f"{lag}" if lag < 0 else "")
                for row, dtype, lag in preds
            )

            # Format resources
            res_names = task_resources.get(task_id, [])
            res_str = ",".join(res_names)

            row_data = [
                task.get("wbs_code", str(idx)),
                task.get("name", ""),
                task.get("duration_days", 1.0),
                task.get("start_date", ""),
                task.get("end_date", ""),
                f"{task.get('percent_complete', 0.0) * 100:.0f}",
                "Yes" if task.get("is_milestone") else "No",
                task.get("constraint_type", "ASAP"),
                task.get("constraint_date", ""),
                task.get("actual_start", ""),
                task.get("actual_end", ""),
                task.get("fixed_cost", 0.0),
                pred_str,
                res_str,
                task.get("notes", ""),
            ]
            writer.writerow(row_data)

        return output.getvalue()
