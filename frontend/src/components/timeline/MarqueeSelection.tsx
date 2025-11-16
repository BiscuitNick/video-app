import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTimelineStore } from '@/stores';
import { cn } from '@/lib/utils';

interface MarqueeSelectionProps {
  containerRef: React.RefObject<HTMLDivElement>;
  pixelsPerSecond: number;
  zoom: number;
  onSelectionChange?: (clipIds: string[]) => void;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const MarqueeSelection: React.FC<MarqueeSelectionProps> = ({
  containerRef,
  pixelsPerSecond,
  zoom,
  onSelectionChange,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isMouseDownRef = useRef(false);

  const { tracks, selectClips } = useTimelineStore();

  // Calculate the actual marquee display rectangle
  const getDisplayRect = useCallback((rect: MarqueeRect | null) => {
    if (!rect) return null;

    const left = Math.min(rect.startX, rect.currentX);
    const top = Math.min(rect.startY, rect.currentY);
    const width = Math.abs(rect.currentX - rect.startX);
    const height = Math.abs(rect.currentY - rect.startY);

    return { left, top, width, height };
  }, []);

  // Get clips within the marquee selection
  const getClipsInMarquee = useCallback(
    (rect: MarqueeRect | null) => {
      if (!rect || !containerRef.current) return [];

      const displayRect = getDisplayRect(rect);
      if (!displayRect) return [];

      const selectedClipIds: string[] = [];
      const containerRect = containerRef.current.getBoundingClientRect();
      const pps = pixelsPerSecond * zoom;

      tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          const clipLeft = clip.startTime * pps;
          const clipWidth = (clip.endTime - clip.startTime) * pps;
          const clipRight = clipLeft + clipWidth;

          // Get clip element to determine vertical position
          const clipElement = document.querySelector(`[data-clip-id="${clip.id}"]`);
          if (!clipElement) return;

          const clipRect = clipElement.getBoundingClientRect();
          const clipTop = clipRect.top - containerRect.top + containerRef.current.scrollTop;
          const clipBottom = clipTop + clipRect.height;

          // Check if clip intersects with marquee
          const marqueeLeft = displayRect.left;
          const marqueeRight = displayRect.left + displayRect.width;
          const marqueeTop = displayRect.top;
          const marqueeBottom = displayRect.top + displayRect.height;

          const horizontalOverlap = clipLeft < marqueeRight && clipRight > marqueeLeft;
          const verticalOverlap = clipTop < marqueeBottom && clipBottom > marqueeTop;

          if (horizontalOverlap && verticalOverlap) {
            selectedClipIds.push(clip.id);
          }
        });
      });

      return selectedClipIds;
    },
    [tracks, pixelsPerSecond, zoom, containerRef, getDisplayRect]
  );

  // Handle mouse down to start selection
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Only start marquee selection on left click in empty space
      if (e.button !== 0) return;

      // Don't start selection if clicking on a clip or other interactive element
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-clip-id]') ||
        target.closest('button') ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const startX = e.clientX - containerRect.left + containerRef.current.scrollLeft;
      const startY = e.clientY - containerRect.top + containerRef.current.scrollTop;

      isMouseDownRef.current = true;
      startPositionRef.current = { x: e.clientX, y: e.clientY };

      setMarqueeRect({
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      });
    },
    [containerRef]
  );

  // Handle mouse move to update selection
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isMouseDownRef.current || !startPositionRef.current || !containerRef.current) return;

      // Only start visual selection after moving a few pixels (prevents accidental selections)
      const deltaX = Math.abs(e.clientX - startPositionRef.current.x);
      const deltaY = Math.abs(e.clientY - startPositionRef.current.y);

      if (deltaX < 5 && deltaY < 5) return;

      setIsSelecting(true);

      const containerRect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - containerRect.left + containerRef.current.scrollLeft;
      const currentY = e.clientY - containerRect.top + containerRef.current.scrollTop;

      setMarqueeRect((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX,
          currentY,
        };
      });
    },
    [containerRef]
  );

  // Handle mouse up to complete selection
  const handleMouseUp = useCallback(() => {
    if (isSelecting && marqueeRect) {
      const selectedClipIds = getClipsInMarquee(marqueeRect);
      selectClips(selectedClipIds);

      if (onSelectionChange) {
        onSelectionChange(selectedClipIds);
      }
    }

    isMouseDownRef.current = false;
    startPositionRef.current = null;
    setIsSelecting(false);
    setMarqueeRect(null);
  }, [isSelecting, marqueeRect, getClipsInMarquee, selectClips, onSelectionChange]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Update selection preview during marquee
  useEffect(() => {
    if (isSelecting && marqueeRect) {
      const selectedClipIds = getClipsInMarquee(marqueeRect);

      // Highlight clips without committing selection
      // This provides visual feedback during selection
      document.querySelectorAll('[data-clip-id]').forEach((element) => {
        const clipId = element.getAttribute('data-clip-id');
        if (clipId && selectedClipIds.includes(clipId)) {
          element.classList.add('marquee-selecting');
        } else {
          element.classList.remove('marquee-selecting');
        }
      });
    } else {
      // Clean up preview highlights
      document.querySelectorAll('[data-clip-id]').forEach((element) => {
        element.classList.remove('marquee-selecting');
      });
    }
  }, [isSelecting, marqueeRect, getClipsInMarquee]);

  if (!isSelecting || !marqueeRect) return null;

  const displayRect = getDisplayRect(marqueeRect);
  if (!displayRect) return null;

  return (
    <div
      className={cn(
        'absolute pointer-events-none z-50',
        'border-2 border-blue-500 bg-blue-500/20'
      )}
      style={{
        left: `${displayRect.left}px`,
        top: `${displayRect.top}px`,
        width: `${displayRect.width}px`,
        height: `${displayRect.height}px`,
      }}
    />
  );
};
