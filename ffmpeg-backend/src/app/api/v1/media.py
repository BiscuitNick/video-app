"""Media upload and management endpoints."""

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from db.models.media_asset import MediaAsset, MediaAssetType, Tag
from db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from services.websocket import media_event_publisher
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from workers.s3_manager import s3_manager
from workers.worker import enqueue_job

from app.api.schemas.media import (
    BatchDeleteRequest,
    BatchDeleteResponse,
    BatchMoveRequest,
    BatchMoveResponse,
    BatchOperation,
    BatchTagRequest,
    BatchTagResponse,
    MediaAssetListResponse,
    MediaAssetResponse,
    MediaAssetTypeEnum,
    MediaAssetUpdate,
    MediaSortBy,
    MediaUploadRequest,
    MediaUploadResponse,
    SortOrder,
    TagResponse,
)
from app.config import get_settings
from app.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)
settings = get_settings()

# Alias for backward compatibility
MediaType = MediaAssetTypeEnum


def get_file_extension(filename: str) -> str:
    """Extract file extension from filename.

    Args:
        filename: The filename to extract extension from

    Returns:
        str: The file extension (without dot)
    """
    path = Path(filename)
    return path.suffix.lstrip(".").lower()


def validate_file_size(file_size_bytes: int, media_type: MediaType) -> int:
    """Validate file size against configured limits.

    Args:
        file_size_bytes: File size in bytes
        media_type: Type of media (video, audio, image)

    Returns:
        int: Maximum allowed file size in bytes

    Raises:
        HTTPException: If file size exceeds limit
    """
    # Get max size in MB based on media type
    if media_type == MediaType.VIDEO:
        max_size_mb = settings.max_video_upload_size_mb
    elif media_type == MediaType.AUDIO:
        max_size_mb = settings.max_audio_upload_size_mb
    elif media_type == MediaType.IMAGE:
        max_size_mb = settings.max_image_upload_size_mb
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type: {media_type}",
        )

    max_size_bytes = max_size_mb * 1024 * 1024

    if file_size_bytes > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({file_size_bytes} bytes) exceeds maximum allowed size "
            f"for {media_type.value} ({max_size_mb} MB)",
        )

    return max_size_bytes


def validate_file_format(filename: str, media_type: MediaType) -> None:
    """Validate file format against supported formats.

    Args:
        filename: The filename to validate
        media_type: Type of media (video, audio, image)

    Raises:
        HTTPException: If file format is not supported
    """
    extension = get_file_extension(filename)

    # Get supported formats based on media type
    if media_type == MediaType.VIDEO:
        supported_formats = settings.supported_video_formats
    elif media_type == MediaType.AUDIO:
        supported_formats = settings.supported_audio_formats
    elif media_type == MediaType.IMAGE:
        supported_formats = settings.supported_image_formats
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type: {media_type}",
        )

    if extension not in supported_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '.{extension}' for {media_type.value}. "
            f"Supported formats: {', '.join(supported_formats)}",
        )


def construct_s3_key(
    user_id: str, media_type: MediaType, media_asset_id: str, filename: str
) -> str:
    """Construct S3 key for media upload.

    Format: 'user-uploads/{user_id}/{media_type}s/{uuid}.{ext}'

    Args:
        user_id: User ID
        media_type: Type of media (video, audio, image)
        media_asset_id: Unique media asset ID (UUID)
        filename: Original filename

    Returns:
        str: S3 key path
    """
    extension = get_file_extension(filename)
    # Pluralize media type (video -> videos, audio -> audios, image -> images)
    media_folder = f"{media_type.value}s"
    s3_key = f"user-uploads/{user_id}/{media_folder}/{media_asset_id}.{extension}"
    return s3_key


@router.post("/upload", response_model=MediaUploadResponse)
async def create_upload_url(request: MediaUploadRequest) -> MediaUploadResponse:
    """Generate presigned S3 URL for media upload.

    This endpoint:
    1. Validates file size against configured limits
    2. Validates file format is supported
    3. Generates a unique media_asset_id (UUID)
    4. Constructs S3 key path
    5. Generates presigned S3 URL for PUT operation
    6. Creates MediaAsset database record with status='pending' (TODO: requires Task 13.1)
    7. Returns upload URL and asset information

    Note: The actual file upload is performed directly to S3 by the client using
    the presigned URL. After upload completes, the client should call a separate
    endpoint to confirm upload and trigger any processing.

    Args:
        request: Media upload request containing file details

    Returns:
        MediaUploadResponse: Upload URL and asset information

    Raises:
        HTTPException: If validation fails or URL generation fails
    """
    try:
        # Validate file size
        max_size_bytes = validate_file_size(request.file_size_bytes, request.media_type)

        # Validate file format
        validate_file_format(request.filename, request.media_type)

        # Generate unique media asset ID
        media_asset_id = str(uuid.uuid4())

        # Construct S3 key
        s3_key = construct_s3_key(
            user_id=settings.default_user_id,
            media_type=request.media_type,
            media_asset_id=media_asset_id,
            filename=request.filename,
        )

        logger.info(
            f"Generating presigned upload URL for {request.media_type.value}",
            extra={
                "media_asset_id": media_asset_id,
                "filename": request.filename,
                "file_size_bytes": request.file_size_bytes,
                "s3_key": s3_key,
            },
        )

        # Generate presigned URL for PUT operation
        # Note: We need to use generate_presigned_post or modify generate_presigned_url
        # to support PUT operations
        try:
            presigned_url = s3_manager.s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": s3_manager.bucket_name,
                    "Key": s3_key,
                    "ContentType": request.content_type,
                },
                ExpiresIn=settings.presigned_url_expiration,
            )
        except Exception as e:
            logger.error(
                f"Failed to generate presigned URL: {e}",
                extra={"media_asset_id": media_asset_id, "s3_key": s3_key},
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate upload URL",
            ) from e

        # Calculate expiration time
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.presigned_url_expiration
        )

        # TODO: Create MediaAsset database record with status='pending'
        # This requires Task 13.1 (database models) to be completed
        # Example:
        # async with get_db_session() as session:
        #     media_asset = MediaAsset(
        #         media_asset_id=media_asset_id,
        #         user_id=settings.default_user_id,
        #         filename=request.filename,
        #         content_type=request.content_type,
        #         file_size_bytes=request.file_size_bytes,
        #         media_type=request.media_type,
        #         status=MediaStatus.PENDING,
        #         s3_key=s3_key,
        #         folder_id=request.folder_id,
        #     )
        #     session.add(media_asset)
        #     await session.commit()

        logger.info(
            f"Presigned upload URL generated successfully",
            extra={
                "media_asset_id": media_asset_id,
                "s3_key": s3_key,
                "expires_at": expires_at.isoformat(),
            },
        )

        return MediaUploadResponse(
            media_asset_id=media_asset_id,
            upload_url=presigned_url,
            s3_key=s3_key,
            expires_at=expires_at,
            max_file_size_bytes=max_size_bytes,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (validation errors, etc.)
        raise
    except Exception as e:
        logger.exception(
            f"Unexpected error in create_upload_url: {e}",
            extra={
                "filename": request.filename,
                "media_type": request.media_type,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while creating upload URL",
        ) from e


# ============================================================================
# Helper functions for presigned URLs
# ============================================================================


async def add_presigned_urls_to_media_asset(media_asset: MediaAsset) -> None:
    """Add presigned URLs to media asset for temporary access.

    Args:
        media_asset: MediaAsset instance to add presigned URLs to
    """
    if media_asset.s3_key:
        try:
            media_asset.url = s3_manager.generate_presigned_url(
                s3_key=media_asset.s3_key,
                expiration=settings.presigned_url_expiration,
            )
        except Exception as e:
            logger.warning(f"Failed to generate presigned URL for {media_asset.id}: {e}")
            media_asset.url = None

    if media_asset.thumbnail_s3_key:
        try:
            media_asset.thumbnail_url = s3_manager.generate_presigned_url(
                s3_key=media_asset.thumbnail_s3_key,
                expiration=settings.presigned_url_expiration,
            )
        except Exception as e:
            logger.warning(f"Failed to generate thumbnail URL for {media_asset.id}: {e}")
            media_asset.thumbnail_url = None


# ============================================================================
# Media Asset CRUD Endpoints
# ============================================================================


@router.get("/", response_model=MediaAssetListResponse)
async def list_media_assets(
    db: Annotated[AsyncSession, Depends(get_db)],
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit (max 100)"),
    type: MediaAssetTypeEnum | None = Query(None, description="Filter by media type"),
    folder_id: uuid.UUID | None = Query(None, description="Filter by folder ID"),
    tags: str | None = Query(None, description="Comma-separated list of tag names"),
    sort_by: MediaSortBy = Query(MediaSortBy.CREATED_AT, description="Sort field"),
    sort_order: SortOrder = Query(SortOrder.DESC, description="Sort order"),
    search: str | None = Query(None, description="Search in filename"),
) -> MediaAssetListResponse:
    """List media assets with pagination, filtering, and sorting.

    Args:
        db: Database session
        offset: Pagination offset
        limit: Pagination limit (max 100)
        type: Optional media type filter
        folder_id: Optional folder ID filter
        tags: Optional comma-separated tag names filter
        sort_by: Field to sort by
        sort_order: Sort order (asc/desc)
        search: Optional filename search term

    Returns:
        MediaAssetListResponse: Paginated list of media assets with total count
    """
    logger.info(
        "Listing media assets",
        extra={
            "offset": offset,
            "limit": limit,
            "type": type,
            "folder_id": folder_id,
            "tags": tags,
            "sort_by": sort_by,
            "search": search,
        },
    )

    # Build base query
    query = select(MediaAsset).where(MediaAsset.is_deleted == False)

    # Apply filters
    if type:
        query = query.where(MediaAsset.type == type.value)

    if folder_id:
        query = query.where(MediaAsset.folder_id == folder_id)

    if search:
        query = query.where(MediaAsset.filename.ilike(f"%{search}%"))

    # Apply tag filter if provided
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
        if tag_list:
            # Join with tags and filter
            query = (
                query.join(MediaAsset.tags)
                .where(Tag.name.in_(tag_list))
                .group_by(MediaAsset.id)
                .having(func.count(Tag.id) == len(tag_list))
            )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply sorting
    sort_column = {
        MediaSortBy.CREATED_AT: MediaAsset.created_at,
        MediaSortBy.FILENAME: MediaAsset.filename,
        MediaSortBy.FILE_SIZE: MediaAsset.file_size_bytes,
    }[sort_by]

    if sort_order == SortOrder.DESC:
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    query = query.offset(offset).limit(limit)

    # Load relationships
    query = query.options(selectinload(MediaAsset.tags), selectinload(MediaAsset.folder))

    # Execute query
    result = await db.execute(query)
    media_assets = result.scalars().all()

    # Add presigned URLs to each asset
    for media_asset in media_assets:
        await add_presigned_urls_to_media_asset(media_asset)

    logger.info(
        f"Retrieved {len(media_assets)} media assets (total: {total})",
        extra={"count": len(media_assets), "total": total, "offset": offset, "limit": limit},
    )

    return MediaAssetListResponse(
        media_assets=[MediaAssetResponse.model_validate(asset) for asset in media_assets],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{media_asset_id}", response_model=MediaAssetResponse)
async def get_media_asset(
    media_asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaAssetResponse:
    """Get a single media asset by ID with presigned URLs.

    Args:
        media_asset_id: Media asset UUID
        db: Database session

    Returns:
        MediaAssetResponse: Media asset with presigned URLs

    Raises:
        HTTPException: 404 if media asset not found
    """
    logger.info(f"Fetching media asset {media_asset_id}")

    # Query with relationships loaded
    query = (
        select(MediaAsset)
        .where(MediaAsset.id == media_asset_id, MediaAsset.is_deleted == False)
        .options(selectinload(MediaAsset.tags), selectinload(MediaAsset.folder))
    )

    result = await db.execute(query)
    media_asset = result.scalar_one_or_none()

    if not media_asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media asset {media_asset_id} not found",
        )

    # Add presigned URLs
    await add_presigned_urls_to_media_asset(media_asset)

    logger.info(f"Retrieved media asset {media_asset_id}")

    return MediaAssetResponse.model_validate(media_asset)


@router.patch("/{media_asset_id}", response_model=MediaAssetResponse)
async def update_media_asset(
    media_asset_id: uuid.UUID,
    update_data: MediaAssetUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaAssetResponse:
    """Update media asset metadata (filename, tags, folder_id).

    Args:
        media_asset_id: Media asset UUID
        update_data: Fields to update
        db: Database session

    Returns:
        MediaAssetResponse: Updated media asset

    Raises:
        HTTPException: 404 if media asset not found
    """
    logger.info(f"Updating media asset {media_asset_id}", extra={"update_data": update_data})

    # Fetch media asset
    query = (
        select(MediaAsset)
        .where(MediaAsset.id == media_asset_id, MediaAsset.is_deleted == False)
        .options(selectinload(MediaAsset.tags), selectinload(MediaAsset.folder))
    )

    result = await db.execute(query)
    media_asset = result.scalar_one_or_none()

    if not media_asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media asset {media_asset_id} not found",
        )

    # Update filename if provided
    if update_data.filename is not None:
        media_asset.filename = update_data.filename

    # Update folder_id if provided
    if update_data.folder_id is not None:
        media_asset.folder_id = update_data.folder_id

    # Update tags if provided
    if update_data.tags is not None:
        # Clear existing tags
        media_asset.tags = []

        # Add new tags (create if they don't exist)
        for tag_name in update_data.tags:
            tag_slug = tag_name.lower().replace(" ", "-")

            # Try to find existing tag
            tag_query = select(Tag).where(Tag.slug == tag_slug)
            tag_result = await db.execute(tag_query)
            tag = tag_result.scalar_one_or_none()

            if not tag:
                # Create new tag
                tag = Tag(
                    name=tag_name,
                    slug=tag_slug,
                    owner_user_id=settings.default_user_id,
                    usage_count=0,
                )
                db.add(tag)

            # Increment usage count
            tag.usage_count += 1
            media_asset.tags.append(tag)

    await db.commit()
    await db.refresh(media_asset)

    # Add presigned URLs
    await add_presigned_urls_to_media_asset(media_asset)

    # Publish media.updated event
    update_event_data = {}
    if update_data.filename is not None:
        update_event_data["filename"] = update_data.filename
    if update_data.tags is not None:
        update_event_data["tags"] = update_data.tags
    if update_data.folder_id is not None:
        update_event_data["folder_id"] = str(update_data.folder_id)

    await media_event_publisher.publish_media_updated(
        media_asset_id=media_asset.id,
        folder_id=media_asset.folder_id,
        user_id=settings.default_user_id,
        data=update_event_data,
    )

    logger.info(f"Updated media asset {media_asset_id}")

    return MediaAssetResponse.model_validate(media_asset)


@router.delete("/{media_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_asset(
    media_asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft delete a media asset (sets is_deleted=true).

    Args:
        media_asset_id: Media asset UUID
        db: Database session

    Raises:
        HTTPException: 404 if media asset not found
    """
    logger.info(f"Deleting media asset {media_asset_id}")

    # Fetch media asset
    query = select(MediaAsset).where(MediaAsset.id == media_asset_id, MediaAsset.is_deleted == False)

    result = await db.execute(query)
    media_asset = result.scalar_one_or_none()

    if not media_asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media asset {media_asset_id} not found",
        )

    # Get folder_id before deleting
    folder_id = media_asset.folder_id

    # Soft delete
    media_asset.is_deleted = True
    await db.commit()

    # Publish media.deleted event
    await media_event_publisher.publish_media_deleted(
        media_asset_ids=[media_asset_id],
        folder_id=folder_id,
        user_id=settings.default_user_id,
    )

    logger.info(f"Soft deleted media asset {media_asset_id}")


# ============================================================================
# Batch Operations
# ============================================================================


@router.post("/batch/delete", response_model=BatchDeleteResponse)
async def batch_delete_media_assets(
    request: BatchDeleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BatchDeleteResponse:
    """Batch soft delete multiple media assets.

    Args:
        request: Batch delete request with media asset IDs
        db: Database session

    Returns:
        BatchDeleteResponse: Count and IDs of deleted assets
    """
    logger.info(f"Batch deleting {len(request.media_asset_ids)} media assets")

    # Fetch media assets
    query = select(MediaAsset).where(
        MediaAsset.id.in_(request.media_asset_ids), MediaAsset.is_deleted == False
    )

    result = await db.execute(query)
    media_assets = result.scalars().all()

    deleted_ids = []
    # Group by folder for event publishing
    folder_groups: dict[uuid.UUID | None, list[uuid.UUID]] = {}

    for media_asset in media_assets:
        media_asset.is_deleted = True
        deleted_ids.append(media_asset.id)

        # Group by folder
        if media_asset.folder_id not in folder_groups:
            folder_groups[media_asset.folder_id] = []
        folder_groups[media_asset.folder_id].append(media_asset.id)

    await db.commit()

    # Publish batch media.deleted events (grouped by folder)
    for folder_id, asset_ids in folder_groups.items():
        await media_event_publisher.publish_media_deleted(
            media_asset_ids=asset_ids,
            folder_id=folder_id,
            user_id=settings.default_user_id,
            batch=True,
        )

    logger.info(f"Batch deleted {len(deleted_ids)} media assets")

    return BatchDeleteResponse(deleted_count=len(deleted_ids), deleted_ids=deleted_ids)


@router.post("/batch/tag", response_model=BatchTagResponse)
async def batch_tag_media_assets(
    request: BatchTagRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BatchTagResponse:
    """Batch tag operation on multiple media assets.

    Supports add, remove, and set operations:
    - add: Add tags to existing tags
    - remove: Remove specific tags
    - set: Replace all tags with provided tags

    Args:
        request: Batch tag request with operation and tags
        db: Database session

    Returns:
        BatchTagResponse: Count and IDs of updated assets
    """
    logger.info(
        f"Batch tag operation '{request.operation}' on {len(request.media_asset_ids)} assets"
    )

    # Fetch media assets
    query = (
        select(MediaAsset)
        .where(MediaAsset.id.in_(request.media_asset_ids), MediaAsset.is_deleted == False)
        .options(selectinload(MediaAsset.tags))
    )

    result = await db.execute(query)
    media_assets = result.scalars().all()

    # Get or create tags
    tags_to_apply = []
    for tag_name in request.tags:
        tag_slug = tag_name.lower().replace(" ", "-")

        tag_query = select(Tag).where(Tag.slug == tag_slug)
        tag_result = await db.execute(tag_query)
        tag = tag_result.scalar_one_or_none()

        if not tag:
            tag = Tag(
                name=tag_name,
                slug=tag_slug,
                owner_user_id=settings.default_user_id,
                usage_count=0,
            )
            db.add(tag)

        tags_to_apply.append(tag)

    updated_ids = []
    for media_asset in media_assets:
        if request.operation == BatchOperation.ADD:
            # Add tags (avoid duplicates)
            existing_tag_ids = {tag.id for tag in media_asset.tags}
            for tag in tags_to_apply:
                if tag.id not in existing_tag_ids:
                    media_asset.tags.append(tag)
                    tag.usage_count += 1

        elif request.operation == BatchOperation.REMOVE:
            # Remove specific tags
            tags_to_remove = {tag.id for tag in tags_to_apply}
            media_asset.tags = [tag for tag in media_asset.tags if tag.id not in tags_to_remove]
            for tag in tags_to_apply:
                tag.usage_count = max(0, tag.usage_count - 1)

        elif request.operation == BatchOperation.SET:
            # Replace all tags
            # Decrement old tags
            for tag in media_asset.tags:
                tag.usage_count = max(0, tag.usage_count - 1)

            # Set new tags
            media_asset.tags = tags_to_apply[:]
            for tag in tags_to_apply:
                tag.usage_count += 1

        updated_ids.append(media_asset.id)

    await db.commit()

    # Publish batch media.updated events for each updated asset
    for media_asset in media_assets:
        await media_event_publisher.publish_media_updated(
            media_asset_id=media_asset.id,
            folder_id=media_asset.folder_id,
            user_id=settings.default_user_id,
            data={"tags": [tag.name for tag in media_asset.tags]},
            batch=True,
        )

    logger.info(f"Batch tag operation completed on {len(updated_ids)} assets")

    return BatchTagResponse(updated_count=len(updated_ids), updated_ids=updated_ids)


@router.post("/batch/move", response_model=BatchMoveResponse)
async def batch_move_media_assets(
    request: BatchMoveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BatchMoveResponse:
    """Batch move media assets to a folder.

    Args:
        request: Batch move request with target folder ID
        db: Database session

    Returns:
        BatchMoveResponse: Count and IDs of moved assets
    """
    logger.info(
        f"Batch moving {len(request.media_asset_ids)} assets to folder {request.folder_id}"
    )

    # Fetch media assets
    query = select(MediaAsset).where(
        MediaAsset.id.in_(request.media_asset_ids), MediaAsset.is_deleted == False
    )

    result = await db.execute(query)
    media_assets = result.scalars().all()

    moved_ids = []
    for media_asset in media_assets:
        media_asset.folder_id = request.folder_id
        moved_ids.append(media_asset.id)

    await db.commit()

    # Publish batch media.updated events for each moved asset
    for media_asset in media_assets:
        await media_event_publisher.publish_media_updated(
            media_asset_id=media_asset.id,
            folder_id=media_asset.folder_id,
            user_id=settings.default_user_id,
            data={"folder_id": str(request.folder_id) if request.folder_id else None},
            batch=True,
        )

    logger.info(f"Batch moved {len(moved_ids)} assets")

    return BatchMoveResponse(moved_count=len(moved_ids), moved_ids=moved_ids)


# ============================================================================
# Thumbnail Generation
# ============================================================================


@router.post("/{media_asset_id}/thumbnail")
async def generate_thumbnail(
    media_asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Generate or regenerate thumbnail for a media asset.

    This endpoint enqueues an asynchronous job to generate thumbnails
    in multiple sizes (small, medium, large) for the specified media asset.

    For videos:
    - Uses FFmpeg to extract a frame
    - Employs smart frame selection to avoid black/blank frames
    - Analyzes histogram to select the best representative frame

    For images:
    - Uses Pillow to create resized thumbnails
    - Maintains aspect ratio with padding

    Thumbnails are uploaded to S3 at: thumbnails/{asset_id}/thumb_{size}.jpg

    Args:
        media_asset_id: Media asset UUID
        db: Database session

    Returns:
        dict: Job information including job_id

    Raises:
        HTTPException: 404 if media asset not found
        HTTPException: 400 if thumbnail generation is disabled
        HTTPException: 400 if media type not supported for thumbnails
    """
    logger.info(f"Generating thumbnail for media asset {media_asset_id}")

    # Check if thumbnail generation is enabled
    if not settings.enable_thumbnail_generation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thumbnail generation is currently disabled",
        )

    # Fetch media asset
    query = select(MediaAsset).where(MediaAsset.id == media_asset_id, MediaAsset.is_deleted == False)

    result = await db.execute(query)
    media_asset = result.scalar_one_or_none()

    if not media_asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media asset {media_asset_id} not found",
        )

    # Check if media type supports thumbnails
    if media_asset.type not in [MediaAssetType.VIDEO, MediaAssetType.IMAGE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Thumbnail generation not supported for media type: {media_asset.type.value}",
        )

    # Check if asset has S3 key
    if not media_asset.s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Media asset {media_asset_id} has no S3 key",
        )

    logger.info(
        f"Enqueuing thumbnail generation job for {media_asset.type.value} asset",
        extra={
            "media_asset_id": str(media_asset_id),
            "type": media_asset.type.value,
            "s3_key": media_asset.s3_key,
        },
    )

    # Enqueue thumbnail generation job
    from workers.thumbnail_job import generate_thumbnail_job

    job = enqueue_job(
        func=generate_thumbnail_job,
        kwargs={
            "job_id": str(uuid.uuid4()),
            "media_asset_id": str(media_asset_id),
        },
        queue_name="default",
        job_timeout=settings.thumbnail_generation_timeout_seconds + 30,  # Add buffer
        description=f"Generate thumbnail for media asset {media_asset_id}",
    )

    logger.info(
        f"Enqueued thumbnail generation job",
        extra={
            "job_id": job.id,
            "media_asset_id": str(media_asset_id),
        },
    )

    return {
        "job_id": job.id,
        "media_asset_id": str(media_asset_id),
        "status": "queued",
        "message": f"Thumbnail generation job enqueued for {media_asset.type.value} asset",
    }
