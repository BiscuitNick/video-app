# Chronos Editor — Backend API Contract
**Version**: 1.0
**Scope**: FastAPI backend (`ffmpeg-backend/`)
**Stack**: FastAPI 0.121+, SQLAlchemy 2.0+, Pydantic 2.12+, PostgreSQL 15+

This document defines the REST and WebSocket API surface to be implemented by the backend. It is aligned with the Chronos Editor PRD v2.4.

## Technology Stack (Current Implementation)

- **Framework**: FastAPI 0.121.2 with Uvicorn 0.38.0 (ASGI)
- **Validation**: Pydantic 2.12.4 (v2 API)
- **Database**: SQLAlchemy 2.0.44 (async), PostgreSQL 15-17
- **Async Driver**: asyncpg 0.30.0 (preferred) or psycopg2-binary 2.9.11
- **Migrations**: Alembic 1.17.2
- **Caching**: Redis 7.0.1
- **Task Queue**: RQ 2.6.0
- **Object Storage**: boto3 1.40.74, s3transfer 0.14.0
- **AI**: replicate 1.4.0
- **WebSocket**: websockets 15.0.1, Starlette 0.49.3

---

## 1. Conventions

- **Base URL**: `/api/v1`  
- **Authentication**: TBD (shadow user cookie + optional auth).  
- **Content-Type**: `application/json` for request/response unless otherwise specified.  
- **Pagination**: `page`, `page_size`, and `total` fields where applicable.  
- **Timestamps**: ISO 8601 strings with UTC timezone.  
- **IDs**: UUID v4 strings.  

Common pagination shape:

```jsonc
{
  "items": [ /* ... */ ],
  "page": 1,
  "page_size": 20,
  "total": 137
}
```

Error response shape:

```jsonc
{
  "error": {
    "code": "MEDIA_TOO_LARGE",
    "message": "Video exceeds maximum upload size of 1000 MB."
  }
}
```

---

## 2. Media Asset API

### 2.1 Request Presigned Upload URL

**POST** `/media/upload`

Request:

```jsonc
{
  "filename": "clip.mp4",
  "mime_type": "video/mp4",
  "size_bytes": 52428800,
  "type": "video",           // "image" | "video" | "audio"
  "folder_id": "UUID-or-null"
}
```

Response:

```jsonc
{
  "media_asset": {
    "id": "UUID",
    "owner_user_id": "UUID",
    "type": "video",
    "url": null,
    "thumbnail_url": null,
    "filename": "clip.mp4",
    "size_bytes": 52428800,
    "duration_seconds": null,
    "width": null,
    "height": null,
    "frame_rate": null,
    "codec": null,
    "tags": [],
    "folder_id": null,
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  },
  "upload": {
    "url": "https://s3-presigned-url",
    "method": "PUT",
    "headers": {
      "Content-Type": "video/mp4"
    }
  }
}
```

Notes:

- Backend validates `size_bytes` vs env thresholds.  
- MediaAsset initially stored as `PENDING_UPLOAD`.  

---

### 2.2 Confirm Upload / Update Media Metadata

**PATCH** `/media/{id}`

Request (example — partial update):

```jsonc
{
  "status": "ready",
  "url": "https://cdn.chronos.app/user-uploads/.../clip.mp4",
  "duration_seconds": 12.6,
  "width": 1920,
  "height": 1080,
  "frame_rate": 30,
  "codec": "h264",
  "tags": ["b-roll", "product"],
  "folder_id": "UUID-or-null"
}
```

Response: updated `MediaAsset` object.

---

### 2.3 List Media Assets

**GET** `/media`

Query parameters:

- `page` (default: 1)  
- `page_size` (default: 20, max: 100)  
- Filters (optional):
  - `type` (`image|video|audio|text`)  
  - `folder_id`  
  - `tag` (single tag filter)  
  - `search` (filename fuzzy search)  

Response:

```jsonc
{
  "items": [ /* MediaAsset[] */ ],
  "page": 1,
  "page_size": 20,
  "total": 137
}
```

---

### 2.4 Get Single Media Asset

**GET** `/media/{id}`

Response: `MediaAsset` object.

---

### 2.5 Delete (Soft) Media Asset

**DELETE** `/media/{id}`

Response:

```jsonc
{
  "success": true
}
```

Notes: marks `is_deleted = true`, may schedule S3 deletion asynchronously.

---

### 2.6 Regenerate Thumbnail

**POST** `/media/{id}/thumbnail`

Response:

```jsonc
{
  "media_asset_id": "UUID",
  "thumbnail_url": "https://.../thumb.jpg"
}
```

Notes: May be synchronous or enqueue a worker job and return last-known `thumbnail_url`.

---

### 2.7 Batch Operations

**POST** `/media/batch/delete`

```jsonc
{
  "media_ids": ["UUID1", "UUID2", "UUID3"]
}
```

**POST** `/media/batch/tag`

```jsonc
{
  "media_ids": ["UUID1", "UUID2"],
  "tags_to_add": ["product"],
  "tags_to_remove": ["unused"]
}
```

**POST** `/media/batch/move`

```jsonc
{
  "media_ids": ["UUID1", "UUID2"],
  "folder_id": "UUID-or-null"
}
```

Responses:

```jsonc
{ "success": true }
```

---

## 3. Folder API

### 3.1 Create Folder

**POST** `/folders`

```jsonc
{
  "name": "Client A",
  "parent_id": null
}
```

Response:

```jsonc
{
  "id": "UUID",
  "name": "Client A",
  "parent_id": null,
  "path": "Client A/",
  "owner_user_id": "UUID",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

---

### 3.2 List Folders (Tree)

**GET** `/folders`

```jsonc
[
  {
    "id": "UUID",
    "name": "Root",
    "parent_id": null,
    "path": "/",
    "children": [
      {
        "id": "UUID2",
        "name": "Client A",
        "parent_id": "UUID",
        "path": "/Client A/",
        "children": []
      }
    ]
  }
]
```

---

### 3.3 Get Folder Details

**GET** `/folders/{id}`

Response: single folder object (without children or with, depending on design).

---

### 3.4 Update Folder (Rename / Move)

**PATCH** `/folders/{id}`

```jsonc
{
  "name": "Client A (2025)",
  "parent_id": "UUID-of-new-parent-or-null"
}
```

Response: updated folder object.

---

### 3.5 Delete Folder

**DELETE** `/folders/{id}`

Behavior TBD: may require folder to be empty, or cascade.

Response:

```jsonc
{ "success": true }
```

---

### 3.6 Get Folder Contents

**GET** `/folders/{id}/contents`

Query params:

- `page`, `page_size`  
- Optionally `include_subfolders=true|false`  

Response (example):

```jsonc
{
  "media": [ /* MediaAsset[] */ ],
  "subfolders": [ /* Folder[] */ ],
  "page": 1,
  "page_size": 20,
  "total_media": 53,
  "total_subfolders": 4
}
```

---

## 4. Project API

### 4.1 Create Project

**POST** `/projects`

```jsonc
{
  "name": "My First Chronos Project",
  "aspect_ratio": "16:9",
  "timebase_fps": 30
}
```

Response:

```jsonc
{
  "id": "UUID",
  "owner_user_id": "UUID",
  "name": "My First Chronos Project",
  "thumbnail_url": null,
  "last_modified_at": "2025-01-01T12:00:00Z",
  "composition": {
    "id": "UUID",
    "project_id": "UUID",
    "name": "Main Composition",
    "aspect_ratio": "16:9",
    "timebase_fps": 30,
    "tracks": [],
    "clips": [],
    "transitions": [],
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
}
```

---

### 4.2 List Projects

**GET** `/projects`

Query params:

- `page`, `page_size`  
- `search` (name)  
- `sort` (e.g., `last_modified_at`, `created_at`)  

Response:

```jsonc
{
  "items": [ /* Project[] (without full composition if needed) */ ],
  "page": 1,
  "page_size": 20,
  "total": 7
}
```

Optional: allow a lightweight list view (no `composition`) for performance.

---

### 4.3 Get Project (With Composition)

**GET** `/projects/{id}`

Response: full `Project` including `composition` (tracks, clips, transitions).

---

### 4.4 Update Project (Autosave)

**PUT** `/projects/{id}`

```jsonc
{
  "name": "Updated Project Name",
  "thumbnail_url": "https://.../thumb.png",
  "composition": {
    "id": "UUID",
    "project_id": "UUID",
    "name": "Main Composition",
    "aspect_ratio": "16:9",
    "timebase_fps": 30,
    "tracks": [ /* Track[] */ ],
    "clips": [ /* Clip[] */ ],
    "transitions": [ /* TransitionConfig[] */ ],
    "updated_at": "2025-01-01T12:01:00Z"
  }
}
```

Response: updated `Project` object.

---

### 4.5 Delete Project (Soft)

**DELETE** `/projects/{id}`

```jsonc
{ "success": true }
```

---

### 4.6 Duplicate Project

**POST** `/projects/{id}/duplicate`

Response:

```jsonc
{
  "id": "NEW-UUID",
  "owner_user_id": "UUID",
  "name": "My First Chronos Project (Copy)",
  "thumbnail_url": "...",
  "last_modified_at": "2025-01-01T12:05:00Z",
  "composition": { /* copied composition */ }
}
```

---

### 4.7 Versions & Restore

**GET** `/projects/{id}/versions`

```jsonc
{
  "versions": [
    {
      "version": 1,
      "created_at": "2025-01-01T12:00:00Z",
      "summary": "Initial import"
    },
    {
      "version": 2,
      "created_at": "2025-01-01T12:03:00Z",
      "summary": "Added intro clip"
    }
  ]
}
```

**POST** `/projects/{id}/versions/{version}/restore`

```jsonc
{ "success": true }
```

(Restored project composition returned optionally.)

---

## 5. Compositions / Export API

### 5.1 Create Export Job

**POST** `/compositions/`

```jsonc
{
  "project_id": "UUID",
  "composition_id": "UUID",
  "export_settings": {
    "name": "My Export",
    "aspect_ratio": "16:9",
    "resolution": "1080p",
    "format": "mp4",
    "quality": "high",
    "frame_rate": 30
  }
}
```

Response:

```jsonc
{
  "id": "EXPORT-UUID",
  "project_id": "UUID",
  "composition_id": "UUID",
  "status": "queued",
  "progress": 0,
  "created_at": "2025-01-01T12:10:00Z"
}
```

---

### 5.2 List Export Jobs

**GET** `/compositions`

Query params:

- `project_id` (optional filter)  
- `status` (optional)  
- `page`, `page_size`  

Response: paginated list of export jobs.

---

### 5.3 Get Export Job Details

**GET** `/compositions/{id}`

```jsonc
{
  "id": "EXPORT-UUID",
  "project_id": "UUID",
  "composition_id": "UUID",
  "status": "running",
  "progress": 42,
  "created_at": "2025-01-01T12:10:00Z",
  "updated_at": "2025-01-01T12:11:00Z",
  "download_url": null,
  "error_code": null,
  "error_message": null
}
```

---

### 5.4 Get Export Status

**GET** `/compositions/{id}/status`

Small status object (subset of above).

---

### 5.5 Get Export Metadata

**GET** `/compositions/{id}/metadata`

Contains technical metadata (duration, codec, bitrate, size).

---

### 5.6 Get Download URL

**GET** `/compositions/{id}/download`

```jsonc
{
  "download_url": "https://s3-presigned-download-url"
}
```

---

### 5.7 Cancel Export

**POST** `/compositions/{id}/cancel`

```jsonc
{ "success": true }
```

### 5.8 Cancel Multiple Exports

**POST** `/compositions/cancel-all`

```jsonc
{
  "project_id": "UUID",
  "status_in": ["queued", "running"]
}
```

Response: `{ "success": true, "canceled_count": 3 }`

---

## 6. AI Generation API

### 6.1 Image Generation — Nano Banana

**POST** `/replicate/nano-banana`

```jsonc
{
  "prompt": "Futuristic city skyline, dusk lighting",
  "aspect_ratio": "16:9",
  "seed": 12345,
  "steps": 25,
  "guidance_scale": 7.5
}
```

Response:

```jsonc
{
  "job_id": "JOB-UUID"
}
```

Job updates via WebSocket (see section 8).

---

### 6.2 Video Generation — Wan Video I2V

**POST** `/replicate/wan-video-i2v`

```jsonc
{
  "prompt": "Slow pan across a neon-lit city street",
  "aspect_ratio": "16:9",
  "duration_seconds": 4,
  "quality": "draft",          // "draft" | "production"
  "seed": 42,
  "fps": 24
}
```

Response:

```jsonc
{
  "job_id": "JOB-UUID"
}
```

Backend chooses Replicate model based on `quality`.

---

## 7. Health & Metrics

### 7.1 Basic Health

**GET** `/health`

```jsonc
{
  "status": "ok"
}
```

### 7.2 Detailed Health

**GET** `/health/detailed`

```jsonc
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "latency_ms": 4 },
    "redis": { "status": "ok" },
    "s3": { "status": "ok" },
    "ffmpeg": { "status": "ok", "version": "6.0" }
  }
}
```

### 7.3 Metrics

**GET** `/metrics`

Prometheus-style text output.

---

## 8. WebSocket Contract

Suggested primary channel: **`/ws/jobs`**

Client connects:

```text
GET ws://api.chronos.app/ws/jobs
```

Server sends `JobUpdateMessage` objects as JSON:

```jsonc
{
  "type": "job.update",
  "job_id": "JOB-UUID",
  "job_kind": "export",
  "status": "running",
  "progress": 42,
  "composition_id": "UUID",
  "download_url": null,
  "error_code": null,
  "error_message": null
}
```

Clients filter messages client-side by `job_kind`, `project_id`, etc.

Alternative or additional channels (TBD):

- `/ws/compositions/{id}` for export-specific updates.  
- `/ws/projects/{id}` for broader project events.  

---

## 9. Error Codes (Non-Exhaustive)

- `MEDIA_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `UPLOAD_URL_EXPIRED`
- `EXPORT_FAILED`
- `AI_GENERATION_FAILED`
- `INVALID_COMPOSITION_DATA`
- `RATE_LIMIT_EXCEEDED`
- `RESOURCE_NOT_FOUND`

Each error must map to a user-friendly message in the frontend.

---

## 10. Implementation Notes & Best Practices

### 10.1 FastAPI & Pydantic 2.x Patterns

#### Pydantic v2 Schema Example

```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class MediaAssetResponse(BaseModel):
    """Response schema for MediaAsset with Pydantic v2"""
    model_config = ConfigDict(from_attributes=True)  # Replaces class Config

    id: str = Field(..., description="UUID of the media asset")
    owner_user_id: str
    type: str = Field(..., pattern="^(image|video|audio|text)$")
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    filename: str
    size_bytes: int = Field(..., gt=0)
    created_at: datetime
    updated_at: datetime

    # Pydantic v2: Use model_dump() instead of .dict()
    def to_dict(self):
        return self.model_dump(exclude_none=True)
```

#### FastAPI Route with Async SQLAlchemy 2.0

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

router = APIRouter(prefix="/api/v1/media", tags=["media"])

async def get_db() -> AsyncSession:
    """Dependency for database session"""
    async with async_session_maker() as session:
        yield session

@router.get("", response_model=List[MediaAssetResponse])
async def list_media_assets(
    page: int = 1,
    page_size: int = 20,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List media assets with pagination - SQLAlchemy 2.0 async pattern"""
    query = select(MediaAsset).offset((page - 1) * page_size).limit(page_size)

    if type:
        query = query.where(MediaAsset.type == type)

    result = await db.execute(query)
    assets = result.scalars().all()

    return assets
```

### 10.2 WebSocket Implementation Pattern

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

    async def send_job_update(self, user_id: str, message: dict):
        """Send job update to all user's connections"""
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)

            # Clean up disconnected websockets
            self.active_connections[user_id] -= disconnected

manager = ConnectionManager()

@app.websocket("/ws/jobs")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
```

### 10.3 S3 Presigned URL Generation

```python
import boto3
from botocore.config import Config
from datetime import timedelta

def generate_presigned_upload_url(
    s3_key: str,
    content_type: str,
    size_bytes: int,
    expiration: int = 900  # 15 minutes
) -> dict:
    """Generate presigned PUT URL with content-length constraints"""

    s3_client = boto3.client(
        's3',
        config=Config(signature_version='s3v4'),
        region_name=settings.S3_REGION
    )

    presigned_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.S3_BUCKET_NAME,
            'Key': s3_key,
            'ContentType': content_type,
        },
        ExpiresIn=expiration,
        HttpMethod='PUT'
    )

    return {
        "url": presigned_url,
        "method": "PUT",
        "headers": {
            "Content-Type": content_type,
            "Content-Length": str(size_bytes)
        }
    }
```

### 10.4 Background Job Pattern with RQ

```python
from rq import Queue
from redis import Redis
import logging

# Initialize Redis and RQ
redis_conn = Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB
)
job_queue = Queue('default', connection=redis_conn)

def enqueue_thumbnail_generation(media_asset_id: str) -> str:
    """Enqueue async thumbnail generation job"""
    job = job_queue.enqueue(
        'workers.media.generate_thumbnail',
        media_asset_id,
        job_timeout='10m',
        result_ttl=3600,  # Keep result for 1 hour
        failure_ttl=86400  # Keep failed job info for 24 hours
    )

    logging.info(f"Enqueued thumbnail job {job.id} for asset {media_asset_id}")
    return job.id
```

### 10.5 Database Migration Best Practices (Alembic)

```bash
# Generate migration after model changes
alembic revision --autogenerate -m "Add media_assets table"

# Review and edit migration file before applying
# File: alembic/versions/xxx_add_media_assets_table.py

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### 10.6 Testing Recommendations

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_list_media_assets(client: AsyncClient, db: AsyncSession):
    """Test media asset listing with pagination"""
    # Create test data
    asset = MediaAsset(
        id="test-uuid",
        owner_user_id="user-1",
        type="image",
        filename="test.jpg",
        size_bytes=1024000
    )
    db.add(asset)
    await db.commit()

    # Test endpoint
    response = await client.get("/api/v1/media?page=1&page_size=20")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) > 0
```

### 10.7 Performance Optimization Tips

1. **Database Query Optimization**
   - Use `selectinload()` or `joinedload()` for eager loading relationships
   - Add database indexes on frequently queried columns
   - Use `EXPLAIN ANALYZE` to optimize slow queries

2. **Caching Strategy**
   - Cache media asset metadata in Redis (5-15 min TTL)
   - Use ETags for conditional requests (`If-None-Match`)
   - Implement CDN caching for presigned download URLs

3. **Connection Pooling**
   ```python
   from sqlalchemy.ext.asyncio import create_async_engine

   engine = create_async_engine(
       DATABASE_URL,
       pool_size=20,
       max_overflow=10,
       pool_pre_ping=True,
       echo=False
   )
   ```

4. **Rate Limiting**
   - Use Redis for distributed rate limiting
   - Implement per-user, per-IP, and global limits
   - Return `429 Too Many Requests` with `Retry-After` header