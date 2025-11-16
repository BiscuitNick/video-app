"""Pydantic schemas for WebSocket message protocol."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from .composition import ProcessingStage


class WSMessageType(str, Enum):
    """WebSocket message types."""

    PROGRESS = "progress"
    STATUS = "status"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    PONG = "pong"
    CONNECTED = "connected"


class WSBaseMessage(BaseModel):
    """Base WebSocket message structure."""

    type: WSMessageType = Field(..., description="Message type identifier")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="When the message was created"
    )
    composition_id: UUID = Field(..., description="Composition identifier this message relates to")


class WSProgressMessage(WSBaseMessage):
    """Progress update message for composition processing."""

    type: WSMessageType = Field(default=WSMessageType.PROGRESS, description="Message type")
    stage: ProcessingStage = Field(..., description="Current processing stage")
    percentage: float = Field(
        ..., ge=0, le=100, description="Progress percentage for current stage"
    )
    message: str | None = Field(None, description="Human-readable progress message")
    overall_progress: float | None = Field(
        None, ge=0, le=100, description="Overall composition progress percentage"
    )
    estimated_time_remaining: int | None = Field(
        None, ge=0, description="Estimated seconds remaining until completion"
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "progress",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "stage": "encoding",
                "percentage": 65.5,
                "message": "Encoding video with H.264 codec",
                "overall_progress": 85.0,
                "estimated_time_remaining": 45,
            }
        }


class WSStatusMessage(WSBaseMessage):
    """Status update message for composition state changes."""

    type: WSMessageType = Field(default=WSMessageType.STATUS, description="Message type")
    status: str = Field(..., description="Current composition status")
    stage: ProcessingStage = Field(..., description="Current processing stage")
    message: str | None = Field(None, description="Status message details")
    metadata: dict[str, Any] | None = Field(None, description="Additional status metadata")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "status",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "processing",
                "stage": "downloading",
                "message": "Started downloading video clips",
                "metadata": {"clips_count": 5, "total_size_mb": 250},
            }
        }


class WSErrorMessage(WSBaseMessage):
    """Error message for composition processing failures."""

    type: WSMessageType = Field(default=WSMessageType.ERROR, description="Message type")
    error_code: str = Field(..., description="Machine-readable error code")
    error_message: str = Field(..., description="Human-readable error message")
    stage: ProcessingStage | None = Field(None, description="Stage where error occurred")
    details: dict[str, Any] | None = Field(None, description="Additional error details")
    is_recoverable: bool = Field(default=False, description="Whether error is recoverable")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "error",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "error_code": "DOWNLOAD_FAILED",
                "error_message": "Failed to download video from URL",
                "stage": "downloading",
                "details": {"url": "https://example.com/video.mp4", "status_code": 404},
                "is_recoverable": True,
            }
        }


class WSHeartbeatMessage(WSBaseMessage):
    """Heartbeat/ping message to detect stale connections."""

    type: WSMessageType = Field(default=WSMessageType.HEARTBEAT, description="Message type")
    sequence: int = Field(..., ge=0, description="Heartbeat sequence number")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "heartbeat",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "sequence": 42,
            }
        }


class WSPongMessage(WSBaseMessage):
    """Pong response message to heartbeat."""

    type: WSMessageType = Field(default=WSMessageType.PONG, description="Message type")
    sequence: int = Field(..., ge=0, description="Heartbeat sequence number being acknowledged")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "pong",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "sequence": 42,
            }
        }


class WSConnectedMessage(WSBaseMessage):
    """Connection established message sent when client connects."""

    type: WSMessageType = Field(default=WSMessageType.CONNECTED, description="Message type")
    status: str = Field(..., description="Current composition status")
    stage: ProcessingStage = Field(..., description="Current processing stage")
    overall_progress: float = Field(..., ge=0, le=100, description="Current overall progress")
    message: str = Field(..., description="Welcome message")
    reconnection_token: str | None = Field(None, description="Token for reconnection recovery")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "connected",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "composition_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "processing",
                "stage": "encoding",
                "overall_progress": 75.5,
                "message": "Connected to composition updates",
                "reconnection_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            }
        }


class ConnectionState(str, Enum):
    """WebSocket connection states."""

    CONNECTING = "connecting"
    AUTHENTICATING = "authenticating"
    AUTHENTICATED = "authenticated"
    SUBSCRIBED = "subscribed"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class WSClientMessage(BaseModel):
    """Messages that can be sent from client to server."""

    type: str = Field(..., description="Message type from client")
    data: dict[str, Any] | None = Field(None, description="Message payload")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "pong",
                "data": {"sequence": 42},
            }
        }


# ============================================================================
# Media Library WebSocket Messages
# ============================================================================


class MediaEventType(str, Enum):
    """Media library event types."""

    MEDIA_UPLOADED = "media.uploaded"
    MEDIA_UPDATED = "media.updated"
    MEDIA_DELETED = "media.deleted"
    MEDIA_THUMBNAIL_READY = "media.thumbnail.ready"
    FOLDER_CREATED = "folder.created"
    FOLDER_UPDATED = "folder.updated"
    FOLDER_DELETED = "folder.deleted"
    CONNECTED = "connected"
    HEARTBEAT = "heartbeat"
    PONG = "pong"


class WSMediaBaseMessage(BaseModel):
    """Base WebSocket message structure for media events."""

    type: MediaEventType = Field(..., description="Media event type identifier")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="When the event occurred"
    )
    user_id: str | None = Field(None, description="User who triggered the event")


class WSMediaUploadedMessage(WSMediaBaseMessage):
    """Event message when a media asset upload completes."""

    type: MediaEventType = Field(default=MediaEventType.MEDIA_UPLOADED, description="Event type")
    media_asset_id: UUID = Field(..., description="ID of the uploaded media asset")
    folder_id: UUID | None = Field(None, description="Folder where asset was uploaded")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Media asset details (filename, type, size, etc.)",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "media.uploaded",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "media_asset_id": "550e8400-e29b-41d4-a716-446655440000",
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
                "data": {
                    "filename": "video.mp4",
                    "type": "video",
                    "file_size_bytes": 5242880,
                    "mime_type": "video/mp4",
                },
            }
        }


class WSMediaUpdatedMessage(WSMediaBaseMessage):
    """Event message when media asset metadata is updated."""

    type: MediaEventType = Field(default=MediaEventType.MEDIA_UPDATED, description="Event type")
    media_asset_id: UUID = Field(..., description="ID of the updated media asset")
    folder_id: UUID | None = Field(None, description="Current folder of the asset")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Updated fields (filename, tags, folder_id, etc.)",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "media.updated",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "media_asset_id": "550e8400-e29b-41d4-a716-446655440000",
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
                "data": {
                    "filename": "renamed-video.mp4",
                    "tags": ["project-a", "final"],
                },
            }
        }


class WSMediaDeletedMessage(WSMediaBaseMessage):
    """Event message when a media asset is deleted."""

    type: MediaEventType = Field(default=MediaEventType.MEDIA_DELETED, description="Event type")
    media_asset_ids: list[UUID] = Field(..., description="IDs of deleted media assets")
    folder_id: UUID | None = Field(None, description="Folder that contained the assets")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "media.deleted",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "media_asset_ids": [
                    "550e8400-e29b-41d4-a716-446655440000",
                    "660e8400-e29b-41d4-a716-446655440001",
                ],
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
            }
        }


class WSMediaThumbnailReadyMessage(WSMediaBaseMessage):
    """Event message when thumbnail generation completes."""

    type: MediaEventType = Field(
        default=MediaEventType.MEDIA_THUMBNAIL_READY, description="Event type"
    )
    media_asset_id: UUID = Field(..., description="ID of the media asset")
    folder_id: UUID | None = Field(None, description="Folder containing the asset")
    thumbnail_url: str = Field(..., description="Presigned URL for the generated thumbnail")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "media.thumbnail.ready",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "media_asset_id": "550e8400-e29b-41d4-a716-446655440000",
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
                "thumbnail_url": "https://s3.amazonaws.com/bucket/thumbnails/...",
            }
        }


class WSFolderCreatedMessage(WSMediaBaseMessage):
    """Event message when a folder is created."""

    type: MediaEventType = Field(default=MediaEventType.FOLDER_CREATED, description="Event type")
    folder_id: UUID = Field(..., description="ID of the created folder")
    parent_id: UUID | None = Field(None, description="Parent folder ID")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Folder details (name, path, etc.)",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "folder.created",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
                "parent_id": None,
                "data": {
                    "name": "Project A",
                    "path": "/Project A",
                },
            }
        }


class WSFolderUpdatedMessage(WSMediaBaseMessage):
    """Event message when a folder is updated."""

    type: MediaEventType = Field(default=MediaEventType.FOLDER_UPDATED, description="Event type")
    folder_id: UUID = Field(..., description="ID of the updated folder")
    parent_id: UUID | None = Field(None, description="Current parent folder ID")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Updated fields (name, parent_id, etc.)",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "folder.updated",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "folder_id": "660e8400-e29b-41d4-a716-446655440000",
                "parent_id": "770e8400-e29b-41d4-a716-446655440000",
                "data": {
                    "name": "Renamed Project",
                },
            }
        }


class WSFolderDeletedMessage(WSMediaBaseMessage):
    """Event message when a folder is deleted."""

    type: MediaEventType = Field(default=MediaEventType.FOLDER_DELETED, description="Event type")
    folder_ids: list[UUID] = Field(..., description="IDs of deleted folders")
    parent_id: UUID | None = Field(None, description="Parent folder that contained the folders")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "folder.deleted",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "folder_ids": ["660e8400-e29b-41d4-a716-446655440000"],
                "parent_id": None,
            }
        }


class WSMediaConnectedMessage(WSMediaBaseMessage):
    """Connection established message for media WebSocket."""

    type: MediaEventType = Field(default=MediaEventType.CONNECTED, description="Event type")
    message: str = Field(..., description="Welcome message")
    subscriptions: list[str] = Field(
        default_factory=list,
        description="List of subscribed channels (folders)",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "type": "connected",
                "timestamp": "2024-01-15T10:30:45.123Z",
                "user_id": "user-123",
                "message": "Connected to media library updates",
                "subscriptions": ["folder:660e8400-e29b-41d4-a716-446655440000", "all"],
            }
        }
