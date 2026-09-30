"""Project extension schemas."""

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class ProjectExtCreate(BaseModel):
    plane_project_id: str = Field(..., description="Plane project ID")
    plane_project_name: str = Field("", description="Plane project name")
    workspace_slug: str = Field("sharetek", description="Plane workspace slug")
    work_hours_per_day: float = Field(8.0, ge=0, le=24)
    work_days_per_week: int = Field(5, ge=1, le=7)
    start_hour: int = Field(8, ge=0, le=23)
    end_hour: int = Field(17, ge=0, le=23)
    timezone: str = "Asia/Shanghai"
    wbs_auto_numbering: bool = True
    wbs_separator: str = "."
    budget: float = 0.0
    currency: str = "CNY"


class ProjectExtUpdate(BaseModel):
    plane_project_name: Optional[str] = None
    work_hours_per_day: Optional[float] = None
    work_days_per_week: Optional[int] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    timezone: Optional[str] = None
    wbs_auto_numbering: Optional[bool] = None
    wbs_separator: Optional[str] = None
    budget: Optional[float] = None
    currency: Optional[str] = None


class ProjectExtResponse(BaseModel):
    id: UUID
    plane_project_id: str
    plane_project_name: Optional[str] = None
    workspace_slug: str
    work_hours_per_day: float
    work_days_per_week: int
    start_hour: int
    end_hour: int
    timezone: str
    wbs_auto_numbering: bool
    wbs_separator: str
    budget: float
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
