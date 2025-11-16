"""Tag management endpoints."""

import logging
import uuid
from typing import Annotated

from db.models.media_asset import MediaAsset, MediaAssetTag, Tag
from db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    BulkTagRequest,
    BulkTagResponse,
    TagCreateRequest,
    TagDeleteResponse,
    TagListResponse,
    TagOperationMode,
    TagResponse,
    TagSuggestion,
    TagSuggestResponse,
    TagUpdateRequest,
)
from app.config import settings
from app.utils.tag_utils import fuzzy_match_score, generate_slug, normalize_tag_name, sanitize_tag_list

logger = logging.getLogger(__name__)

router = APIRouter()

router = APIRouter()


@router.get("/", response_model=TagListResponse)
async def list_tags(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=50, ge=1, le=100, description="Pagination limit"),
    sort_by: str = Query(default="usage_count", description="Sort field (usage_count, name, created_at)"),
    sort_order: str = Query(default="desc", description="Sort order (asc, desc)"),
    owner_user_id: str = Query(default=settings.default_user_id, description="Filter by owner user ID"),
) -> TagListResponse:
    """
    List all tags with usage statistics.

    Returns paginated list of tags with their usage counts.
    Can be sorted by usage count, name, or creation date.

    Args:
        db: Database session
        offset: Pagination offset
        limit: Number of tags to return
        sort_by: Field to sort by
        sort_order: Sort order (asc or desc)
        owner_user_id: Filter by owner user ID

    Returns:
        TagListResponse with list of tags and pagination info
    """
    logger.info(
        "Listing tags",
        extra={
            "offset": offset,
            "limit": limit,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "owner_user_id": owner_user_id,
        },
    )

    # Build query
    query = select(Tag).where(Tag.owner_user_id == owner_user_id)

    # Add sorting
    sort_field = {
        "usage_count": Tag.usage_count,
        "name": Tag.name,
        "created_at": Tag.created_at,
    }.get(sort_by, Tag.usage_count)

    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(sort_field)

    # Add pagination
    query = query.offset(offset).limit(limit)

    # Execute query
    result = await db.execute(query)
    tags = result.scalars().all()

    # Get total count
    count_query = select(func.count()).select_from(Tag).where(Tag.owner_user_id == owner_user_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return TagListResponse(
        tags=[TagResponse.model_validate(tag) for tag in tags],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TagResponse)
async def create_tag(
    request: TagCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_user_id: str = Query(default=settings.default_user_id, description="Owner user ID"),
) -> TagResponse:
    """
    Create a new tag.

    Normalizes the tag name and generates a unique slug.
    Checks for duplicate tags (case-insensitive).

    Args:
        request: Tag creation request
        db: Database session
        owner_user_id: Owner user ID

    Returns:
        Created tag

    Raises:
        HTTPException 409: If tag with same normalized name already exists
    """
    # Normalize tag name
    normalized_name = normalize_tag_name(request.name)

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag name must contain at least one alphanumeric character",
        )

    # Generate slug
    slug = generate_slug(normalized_name)

    logger.info(
        "Creating new tag",
        extra={
            "original_name": request.name,
            "normalized_name": normalized_name,
            "slug": slug,
            "owner_user_id": owner_user_id,
        },
    )

    # Check if tag with same slug already exists for this user
    existing_query = select(Tag).where(Tag.slug == slug, Tag.owner_user_id == owner_user_id)
    result = await db.execute(existing_query)
    existing_tag = result.scalar_one_or_none()

    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag with name '{normalized_name}' already exists",
        )

    # Create new tag
    new_tag = Tag(
        id=uuid.uuid4(),
        name=normalized_name,
        slug=slug,
        color=request.color,
        description=request.description,
        usage_count=0,
        owner_user_id=owner_user_id,
    )

    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)

    logger.info(f"Created tag: {new_tag.id}", extra={"tag_id": str(new_tag.id), "name": normalized_name})

    return TagResponse.model_validate(new_tag)


@router.get("/suggest", response_model=TagSuggestResponse)
async def suggest_tags(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="Search query for tag suggestions"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum number of suggestions"),
    min_score: float = Query(default=0.3, ge=0, le=1, description="Minimum fuzzy match score"),
    owner_user_id: str = Query(default=settings.default_user_id, description="Filter by owner user ID"),
) -> TagSuggestResponse:
    """
    Get tag suggestions with fuzzy matching.

    Searches for tags that match the query string using fuzzy matching.
    Results are sorted by match score and usage count.

    Args:
        q: Search query
        db: Database session
        limit: Maximum suggestions to return
        min_score: Minimum fuzzy match score (0-1)
        owner_user_id: Filter by owner user ID

    Returns:
        List of tag suggestions with match scores
    """
    logger.info(
        "Getting tag suggestions",
        extra={
            "query": q,
            "limit": limit,
            "min_score": min_score,
            "owner_user_id": owner_user_id,
        },
    )

    # Normalize query
    normalized_query = normalize_tag_name(q)

    # Get all tags for this user (we'll filter in memory for fuzzy matching)
    # In production, consider using PostgreSQL pg_trgm extension for better performance
    query = select(Tag).where(Tag.owner_user_id == owner_user_id)

    # Add basic filtering to reduce dataset
    # Use ILIKE for case-insensitive substring matching as a pre-filter
    query = query.where(
        or_(
            Tag.name.ilike(f"%{normalized_query}%"),
            Tag.slug.ilike(f"%{normalized_query}%"),
        )
    )

    result = await db.execute(query)
    tags = result.scalars().all()

    # Calculate fuzzy match scores
    suggestions = []
    for tag in tags:
        score = fuzzy_match_score(normalized_query, tag.name)

        if score >= min_score:
            suggestions.append(
                TagSuggestion(
                    id=tag.id,
                    name=tag.name,
                    slug=tag.slug,
                    usage_count=tag.usage_count,
                    match_score=score,
                )
            )

    # Sort by match score (descending), then by usage count (descending)
    suggestions.sort(key=lambda x: (-x.match_score, -x.usage_count))

    # Limit results
    suggestions = suggestions[:limit]

    return TagSuggestResponse(suggestions=suggestions, total=len(suggestions))


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TagResponse:
    """
    Get a single tag by ID.

    Args:
        tag_id: Tag UUID
        db: Database session

    Returns:
        Tag details

    Raises:
        HTTPException 404: If tag not found
    """
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found",
        )

    return TagResponse.model_validate(tag)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: uuid.UUID,
    request: TagUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TagResponse:
    """
    Update a tag's properties.

    Can update name, color, and description.
    If name is updated, a new slug is generated.

    Args:
        tag_id: Tag UUID
        request: Tag update request
        db: Database session

    Returns:
        Updated tag

    Raises:
        HTTPException 404: If tag not found
        HTTPException 409: If new name conflicts with existing tag
    """
    # Get existing tag
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found",
        )

    logger.info(f"Updating tag {tag_id}", extra={"tag_id": str(tag_id)})

    # Update fields if provided
    if request.name is not None:
        normalized_name = normalize_tag_name(request.name)
        new_slug = generate_slug(normalized_name)

        # Check for conflicts (excluding current tag)
        conflict_query = select(Tag).where(
            Tag.slug == new_slug, Tag.owner_user_id == tag.owner_user_id, Tag.id != tag_id
        )
        conflict_result = await db.execute(conflict_query)
        if conflict_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Tag with name '{normalized_name}' already exists",
            )

        tag.name = normalized_name
        tag.slug = new_slug

    if request.color is not None:
        tag.color = request.color

    if request.description is not None:
        tag.description = request.description

    await db.commit()
    await db.refresh(tag)

    return TagResponse.model_validate(tag)


@router.delete("/{tag_id}", response_model=TagDeleteResponse)
async def delete_tag(
    tag_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    cascade: bool = Query(default=True, description="Remove tag from all media assets"),
) -> TagDeleteResponse:
    """
    Delete a tag.

    By default, removes the tag from all associated media assets.
    If cascade=False, only deletes if no media assets are using the tag.

    Args:
        tag_id: Tag UUID
        db: Database session
        cascade: Whether to cascade delete (remove from all media assets)

    Returns:
        Deletion confirmation with count of affected relationships

    Raises:
        HTTPException 404: If tag not found
        HTTPException 409: If tag is in use and cascade=False
    """
    # Get tag
    query = select(Tag).where(Tag.id == tag_id)
    result = await db.execute(query)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found",
        )

    logger.info(f"Deleting tag {tag_id}", extra={"tag_id": str(tag_id), "cascade": cascade})

    # Check usage count
    if not cascade and tag.usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag is in use by {tag.usage_count} media asset(s). Use cascade=True to force deletion.",
        )

    # Delete media_asset_tags relationships (cascade will handle this automatically)
    # But we want to count them first
    cascade_count = tag.usage_count

    # Delete the tag (cascade will remove MediaAssetTag entries due to FK constraints)
    await db.delete(tag)
    await db.commit()

    return TagDeleteResponse(
        success=True,
        tag_id=tag_id,
        cascade_deleted=cascade_count,
        message=f"Tag '{tag.name}' deleted successfully. Removed from {cascade_count} media asset(s).",
    )


@router.post("/batch/tag", response_model=BulkTagResponse)
async def bulk_tag_media_assets(
    request: BulkTagRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_user_id: str = Query(default=settings.default_user_id, description="Owner user ID"),
) -> BulkTagResponse:
    """
    Bulk tag operations on media assets.

    Supports three operation modes:
    - ADD: Add tags to media assets (creates tags if they don't exist)
    - REMOVE: Remove tags from media assets
    - REPLACE: Replace all tags on media assets with the specified tags

    Args:
        request: Bulk tag request
        db: Database session
        owner_user_id: Owner user ID

    Returns:
        Result of bulk operation

    Raises:
        HTTPException 404: If any media assets not found
    """
    logger.info(
        "Bulk tag operation",
        extra={
            "operation": request.operation,
            "asset_count": len(request.media_asset_ids),
            "tag_count": len(request.tag_names),
            "owner_user_id": owner_user_id,
        },
    )

    errors = []
    tags_affected = 0

    try:
        # Verify all media assets exist
        assets_query = select(MediaAsset).where(
            MediaAsset.id.in_(request.media_asset_ids),
            MediaAsset.owner_user_id == owner_user_id,
            MediaAsset.is_deleted == False,  # noqa: E712
        )
        assets_result = await db.execute(assets_query)
        assets = assets_result.scalars().all()

        if len(assets) != len(request.media_asset_ids):
            found_ids = {asset.id for asset in assets}
            missing_ids = set(request.media_asset_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media assets not found: {[str(id) for id in missing_ids]}",
            )

        # Normalize and sanitize tag names
        tag_names = sanitize_tag_list(request.tag_names)

        if not tag_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid tag names provided after normalization",
            )

        # Get or create tags
        tags = []
        for tag_name in tag_names:
            slug = generate_slug(tag_name)

            # Try to find existing tag
            tag_query = select(Tag).where(Tag.slug == slug, Tag.owner_user_id == owner_user_id)
            tag_result = await db.execute(tag_query)
            tag = tag_result.scalar_one_or_none()

            if not tag:
                # Create new tag
                tag = Tag(
                    id=uuid.uuid4(),
                    name=tag_name,
                    slug=slug,
                    usage_count=0,
                    owner_user_id=owner_user_id,
                )
                db.add(tag)
                await db.flush()  # Ensure tag has an ID

            tags.append(tag)

        # Perform operation based on mode
        if request.operation == TagOperationMode.REPLACE:
            # Remove all existing tags from these assets
            delete_stmt = delete(MediaAssetTag).where(
                MediaAssetTag.media_asset_id.in_(request.media_asset_ids)
            )
            delete_result = await db.execute(delete_stmt)
            tags_affected += delete_result.rowcount or 0

        if request.operation in [TagOperationMode.ADD, TagOperationMode.REPLACE]:
            # Add tags to assets
            for asset in assets:
                for tag in tags:
                    # Check if relationship already exists (for ADD mode)
                    if request.operation == TagOperationMode.ADD:
                        existing_query = select(MediaAssetTag).where(
                            MediaAssetTag.media_asset_id == asset.id,
                            MediaAssetTag.tag_id == tag.id,
                        )
                        existing_result = await db.execute(existing_query)
                        if existing_result.scalar_one_or_none():
                            continue  # Skip if already exists

                    # Create relationship
                    media_asset_tag = MediaAssetTag(
                        id=uuid.uuid4(),
                        media_asset_id=asset.id,
                        tag_id=tag.id,
                    )
                    db.add(media_asset_tag)
                    tags_affected += 1

        elif request.operation == TagOperationMode.REMOVE:
            # Remove tags from assets
            tag_ids = [tag.id for tag in tags]
            delete_stmt = delete(MediaAssetTag).where(
                MediaAssetTag.media_asset_id.in_(request.media_asset_ids),
                MediaAssetTag.tag_id.in_(tag_ids),
            )
            delete_result = await db.execute(delete_stmt)
            tags_affected += delete_result.rowcount or 0

        # Update usage counts for all affected tags
        for tag in tags:
            count_query = select(func.count()).select_from(MediaAssetTag).where(MediaAssetTag.tag_id == tag.id)
            count_result = await db.execute(count_query)
            tag.usage_count = count_result.scalar() or 0

        await db.commit()

        logger.info(
            f"Bulk tag operation completed: {request.operation}",
            extra={
                "assets_processed": len(assets),
                "tags_affected": tags_affected,
            },
        )

        return BulkTagResponse(
            success=True,
            processed_count=len(assets),
            tags_affected=tags_affected,
            errors=errors,
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Bulk tag operation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk tag operation failed: {str(e)}",
        )
