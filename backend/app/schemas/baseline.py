"""Baseline schemas."""

from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class BaselineCreate(BaseModel):
    project_ext_id: UUID
    name: str
    description: Optional[str] = None


class BaselineResponse(BaseModel):
    id: UUID
    project_ext_id: UUID
    name: str
    description: Optional[str] = None
    baseline_date: datetime
    is_active: bool
    created_at: datetime
    items_count: int = 0

    model_config = {"from_attributes": True}


class BaselineItemResponse(BaseModel):
    id: UUID
    baseline_id: UUID
    workitem_ext_id: UUID
    plane_workitem_id: str
    wbs_code: Optional[str] = None
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[float] = None
    is_milestone: Optional[bool] = None
    percent_complete: Optional[float] = None
    estimated_hours: Optional[float] = None
    fixed_cost: Optional[float] = None

    model_config = {"from_attributes": True}


class BaselineCompareResponse(BaseModel):
    """Comparison between baseline and current state."""
    baseline_id: UUID
    baseline_name: str
    baseline_date: datetime
    items: list[dict]  # list of comparison dicts
