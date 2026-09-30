"""Resource management schemas."""

from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class ResourceCreate(BaseModel):
    project_ext_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    resource_type: str = Field("human", pattern="^(human|equipment|material|cost)$")
    email: Optional[str] = None
    plane_user_id: Optional[str] = None
    standard_rate: float = Field(0.0, ge=0)
    overtime_rate: float = Field(0.0, ge=0)
    cost_per_use: float = Field(0.0, ge=0)
    max_units: float = Field(1.0, ge=0, le=1)
    group_name: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    resource_type: Optional[str] = None
    email: Optional[str] = None
    plane_user_id: Optional[str] = None
    standard_rate: Optional[float] = None
    overtime_rate: Optional[float] = None
    cost_per_use: Optional[float] = None
    max_units: Optional[float] = None
    group_name: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: UUID
    project_ext_id: UUID
    name: str
    resource_type: str
    email: Optional[str] = None
    plane_user_id: Optional[str] = None
    standard_rate: float
    overtime_rate: float
    cost_per_use: float
    max_units: float
    is_active: bool
    group_name: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AllocationCreate(BaseModel):
    resource_id: UUID
    workitem_ext_id: UUID
    units: float = Field(1.0, ge=0, le=1)
    work_hours: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class AllocationUpdate(BaseModel):
    units: Optional[float] = None
    work_hours: Optional[float] = None
    actual_work_hours: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class AllocationResponse(BaseModel):
    id: UUID
    resource_id: UUID
    workitem_ext_id: UUID
    units: float
    work_hours: Optional[float] = None
    actual_work_hours: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResourceHistogram(BaseModel):
    """Resource load histogram data for a date range."""
    resource_id: UUID
    resource_name: str
    dates: list[date]
    allocated_hours: list[float]
    available_hours: list[float]
    utilization_percent: list[float]
