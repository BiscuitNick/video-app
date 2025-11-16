import type { Clip, MediaAsset } from '@/types';
import type { ActiveClip } from './PlaybackEngine';

export interface VideoState {
  src: string;
  currentTime: number;
  ready: boolean;
  error: Error | null;
}

export interface PreloadedVideo {
  clipId: string;
  mediaAssetId: string;
  videoElement: HTMLVideoElement;
  blobUrl: string | null;
  ready: boolean;
  error: Error | null;
}

export interface VideoElementManagerConfig {
  poolSize?: number; // Number of video elements to keep in pool
  preloadDistance?: number; // Time in seconds to look ahead for preloading
  onError?: (error: Error, clipId: string) => void;
  onBuffering?: (isBuffering: boolean) => void;
}

/**
 * VideoElementManager handles video element lifecycle, preloading, and source switching
 * Manages a pool of video elements for smooth clip transitions
 */
export class VideoElementManager {
  private activeVideoElement: HTMLVideoElement | null = null;
  private videoPool: PreloadedVideo[] = [];
  private poolSize: number;
  private preloadDistance: number;
  private mediaAssets: Map<string, MediaAsset> = new Map();

  private onError?: (error: Error, clipId: string) => void;
  private onBuffering?: (isBuffering: boolean) => void;

  private isBuffering: boolean = false;
  private currentClipId: string | null = null;

  constructor(config: VideoElementManagerConfig = {}) {
    this.poolSize = config.poolSize ?? 3;
    this.preloadDistance = config.preloadDistance ?? 2.0; // 2 seconds lookahead
    this.onError = config.onError;
    this.onBuffering = config.onBuffering;
  }

  /**
   * Set media assets library for resolving URLs
   */
  setMediaAssets(assets: MediaAsset[]): void {
    this.mediaAssets.clear();
    assets.forEach(asset => {
      this.mediaAssets.set(asset.id, asset);
    });
  }

  /**
   * Get or create the active video element
   */
  getActiveVideoElement(): HTMLVideoElement {
    if (!this.activeVideoElement) {
      this.activeVideoElement = this.createVideoElement();
    }
    return this.activeVideoElement;
  }

  /**
   * Create a new video element with optimal settings
   */
  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false; // Audio will be controlled separately

    // Performance optimizations
    video.style.transform = 'translateZ(0)'; // Enable GPU acceleration
    video.style.willChange = 'transform, opacity';

    // Event listeners for monitoring
    video.addEventListener('waiting', this.handleWaiting);
    video.addEventListener('canplay', this.handleCanPlay);
    video.addEventListener('error', this.handleError);

    return video;
  }

  /**
   * Update active clip and handle source switching
   */
  async updateActiveClip(activeClip: ActiveClip | null, currentTime: number): Promise<void> {
    if (!activeClip) {
      // No active clip - pause and clear
      this.activeVideoElement?.pause();
      this.currentClipId = null;
      return;
    }

    const { clip } = activeClip;

    // Check if we need to switch sources
    if (clip.id !== this.currentClipId) {
      await this.switchToClip(clip, currentTime);
      this.currentClipId = clip.id;
    } else {
      // Same clip, just sync time
      await this.syncVideoTime(clip, currentTime);
    }
  }

  /**
   * Switch to a new clip
   */
  private async switchToClip(clip: Clip, playbackTime: number): Promise<void> {
    const mediaAsset = this.mediaAssets.get(clip.mediaAssetId);
    if (!mediaAsset) {
      this.handleError(new Error(`Media asset not found: ${clip.mediaAssetId}`), clip.id);
      return;
    }

    // Check if video is already preloaded in pool
    const preloaded = this.videoPool.find(v => v.clipId === clip.id && v.ready);

    if (preloaded) {
      // Swap in the preloaded video
      await this.swapVideoElement(preloaded.videoElement, clip, playbackTime);
    } else {
      // Load video on the active element
      await this.loadVideo(this.getActiveVideoElement(), mediaAsset.url, clip, playbackTime);
    }
  }

  /**
   * Load video source into a video element
   */
  private async loadVideo(
    videoElement: HTMLVideoElement,
    url: string,
    clip: Clip,
    playbackTime: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 10000); // 10 second timeout

      const handleCanPlay = () => {
        clearTimeout(timeoutId);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);

        // Sync to correct time in clip
        this.syncVideoTime(clip, playbackTime).then(resolve);
      };

      const handleError = () => {
        clearTimeout(timeoutId);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);

        const error = new Error(`Failed to load video: ${url}`);
        this.handleError(error, clip.id);
        reject(error);
      };

      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);

      videoElement.src = url;
      videoElement.load();
    });
  }

  /**
   * Swap the active video element with a preloaded one
   */
  private async swapVideoElement(
    newElement: HTMLVideoElement,
    clip: Clip,
    playbackTime: number
  ): Promise<void> {
    const oldElement = this.activeVideoElement;
    this.activeVideoElement = newElement;

    await this.syncVideoTime(clip, playbackTime);

    // Return old element to pool or cleanup
    if (oldElement) {
      oldElement.pause();
      this.returnToPool(oldElement);
    }
  }

  /**
   * Sync video element time to match playback time
   */
  private async syncVideoTime(clip: Clip, playbackTime: number): Promise<void> {
    const video = this.getActiveVideoElement();

    // Calculate local time within the video source
    const clipOffset = playbackTime - clip.startTime;
    const videoTime = clip.trimStart + clipOffset;

    // Only seek if difference is significant (>1 frame at 60fps ≈ 0.016s)
    if (Math.abs(video.currentTime - videoTime) > 0.016) {
      video.currentTime = videoTime;

      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const handleSeeked = () => {
          video.removeEventListener('seeked', handleSeeked);
          resolve();
        };
        video.addEventListener('seeked', handleSeeked);

        // Fallback timeout
        setTimeout(resolve, 100);
      });
    }
  }

  /**
   * Preload upcoming clips based on current time and active clips
   */
  async preloadUpcomingClips(
    allClips: Clip[],
    currentTime: number
  ): Promise<void> {
    const upcomingClips = allClips.filter(clip => {
      const timeUntilClip = clip.startTime - currentTime;
      return timeUntilClip > 0 && timeUntilClip <= this.preloadDistance;
    });

    // Sort by start time
    upcomingClips.sort((a, b) => a.startTime - b.startTime);

    // Preload up to pool size
    const clipsToPreload = upcomingClips.slice(0, this.poolSize);

    for (const clip of clipsToPreload) {
      if (!this.videoPool.find(v => v.clipId === clip.id)) {
        await this.preloadClip(clip);
      }
    }

    // Clean up old preloaded videos
    this.cleanupPool(clipsToPreload.map(c => c.id));
  }

  /**
   * Preload a single clip into the pool
   */
  private async preloadClip(clip: Clip): Promise<void> {
    const mediaAsset = this.mediaAssets.get(clip.mediaAssetId);
    if (!mediaAsset) return;

    // Check if pool is full
    if (this.videoPool.length >= this.poolSize) {
      // Remove oldest
      const oldest = this.videoPool.shift();
      if (oldest) {
        this.cleanupVideoElement(oldest.videoElement);
        if (oldest.blobUrl) {
          URL.revokeObjectURL(oldest.blobUrl);
        }
      }
    }

    const videoElement = this.createVideoElement();
    const preloaded: PreloadedVideo = {
      clipId: clip.id,
      mediaAssetId: clip.mediaAssetId,
      videoElement,
      blobUrl: null,
      ready: false,
      error: null,
    };

    this.videoPool.push(preloaded);

    try {
      // Option 1: Direct URL preloading
      await this.loadVideo(videoElement, mediaAsset.url, clip, clip.trimStart);
      preloaded.ready = true;

      // Option 2: Blob URL preloading (commented - can be enabled for better caching)
      // const blobUrl = await this.createBlobUrl(mediaAsset.url);
      // preloaded.blobUrl = blobUrl;
      // await this.loadVideo(videoElement, blobUrl, clip, clip.trimStart);
      // preloaded.ready = true;

    } catch (error) {
      preloaded.error = error as Error;
      this.onError?.(error as Error, clip.id);
    }
  }

  /**
   * Create a blob URL for a video (for better caching and offline support)
   * Currently unused but available for future optimization
   */
  // private async createBlobUrl(url: string): Promise<string> {
  //   const response = await fetch(url);
  //   const blob = await response.blob();
  //   return URL.createObjectURL(blob);
  // }

  /**
   * Clean up pool, keeping only specified clip IDs
   */
  private cleanupPool(keepClipIds: string[]): void {
    this.videoPool = this.videoPool.filter(preloaded => {
      const shouldKeep = keepClipIds.includes(preloaded.clipId);
      if (!shouldKeep) {
        this.cleanupVideoElement(preloaded.videoElement);
        if (preloaded.blobUrl) {
          URL.revokeObjectURL(preloaded.blobUrl);
        }
      }
      return shouldKeep;
    });
  }

  /**
   * Return video element to pool
   */
  private returnToPool(videoElement: HTMLVideoElement): void {
    // For now, just cleanup - could be enhanced to reuse elements
    this.cleanupVideoElement(videoElement);
  }

  /**
   * Clean up a video element
   */
  private cleanupVideoElement(videoElement: HTMLVideoElement): void {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    videoElement.removeEventListener('waiting', this.handleWaiting);
    videoElement.removeEventListener('canplay', this.handleCanPlay);
    videoElement.removeEventListener('error', this.handleError);
  }

  /**
   * Handle video buffering
   */
  private handleWaiting = (): void => {
    if (!this.isBuffering) {
      this.isBuffering = true;
      this.onBuffering?.(true);
    }
  };

  /**
   * Handle video ready to play
   */
  private handleCanPlay = (): void => {
    if (this.isBuffering) {
      this.isBuffering = false;
      this.onBuffering?.(false);
    }
  };

  /**
   * Handle video errors
   */
  private handleError = (error: Event | Error, clipId?: string): void => {
    const err = error instanceof Error
      ? error
      : new Error('Video playback error');

    this.onError?.(err, clipId || this.currentClipId || 'unknown');
  };

  /**
   * Get buffering state
   */
  isCurrentlyBuffering(): boolean {
    return this.isBuffering;
  }

  /**
   * Get ready state of active video
   */
  getReadyState(): number {
    return this.activeVideoElement?.readyState ?? 0;
  }

  /**
   * Play the active video
   */
  async play(): Promise<void> {
    if (this.activeVideoElement) {
      try {
        await this.activeVideoElement.play();
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Pause the active video
   */
  pause(): void {
    this.activeVideoElement?.pause();
  }

  /**
   * Set volume for active video
   */
  setVolume(volume: number): void {
    if (this.activeVideoElement) {
      this.activeVideoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Set muted state for active video
   */
  setMuted(muted: boolean): void {
    if (this.activeVideoElement) {
      this.activeVideoElement.muted = muted;
    }
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy(): void {
    // Cleanup active element
    if (this.activeVideoElement) {
      this.cleanupVideoElement(this.activeVideoElement);
      this.activeVideoElement = null;
    }

    // Cleanup pool
    this.videoPool.forEach(preloaded => {
      this.cleanupVideoElement(preloaded.videoElement);
      if (preloaded.blobUrl) {
        URL.revokeObjectURL(preloaded.blobUrl);
      }
    });
    this.videoPool = [];

    this.mediaAssets.clear();
  }
}
