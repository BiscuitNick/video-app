"""WebSocket connection manager for media library events."""

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from app.api.schemas.websocket import ConnectionState, WSMediaBaseMessage
from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class MediaConnectionInfo:
    """Information about a media WebSocket connection."""

    websocket: WebSocket
    user_id: str | None
    state: ConnectionState
    subscriptions: set[str] = field(default_factory=set)  # Folder IDs or "all"
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    heartbeat_sequence: int = 0
    missed_heartbeats: int = 0

    def __hash__(self) -> int:
        """Make MediaConnectionInfo hashable by using websocket id."""
        return id(self.websocket)

    def __eq__(self, other: object) -> bool:
        """Compare MediaConnectionInfo by websocket instance."""
        if not isinstance(other, MediaConnectionInfo):
            return NotImplemented
        return self.websocket is other.websocket


class MediaConnectionManager:
    """
    Manages WebSocket connections for media library updates.

    Supports room-based subscriptions where clients can subscribe to:
    - Specific folder updates (folder:<folder_id>)
    - All media events (all)
    """

    _instance: "MediaConnectionManager | None" = None
    _lock: asyncio.Lock = asyncio.Lock()

    def __new__(cls) -> "MediaConnectionManager":
        """Implement singleton pattern for connection manager."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        """Initialize the media connection manager."""
        # Only initialize once
        if not hasattr(self, "_initialized"):
            # Dict mapping subscription channels to sets of connections
            self._subscriptions: dict[str, set[MediaConnectionInfo]] = defaultdict(set)
            # All active connections (for global lookups)
            self._all_connections: set[MediaConnectionInfo] = set()
            # Lock for thread-safe operations
            self._operation_lock = asyncio.Lock()
            self._initialized = True
            logger.info("MediaConnectionManager initialized")

    async def add_connection(
        self,
        websocket: WebSocket,
        user_id: str | None = None,
        state: ConnectionState = ConnectionState.CONNECTING,
    ) -> MediaConnectionInfo:
        """
        Add a new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance
            user_id: Optional user identifier
            state: Initial connection state

        Returns:
            MediaConnectionInfo object for the new connection
        """
        async with self._operation_lock:
            conn_info = MediaConnectionInfo(
                websocket=websocket,
                user_id=user_id,
                state=state,
            )
            self._all_connections.add(conn_info)
            logger.info(
                f"Added media WebSocket connection for user {user_id}, "
                f"total connections: {len(self._all_connections)}"
            )
            return conn_info

    async def remove_connection(self, websocket: WebSocket) -> MediaConnectionInfo | None:
        """
        Remove a WebSocket connection and unsubscribe from all channels.

        Args:
            websocket: WebSocket instance to remove

        Returns:
            Removed MediaConnectionInfo if found, None otherwise
        """
        async with self._operation_lock:
            # Find the connection info
            conn_info = None
            for conn in self._all_connections:
                if conn.websocket is websocket:
                    conn_info = conn
                    break

            if not conn_info:
                logger.warning("WebSocket connection not found for removal")
                return None

            # Remove from all subscriptions
            for channel in list(conn_info.subscriptions):
                if channel in self._subscriptions:
                    self._subscriptions[channel].discard(conn_info)
                    if not self._subscriptions[channel]:
                        del self._subscriptions[channel]

            # Remove from all connections
            self._all_connections.discard(conn_info)

            logger.info(
                f"Removed media WebSocket connection for user {conn_info.user_id}, "
                f"was subscribed to {len(conn_info.subscriptions)} channels"
            )
            return conn_info

    async def subscribe(
        self, websocket: WebSocket, channels: list[str]
    ) -> MediaConnectionInfo | None:
        """
        Subscribe a connection to specific channels.

        Args:
            websocket: WebSocket instance
            channels: List of channel names (e.g., "all", "folder:<folder_id>")

        Returns:
            MediaConnectionInfo if found, None otherwise
        """
        async with self._operation_lock:
            # Find the connection
            conn_info = None
            for conn in self._all_connections:
                if conn.websocket is websocket:
                    conn_info = conn
                    break

            if not conn_info:
                logger.warning("Connection not found for subscription")
                return None

            # Add to each channel
            for channel in channels:
                self._subscriptions[channel].add(conn_info)
                conn_info.subscriptions.add(channel)

            logger.info(
                f"Subscribed connection (user {conn_info.user_id}) to channels: {channels}"
            )
            return conn_info

    async def unsubscribe(
        self, websocket: WebSocket, channels: list[str]
    ) -> MediaConnectionInfo | None:
        """
        Unsubscribe a connection from specific channels.

        Args:
            websocket: WebSocket instance
            channels: List of channel names to unsubscribe from

        Returns:
            MediaConnectionInfo if found, None otherwise
        """
        async with self._operation_lock:
            # Find the connection
            conn_info = None
            for conn in self._all_connections:
                if conn.websocket is websocket:
                    conn_info = conn
                    break

            if not conn_info:
                return None

            # Remove from each channel
            for channel in channels:
                if channel in self._subscriptions:
                    self._subscriptions[channel].discard(conn_info)
                    if not self._subscriptions[channel]:
                        del self._subscriptions[channel]
                conn_info.subscriptions.discard(channel)

            logger.info(
                f"Unsubscribed connection (user {conn_info.user_id}) from channels: {channels}"
            )
            return conn_info

    async def get_connections_for_channel(self, channel: str) -> set[MediaConnectionInfo]:
        """
        Get all connections subscribed to a specific channel.

        Args:
            channel: Channel name

        Returns:
            Set of MediaConnectionInfo objects
        """
        async with self._operation_lock:
            return self._subscriptions.get(channel, set()).copy()

    async def broadcast_to_channel(self, channel: str, message: WSMediaBaseMessage) -> int:
        """
        Broadcast a message to all connections subscribed to a channel.

        Args:
            channel: Channel name
            message: Message to broadcast

        Returns:
            Number of connections the message was sent to
        """
        connections = await self.get_connections_for_channel(channel)
        if not connections:
            logger.debug(f"No connections subscribed to channel {channel}")
            return 0

        message_dict = message.model_dump(mode="json")
        sent_count = 0
        failed_connections = []

        for conn in connections:
            try:
                await conn.websocket.send_json(message_dict)
                sent_count += 1
            except Exception as e:
                logger.error(
                    f"Failed to send message to connection for user {conn.user_id}: {e}"
                )
                failed_connections.append(conn)

        # Remove failed connections
        if failed_connections:
            async with self._operation_lock:
                for conn in failed_connections:
                    # Remove from all subscriptions
                    for sub_channel in list(conn.subscriptions):
                        if sub_channel in self._subscriptions:
                            self._subscriptions[sub_channel].discard(conn)
                            if not self._subscriptions[sub_channel]:
                                del self._subscriptions[sub_channel]

                    # Remove from all connections
                    self._all_connections.discard(conn)
                    logger.info(f"Removed failed connection for user {conn.user_id}")

        logger.debug(f"Broadcast message to {sent_count} connections on channel {channel}")
        return sent_count

    async def update_connection_state(
        self, websocket: WebSocket, state: ConnectionState
    ) -> bool:
        """
        Update the state of a connection.

        Args:
            websocket: WebSocket instance
            state: New connection state

        Returns:
            True if connection was found and updated, False otherwise
        """
        async with self._operation_lock:
            for conn in self._all_connections:
                if conn.websocket is websocket:
                    old_state = conn.state
                    conn.state = state
                    logger.info(
                        f"Updated media connection state for user {conn.user_id}: "
                        f"{old_state.value} -> {state.value}"
                    )
                    return True
            return False

    async def update_heartbeat(self, websocket: WebSocket, sequence: int) -> bool:
        """
        Update heartbeat information for a connection.

        Args:
            websocket: WebSocket instance
            sequence: Heartbeat sequence number

        Returns:
            True if connection was found and updated, False otherwise
        """
        async with self._operation_lock:
            for conn in self._all_connections:
                if conn.websocket is websocket:
                    conn.last_heartbeat = datetime.utcnow()
                    conn.heartbeat_sequence = sequence
                    conn.missed_heartbeats = 0
                    return True
            return False

    async def get_stats(self) -> dict[str, Any]:
        """
        Get statistics about active connections.

        Returns:
            Dictionary with connection statistics
        """
        async with self._operation_lock:
            total_connections = len(self._all_connections)
            total_channels = len(self._subscriptions)

            channel_stats = {
                channel: len(conns) for channel, conns in self._subscriptions.items()
            }

            return {
                "total_connections": total_connections,
                "total_channels": total_channels,
                "channel_subscriptions": channel_stats,
            }


# Singleton instance
media_connection_manager = MediaConnectionManager()
