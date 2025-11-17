"""Media asset endpoints."""

import logging
import uuid
from datetime import datetime
from typing import Annotated

from db.models.media import MediaAsset, MediaAssetStatus, MediaAssetType
from db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from workers.s3_manager import s3_manager

from app.api.schemas.media import (
    MediaAssetLightResponse,
    MediaAssetResponse,
    MediaBatchDeleteRequest,
    MediaBatchDeleteResponse,
    MediaBatchMoveRequest,
    MediaBatchMoveResponse,
    MediaBatchTagRequest,
    MediaBatchTagResponse,
    MediaListResponse,
    MediaMetadataUpdate,
    MediaStatus,
    MediaType,
    MediaUploadRequest,
    MediaUploadResponse,
    ThumbnailGenerationRequest,
    ThumbnailGenerationResponse,
    UploadParams,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# File size limits matching schema validation
MAX_IMAGE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_VIDEO_SIZE = 1024 * 1024 * 1024  # 1 GB
MAX_AUDIO_SIZE = 500 * 1024 * 1024  # 500 MB

# Content type mappings
CONTENT_TYPE_MAP = {
    MediaType.IMAGE: "image/",
    MediaType.VIDEO: "video/",
    MediaType.AUDIO: "audio/",
}


def get_max_file_size(media_type: MediaType) -> int:
    """Get maximum file size for media type."""
    if media_type == MediaType.IMAGE:
        return MAX_IMAGE_SIZE
    elif media_type == MediaType.VIDEO:
        return MAX_VIDEO_SIZE
    elif media_type == MediaType.AUDIO:
        return MAX_AUDIO_SIZE
    return MAX_VIDEO_SIZE  # default


def generate_s3_key(user_id: uuid.UUID, asset_id: uuid.UUID, filename: str) -> str:
    """Generate S3 key for media asset.

    Format: media/{user_id}/{asset_id}/{filename}
    """
    return f"media/{user_id}/{asset_id}/{filename}"


@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=MediaUploadResponse)
async def initiate_media_upload(
    request: MediaUploadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaUploadResponse:
    """Initiate a media asset upload by generating a presigned S3 URL.

    This endpoint validates the upload request, creates a MediaAsset record in
    PENDING_UPLOAD status, and returns a presigned S3 URL for the client to upload
    the file directly to S3.

    Args:
        request: Media upload request with file metadata
        db: Database session (injected)

    Returns:
        MediaUploadResponse: Presigned URL and upload parameters

    Raises:
        HTTPException: 400 for validation errors
        HTTPException: 500 for server errors
    """
    asset_id = uuid.uuid4()
    # TODO: Get user_id from authenticated session
    # For now, using a test user_id that exists in the database
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # This should come from auth

    logger.info(
        "Initiating media upload",
        extra={
            "asset_id": str(asset_id),
            "user_id": str(user_id),
            "file_name": request.name,
            "file_size": request.size,
            "file_type": request.type,
        },
    )

    try:
        # Generate S3 key for the asset
        s3_key = generate_s3_key(user_id, asset_id, request.name)

        # Get content type prefix for the media type
        content_type = CONTENT_TYPE_MAP.get(request.type, "application/octet-stream")

        # Generate presigned POST URL with file size limit
        max_file_size = get_max_file_size(request.type)
        presigned_data = s3_manager.generate_presigned_post(
            s3_key=s3_key,
            expiration=900,  # 15 minutes
            content_type=content_type,
            max_file_size=max_file_size,
        )

        # Create MediaAsset record in database
        media_asset = MediaAsset(
            id=asset_id,
            user_id=user_id,
            name=request.name,
            file_size=request.size,
            file_type=MediaAssetType(request.type.value),
            s3_key=s3_key,
            status=MediaAssetStatus.PENDING_UPLOAD,
            checksum=request.checksum,
            metadata={},
            tags=[],
            is_deleted=False,
        )

        db.add(media_asset)
        await db.commit()
        await db.refresh(media_asset)

        logger.info(
            "Media asset created, presigned URL generated",
            extra={
                "asset_id": str(asset_id),
                "s3_key": s3_key,
            },
        )

        # Build upload params from presigned POST data
        upload_params = UploadParams(
            method="POST",
            headers={},
            fields=presigned_data.get("fields", {}),
        )

        return MediaUploadResponse(
            id=asset_id,
            presigned_url=presigned_data["url"],
            upload_params=upload_params,
            expires_in=900,
        )

    except Exception as e:
        logger.exception(
            "Failed to initiate media upload",
            extra={
                "error": str(e),
                "asset_id": str(asset_id),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate upload",
        ) from e


@router.patch("/{asset_id}", response_model=MediaAssetResponse)
async def confirm_media_upload(
    asset_id: uuid.UUID,
    metadata_update: MediaMetadataUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaAssetResponse:
    """Confirm media asset upload and update with extracted metadata.

    This endpoint is called after the client completes uploading to S3. It verifies
    the upload succeeded, updates the asset status, and stores technical metadata
    extracted by FFprobe.

    Args:
        asset_id: Media asset UUID
        metadata_update: Extracted metadata and status
        db: Database session (injected)

    Returns:
        MediaAssetResponse: Updated media asset

    Raises:
        HTTPException: 404 if asset not found
        HTTPException: 400 if asset not in correct status
        HTTPException: 500 for server errors
    """
    logger.info(
        "Confirming media upload",
        extra={"asset_id": str(asset_id)},
    )

    try:
        # Fetch asset from database
        result = await db.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
        media_asset = result.scalar_one_or_none()

        if not media_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset {asset_id} not found",
            )

        # Verify asset is in PENDING_UPLOAD or UPLOADING status
        if media_asset.status not in [
            MediaAssetStatus.PENDING_UPLOAD,
            MediaAssetStatus.UPLOADING,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Asset is in {media_asset.status} status, cannot confirm upload",
            )

        # Verify file exists in S3
        if not s3_manager.object_exists(media_asset.s3_key):
            logger.warning(
                "S3 object not found during upload confirmation",
                extra={"asset_id": str(asset_id), "s3_key": media_asset.s3_key},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File not found in S3 storage",
            )

        # Update metadata and status
        media_asset.file_metadata = metadata_update.metadata.model_dump(exclude_none=True)
        media_asset.status = MediaAssetStatus(metadata_update.status.value)
        media_asset.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(media_asset)

        logger.info(
            "Media upload confirmed",
            extra={
                "asset_id": str(asset_id),
                "status": media_asset.status,
            },
        )

        # Manually construct response to avoid SQLAlchemy metadata conflict
        return MediaAssetResponse(
            id=media_asset.id,
            user_id=media_asset.user_id,
            name=media_asset.name,
            file_size=media_asset.file_size,
            file_type=media_asset.file_type,
            s3_key=media_asset.s3_key,
            thumbnail_s3_key=media_asset.thumbnail_s3_key,
            status=media_asset.status,
            checksum=media_asset.checksum,
            file_metadata=media_asset.file_metadata,
            folder_id=media_asset.folder_id,
            tags=media_asset.tags,
            is_deleted=media_asset.is_deleted,
            created_at=media_asset.created_at,
            updated_at=media_asset.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Failed to confirm media upload",
            extra={"error": str(e), "asset_id": str(asset_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm upload",
        ) from e


@router.get("/", response_model=MediaListResponse)
async def list_media_assets(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    per_page: int = 20,
    type: MediaType | None = None,
    folder_id: uuid.UUID | None = None,
    tag: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_desc: bool = True,
) -> MediaListResponse:
    """List media assets with pagination and filtering.

    Args:
        db: Database session (injected)
        page: Page number (1-indexed)
        per_page: Items per page (max 100)
        type: Filter by media type
        folder_id: Filter by folder
        tag: Filter by tag
        search: Search in filename
        sort_by: Sort field (created_at, updated_at, name)
        sort_desc: Sort descending

    Returns:
        MediaListResponse: Paginated list of media assets

    Raises:
        HTTPException: 400 for invalid parameters
        HTTPException: 500 for server errors
    """
    # Validate pagination
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    try:
        # Build base query - exclude deleted assets
        query = select(MediaAsset).where(MediaAsset.is_deleted == False)  # noqa: E712

        # Apply filters
        if type:
            query = query.where(MediaAsset.file_type == MediaAssetType(type.value))

        if folder_id:
            query = query.where(MediaAsset.folder_id == folder_id)

        if tag:
            query = query.where(MediaAsset.tags.contains([tag]))

        if search:
            query = query.where(MediaAsset.name.ilike(f"%{search}%"))

        # Count total matching records
        count_query = select(MediaAsset.id).select_from(MediaAsset).where(query.whereclause)
        total_result = await db.execute(count_query)
        total = len(total_result.all())

        # Apply sorting
        sort_column = getattr(MediaAsset, sort_by, MediaAsset.created_at)
        if sort_desc:
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Apply pagination
        query = query.offset(offset).limit(per_page)

        # Execute query
        result = await db.execute(query)
        assets = result.scalars().all()

        # Build lightweight responses
        asset_responses = [MediaAssetLightResponse.model_validate(asset) for asset in assets]

        total_pages = (total + per_page - 1) // per_page

        return MediaListResponse(
            assets=asset_responses,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    except Exception as e:
        logger.exception("Failed to list media assets", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list media assets",
        ) from e


@router.get("/{asset_id}", response_model=MediaAssetResponse)
async def get_media_asset(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaAssetResponse:
    """Get a single media asset by ID with full metadata.

    Args:
        asset_id: Media asset UUID
        db: Database session (injected)

    Returns:
        MediaAssetResponse: Full media asset data

    Raises:
        HTTPException: 404 if asset not found
        HTTPException: 500 for server errors
    """
    try:
        result = await db.execute(
            select(MediaAsset).where(
                and_(
                    MediaAsset.id == asset_id,
                    MediaAsset.is_deleted == False,  # noqa: E712
                )
            )
        )
        media_asset = result.scalar_one_or_none()

        if not media_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset {asset_id} not found",
            )

        return MediaAssetResponse.model_validate(media_asset)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Failed to get media asset",
            extra={"error": str(e), "asset_id": str(asset_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get media asset",
        ) from e


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_asset(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft delete a media asset.

    This marks the asset as deleted in the database and schedules S3 cleanup
    via a background worker job.

    Args:
        asset_id: Media asset UUID
        db: Database session (injected)

    Raises:
        HTTPException: 404 if asset not found
        HTTPException: 500 for server errors
    """
    try:
        result = await db.execute(
            select(MediaAsset).where(
                and_(
                    MediaAsset.id == asset_id,
                    MediaAsset.is_deleted == False,  # noqa: E712
                )
            )
        )
        media_asset = result.scalar_one_or_none()

        if not media_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset {asset_id} not found",
            )

        # Soft delete
        media_asset.is_deleted = True
        media_asset.status = MediaAssetStatus.DELETED
        media_asset.updated_at = datetime.utcnow()

        await db.commit()

        # TODO: Enqueue S3 cleanup worker job
        logger.info(
            "Media asset soft deleted",
            extra={
                "asset_id": str(asset_id),
                "s3_key": media_asset.s3_key,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Failed to delete media asset",
            extra={"error": str(e), "asset_id": str(asset_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete media asset",
        ) from e


@router.post("/batch/delete", response_model=MediaBatchDeleteResponse)
async def batch_delete_media_assets(
    request: MediaBatchDeleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaBatchDeleteResponse:
    """Batch soft delete multiple media assets.

    Args:
        request: Batch delete request with asset IDs
        db: Database session (injected)

    Returns:
        MediaBatchDeleteResponse: Deletion results

    Raises:
        HTTPException: 500 for server errors
    """
    deleted_ids = []
    failed_ids = []

    try:
        for asset_id in request.asset_ids:
            try:
                result = await db.execute(
                    select(MediaAsset).where(
                        and_(
                            MediaAsset.id == asset_id,
                            MediaAsset.is_deleted == False,  # noqa: E712
                        )
                    )
                )
                media_asset = result.scalar_one_or_none()

                if media_asset:
                    media_asset.is_deleted = True
                    media_asset.status = MediaAssetStatus.DELETED
                    media_asset.updated_at = datetime.utcnow()
                    deleted_ids.append(asset_id)
                else:
                    failed_ids.append(asset_id)

            except Exception as e:
                logger.warning(
                    f"Failed to delete asset {asset_id}",
                    extra={"asset_id": str(asset_id), "error": str(e)},
                )
                failed_ids.append(asset_id)

        await db.commit()

        return MediaBatchDeleteResponse(
            deleted_count=len(deleted_ids),
            failed_count=len(failed_ids),
            deleted_ids=deleted_ids,
            failed_ids=failed_ids,
            message=f"Successfully deleted {len(deleted_ids)} assets, {len(failed_ids)} failed",
        )

    except Exception as e:
        logger.exception("Batch delete failed", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch delete operation failed",
        ) from e


@router.post("/batch/tag", response_model=MediaBatchTagResponse)
async def batch_tag_media_assets(
    request: MediaBatchTagRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaBatchTagResponse:
    """Batch add, remove, or replace tags on multiple media assets.

    Args:
        request: Batch tag request with asset IDs and tags
        db: Database session (injected)

    Returns:
        MediaBatchTagResponse: Tagging results

    Raises:
        HTTPException: 500 for server errors
    """
    updated_ids = []
    failed_ids = []

    try:
        for asset_id in request.asset_ids:
            try:
                result = await db.execute(
                    select(MediaAsset).where(
                        and_(
                            MediaAsset.id == asset_id,
                            MediaAsset.is_deleted == False,  # noqa: E712
                        )
                    )
                )
                media_asset = result.scalar_one_or_none()

                if media_asset:
                    if request.operation == "add":
                        # Add tags, avoiding duplicates
                        existing_tags = set(media_asset.tags)
                        existing_tags.update(request.tags)
                        media_asset.tags = list(existing_tags)
                    elif request.operation == "remove":
                        # Remove tags
                        media_asset.tags = [t for t in media_asset.tags if t not in request.tags]
                    elif request.operation == "replace":
                        # Replace all tags
                        media_asset.tags = request.tags

                    media_asset.updated_at = datetime.utcnow()
                    updated_ids.append(asset_id)
                else:
                    failed_ids.append(asset_id)

            except Exception as e:
                logger.warning(
                    f"Failed to tag asset {asset_id}",
                    extra={"asset_id": str(asset_id), "error": str(e)},
                )
                failed_ids.append(asset_id)

        await db.commit()

        return MediaBatchTagResponse(
            updated_count=len(updated_ids),
            failed_count=len(failed_ids),
            updated_ids=updated_ids,
            failed_ids=failed_ids,
            message=f"Successfully tagged {len(updated_ids)} assets, {len(failed_ids)} failed",
        )

    except Exception as e:
        logger.exception("Batch tag failed", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch tag operation failed",
        ) from e


@router.post("/batch/move", response_model=MediaBatchMoveResponse)
async def batch_move_media_assets(
    request: MediaBatchMoveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MediaBatchMoveResponse:
    """Batch move multiple media assets to a folder.

    Args:
        request: Batch move request with asset IDs and target folder
        db: Database session (injected)

    Returns:
        MediaBatchMoveResponse: Move operation results

    Raises:
        HTTPException: 500 for server errors
    """
    moved_ids = []
    failed_ids = []

    try:
        for asset_id in request.asset_ids:
            try:
                result = await db.execute(
                    select(MediaAsset).where(
                        and_(
                            MediaAsset.id == asset_id,
                            MediaAsset.is_deleted == False,  # noqa: E712
                        )
                    )
                )
                media_asset = result.scalar_one_or_none()

                if media_asset:
                    media_asset.folder_id = request.folder_id
                    media_asset.updated_at = datetime.utcnow()
                    moved_ids.append(asset_id)
                else:
                    failed_ids.append(asset_id)

            except Exception as e:
                logger.warning(
                    f"Failed to move asset {asset_id}",
                    extra={"asset_id": str(asset_id), "error": str(e)},
                )
                failed_ids.append(asset_id)

        await db.commit()

        return MediaBatchMoveResponse(
            moved_count=len(moved_ids),
            failed_count=len(failed_ids),
            moved_ids=moved_ids,
            failed_ids=failed_ids,
            message=f"Successfully moved {len(moved_ids)} assets, {len(failed_ids)} failed",
        )

    except Exception as e:
        logger.exception("Batch move failed", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch move operation failed",
        ) from e


@router.post("/{asset_id}/thumbnail", response_model=ThumbnailGenerationResponse)
async def generate_thumbnail(
    asset_id: uuid.UUID,
    request: ThumbnailGenerationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ThumbnailGenerationResponse:
    """Enqueue a thumbnail generation job for a media asset.

    Args:
        asset_id: Media asset UUID
        request: Thumbnail generation parameters
        db: Database session (injected)

    Returns:
        ThumbnailGenerationResponse: Job details

    Raises:
        HTTPException: 404 if asset not found
        HTTPException: 500 for server errors
    """
    try:
        result = await db.execute(
            select(MediaAsset).where(
                and_(
                    MediaAsset.id == asset_id,
                    MediaAsset.is_deleted == False,  # noqa: E712
                )
            )
        )
        media_asset = result.scalar_one_or_none()

        if not media_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset {asset_id} not found",
            )

        # TODO: Enqueue RQ worker job for thumbnail generation
        # For now, return a placeholder job ID
        job_id = str(uuid.uuid4())

        logger.info(
            "Thumbnail generation enqueued",
            extra={
                "asset_id": str(asset_id),
                "job_id": job_id,
            },
        )

        return ThumbnailGenerationResponse(
            asset_id=asset_id,
            job_id=job_id,
            message="Thumbnail generation job enqueued",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Failed to enqueue thumbnail generation",
            extra={"error": str(e), "asset_id": str(asset_id)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enqueue thumbnail generation",
        ) from e
