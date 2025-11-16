/**
 * Thumbnail Cache System - Constants
 */

import { ThumbnailQuality, ThumbnailQualityConfig, RetryConfig } from './types';

// Cache Configuration
export const THUMBNAIL_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200MB
export const THUMBNAIL_CACHE_DB_NAME = 'ThumbnailCache';
export const THUMBNAIL_CACHE_DB_VERSION = 1;
export const THUMBNAIL_CACHE_STORE_NAME = 'thumbnails';

// Quality Configurations
export const QUALITY_CONFIGS: Record<ThumbnailQuality, ThumbnailQualityConfig> = {
  [ThumbnailQuality.LOW]: {
    quality: ThumbnailQuality.LOW,
    maxWidth: 320,
    maxHeight: 180,
    jpegQuality: 0.6,
  },
  [ThumbnailQuality.MEDIUM]: {
    quality: ThumbnailQuality.MEDIUM,
    maxWidth: 640,
    maxHeight: 360,
    jpegQuality: 0.75,
  },
  [ThumbnailQuality.HIGH]: {
    quality: ThumbnailQuality.HIGH,
    maxWidth: 1280,
    maxHeight: 720,
    jpegQuality: 0.9,
  },
};

// Lazy Loading Configuration
export const INTERSECTION_OBSERVER_OPTIONS = {
  root: null,
  rootMargin: '200px', // Load 200px before entering viewport
  threshold: 0.01,
};

export const SCROLL_DEBOUNCE_MS = 150;
export const PRIORITY_UPDATE_INTERVAL_MS = 500;

// Retry Configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Bandwidth Thresholds (bytes per second)
export const BANDWIDTH_THRESHOLDS = {
  SLOW: 500 * 1024, // 500 KB/s
  MEDIUM: 2 * 1024 * 1024, // 2 MB/s
  FAST: 5 * 1024 * 1024, // 5 MB/s
};

// Progressive Loading
export const PROGRESSIVE_LOAD_DELAY_MS = 100;
export const PLACEHOLDER_BLUR_RADIUS = 20;

// Cache Warming
export const DEFAULT_CACHE_WARMING_CONCURRENCY = 5;

// LRU Configuration
export const EVICTION_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
export const MIN_CACHE_SIZE_FOR_EVICTION = 0.9; // Evict when 90% full
