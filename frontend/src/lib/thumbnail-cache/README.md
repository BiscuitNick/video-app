# Thumbnail Cache System

A comprehensive, production-ready thumbnail caching system for video applications with intelligent loading strategies, performance optimization, and robust error handling.

## Features

### Core Components

1. **IndexedDB Service** (Subtask 20.1)
   - Persistent storage using IndexedDB
   - Automatic fallback to in-memory storage on errors
   - CRUD operations with efficient indexing
   - Error handling and recovery

2. **LRU Cache Manager** (Subtask 20.2)
   - Least Recently Used (LRU) eviction policy
   - Configurable cache size (200MB default)
   - Automatic size tracking and eviction
   - Cache hit/miss statistics

3. **Lazy Loading Service** (Subtask 20.3)
   - Intersection Observer-based lazy loading
   - Progressive loading (low-res → high-res)
   - Priority queue based on viewport proximity
   - Scroll debouncing for performance

4. **WebWorker for Thumbnail Generation** (Subtask 20.4)
   - OffscreenCanvas for efficient rendering
   - Video frame extraction at specified timestamps
   - Multiple quality levels (low, medium, high)
   - Worker pool for parallel processing

5. **Cache Statistics UI** (Subtask 20.5)
   - Real-time usage metrics dashboard
   - Cache size, item count, hit/miss ratio
   - Manual cache clearing
   - Worker and network statistics

6. **Retry Logic and Progressive Loading** (Subtask 20.6)
   - Exponential backoff retry strategy
   - Bandwidth-aware quality selection
   - Quality level selection based on display size
   - Fallback placeholder system

## Installation

The thumbnail cache system is already integrated into the application. Simply import the components you need:

```typescript
import {
  getThumbnailCacheSystem,
  ThumbnailQuality,
} from '@/lib/thumbnail-cache';
```

## Usage

### Basic Usage with React Hook

```typescript
import { useThumbnailCache } from '@/lib/thumbnail-cache/useThumbnailCache';
import { ThumbnailQuality } from '@/lib/thumbnail-cache';

function VideoThumbnail({ videoId, videoUrl }) {
  const { thumbnailUrl, isLoading, error } = useThumbnailCache({
    videoId,
    videoUrl,
    timestamp: 0,
    width: 320,
    height: 180,
    quality: ThumbnailQuality.MEDIUM,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading thumbnail</div>;

  return <img src={thumbnailUrl} alt="Video thumbnail" />;
}
```

### Lazy Loading with Intersection Observer

```typescript
import { useLazyThumbnail } from '@/lib/thumbnail-cache/useThumbnailCache';

function LazyVideoThumbnail({ videoId, videoUrl }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { thumbnailUrl, isLoading } = useLazyThumbnail(containerRef, {
    videoId,
    videoUrl,
    timestamp: 0,
    width: 320,
    height: 180,
  });

  return (
    <div ref={containerRef}>
      {thumbnailUrl && <img src={thumbnailUrl} alt="Thumbnail" />}
    </div>
  );
}
```

### Progressive Loading

```typescript
function ProgressiveThumbnail({ videoId, videoUrl }) {
  // Load low quality first
  const lowQuality = useThumbnailCache({
    videoId,
    videoUrl,
    timestamp: 0,
    width: 320,
    height: 180,
    quality: ThumbnailQuality.LOW,
  });

  // Then load high quality
  const highQuality = useThumbnailCache({
    videoId,
    videoUrl,
    timestamp: 0,
    width: 320,
    height: 180,
    quality: ThumbnailQuality.HIGH,
    enabled: !!lowQuality.thumbnailUrl,
  });

  const currentUrl = highQuality.thumbnailUrl || lowQuality.thumbnailUrl;

  return <img src={currentUrl} alt="Thumbnail" />;
}
```

### Direct API Usage

```typescript
import { getThumbnailCacheSystem } from '@/lib/thumbnail-cache';

const cacheSystem = getThumbnailCacheSystem();

// Load a thumbnail
const thumbnailUrl = await cacheSystem.loadThumbnail(
  '/api/videos/123/stream',
  5.0, // timestamp in seconds
  ThumbnailQuality.MEDIUM,
  'video-123'
);

// Get cache statistics
const stats = await cacheSystem.getStats();
console.log('Cache usage:', stats.usagePercent);
console.log('Hit rate:', stats.hitRate);

// Clear cache
await cacheSystem.clearCache();

// Warm cache for specific videos
await cacheSystem.warmCache({
  videoIds: ['video1', 'video2', 'video3'],
  quality: ThumbnailQuality.MEDIUM,
  concurrency: 5,
  onProgress: (completed, total) => {
    console.log(`Warming cache: ${completed}/${total}`);
  },
});
```

### Cache Management

```typescript
import { useCacheManagement } from '@/lib/thumbnail-cache/useThumbnailCache';

function CacheManager() {
  const { clearCache, setMaxCacheSize, getStats } = useCacheManagement();

  const handleClear = async () => {
    await clearCache();
    console.log('Cache cleared');
  };

  const handleSetSize = async () => {
    await setMaxCacheSize(500 * 1024 * 1024); // 500MB
  };

  return (
    <div>
      <button onClick={handleClear}>Clear Cache</button>
      <button onClick={handleSetSize}>Set Cache Size to 500MB</button>
    </div>
  );
}
```

## Configuration

### Quality Levels

Three quality levels are available:

- **LOW**: 320x180, JPEG quality 0.6
- **MEDIUM**: 640x360, JPEG quality 0.75
- **HIGH**: 1280x720, JPEG quality 0.9

### Cache Settings

Default configuration (can be customized):

```typescript
THUMBNAIL_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200MB
EVICTION_CHECK_INTERVAL_MS = 30000; // 30 seconds
MIN_CACHE_SIZE_FOR_EVICTION = 0.9; // 90% full
```

### Retry Configuration

```typescript
DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};
```

## Components

### CacheStatsPanel

Admin panel for viewing cache statistics:

```typescript
import { CacheStatsPanel } from '@/components/admin/CacheStatsPanel';

function AdminPage() {
  return (
    <div>
      <h1>Cache Management</h1>
      <CacheStatsPanel />
    </div>
  );
}
```

## Architecture

### Data Flow

1. **Request** → Check LRU Cache → Check IndexedDB
2. **Cache Miss** → Queue for generation → Worker pool
3. **Generation** → OffscreenCanvas → JPEG Blob
4. **Storage** → IndexedDB + LRU Cache
5. **Eviction** → LRU policy when cache full

### Performance Optimizations

- **Lazy Loading**: Only load thumbnails near viewport
- **Progressive Loading**: Show low-res quickly, upgrade to high-res
- **Worker Pool**: Parallel thumbnail generation
- **Bandwidth Awareness**: Adjust quality based on network speed
- **Request Deduplication**: Prevent duplicate requests
- **Scroll Debouncing**: Reduce unnecessary processing

### Error Handling

- **IndexedDB Errors**: Automatic fallback to in-memory storage
- **Worker Errors**: Retry with exponential backoff
- **Network Errors**: Retry up to 3 times
- **Fallback Placeholders**: Show placeholder on fatal errors

## Browser Support

- **IndexedDB**: All modern browsers
- **Web Workers**: All modern browsers
- **Intersection Observer**: All modern browsers (polyfill available)
- **OffscreenCanvas**: Chrome 69+, Edge 79+, Firefox 105+

For browsers without OffscreenCanvas, the system falls back to regular Canvas.

## Performance Metrics

Expected performance with default settings:

- **Cache Hit Rate**: >80% after warm-up
- **Generation Time**: 50-200ms per thumbnail
- **Memory Usage**: Up to 200MB (configurable)
- **Concurrent Loads**: 6 parallel requests
- **Eviction Impact**: <10ms for LRU operations

## Debugging

Enable debug logging:

```typescript
// In browser console
localStorage.setItem('DEBUG_THUMBNAIL_CACHE', 'true');
```

View cache contents:

```typescript
const cacheSystem = getThumbnailCacheSystem();
const stats = await cacheSystem.getStats();
console.log('Cache stats:', stats);
```

## API Reference

See individual service files for detailed API documentation:

- `ThumbnailDBService.ts` - IndexedDB operations
- `LRUCacheManager.ts` - Cache management
- `ThumbnailLoaderService.ts` - Lazy loading
- `ThumbnailWorkerService.ts` - Worker management
- `RetryManager.ts` - Retry logic and bandwidth
- `useThumbnailCache.ts` - React hooks

## Examples

See `components/examples/ThumbnailCacheExample.tsx` for complete working examples.

## Testing

The system includes comprehensive error handling and fallback mechanisms. Test scenarios:

1. **IndexedDB unavailable**: Falls back to in-memory storage
2. **Workers unavailable**: Graceful degradation
3. **Network failures**: Retry with backoff
4. **Cache full**: Automatic LRU eviction

## Future Enhancements

Potential improvements:

- Service Worker integration for offline support
- WebP format support for better compression
- Adaptive bitrate based on device capabilities
- Predictive prefetching based on user behavior
- Cache sharing across tabs
- Analytics and telemetry

## License

Internal use only - Part of the video application system.
