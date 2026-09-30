"""Baseline management routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.models.baseline import Baseline, BaselineItem
from app.schemas.baseline import BaselineCreate, BaselineResponse, BaselineItemResponse

router = APIRouter()


@router.get("/{project_ext_id}/baselines", response_model=list[BaselineResponse])
async def list_baselines(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all baselines for a project."""
    result = await db.execute(
        select(Baseline)
        .where(Baseline.project_ext_id == project_ext_id)
        .order_by(Baseline.baseline_date.desc())
    )
    baselines = result.scalars().all()

    responses = []
    for b in baselines:
        count_result = await db.execute(
            select(func.count()).select_from(BaselineItem).where(BaselineItem.baseline_id == b.id)
        )
        count = count_result.scalar()
        resp = BaselineResponse.model_validate(b)
        resp.items_count = count
        responses.append(resp)

    return responses


@router.post("/{project_ext_id}/baselines", response_model=BaselineResponse, status_code=201)
async def create_baseline(
    project_ext_id: UUID, data: BaselineCreate, db: AsyncSession = Depends(get_db)
):
    """
    Create a baseline snapshot — captures current state of all work items.
    """
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    baseline = Baseline(
        project_ext_id=project_ext_id,
        name=data.name,
        description=data.description,
    )
    db.add(baseline)
    await db.flush()

    # Snapshot all workitem extensions
    result = await db.execute(
        select(WorkItemExtension).where(WorkItemExtension.project_ext_id == project_ext_id)
    )
    workitems = result.scalars().all()

    # Get dependencies for each workitem
    for w in workitems:
        from app.models.dependency import Dependency
        dep_result = await db.execute(
            select(Dependency).where(
                (Dependency.predecessor_workitem_ext_id == w.id)
                | (Dependency.successor_workitem_ext_id == w.id)
            )
        )
        deps = dep_result.scalars().all()
        dep_list = [
            {
                "predecessor": str(d.predecessor_workitem_ext_id),
                "successor": str(d.successor_workitem_ext_id),
                "type": d.dependency_type,
                "lag": d.lag_days,
            }
            for d in deps
        ]

        # Resolve task name from extra JSON
        name = w.plane_workitem_id
        if isinstance(w.extra, dict) and w.extra.get("name"):
            seq = w.extra.get("sequence_id", "")
            name = f"{seq} - {w.extra['name']}" if seq else w.extra["name"]

        item = BaselineItem(
            baseline_id=baseline.id,
            workitem_ext_id=w.id,
            plane_workitem_id=w.plane_workitem_id,
            name=name,
            wbs_code=w.wbs_code,
            start_date=w.actual_start,
            end_date=w.actual_end,
            duration_days=w.duration_days,
            is_milestone=w.is_milestone,
            percent_complete=w.percent_complete,
            fixed_cost=w.fixed_cost,
            dependencies=dep_list,
        )
        db.add(item)

    await db.flush()
    await db.refresh(baseline)

    resp = BaselineResponse.model_validate(baseline)
    resp.items_count = len(workitems)
    return resp


@router.get("/{project_ext_id}/baselines/{baseline_id}", response_model=BaselineResponse)
async def get_baseline(
    project_ext_id: UUID, baseline_id: UUID, db: AsyncSession = Depends(get_db)
):
    baseline = await db.get(Baseline, baseline_id)
    if not baseline:
        raise HTTPException(404, "Baseline not found")

    count_result = await db.execute(
        select(func.count()).select_from(BaselineItem).where(BaselineItem.baseline_id == baseline.id)
    )
    resp = BaselineResponse.model_validate(baseline)
    resp.items_count = count_result.scalar()
    return resp


@router.get("/{project_ext_id}/baselines/{baseline_id}/items", response_model=list[BaselineItemResponse])
async def list_baseline_items(
    project_ext_id: UUID, baseline_id: UUID, db: AsyncSession = Depends(get_db)
):
    """List all items in a baseline snapshot."""
    result = await db.execute(
        select(BaselineItem)
        .where(BaselineItem.baseline_id == baseline_id)
        .order_by(BaselineItem.wbs_code)
    )
    return result.scalars().all()


@router.delete("/{project_ext_id}/baselines/{baseline_id}", status_code=204)
async def delete_baseline(
    project_ext_id: UUID, baseline_id: UUID, db: AsyncSession = Depends(get_db)
):
    baseline = await db.get(Baseline, baseline_id)
    if not baseline:
        raise HTTPException(404, "Baseline not found")
    await db.delete(baseline)
