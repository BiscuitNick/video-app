
# Chronos Editor — Product Requirements Document (PRD)
## Version 2.1 — Updated with Engineering-Ready Details  
Target Launch: Q4 2025  
Primary Stakeholder: Product Manager  
Product Manager: Gemini (AI Assistant)  
Project Name: Chronos Editor  

---

# 1. Introduction & Goals

## 1.1 Project Overview
Chronos Editor is a modern, browser-based, non-destructive media editor built around a track-based timeline UI that supports image, video, audio, and text editing. The application focuses on speed, responsiveness, real-time preview, and seamless asset ingestion (manual upload + AI generation).

## 1.2 Audience
- Content creators  
- Social media managers  
- Small businesses  
- Users needing quick professional-grade clip editing without desktop software

## 1.3 Success Metrics
- 90% of users complete a 3‑clip edit in under 5 minutes  
- All timeline interactions respond <100ms  
- 500 MAU within 6 months of launch  

---

# 2. Environment Variables & Global Constants

All tunable system-wide constants MUST be configurable via environment variables.

| Constant | Env Var | Default | Description |
|---------|---------|---------|-------------|
| Max Output Duration | `MAX_DURATION_SECONDS` | `600` | Maximum project length in seconds (10 minutes). |
| Default FPS (timebase) | `DEFAULT_TIMEBASE_FPS` | `30` | Internal timeline timebase FPS. |
| Max Concurrent Generations | `MAX_GENERATIONS` | `5` | Max simultaneous image/video AI generations. |
| Thumbnail Cache Limit | `THUMBNAIL_CACHE_MAX_BYTES` | `200000000` | IndexedDB cache limit for thumbnails (200MB). |
| Thumbnail Cache LRU Enabled | `THUMBNAIL_CACHE_ENABLE_LRU` | `true` | Evict least recently used thumbnails first. |

---

# 3. Technical Architecture

## 3.1 Project Structure

### Application Structure
```
video-app/
├── frontend/           # React application - Chronos Editor Timeline UI
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── stores/     # Zustand state management
│   │   ├── services/   # API clients and utilities
│   │   └── types/      # TypeScript interfaces
│   └── package.json
│
└── ffmpeg-backend/     # FastAPI backend service
    ├── src/
    │   ├── app/        # FastAPI application
    │   │   └── api/
    │   │       ├── v1/ # Public API endpoints
    │   │       └── internal/ # Internal endpoints
    │   ├── db/         # Database models and session
    │   ├── services/   # Business logic
    │   └── workers/    # RQ background workers
    └── requirements.txt
```

### Development Flow
- **Frontend** (`/frontend`): Contains all Chronos Editor UI development (timeline, media library, playback controls, export UI)
- **Backend** (`/ffmpeg-backend`): Provides API endpoints for media upload, composition processing, and export rendering
- **Communication**: Frontend calls backend REST API endpoints, receives real-time updates via WebSocket
- **Storage**: All media assets stored in S3 bucket (configured in ffmpeg-backend)

## 3.2 Frontend Stack
- **Vite + React** (FC + hooks)
- **TailwindCSS**
- **shadcn/ui** components
- **Zustand** for real-time global state
- **react-window** / **react-virtuoso** for timeline virtualization
- **IndexedDB** for caching thumbnails
- **WebSocket** for job status updates

## 3.3 Backend Stack
- **FastAPI** (Python async)
- **PostgreSQL 17** with JSONB for flexible schemas
- **Redis** for job queues and pub/sub
- **RQ (Redis Queue)** for background job processing
- **FFmpeg 6.x** for video processing
- **AWS S3** for media asset storage

## 3.4 Composition-Wide Timebase
Chronos uses a **composition-level frame-based timebase**.

```ts
timebase_fps: 24 | 30 | 60 // default 30
```

Timeline internal units = **frames**, not seconds.

Conversions:
```
frame = Math.round(seconds * timebase_fps)
seconds = frame / timebase_fps
```

---

# 4. Playback Engine Specification

## 4.1 Hybrid DOM + Timeline Engine (Recommended Implementation)
A high-performance but simplified preview system that approximates final export:

### What the preview engine does:
- Calculates active clips at given frame
- Applies CSS transforms:
  - opacity
  - scale
  - X/Y position
- Renders video tracks using a single `<video>` element
- Renders text/image overlays as DOM layers
- Approximates transitions using CSS animations

### What it does NOT do:
- Multi-video-layer compositing  
- High-fidelity ffmpeg-grade transitions  
- Perfect audio pitch correction during speed changes  

**Final export becomes authoritative.**

---

# 5. Media Types & Ingestion

## 5.1 Manual Ingestion (User Uploads)

### Upload Sources
- File picker (drag-and-drop support)
- Copy/paste
- URL ingestion
- Dropbox link integration (future)

### Upload Flow
1. **Frontend**: User selects file(s) to upload
2. **Frontend → Backend**: Request presigned S3 URL via `POST /api/v1/media/upload`
3. **Backend**: Generates presigned URL for direct S3 upload, creates MediaAsset record
4. **Frontend → S3**: Direct upload to S3 using presigned URL (client-side)
5. **Frontend → Backend**: Confirm upload completion, update MediaAsset metadata
6. **Backend**: Generates thumbnail (for videos), broadcasts WebSocket event

### S3 Storage Structure
```
s3://bucket-name/
└── user-uploads/
    └── {user_id}/              # Default user: "default-user"
        ├── images/
        │   └── {uuid}.{ext}
        ├── videos/
        │   └── {uuid}.{ext}
        └── audio/
            └── {uuid}.{ext}
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_IMAGE_UPLOAD_SIZE_MB` | `100` | Maximum image upload size |
| `MAX_VIDEO_UPLOAD_SIZE_MB` | `1000` | Maximum video upload size (1GB) |
| `MAX_AUDIO_UPLOAD_SIZE_MB` | `500` | Maximum audio upload size |
| `DEFAULT_USER_ID` | `default-user` | User ID for demo/no-auth mode |

### Required Backend Endpoints
```
POST /api/v1/media/upload          # Request presigned URL & create MediaAsset
GET  /api/v1/media                 # List media with pagination/filtering
GET  /api/v1/media/{id}            # Get single media asset details
PATCH /api/v1/media/{id}           # Update metadata (tags, folder, name)
DELETE /api/v1/media/{id}          # Delete media asset
POST /api/v1/media/{id}/thumbnail  # Generate/regenerate thumbnail
```

## 5.2 AI Generation
Supports multiple generations concurrently up to:

```
MAX_GENERATIONS (default 5)
```

| Type | Endpoint | Schema |
|------|----------|--------|
| Image | POST /api/v1/replicate/nano-banana | NanoBananaRequest |
| Video | POST /api/v1/replicate/wan-video-i2v | WanVideoI2VRequest |

Aspect ratio MUST be included in requests.

---

# 6. Media Library Panel

- Virtualized grid  
- Lazy-loaded thumbnails  
- Real-time job status  
- Tagging, folders, filters, sorting  
- Bulk actions  
- Metadata modal (edit tags, folder, filename)  
- WebSocket updates when new media arrives  

---

# 7. Timeline & Editing Functionality

## 7.1 Tracks
- Unlimited tracks  
- Track types: video, audio, text  
- Editable label  
- Lock/mute toggles  
- Track reordering  

## 7.2 Clips
Each clip supports:
- trimming  
- move & drag  
- cross-track dragging  
- rename  
- transitions  
- speed  
- opacity  
- scale  
- X/Y position  
- volume / mute  
- splitting  

## 7.3 Clip Splitting
Split by:
- Right‑click → “Split at Playhead”
- Clicking Split button in control bar

Splitting creates two new clips with inherited properties.

Undo/redo supported.

---

# 8. Timeline Zoom

## 8.1 Controls
- **+ / – buttons**  
- **Ctrl + Scroll**  
- Zoom anchored at:
  - playhead (default)
  - or mouse position  

## 8.2 Behavior
Zoom changes:
```
pixelsPerSecond = base * zoomLevel
zoomLevel ranges 0.25 → 8.0
```

Horizontal scrolling:
- trackpad
- shift + scroll

---

# 9. Real-Time Updates (WebSocket Protocol)

## 9.1 Message Shape
```ts
type JobUpdateMessage = {
  type: "job.update";
  job_id: string;
  job_kind: "image_generation" | "video_generation" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress?: number;
  media_asset_id?: string;
  composition_id?: string;
  download_url?: string;
  error_code?: string;
  error_message?: string;
};
```

## 9.2 Events
- Media generation progress  
- Export progress  
- Completion → send download URL  
- Failure → send error details  

---

# 10. Media Details Panel

Supports:
- Clip label  
- Start / end time  
- Duration (derived)  
- Speed  
- Volume / mute  
- Scale  
- X/Y position  
- Opacity  
- Transitions in/out  
- Text content for text clips  

All fields are bidirectionally synced.

---

# 11. Export System

## 11.1 Export Settings
- Name  
- Aspect ratio  
- Resolution  
- Format  
- Quality  
- Frame rate  

## 11.2 API Flow
```
POST /api/v1/compositions/
```

WebSocket notifies on export completion.

Download via signed S3 URL.

---

# 12. Mobile Layout

Mobile is supported with a simplified UI:
- Stacked layout  
- Smaller “Timeline Lite”  
- Full playback controls  
- Asset browsing  
- Clip detail editing  
- Light trimming  

Full multi-track editing is desktop‑only.

---

# 13. Thumbnail Cache (IndexedDB LRU)

## 13.1 Maximum Cache Size
```
THUMBNAIL_CACHE_MAX_BYTES (default 200MB)
```

## 13.2 LRU Eviction Strategy
Each entry:
```ts
{
 id: string,
 size_bytes: number,
 last_accessed_at: number,
 blob: Blob
}
```

When the cache exceeds max:
- Sort by `last_accessed_at`
- Delete oldest items
- Repeat until under cap

---

# 14. Dirty State Indicator (Unsaved Changes)

When the project has unsaved changes:

- Display: `● My Project`  
- Tooltip: “Unsaved changes”  
- Prevent accidental closing  
- Cleared only after successful backend save  

---

# 15. Error Taxonomy

## 15.1 Network Errors
Connectivity or server unreachable  
UI: toast + retry

## 15.2 Asset Ingestion Errors
File too large, unsupported format, failed upload

## 15.3 Export/Rendering Errors
ffmpeg failures, invalid settings  
Show detailed error in Export modal

## 15.4 Timeline Manipulation Errors
Edge case invalid edits  
User-facing toast + internal logging

## 15.5 Schema Validation Errors
Backend rejects invalid payload  
Surface human-readable messages  
Detailed logs for debugging  

---

# 16. Testing Strategy

## 16.1 Unit Tests
- reducers/state logic  
- snapping  
- ripple edits  
- splitting  
- undo/redo  
- zooming  
- time/frame conversions  

## 16.2 Integration Tests
- User edits a 3-clip timeline  
- AI generation asset lifecycle  
- Export lifecycle  
- WebSocket reliability  

---

# 17. JSON Schemas (Engineering Ready)

## 17.1 MediaAsset

```ts
interface MediaAsset {
  id: UUID;
  owner_user_id: UUID;
  type: "image" | "video" | "audio" | "text";
  url: string;
  thumbnail_url?: string;
  filename: string;
  size_bytes?: number;
  duration_seconds?: number;
  width?: number;
  height?: number;
  frame_rate?: number;
  codec?: string;
  tags?: string[];
  folder_id?: UUID | null;
  created_at: string;
  updated_at: string;
}
```

## 17.2 TransitionConfig

```ts
interface TransitionConfig {
  id: UUID;
  type: "fade" | "wipe_left" | "wipe_right" |
        "wipe_up" | "wipe_down" | "zoom_in" | "zoom_out";
  duration_seconds: number;
  easing?: string;
}
```

## 17.3 Clip

```ts
interface Clip {
  id: UUID;
  media_asset_id: UUID;
  track_id: UUID;

  start_frame: number;
  end_frame: number;
  trim_in_frame: number;
  trim_out_frame: number;

  label?: string;
  speed?: number;
  volume?: number;
  mute?: boolean;

  opacity?: number;
  scale?: number;
  position_x?: number;
  position_y?: number;

  text_content?: string;

  transition_in_id?: UUID | null;
  transition_out_id?: UUID | null;
}
```

## 17.4 Track

```ts
interface Track {
  id: UUID;
  type: "video" | "audio" | "text";
  label: string;
  muted: boolean;
  locked: boolean;
  order_index: number;
}
```

## 17.5 Composition

```ts
interface Composition {
  id: UUID;
  project_id: UUID;
  name: string;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  timebase_fps: 24 | 30 | 60;

  tracks: Track[];
  clips: Clip[];
  transitions: TransitionConfig[];

  created_at: string;
  updated_at: string;
}
```

## 17.6 Project

```ts
interface Project {
  id: UUID;
  owner_user_id: UUID;
  name: string;
  thumbnail_url?: string;
  last_modified_at: string;
  composition: Composition;
}
```

---

# 18. Backend API Requirements & Implementation

## 18.1 Existing Backend Endpoints (ffmpeg-backend)

The following endpoints are **already implemented** in `/ffmpeg-backend`:

### Composition Endpoints (Video Export)
```
POST   /api/v1/compositions/                   # Create composition job
GET    /api/v1/compositions/                   # List compositions with pagination
GET    /api/v1/compositions/{id}               # Get composition details
GET    /api/v1/compositions/{id}/status        # Get processing status
GET    /api/v1/compositions/{id}/metadata      # Get detailed metadata
GET    /api/v1/compositions/{id}/download      # Get presigned download URL
POST   /api/v1/compositions/{id}/cancel        # Cancel composition
POST   /api/v1/compositions/cancel-all         # Bulk cancel
```

### AI Generation Endpoints (Replicate)
```
POST   /api/v1/replicate/nano-banana          # Google's Nano-Banana image generation
```

Note: `/api/v1/replicate/wan-video-i2v` mentioned in PRD needs to be **added** if not present.

### Health & Monitoring
```
GET    /health                                 # Basic health check
GET    /health/detailed                        # Component status
GET    /metrics                                # API metrics
```

### WebSocket
```
WS     /ws/compositions/{id}                   # Real-time composition progress updates
```

## 18.2 Required New Endpoints (To Be Implemented)

### Media Asset Management
```
POST   /api/v1/media/upload                    # Request presigned S3 URL
GET    /api/v1/media                           # List media (pagination, filtering, sorting)
GET    /api/v1/media/{id}                      # Get single media asset
PATCH  /api/v1/media/{id}                      # Update metadata (tags, folder, filename)
DELETE /api/v1/media/{id}                      # Soft delete media asset
POST   /api/v1/media/{id}/thumbnail            # Generate/regenerate thumbnail
POST   /api/v1/media/batch/delete              # Bulk delete
POST   /api/v1/media/batch/tag                 # Bulk tag operations
POST   /api/v1/media/batch/move                # Bulk move to folder
```

### Folder Management
```
POST   /api/v1/folders                         # Create folder
GET    /api/v1/folders                         # List folders (tree structure)
GET    /api/v1/folders/{id}                    # Get folder details
PATCH  /api/v1/folders/{id}                    # Update folder (rename, move)
DELETE /api/v1/folders/{id}                    # Delete folder
GET    /api/v1/folders/{id}/contents           # Get folder contents (paginated)
```

### Project Management (NEW)
```
POST   /api/v1/projects                        # Create new project
GET    /api/v1/projects                        # List projects (pagination, sorting)
GET    /api/v1/projects/{id}                   # Get project with composition data
PUT    /api/v1/projects/{id}                   # Update project (auto-save)
DELETE /api/v1/projects/{id}                   # Soft delete project
POST   /api/v1/projects/{id}/duplicate         # Duplicate project
GET    /api/v1/projects/{id}/versions          # Get version history
POST   /api/v1/projects/{id}/versions/{v}/restore # Restore version
```

## 18.3 Database Models to Add

### MediaAsset Model
- Inherits from `BaseModel` (TimestampMixin + UUID PK)
- Fields: `id`, `owner_user_id`, `type` (enum), `url`, `thumbnail_url`, `filename`, `original_filename`, `file_size_bytes`, `mime_type`, `duration_seconds`, `width`, `height`, `frame_rate`, `codec`, `folder_id` (FK), `tags` (many-to-many), `is_deleted`, `s3_key`, `created_at`, `updated_at`
- Indexes: `type`, `folder_id`, `owner_user_id`, `created_at`, `is_deleted`
- Relationships: `folder` (Many-to-One), `tags` (Many-to-Many)

### Folder Model
- Fields: `id`, `name`, `parent_id` (self-referential FK), `path` (materialized path), `owner_user_id`, `created_at`, `updated_at`
- Indexes: `parent_id`, `path`, `owner_user_id`
- Relationships: `parent` (self-referential), `media_assets` (One-to-Many)

### Project Model
- Inherits from `BaseModel`
- Fields: `id`, `owner_user_id`, `name`, `thumbnail_url`, `project_data` (JSONB - stores composition config), `version`, `is_deleted`, `created_at`, `updated_at`, `last_modified_at`
- Indexes: `owner_user_id`, `created_at`, `last_modified_at`, `is_deleted`
- GIN Index: `project_data` (for JSONB queries)

### Tag Model
- Fields: `id`, `name` (unique, case-insensitive), `slug`, `color`, `usage_count`, `created_at`
- Indexes: `name`, `slug`
- Relationships: `media_assets` (Many-to-Many via MediaAssetTag)

## 18.4 Schema Alignment

The frontend Chronos schemas (Section 17) must align with backend schemas:

### Backend → Frontend Mapping
- `MediaAsset` (backend) → `MediaAsset` (frontend TypeScript interface)
- `Project` (backend) → `Project` (frontend)
- `Composition` (embedded in Project) → `Composition` (frontend)
- `Clip` (in project_data JSONB) → `Clip` (frontend)
- `Track` (in project_data JSONB) → `Track` (frontend)

### Additional Frontend Properties (Not in Backend)
These exist only in the frontend state and are serialized into `project_data` JSONB:
- `Clip`: `transition_in_id`, `transition_out_id`, `speed`, `opacity`, `scale`, `position_x`, `position_y`
- `TransitionConfig`: Full transition definitions

The backend's `Composition` model (video export jobs) remains separate from the new `Project` model (timeline workspace).

---

# 19. Future Enhancements

- Multi-user real-time collaboration  
- Keyframe animation  
- LUTs, color grading  
- Audio waveform visualization  
- Chroma key  
- Plugin system  

---

# Change Log
| Version | Date | Changes |
|---------|------|---------|
| 2.2 | 2025-11-16 | **Architecture Clarification**: Added project structure section, clarified frontend/backend separation, detailed media upload flow with S3 presigned URLs, specified existing vs. required backend endpoints, added database models for MediaAsset/Project/Folder/Tag, aligned schemas between frontend and backend, added environment variables for upload limits |
| 2.1 | 2024-11 | Added timebase, zoom, mobile layout, thumbnail LRU, dirty state, schemas, playback engine, splitting, env vars, AI concurrency, error taxonomy |
