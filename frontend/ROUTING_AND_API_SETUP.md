# Task 14 Subtasks 4-5: React Router & API Layer Implementation

## Overview

This document describes the implementation of React Router v6 and the API layer with Axios and React Query for the video editing application frontend.

## Implementation Summary

### Subtask 14.4: React Router and Base Layout

#### Routes Configured

1. **`/`** - Project Dashboard
   - Lists all video projects
   - Shows project metadata (name, description, last modified)
   - Entry point for the application

2. **`/editor/:projectId`** - Main Editor
   - Video editing interface with timeline
   - Sidebar for media library, effects, and tools
   - Preview window for video playback
   - Properties panel for clip settings

3. **`/settings`** - App Settings
   - General settings (FPS, resolution defaults)
   - Export settings (format, quality)
   - Performance settings (hardware acceleration, auto-save)

4. **`/export`** - Export Modal
   - Export configuration interface
   - Preset selection
   - Custom export settings
   - Displays as overlay (no main layout)

#### Layout Components

**Header** (`/src/components/layout/Header.tsx`)
- Shows app logo and branding
- Displays current project name in editor
- Real-time save status indicator (saved/saving/unsaved)
- Export button (visible in editor)
- Settings icon
- User profile placeholder

**Sidebar** (`/src/components/layout/Sidebar.tsx`)
- Collapsible panel (desktop)
- Three tabs: Media, Effects, Tools
- Media library with upload functionality
- Drag-and-drop ready structure
- Mobile-responsive with overlay mode

**MainLayout** (`/src/components/layout/MainLayout.tsx`)
- Responsive grid layout
- Header + Sidebar + Content structure
- Mobile hamburger menu
- Conditional sidebar (only on editor page)
- Outlet for nested routes

#### Navigation Features

**Navigation Guards** (`/src/components/navigation/UnsavedChangesGuard.tsx`)
- Prevents accidental navigation with unsaved changes
- Browser back/forward protection
- Confirmation dialog before leaving
- React Router v6 `useBlocker` integration

**Error Boundaries**
- `ErrorBoundary.tsx` - General error catching
- `QueryErrorBoundary.tsx` - React Query specific errors
- User-friendly error displays
- Debug mode stack traces
- Reset and recovery options

### Subtask 14.5: API Layer with Axios and React Query

#### Environment Configuration

**Files Created:**
- `.env.example` - Template for environment variables
- `.env.development` - Development configuration
- `/src/config/env.ts` - TypeScript environment module

**Environment Variables:**
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_APP_ENV=development
VITE_ENABLE_DEBUG=true
```

#### API Client Setup

**File:** `/src/lib/api-client.ts`

**Features:**
- Axios instance with base URL and timeout
- Request interceptor for authentication tokens
- Response interceptor for error handling
- Global error handling (401, 403, 500+)
- Network error detection
- Debug logging
- TypeScript error types

**Request Flow:**
1. Add Authorization header from localStorage
2. Log request in debug mode
3. Send request
4. Handle response or catch errors
5. Standardize error format
6. Return data or error

#### API Service Modules

**1. Projects API** (`/src/services/api/projects.ts`)
- `getAll(params)` - List projects with pagination
- `getById(id)` - Get single project
- `create(input)` - Create new project
- `update(id, input)` - Update project
- `delete(id)` - Delete project
- `duplicate(id)` - Duplicate project
- `getStats(id)` - Get project statistics

**2. Media API** (`/src/services/api/media.ts`)
- `getAll(projectId, params)` - List media assets
- `getById(projectId, mediaId)` - Get single asset
- `upload(input, onProgress)` - Upload with progress tracking
- `update(projectId, mediaId, input)` - Update metadata
- `delete(projectId, mediaId)` - Delete asset
- `generateThumbnail(projectId, mediaId, timestamp)` - Generate thumbnail
- `getProcessingStatus(projectId, mediaId)` - Check processing status

**3. Compositions API** (`/src/services/api/compositions.ts`)
- `getAll(projectId)` - List compositions
- `getById(projectId, compositionId)` - Get composition
- `create(projectId, name)` - Create composition
- `update(projectId, compositionId, input)` - Update composition
- `save(projectId, compositionId, input)` - Auto-save optimized
- `delete(projectId, compositionId)` - Delete composition
- `duplicate(projectId, compositionId)` - Duplicate composition
- `getHistory(projectId, compositionId)` - Get version history
- `restoreVersion(projectId, compositionId, versionId)` - Restore version

**4. Exports API** (`/src/services/api/exports.ts`)
- `getAll(projectId)` - List export jobs
- `getById(projectId, exportId)` - Get export job
- `create(input)` - Create export job
- `cancel(projectId, exportId)` - Cancel export
- `delete(projectId, exportId)` - Delete export
- `getProgress(projectId, exportId)` - Get export progress
- `download(projectId, exportId)` - Download exported file
- `retry(projectId, exportId)` - Retry failed export
- `getPresets()` - Get export presets

#### TypeScript Types

**File:** `/src/types/api.ts`

**Interfaces defined:**
- `Project`, `CreateProjectInput`, `UpdateProjectInput`
- `MediaAsset`, `UploadMediaInput`, `MediaUploadProgress`
- `Composition`, `TimelineTrack`, `TimelineClip`, `Effect`, `Transition`
- `ExportJob`, `CreateExportInput`, `ExportProgress`
- `PaginatedResponse<T>`, `PaginationParams`

#### React Query Configuration

**File:** `/src/lib/query-client.ts`

**Settings:**
- Retry: 2 attempts with exponential backoff
- Stale time: 5 minutes
- Cache time: 10 minutes
- Automatic refetch on window focus
- Query key factory for type safety

**Query Keys Structure:**
```typescript
queryKeys.projects.all         // ['projects']
queryKeys.projects.list(params) // ['projects', 'list', params]
queryKeys.projects.detail(id)   // ['projects', 'detail', id]
// Similar structure for media, compositions, exports
```

#### Custom React Query Hooks

**1. Projects Hooks** (`/src/hooks/useProjects.ts`)
- `useProjects(params)` - Query all projects
- `useProject(id)` - Query single project
- `useProjectStats(id)` - Query project stats
- `useCreateProject()` - Mutation to create
- `useUpdateProject()` - Mutation to update (optimistic)
- `useDeleteProject()` - Mutation to delete
- `useDuplicateProject()` - Mutation to duplicate

**2. Media Hooks** (`/src/hooks/useMediaLibrary.ts`)
- `useMediaLibrary(projectId, params)` - Query media assets
- `useMediaAsset(projectId, mediaId)` - Query single asset
- `useMediaStatus(projectId, mediaId)` - Query processing status (polling)
- `useUploadMedia()` - Mutation with progress tracking
- `useUpdateMedia()` - Mutation to update (optimistic)
- `useDeleteMedia()` - Mutation to delete
- `useGenerateThumbnail()` - Mutation to generate thumbnail

**3. Composition Hooks** (`/src/hooks/useComposition.ts`)
- `useCompositions(projectId)` - Query compositions
- `useComposition(projectId, compositionId)` - Query single composition
- `useCompositionHistory(projectId, compositionId)` - Query history
- `useCreateComposition()` - Mutation to create
- `useUpdateComposition()` - Mutation to update (optimistic)
- `useSaveComposition()` - Mutation for auto-save (optimistic)
- `useDeleteComposition()` - Mutation to delete
- `useDuplicateComposition()` - Mutation to duplicate
- `useRestoreComposition()` - Mutation to restore version

**4. Export Hooks** (`/src/hooks/useExports.ts`)
- `useExports(projectId)` - Query export jobs
- `useExport(projectId, exportId)` - Query single export
- `useExportProgress(projectId, exportId)` - Query progress (polling)
- `useExportPresets()` - Query presets (infinite stale time)
- `useCreateExport()` - Mutation to create export
- `useCancelExport()` - Mutation to cancel (optimistic)
- `useDeleteExport()` - Mutation to delete
- `useRetryExport()` - Mutation to retry
- `useDownloadExport()` - Mutation to download

#### Advanced Features

**Optimistic Updates:**
- Update hooks use optimistic updates for immediate UI feedback
- Rollback on error
- Automatic refetch on success

**Progress Tracking:**
- Media upload progress with percentage
- Export job progress with polling
- Processing status monitoring

**Retry Logic:**
- Automatic retry on failure (2 attempts)
- Exponential backoff
- Configurable per query/mutation

**Cache Management:**
- Smart invalidation on mutations
- Prefetching support
- Stale-while-revalidate pattern

## File Structure

```
frontend/
├── .env.development
├── .env.example
├── src/
│   ├── components/
│   │   ├── errors/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── QueryErrorBoundary.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   └── navigation/
│   │       └── UnsavedChangesGuard.tsx
│   ├── config/
│   │   └── env.ts
│   ├── hooks/
│   │   ├── useComposition.ts
│   │   ├── useExports.ts
│   │   ├── useMediaLibrary.ts
│   │   └── useProjects.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── query-client.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Editor.tsx
│   │   ├── Export.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── api/
│   │       ├── compositions.ts
│   │       ├── exports.ts
│   │       ├── index.ts
│   │       ├── media.ts
│   │       └── projects.ts
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
└── package.json
```

## Dependencies Installed

### Production Dependencies
- `react-router-dom@^7.9.6` - Routing
- `axios@^1.13.2` - HTTP client
- `@tanstack/react-query@^5.90.9` - Data fetching and caching
- `zustand@^5.0.8` - State management (from previous subtask)

### Development Dependencies
- `@tanstack/react-query-devtools@^5.90.2` - React Query debugging tools

## Testing Results

### Build Test
```bash
npm run build
```
**Result:** ✅ Success
- TypeScript compilation successful
- No type errors
- Bundle size: 322.29 kB (103.27 kB gzipped)

### Dev Server Test
```bash
npm run dev
```
**Result:** ✅ Success
- Server starts on http://localhost:5173/
- Hot Module Replacement (HMR) working
- React Query Devtools available

### Type Safety
- All API responses typed
- Query keys type-safe
- No `any` types used
- Proper TypeScript imports with `verbatimModuleSyntax`

## Usage Examples

### Using in Components

```typescript
// Dashboard - List projects
import { useProjects } from '../hooks/useProjects';

function Dashboard() {
  const { data, isLoading, error } = useProjects({ page: 1, limit: 10 });
  // ...
}

// Editor - Get project and save composition
import { useProject } from '../hooks/useProjects';
import { useSaveComposition } from '../hooks/useComposition';

function Editor() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const saveComposition = useSaveComposition();

  const handleSave = () => {
    saveComposition.mutate({
      projectId,
      compositionId: 'comp-123',
      input: { tracks: [...] }
    });
  };
}

// Upload media with progress
import { useUploadMedia } from '../hooks/useMediaLibrary';

function MediaUpload() {
  const { mutate, uploadProgress } = useUploadMedia();

  const handleUpload = (file: File) => {
    mutate({
      projectId: 'proj-123',
      file,
    });
  };

  return <div>Progress: {uploadProgress?.percentage}%</div>;
}
```

### API Client Direct Usage

```typescript
import { projectsApi } from '../services/api';

// Direct API call (not recommended, use hooks instead)
const project = await projectsApi.getById('proj-123');
```

## Integration with Backend

### Expected Backend Endpoints

The API client is configured to connect to the backend at:
- Development: `http://localhost:8000`
- Configurable via `VITE_API_BASE_URL`

### API Routes Expected

```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id

GET    /api/v1/projects/:projectId/media
POST   /api/v1/projects/:projectId/media
GET    /api/v1/projects/:projectId/media/:mediaId
PATCH  /api/v1/projects/:projectId/media/:mediaId
DELETE /api/v1/projects/:projectId/media/:mediaId

GET    /api/v1/projects/:projectId/compositions
POST   /api/v1/projects/:projectId/compositions
GET    /api/v1/projects/:projectId/compositions/:compositionId
PATCH  /api/v1/projects/:projectId/compositions/:compositionId
PUT    /api/v1/projects/:projectId/compositions/:compositionId
DELETE /api/v1/projects/:projectId/compositions/:compositionId

GET    /api/v1/projects/:projectId/exports
POST   /api/v1/projects/:projectId/exports
GET    /api/v1/projects/:projectId/exports/:exportId
DELETE /api/v1/projects/:projectId/exports/:exportId
GET    /api/v1/projects/:projectId/exports/:exportId/progress
GET    /api/v1/projects/:projectId/exports/:exportId/download
```

## Next Steps

1. **Backend Integration**
   - Start backend server
   - Test API endpoints
   - Verify CORS configuration

2. **Authentication**
   - Implement login/logout
   - Token refresh logic
   - Protected routes

3. **Testing**
   - Set up Jest/Vitest
   - Unit tests for hooks
   - Integration tests for API client
   - E2E tests with Playwright

4. **Features**
   - Implement actual timeline editing
   - WebSocket integration for real-time updates
   - File upload drag-and-drop
   - Video preview player

## Issues Encountered

1. **TypeScript `verbatimModuleSyntax` Errors**
   - **Solution:** Used `type` imports for all type-only imports
   - Example: `import { type AxiosInstance } from 'axios'`

2. **React Query Logger Removed**
   - **Issue:** Logger is not supported in React Query v5
   - **Solution:** Removed logger configuration, rely on React Query Devtools

3. **Query Key Type Safety**
   - **Issue:** Type inference for query keys with params
   - **Solution:** Used type assertion `as Record<string, unknown>`

## Conclusion

Both subtasks have been successfully implemented:

- ✅ React Router v6 configured with 4 routes
- ✅ Base layout components (Header, Sidebar, MainLayout)
- ✅ Navigation guards for unsaved changes
- ✅ Error boundaries for error handling
- ✅ Responsive mobile layout with hamburger menu
- ✅ Axios API client with interceptors
- ✅ 4 API service modules with full CRUD operations
- ✅ React Query configured with custom hooks
- ✅ Environment configuration system
- ✅ TypeScript types for all API responses
- ✅ Optimistic updates and retry logic
- ✅ Build and dev server tests passing

The application is now ready for backend integration and further feature development.
