import React, { useState, useRef, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTimelineStore } from '@/stores';
import type { Track as TrackType } from '@/types';
import { Clip } from './Clip';
import { cn } from '@/lib/utils';

interface TrackProps {
  track: TrackType;
  index: number;
  zoom: number;
  isVisible: boolean;
}

const ITEM_TYPE = 'TRACK';

export const Track: React.FC<TrackProps> = ({ track, index, zoom, isVisible }) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(track.name);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const {
    updateTrack,
    reorderTracks,
    selection,
    selectTrack,
  } = useTimelineStore();

  // Drag and drop for reordering
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index, id: track.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPE,
    hover: (item: { index: number; id: string }) => {
      if (item.index === index) return;

      reorderTracks(item.index, index);
      item.index = index;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Handle label editing
  const handleLabelClick = useCallback(() => {
    if (!track.locked) {
      setIsEditingLabel(true);
    }
  }, [track.locked]);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (labelValue.trim() && labelValue !== track.name) {
      updateTrack(track.id, { name: labelValue.trim() });
    } else {
      setLabelValue(track.name);
    }
  }, [labelValue, track.id, track.name, updateTrack]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLabelBlur();
      } else if (e.key === 'Escape') {
        setLabelValue(track.name);
        setIsEditingLabel(false);
      }
    },
    [handleLabelBlur, track.name]
  );

  // Toggle lock/mute
  const toggleLock = useCallback(() => {
    updateTrack(track.id, { locked: !track.locked });
  }, [track.id, track.locked, updateTrack]);

  const toggleMute = useCallback(() => {
    updateTrack(track.id, { muted: !track.muted });
  }, [track.id, track.muted, updateTrack]);

  // Track height adjustment
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = track.height;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartY.current;
      const newHeight = Math.max(60, Math.min(300, resizeStartHeight.current + delta));
      updateTrack(track.id, { height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [track.height, track.id, updateTrack]);

  // Track selection
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!e.defaultPrevented) {
        selectTrack(track.id, e.shiftKey || e.metaKey);
      }
    },
    [selectTrack, track.id]
  );

  const isSelected = selection.trackIds.includes(track.id);

  // Combine drag and drop refs
  const dragDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
      drop(node);
    },
    [drag, drop]
  );

  return (
    <div
      ref={dragDropRef}
      data-track-id={track.id}
      className={cn(
        'border-b border-zinc-700 relative transition-colors',
        isDragging && 'opacity-50',
        isOver && 'bg-zinc-700',
        isSelected && 'bg-zinc-800'
      )}
      style={{ height: track.height }}
      onClick={handleTrackClick}
    >
      {/* Track content area */}
      <div className="relative w-full h-full">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-zinc-600"
              style={{ left: `${i * 100 * zoom}px` }}
            />
          ))}
        </div>

        {/* Clips */}
        {isVisible && track.clips.map((clip) => (
          <Clip
            key={clip.id}
            clip={clip}
            track={track}
            zoom={zoom}
          />
        ))}
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 transition-colors',
          isResizing && 'bg-blue-500'
        )}
        onMouseDown={handleResizeStart}
      />

      {/* Track indicators overlay */}
      {track.locked && (
        <div className="absolute inset-0 bg-zinc-900/30 pointer-events-none" />
      )}
    </div>
  );
};
