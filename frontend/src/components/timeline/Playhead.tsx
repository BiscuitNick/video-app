import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { timeToPixels, formatTime } from '@/lib/timeline/timeUtils';

interface PlayheadProps {
  pixelsPerSecond?: number;
  fps?: number;
  containerWidth: number;
  timelineHeight: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  pixelsPerSecond = 100,
  fps = 30,
  containerWidth,
  timelineHeight,
}) => {
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const seek = usePlaybackStore((state) => state.seek);
  const zoom = useTimelineStore((state) => state.zoom);
  const scrollPosition = useTimelineStore((state) => state.scrollPosition);

  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();

  // Calculate playhead position
  const position = timeToPixels(currentTime, pixelsPerSecond, zoom);

  // Handle mouse down on playhead
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setShowTooltip(true);
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = currentTime;

      // Pause playback while scrubbing
      usePlaybackStore.getState().pause();
    },
    [currentTime]
  );

  // Handle dragging with RAF for smooth 60fps updates
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStartXRef.current;
        const deltaTime = deltaX / (pixelsPerSecond * zoom);
        const newTime = Math.max(0, dragStartTimeRef.current + deltaTime);

        seek(newTime);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setShowTooltip(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDragging, pixelsPerSecond, zoom, seek]);

  return (
    <div
      className="absolute top-0 z-50 pointer-events-none"
      style={{
        left: `${position}px`,
        height: `${timelineHeight}px`,
      }}
    >
      {/* Playhead line */}
      <div
        className="absolute top-0 w-0.5 bg-red-500 shadow-lg pointer-events-auto cursor-ew-resize"
        style={{ height: `${timelineHeight}px` }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => !isDragging && setShowTooltip(false)}
      />

      {/* Playhead handle (top triangle) */}
      <div
        className="absolute -top-1 -left-2 pointer-events-auto cursor-ew-resize"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => !isDragging && setShowTooltip(false)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 0 L0 8 L16 8 Z" fill="#ef4444" />
        </svg>
      </div>

      {/* Tooltip showing current time */}
      {showTooltip && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-mono whitespace-nowrap shadow-lg pointer-events-none"
          style={{ zIndex: 100 }}
        >
          {formatTime(currentTime, fps)}
        </div>
      )}
    </div>
  );
};
