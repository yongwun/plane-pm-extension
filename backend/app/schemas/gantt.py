"""Gantt / CPM / WBS schemas."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class GanttTask(BaseModel):
    """A task for Gantt chart display."""
    id: str  # workitem_ext_id
    plane_workitem_id: str
    name: str
    wbs_code: str = ""
    outline_level: int = 0
    parent_id: Optional[str] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: float = 0

    is_milestone: bool = False
    is_critical: bool = False
    percent_complete: float = 0.0

    # CPM calculated
    early_start: Optional[datetime] = None
    early_finish: Optional[datetime] = None
    late_start: Optional[datetime] = None
    late_finish: Optional[datetime] = None
    total_float: Optional[float] = None
    free_float: Optional[float] = None

    # Cost
    fixed_cost: float = 0.0

    # Plane state
    state_name: str = ""
    state_group: str = ""

    model_config = {"from_attributes": True}


class GanttDependency(BaseModel):
    """A dependency link for Gantt chart."""
    id: str
    source: str  # predecessor workitem_ext_id
    target: str  # successor workitem_ext_id
    type: str = "FS"  # FS, SS, FF, SF
    lag: float = 0.0


class GanttData(BaseModel):
    """Complete Gantt chart data for a project."""
    project_id: str
    project_name: str
    tasks: list[GanttTask]
    dependencies: list[GanttDependency]
    critical_path: list[str] = []
    summary: dict = {}


class CPMResult(BaseModel):
    """CPM calculation result."""
    project_id: str
    project_start: str
    project_end: str
    total_duration_days: float
    total_tasks: int
    critical_tasks: int
    critical_path: list[str]
    tasks: list[GanttTask]


class DependencyCreate(BaseModel):
    """Create a new dependency."""
    predecessor_workitem_id: str = Field(..., description="Predecessor plane workitem ID")
    successor_workitem_id: str = Field(..., description="Successor plane workitem ID")
    dependency_type: str = Field("FS", pattern="^(FS|SS|FF|SF)$")
    lag_days: float = Field(0.0, description="Positive=lag, negative=lead")


class DependencyUpdate(BaseModel):
    """Update a dependency."""
    dependency_type: Optional[str] = Field(None, pattern="^(FS|SS|FF|SF)$")
    lag_days: Optional[float] = None


class WBSResponse(BaseModel):
    """WBS tree response."""
    project_id: str
    tree: list[dict]  # WBSNode.to_dict() list
    flat: list[dict] = []  # flattened for table view
