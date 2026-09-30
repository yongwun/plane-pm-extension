"""EVM (Earned Value Management) snapshot model."""

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Float, DateTime, Date, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class EVMSnapshot(Base):
    """
    Point-in-time EVM metrics for a project.
    Calculated by the EVM engine and stored for historical tracking.
    """

    __tablename__ = "evm_snapshots"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.project_extensions.id"), nullable=False)
    baseline_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.baselines.id"), nullable=True)

    status_date = Column(Date, nullable=False)  # date of this EVM snapshot

    # Core EVM metrics
    planned_value = Column(Float, default=0.0)  # PV — budgeted cost of work scheduled
    earned_value = Column(Float, default=0.0)  # EV — budgeted cost of work performed
    actual_cost = Column(Float, default=0.0)  # AC — actual cost of work performed
    budget_at_completion = Column(Float, default=0.0)  # BAC — total budget

    # Derived indices
    schedule_variance = Column(Float, default=0.0)  # SV = EV - PV
    cost_variance = Column(Float, default=0.0)  # CV = EV - AC
    schedule_performance_index = Column(Float, default=0.0)  # SPI = EV / PV
    cost_performance_index = Column(Float, default=0.0)  # CPI = EV / AC

    # Forecasts
    estimate_at_completion = Column(Float, default=0.0)  # EAC = BAC / CPI
    estimate_to_complete = Column(Float, default=0.0)  # ETC = EAC - AC
    variance_at_completion = Column(Float, default=0.0)  # VAC = BAC - EAC
    to_complete_performance_index = Column(Float, default=0.0)  # TCPI

    # Per-task detail (serialized for drill-down)
    task_details = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectExtension", back_populates="evm_snapshots")
