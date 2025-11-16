"""
Media asset models for managing media files, folders, and tags.
"""

import enum
import uuid
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import BaseModel


class MediaAssetType(str, enum.Enum):
    """Type of media asset."""

    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"


class MediaAsset(BaseModel):
    """
    Model for storing media assets (images, videos, audio, text files).

    Attributes:
        id: UUID primary key
        owner_user_id: ID of the user who owns this asset
        type: Type of media asset (image, video, audio, text)
        url: Public URL to access the asset
        s3_key: S3 storage key for the asset
        thumbnail_url: URL to the asset's thumbnail
        thumbnail_s3_key: S3 storage key for the thumbnail
        filename: Current filename
        original_filename: Original filename when uploaded
        file_size_bytes: Size of the file in bytes
        mime_type: MIME type of the file
        duration_seconds: Duration in seconds (for video/audio)
        width: Width in pixels (for images/video)
        height: Height in pixels (for images/video)
        frame_rate: Frame rate (for video)
        codec: Codec used (for video/audio)
        metadata: Additional metadata stored as JSONB
        folder_id: Foreign key to Folder
        is_deleted: Soft delete flag
    """

    __tablename__ = "media_assets"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Ownership
    owner_user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="default-user", index=True
    )

    # Asset type and location
    type: Mapped[MediaAssetType] = mapped_column(
        Enum(MediaAssetType, name="media_asset_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Thumbnail
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # File information
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Media properties
    duration_seconds: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frame_rate: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    codec: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Additional metadata
    metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, default=None)

    # Folder organization
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # Relationships
    folder: Mapped["Folder"] = relationship(  # type: ignore[name-defined]
        "Folder", back_populates="media_assets"
    )

    tags: Mapped[list["Tag"]] = relationship(  # type: ignore[name-defined]
        "Tag",
        secondary="media_asset_tags",
        back_populates="media_assets",
        lazy="selectin",
    )

    # Indexes for common queries
    __table_args__ = (
        Index("ix_media_assets_type_created_at", "type", "created_at"),
        Index("ix_media_assets_owner_type", "owner_user_id", "type"),
        Index("ix_media_assets_folder_created_at", "folder_id", "created_at"),
        Index("ix_media_assets_metadata", "metadata", postgresql_using="gin"),
    )

    def __repr__(self) -> str:
        """String representation of MediaAsset."""
        return (
            f"<MediaAsset(id={self.id}, filename={self.filename!r}, "
            f"type={self.type}, owner={self.owner_user_id})>"
        )


class Folder(BaseModel):
    """
    Model for organizing media assets into folders.

    Supports hierarchical folder structure with self-referential parent_id.

    Attributes:
        id: UUID primary key
        name: Name of the folder
        parent_id: Foreign key to parent folder (self-referential)
        path: Materialized path for efficient tree queries (e.g., '/parent/child/')
        owner_user_id: ID of the user who owns this folder
    """

    __tablename__ = "folders"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Folder information
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Hierarchical structure
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Materialized path for efficient tree queries
    path: Mapped[str] = mapped_column(Text, nullable=False, index=True)

    # Ownership
    owner_user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="default-user", index=True
    )

    # Relationships
    parent: Mapped["Folder"] = relationship(  # type: ignore[name-defined]
        "Folder",
        remote_side=[id],
        back_populates="children",
    )

    children: Mapped[list["Folder"]] = relationship(  # type: ignore[name-defined]
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    media_assets: Mapped[list["MediaAsset"]] = relationship(  # type: ignore[name-defined]
        "MediaAsset",
        back_populates="folder",
        lazy="selectin",
    )

    # Indexes for common queries
    __table_args__ = (
        Index("ix_folders_owner_created_at", "owner_user_id", "created_at"),
        Index("ix_folders_parent_name", "parent_id", "name"),
    )

    def __repr__(self) -> str:
        """String representation of Folder."""
        return f"<Folder(id={self.id}, name={self.name!r}, path={self.path!r})>"


class Tag(BaseModel):
    """
    Model for tagging media assets.

    Attributes:
        id: UUID primary key
        name: Display name of the tag
        slug: URL-friendly unique identifier
        color: Hex color code for UI display
        description: Optional description of the tag
        usage_count: Number of times this tag is used (denormalized for performance)
        owner_user_id: ID of the user who owns this tag
    """

    __tablename__ = "tags"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tag information
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color code
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    # Ownership
    owner_user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="default-user", index=True
    )

    # Relationships
    media_assets: Mapped[list["MediaAsset"]] = relationship(  # type: ignore[name-defined]
        "MediaAsset",
        secondary="media_asset_tags",
        back_populates="tags",
        lazy="selectin",
    )

    # Indexes for common queries
    __table_args__ = (Index("ix_tags_owner_name", "owner_user_id", "name"),)

    def __repr__(self) -> str:
        """String representation of Tag."""
        return f"<Tag(id={self.id}, name={self.name!r}, slug={self.slug!r})>"


class MediaAssetTag(BaseModel):
    """
    Junction table for many-to-many relationship between MediaAsset and Tag.

    Attributes:
        id: UUID primary key
        media_asset_id: Foreign key to MediaAsset
        tag_id: Foreign key to Tag
    """

    __tablename__ = "media_asset_tags"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Ensure unique combinations
    __table_args__ = (
        UniqueConstraint("media_asset_id", "tag_id", name="uq_media_asset_tag"),
        Index("ix_media_asset_tags_asset_tag", "media_asset_id", "tag_id"),
    )

    def __repr__(self) -> str:
        """String representation of MediaAssetTag."""
        return f"<MediaAssetTag(media_asset_id={self.media_asset_id}, tag_id={self.tag_id})>"
