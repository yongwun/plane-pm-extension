"""Project extension model — stores PM-specific project settings."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ProjectExtension(Base):
    """Extended project settings for PM features (Gantt, EVM, resources)."""

    __tablename__ = "project_extensions"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plane_project_id = Column(String(64), unique=True, nullable=False, index=True)
    plane_project_name = Column(String(255))
    workspace_slug = Column(String(100), nullable=False, default="sharetek")

    # Calendar defaults
    work_hours_per_day = Column(Float, default=8.0)
    work_days_per_week = Column(Integer, default=5)
    start_hour = Column(Integer, default=8)  # 08:00
    end_hour = Column(Integer, default=17)  # 17:00
    timezone = Column(String(50), default="Asia/Shanghai")

    # WBS auto-numbering
    wbs_auto_numbering = Column(Boolean, default=True)
    wbs_separator = Column(String(5), default=".")

    # Budget
    budget = Column(Float, default=0.0)
    currency = Column(String(10), default="CNY")

    # Metadata
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workitems = relationship("WorkItemExtension", back_populates="project", cascade="all, delete-orphan")
    resources = relationship("ResourcePool", back_populates="project", cascade="all, delete-orphan")
    baselines = relationship("Baseline", back_populates="project", cascade="all, delete-orphan")
    calendar = relationship("WorkCalendar", back_populates="project", uselist=False, cascade="all, delete-orphan")
    evm_snapshots = relationship("EVMSnapshot", back_populates="project", cascade="all, delete-orphan")
