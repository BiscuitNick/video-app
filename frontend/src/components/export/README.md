# Export System UI

A comprehensive export system for the video editing application with multi-step wizard, real-time progress tracking, download management, and export history.

## Features

### 1. Multi-Step Export Wizard
- **Settings Step**: Configure export parameters (resolution, format, quality, frame rate)
- **Review Step**: Review settings before starting export
- **Progress Step**: Real-time export progress tracking

### 2. Export Settings Form
- Export name input
- Aspect ratio presets (16:9, 9:16, 1:1, 4:3, custom)
- Resolution configuration with auto-update on aspect ratio change
- Format selection (MP4, MOV, WebM)
- Quality slider with CRF value mapping (0-100%)
- Frame rate selection (24, 30, 60, 120 FPS)
- Composition preview placeholder

### 3. WebSocket Progress Tracking
- Real-time progress updates via WebSocket
- Stage visualization: Downloading → Rendering → Encoding → Uploading
- Progress bar with percentage
- ETA calculation and display
- Frame-by-frame progress (when available)
- Automatic reconnection with retry logic
- Connection status indicator

### 4. Download Management
- Automatic download on export completion
- Retry logic with exponential backoff
- Signed URL generation for secure downloads
- Shareable link generation with expiration
- Download progress tracking
- Multiple concurrent downloads support

### 5. Export Queue
- View all active exports
- Individual progress for each export
- Cancel exports with confirmation
- Real-time status updates

### 6. Export History
- Paginated list of completed/failed exports (10 per page)
- Re-download capability
- Share link generation and clipboard copy
- Delete exports from history
- Clear all history
- Persistent storage (localStorage)

## Components

### Core Components

#### `<ExportModal />`
Main modal wrapper for the export wizard.
```tsx
import { ExportModal } from '@/components/export';

<ExportModal />
```

#### `<ExportButton />`
Trigger button to open the export wizard.
```tsx
import { ExportButton } from '@/components/export';

<ExportButton variant="default" size="default" />
```

#### `<ExportManager />`
Combined view of export queue and history with tabs.
```tsx
import { ExportManager } from '@/components/export';

<ExportManager />
```

### Individual Components

#### `<ExportWizard />`
Multi-step wizard with step indicators and navigation.

#### `<ExportSettings />`
Form component with React Hook Form for export configuration.

#### `<ExportReview />`
Summary view of export settings before starting.

#### `<ExportProgress />`
Real-time progress tracking with WebSocket integration.

#### `<ExportQueue />`
List of active exports with cancel functionality.

#### `<ExportHistory />`
Paginated history of completed/failed exports.

## Store

### `useExportStore`
Zustand store for managing export state.

```tsx
import { useExportStore } from '@/stores/useExportStore';

const {
  // Wizard state
  wizardOpen,
  currentStep,
  settings,
  
  // Actions
  openWizard,
  closeWizard,
  setSettings,
  
  // Active exports
  activeExports,
  addActiveExport,
  updateExportProgress,
  
  // History
  exportHistory,
  addToHistory,
} = useExportStore();
```

### State Structure

```typescript
interface ExportState {
  // Wizard
  currentStep: 'settings' | 'review' | 'progress';
  wizardOpen: boolean;
  settings: ExportSettings | null;
  
  // Active exports
  activeExports: Map<string, ActiveExport>;
  
  // History
  exportHistory: ExportJob[];
}
```

## Services

### Download Manager

```typescript
import { downloadManager } from '@/services/downloadManager';

// Download export
await downloadManager.download({
  projectId: 'project-123',
  exportId: 'export-456',
  filename: 'my-video.mp4',
  onProgress: (progress) => console.log(progress),
});

// Generate signed URL
const url = await downloadManager.generateSignedUrl(
  'project-123',
  'export-456',
  3600 // expires in 1 hour
);

// Generate shareable link
const shareLink = await downloadManager.generateShareableLink(
  'project-123',
  'export-456',
  {
    expiresIn: 7 * 24 * 3600, // 7 days
    password: 'optional-password',
    maxDownloads: 10,
  }
);

// Copy to clipboard
await downloadManager.copyShareableLink(shareLink.url);
```

## Integration Example

```tsx
import React from 'react';
import {
  ExportModal,
  ExportButton,
  ExportManager,
} from '@/components/export';

function VideoEditor() {
  return (
    <div>
      {/* Trigger button */}
      <ExportButton />
      
      {/* Export wizard modal */}
      <ExportModal />
      
      {/* Export queue and history */}
      <ExportManager />
    </div>
  );
}
```

## API Integration

The export system integrates with the backend API through:

```typescript
// Start export
const exportJob = await exportsApi.create({
  projectId: 'project-123',
  compositionId: 'composition-456',
  format: 'mp4',
  quality: 'high',
  resolution: { width: 1920, height: 1080 },
});

// Cancel export
await exportsApi.cancel('project-123', 'export-456');

// Get export progress (polling fallback)
const progress = await exportsApi.getProgress('project-123', 'export-456');
```

## WebSocket Events

The system listens for these WebSocket events:

### `export:progress`
```json
{
  "type": "export:progress",
  "payload": {
    "stage": "rendering",
    "progress": 50,
    "estimatedTimeRemaining": 120,
    "currentFrame": 500,
    "totalFrames": 1000,
    "message": "Rendering frame 500 of 1000"
  }
}
```

### `export:completed`
```json
{
  "type": "export:completed",
  "payload": {
    "exportId": "export-456",
    "outputUrl": "https://...",
    "fileSize": 52428800
  }
}
```

### `export:failed`
```json
{
  "type": "export:failed",
  "payload": {
    "exportId": "export-456",
    "error": "Rendering failed: Out of memory"
  }
}
```

## Quality to CRF Mapping

The quality slider (0-100%) maps to FFmpeg CRF values:

| Quality | CRF | Description |
|---------|-----|-------------|
| 100%    | 18  | Ultra (Visually lossless) |
| 75%     | 23  | High |
| 50%     | 28  | Good (Default) |
| 25%     | 38  | Medium |
| 0%      | 51  | Low |

Formula: `CRF = 51 - (quality / 100) * 33`

## Export Stages

1. **Downloading**: Fetching media assets from storage
2. **Rendering**: Processing timeline and applying effects
3. **Encoding**: Encoding video with specified settings
4. **Uploading**: Uploading result to storage
5. **Completed**: Export finished successfully
6. **Failed**: Export encountered an error

## Error Handling

- WebSocket connection errors trigger automatic reconnection
- Download failures trigger exponential backoff retry
- API errors are caught and displayed to user
- Form validation prevents invalid configurations

## Persistence

- **Export History**: Persisted to localStorage (last 50 exports)
- **Active Exports**: Not persisted (cleared on page reload)
- **Wizard State**: Not persisted (reset on modal close)

## Styling

All components use Tailwind CSS with shadcn/ui component library:
- Consistent with app theme
- Dark mode support
- Responsive design
- Accessible (WCAG 2.1 AA)

## Testing

See `__tests__/ExportWorkflow.test.md` for comprehensive test scenarios.

## Dependencies

- `react-hook-form`: Form validation and state management
- `@radix-ui/react-*`: UI primitives (Dialog, Slider, Progress, Tabs)
- `zustand`: State management
- `lucide-react`: Icons
- `axios`: HTTP client

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Future Enhancements

- [ ] Export presets/templates
- [ ] Batch export multiple compositions
- [ ] Export to cloud storage (S3, GCS, etc.)
- [ ] Email notification on completion
- [ ] Export scheduling
- [ ] Watermark support
- [ ] Custom FFmpeg arguments
- [ ] Export analytics and statistics
