"""Pydantic schemas for folder API endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FolderCreateRequest(BaseModel):
    """Request schema for creating a new folder."""

    name: str = Field(..., min_length=1, max_length=255, description="Folder name")
    parent_id: UUID | None = Field(
        default=None, description="Parent folder ID (null for root-level folder)"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        """Validate folder name doesn't contain invalid characters."""
        # Disallow path separators and other problematic characters
        invalid_chars = ["/", "\\", "\0"]
        for char in invalid_chars:
            if char in name:
                raise ValueError(f"Folder name cannot contain '{char}'")

        # Strip leading/trailing whitespace
        name = name.strip()
        if not name:
            raise ValueError("Folder name cannot be empty or only whitespace")

        return name


class FolderUpdateRequest(BaseModel):
    """Request schema for updating a folder (rename or move)."""

    name: str | None = Field(
        default=None, min_length=1, max_length=255, description="New folder name"
    )
    parent_id: UUID | None = Field(
        default=None,
        description="New parent folder ID (null to move to root, omit to keep current parent)",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str | None) -> str | None:
        """Validate folder name if provided."""
        if name is None:
            return name

        # Disallow path separators and other problematic characters
        invalid_chars = ["/", "\\", "\0"]
        for char in invalid_chars:
            if char in name:
                raise ValueError(f"Folder name cannot contain '{char}'")

        # Strip leading/trailing whitespace
        name = name.strip()
        if not name:
            raise ValueError("Folder name cannot be empty or only whitespace")

        return name


class BreadcrumbItem(BaseModel):
    """Single item in breadcrumb trail."""

    name: str = Field(..., description="Folder name at this level")
    path: str = Field(..., description="Full path to this level")


class FolderResponse(BaseModel):
    """Response schema for a single folder."""

    id: UUID = Field(..., description="Folder unique identifier")
    name: str = Field(..., description="Folder name")
    parent_id: UUID | None = Field(..., description="Parent folder ID (null for root)")
    path: str = Field(..., description="Full materialized path")
    owner_user_id: str = Field(..., description="Owner user ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    breadcrumbs: list[BreadcrumbItem] = Field(
        default_factory=list, description="Breadcrumb trail from root to this folder"
    )

    model_config = {"from_attributes": True}


class FolderTreeNode(BaseModel):
    """Recursive tree node for folder hierarchy."""

    id: UUID = Field(..., description="Folder unique identifier")
    name: str = Field(..., description="Folder name")
    parent_id: UUID | None = Field(..., description="Parent folder ID")
    path: str = Field(..., description="Full materialized path")
    created_at: datetime = Field(..., description="Creation timestamp")
    children: list["FolderTreeNode"] = Field(
        default_factory=list, description="Child folders (recursive)"
    )

    model_config = {"from_attributes": True}


class FolderListResponse(BaseModel):
    """Response schema for listing folders in tree structure."""

    folders: list[FolderTreeNode] = Field(..., description="Root-level folders with nested children")
    total: int = Field(..., description="Total number of folders")


class FolderContentsResponse(BaseModel):
    """Response schema for folder contents (subfolders + media assets)."""

    folder: FolderResponse = Field(..., description="Current folder information")
    subfolders: list[FolderResponse] = Field(
        default_factory=list, description="Direct child folders"
    )
    # Note: media_assets will be added when MediaAsset model is implemented
    # media_assets: list[MediaAssetResponse] = Field(default_factory=list)
    total_subfolders: int = Field(..., description="Total number of subfolders")
    # total_media_assets: int = Field(..., description="Total number of media assets")
    offset: int = Field(default=0, description="Pagination offset")
    limit: int = Field(default=50, description="Pagination limit")


class FolderDeleteResponse(BaseModel):
    """Response schema for folder deletion."""

    success: bool = Field(..., description="Whether deletion was successful")
    folder_id: UUID = Field(..., description="ID of deleted folder")
    message: str = Field(..., description="Success message")
