# Task 22 Quick Reference Guide

## Quick Start

### 1. Enable Auto-Save in Your App

```typescript
// In your App.tsx or main component
import { useEffect } from 'react';
import { getAutoSaveService } from '@/services/autoSaveService';
import { apiClient } from '@/lib/api-client';

function App() {
  useEffect(() => {
    const autoSave = getAutoSaveService({
      enabled: true,
      debounceInterval: 30000, // 30 seconds
      onSave: async (data) => {
        await apiClient.post('/api/projects/save', data);
      },
    });

    autoSave.initialize();
    return () => autoSave.destroy();
  }, []);

  // ... rest of your app
}
```

### 2. Add Save Indicator to UI

```typescript
import { SaveIndicator } from '@/components/ui/SaveIndicator';

function Toolbar() {
  return (
    <div className="toolbar">
      <SaveIndicator />
    </div>
  );
}
```

### 3. Warn Before Leaving

```typescript
import { useUnsavedChangesWarning } from '@/hooks/useDirtyState';

function MyComponent() {
  useUnsavedChangesWarning(true);
  // User will be warned if they try to leave with unsaved changes
}
```

## Common Use Cases

### Check if Project is Dirty

```typescript
import { useProjectDirty } from '@/hooks/useDirtyState';

function SaveButton() {
  const isDirty = useProjectDirty();

  return (
    <button disabled={!isDirty}>
      {isDirty ? 'Save Changes' : 'All Saved'}
    </button>
  );
}
```

### Force Immediate Save

```typescript
import { getAutoSaveService } from '@/services/autoSaveService';

function SaveButton() {
  const handleSave = async () => {
    const autoSave = getAutoSaveService();
    await autoSave.forceSave();
  };

  return <button onClick={handleSave}>Save Now</button>;
}
```

### Export Project to File

```typescript
import { serializeProject, exportProjectToFile } from '@/services/projectSerializationService';
import { useAppStore, useTimelineStore, useMediaLibraryStore } from '@/stores';

function ExportButton() {
  const handleExport = () => {
    const data = serializeProject({
      app: useAppStore.getState(),
      timeline: useTimelineStore.getState(),
      mediaLibrary: useMediaLibraryStore.getState(),
    });

    exportProjectToFile(data, 'my-project.json');
  };

  return <button onClick={handleExport}>Export</button>;
}
```

### Import Project from File

```typescript
import { importProjectFromFile, deserializeProject } from '@/services/projectSerializationService';
import { useAppStore, useTimelineStore, useMediaLibraryStore } from '@/stores';

function ImportButton() {
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await importProjectFromFile(file);

    // Apply to stores
    useAppStore.getState().setProject(data.data.project);
    // ... etc
  };

  return <input type="file" accept=".json" onChange={handleImport} />;
}
```

### Trigger Save on Significant Action

```typescript
import { getAutoSaveService } from '@/services/autoSaveService';
import { useTimelineStore } from '@/stores/useTimelineStore';

function AddClipButton() {
  const addClip = useTimelineStore((state) => state.addClip);

  const handleAddClip = (clip) => {
    addClip(clip);

    // Trigger immediate save for significant operation
    const autoSave = getAutoSaveService();
    autoSave.saveImmediately();
  };

  return <button onClick={handleAddClip}>Add Clip</button>;
}
```

## Configuration Presets

### Conservative (Less Frequent Saves)
```typescript
{
  debounceInterval: 60000, // 1 minute
  maxRetries: 5,
  baseBackoffDelay: 2000,
}
```

### Aggressive (Frequent Saves)
```typescript
{
  debounceInterval: 10000, // 10 seconds
  maxRetries: 3,
  baseBackoffDelay: 500,
}
```

### Production (Recommended)
```typescript
{
  debounceInterval: 30000, // 30 seconds
  maxRetries: 3,
  baseBackoffDelay: 1000,
  onError: (error) => {
    // Log to error tracking service
    console.error('Auto-save failed:', error);
  },
}
```

## File Locations

| Feature | File Path |
|---------|-----------|
| Dirty State Middleware | `src/stores/middleware/dirtyStateMiddleware.ts` |
| Auto-Save Service | `src/services/autoSaveService.ts` |
| Serialization Service | `src/services/projectSerializationService.ts` |
| Dirty State Hooks | `src/hooks/useDirtyState.ts` |
| Auto-Save Hooks | `src/hooks/useAutoSave.ts` |
| Save Indicator Component | `src/components/ui/SaveIndicator.tsx` |
| Full Documentation | `src/services/README.md` |

## Troubleshooting

### Auto-save not triggering?
1. Check that `autoSave.initialize()` was called
2. Verify stores have dirty state middleware
3. Check tracked fields configuration

### Dirty state always false?
1. Ensure field is in `trackedFields` or `autoTrack: true`
2. Check field is not in `excludedFields`
3. Verify changes go through Zustand `set` function

### Save failing silently?
1. Check browser console for errors
2. Verify `onError` callback is set
3. Check network tab for API errors

### Project not serializing correctly?
1. Run validation: `validateSerializedProject(data)`
2. Check for circular references
3. Ensure all required fields exist

## Testing

Run tests:
```bash
# All tests
npm test

# Specific test
node --loader tsx src/__tests__/dirtyState.test.ts
node --loader tsx src/__tests__/serialization.test.ts
node --loader tsx src/__tests__/autoSave.test.ts
node --loader tsx src/__tests__/integration.test.ts
```

## API Reference

### Auto-Save Service

```typescript
const autoSave = getAutoSaveService(options);

// Methods
autoSave.initialize()           // Start listening to stores
autoSave.destroy()              // Clean up subscriptions
autoSave.scheduleSave()         // Schedule debounced save
autoSave.saveImmediately()      // Trigger immediate save
autoSave.forceSave()            // Force save (returns Promise)
autoSave.subscribe(callback)    // Subscribe to state changes
autoSave.getState()             // Get current save state
autoSave.updateOptions(options) // Update options
```

### Dirty State

```typescript
// In components
const isDirty = useProjectDirty();
const dirtyFields = useDirtyFields();
const markAllClean = useMarkAllClean();
const lastChange = useLastChangeTimestamp();

// In stores
const isDirty = useMyStore(state => state.isDirty);
const dirtyFields = useMyStore(state => state.dirtyFields);
useMyStore.getState().markClean();
useMyStore.getState().markDirty(['field1', 'field2']);
```

### Serialization

```typescript
// Serialize
const data = serializeProject({ app, timeline, mediaLibrary }, options);

// Deserialize
const restored = deserializeProject(data, options);

// Validate
const validation = validateSerializedProject(data);

// File operations
exportProjectToFile(data, 'project.json');
const imported = await importProjectFromFile(file);
```

## Performance Tips

1. **Adjust debounce interval** based on your needs
2. **Use `trackedFields`** to only track relevant state
3. **Compress large projects** (enabled by default)
4. **Disable validation** in production for better performance
5. **Use `saveImmediately()`** sparingly for critical operations

## Best Practices

1. Always initialize auto-save in a top-level component
2. Use `useUnsavedChangesWarning` to prevent data loss
3. Handle `onError` callback to notify users of save failures
4. Test serialization with various project sizes
5. Monitor auto-save performance in production
6. Provide manual save option for user peace of mind
7. Show save status in UI for transparency

## Examples in Codebase

See `/home/user/video-app/frontend/src/__tests__/` for working examples:
- `dirtyState.test.ts` - Dirty state usage
- `autoSave.test.ts` - Auto-save configuration
- `serialization.test.ts` - Serialization examples
- `integration.test.ts` - Complete workflow
