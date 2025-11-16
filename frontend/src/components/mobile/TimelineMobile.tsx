import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTouchHandlers } from '@/hooks/useTouchHandlers';
import { cn } from '@/lib/utils';
import type { Clip, Track } from '@/types/timeline';

interface TimelineMobileProps {
  className?: string;
  fps?: number;
  pixelsPerSecond?: number;
}

interface ClipMobileProps {
  clip: Clip;
  zoom: number;
  pixelsPerSecond: number;
  onTap: (clip: Clip) => void;
}

const ClipMobile: React.FC<ClipMobileProps> = ({
  clip,
  zoom,
  pixelsPerSecond,
  onTap,
}) => {
  const left = (clip.startTime * pixelsPerSecond * zoom);
  const width = ((clip.endTime - clip.startTime) * pixelsPerSecond * zoom);

  return (
    <button
      onClick={() => onTap(clip)}
      className="absolute h-14 rounded touch-target-min bg-blue-500 border-2 border-blue-400 overflow-hidden group hover:border-blue-300 transition-colors"
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
    >
      <div className="px-2 py-1 text-white text-xs truncate no-select">
        {clip.name}
      </div>
      <div className="absolute inset-0 bg-white opacity-0 group-active:opacity-20 transition-opacity" />
    </button>
  );
};

export const TimelineMobile: React.FC<TimelineMobileProps> = ({
  className,
  fps = 30,
  pixelsPerSecond = 50, // Smaller default for mobile
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);

  const tracks = useTimelineStore((state) => state.tracks);
  const zoom = useTimelineStore((state) => state.zoom);
  const setZoom = useTimelineStore((state) => state.setZoom);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const duration = usePlaybackStore((state) => state.duration);

  // Get the first track (single-track view for mobile)
  const track = tracks[0];

  // Calculate timeline width
  const maxDuration = Math.max(
    duration,
    ...(track?.clips || []).map((clip) => clip.endTime),
    60 // Minimum 1 minute
  );
  const timelineWidth = maxDuration * pixelsPerSecond * zoom;

  // Touch handlers with pinch-to-zoom and swipe-to-scroll
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    scrollOffset,
    scale,
  } = useTouchHandlers({
    containerRef,
    onZoomChange: (newScale) => {
      const clampedZoom = Math.max(0.5, Math.min(3, zoom * newScale));
      setZoom(clampedZoom);
    },
    enableMomentumScroll: true,
    enablePinchZoom: true,
  });

  // Sync scroll position
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollOffset;
    }
  }, [scrollOffset]);

  // Auto-scroll to playhead
  const scrollToPlayhead = useCallback(() => {
    if (!containerRef.current) return;

    const playheadPosition = currentTime * pixelsPerSecond * zoom;
    const containerWidth = containerRef.current.clientWidth;
    const scrollLeft = containerRef.current.scrollLeft;

    // Center playhead if it's out of view
    if (
      playheadPosition < scrollLeft ||
      playheadPosition > scrollLeft + containerWidth
    ) {
      containerRef.current.scrollTo({
        left: playheadPosition - containerWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [currentTime, pixelsPerSecond, zoom]);

  // Handle clip tap
  const handleClipTap = useCallback((clip: Clip) => {
    setSelectedClip(clip);
    // TODO: Show clip editor bottom sheet
  }, []);

  // Render time markers
  const renderTimeMarkers = () => {
    const markers: JSX.Element[] = [];
    const interval = zoom < 1 ? 10 : zoom < 2 ? 5 : 1; // Adaptive intervals
    const markerCount = Math.ceil(maxDuration / interval);

    for (let i = 0; i <= markerCount; i++) {
      const time = i * interval;
      const position = time * pixelsPerSecond * zoom;

      markers.push(
        <div
          key={i}
          className="absolute top-0 bottom-0 border-l border-zinc-700"
          style={{ left: `${position}px` }}
        >
          <span className="absolute -top-6 -left-4 text-xs text-zinc-400 no-select">
            {formatTime(time)}
          </span>
        </div>
      );
    }

    return markers;
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate playhead position
  const playheadPosition = currentTime * pixelsPerSecond * zoom;

  return (
    <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
      {/* Mobile Header */}
      <div className="safe-top flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <h3 className="mobile-text-base font-medium text-zinc-200">Timeline</h3>
          {track && (
            <span className="mobile-text-xs text-zinc-400">({track.name})</span>
          )}
        </div>
        <div className="mobile-text-xs text-zinc-400">
          {formatTime(currentTime)} / {formatTime(maxDuration)}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="flex items-center justify-center py-2 bg-zinc-800/50">
        <div className="mobile-text-xs text-zinc-400">
          Zoom: {(zoom * 100).toFixed(0)}% • Pinch to zoom
        </div>
      </div>

      {/* Timeline Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden momentum-scroll no-select"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-x' }}
      >
        <div
          ref={timelineRef}
          className="relative h-full"
          style={{
            width: `${timelineWidth}px`,
            minHeight: '120px',
          }}
        >
          {/* Time markers */}
          <div className="absolute top-0 left-0 right-0 h-8">
            {renderTimeMarkers()}
          </div>

          {/* Track content */}
          <div className="absolute top-8 left-0 right-0 bottom-0 pt-4">
            {track?.clips.map((clip) => (
              <ClipMobile
                key={clip.id}
                clip={clip}
                zoom={zoom}
                pixelsPerSecond={pixelsPerSecond}
                onTap={handleClipTap}
              />
            ))}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{
              left: `${playheadPosition}px`,
            }}
          >
            <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 rounded-full shadow-lg" />
          </div>
        </div>
      </div>

      {/* Mobile Controls Footer */}
      <div className="safe-bottom mobile-p-sm bg-zinc-800 border-t border-zinc-700">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={scrollToPlayhead}
            className="touch-target px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg mobile-text-sm text-zinc-200 transition-colors active:bg-zinc-500"
          >
            Center Playhead
          </button>
          <div className="mobile-text-xs text-zinc-400">
            Swipe to scroll • Two-finger drag to scrub
          </div>
        </div>
      </div>

      {/* Selected Clip Indicator */}
      {selectedClip && (
        <div className="absolute bottom-20 left-4 right-4 p-4 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700">
          <div className="mobile-text-sm font-medium text-zinc-200 mb-1">
            {selectedClip.name}
          </div>
          <div className="mobile-text-xs text-zinc-400">
            {formatTime(selectedClip.startTime)} - {formatTime(selectedClip.endTime)}
          </div>
          <button
            onClick={() => setSelectedClip(null)}
            className="mt-2 touch-target-min px-3 py-1 bg-zinc-700 rounded mobile-text-xs text-zinc-300"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
