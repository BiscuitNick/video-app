import { useParams } from 'react-router';
import { useEffect, useCallback, useState } from 'react';
import { Play, SkipBack, SkipForward } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Timeline } from '../components/timeline';
import { MediaLibraryWidget } from '../components/media/MediaLibraryWidget';
import { useTimelineStore, useMediaStore } from '../contexts/StoreContext';
import type { MediaAsset, Clip } from '../types/stores';

/**
 * Project editor page with basic editor shell and route param handling
 */
export default function ProjectEditorPage() {
  const { projectId } = useParams();
  const timelineStore = useTimelineStore();
  const mediaStore = useMediaStore();

  // Select Timeline state with useShallow for optimized re-renders
  const { tracks, clips, selectedClipIds, playhead, zoom, fps } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      clips: state.clips,
      selectedClipIds: state.selectedClipIds,
      playhead: state.playhead,
      zoom: state.zoom,
      fps: state.fps,
    }))
  );

  // Initialize default tracks on component mount
  useEffect(() => {
    if (timelineStore.tracks.length === 0) {
      // Add default video track
      timelineStore.addTrack({
        type: 'video',
        name: 'Video 1',
        height: 80,
        locked: false,
        hidden: false,
        muted: false,
        order: 0,
      });

      // Add default audio track
      timelineStore.addTrack({
        type: 'audio',
        name: 'Audio 1',
        height: 60,
        locked: false,
        hidden: false,
        muted: false,
        order: 1,
      });

      // Add default text track
      timelineStore.addTrack({
        type: 'text',
        name: 'Text/Titles',
        height: 60,
        locked: false,
        hidden: false,
        muted: false,
        order: 2,
      });
    }

    // Add sample media assets for testing if none exist
    if (mediaStore.assets.size === 0) {
      const sampleAssets: MediaAsset[] = [
        {
          id: 'sample-video-1',
          name: 'Sample Video.mp4',
          type: 'video',
          url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
          thumbnailUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Video',
          size: 1048576,
          duration: 10,
          width: 1280,
          height: 720,
          createdAt: new Date(),
          metadata: {},
          tags: [],
        },
        {
          id: 'sample-image-1',
          name: 'Sample Image.jpg',
          type: 'image',
          url: 'https://via.placeholder.com/1920x1080/FF0000/FFFFFF?text=Sample+Image',
          thumbnailUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Image',
          size: 524288,
          width: 1920,
          height: 1080,
          createdAt: new Date(),
          metadata: {},
          tags: [],
        },
        {
          id: 'sample-image-2',
          name: 'AI Generated.jpg',
          type: 'image',
          url: 'https://via.placeholder.com/1920x1080/00FF00/FFFFFF?text=AI+Generated',
          thumbnailUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=AI',
          size: 524288,
          width: 1920,
          height: 1080,
          createdAt: new Date(),
          metadata: { aiGenerated: true },
          tags: [],
        },
      ];

      sampleAssets.forEach(asset => mediaStore.addAsset(asset));
    }
  }, [timelineStore, mediaStore]);

  // Calculate duration (default to 5 minutes if not set)
  const duration = timelineStore.duration > 0 ? timelineStore.duration : timelineStore.fps * 300;

  // Event handler for adding tracks
  const handleAddTrack = useCallback(() => {
    const trackNumber = timelineStore.tracks.length + 1;
    timelineStore.addTrack({
      type: 'video',
      name: `Track ${trackNumber}`,
      height: 80,
      locked: false,
      hidden: false,
      muted: false,
      order: timelineStore.tracks.length,
    });
  }, [timelineStore]);

  // Handle dropping media asset onto timeline track
  const handleAssetDrop = useCallback((asset: MediaAsset, trackId: string, startFrame: number) => {
    console.log('Asset dropped:', { asset, trackId, startFrame });

    // Convert duration from seconds to frames
    const durationInFrames = asset.duration ? Math.floor(asset.duration * fps) : fps * 5; // Default 5 seconds for images

    // Create a new clip from the media asset
    const newClip: Clip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      trackId,
      assetId: asset.id,
      startTime: startFrame,
      duration: durationInFrames,
      inPoint: 0,
      outPoint: durationInFrames,
      layer: 0,
      opacity: 1,
      scale: { x: 1, y: 1 },
      position: { x: 0, y: 0 },
      rotation: 0,
    };

    console.log('Creating clip:', newClip);

    // Add the clip to the timeline
    timelineStore.addClip(newClip);

    console.log('Clip added to timeline');
  }, [timelineStore, fps]);

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Editor Header */}
      <div className="w-full bg-zinc-900 border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Project Editor</h2>
            <p className="text-sm text-zinc-500">Project ID: {projectId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
              Save
            </button>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area - Top Section */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Media Library Widget - Left Side */}
        <div className="w-80 flex-shrink-0">
          <MediaLibraryWidget />
        </div>

        {/* Preview Area and Properties - Right Side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 flex flex-col bg-zinc-950 p-6">
            <div className="flex-1 flex items-center justify-center bg-black rounded-lg border border-zinc-800">
              <div className="text-center text-zinc-600">
                <Play className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg">Preview Area</p>
                <p className="text-sm mt-2">Timeline clips will appear here</p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <button className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                <SkipBack className="w-5 h-5 text-zinc-300" />
              </button>
              <button className="p-4 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
                <Play className="w-6 h-6 text-white" />
              </button>
              <button className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                <SkipForward className="w-5 h-5 text-zinc-300" />
              </button>
            </div>
          </div>

          {/* Properties Panel */}
          <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">Properties</h3>
            <div className="space-y-4">
              <div className="p-4 bg-zinc-800 rounded-lg text-center text-zinc-500">
                <p className="text-sm">Select a clip to edit properties</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Area - Bottom Section (Full Width) */}
      <div className="h-64 w-full bg-zinc-900 border-t border-zinc-800">
        <Timeline
          tracks={tracks}
          clips={clips}
          selectedClipIds={selectedClipIds}
          playhead={playhead}
          zoom={zoom}
          duration={duration}
          fps={fps}
          onPlayheadChange={timelineStore.setPlayhead}
          onZoomChange={timelineStore.setZoom}
          onClipSelect={timelineStore.selectClip}
          onClipMove={timelineStore.moveClip}
          onTrackUpdate={timelineStore.updateTrack}
          onAddTrack={handleAddTrack}
          onAssetDrop={handleAssetDrop}
        />
      </div>
    </div>
  );
}
