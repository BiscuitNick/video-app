# Additional Backend Tasks Required

## Task 15: BACKEND: Implement Project Workspace API (ffmpeg-backend)

**Priority:** High
**Dependencies:** Task 13 (Media Asset API)
**Status:** Pending

**Description:**
Create Project model and API endpoints in ffmpeg-backend for timeline workspace persistence, separate from Composition (video export) model. Projects store the timeline state, tracks, clips configuration in JSONB.

**Details:**
- **Location:** `/ffmpeg-backend`
- **Database Model:** Create `Project` model in `/ffmpeg-backend/src/db/models/project.py`
  - Fields: `id` (UUID), `owner_user_id` (VARCHAR, default 'default-user'), `name` (VARCHAR 255), `thumbnail_url` (TEXT), `project_data` (JSONB - stores composition/tracks/clips), `version` (INTEGER for optimistic locking), `is_deleted` (BOOLEAN), `created_at`, `updated_at`, `last_modified_at`
  - Indexes: `owner_user_id`, `created_at`, `last_modified_at`, `is_deleted`
  - GIN Index on `project_data` for JSONB queries

- **Migration:** Create `003_projects.py` in `/ffmpeg-backend/migrations/versions/`
  - CREATE TABLE projects with all fields and indexes
  - Add update trigger for `updated_at`

- **Pydantic Schemas:** Create in `/ffmpeg-backend/src/app/api/schemas/project.py`
  - `ProjectCreateRequest`: name, project_data (optional, default empty composition)
  - `ProjectUpdateRequest`: name (optional), project_data, version (for optimistic locking)
  - `ProjectResponse`: all fields with timestamps
  - `ProjectListResponse`: projects array, total, offset, limit

- **API Endpoints:** Create `/ffmpeg-backend/src/app/api/v1/projects.py`
  - `POST /api/v1/projects` - Create new project
  - `GET /api/v1/projects` - List projects with pagination (offset, limit, sort_by, sort_order)
  - `GET /api/v1/projects/{id}` - Get single project with full project_data
  - `PUT /api/v1/projects/{id}` - Update project (auto-save), check version for optimistic locking
  - `DELETE /api/v1/projects/{id}` - Soft delete (set is_deleted=true)
  - `POST /api/v1/projects/{id}/duplicate` - Duplicate project with new ID

- **Project Data Structure:** The `project_data` JSONB field stores:
  ```json
  {
    "composition": {
      "aspect_ratio": "16:9",
      "timebase_fps": 30,
      "tracks": [...],
      "clips": [...],
      "transitions": [...]
    }
  }
  ```

**Test Strategy:**
- Unit test Project model creation and JSONB field serialization
- Test optimistic locking prevents concurrent updates (version conflict)
- Test soft deletion doesn't remove from database
- Test pagination and sorting
- Integration test: Create project, update multiple times, verify version increments
- Test duplicate creates new project with incremented name

---

## Task 16: BACKEND: Add Environment Variables for Media Upload

**Priority:** Medium
**Dependencies:** Task 13
**Status:** Pending

**Description:**
Add new environment variables to `/ffmpeg-backend/.env.example` and update settings/config for media upload configuration.

**Details:**
Add to `/ffmpeg-backend/src/app/config.py` or equivalent:
```python
# Media Upload Configuration
DEFAULT_USER_ID: str = "default-user"
MAX_IMAGE_UPLOAD_SIZE_MB: int = 100
MAX_VIDEO_UPLOAD_SIZE_MB: int = 1000
MAX_AUDIO_UPLOAD_SIZE_MB: int = 500
PRESIGNED_URL_EXPIRATION_SECONDS: int = 3600  # 1 hour
ENABLE_THUMBNAIL_GENERATION: bool = True
THUMBNAIL_GENERATION_TIMEOUT_SECONDS: int = 60
```

Add to `.env.example`:
```bash
# Media Upload Configuration
DEFAULT_USER_ID=default-user
MAX_IMAGE_UPLOAD_SIZE_MB=100
MAX_VIDEO_UPLOAD_SIZE_MB=1000
MAX_AUDIO_UPLOAD_SIZE_MB=500
PRESIGNED_URL_EXPIRATION_SECONDS=3600
ENABLE_THUMBNAIL_GENERATION=true
THUMBNAIL_GENERATION_TIMEOUT_SECONDS=60
```

**Test Strategy:**
- Verify config loads from environment variables
- Test default values apply when not set
- Verify upload size validation uses these limits

---

## Task 17: FRONTEND: Update API Client to Use Backend Schemas

**Priority:** High
**Dependencies:** Task 13, Task 14 (Frontend Foundation), Task 15
**Status:** Pending

**Description:**
Update frontend TypeScript interfaces and API client to match backend schemas defined in ffmpeg-backend PRD.

**Details:**
- **Location:** `/frontend/src/types/`
- Create `media.ts` with interfaces matching backend schemas:
  ```typescript
  interface MediaAsset {
    id: string;
    owner_user_id: string;
    type: 'image' | 'video' | 'audio' | 'text';
    url: string;  // presigned URL
    thumbnail_url?: string;  // presigned URL
    filename: string;
    file_size_bytes: number;
    duration_seconds?: number;
    width?: number;
    height?: number;
    frame_rate?: number;
    codec?: string;
    tags: string[];
    folder_id?: string;
    created_at: string;
    updated_at: string;
  }
  ```

- Create `project.ts` with Project interface matching backend
- Create API client in `/frontend/src/services/api/`:
  - `mediaApi.ts` - Functions for all /api/v1/media endpoints
  - `projectApi.ts` - Functions for all /api/v1/projects endpoints
  - `folderApi.ts` - Functions for folder operations

- Implement presigned URL upload flow:
  1. Request presigned URL from `POST /api/v1/media/upload`
  2. Upload file directly to S3 using presigned URL (PUT request)
  3. Confirm upload completion to backend (optional callback)

- Add WebSocket client for `/ws/media` events

**Test Strategy:**
- Type-check TypeScript interfaces against backend response examples
- Test presigned URL upload flow end-to-end
- Mock API responses in unit tests
- Test WebSocket connection and event handling

---

## Notes for Implementation

### Key Architectural Points:
1. **Two Separate Models:** `Composition` (for video exports/jobs) vs `Project` (for timeline workspace)
2. **Presigned URLs:** All uploads go direct client → S3, not through backend
3. **Same S3 Bucket:** Use existing bucket from compositions, different prefix (`user-uploads/` vs `compositions/`)
4. **Default User:** Use `DEFAULT_USER_ID="default-user"` for no-auth mode
5. **JSONB Storage:** Project stores full timeline state in `project_data` JSONB field

### Schema Alignment:
- Frontend TypeScript interfaces must match backend Pydantic schemas
- Use code generation tools if possible (openapi-generator, etc.)
- Keep schemas in sync when making changes

### Testing Priority:
1. Database migrations run cleanly
2. Presigned URL generation works correctly
3. S3 upload flow completes successfully
4. WebSocket events broadcast correctly
5. Project optimistic locking prevents race conditions
