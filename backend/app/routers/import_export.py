"""Import/Export API router — preview, commit, and export endpoints."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.utils import natural_sort_key
from app.models.dependency import Dependency
from app.models.resource import ResourcePool, ResourceAllocation
from app.models.baseline import Baseline, BaselineItem
from app.models.calendar import WorkCalendar
from app.services.import_export.schemas import (
    ConflictStrategy,
    ExportFormat,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportFormat,
    ImportPreview,
    ImportAction,
)
from app.services.import_export.msproject_xml import MSProjectParser, MSProjectExporter
from app.services.import_export.csv_handler import CSVParser, CSVExporter

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Preview cache (in-memory, 30-min TTL) ──
_preview_cache: dict[str, ImportPreview] = {}
_PREVIEW_TTL_SECONDS = 1800  # 30 minutes


def _clean_expired_previews():
    """Remove expired preview entries."""
    now = datetime.utcnow()
    expired = [
        k for k, v in _preview_cache.items()
        if (now - v.created_at).total_seconds() > _PREVIEW_TTL_SECONDS
    ]
    for k in expired:
        del _preview_cache[k]


# ===========================================================================
# IMPORT ENDPOINTS
# ===========================================================================


@router.post("/preview/msproject", response_model=ImportPreview)
async def preview_msproject_import(
    file: UploadFile = File(...),
):
    """
    Phase 1: Upload an MS Project XML file and get a preview.
    No database changes — purely read-only analysis.
    """
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty")

    parser = MSProjectParser()
    preview = parser.parse(content, filename=file.filename or "import.xml")

    if preview.errors and not preview.tasks:
        raise HTTPException(422, detail={
            "message": "File validation failed",
            "errors": preview.errors,
            "warnings": preview.warnings,
        })

    # Cache the preview for commit
    _clean_expired_previews()
    _preview_cache[preview.preview_token] = preview

    return preview


@router.post("/preview/csv", response_model=ImportPreview)
async def preview_csv_import(
    file: UploadFile = File(...),
):
    """
    Phase 1: Upload a CSV file and get a preview.
    No database changes — purely read-only analysis.
    """
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty")

    # Detect encoding (try UTF-8 first, then GBK for Chinese exports)
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            csv_text = content.decode("gbk")
        except UnicodeDecodeError:
            csv_text = content.decode("latin-1")

    parser = CSVParser()
    preview = parser.parse(csv_text, filename=file.filename or "import.csv")

    if preview.errors and not preview.tasks:
        raise HTTPException(422, detail={
            "message": "CSV validation failed",
            "errors": preview.errors,
            "warnings": preview.warnings,
        })

    _clean_expired_previews()
    _preview_cache[preview.preview_token] = preview

    return preview


@router.get("/preview/{preview_token}", response_model=ImportPreview)
async def get_preview(preview_token: str):
    """Retrieve a cached import preview by token."""
    preview = _preview_cache.get(preview_token)
    if not preview:
        raise HTTPException(404, "Preview not found or expired (30 min TTL)")
    return preview


@router.post("/commit", response_model=ImportCommitResponse)
async def commit_import(
    data: ImportCommitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 2: Commit a validated import preview into the database.
    Creates a pre-import baseline for safety, then writes all data in a single transaction.
    """
    # Retrieve the preview
    preview = _preview_cache.get(data.preview_token)
    if not preview:
        raise HTTPException(404, "Preview not found or expired (30 min TTL)")

    project_ext_id = UUID(data.project_ext_id)
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    result = ImportCommitResponse(success=False)

    try:
        # ── Step 1: Create pre-import baseline (safety net) ──
        if data.create_baseline_before_import:
            baseline_id = await _create_pre_import_baseline(
                db, project_ext_id, preview.filename
            )
            result.pre_import_baseline_id = str(baseline_id) if baseline_id else None

        # ── Step 2: Import resources ──
        resource_map = await _import_resources(
            db, project_ext_id, preview.resources, data.conflict_strategy
        )
        result.resources_created = len(resource_map)

        # ── Step 3: Import tasks ──
        task_map, created, updated, skipped = await _import_tasks(
            db, project_ext_id, preview.tasks, data.conflict_strategy
        )
        result.tasks_created = created
        result.tasks_updated = updated
        result.tasks_skipped = skipped

        # ── Step 4: Import dependencies ──
        deps_created = await _import_dependencies(db, preview.tasks, task_map)
        result.dependencies_created = deps_created

        # ── Step 5: Create resource allocations ──
        await _import_allocations(db, preview.tasks, task_map, resource_map)

        # Commit transaction
        await db.commit()

        result.success = True
        result.warnings = preview.warnings
        logger.info(
            f"Import committed: {created} tasks created, {updated} updated, "
            f"{skipped} skipped, {deps_created} deps, {len(resource_map)} resources"
        )

    except Exception as e:
        await db.rollback()
        result.success = False
        result.errors = [f"Import failed and was rolled back: {str(e)}"]
        logger.error(f"Import failed: {e}", exc_info=True)
        raise HTTPException(500, detail={
            "message": "Import failed, all changes rolled back",
            "errors": result.errors,
        })

    finally:
        # Remove preview from cache after commit
        _preview_cache.pop(data.preview_token, None)

    return result


# ===========================================================================
# EXPORT ENDPOINTS
# ===========================================================================


@router.get("/{project_ext_id}/export/msproject")
async def export_msproject_xml(
    project_ext_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Export project data as MS Project XML (MSPDI format)."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    # Gather all data
    tasks_data, resources_data, deps_data = await _gather_export_data(db, project_ext_id)

    # Determine project start date
    project_start = None
    for t in tasks_data:
        sd = t.get("start_date")
        if sd and (project_start is None or sd < project_start):
            project_start = sd

    # Convert string dates to date objects for XML export
    if isinstance(project_start, str):
        try:
            project_start = datetime.fromisoformat(project_start).date()
        except (ValueError, TypeError):
            try:
                project_start = date.fromisoformat(project_start)
            except (ValueError, TypeError):
                project_start = None

    # Calendar info
    calendar_info = None
    cal_result = await db.execute(
        select(WorkCalendar).where(WorkCalendar.project_ext_id == project_ext_id)
    )
    cal = cal_result.scalar_one_or_none()
    if cal:
        calendar_info = {
            "name": cal.name,
            "work_days": cal.work_days if isinstance(cal.work_days, list) else [2, 3, 4, 5, 6],
        }

    # Build XML
    exporter = MSProjectExporter()
    xml_content = exporter.build(
        project_name=project.plane_project_name or "Project",
        tasks=tasks_data,
        resources=resources_data,
        dependencies=deps_data,
        project_start=project_start or date.today(),
        calendar_info=calendar_info,
    )

    filename = f"{project.plane_project_name or 'project'}_{date.today().isoformat()}.xml"
    # Use RFC 5987 encoding for non-ASCII filenames
    encoded_filename = quote(filename)
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.get("/{project_ext_id}/export/csv")
async def export_csv(
    project_ext_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Export project data as CSV."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    tasks_data, resources_data, deps_data = await _gather_export_data(db, project_ext_id)

    exporter = CSVExporter()
    csv_content = exporter.build(
        tasks=tasks_data,
        resources=resources_data,
        dependencies=deps_data,
    )

    filename = f"{project.plane_project_name or 'project'}_{date.today().isoformat()}.csv"
    # Use RFC 5987 encoding for non-ASCII filenames
    encoded_filename = quote(filename)
    return Response(
        content=csv_content.encode("utf-8-sig"),  # BOM for Excel compatibility
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


# ===========================================================================
# INTERNAL HELPERS
# ===========================================================================


async def _create_pre_import_baseline(
    db: AsyncSession, project_ext_id: UUID, source_filename: str
) -> Optional[UUID]:
    """Create a baseline snapshot before import (safety net)."""
    # Check if there are any existing workitems to snapshot
    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    existing = result.scalars().all()
    if not existing:
        return None  # Nothing to snapshot

    baseline = Baseline(
        project_ext_id=project_ext_id,
        name=f"Pre-Import Backup ({datetime.utcnow().strftime('%Y-%m-%d %H:%M')})",
        description=f"Auto-created before importing from {source_filename}",
    )
    db.add(baseline)
    await db.flush()

    for w in existing:
        name = ""
        if isinstance(w.extra, dict) and w.extra.get("name"):
            name = w.extra["name"]

        # Convert string dates to date objects for database storage
        start_val = w.extra.get("start_date") if isinstance(w.extra, dict) else None
        end_val = w.extra.get("end_date") if isinstance(w.extra, dict) else None
        if isinstance(start_val, str):
            try:
                start_val = date.fromisoformat(start_val)
            except (ValueError, TypeError):
                start_val = None
        if isinstance(end_val, str):
            try:
                end_val = date.fromisoformat(end_val)
            except (ValueError, TypeError):
                end_val = None

        bi = BaselineItem(
            baseline_id=baseline.id,
            workitem_ext_id=w.id,
            plane_workitem_id=w.plane_workitem_id,
            wbs_code=w.wbs_code,
            name=name,
            start_date=start_val,
            end_date=end_val,
            duration_days=w.duration_days,
            is_milestone=w.is_milestone,
            percent_complete=w.percent_complete,
            estimated_hours=w.extra.get("estimated_hours") if isinstance(w.extra, dict) else None,
            fixed_cost=w.fixed_cost,
        )
        db.add(bi)

    await db.flush()
    logger.info(f"Pre-import baseline created: {baseline.id}")
    return baseline.id


async def _import_resources(
    db: AsyncSession,
    project_ext_id: UUID,
    resource_previews: list,
    strategy: ConflictStrategy,
) -> dict[str, UUID]:
    """Import resources and return {source_id: db_id} mapping."""
    resource_map: dict[str, UUID] = {}

    # Load existing resources for conflict detection
    result = await db.execute(
        select(ResourcePool).where(ResourcePool.project_ext_id == project_ext_id)
    )
    existing = {r.name.lower(): r for r in result.scalars().all()}

    for rp in resource_previews:
        existing_res = existing.get(rp.name.lower())

        if existing_res:
            if strategy == ConflictStrategy.SKIP:
                resource_map[rp.source_id] = existing_res.id
                continue
            elif strategy == ConflictStrategy.OVERWRITE:
                existing_res.standard_rate = rp.standard_rate
                existing_res.overtime_rate = rp.overtime_rate
                existing_res.cost_per_use = rp.cost_per_use
                existing_res.max_units = rp.max_units
                existing_res.group_name = rp.group_name
                existing_res.email = rp.email
                resource_map[rp.source_id] = existing_res.id
                continue
            elif strategy == ConflictStrategy.MERGE:
                # Only update non-null fields
                if rp.standard_rate > 0:
                    existing_res.standard_rate = rp.standard_rate
                if rp.group_name:
                    existing_res.group_name = rp.group_name
                resource_map[rp.source_id] = existing_res.id
                continue

        # Create new resource
        new_res = ResourcePool(
            project_ext_id=project_ext_id,
            name=rp.name,
            resource_type=rp.resource_type,
            standard_rate=rp.standard_rate,
            overtime_rate=rp.overtime_rate,
            cost_per_use=rp.cost_per_use,
            max_units=rp.max_units,
            group_name=rp.group_name,
            email=rp.email,
        )
        db.add(new_res)
        await db.flush()
        resource_map[rp.source_id] = new_res.id

    return resource_map


async def _import_tasks(
    db: AsyncSession,
    project_ext_id: UUID,
    task_previews: list,
    strategy: ConflictStrategy,
) -> tuple[dict[str, UUID], int, int, int]:
    """
    Import tasks and return (source_id → workitem_ext_id map, created, updated, skipped).
    """
    task_map: dict[str, UUID] = {}
    created = 0
    updated = 0
    skipped = 0

    # Load existing workitems
    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    existing_items = result.scalars().all()

    # Build lookup by name (for CSV) and by plane_workitem_id (for XML)
    existing_by_name = {}
    existing_by_plane_id = {}
    for w in existing_items:
        name = w.extra.get("name", "") if isinstance(w.extra, dict) else ""
        if name:
            existing_by_name[name.lower()] = w
        existing_by_plane_id[w.plane_workitem_id] = w

    for tp in task_previews:
        if tp.action == ImportAction.SKIP:
            skipped += 1
            continue

        # Check for existing match by name
        existing = existing_by_name.get(tp.name.lower())

        # Generate a unique plane_workitem_id for imported tasks
        import_id = f"import_{tp.source_id}_{uuid.uuid4().hex[:8]}"

        if existing:
            if strategy == ConflictStrategy.SKIP:
                task_map[tp.source_id] = existing.id
                skipped += 1
                continue
            elif strategy == ConflictStrategy.OVERWRITE:
                # Update existing workitem extension
                extra = dict(existing.extra) if isinstance(existing.extra, dict) else {}
                extra.update({
                    "name": tp.name,
                    "imported": True,
                    "import_source": tp.source_id,
                })
                if tp.start_date:
                    extra["start_date"] = tp.start_date.isoformat()
                if tp.end_date:
                    extra["end_date"] = tp.end_date.isoformat()
                extra["sequence_id"] = tp.wbs_code or tp.source_id

                existing.wbs_code = tp.wbs_code or existing.wbs_code
                existing.outline_level = tp.outline_level
                existing.duration_days = tp.duration_days
                existing.is_milestone = tp.is_milestone
                existing.percent_complete = tp.percent_complete
                existing.actual_start = tp.actual_start or tp.start_date or existing.actual_start
                existing.actual_end = tp.actual_end or tp.end_date or existing.actual_end
                existing.constraint_type = tp.constraint_type
                existing.constraint_date = tp.constraint_date
                existing.fixed_cost = tp.fixed_cost
                existing.notes = tp.notes or existing.notes
                existing.extra = extra

                task_map[tp.source_id] = existing.id
                updated += 1
                continue
            elif strategy == ConflictStrategy.MERGE:
                # Merge: only fill in empty/null fields
                extra = dict(existing.extra) if isinstance(existing.extra, dict) else {}
                if not extra.get("name"):
                    extra["name"] = tp.name
                if not existing.wbs_code and tp.wbs_code:
                    existing.wbs_code = tp.wbs_code
                if existing.duration_days is None or existing.duration_days == 1.0:
                    existing.duration_days = tp.duration_days
                if existing.fixed_cost == 0 and tp.fixed_cost > 0:
                    existing.fixed_cost = tp.fixed_cost
                existing.extra = extra

                task_map[tp.source_id] = existing.id
                updated += 1
                continue

        # Create new workitem extension
        extra = {
            "name": tp.name,
            "imported": True,
            "import_source": tp.source_id,
            "sequence_id": tp.wbs_code or tp.source_id,
        }
        if tp.start_date:
            extra["start_date"] = tp.start_date.isoformat()
        if tp.end_date:
            extra["end_date"] = tp.end_date.isoformat()

        # Resolve effective start/end dates:
        # prefer explicit actual dates, fall back to planned dates from import file
        effective_start = tp.actual_start or tp.start_date
        effective_end = tp.actual_end or tp.end_date

        new_wi = WorkItemExtension(
            plane_workitem_id=import_id,
            project_ext_id=project_ext_id,
            wbs_code=tp.wbs_code,
            outline_level=tp.outline_level,
            duration_days=tp.duration_days,
            is_milestone=tp.is_milestone,
            percent_complete=tp.percent_complete,
            actual_start=effective_start,
            actual_end=effective_end,
            constraint_type=tp.constraint_type,
            constraint_date=tp.constraint_date,
            fixed_cost=tp.fixed_cost,
            notes=tp.notes,
            extra=extra,
        )
        db.add(new_wi)
        await db.flush()
        task_map[tp.source_id] = new_wi.id
        created += 1

    return task_map, created, updated, skipped


async def _import_dependencies(
    db: AsyncSession,
    task_previews: list,
    task_map: dict[str, UUID],
) -> int:
    """Import task dependencies. Returns count of created dependencies."""
    created = 0
    for tp in task_previews:
        succ_id = task_map.get(tp.source_id)
        if not succ_id:
            continue

        for pred_source_id, dep_type, lag in tp.dependencies:
            pred_id = task_map.get(pred_source_id)
            if not pred_id:
                continue

            # Check if dependency already exists
            existing = await db.execute(
                select(Dependency).where(
                    Dependency.predecessor_workitem_ext_id == pred_id,
                    Dependency.successor_workitem_ext_id == succ_id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            dep = Dependency(
                predecessor_workitem_ext_id=pred_id,
                successor_workitem_ext_id=succ_id,
                dependency_type=dep_type,
                lag_days=lag,
            )
            db.add(dep)
            created += 1

    if created:
        await db.flush()

    return created


async def _import_allocations(
    db: AsyncSession,
    task_previews: list,
    task_map: dict[str, UUID],
    resource_map: dict[str, UUID],
):
    """Create resource allocations from import data."""
    for tp in task_previews:
        wi_id = task_map.get(tp.source_id)
        if not wi_id:
            continue

        for res_source_id in tp.assigned_resources:
            res_id = resource_map.get(res_source_id)
            if not res_id:
                continue

            # Check if allocation exists
            existing = await db.execute(
                select(ResourceAllocation).where(
                    ResourceAllocation.resource_id == res_id,
                    ResourceAllocation.workitem_ext_id == wi_id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            alloc = ResourceAllocation(
                resource_id=res_id,
                workitem_ext_id=wi_id,
                units=1.0,
            )
            db.add(alloc)

    await db.flush()


async def _gather_export_data(
    db: AsyncSession, project_ext_id: UUID
) -> tuple[list[dict], list[dict], list[dict]]:
    """Gather all project data for export."""
    # Tasks
    wi_result = await db.execute(
        select(WorkItemExtension)
        .where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = list(wi_result.scalars().all())
    workitems.sort(key=lambda w: natural_sort_key(w.wbs_code))

    # Resources
    res_result = await db.execute(
        select(ResourcePool).where(ResourcePool.project_ext_id == project_ext_id)
    )
    resources = res_result.scalars().all()

    # Allocations
    wi_ids = [w.id for w in workitems]
    alloc_result = await db.execute(
        select(ResourceAllocation).where(
            ResourceAllocation.workitem_ext_id.in_(wi_ids)
        )
    ) if wi_ids else None
    allocations = alloc_result.scalars().all() if alloc_result else []

    # Dependencies
    dep_result = await db.execute(
        select(Dependency).where(
            Dependency.predecessor_workitem_ext_id.in_(wi_ids)
        )
    ) if wi_ids else None
    dependencies = dep_result.scalars().all() if dep_result else []

    # Build task dicts
    tasks_data = []
    for w in workitems:
        extra = w.extra if isinstance(w.extra, dict) else {}
        task = {
            "id": str(w.id),
            "name": extra.get("name", w.plane_workitem_id),
            "wbs_code": w.wbs_code or "",
            "outline_level": w.outline_level or 1,
            "start_date": extra.get("start_date") or (str(w.actual_start) if w.actual_start else None),
            "end_date": extra.get("end_date") or (str(w.actual_end) if w.actual_end else None),
            "duration_days": w.duration_days or 1.0,
            "is_milestone": w.is_milestone,
            "percent_complete": w.percent_complete or 0.0,
            "constraint_type": w.constraint_type or "ASAP",
            "constraint_date": str(w.constraint_date) if w.constraint_date else None,
            "fixed_cost": w.fixed_cost or 0.0,
            "actual_start": str(w.actual_start) if w.actual_start else None,
            "actual_end": str(w.actual_end) if w.actual_end else None,
            "is_critical": w.is_critical,
            "total_float": w.total_float,
            "early_start": str(w.early_start.date()) if w.early_start else None,
            "early_finish": str(w.early_finish.date()) if w.early_finish else None,
            "late_start": str(w.late_start.date()) if w.late_start else None,
            "late_finish": str(w.late_finish.date()) if w.late_finish else None,
            "notes": w.notes or "",
            "is_summary": False,
        }

        # Get assigned resource IDs
        task_allocs = [a for a in allocations if a.workitem_ext_id == w.id]
        task["assigned_resource_ids"] = [str(a.resource_id) for a in task_allocs]
        tasks_data.append(task)

    # Build resource dicts
    resources_data = []
    for r in resources:
        resources_data.append({
            "id": str(r.id),
            "name": r.name,
            "resource_type": r.resource_type,
            "standard_rate": r.standard_rate,
            "overtime_rate": r.overtime_rate,
            "cost_per_use": r.cost_per_use,
            "max_units": r.max_units,
            "group_name": r.group_name,
            "email": r.email,
        })

    # Build dependency dicts
    deps_data = []
    for d in dependencies:
        deps_data.append({
            "predecessor_id": str(d.predecessor_workitem_ext_id),
            "successor_id": str(d.successor_workitem_ext_id),
            "dependency_type": d.dependency_type,
            "lag_days": d.lag_days,
        })

    return tasks_data, resources_data, deps_data
