"""Work item extension — PM-specific fields for Plane work items."""

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, ForeignKey, Date, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class WorkItemExtension(Base):
    """Extended work item data for Gantt, CPM, and EVM calculations."""

    __tablename__ = "workitem_extensions"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plane_workitem_id = Column(String(64), unique=True, nullable=False, index=True)
    project_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.project_extensions.id"), nullable=False)

    # WBS
    wbs_code = Column(String(50), index=True)  # e.g. "1.2.3"
    outline_level = Column(Integer, default=0)

    # Schedule
    duration_days = Column(Float, default=1.0)
    is_milestone = Column(Boolean, default=False)
    constraint_type = Column(
        String(20), default="ASAP"
    )  # ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO
    constraint_date = Column(Date, nullable=True)

    # Progress
    percent_complete = Column(Float, default=0.0)  # 0.0 – 1.0
    actual_start = Column(Date, nullable=True)
    actual_end = Column(Date, nullable=True)
    remaining_duration = Column(Float, nullable=True)

    # CPM calculated fields (read-only, populated by CPM engine)
    early_start = Column(DateTime, nullable=True)
    early_finish = Column(DateTime, nullable=True)
    late_start = Column(DateTime, nullable=True)
    late_finish = Column(DateTime, nullable=True)
    total_float = Column(Float, nullable=True)
    free_float = Column(Float, nullable=True)
    is_critical = Column(Boolean, default=False)

    # Cost
    fixed_cost = Column(Float, default=0.0)

    # Metadata
    notes = Column(Text, nullable=True)
    extra = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("ProjectExtension", back_populates="workitems")
    dependencies_as_predecessor = relationship(
        "Dependency",
        foreign_keys="Dependency.predecessor_workitem_ext_id",
        back_populates="predecessor",
    )
    dependencies_as_successor = relationship(
        "Dependency",
        foreign_keys="Dependency.successor_workitem_ext_id",
        back_populates="successor",
    )
    resource_allocations = relationship("ResourceAllocation", back_populates="workitem", cascade="all, delete-orphan")
    baseline_items = relationship("BaselineItem", back_populates="workitem", cascade="all, delete-orphan")
