"""Resource management routes."""

from uuid import UUID
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.resource import ResourcePool, ResourceAllocation
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.schemas.resource import (
    ResourceCreate, ResourceUpdate, ResourceResponse,
    AllocationCreate, AllocationUpdate, AllocationResponse,
)

router = APIRouter()


# ------------------------------------------------------------------
# Cross-project resource summary
# ------------------------------------------------------------------

class AllocDetail(BaseModel):
    alloc_id: UUID
    project_ext_id: UUID
    project_name: str
    task_name: str
    task_id: UUID
    units: float
    work_hours: Optional[float] = None


class ResourceSummary(BaseModel):
    id: UUID
    project_ext_id: UUID
    project_name: str
    name: str
    resource_type: str
    standard_rate: float
    max_units: float
    group_name: Optional[str] = None
    is_active: bool
    total_allocated: float = 0.0
    remaining: float = 0.0
    utilization_pct: float = 0.0
    allocations: list[AllocDetail] = []


@router.get("/cross-project/summary", response_model=list[ResourceSummary])
async def cross_project_summary(db: AsyncSession = Depends(get_db)):
    """Return all resources across all projects with allocation details."""
    result = await db.execute(
        select(ResourcePool)
        .options(selectinload(ResourcePool.project))
        .order_by(ResourcePool.name)
    )
    all_resources = result.scalars().all()

    # Load all allocations with workitem info
    alloc_result = await db.execute(
        select(ResourceAllocation)
        .options(selectinload(ResourceAllocation.workitem))
    )
    all_allocs = alloc_result.scalars().all()

    # Build resource -> allocations map
    alloc_map: dict[UUID, list[ResourceAllocation]] = {}
    for a in all_allocs:
        alloc_map.setdefault(a.resource_id, []).append(a)

    summaries = []
    for r in all_resources:
        project_name = r.project.plane_project_name if r.project else "Unknown"
        res_allocs = alloc_map.get(r.id, [])
        total = sum(a.units for a in res_allocs)
        remaining = max(r.max_units - total, 0)
        util_pct = (total / r.max_units * 100) if r.max_units > 0 else 0

        details = []
        for a in res_allocs:
            wi: WorkItemExtension | None = a.workitem
            task_name = "Unknown"
            if wi and isinstance(wi.extra, dict) and wi.extra.get("name"):
                seq = wi.extra.get("sequence_id", "")
                task_name = f"{seq} - {wi.extra['name']}" if seq else wi.extra["name"]
            elif wi:
                task_name = wi.plane_workitem_id[:8]

            # Resolve project name for this allocation's workitem
            alloc_project_name = project_name  # same resource = same project in current model
            if wi and wi.project_ext_id != r.project_ext_id:
                # Cross-project allocation (future)
                proj_res = await db.execute(
                    select(ProjectExtension).where(ProjectExtension.id == wi.project_ext_id)
                )
                proj = proj_res.scalar_one_or_none()
                if proj:
                    alloc_project_name = proj.plane_project_name or "Unknown"

            details.append(AllocDetail(
                alloc_id=a.id,
                project_ext_id=wi.project_ext_id if wi else r.project_ext_id,
                project_name=alloc_project_name,
                task_name=task_name,
                task_id=a.workitem_ext_id,
                units=a.units,
                work_hours=a.work_hours,
            ))

        summaries.append(ResourceSummary(
            id=r.id,
            project_ext_id=r.project_ext_id,
            project_name=project_name,
            name=r.name,
            resource_type=r.resource_type,
            standard_rate=r.standard_rate,
            max_units=r.max_units,
            group_name=r.group_name,
            is_active=r.is_active,
            total_allocated=total,
            remaining=remaining,
            utilization_pct=util_pct,
            allocations=details,
        ))

    return summaries


class DayData(BaseModel):
    date: date
    day_label: str  # e.g. "Mon", "Tue"
    is_weekend: bool
    is_working_day: bool
    available_hours: float
    allocated_hours: float
    remaining_hours: float
    utilization_pct: float


class ResourceTimeline(BaseModel):
    resource_id: UUID
    resource_name: str
    resource_type: str
    project_name: str
    group_name: Optional[str] = None
    max_units: float
    days: list[DayData]


@router.get("/cross-project/histogram", response_model=list[ResourceTimeline])
async def cross_project_histogram(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Daily resource utilization histogram across all projects."""
    # Load all resources
    result = await db.execute(
        select(ResourcePool)
        .options(selectinload(ResourcePool.project))
        .order_by(ResourcePool.name)
    )
    all_resources = result.scalars().all()
    if not all_resources:
        return []

    # Load all allocations with workitems
    alloc_result = await db.execute(
        select(ResourceAllocation)
        .options(selectinload(ResourceAllocation.workitem))
    )
    all_allocs = alloc_result.scalars().all()

    # Determine date range from workitems if not provided
    wi_result = await db.execute(select(WorkItemExtension))
    all_wis = wi_result.scalars().all()

    if not start_date:
        dates = []
        for w in all_wis:
            if w.early_start:
                dates.append(w.early_start.date() if hasattr(w.early_start, 'date') else w.early_start)
            if isinstance(w.extra, dict) and w.extra.get("start_date"):
                try:
                    dates.append(date.fromisoformat(str(w.extra["start_date"])))
                except (ValueError, TypeError):
                    pass
        start_date = min(dates) if dates else date.today()

    if not end_date:
        dates = []
        for w in all_wis:
            if w.early_finish:
                dates.append(w.early_finish.date() if hasattr(w.early_finish, 'date') else w.early_finish)
            if isinstance(w.extra, dict) and w.extra.get("end_date"):
                try:
                    dates.append(date.fromisoformat(str(w.extra["end_date"])))
                except (ValueError, TypeError):
                    pass
        end_date = max(dates) if dates else (start_date + timedelta(days=90))

    # Cap at 180 days
    if (end_date - start_date).days > 180:
        end_date = start_date + timedelta(days=180)

    # Build workitem date lookup (use extra dates first, then CPM dates)
    wi_dates: dict[UUID, tuple[date, date]] = {}
    for w in all_wis:
        s = None
        e = None
        # Try extra JSON first (human-readable dates)
        if isinstance(w.extra, dict):
            if w.extra.get("start_date"):
                try:
                    s = date.fromisoformat(str(w.extra["start_date"]))
                except (ValueError, TypeError):
                    pass
            if w.extra.get("end_date"):
                try:
                    e = date.fromisoformat(str(w.extra["end_date"]))
                except (ValueError, TypeError):
                    pass
        # Fallback to CPM calculated dates
        if not s and w.early_start:
            s = w.early_start.date() if hasattr(w.early_start, 'date') else w.early_start
        if not e and w.early_finish:
            e = w.early_finish.date() if hasattr(w.early_finish, 'date') else w.early_finish
        if s and e:
            wi_dates[w.id] = (s, e)

    # Get work hours from projects
    proj_result = await db.execute(select(ProjectExtension))
    projects_map = {p.id: p for p in proj_result.scalars().all()}

    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # Build histogram per resource
    timelines = []
    for r in all_resources:
        project = r.project
        work_hours = project.work_hours_per_day if project else 8.0
        work_days = project.work_days_per_week if project else 5
        max_daily = work_hours * r.max_units

        # Get allocations for this resource
        res_allocs = [a for a in all_allocs if a.resource_id == r.id]

        days = []
        current = start_date
        while current <= end_date:
            weekday = current.weekday()  # 0=Mon, 6=Sun
            is_weekend = weekday >= 5
            is_working = weekday < work_days
            available = max_daily if is_working else 0.0

            # Sum allocated hours for this day
            allocated = 0.0
            for a in res_allocs:
                wi = a.workitem
                if wi and wi.id in wi_dates:
                    wi_start, wi_end = wi_dates[wi.id]
                    if wi_start <= current <= wi_end:
                        # This allocation is active on this day
                        allocated += a.units * work_hours

            remaining = max(available - allocated, 0.0)
            util_pct = (allocated / available * 100) if available > 0 else 0.0

            days.append(DayData(
                date=current,
                day_label=DAY_NAMES[weekday],
                is_weekend=is_weekend,
                is_working_day=is_working,
                available_hours=round(available, 1),
                allocated_hours=round(allocated, 1),
                remaining_hours=round(remaining, 1),
                utilization_pct=round(util_pct, 1),
            ))
            current += timedelta(days=1)

        timelines.append(ResourceTimeline(
            resource_id=r.id,
            resource_name=r.name,
            resource_type=r.resource_type,
            project_name=project.plane_project_name if project else "Unknown",
            group_name=r.group_name,
            max_units=r.max_units,
            days=days,
        ))

    return timelines


# ------------------------------------------------------------------
# Resource Pool
# ------------------------------------------------------------------

@router.get("/{project_ext_id}/pool", response_model=list[ResourceResponse])
async def list_resources(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all resources for a project."""
    result = await db.execute(
        select(ResourcePool)
        .where(ResourcePool.project_ext_id == project_ext_id)
        .order_by(ResourcePool.name)
    )
    return result.scalars().all()


@router.post("/{project_ext_id}/pool", response_model=ResourceResponse, status_code=201)
async def create_resource(
    project_ext_id: UUID, data: ResourceCreate, db: AsyncSession = Depends(get_db)
):
    """Add a resource to the project pool."""
    resource = ResourcePool(**data.model_dump())
    db.add(resource)
    await db.flush()
    await db.refresh(resource)
    return resource


@router.get("/{project_ext_id}/pool/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    project_ext_id: UUID, resource_id: UUID, db: AsyncSession = Depends(get_db)
):
    resource = await db.get(ResourcePool, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found")
    return resource


@router.patch("/{project_ext_id}/pool/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    project_ext_id: UUID,
    resource_id: UUID,
    data: ResourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    resource = await db.get(ResourcePool, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(resource, key, value)
    await db.flush()
    await db.refresh(resource)
    return resource


@router.delete("/{project_ext_id}/pool/{resource_id}", status_code=204)
async def delete_resource(
    project_ext_id: UUID, resource_id: UUID, db: AsyncSession = Depends(get_db)
):
    resource = await db.get(ResourcePool, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found")
    await db.delete(resource)


# ------------------------------------------------------------------
# Resource Allocations
# ------------------------------------------------------------------

@router.get("/{project_ext_id}/allocations", response_model=list[AllocationResponse])
async def list_allocations(
    project_ext_id: UUID,
    resource_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List resource allocations, optionally filtered by resource."""
    query = select(ResourceAllocation).join(ResourcePool).where(
        ResourcePool.project_ext_id == project_ext_id
    )
    if resource_id:
        query = query.where(ResourceAllocation.resource_id == resource_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{project_ext_id}/allocations", response_model=AllocationResponse, status_code=201)
async def create_allocation(
    project_ext_id: UUID, data: AllocationCreate, db: AsyncSession = Depends(get_db)
):
    """Allocate a resource to a work item."""
    allocation = ResourceAllocation(**data.model_dump())
    db.add(allocation)
    await db.flush()
    await db.refresh(allocation)
    return allocation


@router.patch("/{project_ext_id}/allocations/{alloc_id}", response_model=AllocationResponse)
async def update_allocation(
    project_ext_id: UUID,
    alloc_id: UUID,
    data: AllocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    allocation = await db.get(ResourceAllocation, alloc_id)
    if not allocation:
        raise HTTPException(404, "Allocation not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(allocation, key, value)
    await db.flush()
    await db.refresh(allocation)
    return allocation


@router.delete("/{project_ext_id}/allocations/{alloc_id}", status_code=204)
async def delete_allocation(
    project_ext_id: UUID, alloc_id: UUID, db: AsyncSession = Depends(get_db)
):
    allocation = await db.get(ResourceAllocation, alloc_id)
    if not allocation:
        raise HTTPException(404, "Allocation not found")
    await db.delete(allocation)
