/**
 * Example Component - Thumbnail Cache System Usage
 *
 * Demonstrates various ways to use the thumbnail cache system:
 * - Basic thumbnail loading
 * - Lazy loading with intersection observer
 * - Progressive loading (low to high quality)
 * - Grid of thumbnails with virtualization
 */

import { useRef } from 'react';
import { useThumbnailCache, useLazyThumbnail } from '../../lib/thumbnail-cache/useThumbnailCache';
import { ThumbnailQuality } from '../../lib/thumbnail-cache/types';
import { Card, CardContent } from '../ui/card';

/**
 * Basic thumbnail component with eager loading
 */
export function ThumbnailBasic({
  videoId,
  videoUrl,
  timestamp = 0,
  width = 320,
  height = 180,
}: {
  videoId: string;
  videoUrl: string;
  timestamp?: number;
  width?: number;
  height?: number;
}) {
  const { thumbnailUrl, isLoading, error } = useThumbnailCache({
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    quality: ThumbnailQuality.MEDIUM,
  });

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gray-200 text-gray-500"
        style={{ width, height }}
      >
        Failed to load
      </div>
    );
  }

  if (isLoading || !thumbnailUrl) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 animate-pulse"
        style={{ width, height }}
      >
        Loading...
      </div>
    );
  }

  return (
    <img
      src={thumbnailUrl}
      alt={`Thumbnail for ${videoId}`}
      width={width}
      height={height}
      className="object-cover rounded"
    />
  );
}

/**
 * Lazy-loaded thumbnail component
 */
export function ThumbnailLazy({
  videoId,
  videoUrl,
  timestamp = 0,
  width = 320,
  height = 180,
}: {
  videoId: string;
  videoUrl: string;
  timestamp?: number;
  width?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { thumbnailUrl, isLoading, error } = useLazyThumbnail(containerRef, {
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    quality: ThumbnailQuality.MEDIUM,
  });

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
      className="relative overflow-hidden rounded"
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
          Failed to load
        </div>
      )}

      {isLoading && !thumbnailUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          Loading...
        </div>
      )}

      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={`Thumbnail for ${videoId}`}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * Progressive thumbnail component (loads low quality first, then upgrades)
 */
export function ThumbnailProgressive({
  videoId,
  videoUrl,
  timestamp = 0,
  width = 640,
  height = 360,
}: {
  videoId: string;
  videoUrl: string;
  timestamp?: number;
  width?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Load low quality first
  const lowQuality = useLazyThumbnail(containerRef, {
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    quality: ThumbnailQuality.LOW,
  });

  // Then load high quality
  const highQuality = useLazyThumbnail(containerRef, {
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    quality: ThumbnailQuality.HIGH,
    // Only load high quality after low quality is loaded
    enabled: !!lowQuality.thumbnailUrl,
  });

  const currentUrl = highQuality.thumbnailUrl || lowQuality.thumbnailUrl;
  const isLowQuality = !highQuality.thumbnailUrl && !!lowQuality.thumbnailUrl;

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
      className="relative overflow-hidden rounded"
    >
      {lowQuality.error && !currentUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
          Failed to load
        </div>
      )}

      {lowQuality.isLoading && !currentUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          Loading...
        </div>
      )}

      {currentUrl && (
        <>
          <img
            src={currentUrl}
            alt={`Thumbnail for ${videoId}`}
            className={`w-full h-full object-cover transition-all duration-300 ${
              isLowQuality ? 'blur-sm' : ''
            }`}
          />
          {isLowQuality && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Upgrading...
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Grid of thumbnails example
 */
export function ThumbnailGrid({
  videos,
}: {
  videos: Array<{ id: string; url: string; title: string }>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {videos.map((video) => (
        <Card key={video.id} className="overflow-hidden">
          <CardContent className="p-0">
            <ThumbnailLazy
              videoId={video.id}
              videoUrl={video.url}
              timestamp={0}
              width={320}
              height={180}
            />
            <div className="p-3">
              <h3 className="text-sm font-medium truncate">{video.title}</h3>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Video timeline with thumbnail scrubbing
 */
export function VideoTimelineScrubber({
  videoId,
  videoUrl,
  duration,
  thumbnailCount = 10,
}: {
  videoId: string;
  videoUrl: string;
  duration: number;
  thumbnailCount?: number;
}) {
  const timestamps = Array.from({ length: thumbnailCount }, (_, i) => ({
    time: (duration / (thumbnailCount - 1)) * i,
    label: formatTime((duration / (thumbnailCount - 1)) * i),
  }));

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto">
        {timestamps.map((ts, i) => (
          <div key={i} className="flex-shrink-0">
            <ThumbnailLazy
              videoId={videoId}
              videoUrl={videoUrl}
              timestamp={ts.time}
              width={120}
              height={68}
            />
            <div className="text-xs text-center text-gray-500 mt-1">{ts.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Format time in seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Complete example page showing all features
 */
export function ThumbnailCacheExamplePage() {
  const exampleVideos = [
    { id: 'video1', url: '/api/videos/video1/stream', title: 'Sample Video 1' },
    { id: 'video2', url: '/api/videos/video2/stream', title: 'Sample Video 2' },
    { id: 'video3', url: '/api/videos/video3/stream', title: 'Sample Video 3' },
    { id: 'video4', url: '/api/videos/video4/stream', title: 'Sample Video 4' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Thumbnail Cache Examples</h1>
        <p className="text-gray-600">
          Demonstrating various thumbnail loading strategies
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Basic Thumbnail</h2>
        <p className="text-gray-600">Eager loading with medium quality</p>
        <ThumbnailBasic
          videoId="video1"
          videoUrl="/api/videos/video1/stream"
          timestamp={5}
          width={640}
          height={360}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Lazy Loaded Thumbnail</h2>
        <p className="text-gray-600">
          Loads when entering viewport (scroll down to see it load)
        </p>
        <div style={{ height: '100vh' }} className="flex items-end">
          <ThumbnailLazy
            videoId="video2"
            videoUrl="/api/videos/video2/stream"
            timestamp={10}
            width={640}
            height={360}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Progressive Loading</h2>
        <p className="text-gray-600">Loads low quality first, then upgrades to high quality</p>
        <ThumbnailProgressive
          videoId="video3"
          videoUrl="/api/videos/video3/stream"
          timestamp={15}
          width={640}
          height={360}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Thumbnail Grid</h2>
        <p className="text-gray-600">Multiple thumbnails with lazy loading</p>
        <ThumbnailGrid videos={exampleVideos} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Timeline Scrubber</h2>
        <p className="text-gray-600">Video timeline with thumbnail preview</p>
        <VideoTimelineScrubber
          videoId="video1"
          videoUrl="/api/videos/video1/stream"
          duration={120}
          thumbnailCount={10}
        />
      </section>
    </div>
  );
}
