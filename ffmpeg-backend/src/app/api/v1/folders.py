"""Folder management endpoints with nested hierarchy support."""

import logging
import uuid
from typing import Annotated

from db.models.folder import Folder
from db.models.media_asset import MediaAsset
from db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from services.websocket import media_event_publisher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    BreadcrumbItem,
    FolderContentsResponse,
    FolderCreateRequest,
    FolderDeleteResponse,
    FolderListResponse,
    FolderResponse,
    FolderTreeNode,
    FolderUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _folder_to_response(folder: Folder) -> FolderResponse:
    """
    Convert Folder model to FolderResponse schema.

    Args:
        folder: Folder model instance

    Returns:
        FolderResponse with breadcrumbs
    """
    breadcrumbs = [
        BreadcrumbItem(name=bc["name"], path=bc["path"]) for bc in folder.get_breadcrumbs()
    ]

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        parent_id=folder.parent_id,
        path=folder.path,
        owner_user_id=folder.owner_user_id,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        breadcrumbs=breadcrumbs,
    )


def _build_folder_tree(folders: list[Folder]) -> list[FolderTreeNode]:
    """
    Build hierarchical tree structure from flat folder list.

    Args:
        folders: List of all folders

    Returns:
        List of root-level FolderTreeNode with nested children
    """
    # Create lookup dict
    folder_dict: dict[uuid.UUID, FolderTreeNode] = {}
    for folder in folders:
        folder_dict[folder.id] = FolderTreeNode(
            id=folder.id,
            name=folder.name,
            parent_id=folder.parent_id,
            path=folder.path,
            created_at=folder.created_at,
            children=[],
        )

    # Build tree
    roots: list[FolderTreeNode] = []
    for folder in folders:
        node = folder_dict[folder.id]
        if folder.parent_id is None:
            # Root level folder
            roots.append(node)
        elif folder.parent_id in folder_dict:
            # Add to parent's children
            folder_dict[folder.parent_id].children.append(node)

    return roots


async def _check_circular_reference(
    db: AsyncSession, folder_id: uuid.UUID, new_parent_id: uuid.UUID
) -> bool:
    """
    Check if moving folder would create circular reference.

    Args:
        db: Database session
        folder_id: ID of folder being moved
        new_parent_id: ID of proposed new parent

    Returns:
        True if circular reference would be created, False otherwise
    """
    # Cannot be parent of itself
    if folder_id == new_parent_id:
        return True

    # Check if new_parent is a descendant of folder
    # by checking if new_parent's path starts with folder's path
    result = await db.execute(select(Folder).where(Folder.id == new_parent_id))
    new_parent = result.scalar_one_or_none()

    if not new_parent:
        return False

    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalar_one_or_none()

    if not folder:
        return False

    # If new parent's path starts with current folder's path,
    # it means new parent is a descendant
    return new_parent.path.startswith(folder.path + "/")


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=FolderResponse)
async def create_folder(
    request: FolderCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FolderResponse:
    """
    Create a new folder.

    Supports nested folder creation with parent_id.
    Uses materialized path pattern for efficient tree queries.

    Args:
        request: Folder creation request
        db: Database session (injected)

    Returns:
        FolderResponse: Created folder with path and breadcrumbs

    Raises:
        HTTPException: 404 if parent folder not found
        HTTPException: 400 for validation errors
    """
    logger.info(
        "Creating new folder",
        extra={
            "name": request.name,
            "parent_id": str(request.parent_id) if request.parent_id else None,
        },
    )

    # Determine path based on parent
    if request.parent_id:
        # Load parent folder
        result = await db.execute(select(Folder).where(Folder.id == request.parent_id))
        parent = result.scalar_one_or_none()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent folder with ID {request.parent_id} not found",
            )

        # Build path from parent path
        path = f"{parent.path}/{request.name}"
    else:
        # Root level folder
        path = f"/{request.name}"

    # Create folder
    folder = Folder(
        id=uuid.uuid4(),
        name=request.name,
        parent_id=request.parent_id,
        path=path,
        owner_user_id="default-user",  # TODO: Get from auth context
    )

    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    # Publish folder.created event
    await media_event_publisher.publish_folder_created(
        folder_id=folder.id,
        parent_id=folder.parent_id,
        user_id=folder.owner_user_id,
        data={"name": folder.name, "path": folder.path},
    )

    logger.info(
        "Folder created successfully",
        extra={"folder_id": str(folder.id), "path": folder.path},
    )

    return _folder_to_response(folder)


@router.get("/", response_model=FolderListResponse)
async def list_folders(
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_user_id: str = Query(default="default-user", description="Filter by owner user ID"),
) -> FolderListResponse:
    """
    List all folders in tree structure.

    Returns folders organized in hierarchical tree with nested children.

    Args:
        db: Database session (injected)
        owner_user_id: Filter folders by owner (default: 'default-user')

    Returns:
        FolderListResponse: Root folders with nested children
    """
    logger.info("Listing folders", extra={"owner_user_id": owner_user_id})

    # Load all folders for owner
    result = await db.execute(
        select(Folder).where(Folder.owner_user_id == owner_user_id).order_by(Folder.path)
    )
    folders = result.scalars().all()

    # Build tree structure
    tree = _build_folder_tree(list(folders))

    return FolderListResponse(folders=tree, total=len(folders))


@router.get("/{folder_id}/contents", response_model=FolderContentsResponse)
async def get_folder_contents(
    folder_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page"),
) -> FolderContentsResponse:
    """
    Get folder contents including subfolders and media assets.

    Supports pagination for large folders.

    Args:
        folder_id: Folder UUID
        db: Database session (injected)
        offset: Pagination offset
        limit: Items per page (max 100)

    Returns:
        FolderContentsResponse: Folder info, subfolders, and media assets

    Raises:
        HTTPException: 404 if folder not found
    """
    logger.info(
        "Getting folder contents",
        extra={"folder_id": str(folder_id), "offset": offset, "limit": limit},
    )

    # Load folder
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .options(selectinload(Folder.children), selectinload(Folder.media_assets))
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with ID {folder_id} not found",
        )

    # Get direct child folders
    result = await db.execute(
        select(Folder)
        .where(Folder.parent_id == folder_id)
        .order_by(Folder.name)
        .offset(offset)
        .limit(limit)
    )
    subfolders = result.scalars().all()

    # Count total subfolders
    result = await db.execute(
        select(Folder).where(Folder.parent_id == folder_id)
    )
    total_subfolders = len(result.scalars().all())

    # Convert to response schemas
    subfolder_responses = [_folder_to_response(sf) for sf in subfolders]

    return FolderContentsResponse(
        folder=_folder_to_response(folder),
        subfolders=subfolder_responses,
        total_subfolders=total_subfolders,
        offset=offset,
        limit=limit,
    )


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    request: FolderUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FolderResponse:
    """
    Update folder (rename or move).

    Supports:
    - Renaming folder (updates name and path)
    - Moving folder to new parent (updates path for folder and all descendants)
    - Prevents circular references in moves

    Uses database transaction for atomic updates.

    Args:
        folder_id: Folder UUID
        request: Update request with name and/or parent_id
        db: Database session (injected)

    Returns:
        FolderResponse: Updated folder

    Raises:
        HTTPException: 404 if folder or new parent not found
        HTTPException: 400 if circular reference detected or invalid update
    """
    logger.info(
        "Updating folder",
        extra={
            "folder_id": str(folder_id),
            "new_name": request.name,
            "new_parent_id": str(request.parent_id) if request.parent_id else None,
        },
    )

    # Load folder with children relationship
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id).options(selectinload(Folder.children))
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with ID {folder_id} not found",
        )

    # Track if we need to update descendant paths
    update_descendants = False
    old_path = folder.path

    # Handle rename
    if request.name is not None:
        folder.name = request.name
        update_descendants = True

    # Handle move (parent_id change)
    if request.parent_id is not None:
        # Check for circular reference
        if await _check_circular_reference(db, folder_id, request.parent_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move folder: circular reference detected",
            )

        # Load new parent
        result = await db.execute(select(Folder).where(Folder.id == request.parent_id))
        new_parent = result.scalar_one_or_none()

        if not new_parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent folder with ID {request.parent_id} not found",
            )

        folder.parent_id = request.parent_id
        update_descendants = True

    # Update folder path
    if update_descendants:
        # Recalculate path
        if folder.parent_id:
            result = await db.execute(select(Folder).where(Folder.id == folder.parent_id))
            parent = result.scalar_one_or_none()
            if parent:
                new_path = f"{parent.path}/{folder.name}"
            else:
                new_path = f"/{folder.name}"
        else:
            new_path = f"/{folder.name}"

        folder.path = new_path

        # Update all descendant paths in transaction
        # Find all descendants (folders where path starts with old_path/)
        result = await db.execute(
            select(Folder).where(Folder.path.startswith(old_path + "/"))
        )
        descendants = result.scalars().all()

        for descendant in descendants:
            # Replace old path prefix with new path
            descendant.path = descendant.path.replace(old_path, new_path, 1)

        logger.info(
            "Updated descendant paths",
            extra={
                "folder_id": str(folder_id),
                "descendants_updated": len(descendants),
                "old_path": old_path,
                "new_path": new_path,
            },
        )

    await db.commit()
    await db.refresh(folder)

    # Publish folder.updated event
    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.parent_id is not None:
        update_data["parent_id"] = str(request.parent_id)
    update_data["path"] = folder.path

    await media_event_publisher.publish_folder_updated(
        folder_id=folder.id,
        parent_id=folder.parent_id,
        user_id=folder.owner_user_id,
        data=update_data,
    )

    logger.info(
        "Folder updated successfully",
        extra={"folder_id": str(folder_id), "path": folder.path},
    )

    return _folder_to_response(folder)


@router.delete("/{folder_id}", response_model=FolderDeleteResponse)
async def delete_folder(
    folder_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    cascade: bool = Query(
        default=False,
        description="Delete folder even if it has children or media assets",
    ),
) -> FolderDeleteResponse:
    """
    Delete folder.

    By default, only empty folders can be deleted.
    Use cascade=true to delete folder with all contents.

    Args:
        folder_id: Folder UUID
        db: Database session (injected)
        cascade: Whether to delete non-empty folder

    Returns:
        FolderDeleteResponse: Deletion confirmation

    Raises:
        HTTPException: 404 if folder not found
        HTTPException: 400 if folder is not empty and cascade=false
    """
    logger.info(
        "Deleting folder",
        extra={"folder_id": str(folder_id), "cascade": cascade},
    )

    # Load folder with relationships
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .options(selectinload(Folder.children), selectinload(Folder.media_assets))
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with ID {folder_id} not found",
        )

    # Check if folder is empty
    has_children = len(folder.children) > 0
    has_media = len(folder.media_assets) > 0

    if (has_children or has_media) and not cascade:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete non-empty folder. Use cascade=true to force deletion.",
        )

    # Get parent_id before deleting
    parent_id = folder.parent_id

    # Delete folder (CASCADE will handle children and media assets)
    await db.delete(folder)
    await db.commit()

    # Publish folder.deleted event
    await media_event_publisher.publish_folder_deleted(
        folder_ids=[folder_id],
        parent_id=parent_id,
        user_id=folder.owner_user_id,
    )

    logger.info("Folder deleted successfully", extra={"folder_id": str(folder_id)})

    return FolderDeleteResponse(
        success=True,
        folder_id=folder_id,
        message=f"Folder '{folder.name}' deleted successfully",
    )
