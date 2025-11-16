"""Pydantic schemas for tag API endpoints."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TagOperationMode(str, Enum):
    """Bulk tag operation modes."""

    ADD = "add"
    REMOVE = "remove"
    REPLACE = "replace"


class TagCreateRequest(BaseModel):
    """Request model for creating a new tag."""

    name: str = Field(..., description="Tag name", min_length=1, max_length=100)
    color: str | None = Field(
        default=None,
        description="Optional hex color code for UI display",
        pattern="^#[0-9A-Fa-f]{6}$",
    )
    description: str | None = Field(
        default=None, description="Optional tag description", max_length=500
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate tag name is not empty after stripping."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("Tag name cannot be empty or only whitespace")
        return stripped


class TagUpdateRequest(BaseModel):
    """Request model for updating a tag."""

    name: str | None = Field(default=None, description="Updated tag name", max_length=100)
    color: str | None = Field(
        default=None,
        description="Updated hex color code",
        pattern="^#[0-9A-Fa-f]{6}$",
    )
    description: str | None = Field(default=None, description="Updated description", max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        """Validate tag name if provided."""
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Tag name cannot be empty or only whitespace")
            return stripped
        return v


class TagResponse(BaseModel):
    """Response model for a single tag."""

    id: UUID = Field(..., description="Tag UUID")
    name: str = Field(..., description="Tag display name")
    slug: str = Field(..., description="URL-friendly unique identifier")
    color: str | None = Field(default=None, description="Hex color code for UI")
    description: str | None = Field(default=None, description="Tag description")
    usage_count: int = Field(..., description="Number of media assets using this tag")
    owner_user_id: str = Field(..., description="User who owns this tag")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class TagListResponse(BaseModel):
    """Response model for listing tags."""

    tags: list[TagResponse] = Field(..., description="List of tags")
    total: int = Field(..., description="Total number of tags")
    offset: int = Field(default=0, description="Pagination offset")
    limit: int = Field(default=50, description="Pagination limit")


class TagSuggestion(BaseModel):
    """Response model for tag auto-complete suggestions."""

    id: UUID = Field(..., description="Tag UUID")
    name: str = Field(..., description="Tag name")
    slug: str = Field(..., description="Tag slug")
    usage_count: int = Field(..., description="Usage count for relevance sorting")
    match_score: float = Field(
        ..., description="Fuzzy match score (0-1, higher is better)", ge=0, le=1
    )


class TagSuggestResponse(BaseModel):
    """Response model for tag suggestions."""

    suggestions: list[TagSuggestion] = Field(..., description="List of tag suggestions")
    total: int = Field(..., description="Total number of suggestions")


class BulkTagRequest(BaseModel):
    """Request model for bulk tagging operations."""

    media_asset_ids: list[UUID] = Field(
        ..., description="List of media asset UUIDs to tag", min_length=1
    )
    tag_names: list[str] = Field(..., description="List of tag names to apply", min_length=1)
    operation: TagOperationMode = Field(
        default=TagOperationMode.ADD,
        description="Operation mode: add, remove, or replace tags",
    )

    @field_validator("tag_names")
    @classmethod
    def validate_tag_names(cls, v: list[str]) -> list[str]:
        """Validate tag names are not empty."""
        cleaned = []
        for tag_name in v:
            stripped = tag_name.strip()
            if not stripped:
                raise ValueError("Tag names cannot be empty or only whitespace")
            cleaned.append(stripped)
        return cleaned


class BulkTagResponse(BaseModel):
    """Response model for bulk tagging operations."""

    success: bool = Field(..., description="Whether the operation was successful")
    processed_count: int = Field(..., description="Number of assets processed")
    tags_affected: int = Field(..., description="Number of tag relationships affected")
    errors: list[str] = Field(default_factory=list, description="List of any errors encountered")


class TagDeleteResponse(BaseModel):
    """Response model for tag deletion."""

    success: bool = Field(..., description="Whether the deletion was successful")
    tag_id: UUID = Field(..., description="ID of the deleted tag")
    cascade_deleted: int = Field(
        default=0, description="Number of media asset relationships removed"
    )
    message: str = Field(..., description="Human-readable message")
