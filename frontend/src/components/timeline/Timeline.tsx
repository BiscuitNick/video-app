import React, { useRef, useCallback, useState, useEffect } from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineKeyboard } from '@/hooks/useTimelineKeyboard';
import { Track } from './Track';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { ZoomControls } from './ZoomControls';
import { SnapToggle } from './SnapToggle';
import { SnapIndicators } from './SnapIndicators';
import { MarqueeSelection } from './MarqueeSelection';
import {
  SnapManager,
  createDefaultSnapConfig,
  type SnapIndicator,
} from '@/lib/timeline/SnapManager';
import { cn } from '@/lib/utils';

interface TimelineProps {
  className?: string;
  fps?: number;
  pixelsPerSecond?: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  className,
  fps = 30,
  pixelsPerSecond = 100,
}) => {
  const listRef = useRef<ListImperativeAPI | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [snapIndicators, setSnapIndicators] = useState<SnapIndicator[]>([]);

  const tracks = useTimelineStore((state) => state.tracks);
  const zoom = useTimelineStore((state) => state.zoom);
  const setScrollPosition = useTimelineStore((state) => state.setScrollPosition);
  const snapEnabled = useTimelineStore((state) => state.snapEnabled);
  const duration = usePlaybackStore((state) => state.duration);

  // Initialize snap manager
  const snapManagerRef = useRef(
    new SnapManager(
      { ...createDefaultSnapConfig(), enabled: snapEnabled },
      pixelsPerSecond,
      zoom,
      fps
    )
  );

  // Update snap manager when settings change
  useEffect(() => {
    snapManagerRef.current.updateConfig({ enabled: snapEnabled });
    snapManagerRef.current.updateZoom(zoom);
  }, [snapEnabled, zoom]);

  // Enable keyboard controls
  useTimelineKeyboard({ fps, enabled: true });

  // Measure container width for ruler
  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate row height for each track
  const getItemSize = useCallback(
    (index: number): number => {
      const track = tracks[index];
      return track?.height || 80;
    },
    [tracks]
  );

  // Handle scroll synchronization
  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      setScrollPosition(scrollOffset);
    },
    [setScrollPosition]
  );

  // Track visible range for viewport optimization
  const handleRowsRendered = useCallback(
    ({ startIndex, stopIndex }: {
      startIndex: number;
      stopIndex: number;
    }) => {
      setVisibleRange({
        start: startIndex,
        end: stopIndex,
      });
    },
    []
  );

  // Scroll synchronization for horizontal scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleHorizontalScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollPosition(target.scrollLeft);
    };

    container.addEventListener('scroll', handleHorizontalScroll);
    return () => container.removeEventListener('scroll', handleHorizontalScroll);
  }, [setScrollPosition]);

  // Row renderer for virtualized list
  const RowComponent = useCallback(
    ({ index }: { index: number }) => {
      const track = tracks[index];
      if (!track) return null;

      return (
        <Track
          track={track}
          index={index}
          zoom={zoom}
          isVisible={index >= visibleRange.start && index <= visibleRange.end}
        />
      );
    },
    [tracks, zoom, visibleRange]
  );

  // Calculate max duration from tracks
  const maxDuration = Math.max(
    duration,
    ...tracks.flatMap((track) => track.clips.map((clip) => clip.endTime)),
    300
  );

  // Calculate total timeline height
  const totalHeight = tracks.reduce((acc, track, index) => acc + getItemSize(index), 0);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
        {/* Controls bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-zinc-200">Timeline</h3>
            <SnapToggle />
          </div>
          <ZoomControls
            pixelsPerSecond={pixelsPerSecond}
            containerWidth={containerWidth}
            maxDuration={maxDuration}
          />
        </div>

        {/* Timeline ruler */}
        <div ref={rulerRef} className="sticky top-0 z-10">
          <TimelineRuler
            pixelsPerSecond={pixelsPerSecond}
            fps={fps}
            containerWidth={containerWidth}
            maxDuration={maxDuration}
          />
        </div>

        {/* Timeline content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            {/* Track labels column */}
            <div className="w-48 bg-zinc-800 border-r border-zinc-700 overflow-y-hidden">
              <div className="h-full">
                {tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="border-b border-zinc-700 flex items-center"
                    style={{ height: getItemSize(index) }}
                  >
                    <div className="w-full px-3">
                      <div className="text-sm font-medium text-zinc-100 truncate">
                        {track.name}
                      </div>
                      <div className="text-xs text-zinc-400">{track.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline tracks */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-auto relative"
              style={{
                scrollbarGutter: 'stable',
              }}
            >
              <div
                ref={tracksContainerRef}
                style={{ width: `${10000 * zoom}px`, position: 'relative' }}
              >
                {/* Snap indicators */}
                <SnapIndicators
                  indicators={snapIndicators}
                  timelineHeight={totalHeight}
                />

                {/* Playhead */}
                <Playhead
                  pixelsPerSecond={pixelsPerSecond}
                  fps={fps}
                  containerWidth={containerWidth}
                  timelineHeight={totalHeight}
                />

                {/* Marquee Selection */}
                <MarqueeSelection
                  containerRef={tracksContainerRef}
                  pixelsPerSecond={pixelsPerSecond}
                  zoom={zoom}
                />

                <List
                  listRef={listRef}
                  defaultHeight={600}
                  rowCount={tracks.length}
                  rowHeight={getItemSize}
                  onRowsRendered={handleRowsRendered}
                  rowComponent={RowComponent}
                  overscanCount={3}
                  className="scrollbar-thin"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        <div className="px-4 py-2 bg-zinc-800 border-t border-zinc-700">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-400">
            <div className="flex gap-4">
              <span>Space/K: Play/Pause</span>
              <span>← →: Frame Step</span>
              <span>Shift + ← →: Second Jump</span>
            </div>
            <div className="flex gap-4">
              <span>Ctrl+A: Select All</span>
              <span>Escape: Clear Selection</span>
              <span>Delete: Delete Selected</span>
            </div>
            <div className="flex gap-4">
              <span>S: Toggle Snap</span>
              <span>I/O: Set In/Out Points</span>
            </div>
            <div className="flex gap-4">
              <span>Ctrl+C/X/V: Copy/Cut/Paste</span>
              <span>Ctrl+Z/Y: Undo/Redo</span>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};
