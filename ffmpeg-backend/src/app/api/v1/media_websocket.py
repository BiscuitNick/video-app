"""WebSocket endpoints for real-time media library updates."""

import logging
from typing import Annotated

from fastapi import (
    APIRouter,
    Query,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)
from services.websocket import (
    MediaConnectionInfo,
    MediaConnectionManager,
    MediaRedisSubscriber,
    media_connection_manager,
)

from app.api.schemas.websocket import (
    ConnectionState,
    MediaEventType,
    WSMediaConnectedMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Global instances (initialized on startup)
media_redis_subscriber: MediaRedisSubscriber | None = None


async def get_media_redis_subscriber() -> MediaRedisSubscriber:
    """Get or create media Redis subscriber instance."""
    global media_redis_subscriber
    if media_redis_subscriber is None:
        media_redis_subscriber = MediaRedisSubscriber(media_connection_manager)
        await media_redis_subscriber.connect()
        await media_redis_subscriber.start_listening()
    return media_redis_subscriber


async def authenticate_websocket(token: str | None) -> str | None:
    """
    Authenticate WebSocket connection using JWT token.

    Args:
        token: JWT token from query params or headers

    Returns:
        User ID if authentication successful, None otherwise

    Raises:
        WebSocketException: If authentication fails
    """
    # TODO: Implement JWT validation when authentication is added
    # For now, allow connections without authentication
    # This is a placeholder that should be replaced with actual JWT validation

    if not token:
        logger.warning("Media WebSocket connection attempted without token")
        # For development, allow connections without token
        return None

    # Placeholder for JWT validation
    return token  # Return token as user_id placeholder


@router.websocket("/ws/media")
async def websocket_media_updates(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
    folders: Annotated[str | None, Query()] = None,
) -> None:
    """
    WebSocket endpoint for real-time media library updates.

    Clients connect to this endpoint to receive real-time updates about:
    - Media asset uploads, updates, deletions
    - Thumbnail generation completion
    - Folder creation, updates, deletions

    Args:
        websocket: WebSocket connection
        token: Optional JWT authentication token
        folders: Optional comma-separated list of folder IDs to subscribe to.
                 Use "all" to subscribe to all media events.
                 Example: "folder1-id,folder2-id" or "all"

    Example:
        ws://localhost:8000/api/v1/ws/media?token={jwt_token}&folders=all
        ws://localhost:8000/api/v1/ws/media?folders=660e8400-e29b-41d4-a716-446655440000
    """
    conn_info: MediaConnectionInfo | None = None
    subscriber: MediaRedisSubscriber | None = None

    try:
        # Accept WebSocket connection
        await websocket.accept()
        logger.info("Media WebSocket connection accepted")

        # Authenticate user
        user_id = await authenticate_websocket(token)

        # Add connection to manager
        conn_info = await media_connection_manager.add_connection(
            websocket=websocket,
            user_id=user_id,
            state=ConnectionState.AUTHENTICATING,
        )

        # Update connection state to authenticated
        await media_connection_manager.update_connection_state(
            websocket, ConnectionState.AUTHENTICATED
        )

        logger.info(f"Media WebSocket authenticated for user {user_id}")

        # Get Redis subscriber
        subscriber = await get_media_redis_subscriber()

        # Parse folder subscriptions
        subscriptions = []
        if folders:
            if folders == "all":
                subscriptions.append("all")
            else:
                # Parse comma-separated folder IDs
                folder_ids = [f.strip() for f in folders.split(",") if f.strip()]
                for folder_id in folder_ids:
                    subscriptions.append(f"folder:{folder_id}")
                    # Ensure Redis is subscribed to this folder channel
                    await subscriber.subscribe_to_channel(f"media:events:folder:{folder_id}")
        else:
            # Default to "all" if no folders specified
            subscriptions.append("all")

        # Subscribe connection to channels
        await media_connection_manager.subscribe(websocket, subscriptions)

        # Update connection state to subscribed
        await media_connection_manager.update_connection_state(
            websocket, ConnectionState.SUBSCRIBED
        )

        # Send initial connected message
        connected_msg = WSMediaConnectedMessage(
            type=MediaEventType.CONNECTED,
            user_id=user_id,
            message=f"Connected to media library updates",
            subscriptions=subscriptions,
        )

        await websocket.send_json(connected_msg.model_dump(mode="json"))

        logger.info(
            f"Media WebSocket connected for user {user_id}, subscriptions: {subscriptions}"
        )

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive messages from client (e.g., pong responses, subscription changes)
                data = await websocket.receive_json()

                # Handle client messages
                if data.get("type") == "pong":
                    # Update heartbeat
                    sequence = data.get("data", {}).get("sequence", 0)
                    await media_connection_manager.update_heartbeat(websocket, sequence)
                    logger.debug(f"Received pong {sequence} from user {user_id}")

                elif data.get("type") == "subscribe":
                    # Handle dynamic subscription changes
                    new_folders = data.get("data", {}).get("folders", [])
                    new_subscriptions = []
                    for folder_id in new_folders:
                        channel = f"folder:{folder_id}"
                        new_subscriptions.append(channel)
                        # Subscribe to Redis channel if not already
                        await subscriber.subscribe_to_channel(f"media:events:folder:{folder_id}")

                    # Subscribe connection to new channels
                    await media_connection_manager.subscribe(websocket, new_subscriptions)
                    logger.info(f"User {user_id} subscribed to additional folders: {new_folders}")

                elif data.get("type") == "unsubscribe":
                    # Handle unsubscription
                    remove_folders = data.get("data", {}).get("folders", [])
                    remove_subscriptions = [f"folder:{folder_id}" for folder_id in remove_folders]
                    await media_connection_manager.unsubscribe(websocket, remove_subscriptions)
                    logger.info(f"User {user_id} unsubscribed from folders: {remove_folders}")

            except WebSocketDisconnect:
                logger.info(f"Media WebSocket disconnected for user {user_id}")
                break
            except Exception as e:
                logger.error(f"Error receiving Media WebSocket message for user {user_id}: {e}")
                break

    except WebSocketException as e:
        logger.warning(f"Media WebSocket authentication failed: {e.reason}")
        try:
            await websocket.close(code=e.code, reason=e.reason)
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Unexpected error in media WebSocket connection: {e}")
        try:
            await websocket.close(
                code=status.WS_1011_INTERNAL_ERROR,
                reason="Internal server error",
            )
        except Exception:
            pass

    finally:
        # Clean up connection
        if conn_info:
            try:
                # Remove connection from manager (will also unsubscribe from all channels)
                await media_connection_manager.remove_connection(websocket)
                logger.info(f"Removed media WebSocket connection for user {conn_info.user_id}")

            except Exception as e:
                logger.error(f"Error during media WebSocket cleanup: {e}")


@router.get("/ws/media/stats")
async def get_media_websocket_stats() -> dict:
    """
    Get statistics about active media WebSocket connections.

    Returns:
        Dictionary with connection statistics
    """
    stats = await media_connection_manager.get_stats()

    # Add Redis subscriber stats if initialized
    if media_redis_subscriber is not None:
        stats["redis_subscriptions"] = await media_redis_subscriber.get_subscription_count()
        stats["redis_connected"] = media_redis_subscriber.is_connected
        stats["redis_listening"] = media_redis_subscriber.is_running
    else:
        stats["redis_subscriptions"] = 0
        stats["redis_connected"] = False
        stats["redis_listening"] = False

    return stats
