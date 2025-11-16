/**
 * Waveform Visualization System - Constants
 */

import { WaveformColorScheme, WaveformQuality } from './types';

// Database Configuration
export const WAVEFORM_DB_NAME = 'waveform-cache';
export const WAVEFORM_DB_VERSION = 1;
export const WAVEFORM_STORE_NAME = 'waveforms';

// Cache Configuration
export const MAX_WAVEFORM_CACHE_SIZE = 100 * 1024 * 1024; // 100 MB
export const WAVEFORM_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Quality Settings
export const QUALITY_CONFIG: Record<
  WaveformQuality,
  { samplesPerPixel: number; maxPoints: number }
> = {
  [WaveformQuality.LOW]: {
    samplesPerPixel: 128,
    maxPoints: 2000,
  },
  [WaveformQuality.MEDIUM]: {
    samplesPerPixel: 256,
    maxPoints: 4000,
  },
  [WaveformQuality.HIGH]: {
    samplesPerPixel: 512,
    maxPoints: 8000,
  },
};

// Color Schemes
export const DEFAULT_COLOR_SCHEME: WaveformColorScheme = {
  quiet: '#6b7280',      // Gray
  medium: '#10b981',     // Green
  loud: '#f59e0b',       // Orange
  peak: '#ef4444',       // Red
  background: 'transparent',
  trimmed: '#374151',    // Dark gray
  playhead: '#3b82f6',   // Blue
  rms: '#8b5cf6',        // Purple
};

export const DARK_COLOR_SCHEME: WaveformColorScheme = {
  quiet: '#4b5563',      // Dark gray
  medium: '#059669',     // Dark green
  loud: '#d97706',       // Dark orange
  peak: '#dc2626',       // Dark red
  background: '#1f2937',
  trimmed: '#111827',    // Very dark gray
  playhead: '#2563eb',   // Dark blue
  rms: '#7c3aed',        // Dark purple
};

export const LIGHT_COLOR_SCHEME: WaveformColorScheme = {
  quiet: '#9ca3af',      // Light gray
  medium: '#34d399',     // Light green
  loud: '#fbbf24',       // Light orange
  peak: '#f87171',       // Light red
  background: '#ffffff',
  trimmed: '#e5e7eb',    // Very light gray
  playhead: '#60a5fa',   // Light blue
  rms: '#a78bfa',        // Light purple
};

// Volume thresholds for color coding (normalized 0-1)
export const VOLUME_THRESHOLDS = {
  QUIET: 0.2,    // Below 20% = quiet (gray)
  MEDIUM: 0.5,   // 20-50% = medium (green)
  LOUD: 0.8,     // 50-80% = loud (orange)
  PEAK: 0.95,    // Above 95% = peak/clipping (red)
};

// Performance Settings
export const PROGRESSIVE_RENDER_CHUNK_SIZE = 1000; // Points per chunk
export const PROGRESSIVE_RENDER_DELAY = 16; // ~60fps
export const WORKER_TIMEOUT = 30000; // 30 seconds

// Rendering Settings
export const DEFAULT_WAVEFORM_HEIGHT = 60; // pixels
export const MIN_WAVEFORM_WIDTH = 50; // pixels
export const PLAYHEAD_WIDTH = 2; // pixels
export const TRIM_INDICATOR_WIDTH = 3; // pixels

// WebWorker Settings
export const MAX_CONCURRENT_GENERATIONS = 4;
export const WORKER_POOL_SIZE = 2;

// Default Options
export const DEFAULT_GENERATION_OPTIONS = {
  samplesPerPixel: QUALITY_CONFIG[WaveformQuality.MEDIUM].samplesPerPixel,
  quality: WaveformQuality.MEDIUM,
  normalize: true,
};

export const DEFAULT_RENDER_OPTIONS = {
  colorScheme: DEFAULT_COLOR_SCHEME,
  showRMS: false,
  zoom: 1,
  volumeEnvelope: 1,
};
