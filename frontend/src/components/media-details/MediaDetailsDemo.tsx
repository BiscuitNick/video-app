import React, { useEffect } from 'react';
import { MediaDetailsPanel } from './MediaDetailsPanel';
import { useTimelineStore } from '@/stores/useTimelineStore';
import type { Track, Clip } from '@/types';

/**
 * Demo component to showcase MediaDetailsPanel functionality
 * This component sets up sample data and displays the panel
 */
export const MediaDetailsDemo: React.FC = () => {
  const { tracks, addTrack, addClip, selectClip } = useTimelineStore();

  useEffect(() => {
    // Initialize demo data if not already present
    if (tracks.length === 0) {
      const demoTrack: Track = {
        id: 'demo-track-1',
        name: 'Video Track 1',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 80,
      };

      const demoClip: Clip = {
        id: 'demo-clip-1',
        trackId: 'demo-track-1',
        mediaAssetId: 'demo-asset-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 0,
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 100, y: 100 },
            rotation: 0,
            opacity: 100,
          },
          audio: {
            volume: 100,
            muted: false,
          },
          transition: {
            type: 'none',
            duration: 0.5,
          },
        },
      };

      addTrack(demoTrack);
      addClip(demoClip);
      selectClip(demoClip.id);
    }
  }, [tracks, addTrack, addClip, selectClip]);

  return (
    <div className="h-screen p-4 bg-background">
      <div className="max-w-md mx-auto h-full">
        <h1 className="text-2xl font-bold mb-4">Media Details Panel Demo</h1>
        <MediaDetailsPanel />
      </div>
    </div>
  );
};
