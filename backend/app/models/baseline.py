"""Baseline snapshot models — save project state for comparison."""

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Date, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Baseline(Base):
    """A point-in-time snapshot of a project's planned state."""

    __tablename__ = "baselines"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.project_extensions.id"), nullable=False)

    name = Column(String(200), nullable=False)  # e.g. "Baseline 1 - Initial Plan"
    description = Column(Text, nullable=True)
    baseline_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)  # active baseline for EVM comparison

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectExtension", back_populates="baselines")
    items = relationship("BaselineItem", back_populates="baseline", cascade="all, delete-orphan")


class BaselineItem(Base):
    """Snapshot of a single work item at baseline time."""

    __tablename__ = "baseline_items"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    baseline_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.baselines.id"), nullable=False)
    workitem_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.workitem_extensions.id"), nullable=False)

    # Plane reference (denormalized for fast lookup)
    plane_workitem_id = Column(String(64), nullable=False)

    # Snapshot fields
    wbs_code = Column(String(50))
    name = Column(String(500))
    start_date = Column(Date)
    end_date = Column(Date)
    duration_days = Column(Float)
    is_milestone = Column(Boolean)
    percent_complete = Column(Float)
    estimated_hours = Column(Float)
    fixed_cost = Column(Float, default=0.0)

    # Dependency snapshot (serialized as JSON for simplicity)
    dependencies = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    baseline = relationship("Baseline", back_populates="items")
    workitem = relationship("WorkItemExtension", back_populates="baseline_items")
