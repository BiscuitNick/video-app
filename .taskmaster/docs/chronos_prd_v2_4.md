# Chronos Editor — Product Requirements & Architectural Specification  
**Version**: 2.4 (Unified w/ Routes)  
**Target Launch**: Q4 2025  
**Primary Stakeholder**: Product Manager  
**Product Manager**: Gemini (AI Assistant)  
**Project Name**: Chronos Editor  

---

## 1. Executive Summary & Strategic Vision

### 1.1 Project Definition and Scope

Chronos Editor is a modern, browser-based, non-destructive, track-based media editor for image, video, audio, and text. It aims to deliver a **desktop-class NLE experience in the browser**, with:

- Sub-100ms interaction latency for core timeline actions  
- Non-blocking, asynchronous video rendering and AI generation  
- Secure, scalable media ingestion using direct-to-S3 uploads  

The architecture deliberately **decouples**:

- A **client-side, optimistic frontend** (Vite + React + Zustand) that owns timeline state and user interactions.
- A **backend orchestration layer** (FastAPI + PostgreSQL + Redis + RQ + FFmpeg + S3) that handles long-running media processing and AI generation.

This enables independent scaling of **interactive UI workloads** vs **heavy compute workloads**.

### 1.2 Audience / Personas

- **Content creators** (YouTube, TikTok, Reels, Shorts)  
- **Social media managers** (quick turnaround content)  
- **Small businesses / marketers** (promo clips, ads, product demos)  
- **“Power casuals”** — users who need professional-grade output, but don’t want full-blown desktop NLEs  

### 1.3 Success Metrics

- **UX / Performance**
  - 90% of users complete a **3-clip edit** (trim + reorder + basic transition) in **< 5 minutes**
  - All **timeline interactions** (drag, scroll, zoom, select, split) respond in **< 100ms**
- **Adoption**
  - 500 **MAU** within 6 months of public beta
- **Reliability / Stability**
  - < 2% failed exports for valid compositions
  - 99% success rate for media uploads under specified size limits

---

## 2. System-Wide Constants & Environment Variables

All tunable constants MUST be configurable via environment variables; no hardcoding in code.

### 2.1 Core Timebase & Limits

| Constant                | Env Var                      | Default | Description                                         |
|-------------------------|------------------------------|---------|-----------------------------------------------------|
| Max Output Duration     | `MAX_DURATION_SECONDS`       | `600`   | Max project length in seconds (10 minutes).         |
| Default FPS (timebase)  | `DEFAULT_TIMEBASE_FPS`       | `30`    | Composition timebase FPS.                           |
| Max Concurrent Generations | `MAX_GENERATIONS`         | `5`     | Max concurrent AI generations per deployment/user.  |
| Thumbnail Cache Limit   | `THUMBNAIL_CACHE_MAX_BYTES`  | `200000000` | IndexedDB cache limit for thumbnails (200MB).  |
| Thumbnail LRU Enabled   | `THUMBNAIL_CACHE_ENABLE_LRU` | `true`  | Use LRU strategy for thumbnail eviction.            |

### 2.2 Upload & User Defaults

| Constant                    | Env Var                        | Default      | Description                                   |
|----------------------------|--------------------------------|--------------|-----------------------------------------------|
| Max Image Upload Size      | `MAX_IMAGE_UPLOAD_SIZE_MB`     | `100`        | Maximum image upload size (MB).               |
| Max Video Upload Size      | `MAX_VIDEO_UPLOAD_SIZE_MB`     | `1000`       | Maximum video upload size (MB).               |
| Max Audio Upload Size      | `MAX_AUDIO_UPLOAD_SIZE_MB`     | `500`        | Maximum audio upload size (MB).               |
| Default User ID            | `DEFAULT_USER_ID`              | `default-user` | Demo/no-auth fallback user ID.            |
| S3 Bucket Name             | `S3_BUCKET_NAME`               | —            | Primary media bucket name.                    |
| S3 Region                  | `S3_REGION`                    | —            | AWS region.                                   |

### 2.3 Frontend Runtime Environment

These are typically **Vite** env vars (`VITE_` prefix) defined in `frontend-editor/.env`:

| Constant        | Env Var           | Example                     | Description                            |
|-----------------|-------------------|-----------------------------|----------------------------------------|
| API Base URL    | `VITE_API_URL`    | `https://api.chronos.app`   | REST API base URL.                     |
| WS Base URL     | `VITE_WS_URL`     | `wss://api.chronos.app/ws`  | WebSocket base URL.                    |
| Environment     | `VITE_ENV`        | `development`, `production` | Frontend runtime environment flag.     |

---

## 3. High-Level Architecture

### 3.1 Project Structure (Including Page Routes)

```text
video-app/
├── frontend-editor/              # React application - Chronos Editor UI
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # Entry, mounts App
│       ├── App.tsx               # Root layout and router provider
│       ├── routes/               # Route-level pages
│       │   ├── AppRoutes.tsx     # Central route config (React Router)
│       │   ├── RootLayout.tsx    # Global shell (sidebar, topbar)
│       │   ├── LandingPage.tsx   # /
│       │   ├── ProjectsPage.tsx  # /projects
│       │   ├── ProjectEditorPage.tsx # /projects/:projectId/editor
│       │   ├── MediaLibraryPage.tsx  # /media
│       │   ├── SettingsPage.tsx      # /settings
│       │   └── NotFoundPage.tsx      # 404 fallback
│       ├── components/           # Shared UI components (Shadcn)
│       │   ├── ui/
│       │   ├── icons/
│       │   └── ThemeProvider.tsx
│       ├── features/             # Feature-based modules
│       │   ├── auth/
│       │   ├── editor/           # Editor shell (panels, layout)
│       │   ├── timeline/         # Timeline engine
│       │   └── media/            # Media library, upload, filters
│       ├── stores/               # Zustand stores
│       ├── hooks/                # Shared hooks
│       ├── lib/                  # Axios client, utils
│       └── types/                # TS interfaces (MediaAsset, Project...)
│
└── ffmpeg-backend/               # FastAPI backend service
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   ├── v1/           # Public API endpoints
    │   │   │   └── internal/     # Internal endpoints
    │   │   ├── core/             # Config, logging, settings
    │   │   ├── db/               # Session, base models
    │   │   ├── models/           # ORM models: MediaAsset, Project...
    │   │   ├── schemas/          # Pydantic schemas
    │   │   ├── services/         # Business logic (S3, AI, FFmpeg)
    │   │   └── workers/          # RQ background workers
    │   └── worker.py             # RQ entrypoint
    └── requirements.txt
```

### 3.2 Major Frontend Routes

Using React Router v6+ (SPA) with browser history:

| Path                          | Component              | Purpose                                              |
|-------------------------------|------------------------|------------------------------------------------------|
| `/`                           | `LandingPage`         | Marketing / quick intro / "Open Editor" CTA.        |
| `/projects`                   | `ProjectsPage`        | Project list (cards, search, sort, create).         |
| `/projects/:projectId/editor` | `ProjectEditorPage`   | Main Chronos Editor workspace (timeline + preview). |
| `/media`                      | `MediaLibraryPage`    | Full-screen media browser & bulk actions.           |
| `/settings`                   | `SettingsPage`        | User preferences, timebase default, theme, etc.     |
| `*`                           | `NotFoundPage`        | 404 / deep-link fallbacks.                          |

> Note: The actual public landing page could be separate (marketing site), but this route structure covers the application shell side.

### 3.3 Frontend Stack

- **Build**: Vite 5.4+ (ESM, fast HMR)
  - Recommended: `vite@^5.4.21` or `vite@^7.0.0` for latest features
  - Use `@vitejs/plugin-react@^5.0.0` for Fast Refresh support
- **Framework**: React 18.3+ or React 19.x (FC + hooks)
  - Current stable: `react@^18.3.1` (production-ready)
  - Optional upgrade path: `react@^19.2.0` (includes React Compiler support)
  - Use React Compiler for automatic memoization (optional, experimental)
- **Language**: TypeScript 5.3+
- **Routing**: React Router 7.x (SPA mode)
  - Use `react-router@^7.9.4` for latest features
  - Data loading with loaders, actions with type safety
  - File-based or config-based routing via `app/routes.ts`
- **Styling**: TailwindCSS 4.x (utility-first, oxide engine)
  - **Target version**: `tailwindcss@^4.0.0` (latest alpha/beta)
  - Performance: 10x faster builds with new Rust-based engine
  - Breaking changes: Update `tailwind.config.js` → `tailwind.config.ts`
  - CSS-first configuration with `@theme` directive
  - No JIT mode needed (built-in by default)
- **Component Library**: Shadcn UI (locally owned components)
  - Use `shadcn@^3.5.0` or install via CLI
  - Built on Radix UI primitives with TailwindCSS
  - Copy-paste components for full customization
- **State Management**: Zustand 5.x for global editor/timeline/media state
  - Recommended: `zustand@^5.0.0` (React 18+ compatible)
  - Use vanilla stores with React Context for scoped state
  - Middleware: `persist`, `immer`, `devtools` for enhanced DX
- **Virtualization**: `react-virtuoso@^4.6.2` (recommended) or `react-window`
  - react-virtuoso: More powerful, better DX, automatic sizing
  - Use for timeline tracks, media grids, and large lists (>100 items)
- **Storage / Caching**: IndexedDB for thumbnails + local ephemeral caches
- **Real-time**: WebSocket for job + export updates

### 3.4 Backend Stack

- **API Framework**: FastAPI 0.121+ (async, OpenAPI generated)
  - Current: `fastapi@0.121.2` with `uvicorn@0.38.0`
  - Starlette 0.49+ for ASGI/WebSocket support
  - Pydantic 2.12+ for validation and serialization
- **Database**: PostgreSQL 15-17 (JSONB for flexible project_data)
  - ORM: SQLAlchemy 2.0.44+ (async support)
  - Migrations: Alembic 1.17+
  - Driver: `asyncpg@0.30.0` (async) or `psycopg2-binary@2.9.11`
- **Cache / Message Broker**: Redis 7.0+
  - Client: `redis@7.0.1` (Python)
  - Use for session storage, rate limiting, job queues
- **Background Jobs**: RQ 2.6+ (Redis Queue) for AI, exports, thumbnails
  - Alternative consideration: Celery for more complex workflows
  - Use for long-running media processing tasks
- **Media Engine**: FFmpeg 6.x or 7.x
  - Recommended: FFmpeg 7.1+ for latest codec support
  - Python wrapper: `ffmpeg-python` for programmatic control
- **Object Storage**: AWS S3 (presigned URLs)
  - SDK: `boto3@1.40.74`, `botocore@1.40.74`
  - Use presigned URLs (5-15 min TTL) for direct uploads
- **AI Integration**: Replicate 1.4+
  - Current: `replicate@1.4.0` for Nano-Banana, Wan Video I2V
- **WebSocket**: FastAPI / ASGI WS endpoints (composition + job updates)
  - Use `websockets@15.0.1` for async WS support

### 3.5 Composition-Wide Timebase

Chronos uses a **frame-based** timebase per composition:

```ts
timebase_fps: 24 | 30 | 60; // default 30
```

Internal units: **frames**.

```ts
frame = Math.round(seconds * timebase_fps);
seconds = frame / timebase_fps;
```

---

## 4. Playback Engine (Hybrid DOM + Timeline Engine)

Preview is **approximate**, export is **authoritative**.

**Preview Engine Responsibilities:**

- Compute active clips at a given frame.  
- Apply basic transforms using CSS: opacity, scale, X/Y position.  
- Render video tracks using a single `<video>` element where possible.  
- Render overlays (images, text) as positioned DOM layers.  
- Approximate transitions using CSS transitions/animations.  

**Non-Goals for Preview:**

- True multi-video compositing with advanced blending modes.  
- High-fidelity FFmpeg transitions (complex wipes, filter graphs).  
- Perfect audio pitch correction for speed changes.  

(FFmpeg export is the final ground truth.)

---

## 5. Media Types & Ingestion

### 5.1 Supported Types

- **Image**: PNG, JPEG, WebP, etc.  
- **Video**: Common web codecs/containers (mp4, mov, webm).  
- **Audio**: mp3, wav, aac, etc.  
- **Text**: Titles, lower thirds, overlay captions.  

### 5.2 Upload Sources (v1)

- File picker (with drag-and-drop)  
- Clipboard paste (where supported)  
- URL ingestion (remote → backend → S3)  
- (Future) Dropbox / GDrive integrations  

### 5.3 Direct-to-S3 Flow

1. **Frontend**: User selects files.  
2. **Frontend → Backend**: `POST /api/v1/media/upload` to request presigned URL + S3 key + MediaAsset DB stub.  
3. **Backend**:
   - Validates size and mime type vs env limits.  
   - Generates **presigned S3 PUT URL** with content-length range constraints.  
   - Creates `MediaAsset` record in `PENDING_UPLOAD` or equivalent status.  
4. **Frontend → S3**: Upload direct to S3 with presigned URL.  
5. **Frontend → Backend**: Confirm upload (`PATCH /api/v1/media/{id}` or a dedicated confirm endpoint).  
6. **Backend**:
   - Marks MediaAsset as `READY`.  
   - Enqueues async thumbnail generation (for videos/images).  
   - Emits WebSocket event when thumbnails ready.  

**S3 Key Structure**

```text
s3://{S3_BUCKET_NAME}/
└── user-uploads/
    └── {owner_user_id}/
        ├── images/{uuid}.{ext}
        ├── videos/{uuid}.{ext}
        └── audio/{uuid}.{ext}
```

---

## 6. Frontend UX & Features

### 6.1 Dark-Mode-First UI

- **Background**: `bg-zinc-950` (main canvas).  
- **Surfaces**: `bg-zinc-900` (panels).  
- **Elements**: `bg-zinc-800` (inactive clips, buttons, inputs).  
- **Borders**: `border-zinc-700` (track separators, panel dividers).  
- **Accent**: `text-blue-500` (playhead, selected clip outlines, primary actions).  

Shadcn components map to this palette via design tokens / Tailwind config.

### 6.2 Timeline & Editing

#### 6.2.1 Tracks

- Unlimited tracks (subject to performance).  
- Types: `video`, `audio`, `text`.  
- Per-track controls:
  - Editable label.  
  - Lock toggle.  
  - Mute toggle (for audio/video).  
  - Drag-and-drop vertical reordering.  

#### 6.2.2 Clips

Each clip supports:

- Trimming (drag in/out handles).  
- Horizontal move / drag.  
- Cross-track drag & drop.  
- Renaming / label editing.  
- Basic transitions (in/out).  
- Playback speed.  
- Opacity, scale, X/Y position.  
- Volume / mute.  
- Splitting at playhead.  
- Snapping (to grid, playhead, neighboring clips).  

#### 6.2.3 Clip Splitting

- Methods:
  - Right-click → “Split at Playhead”.  
  - Toolbar “Split” button.  
- Behavior:
  - Original clip replaced by two new clips.  
  - New clips inherit style/transform properties.  
  - `start_frame` / `end_frame` adjusted appropriately.  
  - Integrated with undo/redo.  

### 6.3 Timeline Zoom & Virtualization

#### 6.3.1 Zoom Controls

- `+ / –` buttons.  
- `Ctrl/Cmd + Scroll`.  
- Zoom anchor: playhead (default) or mouse position (configurable).  

```ts
pixelsPerSecond = base * zoomLevel;
zoomLevel ∈ [0.25, 8.0];
```

Horizontal scrolling via trackpad or `Shift + Scroll`.

#### 6.3.2 Virtualization

- Time ruler and tracks virtualized with `react-virtuoso` / `react-window`.  
- TimelineStore tracks `scrollLeft` and `visibleWidth`.  
- Only clips intersecting `[visibleTimeStart, visibleTimeEnd]` are rendered.  
- Ruler and track area share a scroll ref to stay aligned.  

### 6.4 Media Library Panel

- Virtualized media grid.  
- Lazy-loaded thumbnails.  
- Filters: type, tags, folder, date.  
- Sorting: name, date, size.  
- Bulk actions: delete, move to folder, tag/untag.  
- Metadata modal (filename, tags, folder, dimensions, duration).  
- WebSocket updates when new media or AI outputs appear.  

### 6.5 Mobile Layout (Timeline Lite)

- Stacked layout: preview → mini timeline → properties → media.  
- Full playback controls.  
- Asset browsing and clip detail editing.  
- Light trimming only; full multi-track editing desktop-only (v1).  

### 6.6 Dirty State / Unsaved Changes

- Title bar: `● Project Name` when dirty.  
- Tooltip: “Unsaved changes”.  
- `beforeunload` warning on tab close.  
- Dirty flag cleared after successful `PUT /api/v1/projects/{id}` (autosave) or explicit save.  

---

## 7. Real-Time Updates (WebSocket)

### 7.1 Message Shape

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

### 7.2 Events

- AI job progress (image/video).  
- Export progress.  
- Completion → download URL or media asset ID.  
- Failure → error code + human-readable message.  

WS endpoint options: `/ws/jobs` or `/ws/compositions/{id}` (to be finalized).

---

## 8. Export System

### 8.1 Export Settings

- Name  
- Aspect ratio (`16:9`, `9:16`, `1:1`)  
- Resolution (e.g., 1080p, 720p, 480p)  
- Format (e.g., mp4/h264, webm)  
- Quality preset (maps to CRF/bitrate)  
- Frame rate (`24`, `30`, `60`)  

### 8.2 Export Flow

1. Frontend `POST /api/v1/compositions/` with `project_id` + export settings.  
2. Backend creates `CompositionJob`, enqueues RQ worker job.  
3. Worker downloads S3 assets, builds FFmpeg filter graph, renders to temporary file, uploads to S3.  
4. Backend updates DB + sends WS `job.update` events.  
5. Frontend updates UI and exposes final download URL.  

---

## 9. AI Generation

### 9.1 API Surface

Existing:

```text
POST /api/v1/replicate/nano-banana          # Image generation
```

Required:

```text
POST /api/v1/replicate/wan-video-i2v        # Video generation
```

Aspect ratio MUST be included in requests.

### 9.2 Model Tiers (Conceptual)

- **Draft**: lower resolution, cheaper, faster.  
- **Production**: higher quality, more expensive.  

Frontend passes `quality: "draft" | "production"`; backend chooses model ID.

### 9.3 AI Job Lifecycle

- Frontend submits generation request → receives `job_id`.  
- Backend enqueues job, polls Replicate.  
- Worker downloads output to S3, creates `MediaAsset`, sends WS updates.  
- Frontend listens to `job.update` and updates media library.  

`MAX_GENERATIONS` controls concurrency (deployment/user-level semantics TBD).

---

## 10. Backend API & Data Model (Summary)

> Full details in companion **Backend API Contract** doc.

### 10.1 Key Endpoint Groups

- **Media** `/api/v1/media`  
- **Folders** `/api/v1/folders`  
- **Projects** `/api/v1/projects`  
- **Compositions (Exports)** `/api/v1/compositions`  
- **AI** `/api/v1/replicate/*`  
- **Health & Metrics** `/health`, `/health/detailed`, `/metrics`  

### 10.2 Core Models

- `MediaAsset`  
- `Folder`  
- `Project` (with `project_data` JSONB)  
- `Tag`  

(See companion Backend API Contract for field-level details.)

---

## 11. Security & Authentication

### 11.1 Direct-to-S3 Security

- Presigned URLs with short TTL, content-length-range constraints.  
- Backend never proxies large file uploads.  

### 11.2 Anonymous “Shadow User” Strategy

- On first visit, backend creates “shadow user” and stores UUID in HttpOnly, Secure cookie.  
- All projects/media tied to this ID.  
- When user signs up, account links to existing ID.  

---

## 12. Infrastructure & Resilience

### 12.1 Docker / Deployment

- Multi-stage Docker build for backend.  
- Separate services for API, workers, WebSocket, Redis, Postgres.  
- Frontend built and served via CDN / static hosting.  

### 12.2 Health Checks & Monitoring

- `/health` and `/health/detailed` for liveness/readiness.  
- `/metrics` for Prometheus-style scraping.  

### 12.3 Error Taxonomy

- Network errors → toast + retry.  
- Asset ingestion errors → descriptive messages.  
- Export/render errors → detailed messages in Export modal.  
- Schema validation errors (422) → human-readable field-level errors.  

---

## 13. Testing Strategy

### 13.1 Frontend Unit Tests

- Timeline reducers (add/remove clips, split, snapping).  
- Timebase conversions.  
- Zoom + visible range logic.  
- Undo/redo stacks.  

### 13.2 Frontend Integration / E2E

- 3-clip edit flow → export.  
- AI generation lifecycle.  
- WebSocket reconnection behavior.  

### 13.3 Backend Tests

- S3 signing.  
- FFmpeg graph construction from sample Composition.  
- AI service integration (mock).  
- End-to-end export pipeline.  

---

## 14. Future Enhancements

- Multi-user real-time collaboration.  
- Keyframe animation per property.  
- LUTs, color grading, scopes.  
- Audio waveform visualization & advanced mixing.  
- Chroma key / green screen.  
- Plugin system for custom effects.  

---

## 15. Package Compatibility & Migration Notes

### 15.1 Frontend Package Compatibility

#### Critical Compatibility Notes

1. **React 18 vs 19 Migration Path**
   - **Current stable**: React 18.3.1 (recommended for production)
   - **React 19 features**: React Compiler, improved hooks, Actions API
   - **Migration**: Test thoroughly in development before production upgrade
   - **Breaking changes**: Some third-party libraries may need updates

2. **React Router v7 Breaking Changes**
   - **From v6**: Major architectural changes
   - **Migration guide**: Use `@react-router/remix-routes-option-adapter` for gradual migration
   - **New patterns**: Data loaders replace `useEffect` + fetch patterns
   - **File structure**: Create `app/routes.ts` for route definitions

3. **Tailwind CSS 4 Breaking Changes**
   - **Configuration**: Migrate `tailwind.config.js` → `tailwind.config.ts` or `@config` in CSS
   - **CSS-first**: Use `@theme` directive for design tokens
   - **Plugin updates**: Ensure all plugins support v4
   - **Testing**: Extensive CSS regression testing required

4. **Zustand 5.x Changes**
   - **React 18+ required**: Dropped React 17 support
   - **Context pattern**: Use vanilla stores + React Context for scoped state
   - **TypeScript**: Improved type inference for selectors
   - **Middleware**: `persist`, `devtools`, `immer` fully compatible

#### Recommended Frontend Package Versions

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router": "^7.9.4",
    "zustand": "^5.0.0",
    "react-virtuoso": "^4.6.2"
  },
  "devDependencies": {
    "vite": "^5.4.21",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.0.0-alpha.X",
    "typescript": "^5.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

### 15.2 Backend Package Compatibility

#### Current Production Stack (from requirements.txt)

- FastAPI 0.121.2 ✓ (latest stable)
- SQLAlchemy 2.0.44 ✓ (async-ready)
- Pydantic 2.12.4 ✓ (v2 API)
- PostgreSQL driver: asyncpg 0.30.0 or psycopg2-binary 2.9.11
- Redis 7.0.1 ✓
- Boto3 1.40.74 / Botocore 1.40.74 ✓

#### FastAPI Compatibility Notes

1. **Pydantic v2 Migration** (COMPLETED)
   - FastAPI 0.100+ requires Pydantic v2
   - Current setup uses Pydantic 2.12.4 ✓
   - Breaking changes: `Config` class → `model_config`, `.dict()` → `.model_dump()`

2. **Starlette ASGI Updates**
   - Current: Starlette 0.49.3
   - WebSocket support fully integrated
   - Ensure middleware compatibility with 0.49+

3. **SQLAlchemy 2.0 Async Pattern**
   - Use `async with` for session management
   - `AsyncSession` for all database operations
   - Migration from 1.4: Update all query patterns to 2.0 style

### 15.3 Database & Infrastructure

- **PostgreSQL**: 15+ supported, 17 recommended
- **Redis**: 7.0+ for latest features (7.2+ adds JSON support)
- **FFmpeg**: 6.1+ stable, 7.1+ for AV1 codec support

### 15.4 Development Environment Setup

#### Vite Configuration Best Practices

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Enable React Compiler (optional)
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: { overlay: true }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'ui-vendor': ['zustand', 'react-virtuoso']
        }
      }
    }
  }
})
```

#### Zustand Store Pattern (React 18+)

```typescript
// Create vanilla store with Context
import { createStore, useStore } from 'zustand'
import { createContext, useContext } from 'react'

const TimelineStoreContext = createContext(null)

export function TimelineStoreProvider({ children }) {
  const [store] = useState(() => createStore((set) => ({
    clips: [],
    addClip: (clip) => set((state) => ({
      clips: [...state.clips, clip]
    }))
  })))

  return (
    <TimelineStoreContext.Provider value={store}>
      {children}
    </TimelineStoreContext.Provider>
  )
}

export function useTimelineStore(selector) {
  const store = useContext(TimelineStoreContext)
  return useStore(store, selector)
}
```

---

## 16. Open Questions / TBDs

1. **WS Namespace**: global `/ws/jobs` vs per-composition `/ws/compositions/{id}` vs per-user channel.
2. **Rate Limiting Scope**: `MAX_GENERATIONS` per deployment vs per user vs per IP.
3. **Export Queue Strategy**: single vs multiple queues (AI vs exports) and prioritization.
4. **Anonymous Retention**: data retention policy for shadow users.
5. **Supported Browsers**: minimum versions and mobile support scope.
6. **Audio v1 Scope**: pan/fades & waveform vs volume/mute only.
7. **Project Versioning**: event-based vs time-based snapshotting for `project_data`.
8. **Signed Read URLs**: always signed vs public CDN for some assets.
9. **React 19 Adoption Timeline**: When to migrate from React 18 to 19 in production.
10. **Tailwind 4 Stable Release**: Monitor for stable release before production deployment.