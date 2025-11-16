import React, { useCallback, useEffect, useState } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { calculateZoom } from '@/lib/timeline/timeUtils';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomControlsProps {
  pixelsPerSecond?: number;
  containerWidth?: number;
  maxDuration?: number;
}

const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4, 8];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  pixelsPerSecond = 100,
  containerWidth = 1000,
  maxDuration = 300,
}) => {
  const zoom = useTimelineStore((state) => state.zoom);
  const setZoom = useTimelineStore((state) => state.setZoom);
  const scrollPosition = useTimelineStore((state) => state.scrollPosition);
  const setScrollPosition = useTimelineStore((state) => state.setScrollPosition);
  const currentTime = usePlaybackStore((state) => state.currentTime);

  const [isDebouncing, setIsDebouncing] = useState(false);

  // Zoom in/out with playhead position maintenance
  const handleZoom = useCallback(
    (delta: number) => {
      const newZoom = calculateZoom(zoom, delta, MIN_ZOOM, MAX_ZOOM);
      
      if (newZoom === zoom) return;

      // Calculate playhead position before zoom
      const playheadPixelBefore = currentTime * pixelsPerSecond * zoom;
      
      // Apply new zoom
      setZoom(newZoom);
      
      // Calculate new playhead position after zoom
      const playheadPixelAfter = currentTime * pixelsPerSecond * newZoom;
      
      // Adjust scroll to keep playhead in the same visual position
      const scrollAdjustment = playheadPixelAfter - playheadPixelBefore;
      setScrollPosition(Math.max(0, scrollPosition + scrollAdjustment));
    },
    [zoom, currentTime, pixelsPerSecond, scrollPosition, setZoom, setScrollPosition]
  );

  // Zoom to fit entire timeline in viewport
  const handleZoomToFit = useCallback(() => {
    const duration = maxDuration || 300;
    const requiredZoom = containerWidth / (duration * pixelsPerSecond);
    const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requiredZoom));
    setZoom(fitZoom);
    setScrollPosition(0);
  }, [maxDuration, containerWidth, pixelsPerSecond, setZoom, setScrollPosition]);

  // Set specific zoom preset
  const handlePresetZoom = useCallback(
    (presetZoom: number) => {
      const playheadPixelBefore = currentTime * pixelsPerSecond * zoom;
      setZoom(presetZoom);
      const playheadPixelAfter = currentTime * pixelsPerSecond * presetZoom;
      const scrollAdjustment = playheadPixelAfter - playheadPixelBefore;
      setScrollPosition(Math.max(0, scrollPosition + scrollAdjustment));
    },
    [currentTime, pixelsPerSecond, zoom, scrollPosition, setZoom, setScrollPosition]
  );

  // Handle wheel zoom with debouncing
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom with Ctrl/Cmd key
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      
      if (!isDebouncing) {
        setIsDebouncing(true);
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        handleZoom(delta);

        debounceTimeout = setTimeout(() => {
          setIsDebouncing(false);
        }, 50); // 50ms debounce
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [handleZoom, isDebouncing]);

  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      {/* Zoom out button */}
      <button
        onClick={() => handleZoom(-0.2)}
        disabled={zoom <= MIN_ZOOM}
        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Zoom out (Ctrl + Scroll down)"
      >
        <ZoomOut className="w-4 h-4 text-gray-300" />
      </button>

      {/* Zoom percentage display */}
      <div className="flex items-center gap-1 min-w-[80px]">
        <select
          value={zoom}
          onChange={(e) => handlePresetZoom(parseFloat(e.target.value))}
          className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors"
        >
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {Math.round(preset * 100)}%
            </option>
          ))}
          {!ZOOM_PRESETS.includes(zoom) && (
            <option value={zoom}>{Math.round(zoom * 100)}%</option>
          )}
        </select>
      </div>

      {/* Zoom in button */}
      <button
        onClick={() => handleZoom(0.2)}
        disabled={zoom >= MAX_ZOOM}
        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Zoom in (Ctrl + Scroll up)"
      >
        <ZoomIn className="w-4 h-4 text-gray-300" />
      </button>

      {/* Zoom to fit button */}
      <div className="w-px h-6 bg-gray-700 mx-1" />
      <button
        onClick={handleZoomToFit}
        className="p-1.5 rounded hover:bg-gray-700 transition-colors"
        title="Zoom to fit"
      >
        <Maximize2 className="w-4 h-4 text-gray-300" />
      </button>
    </div>
  );
};
