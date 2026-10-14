"""Import/Export Pydantic schemas — preview, commit, and audit."""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ImportFormat(str, Enum):
    MSPROJECT_XML = "msproject_xml"
    CSV = "csv"


class ExportFormat(str, Enum):
    MSPROJECT_XML = "msproject_xml"
    CSV = "csv"


class ImportAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    SKIP = "skip"
    CONFLICT = "conflict"


class ConflictStrategy(str, Enum):
    SKIP = "skip"
    OVERWRITE = "overwrite"
    MERGE = "merge"


# ---------------------------------------------------------------------------
# Task Preview — one row per imported task
# ---------------------------------------------------------------------------

class TaskFieldMapping(BaseModel):
    """Maps a source field to a system field with the resolved value."""
    source_field: str
    target_field: str
    source_value: str = ""
    resolved_value: str = ""


class TaskPreview(BaseModel):
    """Preview of a single task after parsing and validation."""
    source_id: str = Field("", description="Original ID in the source file")
    name: str
    wbs_code: str = ""
    outline_level: int = 0
    parent_source_id: Optional[str] = None

    # Schedule
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: float = 1.0
    is_milestone: bool = False

    # Progress
    percent_complete: float = 0.0
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None

    # Constraint
    constraint_type: str = "ASAP"
    constraint_date: Optional[date] = None

    # Cost
    fixed_cost: float = 0.0

    # Notes
    notes: Optional[str] = None

    # Dependencies: list of (predecessor_source_id, type, lag)
    dependencies: list[tuple[str, str, float]] = Field(default_factory=list)

    # Resources assigned to this task
    assigned_resources: list[str] = Field(default_factory=list)

    # Validation result
    action: ImportAction = ImportAction.CREATE
    issues: list[str] = Field(default_factory=list)
    field_mappings: list[TaskFieldMapping] = Field(default_factory=list)

    # Existing workitem ID if matched
    existing_workitem_ext_id: Optional[str] = None


class ResourcePreview(BaseModel):
    """Preview of a resource from the import file."""
    source_id: str = ""
    name: str
    resource_type: str = "human"
    standard_rate: float = 0.0
    overtime_rate: float = 0.0
    cost_per_use: float = 0.0
    max_units: float = 1.0
    group_name: Optional[str] = None
    email: Optional[str] = None
    action: ImportAction = ImportAction.CREATE
    issues: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Import Preview Response
# ---------------------------------------------------------------------------

class ImportPreview(BaseModel):
    """Full preview result returned to the user before commit."""
    preview_token: str
    format: ImportFormat
    filename: str

    # Summary counts
    total_tasks: int = 0
    valid_tasks: int = 0
    skipped_tasks: int = 0
    conflict_tasks: int = 0

    total_resources: int = 0
    valid_resources: int = 0

    # Warnings and errors
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    # Detailed previews
    tasks: list[TaskPreview] = Field(default_factory=list)
    resources: list[ResourcePreview] = Field(default_factory=list)

    # Project-level info
    project_name: str = ""
    project_start_date: Optional[date] = None
    project_calendar: dict = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Import Commit Request
# ---------------------------------------------------------------------------

class ImportCommitRequest(BaseModel):
    """User confirms the import with optional conflict strategy."""
    preview_token: str
    project_ext_id: str
    conflict_strategy: ConflictStrategy = ConflictStrategy.SKIP
    create_baseline_before_import: bool = True


class ImportCommitResponse(BaseModel):
    """Result of a committed import."""
    success: bool
    tasks_created: int = 0
    tasks_updated: int = 0
    tasks_skipped: int = 0
    resources_created: int = 0
    dependencies_created: int = 0
    pre_import_baseline_id: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Import/Export Audit Log
# ---------------------------------------------------------------------------

class ImportExportLogResponse(BaseModel):
    """Audit log entry for import/export operations."""
    id: str
    project_ext_id: str
    action: str  # "import" | "export"
    format: str
    filename: str
    status: str  # "preview" | "committed" | "rolled_back" | "exported"
    task_count: int = 0
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    created_at: datetime
