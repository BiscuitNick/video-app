import type { Clip, Track } from '@/types';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

export type TimebaseFPS = 24 | 30 | 60;

export interface ActiveClip {
  clip: Clip;
  track: Track;
  localFrame: number; // Frame position within the clip
}

export interface PlaybackEngineConfig {
  timebase_fps: TimebaseFPS;
  onFrameUpdate?: (frame: number, time: number) => void;
  onClipChange?: (activeClips: ActiveClip[]) => void;
}

/**
 * PlaybackEngine handles frame-accurate playback for video editing
 * Manages frame/time conversions, clip scheduling, and playback state
 */
export class PlaybackEngine {
  private currentFrame: number = 0;
  private timebase_fps: TimebaseFPS;
  private playbackRate: number = 1.0;
  private isPlaying: boolean = false;
  private animationFrameId: number | null = null;
  private lastTickTime: number = 0;
  private frameAccumulator: number = 0;

  private tracks: Track[] = [];
  private activeClips: ActiveClip[] = [];

  private onFrameUpdate?: (frame: number, time: number) => void;
  private onClipChange?: (activeClips: ActiveClip[]) => void;

  constructor(config: PlaybackEngineConfig) {
    this.timebase_fps = config.timebase_fps;
    this.onFrameUpdate = config.onFrameUpdate;
    this.onClipChange = config.onClipChange;
  }

  /**
   * Convert time (in seconds) to frame number
   */
  timeToFrame(time: number): number {
    return Math.floor(time * this.timebase_fps);
  }

  /**
   * Convert frame number to time (in seconds)
   */
  frameToTime(frame: number): number {
    return frame / this.timebase_fps;
  }

  /**
   * Get current frame with sub-frame precision for smooth interpolation
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Get current frame with sub-frame interpolation
   */
  getCurrentFrameInterpolated(): number {
    if (!this.isPlaying) {
      return this.currentFrame;
    }
    return this.currentFrame + this.frameAccumulator;
  }

  /**
   * Get current playback time in seconds
   */
  getCurrentTime(): number {
    return this.frameToTime(this.currentFrame);
  }

  /**
   * Set the timeline tracks for clip scheduling
   */
  setTracks(tracks: Track[]): void {
    this.tracks = tracks;
    this.updateActiveClips();
  }

  /**
   * Update the list of active clips at the current frame
   */
  private updateActiveClips(): void {
    const currentTime = this.getCurrentTime();
    const newActiveClips: ActiveClip[] = [];

    for (const track of this.tracks) {
      if (!track.visible || track.type !== 'video') continue;

      for (const clip of track.clips) {
        // Check if clip is active at current time
        if (currentTime >= clip.startTime && currentTime < clip.endTime) {
          // Calculate local frame within the clip
          const clipOffset = currentTime - clip.startTime;
          const localTime = clip.trimStart + clipOffset;
          const localFrame = this.timeToFrame(localTime);

          newActiveClips.push({
            clip,
            track,
            localFrame,
          });
        }
      }
    }

    // Sort by track order (z-index)
    newActiveClips.sort((a, b) => {
      const indexA = this.tracks.findIndex((t) => t.id === a.track.id);
      const indexB = this.tracks.findIndex((t) => t.id === b.track.id);
      return indexA - indexB;
    });

    // Only notify if clips have changed
    if (this.hasActiveClipsChanged(newActiveClips)) {
      this.activeClips = newActiveClips;
      this.onClipChange?.(newActiveClips);
    }
  }

  /**
   * Check if active clips have changed
   */
  private hasActiveClipsChanged(newClips: ActiveClip[]): boolean {
    if (newClips.length !== this.activeClips.length) return true;

    return newClips.some((newClip, index) => {
      const oldClip = this.activeClips[index];
      return newClip.clip.id !== oldClip.clip.id;
    });
  }

  /**
   * Get currently active clips
   */
  getActiveClips(): ActiveClip[] {
    return this.activeClips;
  }

  /**
   * Start playback
   */
  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastTickTime = performance.now();
    this.frameAccumulator = 0;
    this.tick();

    // Update store
    usePlaybackStore.getState().setPlaying(true);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Update store
    usePlaybackStore.getState().setPlaying(false);
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause();
    this.seek(0);
  }

  /**
   * Seek to a specific time (in seconds)
   */
  seek(time: number): void {
    const frame = this.timeToFrame(time);
    this.currentFrame = frame;
    this.frameAccumulator = 0;
    this.updateActiveClips();

    // Update store
    usePlaybackStore.getState().setCurrentTime(time);
    this.onFrameUpdate?.(frame, time);
  }

  /**
   * Seek to a specific frame
   */
  seekToFrame(frame: number): void {
    this.currentFrame = frame;
    this.frameAccumulator = 0;
    this.updateActiveClips();

    const time = this.frameToTime(frame);
    usePlaybackStore.getState().setCurrentTime(time);
    this.onFrameUpdate?.(frame, time);
  }

  /**
   * Set playback rate (0.25x to 2.0x)
   */
  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(2.0, rate));
    usePlaybackStore.getState().setPlaybackRate(this.playbackRate);
  }

  /**
   * Set timebase FPS
   */
  setTimebaseFPS(fps: TimebaseFPS): void {
    const currentTime = this.getCurrentTime();
    this.timebase_fps = fps;
    this.currentFrame = this.timeToFrame(currentTime);
    this.updateActiveClips();
  }

  /**
   * Main playback tick using requestAnimationFrame
   */
  private tick = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTickTime) / 1000; // Convert to seconds
    this.lastTickTime = now;

    // Calculate how many frames should have elapsed
    const framesDelta = deltaTime * this.timebase_fps * this.playbackRate;
    this.frameAccumulator += framesDelta;

    // Advance whole frames
    while (this.frameAccumulator >= 1.0) {
      this.currentFrame++;
      this.frameAccumulator -= 1.0;
      this.updateActiveClips();
    }

    const currentTime = this.getCurrentTime();

    // Update store and notify
    usePlaybackStore.getState().setCurrentTime(currentTime);
    this.onFrameUpdate?.(this.getCurrentFrameInterpolated(), currentTime);

    // Continue ticking
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Get playback state
   */
  getState() {
    return {
      currentFrame: this.currentFrame,
      currentTime: this.getCurrentTime(),
      timebase_fps: this.timebase_fps,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
      activeClips: this.activeClips,
    };
  }

  /**
   * Cleanup and destroy the engine
   */
  destroy(): void {
    this.pause();
    this.tracks = [];
    this.activeClips = [];
  }
}
