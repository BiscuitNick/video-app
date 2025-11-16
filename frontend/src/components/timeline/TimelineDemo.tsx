/**
 * TimelineDemo - Demonstration of Timeline features
 * This file shows how to use the Timeline component with all features enabled
 */

import React, { useEffect } from 'react';
import { Timeline } from './Timeline';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import type { Track, Clip } from '@/types';

export const TimelineDemo: React.FC = () => {
  const addTrack = useTimelineStore((state) => state.addTrack);
  const addClip = useTimelineStore((state) => state.addClip);
  const setDuration = usePlaybackStore((state) => state.setDuration);

  // Initialize demo data
  useEffect(() => {
    const demoTracks: Track[] = [
      {
        id: 'track-1',
        name: 'Video Track 1',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 100,
      },
      {
        id: 'track-2',
        name: 'Video Track 2',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 100,
      },
      {
        id: 'track-3',
        name: 'Audio Track 1',
        type: 'audio',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 80,
      },
    ];

    const demoClips: Clip[] = [
      {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'asset-1',
        startTime: 0,
        endTime: 5,
        trimStart: 0,
        trimEnd: 0,
      },
      {
        id: 'clip-2',
        trackId: 'track-1',
        mediaAssetId: 'asset-2',
        startTime: 8,
        endTime: 13,
        trimStart: 0,
        trimEnd: 0,
      },
      {
        id: 'clip-3',
        trackId: 'track-2',
        mediaAssetId: 'asset-3',
        startTime: 3,
        endTime: 10,
        trimStart: 0,
        trimEnd: 0,
      },
      {
        id: 'clip-4',
        trackId: 'track-3',
        mediaAssetId: 'asset-4',
        startTime: 0,
        endTime: 15,
        trimStart: 0,
        trimEnd: 0,
      },
    ];

    // Add demo tracks and clips
    demoTracks.forEach((track) => addTrack(track));
    demoClips.forEach((clip) => addClip(clip));
    setDuration(20); // 20 second timeline

    // Cleanup
    return () => {
      // Optionally clear data on unmount
    };
  }, [addTrack, addClip, setDuration]);

  return (
    <div className="w-full h-screen p-4 bg-zinc-950">
      <div className="mb-4 text-white">
        <h1 className="text-2xl font-bold mb-2">Timeline Demo</h1>
        <p className="text-sm text-zinc-400">
          Test the timeline features: playhead scrubbing, zoom controls, snap
          system, and keyboard shortcuts
        </p>
      </div>

      <Timeline fps={30} pixelsPerSecond={100} />

      <div className="mt-4 p-4 bg-zinc-800 rounded-lg text-white">
        <h2 className="text-lg font-semibold mb-2">Feature Tests</h2>
        <ul className="text-sm text-zinc-300 space-y-1">
          <li>
            ✓ <strong>Playhead Scrubbing:</strong> Drag the red playhead to
            scrub through timeline
          </li>
          <li>
            ✓ <strong>Smooth 60fps Updates:</strong> Scrubbing uses
            requestAnimationFrame for smooth performance
          </li>
          <li>
            ✓ <strong>Frame-Accurate Positioning:</strong> Times snap to frame
            boundaries (30fps)
          </li>
          <li>
            ✓ <strong>Zoom Controls:</strong> Use buttons or Ctrl+Scroll to
            zoom (0.25x to 8x)
          </li>
          <li>
            ✓ <strong>Zoom Presets:</strong> Select from dropdown (25%, 50%,
            100%, 200%, 400%, 800%)
          </li>
          <li>
            ✓ <strong>Adaptive Ruler:</strong> Tick marks adjust based on zoom
            level
          </li>
          <li>
            ✓ <strong>Click-to-Seek:</strong> Click on ruler to jump to time
          </li>
          <li>
            ✓ <strong>Snapping System:</strong> Toggle snap with S key or
            button
          </li>
          <li>
            ✓ <strong>Keyboard Controls:</strong> Space/K (play), Arrows (frame
            step), Shift+Arrows (second jump)
          </li>
        </ul>

        <div className="mt-4 p-3 bg-zinc-900 rounded border border-zinc-700">
          <h3 className="text-sm font-semibold mb-2">Performance Metrics</h3>
          <p className="text-xs text-zinc-400">
            Expected: 60fps during scrubbing, &lt;10ms snap detection, &lt;50ms
            zoom updates
          </p>
        </div>
      </div>
    </div>
  );
};
