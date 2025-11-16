/**
 * Thumbnail Cache System - Type Definitions
 */

export interface ThumbnailCacheEntry {
  id: string;
  blob: Blob;
  sizeBytes: number;
  lastAccessedAt: number;
  quality: ThumbnailQuality;
  width: number;
  height: number;
}

export interface ThumbnailMetadata {
  id: string;
  sizeBytes: number;
  lastAccessedAt: number;
  quality: ThumbnailQuality;
  width: number;
  height: number;
}

export enum ThumbnailQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface ThumbnailQualityConfig {
  quality: ThumbnailQuality;
  maxWidth: number;
  maxHeight: number;
  jpegQuality: number;
}

export interface CacheStats {
  totalSizeBytes: number;
  itemCount: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
}

export interface LoadRequest {
  id: string;
  videoUrl: string;
  timestamp: number;
  quality: ThumbnailQuality;
  priority: number;
  displayWidth: number;
  displayHeight: number;
}

export interface WorkerMessage {
  type: 'generate' | 'response' | 'error';
  requestId: string;
  data?: WorkerMessageData;
  error?: string;
}

export interface WorkerMessageData {
  blob?: Blob;
  width?: number;
  height?: number;
  quality?: ThumbnailQuality;
  videoUrl?: string;
  timestamp?: number;
  targetQuality?: ThumbnailQuality;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface BandwidthMetrics {
  estimatedBandwidth: number; // bytes per second
  lastUpdated: number;
  sampleCount: number;
}

export interface LoadOptions {
  quality?: ThumbnailQuality;
  priority?: number;
  forceReload?: boolean;
  abortSignal?: AbortSignal;
}

export interface CacheWarmingOptions {
  videoIds: string[];
  quality: ThumbnailQuality;
  concurrency: number;
  onProgress?: (completed: number, total: number) => void;
}
