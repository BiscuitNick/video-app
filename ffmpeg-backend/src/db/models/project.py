"""
Project and ProjectVersion models for project management and version history.
"""

import enum
import uuid
from typing import Any

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import BaseModel


class ProjectStatus(str, enum.Enum):
    """Status enum for projects."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"  # Soft delete


class SharePermission(str, enum.Enum):
    """Permission levels for project sharing."""

    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


class Project(BaseModel):
    """
    Project model for storing video editing projects.

    Attributes:
        id: UUID primary key
        name: Project name
        thumbnail_url: URL to project thumbnail
        project_data: JSONB field storing complete project state (timeline, clips, effects, etc.)
        owner_id: ID of the project owner (user/tenant)
        version: Optimistic locking version counter
        status: Project status (active, archived, deleted)
        last_saved_at: Timestamp of last save
        folder_id: Optional folder organization
    """

    __tablename__ = "projects"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic fields
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Project data (timeline, clips, effects, etc.)
    project_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    # Ownership and organization
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True
    )

    # Versioning and status
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ProjectStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Relationships
    versions: Mapped[list["ProjectVersion"]] = relationship(
        "ProjectVersion",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProjectVersion.version_number.desc()",
    )

    shares: Mapped[list["ProjectShare"]] = relationship(
        "ProjectShare",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    folder: Mapped["Folder"] = relationship(  # type: ignore[name-defined]
        "Folder",
        foreign_keys=[folder_id],
        lazy="selectin",
    )

    # Indexes for JSONB fields and common queries
    __table_args__ = (
        Index(
            "ix_projects_project_data",
            "project_data",
            postgresql_using="gin",
        ),
        Index("ix_projects_owner_status", "owner_id", "status"),
        Index("ix_projects_folder_status", "folder_id", "status"),
    )

    def __repr__(self) -> str:
        """String representation of Project."""
        return f"<Project(id={self.id}, name={self.name!r}, owner_id={self.owner_id!r}, version={self.version})>"


class ProjectVersion(BaseModel):
    """
    ProjectVersion model for storing version history and snapshots.

    Attributes:
        id: UUID primary key
        project_id: Reference to parent project
        version_number: Sequential version number
        project_data_snapshot: Complete project state at this version
        change_summary: Description of changes in this version
        is_auto_save: Whether this was an automatic save
        created_by: User/system that created this version
    """

    __tablename__ = "project_versions"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign key to project
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Version information
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    project_data_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Metadata
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_auto_save: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Vector clock for conflict detection (map of client_id -> version)
    vector_clock: Mapped[dict[str, int]] = mapped_column(JSONB, nullable=False, default=dict)

    # Relationship to project
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="versions",
    )

    # Indexes
    __table_args__ = (
        # Ensure version numbers are unique per project
        UniqueConstraint("project_id", "version_number", name="uq_project_version"),
        Index("ix_project_versions_project_created", "project_id", "created_at"),
        Index(
            "ix_project_versions_snapshot",
            "project_data_snapshot",
            postgresql_using="gin",
        ),
    )

    def __repr__(self) -> str:
        """String representation of ProjectVersion."""
        return f"<ProjectVersion(id={self.id}, project_id={self.project_id}, version_number={self.version_number})>"


class ProjectShare(BaseModel):
    """
    ProjectShare model for managing shared access to projects.

    Attributes:
        id: UUID primary key
        project_id: Reference to shared project
        shared_with_user_id: ID of user being granted access
        permission: Permission level (view, edit, admin)
        shared_by: ID of user who created the share
    """

    __tablename__ = "project_shares"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign key to project
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Sharing information
    shared_with_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    permission: Mapped[SharePermission] = mapped_column(
        Enum(
            SharePermission,
            name="share_permission",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    shared_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationship to project
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="shares",
    )

    # Indexes and constraints
    __table_args__ = (
        # Ensure a user can only have one share entry per project
        UniqueConstraint(
            "project_id",
            "shared_with_user_id",
            name="uq_project_share_user",
        ),
        Index("ix_project_shares_user_project", "shared_with_user_id", "project_id"),
    )

    def __repr__(self) -> str:
        """String representation of ProjectShare."""
        return f"<ProjectShare(id={self.id}, project_id={self.project_id}, user={self.shared_with_user_id}, permission={self.permission})>"
