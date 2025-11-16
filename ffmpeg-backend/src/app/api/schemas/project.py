"""Pydantic schemas for project API endpoints."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ProjectStatusEnum(str, Enum):
    """Project status enumeration."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class SharePermissionEnum(str, Enum):
    """Share permission enumeration."""

    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


class SortBy(str, Enum):
    """Sort options for project listing."""

    NAME = "name"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"


class SortOrder(str, Enum):
    """Sort order."""

    ASC = "asc"
    DESC = "desc"


# Request schemas


class ProjectCreateRequest(BaseModel):
    """Request model for creating a new project."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: str | None = Field(
        default=None, max_length=2000, description="Optional project description"
    )
    project_data: dict[str, Any] = Field(
        default_factory=dict, description="Project timeline and configuration data"
    )
    thumbnail_url: str | None = Field(default=None, max_length=1024, description="Project thumbnail URL")
    folder_id: UUID | None = Field(default=None, description="Optional folder for organization")


class ProjectUpdateRequest(BaseModel):
    """Request model for updating a project with optimistic locking."""

    name: str | None = Field(None, min_length=1, max_length=255, description="Project name")
    description: str | None = Field(None, max_length=2000, description="Project description")
    project_data: dict[str, Any] | None = Field(None, description="Project timeline and configuration data")
    thumbnail_url: str | None = Field(None, max_length=1024, description="Project thumbnail URL")
    folder_id: UUID | None = Field(None, description="Folder ID for organization")
    version: int = Field(..., ge=1, description="Current version for optimistic locking")
    change_summary: str | None = Field(
        None, max_length=500, description="Summary of changes in this update"
    )


class ProjectShareRequest(BaseModel):
    """Request model for sharing a project."""

    shared_with_user_id: str = Field(..., min_length=1, max_length=255, description="User ID to share with")
    permission: SharePermissionEnum = Field(..., description="Permission level to grant")


class ProjectShareUpdateRequest(BaseModel):
    """Request model for updating share permissions."""

    permission: SharePermissionEnum = Field(..., description="New permission level")


# Response schemas


class ProjectShareResponse(BaseModel):
    """Response model for project share."""

    id: UUID = Field(..., description="Share ID")
    project_id: UUID = Field(..., description="Project ID")
    shared_with_user_id: str = Field(..., description="User ID with access")
    permission: str = Field(..., description="Permission level")
    shared_by: str = Field(..., description="User who created the share")
    created_at: datetime = Field(..., description="When share was created")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectResponse(BaseModel):
    """Response model for project resource."""

    id: UUID = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")
    description: str | None = Field(None, description="Project description")
    thumbnail_url: str | None = Field(None, description="Project thumbnail URL")
    owner_id: str = Field(..., description="Project owner ID")
    folder_id: UUID | None = Field(None, description="Folder ID if organized")
    version: int = Field(..., description="Current version number")
    status: str = Field(..., description="Project status")
    created_at: datetime = Field(..., description="When project was created")
    updated_at: datetime = Field(..., description="When project was last updated")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectDetailResponse(BaseModel):
    """Response model for detailed project information including data."""

    id: UUID = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")
    description: str | None = Field(None, description="Project description")
    thumbnail_url: str | None = Field(None, description="Project thumbnail URL")
    project_data: dict[str, Any] = Field(..., description="Complete project data")
    owner_id: str = Field(..., description="Project owner ID")
    folder_id: UUID | None = Field(None, description="Folder ID if organized")
    version: int = Field(..., description="Current version number")
    status: str = Field(..., description="Project status")
    shares: list[ProjectShareResponse] = Field(default_factory=list, description="Project shares")
    created_at: datetime = Field(..., description="When project was created")
    updated_at: datetime = Field(..., description="When project was last updated")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectListResponse(BaseModel):
    """Response model for project list endpoint with pagination."""

    projects: list[ProjectResponse] = Field(..., description="List of projects in current page")
    total: int = Field(..., ge=0, description="Total number of projects matching filters")
    offset: int = Field(..., ge=0, description="Pagination offset")
    limit: int = Field(..., ge=1, description="Pagination limit")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectVersionResponse(BaseModel):
    """Response model for project version."""

    id: UUID = Field(..., description="Version ID")
    project_id: UUID = Field(..., description="Project ID")
    version_number: int = Field(..., description="Version number")
    change_summary: str | None = Field(None, description="Summary of changes")
    is_auto_save: bool = Field(..., description="Whether this was an auto-save")
    created_by: str = Field(..., description="User who created this version")
    created_at: datetime = Field(..., description="When version was created")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectVersionDetailResponse(BaseModel):
    """Response model for detailed version information including snapshot."""

    id: UUID = Field(..., description="Version ID")
    project_id: UUID = Field(..., description="Project ID")
    version_number: int = Field(..., description="Version number")
    project_data_snapshot: dict[str, Any] = Field(..., description="Complete project state at this version")
    change_summary: str | None = Field(None, description="Summary of changes")
    is_auto_save: bool = Field(..., description="Whether this was an auto-save")
    created_by: str = Field(..., description="User who created this version")
    vector_clock: dict[str, int] = Field(..., description="Vector clock for conflict detection")
    created_at: datetime = Field(..., description="When version was created")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ProjectVersionListResponse(BaseModel):
    """Response model for version history list."""

    versions: list[ProjectVersionResponse] = Field(..., description="List of versions")
    total: int = Field(..., ge=0, description="Total number of versions")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class VersionDiffResponse(BaseModel):
    """Response model for version diff comparison."""

    from_version: int = Field(..., description="Starting version number")
    to_version: int = Field(..., description="Ending version number")
    changes: list[dict[str, Any]] = Field(..., description="List of changes between versions")
    summary: str = Field(..., description="Human-readable summary of changes")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ConflictDetectionResponse(BaseModel):
    """Response model for conflict detection."""

    has_conflict: bool = Field(..., description="Whether a conflict was detected")
    base_version: int | None = Field(None, description="Base version number")
    server_version: int | None = Field(None, description="Current server version")
    client_version: int | None = Field(None, description="Client version")
    conflicts: list[dict[str, Any]] = Field(
        default_factory=list, description="List of conflicting changes"
    )
    message: str = Field(..., description="Conflict resolution message")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class ConflictResolutionRequest(BaseModel):
    """Request model for manual conflict resolution."""

    base_version: int = Field(..., ge=1, description="Base version to merge from")
    resolved_data: dict[str, Any] = Field(..., description="Manually resolved project data")
    resolution_strategy: str = Field(
        default="manual",
        description="Resolution strategy used (manual, theirs, ours, auto-merge)",
    )


class ProjectDuplicateRequest(BaseModel):
    """Request model for duplicating a project."""

    new_name: str = Field(..., min_length=1, max_length=255, description="Name for the duplicated project")
    include_version_history: bool = Field(
        default=False, description="Whether to copy version history"
    )


class BulkOperationRequest(BaseModel):
    """Request model for bulk operations on projects."""

    project_ids: list[UUID] = Field(..., min_items=1, max_items=100, description="Project IDs to operate on")
    operation: str = Field(..., description="Operation to perform (archive, delete, duplicate)")
    target_folder_id: UUID | None = Field(None, description="Target folder for move operation")

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, operation: str) -> str:
        """Validate operation is one of the allowed values."""
        allowed = ["archive", "delete", "duplicate", "move"]
        if operation not in allowed:
            raise ValueError(f"Operation must be one of: {', '.join(allowed)}")
        return operation


class BulkOperationResponse(BaseModel):
    """Response model for bulk operations."""

    successful_count: int = Field(..., ge=0, description="Number of successful operations")
    failed_count: int = Field(..., ge=0, description="Number of failed operations")
    successful_ids: list[UUID] = Field(default_factory=list, description="IDs of successful operations")
    failed_ids: list[UUID] = Field(default_factory=list, description="IDs of failed operations")
    errors: dict[str, str] = Field(
        default_factory=dict, description="Map of project ID to error message"
    )
    message: str = Field(..., description="Summary message")

    class Config:
        """Pydantic configuration."""

        from_attributes = True
