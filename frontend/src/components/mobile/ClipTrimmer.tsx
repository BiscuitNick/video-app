import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import type { Clip } from '@/types/timeline';

interface ClipTrimmerProps {
  clip: Clip;
  onTrim: (clipId: string, newStartTime: number, newEndTime: number) => void;
  pixelsPerSecond?: number;
  className?: string;
}

export const ClipTrimmer: React.FC<ClipTrimmerProps> = ({
  clip,
  onTrim,
  pixelsPerSecond = 50,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [tempStart, setTempStart] = useState(clip.startTime);
  const [tempEnd, setTempEnd] = useState(clip.endTime);
  const { vibrate, patterns } = useHaptics();

  const duration = tempEnd - tempStart;
  const width = duration * pixelsPerSecond;

  // Handle drag start
  const handleDragStart = useCallback((handle: 'start' | 'end', clientX: number) => {
    setIsDragging(handle);
    patterns.medium();
  }, [patterns]);

  // Handle drag move
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const timeOffset = offsetX / pixelsPerSecond;

    if (isDragging === 'start') {
      const newStart = Math.max(0, clip.startTime + timeOffset);
      // Ensure minimum duration of 0.5 seconds
      if (tempEnd - newStart >= 0.5) {
        setTempStart(newStart);
      }
    } else if (isDragging === 'end') {
      const newEnd = clip.endTime + timeOffset;
      // Ensure minimum duration of 0.5 seconds
      if (newEnd - tempStart >= 0.5) {
        setTempEnd(newEnd);
      }
    }
  }, [isDragging, clip, tempStart, tempEnd, pixelsPerSecond]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    patterns.strong();
    onTrim(clip.id, tempStart, tempEnd);
    setIsDragging(null);
  }, [isDragging, clip.id, tempStart, tempEnd, onTrim, patterns]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    handleDragStart(handle, e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse handlers (for testing)
  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    handleDragStart(handle, e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Clip Info */}
      <div className="flex items-center justify-between mobile-p-sm bg-zinc-700/50 rounded">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-zinc-400" />
          <span className="mobile-text-sm text-zinc-300">{clip.name}</span>
        </div>
        <span className="mobile-text-xs text-zinc-400">
          {formatTime(duration)}
        </span>
      </div>

      {/* Trimmer */}
      <div
        ref={containerRef}
        className="relative h-24 bg-zinc-800 rounded-lg overflow-hidden"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Clip visualization */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative h-16 bg-gradient-to-r from-blue-600 to-blue-500 rounded"
            style={{ width: `${width}px` }}
          >
            {/* Waveform placeholder */}
            <div className="absolute inset-0 opacity-30">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-white"
                  style={{
                    left: `${(i / 20) * 100}%`,
                    width: '2px',
                    height: `${30 + Math.random() * 70}%`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
              ))}
            </div>

            {/* Start Handle */}
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize',
                'flex items-center justify-center',
                isDragging === 'start' && 'bg-blue-300 w-4'
              )}
              onTouchStart={(e) => handleTouchStart(e, 'start')}
              onMouseDown={(e) => handleMouseDown(e, 'start')}
            >
              <div className="w-1 h-8 bg-zinc-800 rounded-full" />
            </div>

            {/* End Handle */}
            <div
              className={cn(
                'absolute right-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize',
                'flex items-center justify-center',
                isDragging === 'end' && 'bg-blue-300 w-4'
              )}
              onTouchStart={(e) => handleTouchStart(e, 'end')}
              onMouseDown={(e) => handleMouseDown(e, 'end')}
            >
              <div className="w-1 h-8 bg-zinc-800 rounded-full" />
            </div>
          </div>
        </div>

        {/* Time labels */}
        <div className="absolute bottom-2 left-2 mobile-text-xs text-zinc-400">
          {formatTime(tempStart)}
        </div>
        <div className="absolute bottom-2 right-2 mobile-text-xs text-zinc-400">
          {formatTime(tempEnd)}
        </div>
      </div>

      {/* Instructions */}
      <p className="mobile-text-xs text-zinc-500 text-center">
        Drag the handles to trim the clip
      </p>
    </div>
  );
};
