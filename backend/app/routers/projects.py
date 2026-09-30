"""Project extension routes."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project_ext import ProjectExtension
from app.models.workitem_ext import WorkItemExtension
from app.schemas.project import ProjectExtCreate, ProjectExtUpdate, ProjectExtResponse
from app.services.plane_client import get_plane_client

router = APIRouter()


@router.get("/", response_model=list[ProjectExtResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all project extensions."""
    result = await db.execute(select(ProjectExtension).order_by(ProjectExtension.created_at))
    return result.scalars().all()


@router.post("/", response_model=ProjectExtResponse, status_code=201)
async def create_project(data: ProjectExtCreate, db: AsyncSession = Depends(get_db)):
    """Register a Plane project for PM extension features."""
    # Check if already exists
    existing = await db.execute(
        select(ProjectExtension).where(ProjectExtension.plane_project_id == data.plane_project_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Project extension already exists for this Plane project")

    project = ProjectExtension(**data.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/{project_ext_id}", response_model=ProjectExtResponse)
async def get_project(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a project extension by ID."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")
    return project


@router.get("/by-plane-id/{plane_project_id}", response_model=ProjectExtResponse)
async def get_project_by_plane_id(plane_project_id: str, db: AsyncSession = Depends(get_db)):
    """Get a project extension by Plane project ID."""
    result = await db.execute(
        select(ProjectExtension).where(ProjectExtension.plane_project_id == plane_project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project extension not found")
    return project


@router.patch("/{project_ext_id}", response_model=ProjectExtResponse)
async def update_project(
    project_ext_id: UUID, data: ProjectExtUpdate, db: AsyncSession = Depends(get_db)
):
    """Update project extension settings."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_ext_id}", status_code=204)
async def delete_project(project_ext_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a project extension and all its related data."""
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")
    await db.delete(project)


@router.post("/sync-from-plane", response_model=list[ProjectExtResponse])
async def sync_projects_from_plane(db: AsyncSession = Depends(get_db)):
    """
    Fetch all projects from Plane and auto-create extensions for new ones.
    """
    plane = get_plane_client()
    try:
        plane_projects = await plane.list_projects()
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch projects from Plane: {e}")

    existing = await db.execute(select(ProjectExtension))
    existing_map = {p.plane_project_id: p for p in existing.scalars().all()}

    created = []
    for pp in plane_projects:
        pid = str(pp.get("id", ""))
        if pid and pid not in existing_map:
            ext = ProjectExtension(
                plane_project_id=pid,
                plane_project_name=pp.get("name", ""),
            )
            db.add(ext)
            created.append(ext)

    if created:
        await db.flush()

    result = await db.execute(select(ProjectExtension).order_by(ProjectExtension.created_at))
    return result.scalars().all()


@router.post("/sync-workitems/{project_ext_id}")
async def sync_workitems_from_plane(
    project_ext_id: UUID, db: AsyncSession = Depends(get_db)
):
    """
    Fetch all work items from Plane and create/update extensions.
    """
    project = await db.get(ProjectExtension, project_ext_id)
    if not project:
        raise HTTPException(404, "Project extension not found")

    plane = get_plane_client()
    try:
        plane_items = await plane.list_all_workitems(project.plane_project_id)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch work items from Plane: {e}")

    # Get existing extensions
    existing = await db.execute(
        select(WorkItemExtension).where(
            WorkItemExtension.project_ext_id == project_ext_id
        )
    )
    existing_map = {w.plane_workitem_id: w for w in existing.scalars().all()}

    created_count = 0
    updated_count = 0
    for item in plane_items:
        wid = str(item.get("id", ""))
        if not wid:
            continue

        # Parse dates
        start_date = None
        end_date = None
        if item.get("start_date"):
            try:
                start_date = date.fromisoformat(item["start_date"])
            except (ValueError, TypeError):
                pass
        if item.get("target_date"):
            try:
                end_date = date.fromisoformat(item["target_date"])
            except (ValueError, TypeError):
                pass

        # Calculate duration
        duration = 1.0
        if start_date and end_date:
            duration = max(1.0, (end_date - start_date).days + 1)
        elif start_date:
            duration = 1.0

        is_milestone = start_date == end_date and start_date is not None

        # State info
        state_name = ""
        state_group = ""
        if isinstance(item.get("state_detail"), dict):
            state_name = item["state_detail"].get("name", "")
            state_group = item["state_detail"].get("group", "")

        # Percent complete heuristic based on state group
        percent_map = {"backlog": 0.0, "unstarted": 0.0, "started": 0.3, "completed": 1.0, "cancelled": 1.0}
        percent = percent_map.get(state_group, 0.0)

        if wid in existing_map:
            w = existing_map[wid]
            w.actual_start = start_date
            w.actual_end = end_date
            w.duration_days = duration
            w.is_milestone = is_milestone
            w.percent_complete = percent
            w.extra = {"name": item.get("name", ""), "state": state_name, "state_group": state_group,
                       "sequence_id": item.get("sequence_id"), "priority": item.get("priority")}
            updated_count += 1
        else:
            ext = WorkItemExtension(
                plane_workitem_id=wid,
                project_ext_id=project_ext_id,
                actual_start=start_date,
                actual_end=end_date,
                duration_days=duration,
                is_milestone=is_milestone,
                percent_complete=percent,
                extra={"name": item.get("name", ""), "state": state_name, "state_group": state_group,
                       "sequence_id": item.get("sequence_id"), "priority": item.get("priority")},
            )
            db.add(ext)
            created_count += 1

    await db.flush()
    return {"created": created_count, "updated": updated_count, "total": len(plane_items)}
