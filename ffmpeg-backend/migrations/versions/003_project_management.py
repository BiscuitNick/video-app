"""project management with version history and sharing

Revision ID: 003
Revises: 002
Create Date: 2025-11-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create project management tables."""
    # Create enum type for project status
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Create enum type for share permissions
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE share_permission AS ENUM ('view', 'edit', 'admin'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Create projects table
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=1024), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "project_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "archived",
                "deleted",
                name="project_status",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
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
            name=op.f("fk_projects_folder_id_folders"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=False)
    op.create_index(op.f("ix_projects_owner_id"), "projects", ["owner_id"], unique=False)
    op.create_index(op.f("ix_projects_status"), "projects", ["status"], unique=False)
    op.create_index("ix_projects_owner_status", "projects", ["owner_id", "status"], unique=False)
    op.create_index("ix_projects_folder_status", "projects", ["folder_id", "status"], unique=False)
    op.create_index(
        "ix_projects_project_data",
        "projects",
        ["project_data"],
        unique=False,
        postgresql_using="gin",
    )

    # Create trigger for projects
    op.execute(
        """
        CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )

    # Create project_versions table
    op.create_table(
        "project_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "project_data_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("is_auto_save", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(length=255), nullable=False),
        sa.Column(
            "vector_clock",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
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
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_versions_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_versions")),
        sa.UniqueConstraint("project_id", "version_number", name="uq_project_version"),
    )
    op.create_index(
        op.f("ix_project_versions_project_id"), "project_versions", ["project_id"], unique=False
    )
    op.create_index(
        "ix_project_versions_project_created",
        "project_versions",
        ["project_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_project_versions_snapshot",
        "project_versions",
        ["project_data_snapshot"],
        unique=False,
        postgresql_using="gin",
    )

    # Create trigger for project_versions
    op.execute(
        """
        CREATE TRIGGER update_project_versions_updated_at
        BEFORE UPDATE ON project_versions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )

    # Create project_shares table
    op.create_table(
        "project_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shared_with_user_id", sa.String(length=255), nullable=False),
        sa.Column(
            "permission",
            postgresql.ENUM(
                "view",
                "edit",
                "admin",
                name="share_permission",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("shared_by", sa.String(length=255), nullable=False),
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
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_shares_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_shares")),
        sa.UniqueConstraint("project_id", "shared_with_user_id", name="uq_project_share_user"),
    )
    op.create_index(
        op.f("ix_project_shares_project_id"), "project_shares", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_project_shares_shared_with_user_id"),
        "project_shares",
        ["shared_with_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_shares_user_project",
        "project_shares",
        ["shared_with_user_id", "project_id"],
        unique=False,
    )

    # Create trigger for project_shares
    op.execute(
        """
        CREATE TRIGGER update_project_shares_updated_at
        BEFORE UPDATE ON project_shares
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
    )


def downgrade() -> None:
    """Drop project management tables."""
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_project_shares_updated_at ON project_shares")
    op.execute("DROP TRIGGER IF EXISTS update_project_versions_updated_at ON project_versions")
    op.execute("DROP TRIGGER IF EXISTS update_projects_updated_at ON projects")

    # Drop tables (cascade will handle foreign keys)
    op.drop_table("project_shares")
    op.drop_table("project_versions")
    op.drop_table("projects")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS share_permission")
    op.execute("DROP TYPE IF EXISTS project_status")
