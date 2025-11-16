import React, { useMemo, useCallback } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import {
  timeToPixels,
  pixelsToTime,
  getTickInterval,
  formatTimeAdaptive,
} from '@/lib/timeline/timeUtils';

interface TimelineRulerProps {
  pixelsPerSecond?: number;
  fps?: number;
  height?: number;
  containerWidth: number;
  maxDuration?: number;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  pixelsPerSecond = 100,
  fps = 30,
  height = 40,
  containerWidth,
  maxDuration = 300, // 5 minutes default
}) => {
  const zoom = useTimelineStore((state) => state.zoom);
  const seek = usePlaybackStore((state) => state.seek);
  const scrollPosition = useTimelineStore((state) => state.scrollPosition);

  // Calculate tick intervals based on zoom
  const { major: majorInterval, minor: minorInterval } = getTickInterval(
    zoom,
    fps
  );

  // Generate tick marks
  const ticks = useMemo(() => {
    const majorTicks: Array<{ time: number; position: number; label: string }> =
      [];
    const minorTicks: Array<{ time: number; position: number }> = [];

    // Calculate visible range with some padding
    const startTime = Math.max(
      0,
      pixelsToTime(scrollPosition - containerWidth, pixelsPerSecond, zoom)
    );
    const endTime =
      pixelsToTime(
        scrollPosition + containerWidth * 2,
        pixelsPerSecond,
        zoom
      ) || maxDuration;

    // Generate major ticks
    const majorStart = Math.floor(startTime / majorInterval) * majorInterval;
    for (
      let time = majorStart;
      time <= endTime;
      time += majorInterval
    ) {
      const position = timeToPixels(time, pixelsPerSecond, zoom);
      majorTicks.push({
        time,
        position,
        label: formatTimeAdaptive(time, fps, zoom),
      });
    }

    // Generate minor ticks (only if they won't be too dense)
    if (minorInterval !== majorInterval && zoom >= 0.5) {
      const minorStart =
        Math.floor(startTime / minorInterval) * minorInterval;
      for (
        let time = minorStart;
        time <= endTime;
        time += minorInterval
      ) {
        // Skip if it's a major tick
        if (Math.abs(time % majorInterval) > 0.0001) {
          const position = timeToPixels(time, pixelsPerSecond, zoom);
          minorTicks.push({ time, position });
        }
      }
    }

    return { majorTicks, minorTicks };
  }, [
    zoom,
    majorInterval,
    minorInterval,
    pixelsPerSecond,
    fps,
    maxDuration,
    scrollPosition,
    containerWidth,
  ]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left + scrollPosition;
      const time = pixelsToTime(clickX, pixelsPerSecond, zoom);
      seek(time);
    },
    [pixelsPerSecond, zoom, scrollPosition, seek]
  );

  return (
    <div
      className="relative bg-gray-800 border-b border-gray-700 cursor-pointer select-none overflow-hidden"
      style={{ height: `${height}px` }}
      onClick={handleClick}
    >
      {/* Minor ticks */}
      {ticks.minorTicks.map((tick, index) => (
        <div
          key={`minor-${index}`}
          className="absolute bottom-0 w-px bg-gray-600"
          style={{
            left: `${tick.position}px`,
            height: '8px',
          }}
        />
      ))}

      {/* Major ticks with labels */}
      {ticks.majorTicks.map((tick, index) => (
        <div
          key={`major-${index}`}
          className="absolute bottom-0"
          style={{ left: `${tick.position}px` }}
        >
          {/* Tick mark */}
          <div className="absolute bottom-0 w-px bg-gray-400" style={{ height: '16px' }} />

          {/* Time label */}
          <div className="absolute bottom-5 left-1 text-xs text-gray-300 font-mono whitespace-nowrap">
            {tick.label}
          </div>
        </div>
      ))}

      {/* Hover indicator */}
      <div className="absolute inset-0 hover:bg-gray-700/20 transition-colors" />
    </div>
  );
};
