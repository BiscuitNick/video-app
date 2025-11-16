import type { AudioTrack } from '@/components/playback/types';

interface AudioSourceNode {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  track: AudioTrack;
  startedAt: number;
  pausedAt: number;
}

/**
 * AudioSyncManager handles Web Audio API integration for frame-accurate audio playback
 * Manages audio buffer scheduling, crossfading, and synchronization with video
 */
export class AudioSyncManager {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private activeAudioSources: Map<string, AudioSourceNode> = new Map();
  private audioTracks: AudioTrack[] = [];

  private isPlaying: boolean = false;
  private currentTime: number = 0;
  private playbackRate: number = 1.0;
  private masterVolume: number = 1.0;

  // Shared clock reference for audio/video sync
  private sharedClockStartTime: number = 0;
  private pausedTime: number = 0;

  constructor() {
    // Create audio context (Safari needs webkit prefix)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create master gain node for overall volume control
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.masterGainNode.gain.value = this.masterVolume;
  }

  /**
   * Set audio tracks to be played
   */
  setAudioTracks(tracks: AudioTrack[]): void {
    this.audioTracks = tracks;
  }

  /**
   * Add an audio track
   */
  addAudioTrack(track: AudioTrack): void {
    this.audioTracks.push(track);
  }

  /**
   * Remove an audio track
   */
  removeAudioTrack(trackId: string): void {
    this.audioTracks = this.audioTracks.filter(track => track.id !== trackId);
    this.stopAudioSource(trackId);
  }

  /**
   * Start playback with shared clock
   */
  play(currentTime: number): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentTime = currentTime;
    this.sharedClockStartTime = this.audioContext.currentTime - currentTime;

    // Resume audio context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.scheduleAudioTracks(currentTime);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.pausedTime = this.getCurrentTime();

    // Stop all active audio sources
    this.activeAudioSources.forEach((sourceNode, trackId) => {
      this.stopAudioSource(trackId);
    });
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.pause();
    this.currentTime = 0;
    this.pausedTime = 0;
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.pause();
    }

    this.currentTime = time;
    this.pausedTime = time;

    if (wasPlaying) {
      this.play(time);
    }
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(2.0, rate));

    // Update all active sources
    this.activeAudioSources.forEach((sourceNode) => {
      sourceNode.source.playbackRate.value = this.playbackRate;
    });
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGainNode.gain.value = this.masterVolume;
  }

  /**
   * Get current time based on shared clock
   */
  getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pausedTime;
    }
    return this.audioContext.currentTime - this.sharedClockStartTime;
  }

  /**
   * Get audio context time (for precise synchronization)
   */
  getAudioContextTime(): number {
    return this.audioContext.currentTime;
  }

  /**
   * Schedule audio tracks for playback
   */
  private scheduleAudioTracks(startTime: number): void {
    for (const track of this.audioTracks) {
      // Check if track should be playing at this time
      if (startTime >= track.startTime && startTime < track.startTime + track.duration) {
        this.scheduleAudioTrack(track, startTime);
      }
    }
  }

  /**
   * Schedule a single audio track
   */
  private scheduleAudioTrack(track: AudioTrack, startTime: number): void {
    // Don't reschedule if already playing
    if (this.activeAudioSources.has(track.id)) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = track.buffer;
    source.playbackRate.value = this.playbackRate;

    // Create gain node for volume and crossfading
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = track.volume;

    // Connect: source -> gain -> master gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    // Calculate offset into the audio buffer
    const offset = Math.max(0, startTime - track.startTime);
    const duration = track.duration - offset;

    // Apply crossfade at the start if needed
    if (track.crossfadeDuration && offset === 0) {
      this.applyCrossfade(gainNode, track.crossfadeDuration, 'in');
    }

    // Apply crossfade at the end if needed
    if (track.crossfadeDuration) {
      const fadeOutStart = this.audioContext.currentTime + duration - track.crossfadeDuration;
      if (fadeOutStart > this.audioContext.currentTime) {
        this.applyCrossfade(gainNode, track.crossfadeDuration, 'out', fadeOutStart);
      }
    }

    // Schedule the source to start
    const when = this.audioContext.currentTime;
    source.start(when, offset, duration);

    // Store reference
    this.activeAudioSources.set(track.id, {
      source,
      gainNode,
      track,
      startedAt: this.audioContext.currentTime,
      pausedAt: 0,
    });

    // Clean up when finished
    source.onended = () => {
      this.activeAudioSources.delete(track.id);
    };
  }

  /**
   * Stop a specific audio source
   */
  private stopAudioSource(trackId: string): void {
    const sourceNode = this.activeAudioSources.get(trackId);
    if (!sourceNode) return;

    try {
      sourceNode.source.stop();
    } catch (error) {
      // Source might already be stopped
    }

    this.activeAudioSources.delete(trackId);
  }

  /**
   * Apply crossfade to gain node
   */
  private applyCrossfade(
    gainNode: GainNode,
    duration: number,
    direction: 'in' | 'out',
    startTime?: number
  ): void {
    const when = startTime ?? this.audioContext.currentTime;

    if (direction === 'in') {
      gainNode.gain.setValueAtTime(0, when);
      gainNode.gain.linearRampToValueAtTime(1, when + duration);
    } else {
      gainNode.gain.setValueAtTime(1, when);
      gainNode.gain.linearRampToValueAtTime(0, when + duration);
    }
  }

  /**
   * Load audio buffer from URL
   */
  async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Create an audio track from a buffer
   */
  createAudioTrack(
    id: string,
    buffer: AudioBuffer,
    startTime: number,
    options: {
      volume?: number;
      crossfadeDuration?: number;
    } = {}
  ): AudioTrack {
    return {
      id,
      buffer,
      startTime,
      duration: buffer.duration,
      volume: options.volume ?? 1.0,
      crossfadeDuration: options.crossfadeDuration ?? 0.1,
    };
  }

  /**
   * Get audio context state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      playbackRate: this.playbackRate,
      masterVolume: this.masterVolume,
      audioContextState: this.audioContext.state,
      activeSourcesCount: this.activeAudioSources.size,
    };
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    this.pause();

    // Close audio context
    if (this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }

    this.activeAudioSources.clear();
    this.audioTracks = [];
  }
}
