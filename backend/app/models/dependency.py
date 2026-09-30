"""Task dependency model — FS/SS/FF/SF with lag/lead."""

from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Dependency(Base):
    """
    Task dependency with four types (like MS Project / ProjectLibre):
      - FS (Finish-to-Start): predecessor finishes → successor starts
      - SS (Start-to-Start):  predecessor starts  → successor starts
      - FF (Finish-to-Finish): predecessor finishes → successor finishes
      - SF (Start-to-Finish): predecessor starts  → successor finishes

    lag_days > 0 = lag (delay), lag_days < 0 = lead (overlap)
    """

    __tablename__ = "dependencies"
    __table_args__ = {"schema": "pm_ext"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=__import__('uuid').uuid4)
    predecessor_workitem_ext_id = Column(
        UUID(as_uuid=True), ForeignKey("pm_ext.workitem_extensions.id"), nullable=False
    )
    successor_workitem_ext_id = Column(
        UUID(as_uuid=True), ForeignKey("pm_ext.workitem_extensions.id"), nullable=False
    )
    dependency_type = Column(String(2), nullable=False, default="FS")
    lag_days = Column(Float, default=0.0)
    created_at = Column(DateTime, default=__import__('datetime').datetime.utcnow)

    # Relationships
    predecessor = relationship(
        "WorkItemExtension",
        foreign_keys=[predecessor_workitem_ext_id],
        back_populates="dependencies_as_predecessor",
    )
    successor = relationship(
        "WorkItemExtension",
        foreign_keys=[successor_workitem_ext_id],
        back_populates="dependencies_as_successor",
    )
