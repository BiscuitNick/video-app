"""media asset management with folders and tags

Revision ID: 002
Revises: 001
Create Date: 2025-11-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create media asset management tables."""
    # Create enum type for media asset type
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE media_asset_type AS ENUM ('image', 'video', 'audio', 'text'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Create folders table
    op.create_table(
        "folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["folders.id"],
            name=op.f("fk_folders_parent_id_folders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_folders")),
    )
    op.create_index(op.f("ix_folders_owner_user_id"), "folders", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_folders_parent_id"), "folders", ["parent_id"], unique=False)
    op.create_index(op.f("ix_folders_path"), "folders", ["path"], unique=False)
    op.create_index("ix_folders_owner_created_at", "folders", ["owner_user_id", "created_at"], unique=False)
    op.create_index("ix_folders_parent_name", "folders", ["parent_id", "name"], unique=False)

    # Create trigger for folders
    op.execute(
        """
        CREATE TRIGGER update_folders_updated_at
        BEFORE UPDATE ON folders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )

    # Create tags table
    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
    )
    op.create_index(op.f("ix_tags_owner_user_id"), "tags", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_tags_slug"), "tags", ["slug"], unique=True)
    op.create_index(op.f("ix_tags_usage_count"), "tags", ["usage_count"], unique=False)
    op.create_index("ix_tags_owner_name", "tags", ["owner_user_id", "name"], unique=False)

    # Create trigger for tags
    op.execute(
        """
        CREATE TRIGGER update_tags_updated_at
        BEFORE UPDATE ON tags
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )

    # Create media_assets table
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM(
                "image",
                "video",
                "audio",
                "text",
                name="media_asset_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("s3_key", sa.String(length=1024), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("duration_seconds", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("frame_rate", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("codec", sa.String(length=100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["folder_id"],
            ["folders.id"],
            name=op.f("fk_media_assets_folder_id_folders"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_assets")),
    )
    op.create_index(op.f("ix_media_assets_folder_id"), "media_assets", ["folder_id"], unique=False)
    op.create_index(op.f("ix_media_assets_is_deleted"), "media_assets", ["is_deleted"], unique=False)
    op.create_index(op.f("ix_media_assets_owner_user_id"), "media_assets", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_media_assets_type"), "media_assets", ["type"], unique=False)
    op.create_index("ix_media_assets_type_created_at", "media_assets", ["type", "created_at"], unique=False)
    op.create_index("ix_media_assets_owner_type", "media_assets", ["owner_user_id", "type"], unique=False)
    op.create_index(
        "ix_media_assets_folder_created_at", "media_assets", ["folder_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_media_assets_metadata",
        "media_assets",
        ["metadata"],
        unique=False,
        postgresql_using="gin",
    )

    # Create trigger for media_assets
    op.execute(
        """
        CREATE TRIGGER update_media_assets_updated_at
        BEFORE UPDATE ON media_assets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )

    # Create media_asset_tags junction table
    op.create_table(
        "media_asset_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_assets.id"],
            name=op.f("fk_media_asset_tags_media_asset_id_media_assets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
            name=op.f("fk_media_asset_tags_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_asset_tags")),
        sa.UniqueConstraint("media_asset_id", "tag_id", name="uq_media_asset_tag"),
    )
    op.create_index(
        op.f("ix_media_asset_tags_media_asset_id"), "media_asset_tags", ["media_asset_id"], unique=False
    )
    op.create_index(op.f("ix_media_asset_tags_tag_id"), "media_asset_tags", ["tag_id"], unique=False)
    op.create_index(
        "ix_media_asset_tags_asset_tag", "media_asset_tags", ["media_asset_id", "tag_id"], unique=False
    )

    # Create trigger for media_asset_tags
    op.execute(
        """
        CREATE TRIGGER update_media_asset_tags_updated_at
        BEFORE UPDATE ON media_asset_tags
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )


def downgrade() -> None:
    """Drop media asset management tables."""
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_media_asset_tags_updated_at ON media_asset_tags")
    op.execute("DROP TRIGGER IF EXISTS update_media_assets_updated_at ON media_assets")
    op.execute("DROP TRIGGER IF EXISTS update_tags_updated_at ON tags")
    op.execute("DROP TRIGGER IF EXISTS update_folders_updated_at ON folders")

    # Drop tables (cascade will handle foreign keys)
    op.drop_table("media_asset_tags")
    op.drop_table("media_assets")
    op.drop_table("tags")
    op.drop_table("folders")

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS media_asset_type")
