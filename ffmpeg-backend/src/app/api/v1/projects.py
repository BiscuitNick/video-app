"""Project management endpoints with version history and sharing."""

import logging
import uuid
from typing import Annotated, Any

from db.models.project import (
    Project,
    ProjectShare,
    ProjectStatus,
    ProjectVersion,
    SharePermission,
)
from db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    BulkOperationRequest,
    BulkOperationResponse,
    ConflictDetectionResponse,
    ConflictResolutionRequest,
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectDuplicateRequest,
    ProjectListResponse,
    ProjectResponse,
    ProjectShareRequest,
    ProjectShareResponse,
    ProjectShareUpdateRequest,
    ProjectUpdateRequest,
    ProjectVersionDetailResponse,
    ProjectVersionListResponse,
    ProjectVersionResponse,
    SharePermissionEnum,
    SortBy,
    SortOrder,
    VersionDiffResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_current_user_id() -> str:
    """Get current user ID from auth context. Mock implementation for now."""
    # TODO: Replace with actual auth implementation
    return "user_123"


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ProjectDetailResponse)
async def create_project(
    request: ProjectCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectDetailResponse:
    """Create a new project.

    Args:
        request: Project creation request
        db: Database session
        user_id: Current user ID

    Returns:
        Created project with details
    """
    project_id = uuid.uuid4()

    logger.info(
        "Creating new project",
        extra={"project_id": str(project_id), "name": request.name, "user_id": user_id},
    )

    # Create project
    project = Project(
        id=project_id,
        name=request.name,
        description=request.description,
        project_data=request.project_data,
        thumbnail_url=request.thumbnail_url,
        owner_id=user_id,
        folder_id=request.folder_id,
        version=1,
        status=ProjectStatus.ACTIVE,
    )

    try:
        db.add(project)
        await db.commit()
        await db.refresh(project)

        # Create initial version snapshot
        version = ProjectVersion(
            project_id=project_id,
            version_number=1,
            project_data_snapshot=request.project_data,
            change_summary="Initial project creation",
            is_auto_save=False,
            created_by=user_id,
            vector_clock={user_id: 1},
        )
        db.add(version)
        await db.commit()

        # Refresh to load relationships
        await db.refresh(project)

        logger.info("Project created successfully", extra={"project_id": str(project_id)})

        return ProjectDetailResponse.model_validate(project)

    except Exception as e:
        await db.rollback()
        logger.exception("Failed to create project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project",
        ) from e


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
    folder_id: uuid.UUID | None = Query(None, description="Filter by folder ID"),
    status_filter: str | None = Query(None, description="Filter by status (active, archived, deleted)"),
    search: str | None = Query(None, description="Search in project name and description"),
    sort_by: SortBy = Query(SortBy.UPDATED_AT, description="Sort field"),
    sort_order: SortOrder = Query(SortOrder.DESC, description="Sort order"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
) -> ProjectListResponse:
    """List projects with pagination, filtering, and sorting.

    Args:
        db: Database session
        user_id: Current user ID
        folder_id: Optional folder filter
        status_filter: Optional status filter
        search: Optional search query
        sort_by: Sort field
        sort_order: Sort order
        offset: Pagination offset
        limit: Pagination limit

    Returns:
        Paginated list of projects
    """
    logger.info(
        "Listing projects",
        extra={
            "user_id": user_id,
            "folder_id": str(folder_id) if folder_id else None,
            "status": status_filter,
            "search": search,
        },
    )

    try:
        # Build query - include owned projects and shared projects
        query = select(Project).where(
            or_(
                Project.owner_id == user_id,
                Project.id.in_(
                    select(ProjectShare.project_id).where(ProjectShare.shared_with_user_id == user_id)
                ),
            )
        )

        # Apply filters
        if folder_id:
            query = query.where(Project.folder_id == folder_id)

        if status_filter:
            try:
                status_enum = ProjectStatus(status_filter.lower())
                query = query.where(Project.status == status_enum)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {status_filter}",
                )
        else:
            # By default, exclude deleted projects
            query = query.where(Project.status != ProjectStatus.DELETED)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Project.name.ilike(search_term),
                    Project.description.ilike(search_term),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply sorting
        if sort_by == SortBy.NAME:
            sort_col = Project.name
        elif sort_by == SortBy.CREATED_AT:
            sort_col = Project.created_at
        else:  # UPDATED_AT
            sort_col = Project.updated_at

        if sort_order == SortOrder.ASC:
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute query
        result = await db.execute(query)
        projects = result.scalars().all()

        logger.info(
            "Retrieved projects",
            extra={"count": len(projects), "total": total, "user_id": user_id},
        )

        return ProjectListResponse(
            projects=[ProjectResponse.model_validate(p) for p in projects],
            total=total,
            offset=offset,
            limit=limit,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list projects", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve projects",
        ) from e


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectDetailResponse:
    """Get detailed project information.

    Args:
        project_id: Project ID
        db: Database session
        user_id: Current user ID

    Returns:
        Detailed project information
    """
    logger.info("Retrieving project", extra={"project_id": str(project_id), "user_id": user_id})

    try:
        # Query with relationships loaded
        result = await db.execute(
            select(Project)
            .options(selectinload(Project.shares))
            .where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Check access permissions
        has_access = (
            project.owner_id == user_id
            or any(share.shared_with_user_id == user_id for share in project.shares)
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

        return ProjectDetailResponse.model_validate(project)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project",
        ) from e


@router.put("/{project_id}", response_model=ProjectDetailResponse)
async def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectDetailResponse:
    """Update a project with optimistic locking.

    Args:
        project_id: Project ID
        request: Update request with version for optimistic locking
        db: Database session
        user_id: Current user ID

    Returns:
        Updated project
    """
    logger.info("Updating project", extra={"project_id": str(project_id), "user_id": user_id})

    try:
        # Query project
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Check edit permissions
        has_edit = project.owner_id == user_id or any(
            share.shared_with_user_id == user_id
            and share.permission in (SharePermission.EDIT, SharePermission.ADMIN)
            for share in project.shares
        )

        if not has_edit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this project",
            )

        # Optimistic locking check
        if project.version != request.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Version conflict: expected {request.version}, but current is {project.version}",
            )

        # Update fields
        if request.name is not None:
            project.name = request.name
        if request.description is not None:
            project.description = request.description
        if request.thumbnail_url is not None:
            project.thumbnail_url = request.thumbnail_url
        if request.folder_id is not None:
            project.folder_id = request.folder_id

        # Update project data and increment version
        if request.project_data is not None:
            project.project_data = request.project_data
            project.version += 1

            # Create version snapshot
            version = ProjectVersion(
                project_id=project_id,
                version_number=project.version,
                project_data_snapshot=request.project_data,
                change_summary=request.change_summary or "Project updated",
                is_auto_save=request.change_summary is None,
                created_by=user_id,
                vector_clock={user_id: project.version},
            )
            db.add(version)

        await db.commit()
        await db.refresh(project)

        logger.info("Project updated successfully", extra={"project_id": str(project_id)})

        return ProjectDetailResponse.model_validate(project)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to update project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project",
        ) from e


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
) -> None:
    """Delete a project (soft delete by default).

    Args:
        project_id: Project ID
        db: Database session
        user_id: Current user ID
        hard_delete: If True, permanently delete; otherwise soft delete
    """
    logger.info(
        "Deleting project",
        extra={"project_id": str(project_id), "user_id": user_id, "hard_delete": hard_delete},
    )

    try:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Only owner can delete
        if project.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the project owner can delete it",
            )

        if hard_delete:
            await db.delete(project)
        else:
            project.status = ProjectStatus.DELETED

        await db.commit()

        logger.info("Project deleted successfully", extra={"project_id": str(project_id)})

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to delete project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project",
        ) from e


# Sharing endpoints


@router.post("/{project_id}/share", status_code=status.HTTP_201_CREATED, response_model=ProjectShareResponse)
async def share_project(
    project_id: uuid.UUID,
    request: ProjectShareRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectShareResponse:
    """Share a project with another user.

    Args:
        project_id: Project ID
        request: Share request
        db: Database session
        user_id: Current user ID

    Returns:
        Created share
    """
    logger.info(
        "Sharing project",
        extra={
            "project_id": str(project_id),
            "user_id": user_id,
            "shared_with": request.shared_with_user_id,
        },
    )

    try:
        # Get project
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Check admin permissions
        has_admin = project.owner_id == user_id or any(
            share.shared_with_user_id == user_id and share.permission == SharePermission.ADMIN
            for share in project.shares
        )

        if not has_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to share this project",
            )

        # Check if already shared
        existing = await db.execute(
            select(ProjectShare).where(
                and_(
                    ProjectShare.project_id == project_id,
                    ProjectShare.shared_with_user_id == request.shared_with_user_id,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Project already shared with this user",
            )

        # Create share
        share = ProjectShare(
            project_id=project_id,
            shared_with_user_id=request.shared_with_user_id,
            permission=SharePermission(request.permission.value),
            shared_by=user_id,
        )

        db.add(share)
        await db.commit()
        await db.refresh(share)

        logger.info("Project shared successfully", extra={"share_id": str(share.id)})

        return ProjectShareResponse.model_validate(share)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to share project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to share project",
        ) from e


@router.get("/{project_id}/shares", response_model=list[ProjectShareResponse])
async def list_project_shares(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> list[ProjectShareResponse]:
    """List all shares for a project.

    Args:
        project_id: Project ID
        db: Database session
        user_id: Current user ID

    Returns:
        List of project shares
    """
    try:
        # Get project
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Check access
        has_access = project.owner_id == user_id or any(
            share.shared_with_user_id == user_id for share in project.shares
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

        return [ProjectShareResponse.model_validate(share) for share in project.shares]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list shares", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve shares",
        ) from e


@router.delete("/{project_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_share(
    project_id: uuid.UUID,
    share_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> None:
    """Remove a project share.

    Args:
        project_id: Project ID
        share_id: Share ID
        db: Database session
        user_id: Current user ID
    """
    try:
        # Get share
        result = await db.execute(
            select(ProjectShare).where(
                and_(
                    ProjectShare.id == share_id,
                    ProjectShare.project_id == project_id,
                )
            )
        )
        share = result.scalar_one_or_none()

        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found",
            )

        # Get project to check permissions
        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()

        # Check admin permissions
        has_admin = project.owner_id == user_id or any(
            s.shared_with_user_id == user_id and s.permission == SharePermission.ADMIN
            for s in project.shares
        )

        if not has_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to remove shares",
            )

        await db.delete(share)
        await db.commit()

        logger.info("Share removed successfully", extra={"share_id": str(share_id)})

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to remove share", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove share",
        ) from e


# Version history endpoints


@router.get("/{project_id}/versions", response_model=ProjectVersionListResponse)
async def list_project_versions(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
    limit: int = Query(50, ge=1, le=100, description="Maximum number of versions to return"),
) -> ProjectVersionListResponse:
    """Get version history for a project.

    Args:
        project_id: Project ID
        db: Database session
        user_id: Current user ID
        limit: Maximum versions to return

    Returns:
        List of project versions
    """
    try:
        # Check project access
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        has_access = project.owner_id == user_id or any(
            share.shared_with_user_id == user_id for share in project.shares
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

        # Get versions
        versions_result = await db.execute(
            select(ProjectVersion)
            .where(ProjectVersion.project_id == project_id)
            .order_by(ProjectVersion.version_number.desc())
            .limit(limit)
        )
        versions = versions_result.scalars().all()

        return ProjectVersionListResponse(
            versions=[ProjectVersionResponse.model_validate(v) for v in versions],
            total=len(versions),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list versions", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve versions",
        ) from e


@router.get("/{project_id}/versions/{version_number}", response_model=ProjectVersionDetailResponse)
async def get_project_version(
    project_id: uuid.UUID,
    version_number: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectVersionDetailResponse:
    """Get a specific project version with full snapshot.

    Args:
        project_id: Project ID
        version_number: Version number
        db: Database session
        user_id: Current user ID

    Returns:
        Detailed version information
    """
    try:
        # Check project access
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        has_access = project.owner_id == user_id or any(
            share.shared_with_user_id == user_id for share in project.shares
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

        # Get version
        version_result = await db.execute(
            select(ProjectVersion).where(
                and_(
                    ProjectVersion.project_id == project_id,
                    ProjectVersion.version_number == version_number,
                )
            )
        )
        version = version_result.scalar_one_or_none()

        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_number} not found",
            )

        return ProjectVersionDetailResponse.model_validate(version)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get version", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve version",
        ) from e


# Additional utility endpoints


@router.post("/{project_id}/duplicate", status_code=status.HTTP_201_CREATED, response_model=ProjectDetailResponse)
async def duplicate_project(
    project_id: uuid.UUID,
    request: ProjectDuplicateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> ProjectDetailResponse:
    """Duplicate a project.

    Args:
        project_id: Project ID to duplicate
        request: Duplication request
        db: Database session
        user_id: Current user ID

    Returns:
        Newly created duplicate project
    """
    try:
        # Get source project
        result = await db.execute(select(Project).where(Project.id == project_id))
        source_project = result.scalar_one_or_none()

        if not source_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # Check access
        has_access = source_project.owner_id == user_id or any(
            share.shared_with_user_id == user_id for share in source_project.shares
        )

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

        # Create duplicate
        new_project = Project(
            id=uuid.uuid4(),
            name=request.new_name,
            description=source_project.description,
            project_data=source_project.project_data,
            thumbnail_url=source_project.thumbnail_url,
            owner_id=user_id,
            folder_id=source_project.folder_id,
            version=1,
            status=ProjectStatus.ACTIVE,
        )

        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)

        logger.info(
            "Project duplicated",
            extra={"source_id": str(project_id), "new_id": str(new_project.id)},
        )

        return ProjectDetailResponse.model_validate(new_project)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to duplicate project", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to duplicate project",
        ) from e


@router.post("/bulk", response_model=BulkOperationResponse)
async def bulk_operations(
    request: BulkOperationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(_get_current_user_id)] = None,
) -> BulkOperationResponse:
    """Perform bulk operations on projects.

    Args:
        request: Bulk operation request
        db: Database session
        user_id: Current user ID

    Returns:
        Bulk operation results
    """
    successful_ids: list[uuid.UUID] = []
    failed_ids: list[uuid.UUID] = []
    errors: dict[str, str] = {}

    try:
        for project_id in request.project_ids:
            try:
                result = await db.execute(select(Project).where(Project.id == project_id))
                project = result.scalar_one_or_none()

                if not project:
                    failed_ids.append(project_id)
                    errors[str(project_id)] = "Project not found"
                    continue

                # Check ownership for destructive operations
                if request.operation in ["delete", "archive"] and project.owner_id != user_id:
                    failed_ids.append(project_id)
                    errors[str(project_id)] = "Permission denied"
                    continue

                # Perform operation
                if request.operation == "archive":
                    project.status = ProjectStatus.ARCHIVED
                elif request.operation == "delete":
                    project.status = ProjectStatus.DELETED
                elif request.operation == "move" and request.target_folder_id:
                    project.folder_id = request.target_folder_id

                successful_ids.append(project_id)

            except Exception as e:
                failed_ids.append(project_id)
                errors[str(project_id)] = str(e)

        await db.commit()

        message = f"Successfully processed {len(successful_ids)} projects"
        if failed_ids:
            message += f", {len(failed_ids)} failed"

        return BulkOperationResponse(
            successful_count=len(successful_ids),
            failed_count=len(failed_ids),
            successful_ids=successful_ids,
            failed_ids=failed_ids,
            errors=errors,
            message=message,
        )

    except Exception as e:
        await db.rollback()
        logger.exception("Bulk operation failed", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bulk operation failed",
        ) from e
