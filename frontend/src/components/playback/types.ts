// Types for playback components

export interface OverlayConfig {
  id: string;
  type: 'text' | 'image';
  content: string;
  position: {
    x: number; // 0-100 (percentage)
    y: number; // 0-100 (percentage)
  };
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    textShadow?: string;
    opacity?: number;
  };
  zIndex?: number;
  startTime: number;
  endTime: number;
}

export interface TransitionConfig {
  id: string;
  type: 'fade' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'dissolve';
  duration: number; // in seconds
  timingFunction?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  startTime: number;
}

export interface AudioTrack {
  id: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  volume: number;
  crossfadeDuration?: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  memoryUsage?: number;
}

export interface PlaybackControlsState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  currentFrame: number;
  totalFrames: number;
}
