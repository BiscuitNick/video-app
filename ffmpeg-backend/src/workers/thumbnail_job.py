"""RQ job handler for asynchronous thumbnail generation."""

import asyncio
import logging
import shutil
import traceback
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID

from app.config import settings
from db.models.media_asset import MediaAsset, MediaAssetType
from db.session import get_db_session
from sqlalchemy import select
from workers.s3_manager import s3_manager
from workers.thumbnail_generator import THUMBNAIL_SIZES, ThumbnailGenerator

logger = logging.getLogger(__name__)


class ThumbnailJobStatus(str, Enum):
    """Thumbnail job execution status."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class ThumbnailJobContext:
    """Context for tracking thumbnail job execution state."""

    job_id: str
    media_asset_id: UUID
    status: ThumbnailJobStatus = ThumbnailJobStatus.PENDING
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    error_traceback: str | None = None
    progress_percent: float = 0.0
    current_operation: str = "Initializing"
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_seconds(self) -> float | None:
        """Calculate job duration in seconds.

        Returns:
            float | None: Duration in seconds or None if not completed
        """
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def to_dict(self) -> dict[str, Any]:
        """Convert context to dictionary for serialization.

        Returns:
            dict: Serialized job context
        """
        return {
            "job_id": self.job_id,
            "media_asset_id": str(self.media_asset_id),
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "error_traceback": self.error_traceback,
            "progress_percent": self.progress_percent,
            "current_operation": self.current_operation,
            "duration_seconds": self.duration_seconds,
            "metadata": self.metadata,
        }


class ThumbnailJobHandler:
    """Handler for thumbnail generation jobs."""

    def __init__(self, job_id: str, media_asset_id: str | UUID) -> None:
        """Initialize thumbnail job handler.

        Args:
            job_id: Unique job identifier
            media_asset_id: Media asset UUID
        """
        self.job_id = job_id
        self.media_asset_id = UUID(media_asset_id) if isinstance(media_asset_id, str) else media_asset_id
        self.context = ThumbnailJobContext(
            job_id=job_id,
            media_asset_id=self.media_asset_id,
        )
        self.logger = logger.getChild(f"thumbnail.{job_id[:8]}")
        self.temp_dir = Path(settings.temp_dir) / f"thumbnail_{job_id}"

        self.logger.info(
            "Initialized ThumbnailJobHandler",
            extra={
                "job_id": job_id,
                "media_asset_id": str(self.media_asset_id),
            },
        )

    def _update_context(
        self,
        status: ThumbnailJobStatus | None = None,
        progress: float | None = None,
        operation: str | None = None,
        error: str | None = None,
        **metadata: Any,
    ) -> None:
        """Update job context state.

        Args:
            status: New job status
            progress: Progress percentage (0-100)
            operation: Current operation description
            error: Error message if failed
            **metadata: Additional metadata to store
        """
        if status is not None:
            self.context.status = status

            # Set timestamps based on status
            if status == ThumbnailJobStatus.IN_PROGRESS and self.context.started_at is None:
                self.context.started_at = datetime.now(UTC)
            elif status in {
                ThumbnailJobStatus.COMPLETED,
                ThumbnailJobStatus.FAILED,
                ThumbnailJobStatus.TIMEOUT,
            }:
                self.context.completed_at = datetime.now(UTC)

        if progress is not None:
            self.context.progress_percent = max(0.0, min(100.0, progress))

        if operation is not None:
            self.context.current_operation = operation

        if error is not None:
            self.context.error_message = error

        if metadata:
            self.context.metadata.update(metadata)

        # Log context update
        self.logger.debug(
            "Job context updated",
            extra={
                "job_id": self.job_id,
                "status": self.context.status.value if status else None,
                "progress": self.context.progress_percent,
                "operation": self.context.current_operation,
            },
        )

    async def _execute_job_async(self) -> dict[str, Any]:
        """Execute the thumbnail generation job asynchronously.

        Returns:
            dict: Job execution result

        Raises:
            Exception: If job execution fails
        """
        self._update_context(
            status=ThumbnailJobStatus.IN_PROGRESS,
            operation="Starting thumbnail generation",
            progress=0.0,
        )

        # Create temp directory
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Step 1: Fetch media asset from database
            self._update_context(operation="Fetching media asset", progress=5.0)

            async with get_db_session() as session:
                result = await session.execute(
                    select(MediaAsset).where(MediaAsset.id == self.media_asset_id)
                )
                media_asset = result.scalar_one_or_none()

                if not media_asset:
                    raise ValueError(f"Media asset {self.media_asset_id} not found")

                if not media_asset.s3_key:
                    raise ValueError(f"Media asset {self.media_asset_id} has no S3 key")

                media_type = media_asset.type.value
                s3_key = media_asset.s3_key
                filename = media_asset.filename

                self.logger.info(
                    f"Processing {media_type} asset",
                    extra={
                        "media_asset_id": str(self.media_asset_id),
                        "type": media_type,
                        "s3_key": s3_key,
                    },
                )

            # Step 2: Download media file from S3
            self._update_context(operation="Downloading media from S3", progress=10.0)

            source_path = self.temp_dir / filename

            s3_manager.download_file(
                s3_key=s3_key,
                local_path=source_path,
                progress_callback=lambda downloaded, total: self._update_context(
                    progress=10.0 + (downloaded / total * 20.0)
                ),
            )

            self.logger.info(
                f"Downloaded media from S3",
                extra={"s3_key": s3_key, "local_path": str(source_path)},
            )

            # Step 3: Generate thumbnails
            self._update_context(operation="Generating thumbnails", progress=35.0)

            # Check if thumbnail generation is enabled
            enable_generation = getattr(settings, "enable_thumbnail_generation", True)
            if not enable_generation:
                raise RuntimeError("Thumbnail generation is disabled")

            # Get timeout setting
            timeout = getattr(settings, "thumbnail_generation_timeout_seconds", 60)

            # Determine if we should use smart selection
            use_smart_selection = media_type == "video"

            generator = ThumbnailGenerator(temp_dir=self.temp_dir)

            try:
                # Run thumbnail generation with timeout
                thumbnails = await asyncio.wait_for(
                    asyncio.to_thread(
                        generator.generate_thumbnails,
                        source_path=source_path,
                        asset_id=str(self.media_asset_id),
                        media_type=media_type,
                        use_smart_selection=use_smart_selection,
                    ),
                    timeout=timeout,
                )
            except asyncio.TimeoutError as e:
                raise TimeoutError(
                    f"Thumbnail generation exceeded timeout of {timeout} seconds"
                ) from e

            self.logger.info(
                f"Generated {len(thumbnails)} thumbnails",
                extra={"count": len(thumbnails), "sizes": list(thumbnails.keys())},
            )

            self._update_context(operation="Thumbnails generated", progress=60.0)

            # Step 4: Upload thumbnails to S3
            self._update_context(operation="Uploading thumbnails to S3", progress=65.0)

            thumbnail_urls = {}
            thumbnail_s3_keys = {}

            for size_name, thumbnail_path in thumbnails.items():
                # Construct S3 key: thumbnails/{asset_id}/thumb_{size}.jpg
                thumbnail_s3_key = f"thumbnails/{self.media_asset_id}/thumb_{size_name}.jpg"

                # Upload to S3
                s3_manager.upload_file(
                    local_path=thumbnail_path,
                    s3_key=thumbnail_s3_key,
                    extra_args={
                        "ContentType": "image/jpeg",
                        "Metadata": {
                            "media_asset_id": str(self.media_asset_id),
                            "thumbnail_size": size_name,
                            "job_id": self.job_id,
                        },
                    },
                )

                # Generate presigned URL
                presigned_url = s3_manager.generate_presigned_url(
                    s3_key=thumbnail_s3_key,
                    expiration=86400,  # 24 hours
                )

                thumbnail_urls[size_name] = presigned_url
                thumbnail_s3_keys[size_name] = thumbnail_s3_key

                self.logger.debug(
                    f"Uploaded {size_name} thumbnail to S3",
                    extra={"size": size_name, "s3_key": thumbnail_s3_key},
                )

                # Update progress
                progress = 65.0 + ((list(thumbnails.keys()).index(size_name) + 1) / len(thumbnails)) * 25.0
                self._update_context(progress=progress)

            self.logger.info(
                f"Uploaded all thumbnails to S3",
                extra={"count": len(thumbnail_urls)},
            )

            # Step 5: Update MediaAsset in database
            self._update_context(operation="Updating database", progress=92.0)

            # Use the medium thumbnail as the default thumbnail_url
            default_thumbnail_url = thumbnail_urls.get("medium") or thumbnail_urls.get("small") or list(thumbnail_urls.values())[0]
            default_thumbnail_s3_key = thumbnail_s3_keys.get("medium") or thumbnail_s3_keys.get("small") or list(thumbnail_s3_keys.values())[0]

            async with get_db_session() as session:
                result = await session.execute(
                    select(MediaAsset).where(MediaAsset.id == self.media_asset_id)
                )
                media_asset = result.scalar_one_or_none()

                if media_asset:
                    media_asset.thumbnail_url = default_thumbnail_url
                    media_asset.thumbnail_s3_key = default_thumbnail_s3_key

                    # Store all thumbnail URLs in metadata
                    if not media_asset.metadata:
                        media_asset.metadata = {}
                    media_asset.metadata["thumbnails"] = {
                        "urls": thumbnail_urls,
                        "s3_keys": thumbnail_s3_keys,
                        "generated_at": datetime.now(UTC).isoformat(),
                        "job_id": self.job_id,
                    }

                    await session.commit()

                    self.logger.info(
                        f"Updated media asset with thumbnail URLs",
                        extra={"media_asset_id": str(self.media_asset_id)},
                    )

            self._update_context(operation="Database updated", progress=95.0)

            # Step 6: Send WebSocket notification
            self._update_context(operation="Sending notification", progress=97.0)

            try:
                await self._send_websocket_notification(
                    media_asset_id=self.media_asset_id,
                    thumbnail_urls=thumbnail_urls,
                )
            except Exception as e:
                # Don't fail the job if notification fails
                self.logger.warning(f"Failed to send WebSocket notification: {e}")

            # Step 7: Cleanup temp files
            self._update_context(operation="Cleaning up", progress=99.0)

            try:
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            except Exception as e:
                self.logger.warning(f"Failed to cleanup temp directory: {e}")

            # Mark as completed
            self._update_context(
                status=ThumbnailJobStatus.COMPLETED,
                operation="Thumbnail generation completed",
                progress=100.0,
            )

            return {
                "success": True,
                "media_asset_id": str(self.media_asset_id),
                "thumbnail_urls": thumbnail_urls,
                "thumbnail_s3_keys": thumbnail_s3_keys,
                "default_thumbnail_url": default_thumbnail_url,
            }

        except Exception as e:
            error_msg = str(e)
            error_trace = traceback.format_exc()

            self._update_context(
                status=ThumbnailJobStatus.FAILED,
                error=error_msg,
                operation="Thumbnail generation failed",
            )
            self.context.error_traceback = error_trace

            self.logger.exception(
                "Thumbnail job execution failed",
                extra={
                    "job_id": self.job_id,
                    "media_asset_id": str(self.media_asset_id),
                    "error": error_msg,
                },
            )

            # Cleanup temp directory on failure
            try:
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            except Exception:
                pass

            raise

    def execute(self) -> dict[str, Any]:
        """Execute the thumbnail generation job.

        Returns:
            dict: Job execution result

        Raises:
            Exception: If job execution fails
        """
        try:
            # Run async code in sync context
            result = asyncio.run(self._execute_job_async())

            self.logger.info(
                "Thumbnail job completed successfully",
                extra={
                    "job_id": self.job_id,
                    "media_asset_id": str(self.media_asset_id),
                    "duration": self.context.duration_seconds,
                },
            )

            return {
                "success": True,
                "job_id": self.job_id,
                "result": result,
                "context": self.context.to_dict(),
            }

        except Exception as e:
            self.logger.exception(
                "Thumbnail job failed",
                extra={
                    "job_id": self.job_id,
                    "media_asset_id": str(self.media_asset_id),
                },
            )

            return {
                "success": False,
                "job_id": self.job_id,
                "error": str(e),
                "error_traceback": traceback.format_exc(),
                "context": self.context.to_dict(),
            }

    async def _send_websocket_notification(
        self,
        media_asset_id: UUID,
        thumbnail_urls: dict[str, str],
    ) -> None:
        """Send WebSocket notification for thumbnail generation completion.

        Args:
            media_asset_id: Media asset UUID
            thumbnail_urls: Dictionary of thumbnail URLs by size
        """
        try:
            from workers.redis_pool import get_redis_connection

            redis_client = get_redis_connection()

            # Prepare notification message
            notification = {
                "event": "media.thumbnail.ready",
                "data": {
                    "media_asset_id": str(media_asset_id),
                    "thumbnail_urls": thumbnail_urls,
                    "generated_at": datetime.now(UTC).isoformat(),
                    "job_id": self.job_id,
                },
            }

            # Publish to Redis channel
            # Format: media:{media_asset_id}
            channel = f"media:{media_asset_id}"

            import json

            redis_client.publish(channel, json.dumps(notification))

            self.logger.info(
                f"Published WebSocket notification",
                extra={
                    "channel": channel,
                    "media_asset_id": str(media_asset_id),
                },
            )

        except Exception as e:
            self.logger.exception(
                f"Failed to send WebSocket notification: {e}",
                extra={"media_asset_id": str(media_asset_id)},
            )
            raise


def generate_thumbnail_job(job_id: str, media_asset_id: str) -> dict[str, Any]:
    """Main entry point for thumbnail generation jobs.

    This function is called by RQ workers to process thumbnail generation jobs.

    Args:
        job_id: Unique job identifier
        media_asset_id: Media asset UUID

    Returns:
        dict: Job execution result
    """
    handler = ThumbnailJobHandler(job_id=job_id, media_asset_id=media_asset_id)
    return handler.execute()
