"""Resource pool and allocation models."""

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Date, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ResourcePool(Base):
    """Resource definition — human, equipment, or material."""

    __tablename__ = "resource_pool"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.project_extensions.id"), nullable=False)

    name = Column(String(100), nullable=False)
    resource_type = Column(String(20), nullable=False, default="human")  # human, equipment, material, cost
    email = Column(String(255), nullable=True)  # for human resources, link to Plane user
    plane_user_id = Column(String(64), nullable=True)  # Plane user ID mapping

    # Rates
    standard_rate = Column(Float, default=0.0)  # per hour
    overtime_rate = Column(Float, default=0.0)  # per hour
    cost_per_use = Column(Float, default=0.0)  # per assignment

    # Availability
    max_units = Column(Float, default=1.0)  # 1.0 = 100% availability
    is_active = Column(Boolean, default=True)

    # Category / RBS (Resource Breakdown Structure)
    group_name = Column(String(100), nullable=True)  # e.g. "机械工程", "软件开发"
    code = Column(String(50), nullable=True)  # RBS code e.g. "1.2.3"

    notes = Column(Text, nullable=True)
    extra = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("ProjectExtension", back_populates="resources")
    allocations = relationship("ResourceAllocation", back_populates="resource", cascade="all, delete-orphan")


class ResourceAllocation(Base):
    """Resource ↔ Task assignment with units and time bounds."""

    __tablename__ = "resource_allocations"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.resource_pool.id"), nullable=False)
    workitem_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.workitem_extensions.id"), nullable=False)

    units = Column(Float, default=1.0)  # 0.5 = 50% allocation
    work_hours = Column(Float, nullable=True)  # planned work hours
    actual_work_hours = Column(Float, default=0.0)

    # Time bounds (may differ from task dates)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    resource = relationship("ResourcePool", back_populates="allocations")
    workitem = relationship("WorkItemExtension", back_populates="resource_allocations")
