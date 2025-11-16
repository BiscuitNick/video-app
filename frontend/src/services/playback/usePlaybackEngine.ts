import { useEffect, useRef, useState, useCallback } from 'react';
import { PlaybackEngine, VideoElementManager, TransformController } from './index';
import type { TimebaseFPS, ActiveClip } from './PlaybackEngine';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useMediaLibraryStore } from '@/stores/useMediaLibraryStore';

export interface UsePlaybackEngineOptions {
  timebase_fps?: TimebaseFPS;
  videoElementRef?: React.RefObject<HTMLVideoElement>;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export interface PlaybackEngineState {
  currentFrame: number;
  activeClips: ActiveClip[];
  isBuffering: boolean;
  error: string | null;
}

/**
 * React hook for integrating PlaybackEngine, VideoElementManager, and TransformController
 */
export function usePlaybackEngine(options: UsePlaybackEngineOptions = {}) {
  const { timebase_fps = 30, videoElementRef, containerRef } = options;

  // Zustand stores
  const { playing, currentTime, playbackRate, volume, muted } = usePlaybackStore();
  const { tracks } = useTimelineStore();
  const { assets } = useMediaLibraryStore();

  // Service instances
  const playbackEngineRef = useRef<PlaybackEngine | null>(null);
  const videoManagerRef = useRef<VideoElementManager | null>(null);
  const transformControllerRef = useRef<TransformController | null>(null);

  // State
  const [engineState, setEngineState] = useState<PlaybackEngineState>({
    currentFrame: 0,
    activeClips: [],
    isBuffering: false,
    error: null,
  });

  // Initialize services
  useEffect(() => {
    // Create PlaybackEngine
    playbackEngineRef.current = new PlaybackEngine({
      timebase_fps,
      onFrameUpdate: (frame) => {
        setEngineState(prev => ({ ...prev, currentFrame: frame }));
      },
      onClipChange: (activeClips) => {
        setEngineState(prev => ({ ...prev, activeClips }));
      },
    });

    // Create VideoElementManager
    videoManagerRef.current = new VideoElementManager({
      poolSize: 3,
      preloadDistance: 2.0,
      onError: (error, clipId) => {
        console.error(`Video error for clip ${clipId}:`, error);
        setEngineState(prev => ({ ...prev, error: error.message }));
      },
      onBuffering: (isBuffering) => {
        setEngineState(prev => ({ ...prev, isBuffering }));
      },
    });

    // Create TransformController
    transformControllerRef.current = new TransformController();

    // Cleanup
    return () => {
      playbackEngineRef.current?.destroy();
      videoManagerRef.current?.destroy();
      transformControllerRef.current?.destroy();
    };
  }, [timebase_fps]);

  // Sync tracks with playback engine
  useEffect(() => {
    if (playbackEngineRef.current) {
      playbackEngineRef.current.setTracks(tracks);
    }
  }, [tracks]);

  // Sync media assets with video manager
  useEffect(() => {
    if (videoManagerRef.current) {
      videoManagerRef.current.setMediaAssets(assets);
    }
  }, [assets]);

  // Sync playback state
  useEffect(() => {
    const engine = playbackEngineRef.current;
    if (!engine) return;

    if (playing) {
      engine.play();
    } else {
      engine.pause();
    }
  }, [playing]);

  // Sync playback rate
  useEffect(() => {
    if (playbackEngineRef.current) {
      playbackEngineRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // Sync volume and mute
  useEffect(() => {
    if (videoManagerRef.current) {
      videoManagerRef.current.setVolume(volume);
      videoManagerRef.current.setMuted(muted);
    }
  }, [volume, muted]);

  // Handle active clip changes and video switching
  useEffect(() => {
    const videoManager = videoManagerRef.current;
    const transformController = transformControllerRef.current;

    if (!videoManager || !transformController) return;

    const activeClip = engineState.activeClips[0]; // Primary active clip

    // Update video source
    videoManager.updateActiveClip(activeClip || null, currentTime);

    // Apply transforms
    if (activeClip && containerRef?.current) {
      const videoElement = videoElementRef?.current || videoManager.getActiveVideoElement();
      transformController.applyTransform(videoElement, activeClip.clip, engineState.currentFrame);
    }

    // Preload upcoming clips
    const allClips = tracks.flatMap(track => track.clips);
    videoManager.preloadUpcomingClips(allClips, currentTime);

  }, [engineState.activeClips, engineState.currentFrame, currentTime, tracks, containerRef, videoElementRef]);

  // Seek handler
  const seek = useCallback((time: number) => {
    playbackEngineRef.current?.seek(time);
  }, []);

  // Seek to frame handler
  const seekToFrame = useCallback((frame: number) => {
    playbackEngineRef.current?.seekToFrame(frame);
  }, []);

  // Get video element
  const getVideoElement = useCallback(() => {
    return videoManagerRef.current?.getActiveVideoElement() || null;
  }, []);

  // Set keyframes for a clip
  const setClipKeyframes = useCallback((clipId: string, keyframes: any[]) => {
    transformControllerRef.current?.setKeyframes(clipId, keyframes);
  }, []);

  return {
    // State
    ...engineState,

    // Services (for advanced use)
    playbackEngine: playbackEngineRef.current,
    videoManager: videoManagerRef.current,
    transformController: transformControllerRef.current,

    // Methods
    seek,
    seekToFrame,
    getVideoElement,
    setClipKeyframes,
  };
}
