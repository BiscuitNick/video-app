"""Pydantic schemas for media asset API endpoints."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MediaAssetTypeEnum(str, Enum):
    """Media asset type enum."""

    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"


# Aliases for backward compatibility
MediaType = MediaAssetTypeEnum


class MediaStatus(str, Enum):
    """Media asset processing status (deprecated - kept for backward compatibility)."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SortOrder(str, Enum):
    """Sort order enum."""

    ASC = "asc"
    DESC = "desc"


class MediaSortBy(str, Enum):
    """Fields available for sorting media assets."""

    CREATED_AT = "created_at"
    FILENAME = "filename"
    FILE_SIZE = "file_size"


class BatchOperation(str, Enum):
    """Batch tag operations."""

    ADD = "add"
    REMOVE = "remove"
    SET = "set"


# ============================================================================
# Tag Schemas
# ============================================================================


class TagBase(BaseModel):
    """Base schema for Tag."""

    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly tag slug")
    color: str | None = Field(None, max_length=7, description="Hex color code (e.g., #FF5733)")
    description: str | None = Field(None, description="Optional tag description")


class TagCreate(TagBase):
    """Schema for creating a new tag."""

    pass


class TagUpdate(BaseModel):
    """Schema for updating a tag."""

    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, max_length=7)
    description: str | None = None


class TagResponse(TagBase):
    """Schema for tag response."""

    id: UUID
    usage_count: int
    owner_user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Folder Schemas
# ============================================================================


class FolderBase(BaseModel):
    """Base schema for Folder."""

    name: str = Field(..., min_length=1, max_length=255, description="Folder name")
    parent_id: UUID | None = Field(None, description="Parent folder ID for nesting")


class FolderCreate(FolderBase):
    """Schema for creating a new folder."""

    pass


class FolderUpdate(BaseModel):
    """Schema for updating a folder."""

    name: str | None = Field(None, min_length=1, max_length=255)
    parent_id: UUID | None = None


class FolderResponse(FolderBase):
    """Schema for folder response."""

    id: UUID
    path: str
    owner_user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderTreeResponse(FolderResponse):
    """Schema for folder tree response with children."""

    children: list["FolderTreeResponse"] = Field(default_factory=list)


# ============================================================================
# Media Asset Schemas
# ============================================================================


class MediaAssetBase(BaseModel):
    """Base schema for MediaAsset."""

    filename: str = Field(..., min_length=1, max_length=500, description="Current filename")
    folder_id: UUID | None = Field(None, description="Folder ID for organization")


class MediaUploadRequest(BaseModel):
    """Schema for requesting presigned upload URL."""

    filename: str = Field(..., min_length=1, max_length=500, description="Original filename")
    content_type: str = Field(..., description="MIME type (e.g., video/mp4)")
    file_size_bytes: int = Field(..., gt=0, description="File size in bytes")
    media_type: MediaAssetTypeEnum = Field(..., description="Type of media asset")
    folder_id: UUID | None = Field(None, description="Optional folder ID")

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        """Validate filename doesn't contain path separators."""
        if "/" in v or "\\" in v:
            raise ValueError("Filename cannot contain path separators")
        return v

    @field_validator("file_size_bytes")
    @classmethod
    def validate_file_size(cls, v: int, info) -> int:
        """Validate file size based on media type."""
        # These limits should match config, but providing defaults
        MAX_SIZES = {
            MediaAssetTypeEnum.IMAGE: 100 * 1024 * 1024,  # 100 MB
            MediaAssetTypeEnum.VIDEO: 1000 * 1024 * 1024,  # 1000 MB
            MediaAssetTypeEnum.AUDIO: 500 * 1024 * 1024,  # 500 MB
            MediaAssetTypeEnum.TEXT: 10 * 1024 * 1024,  # 10 MB
        }

        media_type = info.data.get("media_type")
        if media_type and v > MAX_SIZES.get(media_type, 100 * 1024 * 1024):
            raise ValueError(
                f"File size exceeds maximum for {media_type}: {MAX_SIZES.get(media_type)} bytes"
            )
        return v


class MediaUploadResponse(BaseModel):
    """Schema for presigned upload URL response."""

    media_asset_id: UUID
    upload_url: str
    s3_key: str
    expires_at: datetime
    upload_fields: dict[str, Any] | None = Field(
        None, description="Additional fields for multipart upload"
    )


class MediaAssetUpdate(BaseModel):
    """Schema for updating media asset metadata."""

    filename: str | None = Field(None, min_length=1, max_length=500)
    tags: list[str] | None = Field(None, description="List of tag names")
    folder_id: UUID | None = None


class MediaAssetResponse(MediaAssetBase):
    """Schema for media asset response."""

    id: UUID
    owner_user_id: str
    type: MediaAssetTypeEnum
    url: str | None = Field(None, description="Presigned URL for accessing the asset")
    thumbnail_url: str | None = Field(None, description="Presigned URL for thumbnail")
    original_filename: str
    file_size_bytes: int | None
    mime_type: str | None

    # Media-specific metadata
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    frame_rate: float | None = None
    codec: str | None = None

    # Organization
    tags: list[TagResponse] = Field(default_factory=list)
    folder_id: UUID | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaAssetListResponse(BaseModel):
    """Schema for paginated media asset list response."""

    media_assets: list[MediaAssetResponse]
    total: int = Field(..., description="Total number of media assets matching filters")
    offset: int = Field(..., description="Pagination offset")
    limit: int = Field(..., description="Pagination limit")


# ============================================================================
# Batch Operation Schemas
# ============================================================================


class BatchDeleteRequest(BaseModel):
    """Schema for batch delete request."""

    media_asset_ids: list[UUID] = Field(..., min_length=1, description="List of media asset IDs")


class BatchDeleteResponse(BaseModel):
    """Schema for batch delete response."""

    deleted_count: int
    deleted_ids: list[UUID]


class BatchTagRequest(BaseModel):
    """Schema for batch tag operation request."""

    media_asset_ids: list[UUID] = Field(..., min_length=1, description="List of media asset IDs")
    operation: BatchOperation = Field(..., description="Tag operation: add, remove, or set")
    tags: list[str] = Field(..., min_length=1, description="List of tag names")


class BatchTagResponse(BaseModel):
    """Schema for batch tag operation response."""

    updated_count: int
    updated_ids: list[UUID]


class BatchMoveRequest(BaseModel):
    """Schema for batch move request."""

    media_asset_ids: list[UUID] = Field(..., min_length=1, description="List of media asset IDs")
    folder_id: UUID | None = Field(..., description="Target folder ID (null for root)")


class BatchMoveResponse(BaseModel):
    """Schema for batch move response."""

    moved_count: int
    moved_ids: list[UUID]


# ============================================================================
# Folder Content Response
# ============================================================================


class FolderContentsResponse(BaseModel):
    """Schema for folder contents response."""

    folder: FolderResponse
    subfolders: list[FolderResponse]
    media_assets: list[MediaAssetResponse]
    total_assets: int
    total_subfolders: int
