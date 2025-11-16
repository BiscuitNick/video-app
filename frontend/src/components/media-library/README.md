# Media Library Panel Components

A comprehensive set of components for managing media assets in the video editor application.

## Components

### MediaLibraryPanel
Main container component that orchestrates all media library functionality.

**Features:**
- Real-time media list with auto-refresh
- Search and filtering by type
- Sorting by name, date, size, or duration
- Grid and list view modes
- Drag-and-drop file upload
- WebSocket integration for live updates
- Upload progress tracking
- Batch operations support

**Props:**
```typescript
interface MediaLibraryPanelProps {
  projectId: string;
  onAssetSelect?: (asset: MediaAsset) => void;
  className?: string;
}
```

**Usage:**
```tsx
import { MediaLibraryPanel } from '@/components/media-library';

function App() {
  return (
    <MediaLibraryPanel
      projectId="project-123"
      onAssetSelect={(asset) => console.log('Selected:', asset)}
    />
  );
}
```

### MediaGrid
Virtualized grid component for efficient rendering of large media collections.

**Features:**
- Virtualized rendering using react-window
- Grid and list view modes
- Auto-sizing based on container dimensions
- Optimized performance for 1000+ items

### MediaCard
Individual media asset card with thumbnail and metadata.

**Features:**
- Thumbnail display with fallback icons
- Duration badge for video/audio
- Context menu (rename, delete, move)
- Inline rename functionality
- Selection state management
- File size and dimensions display

### UploadZone
Drag-and-drop upload area with validation.

**Features:**
- Drag-and-drop file selection
- Click to browse files
- File type validation
- File size validation (default 500MB)
- Multiple file support
- Visual feedback during drag

### MediaFilters
Filter and sort controls for the media library.

**Features:**
- Type filter (All, Video, Audio, Image)
- Sort by name, date, size, or duration
- Sort order toggle (ascending/descending)
- View mode toggle (grid/list)

### MediaSearch
Search input component with clear button.

**Features:**
- Real-time search
- Clear button
- Keyboard shortcuts support

### UploadProgressBar
Progress indicator for active uploads.

**Features:**
- Multiple upload tracking
- Progress percentage and file size
- Status indicators (uploading, processing, completed, error)
- Auto-dismiss on completion
- Cancel upload support
- Error display

## Integration

### Store Integration
The components use the `useMediaLibraryStore` Zustand store for state management:

```typescript
const {
  assets,
  selectedAssetIds,
  selectAsset,
  deselectAsset,
  // ...
} = useMediaLibraryStore();
```

### API Hooks
Media operations use React Query hooks from `@/hooks/useMediaLibrary`:

```typescript
const { data, isLoading } = useMediaLibrary(projectId);
const uploadMutation = useUploadMedia();
const deleteMutation = useDeleteMedia();
const updateMutation = useUpdateMedia();
```

### WebSocket Integration
Real-time updates are handled through the WebSocket store:

```typescript
const { messages } = useWebSocketStore();

// Message types:
// - media:uploaded
// - media:updated
// - media:deleted
// - media:processing
```

## Workflow

### Upload Flow
1. User drags files or clicks to browse
2. Files are validated (type, size)
3. Upload starts with progress tracking
4. Upload progress shown in UploadProgressBar
5. On success, media appears in grid
6. WebSocket notification updates all clients

### Edit Flow
1. User clicks context menu or inline rename
2. Optimistic update in UI
3. API request sent
4. On success, cache updated
5. WebSocket notification syncs other clients

### Delete Flow
1. User confirms deletion
2. Optimistic removal from grid
3. API request sent
4. On success, cache invalidated
5. WebSocket notification syncs other clients

## Performance Optimizations

- **Virtualized Rendering**: Only renders visible items using react-window
- **Memoization**: Filters and sorts memoized to prevent unnecessary recalculations
- **Optimistic Updates**: UI updates immediately before API confirmation
- **Debounced Search**: Search input debounces to reduce re-renders
- **Lazy Thumbnails**: Thumbnails loaded on-demand

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Dependencies

- react-window: Virtualized list rendering
- lucide-react: Icon library
- @tanstack/react-query: Data fetching and caching
- zustand: State management

## Testing

All components pass ESLint validation with no errors or warnings.

To test the upload flow:
1. Navigate to a project
2. Open the Media Library panel
3. Drag and drop a video/audio/image file
4. Verify upload progress appears
5. Verify file appears in grid after upload
6. Test search, filter, and sort controls
7. Test rename and delete operations

## Known Issues

None at this time.

## Future Enhancements

- Folder organization
- Bulk upload with queue management
- Advanced filtering (date range, tags)
- Thumbnail generation controls
- Keyboard navigation
- Accessibility improvements (ARIA labels)
- Drag-to-timeline integration
