import React, { useCallback, useRef, useState, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { Film, Music, Image as ImageIcon } from 'lucide-react';
import { useTimelineStore } from '@/stores';
import { useMediaLibraryStore } from '@/stores';
import type { Clip as ClipType, Track } from '@/types';
import { cn } from '@/lib/utils';
import { useWaveform } from '@/lib/waveform';
import { WaveformRenderer } from '@/components/waveform/WaveformRenderer';
import type { WaveformRenderOptions } from '@/lib/waveform/types';
import { WaveformQuality } from '@/lib/waveform/types';

interface ClipProps {
  clip: ClipType;
  track: Track;
  zoom: number;
}

const ITEM_TYPE = 'CLIP';

export const Clip: React.FC<ClipProps> = ({ clip, track, zoom }) => {
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartTime = useRef(0);
  const resizeStartEndTime = useRef(0);

  const {
    updateClip,
    moveClip,
    selection,
    selectClip,
    toggleClipSelection,
    snapEnabled,
    tracks,
  } = useTimelineStore();

  const { getAssetById } = useMediaLibraryStore();

  const isSelected = selection.clipIds.includes(clip.id);
  const isLocked = track.locked;

  // Get media asset for thumbnail and type
  const mediaAsset = useMemo(() => {
    return getAssetById(clip.mediaAssetId);
  }, [clip.mediaAssetId, getAssetById]);

  // Calculate position and size
  const pixelsPerSecond = 100 * zoom;
  const left = clip.startTime * pixelsPerSecond;
  const width = (clip.endTime - clip.startTime) * pixelsPerSecond;

  // Load waveform for audio clips
  const isAudioClip = mediaAsset?.type === 'audio';
  const audioUrl = isAudioClip && mediaAsset?.url ? mediaAsset.url : null;
  const { waveformData, isLoading: isWaveformLoading } = useWaveform(
    isAudioClip ? clip.mediaAssetId : null,
    audioUrl,
    {
      quality: WaveformQuality.MEDIUM,
      autoLoad: true,
    }
  );

  // Waveform render options
  const waveformOptions: WaveformRenderOptions = useMemo(() => ({
    width: Math.max(width, 50),
    height: 60,
    zoom,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    volumeEnvelope: 1, // Could be linked to clip volume in the future
  }), [width, zoom, clip.trimStart, clip.trimEnd]);

  // Drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: () => ({
      id: clip.id,
      trackId: track.id,
      startTime: clip.startTime,
    }),
    canDrag: !isLocked,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (!delta) return;

      const timeDelta = delta.x / pixelsPerSecond;
      const newStartTime = Math.max(0, item.startTime + timeDelta);

      // Snap to grid if enabled
      const snappedTime = snapEnabled
        ? Math.round(newStartTime * 2) / 2 // Snap to 0.5 second intervals
        : newStartTime;

      // Check if dropped on a different track
      const dropY = (monitor.getClientOffset()?.y || 0);
      const trackElements = document.querySelectorAll('[data-track-id]');
      let targetTrackId = track.id;

      trackElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (dropY >= rect.top && dropY <= rect.bottom) {
          targetTrackId = el.getAttribute('data-track-id') || track.id;
        }
      });

      // Check for collisions
      if (!checkCollision(targetTrackId, clip.id, snappedTime, clip.endTime - clip.startTime)) {
        moveClip(clip.id, targetTrackId, snappedTime);
      }
    },
  });

  // Collision detection
  const checkCollision = useCallback(
    (trackId: string, clipId: string, startTime: number, duration: number): boolean => {
      const targetTrack = tracks.find((t) => t.id === trackId);
      if (!targetTrack) return false;

      const endTime = startTime + duration;

      return targetTrack.clips.some((c) => {
        if (c.id === clipId) return false;
        return !(endTime <= c.startTime || startTime >= c.endTime);
      });
    },
    [tracks]
  );

  // Resize left (trim start)
  const handleResizeLeftStart = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked) return;
      e.stopPropagation();
      e.preventDefault();

      setIsResizingLeft(true);
      resizeStartX.current = e.clientX;
      resizeStartTime.current = clip.startTime;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - resizeStartX.current;
        const timeDelta = delta / pixelsPerSecond;
        const newStartTime = Math.max(0, resizeStartTime.current + timeDelta);

        // Don't allow start time to exceed end time
        if (newStartTime < clip.endTime - 0.1) {
          const newTrimStart = clip.trimStart + timeDelta;
          updateClip(clip.id, {
            startTime: newStartTime,
            trimStart: Math.max(0, newTrimStart),
          });
        }
      };

      const handleMouseUp = () => {
        setIsResizingLeft(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clip, isLocked, pixelsPerSecond, updateClip]
  );

  // Resize right (trim end)
  const handleResizeRightStart = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked) return;
      e.stopPropagation();
      e.preventDefault();

      setIsResizingRight(true);
      resizeStartX.current = e.clientX;
      resizeStartEndTime.current = clip.endTime;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - resizeStartX.current;
        const timeDelta = delta / pixelsPerSecond;
        const newEndTime = resizeStartEndTime.current + timeDelta;

        // Don't allow end time to be less than start time
        if (newEndTime > clip.startTime + 0.1) {
          const newTrimEnd = clip.trimEnd - timeDelta;
          updateClip(clip.id, {
            endTime: newEndTime,
            trimEnd: Math.max(0, newTrimEnd),
          });
        }
      };

      const handleMouseUp = () => {
        setIsResizingRight(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clip, isLocked, pixelsPerSecond, updateClip]
  );

  // Handle clip selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isLocked) {
        // Ctrl/Cmd+click: Toggle selection
        if (e.ctrlKey || e.metaKey) {
          toggleClipSelection(clip.id);
        }
        // Shift+click: Range selection
        else if (e.shiftKey) {
          selectClip(clip.id, false, true); // rangeSelect = true
        }
        // Regular click: Select single clip
        else {
          selectClip(clip.id, false, false);
        }
      }
    },
    [clip.id, isLocked, selectClip, toggleClipSelection]
  );

  // Get media type icon
  const MediaIcon = useMemo(() => {
    if (!mediaAsset) return Film;
    switch (mediaAsset.type) {
      case 'video':
        return Film;
      case 'audio':
        return Music;
      case 'image':
        return ImageIcon;
      default:
        return Film;
    }
  }, [mediaAsset]);

  // Get clip color based on media type
  const clipColor = useMemo(() => {
    if (!mediaAsset) return 'bg-blue-600';
    switch (mediaAsset.type) {
      case 'video':
        return 'bg-blue-600';
      case 'audio':
        return 'bg-green-600';
      case 'image':
        return 'bg-purple-600';
      default:
        return 'bg-blue-600';
    }
  }, [mediaAsset]);

  // Drag ref callback
  const dragRef = useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
    },
    [drag]
  );

  return (
    <div
      ref={dragRef}
      data-clip-id={clip.id}
      className={cn(
        'absolute top-2 h-[calc(100%-16px)] rounded overflow-hidden',
        'border-2 transition-all cursor-move',
        clipColor,
        isDragging && 'opacity-50 cursor-grabbing',
        isSelected && 'border-yellow-400 ring-2 ring-yellow-400',
        !isSelected && 'border-transparent',
        isLocked && 'cursor-not-allowed opacity-60'
      )}
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
      onClick={handleClick}
    >
      {/* Thumbnail background for video clips */}
      {mediaAsset?.type === 'video' && mediaAsset.thumbnail && (
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: `url(${mediaAsset.thumbnail})` }}
        />
      )}

      {/* Waveform background for audio clips */}
      {mediaAsset?.type === 'audio' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <WaveformRenderer
            waveformData={waveformData}
            options={waveformOptions}
            isLoading={isWaveformLoading}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Clip content */}
      <div className="relative h-full flex items-center px-2 space-x-2">
        <MediaIcon className="w-4 h-4 text-white flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white truncate">
            {mediaAsset?.name || 'Unknown'}
          </div>
          <div className="text-xs text-white/70">
            {(clip.endTime - clip.startTime).toFixed(2)}s
          </div>
        </div>
      </div>

      {/* Left resize handle */}
      {!isLocked && (
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize',
            'hover:bg-white/30 transition-colors',
            isResizingLeft && 'bg-white/50'
          )}
          onMouseDown={handleResizeLeftStart}
        >
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-white rounded" />
        </div>
      )}

      {/* Right resize handle */}
      {!isLocked && (
        <div
          className={cn(
            'absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize',
            'hover:bg-white/30 transition-colors',
            isResizingRight && 'bg-white/50'
          )}
          onMouseDown={handleResizeRightStart}
        >
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-white rounded" />
        </div>
      )}

      {/* Trim indicators */}
      {clip.trimStart > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 opacity-70" />
      )}
      {clip.trimEnd > 0 && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500 opacity-70" />
      )}
    </div>
  );
};
