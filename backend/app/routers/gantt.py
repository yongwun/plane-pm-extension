"""Gantt chart, CPM, dependencies, and WBS routes."""

from datetime import datetime, date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.models.dependency import Dependency
from pydantic import BaseModel
from typing import Optional

from app.schemas.gantt import (
    GanttData, GanttTask, GanttDependency, CPMResult, WBSResponse,
    DependencyCreate, DependencyUpdate,
)


class WorkItemUpdate(BaseModel):
    """Partial update for workitem extension."""
    fixed_cost: Optional[float] = None
    percent_complete: Optional[float] = None
    duration_days: Optional[float] = None
    is_milestone: Optional[bool] = None
    constraint_type: Optional[str] = None
    constraint_date: Optional[date] = None
    notes: Optional[str] = None
from app.services.cpm_engine import CPMEngine, TaskNode
from app.services.wbs_builder import WBSBuilder
from app.services.plane_client import get_plane_client

router = APIRouter()


# ------------------------------------------------------------------
# Gantt Data
# ------------------------------------------------------------------

@router.get("/{project_ext_id}/data", response_model=GanttData)
async def get_gantt_data(
    project_ext_id: UUID,
    run_cpm: bool = Query(True, description="Run CPM calculation"),
    db: AsyncSession = Depends(get_db),
):
    """Get complete Gantt chart data for a project (tasks + dependencies + CPM)."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    # Fetch workitem extensions
    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = result.scalars().all()

    # Fetch dependencies
    workitem_ids = [w.id for w in workitems]
    deps_result = await db.execute(
        select(Dependency).where(
            Dependency.predecessor_workitem_ext_id.in_(workitem_ids)
        )
    ) if workitem_ids else None
    dependencies = deps_result.scalars().all() if deps_result else []

    # Build task list
    tasks = []
    for w in workitems:
        name = w.plane_workitem_id
        if isinstance(w.extra, dict) and w.extra.get("name"):
            seq = w.extra.get("sequence_id", "")
            name = f"{seq} - {w.extra['name']}" if seq else w.extra["name"]
        tasks.append(GanttTask(
            id=str(w.id),
            plane_workitem_id=w.plane_workitem_id,
            name=name,
            wbs_code=w.wbs_code or "",
            outline_level=w.outline_level or 0,
            start_date=w.actual_start,
            end_date=w.actual_end,
            duration_days=w.duration_days or 0,
            is_milestone=w.is_milestone,
            is_critical=w.is_critical,
            percent_complete=w.percent_complete or 0,
            early_start=w.early_start,
            early_finish=w.early_finish,
            late_start=w.late_start,
            late_finish=w.late_finish,
            total_float=w.total_float,
            free_float=w.free_float,
            fixed_cost=w.fixed_cost or 0,
        ))

    # Build dependency list
    gantt_deps = [
        GanttDependency(
            id=str(d.id),
            source=str(d.predecessor_workitem_ext_id),
            target=str(d.successor_workitem_ext_id),
            type=d.dependency_type,
            lag=d.lag_days,
        )
        for d in dependencies
    ]

    # Run CPM if requested
    critical_path = []
    summary = {}
    if run_cpm and workitems:
        try:
            cpm_tasks = _build_cpm_tasks(workitems, dependencies, project)
            # Use earliest task start date as project start
            earliest = min((w.actual_start for w in workitems if w.actual_start), default=date.today())
            project_start = datetime.combine(earliest, datetime.min.time())
            engine = CPMEngine(
                tasks=cpm_tasks,
                project_start=project_start,
                work_days_per_week=project.work_days_per_week,
                work_hours_per_day=project.work_hours_per_day,
            )
            engine.calculate()
            critical_path = engine.get_critical_path()
            summary = engine.get_summary()

            # Update DB with CPM results and refresh task objects
            for cpm_task in cpm_tasks:
                wi = next((w for w in workitems if str(w.id) == cpm_task.id), None)
                if wi:
                    wi.early_start = cpm_task.early_start
                    wi.early_finish = cpm_task.early_finish
                    wi.late_start = cpm_task.late_start
                    wi.late_finish = cpm_task.late_finish
                    wi.total_float = cpm_task.total_float
                    wi.free_float = cpm_task.free_float
                    wi.is_critical = cpm_task.is_critical

            # Rebuild tasks with CPM data
            tasks = []
            for w in workitems:
                name = w.plane_workitem_id
                if isinstance(w.extra, dict) and w.extra.get("name"):
                    seq = w.extra.get("sequence_id", "")
                    name = f"{seq} - {w.extra['name']}" if seq else w.extra["name"]
                tasks.append(GanttTask(
                    id=str(w.id),
                    plane_workitem_id=w.plane_workitem_id,
                    name=name,
                    wbs_code=w.wbs_code or "",
                    outline_level=w.outline_level or 0,
                    start_date=w.actual_start,
                    end_date=w.actual_end,
                    duration_days=w.duration_days or 0,
                    is_milestone=w.is_milestone,
                    is_critical=w.is_critical,
                    percent_complete=w.percent_complete or 0,
                    early_start=w.early_start,
                    early_finish=w.early_finish,
                    late_start=w.late_start,
                    late_finish=w.late_finish,
                    total_float=w.total_float,
                    free_float=w.free_float,
                    fixed_cost=w.fixed_cost or 0,
                ))
        except ValueError as e:
            summary = {"error": str(e)}

    return GanttData(
        project_id=str(project.id),
        project_name=project.plane_project_name or "",
        tasks=tasks,
        dependencies=gantt_deps,
        critical_path=critical_path,
        summary=summary,
    )


# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------

@router.get("/{project_ext_id}/dependencies", response_model=list[GanttDependency])
async def list_dependencies(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all dependencies for a project."""
    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = result.scalars().all()
    workitem_ids = [w.id for w in workitems]

    if not workitem_ids:
        return []

    deps_result = await db.execute(
        select(Dependency).where(Dependency.predecessor_workitem_ext_id.in_(workitem_ids))
    )
    deps = deps_result.scalars().all()
    return [
        GanttDependency(
            id=str(d.id),
            source=str(d.predecessor_workitem_ext_id),
            target=str(d.successor_workitem_ext_id),
            type=d.dependency_type,
            lag=d.lag_days,
        )
        for d in deps
    ]


@router.post("/{project_ext_id}/dependencies", response_model=GanttDependency, status_code=201)
async def create_dependency(
    project_ext_id: UUID, data: DependencyCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new dependency between two work items."""
    # Find workitem extensions
    pred_result = await db.execute(
        select(WorkItemExtension).where(
            WorkItemExtension.plane_workitem_id == data.predecessor_workitem_id,
            WorkItemExtension.project_ext_id == project_ext_id,
        )
    )
    pred = pred_result.scalar_one_or_none()
    if not pred:
        # Auto-create extension for predecessor
        pred = WorkItemExtension(
            plane_workitem_id=data.predecessor_workitem_id,
            project_ext_id=project_ext_id,
        )
        db.add(pred)
        await db.flush()

    succ_result = await db.execute(
        select(WorkItemExtension).where(
            WorkItemExtension.plane_workitem_id == data.successor_workitem_id,
            WorkItemExtension.project_ext_id == project_ext_id,
        )
    )
    succ = succ_result.scalar_one_or_none()
    if not succ:
        succ = WorkItemExtension(
            plane_workitem_id=data.successor_workitem_id,
            project_ext_id=project_ext_id,
        )
        db.add(succ)
        await db.flush()

    dep = Dependency(
        predecessor_workitem_ext_id=pred.id,
        successor_workitem_ext_id=succ.id,
        dependency_type=data.dependency_type,
        lag_days=data.lag_days,
    )
    db.add(dep)
    await db.flush()

    return GanttDependency(
        id=str(dep.id),
        source=str(pred.id),
        target=str(succ.id),
        type=dep.dependency_type,
        lag=dep.lag_days,
    )


@router.delete("/{project_ext_id}/dependencies/{dep_id}", status_code=204)
async def delete_dependency(
    project_ext_id: UUID, dep_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Delete a dependency."""
    dep = await db.get(Dependency, dep_id)
    if not dep:
        raise HTTPException(404, "Dependency not found")
    await db.delete(dep)


# ------------------------------------------------------------------
# Workitem Extension Updates
# ------------------------------------------------------------------

@router.patch("/{project_ext_id}/workitems/{workitem_id}")
async def update_workitem(
    project_ext_id: UUID,
    workitem_id: UUID,
    data: WorkItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update workitem extension fields (cost, progress, etc.)."""
    wi = await db.get(WorkItemExtension, workitem_id)
    if not wi or wi.project_ext_id != project_ext_id:
        raise HTTPException(404, "Workitem not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wi, key, value)
    await db.flush()
    await db.refresh(wi)
    return {"id": str(wi.id), "updated": True}


# ------------------------------------------------------------------
# CPM Calculation
# ------------------------------------------------------------------

@router.post("/{project_ext_id}/cpm", response_model=CPMResult)
async def calculate_cpm(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """Run CPM calculation for a project."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = result.scalars().all()

    if not workitems:
        raise HTTPException(400, "No work items to calculate")

    workitem_ids = [w.id for w in workitems]
    deps_result = await db.execute(
        select(Dependency).where(Dependency.predecessor_workitem_ext_id.in_(workitem_ids))
    )
    dependencies = deps_result.scalars().all()

    cpm_tasks = _build_cpm_tasks(workitems, dependencies, project)
    project_start = datetime.utcnow()
    if project.config and project.config.get("project_start"):
        project_start = datetime.fromisoformat(project.config["project_start"])

    engine = CPMEngine(
        tasks=cpm_tasks,
        project_start=project_start,
        work_days_per_week=project.work_days_per_week,
        work_hours_per_day=project.work_hours_per_day,
    )

    try:
        engine.calculate()
    except ValueError as e:
        raise HTTPException(400, str(e))

    summary = engine.get_summary()
    gantt_tasks = [
        GanttTask(
            id=t.id,
            plane_workitem_id=t.plane_workitem_id,
            name=t.name,
            duration_days=t.duration_days,
            is_milestone=t.is_milestone,
            is_critical=t.is_critical,
            early_start=t.early_start,
            early_finish=t.early_finish,
            late_start=t.late_start,
            late_finish=t.late_finish,
            total_float=t.total_float,
            free_float=t.free_float,
        )
        for t in cpm_tasks
    ]

    return CPMResult(
        project_id=str(project.id),
        project_start=summary["project_start"],
        project_end=summary["project_end"],
        total_duration_days=summary["total_duration_days"],
        total_tasks=summary["total_tasks"],
        critical_tasks=summary["critical_tasks"],
        critical_path=summary["critical_path"],
        tasks=gantt_tasks,
    )


# ------------------------------------------------------------------
# WBS
# ------------------------------------------------------------------

@router.get("/{project_ext_id}/wbs", response_model=WBSResponse)
async def get_wbs(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get WBS tree for a project."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = result.scalars().all()

    items = []
    for w in workitems:
        name = w.plane_workitem_id
        if isinstance(w.extra, dict) and w.extra.get("name"):
            seq = w.extra.get("sequence_id", "")
            name = f"{seq} - {w.extra['name']}" if seq else w.extra["name"]
        items.append({
            "id": str(w.id),
            "plane_workitem_id": w.plane_workitem_id,
            "name": name,
            "parent_id": str(w.parent_workitem_ext_id) if getattr(w, "parent_workitem_ext_id", None) else None,
            "start_date": str(w.actual_start) if w.actual_start else None,
            "end_date": str(w.actual_end) if w.actual_end else None,
            "duration_days": w.duration_days or 0,
            "is_milestone": w.is_milestone,
            "percent_complete": w.percent_complete or 0,
            "is_critical": w.is_critical,
            "state": w.extra.get("state_group", "") if isinstance(w.extra, dict) else "",
        })

    builder = WBSBuilder(separator=project.wbs_separator)
    roots = builder.build(items)

    return WBSResponse(
        project_id=str(project.id),
        tree=[r.to_dict() for r in roots],
        flat=builder.flatten(roots),
    )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _build_cpm_tasks(
    workitems: list[WorkItemExtension],
    dependencies: list[Dependency],
    project: ProjectExtension,
) -> list[TaskNode]:
    """Convert DB models to CPM TaskNode list."""
    tasks = []
    dep_map: dict[str, list[tuple[str, str, float]]] = {}
    succ_map: dict[str, list[tuple[str, str, float]]] = {}

    for d in dependencies:
        pred_id = str(d.predecessor_workitem_ext_id)
        succ_id = str(d.successor_workitem_ext_id)
        dep_map.setdefault(succ_id, []).append((pred_id, d.dependency_type, d.lag_days))
        succ_map.setdefault(pred_id, []).append((succ_id, d.dependency_type, d.lag_days))

    for w in workitems:
        wid = str(w.id)
        tasks.append(TaskNode(
            id=wid,
            plane_workitem_id=w.plane_workitem_id,
            name=w.plane_workitem_id,
            duration_days=w.duration_days or 1.0,
            is_milestone=w.is_milestone,
            constraint_type=w.constraint_type or "ASAP",
            constraint_date=datetime.combine(w.constraint_date, datetime.min.time()) if w.constraint_date else None,
            predecessors=dep_map.get(wid, []),
            successors=succ_map.get(wid, []),
        ))

    return tasks
