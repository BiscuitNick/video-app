"""Media event publisher for WebSocket notifications."""

import asyncio
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any
from uuid import UUID

from app.api.schemas.websocket import (
    MediaEventType,
    WSFolderCreatedMessage,
    WSFolderDeletedMessage,
    WSFolderUpdatedMessage,
    WSMediaBaseMessage,
    WSMediaDeletedMessage,
    WSMediaThumbnailReadyMessage,
    WSMediaUpdatedMessage,
    WSMediaUploadedMessage,
)
from workers.redis_pool import get_redis_connection

logger = logging.getLogger(__name__)


class MediaEventPublisher:
    """
    Publisher for media library events via WebSocket.

    Events are published to Redis channels and then broadcast to connected clients.
    Supports room-based subscriptions for folder-specific updates and event batching.
    """

    def __init__(self) -> None:
        """Initialize the media event publisher."""
        self.redis_client = get_redis_connection()
        self._batch_queue: dict[str, list[WSMediaBaseMessage]] = defaultdict(list)
        self._batch_lock = asyncio.Lock()
        self._batch_interval = 0.5  # Batch events every 500ms
        self._batch_task: asyncio.Task | None = None

    async def start_batching(self) -> None:
        """Start the event batching background task."""
        if self._batch_task is None or self._batch_task.done():
            self._batch_task = asyncio.create_task(self._batch_processor())
            logger.info("Media event batching started")

    async def stop_batching(self) -> None:
        """Stop the event batching background task."""
        if self._batch_task and not self._batch_task.done():
            self._batch_task.cancel()
            try:
                await self._batch_task
            except asyncio.CancelledError:
                pass
            logger.info("Media event batching stopped")

    async def _batch_processor(self) -> None:
        """Background task to process batched events."""
        while True:
            try:
                await asyncio.sleep(self._batch_interval)
                await self._flush_batch()
            except asyncio.CancelledError:
                # Flush remaining events before stopping
                await self._flush_batch()
                break
            except Exception as e:
                logger.error(f"Error in batch processor: {e}", exc_info=True)

    async def _flush_batch(self) -> None:
        """Flush batched events to Redis."""
        async with self._batch_lock:
            if not self._batch_queue:
                return

            for channel, events in self._batch_queue.items():
                if not events:
                    continue

                # For batch operations, we can combine similar events
                # For now, just publish all events in order
                for event in events:
                    try:
                        await self._publish_to_redis(channel, event)
                    except Exception as e:
                        logger.error(
                            f"Failed to publish batched event to {channel}: {e}",
                            exc_info=True,
                        )

            # Clear the batch queue
            self._batch_queue.clear()
            logger.debug("Flushed batched events to Redis")

    async def _publish_to_redis(self, channel: str, message: WSMediaBaseMessage) -> None:
        """
        Publish a message to a Redis channel.

        Args:
            channel: Redis channel name
            message: Message to publish
        """
        try:
            message_json = message.model_dump_json(mode="json")
            await self.redis_client.publish(channel, message_json)
            logger.debug(f"Published {message.type} event to channel: {channel}")
        except Exception as e:
            logger.error(f"Failed to publish to Redis channel {channel}: {e}", exc_info=True)
            raise

    def _get_channel_name(self, event_type: str, folder_id: UUID | None = None) -> str:
        """
        Get Redis channel name for an event.

        Args:
            event_type: Type of event (e.g., "media", "folder")
            folder_id: Optional folder ID for room-based subscriptions

        Returns:
            Redis channel name
        """
        if folder_id:
            return f"media:{event_type}:folder:{folder_id}"
        return f"media:{event_type}:all"

    async def publish_media_uploaded(
        self,
        media_asset_id: UUID,
        folder_id: UUID | None,
        user_id: str | None,
        data: dict[str, Any],
        batch: bool = False,
    ) -> None:
        """
        Publish media uploaded event.

        Args:
            media_asset_id: ID of the uploaded media asset
            folder_id: Folder where asset was uploaded
            user_id: User who uploaded the asset
            data: Media asset details
            batch: Whether to batch this event
        """
        message = WSMediaUploadedMessage(
            type=MediaEventType.MEDIA_UPLOADED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            media_asset_id=media_asset_id,
            folder_id=folder_id,
            data=data,
        )

        # Publish to both folder-specific and global channels
        channels = [
            self._get_channel_name("events", folder_id),  # Folder-specific
            self._get_channel_name("events"),  # Global
        ]

        if batch:
            async with self._batch_lock:
                for channel in channels:
                    self._batch_queue[channel].append(message)
        else:
            for channel in channels:
                await self._publish_to_redis(channel, message)

        logger.info(
            f"Published media.uploaded event for asset {media_asset_id}",
            extra={"media_asset_id": media_asset_id, "folder_id": folder_id},
        )

    async def publish_media_updated(
        self,
        media_asset_id: UUID,
        folder_id: UUID | None,
        user_id: str | None,
        data: dict[str, Any],
        batch: bool = False,
    ) -> None:
        """
        Publish media updated event.

        Args:
            media_asset_id: ID of the updated media asset
            folder_id: Current folder of the asset
            user_id: User who updated the asset
            data: Updated fields
            batch: Whether to batch this event
        """
        message = WSMediaUpdatedMessage(
            type=MediaEventType.MEDIA_UPDATED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            media_asset_id=media_asset_id,
            folder_id=folder_id,
            data=data,
        )

        channels = [
            self._get_channel_name("events", folder_id),
            self._get_channel_name("events"),
        ]

        if batch:
            async with self._batch_lock:
                for channel in channels:
                    self._batch_queue[channel].append(message)
        else:
            for channel in channels:
                await self._publish_to_redis(channel, message)

        logger.info(
            f"Published media.updated event for asset {media_asset_id}",
            extra={"media_asset_id": media_asset_id, "folder_id": folder_id},
        )

    async def publish_media_deleted(
        self,
        media_asset_ids: list[UUID],
        folder_id: UUID | None,
        user_id: str | None,
        batch: bool = False,
    ) -> None:
        """
        Publish media deleted event.

        Args:
            media_asset_ids: IDs of deleted media assets
            folder_id: Folder that contained the assets
            user_id: User who deleted the assets
            batch: Whether to batch this event
        """
        message = WSMediaDeletedMessage(
            type=MediaEventType.MEDIA_DELETED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            media_asset_ids=media_asset_ids,
            folder_id=folder_id,
        )

        channels = [
            self._get_channel_name("events", folder_id),
            self._get_channel_name("events"),
        ]

        if batch:
            async with self._batch_lock:
                for channel in channels:
                    self._batch_queue[channel].append(message)
        else:
            for channel in channels:
                await self._publish_to_redis(channel, message)

        logger.info(
            f"Published media.deleted event for {len(media_asset_ids)} assets",
            extra={"media_asset_ids": media_asset_ids, "folder_id": folder_id},
        )

    async def publish_media_thumbnail_ready(
        self,
        media_asset_id: UUID,
        folder_id: UUID | None,
        user_id: str | None,
        thumbnail_url: str,
    ) -> None:
        """
        Publish media thumbnail ready event.

        Args:
            media_asset_id: ID of the media asset
            folder_id: Folder containing the asset
            user_id: User ID
            thumbnail_url: Presigned URL for the thumbnail
        """
        message = WSMediaThumbnailReadyMessage(
            type=MediaEventType.MEDIA_THUMBNAIL_READY,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            media_asset_id=media_asset_id,
            folder_id=folder_id,
            thumbnail_url=thumbnail_url,
        )

        channels = [
            self._get_channel_name("events", folder_id),
            self._get_channel_name("events"),
        ]

        for channel in channels:
            await self._publish_to_redis(channel, message)

        logger.info(
            f"Published media.thumbnail.ready event for asset {media_asset_id}",
            extra={"media_asset_id": media_asset_id, "folder_id": folder_id},
        )

    async def publish_folder_created(
        self,
        folder_id: UUID,
        parent_id: UUID | None,
        user_id: str | None,
        data: dict[str, Any],
    ) -> None:
        """
        Publish folder created event.

        Args:
            folder_id: ID of the created folder
            parent_id: Parent folder ID
            user_id: User who created the folder
            data: Folder details
        """
        message = WSFolderCreatedMessage(
            type=MediaEventType.FOLDER_CREATED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            folder_id=folder_id,
            parent_id=parent_id,
            data=data,
        )

        # Publish to parent folder and global channels
        channels = [
            self._get_channel_name("events", parent_id),
            self._get_channel_name("events"),
        ]

        for channel in channels:
            await self._publish_to_redis(channel, message)

        logger.info(
            f"Published folder.created event for folder {folder_id}",
            extra={"folder_id": folder_id, "parent_id": parent_id},
        )

    async def publish_folder_updated(
        self,
        folder_id: UUID,
        parent_id: UUID | None,
        user_id: str | None,
        data: dict[str, Any],
    ) -> None:
        """
        Publish folder updated event.

        Args:
            folder_id: ID of the updated folder
            parent_id: Current parent folder ID
            user_id: User who updated the folder
            data: Updated fields
        """
        message = WSFolderUpdatedMessage(
            type=MediaEventType.FOLDER_UPDATED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            folder_id=folder_id,
            parent_id=parent_id,
            data=data,
        )

        channels = [
            self._get_channel_name("events", parent_id),
            self._get_channel_name("events"),
        ]

        for channel in channels:
            await self._publish_to_redis(channel, message)

        logger.info(
            f"Published folder.updated event for folder {folder_id}",
            extra={"folder_id": folder_id, "parent_id": parent_id},
        )

    async def publish_folder_deleted(
        self,
        folder_ids: list[UUID],
        parent_id: UUID | None,
        user_id: str | None,
    ) -> None:
        """
        Publish folder deleted event.

        Args:
            folder_ids: IDs of deleted folders
            parent_id: Parent folder that contained the folders
            user_id: User who deleted the folders
        """
        message = WSFolderDeletedMessage(
            type=MediaEventType.FOLDER_DELETED,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            folder_ids=folder_ids,
            parent_id=parent_id,
        )

        channels = [
            self._get_channel_name("events", parent_id),
            self._get_channel_name("events"),
        ]

        for channel in channels:
            await self._publish_to_redis(channel, message)

        logger.info(
            f"Published folder.deleted event for {len(folder_ids)} folders",
            extra={"folder_ids": folder_ids, "parent_id": parent_id},
        )


# Singleton instance
media_event_publisher = MediaEventPublisher()
