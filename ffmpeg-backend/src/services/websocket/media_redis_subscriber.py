"""Redis subscriber for media library events."""

import asyncio
import json
import logging
from typing import Any

from app.api.schemas.websocket import WSMediaBaseMessage
from services.websocket.media_connection_manager import MediaConnectionManager
from workers.redis_pool import get_redis_connection

logger = logging.getLogger(__name__)


class MediaRedisSubscriber:
    """
    Redis subscriber for media library events.

    Listens to Redis pub/sub channels and broadcasts messages to connected WebSocket clients.
    Supports dynamic subscription to folder-specific and global media event channels.
    """

    def __init__(self, connection_manager: MediaConnectionManager) -> None:
        """
        Initialize the media Redis subscriber.

        Args:
            connection_manager: MediaConnectionManager instance for broadcasting messages
        """
        self.connection_manager = connection_manager
        self.redis_client = get_redis_connection()
        self.pubsub = None
        self._listening_task: asyncio.Task | None = None
        self._subscribed_channels: set[str] = set()
        self._is_connected = False
        self._is_running = False

    async def connect(self) -> None:
        """Connect to Redis and create pubsub instance."""
        if self._is_connected:
            logger.warning("Media Redis subscriber already connected")
            return

        try:
            self.pubsub = self.redis_client.pubsub()
            self._is_connected = True
            logger.info("Media Redis subscriber connected")
        except Exception as e:
            logger.error(f"Failed to connect media Redis subscriber: {e}", exc_info=True)
            raise

    async def disconnect(self) -> None:
        """Disconnect from Redis and clean up."""
        if self._listening_task and not self._listening_task.done():
            self._listening_task.cancel()
            try:
                await self._listening_task
            except asyncio.CancelledError:
                pass

        if self.pubsub:
            try:
                await self.pubsub.unsubscribe()
                await self.pubsub.close()
            except Exception as e:
                logger.warning(f"Error closing pubsub: {e}")

        self._is_connected = False
        self._is_running = False
        self._subscribed_channels.clear()
        logger.info("Media Redis subscriber disconnected")

    async def subscribe_to_channel(self, channel: str) -> None:
        """
        Subscribe to a Redis channel for media events.

        Args:
            channel: Channel name (e.g., "media:events:all", "media:events:folder:<folder_id>")
        """
        if not self._is_connected or not self.pubsub:
            raise RuntimeError("Not connected to Redis")

        if channel in self._subscribed_channels:
            logger.debug(f"Already subscribed to media channel: {channel}")
            return

        try:
            await self.pubsub.subscribe(channel)
            self._subscribed_channels.add(channel)
            logger.info(f"Subscribed to media Redis channel: {channel}")
        except Exception as e:
            logger.error(f"Failed to subscribe to media channel {channel}: {e}", exc_info=True)
            raise

    async def unsubscribe_from_channel(self, channel: str) -> None:
        """
        Unsubscribe from a Redis channel.

        Args:
            channel: Channel name to unsubscribe from
        """
        if not self._is_connected or not self.pubsub:
            return

        if channel not in self._subscribed_channels:
            logger.debug(f"Not subscribed to media channel: {channel}")
            return

        try:
            await self.pubsub.unsubscribe(channel)
            self._subscribed_channels.discard(channel)
            logger.info(f"Unsubscribed from media Redis channel: {channel}")
        except Exception as e:
            logger.warning(f"Failed to unsubscribe from media channel {channel}: {e}")

    async def start_listening(self) -> None:
        """Start listening to Redis pub/sub messages."""
        if self._is_running:
            logger.warning("Media Redis subscriber already running")
            return

        if not self._is_connected:
            await self.connect()

        # Subscribe to the global "all" channel by default
        await self.subscribe_to_channel("media:events:all")

        self._is_running = True
        self._listening_task = asyncio.create_task(self._listen_loop())
        logger.info("Media Redis subscriber started listening")

    async def _listen_loop(self) -> None:
        """Main listening loop for Redis pub/sub messages."""
        if not self.pubsub:
            logger.error("Pubsub not initialized")
            return

        try:
            async for message in self.pubsub.listen():
                if not self._is_running:
                    break

                try:
                    await self._handle_message(message)
                except Exception as e:
                    logger.error(f"Error handling media message: {e}", exc_info=True)

        except asyncio.CancelledError:
            logger.info("Media Redis listener cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in media Redis listen loop: {e}", exc_info=True)
        finally:
            self._is_running = False

    async def _handle_message(self, message: dict[str, Any]) -> None:
        """
        Handle a Redis pub/sub message.

        Args:
            message: Redis message dictionary
        """
        message_type = message.get("type")

        # Ignore subscription confirmation messages
        if message_type in ("subscribe", "unsubscribe", "psubscribe", "punsubscribe"):
            logger.debug(f"Media subscription event: {message_type}")
            return

        # Handle actual messages
        if message_type == "message":
            channel = message.get("channel")
            data = message.get("data")

            if not channel or not data:
                logger.warning(f"Invalid media message: {message}")
                return

            # Decode channel name if bytes
            if isinstance(channel, bytes):
                channel = channel.decode("utf-8")

            # Decode data if bytes
            if isinstance(data, bytes):
                data = data.decode("utf-8")

            try:
                # Parse message JSON
                message_data = json.loads(data)

                # Create message object (validate with Pydantic)
                # Note: We're just passing through the validated message
                # It was already validated when published
                logger.debug(
                    f"Received media event on channel {channel}: {message_data.get('type')}"
                )

                # Broadcast to appropriate connections based on channel
                # Extract subscription key from channel
                # Channel format: "media:events:all" or "media:events:folder:<folder_id>"
                if channel == "media:events:all":
                    subscription_key = "all"
                elif channel.startswith("media:events:folder:"):
                    folder_id = channel.replace("media:events:folder:", "")
                    subscription_key = f"folder:{folder_id}"
                else:
                    logger.warning(f"Unknown channel format: {channel}")
                    return

                # Broadcast to subscribed connections
                sent_count = await self.connection_manager.broadcast_to_channel(
                    subscription_key, WSMediaBaseMessage(**message_data)
                )

                logger.debug(
                    f"Broadcast media event from channel {channel} to {sent_count} connections"
                )

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse media message JSON: {e}", exc_info=True)
            except Exception as e:
                logger.error(f"Failed to process media message: {e}", exc_info=True)

    @property
    def is_connected(self) -> bool:
        """Check if subscriber is connected to Redis."""
        return self._is_connected

    @property
    def is_running(self) -> bool:
        """Check if subscriber is actively listening."""
        return self._is_running

    async def get_subscription_count(self) -> int:
        """Get the number of subscribed channels."""
        return len(self._subscribed_channels)


# Note: Instance will be created in the WebSocket endpoint
