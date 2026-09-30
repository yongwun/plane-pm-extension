"""Work calendar and exception models."""

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Date, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class WorkCalendar(Base):
    """Project or resource work calendar definition."""

    __tablename__ = "work_calendars"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_ext_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.project_extensions.id"), nullable=False)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.resource_pool.id"), nullable=True)

    name = Column(String(100), nullable=False, default="默认工作日历")

    # Work week: 0=Mon, 1=Tue, ..., 6=Sun
    work_days = Column(JSON, default=lambda: [0, 1, 2, 3, 4])  # Mon–Fri

    # Work hours per day
    start_hour = Column(Integer, default=8)
    end_hour = Column(Integer, default=17)
    lunch_start = Column(Integer, default=12)
    lunch_end = Column(Integer, default=13)

    work_hours_per_day = Column(Float, default=8.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("ProjectExtension", back_populates="calendar")
    exceptions = relationship("CalendarException", back_populates="calendar", cascade="all, delete-orphan")


class CalendarException(Base):
    """Calendar exception — holidays, special work days, etc."""

    __tablename__ = "calendar_exceptions"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id = Column(UUID(as_uuid=True), ForeignKey("pm_ext.work_calendars.id"), nullable=False)

    name = Column(String(200), nullable=False)  # e.g. "春节假期"
    exception_date = Column(Date, nullable=False)
    is_working_day = Column(Boolean, default=False)  # False = holiday/non-working

    # Optional: override work hours for this day
    start_hour = Column(Integer, nullable=True)
    end_hour = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    calendar = relationship("WorkCalendar", back_populates="exceptions")
