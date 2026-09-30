"""EVM (Earned Value Management) routes."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.models.baseline import Baseline, BaselineItem
from app.models.evm import EVMSnapshot
from app.schemas.evm import EVMResponse, EVMTaskDetail, EVMCalculateRequest
from app.services.evm_engine import EVMEngine, TaskEVMDetail

router = APIRouter()


@router.post("/calculate", response_model=EVMResponse)
async def calculate_evm(
    data: EVMCalculateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Calculate EVM metrics for a project.
    Compares current state against a baseline.
    """
    project_ext_id = UUID(data.project_ext_id)
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    status_date = data.status_date or date.today()

    # Get baseline
    baseline = None
    if data.baseline_id:
        baseline = await db.get(Baseline, UUID(data.baseline_id))
    else:
        # Use active baseline
        result = await db.execute(
            select(Baseline).where(
                Baseline.project_ext_id == project_ext_id,
                Baseline.is_active == True,
            ).order_by(Baseline.baseline_date.desc()).limit(1)
        )
        baseline = result.scalar_one_or_none()

    if not baseline:
        raise HTTPException(400, "No baseline found. Create a baseline first.")

    # Get baseline items
    items_result = await db.execute(
        select(BaselineItem).where(BaselineItem.baseline_id == baseline.id)
    )
    baseline_items = items_result.scalars().all()

    # Get current workitem extensions
    current_result = await db.execute(
        select(WorkItemExtension).where(
            WorkItemExtension.project_ext_id == project_ext_id
        )
    )
    current_map = {w.plane_workitem_id: w for w in current_result.scalars().all()}

    # Build EVM task details
    evm_tasks = []
    for bi in baseline_items:
        current = current_map.get(bi.plane_workitem_id)
        task_detail = TaskEVMDetail(
            workitem_id=bi.plane_workitem_id,
            name=bi.name or bi.plane_workitem_id,
            wbs_code=bi.wbs_code or "",
            planned_cost=bi.fixed_cost or 0.0,
            baseline_start=bi.start_date,
            baseline_end=bi.end_date,
            actual_percent=current.percent_complete if current else 0.0,
            actual_cost=0.0,  # TODO: calculate from worklogs + resource rates
        )
        if current:
            task_detail.actual_start = current.actual_start
            task_detail.actual_end = current.actual_end
        evm_tasks.append(task_detail)

    # Run EVM calculation
    engine = EVMEngine(status_date=status_date, bac=project.budget)
    result = engine.calculate(evm_tasks)

    # Save snapshot
    snapshot = EVMSnapshot(
        project_ext_id=project_ext_id,
        baseline_id=baseline.id,
        status_date=status_date,
        planned_value=result.pv,
        earned_value=result.ev,
        actual_cost=result.ac,
        budget_at_completion=result.bac,
        schedule_variance=result.sv,
        cost_variance=result.cv,
        schedule_performance_index=result.spi,
        cost_performance_index=result.cpi,
        estimate_at_completion=result.eac,
        estimate_to_complete=result.etc,
        variance_at_completion=result.vac,
        to_complete_performance_index=result.tcpi,
        task_details=[
            {
                "workitem_id": t.workitem_id,
                "name": t.name,
                "wbs_code": t.wbs_code,
                "pv": round(t.pv, 2),
                "ev": round(t.ev, 2),
                "ac": round(t.ac, 2),
                "planned_percent": t.planned_percent,
                "actual_percent": t.actual_percent,
            }
            for t in result.task_details
        ],
    )
    db.add(snapshot)

    return EVMResponse(**result.to_dict())


@router.get("/{project_ext_id}/history", response_model=list[EVMResponse])
async def get_evm_history(
    project_ext_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Get historical EVM snapshots for trend analysis."""
    result = await db.execute(
        select(EVMSnapshot)
        .where(EVMSnapshot.project_ext_id == project_ext_id)
        .order_by(EVMSnapshot.status_date)
    )
    snapshots = result.scalars().all()

    return [
        EVMResponse(
            status_date=s.status_date,
            bac=s.budget_at_completion,
            pv=s.planned_value,
            ev=s.earned_value,
            ac=s.actual_cost,
            sv=s.schedule_variance,
            cv=s.cost_variance,
            spi=s.schedule_performance_index,
            cpi=s.cost_performance_index,
            eac=s.estimate_at_completion,
            etc=s.estimate_to_complete,
            vac=s.variance_at_completion,
            tcpi=s.to_complete_performance_index,
        )
        for s in snapshots
    ]
