# Auto-Save and Project Serialization Services

This directory contains the implementation of Task 22: Dirty State Tracking, Auto-Save Service, and Project Serialization.

## Overview

The implementation consists of three main components:

1. **Dirty State Tracking Middleware** - Zustand middleware that tracks state changes
2. **Auto-Save Service** - Debounced auto-save with queue management and retry logic
3. **Project Serialization Service** - Serialize/deserialize project state with validation and migration support

## Files Structure

```
/src/stores/middleware/
  └── dirtyStateMiddleware.ts      # Zustand middleware for dirty state tracking

/src/services/
  ├── autoSaveService.ts            # Auto-save service with debouncing
  └── projectSerializationService.ts # Project serialization/deserialization

/src/hooks/
  ├── useDirtyState.ts              # React hooks for dirty state
  └── useAutoSave.ts                # React hooks for auto-save

/src/components/ui/
  └── SaveIndicator.tsx             # UI components for save status

/src/__tests__/
  ├── dirtyState.test.ts            # Dirty state tests
  ├── serialization.test.ts         # Serialization tests
  └── autoSave.test.ts              # Auto-save tests
```

## 1. Dirty State Tracking Middleware

### Features

- Automatic detection of state changes
- Granular field-level tracking
- Configurable tracked/excluded fields
- Timestamp tracking for changes and saves
- Helper functions for marking state as clean/dirty

### Usage

```typescript
import { create } from 'zustand';
import { dirtyStateMiddleware, type WithDirtyState } from './middleware/dirtyStateMiddleware';

interface MyState {
  data: string;
  updateData: (data: string) => void;
}

const useMyStore = create<WithDirtyState<MyState>>()(
  dirtyStateMiddleware(
    (set) => ({
      data: '',
      updateData: (data) => set({ data }),
    }),
    {
      trackedFields: ['data'],          // Only track these fields
      excludedFields: ['someUIState'],  // Don't track these fields
    }
  )
);

// In components
const isDirty = useMyStore((state) => state.isDirty);
const dirtyFields = useMyStore((state) => state.dirtyFields);
const markClean = useMyStore((state) => state.markClean);
```

### React Hooks

```typescript
import { useProjectDirty, useMarkAllClean, useUnsavedChangesWarning } from '@/hooks/useDirtyState';

function MyComponent() {
  const isDirty = useProjectDirty();
  const markAllClean = useMarkAllClean();

  // Warn before leaving page with unsaved changes
  useUnsavedChangesWarning(true);

  return <div>{isDirty ? 'Unsaved changes' : 'All saved'}</div>;
}
```

## 2. Auto-Save Service

### Features

- Debounced saves (default: 30 seconds)
- Immediate save triggers for significant operations
- Save queue management (prevents overlapping saves)
- Exponential backoff for failed saves
- Progress tracking
- Save state subscriptions
- Configurable callbacks for save/error/success

### Usage

```typescript
import { getAutoSaveService } from '@/services/autoSaveService';

// Initialize with options
const autoSave = getAutoSaveService({
  enabled: true,
  debounceInterval: 30000, // 30 seconds
  maxRetries: 3,
  baseBackoffDelay: 1000,
  onSave: async (data) => {
    // Your save logic (e.g., API call)
    await apiClient.post('/projects/save', data);
  },
  onError: (error) => {
    console.error('Save failed:', error);
  },
  onSuccess: () => {
    console.log('Save successful');
  },
});

// Initialize (starts listening to store changes)
autoSave.initialize();

// Trigger immediate save
autoSave.saveImmediately();

// Force save regardless of dirty state
await autoSave.forceSave();

// Subscribe to save state changes
const unsubscribe = autoSave.subscribe((state) => {
  console.log('Save status:', state.status);
  console.log('Progress:', state.progress);
});
```

### React Hook

```typescript
import { useAutoSave, useSaveStatusIndicator } from '@/hooks/useAutoSave';

function MyComponent() {
  const { saveState, saveImmediately, forceSave } = useAutoSave({
    onSave: async (data) => {
      await apiClient.post('/projects/save', data);
    },
  });

  return (
    <div>
      <p>Status: {saveState.status}</p>
      <p>Progress: {saveState.progress}%</p>
      <button onClick={saveImmediately}>Save Now</button>
    </div>
  );
}
```

### Save Status Indicator Component

```typescript
import { SaveIndicator, CompactSaveIndicator } from '@/components/ui/SaveIndicator';

function Toolbar() {
  return (
    <div className="toolbar">
      <SaveIndicator />
      {/* Or use compact version */}
      <CompactSaveIndicator />
    </div>
  );
}
```

## 3. Project Serialization Service

### Features

- Convert Zustand state to JSON
- Includes: timeline config, clips, tracks, media library, export settings
- Validation with detailed error reporting
- Migration support for older versions
- Compression for large projects (using pako)
- Handles missing media references with placeholders
- Date restoration
- Import/export to file

### Usage

```typescript
import {
  serializeProject,
  deserializeProject,
  validateSerializedProject,
  exportProjectToFile,
  importProjectFromFile,
} from '@/services/projectSerializationService';

// Serialize current state
const serialized = serializeProject({
  app: useAppStore.getState(),
  timeline: useTimelineStore.getState(),
  mediaLibrary: useMediaLibraryStore.getState(),
});

// Validate
const validation = validateSerializedProject(serialized);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Deserialize
const deserialized = deserializeProject(serialized, {
  validate: true,
  handleMissingMedia: 'placeholder', // or 'error'
});

// Export to file
exportProjectToFile(serialized, 'my-project.json');

// Import from file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const imported = await importProjectFromFile(file);
```

## Configuration Options

### Dirty State Middleware Options

```typescript
interface DirtyStateOptions {
  trackedFields?: string[];        // Only track these fields
  excludedFields?: string[];       // Exclude these fields
  autoTrack?: boolean;             // Auto-track all fields (default: true)
  isEqual?: (a: unknown, b: unknown) => boolean; // Custom equality
}
```

### Auto-Save Options

```typescript
interface AutoSaveOptions {
  enabled: boolean;                     // Enable/disable auto-save
  debounceInterval: number;             // ms to wait before saving
  maxRetries: number;                   // Max retry attempts
  baseBackoffDelay: number;             // Base delay for exponential backoff
  onSave?: (data: SerializedProject) => Promise<void>;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}
```

### Serialization Options

```typescript
interface SerializationOptions {
  compress: boolean;                    // Use compression
  compressionThreshold: number;         // Compress if larger than (bytes)
  validate: boolean;                    // Validate before serializing
}

interface DeserializationOptions {
  validate: boolean;                    // Validate after deserializing
  handleMissingMedia: 'error' | 'placeholder' | 'skip';
}
```

## Testing

Run the test files to verify functionality:

```bash
# Dirty State Tests
node --loader tsx src/__tests__/dirtyState.test.ts

# Serialization Tests
node --loader tsx src/__tests__/serialization.test.ts

# Auto-Save Tests
node --loader tsx src/__tests__/autoSave.test.ts
```

## Integration Example

Here's a complete example of integrating all three features:

```typescript
import { useEffect } from 'react';
import { getAutoSaveService } from '@/services/autoSaveService';
import { useProjectDirty, useUnsavedChangesWarning } from '@/hooks/useDirtyState';
import { SaveIndicator } from '@/components/ui/SaveIndicator';
import { apiClient } from '@/lib/api-client';

function App() {
  const isDirty = useProjectDirty();

  // Warn before leaving with unsaved changes
  useUnsavedChangesWarning(true);

  useEffect(() => {
    // Initialize auto-save
    const autoSave = getAutoSaveService({
      enabled: true,
      debounceInterval: 30000, // 30 seconds
      maxRetries: 3,
      onSave: async (data) => {
        // Save to backend
        const response = await apiClient.post('/api/projects/save', data);
        return response.data;
      },
      onError: (error) => {
        console.error('Auto-save failed:', error);
        // Show error notification
      },
      onSuccess: () => {
        console.log('Auto-save successful');
      },
    });

    autoSave.initialize();

    return () => {
      autoSave.destroy();
    };
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Video Editor</h1>
        <SaveIndicator />
      </header>
      {/* Rest of app */}
    </div>
  );
}
```

## Architecture Decisions

### Why Middleware for Dirty State?

Using Zustand middleware allows us to:
- Automatically track changes without manual marking
- Keep dirty state logic separate from business logic
- Reuse across multiple stores
- Maintain consistency

### Why Debouncing?

Debouncing prevents excessive save operations:
- Reduces server load
- Improves performance
- Coalesces rapid changes into single save
- User can keep working without interruption

### Why Serialization Service?

Centralized serialization provides:
- Consistent data format
- Version migration support
- Validation and error handling
- Compression for large projects
- Easy import/export functionality

## Performance Considerations

1. **Dirty State Tracking**: Uses shallow equality by default. For deep tracking, provide custom `isEqual` function.

2. **Auto-Save Debouncing**: 30-second default balances between save frequency and performance. Adjust based on your needs.

3. **Compression**: Only compresses projects larger than 100KB by default. Adjust `compressionThreshold` as needed.

4. **Validation**: Can be disabled in production for better performance, but recommended during development.

## Troubleshooting

### Dirty state not triggering
- Check that fields are in `trackedFields` or `autoTrack` is enabled
- Verify fields are not in `excludedFields`
- Ensure state changes go through Zustand `set` function

### Auto-save not working
- Verify service is initialized with `autoSave.initialize()`
- Check that stores have dirty state middleware
- Ensure `enabled: true` in options

### Serialization errors
- Run validation to see detailed errors
- Check that all required fields are present
- Verify dates are proper Date objects or ISO strings

## Future Enhancements

Potential improvements for future versions:

1. **Conflict Resolution**: Handle concurrent edits from multiple users
2. **Undo/Redo Integration**: Track changes for undo/redo
3. **Selective Serialization**: Only serialize changed portions
4. **WebSocket Auto-Save**: Real-time saving via WebSocket
5. **Compression Tuning**: Adaptive compression based on project size
6. **IndexedDB Support**: Store large projects locally in IndexedDB
