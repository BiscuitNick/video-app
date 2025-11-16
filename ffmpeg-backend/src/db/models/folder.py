"""
Folder model for media organization with nested hierarchy support.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import BaseModel

if TYPE_CHECKING:
    from db.models.media_asset import MediaAsset


class Folder(BaseModel):
    """
    Model for organizing media assets in a nested folder hierarchy.

    Uses materialized path pattern for efficient tree queries.
    Path is stored as '/root/subfolder1/subfolder2' for easy breadcrumb generation.

    Attributes:
        id: UUID primary key
        name: Folder name
        parent_id: Optional foreign key to parent folder
        path: Materialized path (full path from root)
        owner_user_id: User who owns this folder (default: 'default-user')
        created_at: Timestamp when folder was created
        updated_at: Timestamp when folder was last updated
    """

    __tablename__ = "folders"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Folder details
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Self-referential foreign key for parent folder
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Materialized path for efficient tree queries
    # Format: '/root/subfolder1/subfolder2'
    path: Mapped[str] = mapped_column(Text, nullable=False)

    # Owner information (default user for no-auth mode)
    owner_user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="default-user", index=True
    )

    # Relationships
    parent: Mapped["Folder | None"] = relationship(
        "Folder",
        remote_side=[id],
        back_populates="children",
        foreign_keys=[parent_id],
    )

    children: Mapped[list["Folder"]] = relationship(
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys=[parent_id],
    )

    media_assets: Mapped[list["MediaAsset"]] = relationship(  # type: ignore[name-defined]
        "MediaAsset",
        back_populates="folder",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_folders_owner_path", "owner_user_id", "path"),
        Index("ix_folders_parent_owner", "parent_id", "owner_user_id"),
    )

    def __repr__(self) -> str:
        """String representation of Folder."""
        return f"<Folder(id={self.id}, name={self.name}, path={self.path})>"

    def get_breadcrumbs(self) -> list[dict[str, str]]:
        """
        Generate breadcrumb list from materialized path.

        Returns:
            List of dicts with 'name' and 'path' for each level
        """
        if not self.path or self.path == "/":
            return []

        parts = [p for p in self.path.split("/") if p]
        breadcrumbs = []
        current_path = ""

        for part in parts:
            current_path += f"/{part}"
            breadcrumbs.append({"name": part, "path": current_path})

        return breadcrumbs

    def update_path(self, new_parent_path: str | None = None) -> str:
        """
        Update the materialized path based on parent path and folder name.

        Args:
            new_parent_path: Optional new parent path (if moving folder)

        Returns:
            Updated path
        """
        if new_parent_path is not None:
            # Moving to a new parent
            if new_parent_path == "/" or new_parent_path == "":
                self.path = f"/{self.name}"
            else:
                self.path = f"{new_parent_path}/{self.name}"
        else:
            # Just updating based on current parent
            if not self.parent_id:
                self.path = f"/{self.name}"
            else:
                # Parent path should be set when parent relationship is loaded
                # This is a fallback
                self.path = f"/{self.name}"

        return self.path
