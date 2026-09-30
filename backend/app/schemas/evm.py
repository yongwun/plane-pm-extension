"""EVM schemas."""

from datetime import date
from pydantic import BaseModel


class EVMTaskDetail(BaseModel):
    workitem_id: str
    name: str
    wbs_code: str = ""
    pv: float = 0.0
    ev: float = 0.0
    ac: float = 0.0
    planned_percent: float = 0.0
    actual_percent: float = 0.0


class EVMResponse(BaseModel):
    """EVM calculation result."""
    status_date: date
    bac: float = 0.0
    pv: float = 0.0
    ev: float = 0.0
    ac: float = 0.0
    sv: float = 0.0
    cv: float = 0.0
    spi: float = 0.0
    cpi: float = 0.0
    eac: float = 0.0
    etc: float = 0.0
    vac: float = 0.0
    tcpi: float = 0.0
    task_details: list[EVMTaskDetail] = []


class EVMCalculateRequest(BaseModel):
    project_ext_id: str
    baseline_id: str | None = None
    status_date: date | None = None  # defaults to today
