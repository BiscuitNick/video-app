/**
 * Waveform Visualization System - Type Definitions
 */

export interface WaveformData {
  /** Unique identifier for this waveform */
  id: string;
  /** Peak amplitude data (normalized -1 to 1) */
  peaks: Float32Array;
  /** RMS (Root Mean Square) values for smoother visualization */
  rms: Float32Array;
  /** Sample rate (samples per second) */
  sampleRate: number;
  /** Duration of the audio in seconds */
  duration: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels: number;
  /** Timestamp when waveform was generated */
  generatedAt: number;
}

export interface WaveformCacheEntry {
  id: string;
  data: WaveformData;
  sizeBytes: number;
  lastAccessedAt: number;
  audioUrl: string;
  assetId: string;
}

export interface WaveformGenerationOptions {
  /** Samples per pixel for waveform generation (default: 4) */
  samplesPerPixel?: number;
  /** Audio quality - affects detail level */
  quality?: WaveformQuality;
  /** Whether to normalize the waveform data */
  normalize?: boolean;
  /** Progress callback for long audio files */
  onProgress?: (progress: number) => void;
}

export enum WaveformQuality {
  LOW = 'low',       // 128 samples per pixel
  MEDIUM = 'medium', // 256 samples per pixel
  HIGH = 'high',     // 512 samples per pixel
}

export interface WaveformRenderOptions {
  /** Width of the canvas in pixels */
  width: number;
  /** Height of the canvas in pixels */
  height: number;
  /** Color scheme for waveform */
  colorScheme?: WaveformColorScheme;
  /** Show RMS overlay */
  showRMS?: boolean;
  /** Start time (in seconds) for rendering */
  startTime?: number;
  /** End time (in seconds) for rendering */
  endTime?: number;
  /** Current playhead position (in seconds) */
  playheadPosition?: number;
  /** Zoom level (1 = normal, 2 = 2x zoom, etc.) */
  zoom?: number;
  /** Trim start position (in seconds) */
  trimStart?: number;
  /** Trim end position (in seconds) */
  trimEnd?: number;
  /** Volume envelope (0 to 1) */
  volumeEnvelope?: number;
}

export interface WaveformColorScheme {
  /** Base waveform color (quiet regions) */
  quiet: string;
  /** Medium volume color */
  medium: string;
  /** Loud volume color */
  loud: string;
  /** Peak (clipping) color */
  peak: string;
  /** Background color */
  background: string;
  /** Trimmed region color */
  trimmed: string;
  /** Playhead color */
  playhead: string;
  /** RMS overlay color */
  rms?: string;
}

export interface WaveformWorkerMessage {
  type: 'generate' | 'response' | 'error' | 'progress';
  requestId: string;
  data?: WaveformWorkerMessageData;
  error?: string;
  progress?: number;
}

export interface WaveformWorkerMessageData {
  waveformData?: WaveformData;
  audioUrl?: string;
  options?: WaveformGenerationOptions;
  audioBuffer?: ArrayBuffer;
}

export interface WaveformStats {
  totalWaveforms: number;
  totalSizeBytes: number;
  cacheHitRate: number;
  averageGenerationTime: number;
}

export interface WaveformLoadOptions {
  /** Force regeneration even if cached */
  forceRegenerate?: boolean;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Priority (higher = loaded first) */
  priority?: number;
}
