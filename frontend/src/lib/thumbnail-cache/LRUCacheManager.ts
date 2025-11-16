/**
 * Subtask 20.2: LRU Cache Manager
 *
 * Manages thumbnail cache with LRU eviction policy, size tracking,
 * and automatic eviction when cache exceeds configured limits.
 */

import { ThumbnailDBService, getThumbnailDBService } from './ThumbnailDBService';
import { ThumbnailCacheEntry, CacheStats } from './types';
import {
  THUMBNAIL_CACHE_MAX_BYTES,
  EVICTION_CHECK_INTERVAL_MS,
  MIN_CACHE_SIZE_FOR_EVICTION,
} from './constants';

export class LRUCacheManager {
  private dbService: ThumbnailDBService;
  private maxSizeBytes: number;
  private currentSizeBytes = 0;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private evictionTimer: number | null = null;
  private statsListeners: Set<(stats: CacheStats) => void> = new Set();

  constructor(
    maxSizeBytes: number = THUMBNAIL_CACHE_MAX_BYTES,
    dbService?: ThumbnailDBService
  ) {
    this.maxSizeBytes = maxSizeBytes;
    this.dbService = dbService || getThumbnailDBService();
    this.initialize();
  }

  /**
   * Initialize the cache manager
   */
  private async initialize(): Promise<void> {
    // Calculate initial cache size
    await this.recalculateCacheSize();

    // Start periodic eviction checks
    this.startEvictionTimer();

    // Listen for database errors
    this.dbService.onError((error) => {
      console.error('Database error in LRU Cache Manager:', error);
    });
  }

  /**
   * Get a thumbnail from the cache
   */
  async get(id: string): Promise<Blob | null> {
    const entry = await this.dbService.get(id);

    if (entry) {
      this.hitCount++;
      this.notifyStatsListeners();
      return entry.blob;
    }

    this.missCount++;
    this.notifyStatsListeners();
    return null;
  }

  /**
   * Put a thumbnail into the cache
   */
  async put(entry: ThumbnailCacheEntry): Promise<void> {
    // Check if adding this entry would exceed the cache size
    const existingEntry = await this.dbService.get(entry.id);
    const existingSize = existingEntry ? existingEntry.sizeBytes : 0;
    const sizeIncrease = entry.sizeBytes - existingSize;

    // If we need more space, evict entries
    if (this.currentSizeBytes + sizeIncrease > this.maxSizeBytes) {
      await this.evictToMakeSpace(sizeIncrease);
    }

    // Update current size
    if (existingEntry) {
      this.currentSizeBytes -= existingEntry.sizeBytes;
    }
    this.currentSizeBytes += entry.sizeBytes;

    // Store the entry
    await this.dbService.put(entry);
    this.notifyStatsListeners();
  }

  /**
   * Delete a thumbnail from the cache
   */
  async delete(id: string): Promise<void> {
    const entry = await this.dbService.get(id);
    if (entry) {
      this.currentSizeBytes -= entry.sizeBytes;
      await this.dbService.delete(id);
      this.notifyStatsListeners();
    }
  }

  /**
   * Evict entries to make space for new entry
   */
  private async evictToMakeSpace(requiredSpace: number): Promise<void> {
    const targetSize = this.maxSizeBytes - requiredSpace;
    let freedSpace = 0;

    // Get entries sorted by last accessed time (oldest first)
    const metadata = await this.dbService.getAllMetadata();
    const sortedEntries = metadata.sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    );

    // Evict oldest entries until we have enough space
    for (const entry of sortedEntries) {
      if (this.currentSizeBytes - freedSpace <= targetSize) {
        break;
      }

      await this.dbService.delete(entry.id);
      freedSpace += entry.sizeBytes;
      this.evictionCount++;
    }

    this.currentSizeBytes -= freedSpace;
    console.log(
      `Evicted ${this.evictionCount} entries, freed ${freedSpace} bytes`
    );
    this.notifyStatsListeners();
  }

  /**
   * Check if eviction is needed and perform it
   */
  private async checkAndEvict(): Promise<void> {
    const threshold = this.maxSizeBytes * MIN_CACHE_SIZE_FOR_EVICTION;

    if (this.currentSizeBytes >= threshold) {
      // Evict until we're at 70% capacity
      const targetSize = this.maxSizeBytes * 0.7;
      const requiredSpace = this.currentSizeBytes - targetSize;
      await this.evictToMakeSpace(requiredSpace);
    }
  }

  /**
   * Start periodic eviction timer
   */
  private startEvictionTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.evictionTimer = window.setInterval(() => {
      this.checkAndEvict().catch(console.error);
    }, EVICTION_CHECK_INTERVAL_MS);
  }

  /**
   * Stop eviction timer
   */
  private stopEvictionTimer(): void {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  /**
   * Recalculate the current cache size
   */
  async recalculateCacheSize(): Promise<void> {
    const metadata = await this.dbService.getAllMetadata();
    this.currentSizeBytes = metadata.reduce(
      (sum, entry) => sum + entry.sizeBytes,
      0
    );
    this.notifyStatsListeners();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      totalSizeBytes: this.currentSizeBytes,
      itemCount: 0, // Will be updated by async call
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate,
    };
  }

  /**
   * Get detailed cache statistics (async)
   */
  async getDetailedStats(): Promise<
    CacheStats & {
      maxSizeBytes: number;
      usagePercent: number;
      averageEntrySize: number;
    }
  > {
    const metadata = await this.dbService.getAllMetadata();
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    const usagePercent = (this.currentSizeBytes / this.maxSizeBytes) * 100;
    const averageEntrySize =
      metadata.length > 0 ? this.currentSizeBytes / metadata.length : 0;

    return {
      totalSizeBytes: this.currentSizeBytes,
      itemCount: metadata.length,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate,
      maxSizeBytes: this.maxSizeBytes,
      usagePercent,
      averageEntrySize,
    };
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    await this.dbService.clear();
    this.currentSizeBytes = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.notifyStatsListeners();
  }

  /**
   * Reset cache statistics (but keep cached data)
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.notifyStatsListeners();
  }

  /**
   * Set maximum cache size
   */
  async setMaxSize(maxSizeBytes: number): Promise<void> {
    this.maxSizeBytes = maxSizeBytes;

    // If current size exceeds new max, evict
    if (this.currentSizeBytes > this.maxSizeBytes) {
      await this.checkAndEvict();
    }

    this.notifyStatsListeners();
  }

  /**
   * Get current cache size
   */
  getCurrentSize(): number {
    return this.currentSizeBytes;
  }

  /**
   * Get maximum cache size
   */
  getMaxSize(): number {
    return this.maxSizeBytes;
  }

  /**
   * Check if cache has space for an entry
   */
  hasSpaceFor(sizeBytes: number): boolean {
    return this.currentSizeBytes + sizeBytes <= this.maxSizeBytes;
  }

  /**
   * Get usage percentage
   */
  getUsagePercent(): number {
    return (this.currentSizeBytes / this.maxSizeBytes) * 100;
  }

  /**
   * Subscribe to stats updates
   */
  onStatsUpdate(listener: (stats: CacheStats) => void): () => void {
    this.statsListeners.add(listener);
    // Immediately notify with current stats
    listener(this.getStats());

    return () => {
      this.statsListeners.delete(listener);
    };
  }

  /**
   * Notify all stats listeners
   */
  private notifyStatsListeners(): void {
    const stats = this.getStats();
    this.statsListeners.forEach((listener) => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in stats listener:', error);
      }
    });
  }

  /**
   * Prefetch thumbnails (useful for cache warming)
   */
  async prefetch(entries: ThumbnailCacheEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.put(entry);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopEvictionTimer();
    this.statsListeners.clear();
  }
}

// Singleton instance
let cacheManagerInstance: LRUCacheManager | null = null;

export function getLRUCacheManager(): LRUCacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new LRUCacheManager();
  }
  return cacheManagerInstance;
}
