/**
 * Thumbnail Cache System - Main Entry Point
 *
 * Exports all components of the thumbnail cache system and provides
 * a unified interface for thumbnail caching, loading, and management.
 */

// Export types
export * from './types';
export * from './constants';

// Export services
export { ThumbnailDBService, getThumbnailDBService } from './ThumbnailDBService';
export { LRUCacheManager, getLRUCacheManager } from './LRUCacheManager';
export {
  ThumbnailLoaderService,
  getThumbnailLoaderService,
} from './ThumbnailLoaderService';
export {
  ThumbnailWorkerService,
  getThumbnailWorkerService,
} from './ThumbnailWorkerService';
export {
  RetryManager,
  getRetryManager,
  FallbackPlaceholderGenerator,
} from './RetryManager';

// Import services for unified interface
import { getThumbnailDBService } from './ThumbnailDBService';
import { getLRUCacheManager } from './LRUCacheManager';
import { getThumbnailLoaderService } from './ThumbnailLoaderService';
import { getThumbnailWorkerService } from './ThumbnailWorkerService';
import { getRetryManager } from './RetryManager';
import {
  ThumbnailQuality,
  LoadOptions,
  CacheWarmingOptions,
  CacheStats,
} from './types';
import { DEFAULT_CACHE_WARMING_CONCURRENCY } from './constants';

/**
 * Unified Thumbnail Cache Interface
 *
 * Provides a high-level API for all thumbnail cache operations.
 */
export class ThumbnailCacheSystem {
  private dbService = getThumbnailDBService();
  private cacheManager = getLRUCacheManager();
  private loaderService = getThumbnailLoaderService();
  private workerService = getThumbnailWorkerService();
  private retryManager = getRetryManager();

  /**
   * Load a thumbnail for an HTML element
   */
  observeElement(
    element: HTMLElement,
    videoId: string,
    videoUrl: string,
    timestamp: number,
    displayWidth: number,
    displayHeight: number,
    callback: (dataUrl: string | null) => void,
    options?: LoadOptions
  ): () => void {
    // Select optimal quality
    const quality =
      options?.quality ||
      this.retryManager.selectQuality(displayWidth, displayHeight, options);

    // Create load request
    const request = {
      id: `${videoId}_${timestamp}`,
      videoUrl,
      timestamp,
      quality,
      priority: options?.priority || 500,
      displayWidth,
      displayHeight,
    };

    // Observe element for lazy loading
    return this.loaderService.observe(
      element,
      request,
      async (blob, loadedQuality) => {
        if (blob) {
          const dataUrl = await this.blobToDataUrl(blob);
          callback(dataUrl);
        } else {
          // Generate thumbnail using worker
          this.generateAndCache(
            videoUrl,
            timestamp,
            loadedQuality,
            request.id,
            callback
          );
        }
      },
      (error) => {
        console.error('Failed to load thumbnail:', error);
        callback(null);
      }
    );
  }

  /**
   * Load a thumbnail immediately (no lazy loading)
   */
  async loadThumbnail(
    videoUrl: string,
    timestamp: number,
    quality: ThumbnailQuality,
    videoId?: string
  ): Promise<string | null> {
    const cacheKey = videoId
      ? `${videoId}_${timestamp}_${quality}`
      : `${timestamp}_${quality}`;

    // Try cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return await this.blobToDataUrl(cached);
    }

    // Generate using worker
    return new Promise((resolve) => {
      this.generateAndCache(videoUrl, timestamp, quality, cacheKey, (dataUrl) => {
        resolve(dataUrl);
      });
    });
  }

  /**
   * Generate thumbnail and cache it
   */
  private async generateAndCache(
    videoUrl: string,
    timestamp: number,
    quality: ThumbnailQuality,
    cacheKey: string,
    callback: (dataUrl: string | null) => void
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Generate thumbnail with retry logic
      const blob = await this.retryManager.executeWithRetry(cacheKey, async () => {
        return await this.workerService.generateThumbnail(
          videoUrl,
          timestamp,
          quality,
          cacheKey
        );
      });

      // Update bandwidth metrics
      const duration = Date.now() - startTime;
      this.retryManager.updateBandwidth(blob.size, duration);

      // Convert to data URL
      const dataUrl = await this.blobToDataUrl(blob);
      callback(dataUrl);
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      callback(null);
    }
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Warm the cache with thumbnails for specific videos
   */
  async warmCache(options: CacheWarmingOptions): Promise<void> {
    const { videoIds, quality, concurrency, onProgress } = options;
    const totalItems = videoIds.length;
    let completed = 0;

    // Process in batches
    const batchSize = concurrency || DEFAULT_CACHE_WARMING_CONCURRENCY;
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (videoId) => {
          try {
            // Generate thumbnail at timestamp 0 (first frame)
            await this.workerService.generateThumbnail(
              `/api/videos/${videoId}/stream`, // Adjust URL as needed
              0,
              quality,
              `${videoId}_0_${quality}`
            );
          } catch (error) {
            console.error(`Failed to warm cache for ${videoId}:`, error);
          } finally {
            completed++;
            onProgress?.(completed, totalItems);
          }
        })
      );
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    return await this.cacheManager.getDetailedStats();
  }

  /**
   * Clear the entire cache
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * Set maximum cache size
   */
  async setMaxCacheSize(sizeBytes: number): Promise<void> {
    await this.cacheManager.setMaxSize(sizeBytes);
  }

  /**
   * Get current cache size
   */
  getCurrentCacheSize(): number {
    return this.cacheManager.getCurrentSize();
  }

  /**
   * Prefetch thumbnails for a list of video IDs
   */
  async prefetchThumbnails(
    videos: Array<{ id: string; url: string; timestamp: number }>,
    quality: ThumbnailQuality
  ): Promise<void> {
    const promises = videos.map(({ id, url, timestamp }) =>
      this.loadThumbnail(url, timestamp, quality, id)
    );

    await Promise.all(promises);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.loaderService.destroy();
    this.workerService.destroy();
    this.cacheManager.destroy();
    this.dbService.close();
  }
}

// Singleton instance
let thumbnailCacheSystemInstance: ThumbnailCacheSystem | null = null;

export function getThumbnailCacheSystem(): ThumbnailCacheSystem {
  if (!thumbnailCacheSystemInstance) {
    thumbnailCacheSystemInstance = new ThumbnailCacheSystem();
  }
  return thumbnailCacheSystemInstance;
}

// Export singleton getter as default
export default getThumbnailCacheSystem;
