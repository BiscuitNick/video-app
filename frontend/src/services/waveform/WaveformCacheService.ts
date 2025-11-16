/**
 * Waveform Cache Service
 *
 * Manages persistent storage of waveform data using IndexedDB.
 * Implements LRU eviction and size limits.
 */

import type { WaveformData, WaveformCacheEntry, WaveformStats } from '@/lib/waveform/types';
import {
  WAVEFORM_DB_NAME,
  WAVEFORM_DB_VERSION,
  WAVEFORM_STORE_NAME,
  MAX_WAVEFORM_CACHE_SIZE,
  WAVEFORM_CACHE_TTL,
} from '@/lib/waveform/constants';

class WaveformCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private currentSize = 0;
  private maxSize = MAX_WAVEFORM_CACHE_SIZE;

  // Stats
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor() {
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(WAVEFORM_DB_NAME, WAVEFORM_DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open waveform cache database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.calculateCurrentSize();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(WAVEFORM_STORE_NAME)) {
          const store = db.createObjectStore(WAVEFORM_STORE_NAME, { keyPath: 'id' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('assetId', 'assetId', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Calculate current cache size
   */
  private async calculateCurrentSize(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readonly');
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entries = request.result as WaveformCacheEntry[];
        this.currentSize = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get waveform from cache
   */
  async get(id: string): Promise<WaveformData | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const entry = request.result as WaveformCacheEntry | undefined;

          if (!entry) {
            this.missCount++;
            resolve(null);
            return;
          }

          // Check if entry is expired
          const age = Date.now() - entry.data.generatedAt;
          if (age > WAVEFORM_CACHE_TTL) {
            // Remove expired entry
            store.delete(id);
            this.currentSize -= entry.sizeBytes;
            this.missCount++;
            resolve(null);
            return;
          }

          // Update last accessed time
          entry.lastAccessedAt = Date.now();
          store.put(entry);

          this.hitCount++;
          resolve(entry.data);
        };

        request.onerror = () => {
          console.error('Failed to get waveform from cache:', request.error);
          this.missCount++;
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting waveform from cache:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Put waveform into cache
   */
  async put(
    id: string,
    data: WaveformData,
    audioUrl: string,
    assetId: string
  ): Promise<void> {
    try {
      const db = await this.ensureDB();

      // Calculate size (approximate)
      const sizeBytes =
        data.peaks.byteLength +
        data.rms.byteLength +
        id.length * 2 +
        audioUrl.length * 2 +
        100; // Overhead

      // Ensure we have space
      await this.ensureSpace(sizeBytes);

      const entry: WaveformCacheEntry = {
        id,
        data,
        sizeBytes,
        lastAccessedAt: Date.now(),
        audioUrl,
        assetId,
      };

      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const request = store.put(entry);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.currentSize += sizeBytes;
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to put waveform into cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error putting waveform into cache:', error);
    }
  }

  /**
   * Ensure enough space in cache
   */
  private async ensureSpace(requiredBytes: number): Promise<void> {
    if (this.currentSize + requiredBytes <= this.maxSize) {
      return;
    }

    const db = await this.ensureDB();
    const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);
    const index = store.index('lastAccessedAt');
    const request = index.openCursor();

    const toRemove: string[] = [];
    let freedSpace = 0;

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (!cursor) {
          // Remove collected entries
          toRemove.forEach((id) => store.delete(id));
          this.currentSize -= freedSpace;
          this.evictionCount += toRemove.length;
          resolve();
          return;
        }

        const entry = cursor.value as WaveformCacheEntry;

        if (this.currentSize + requiredBytes - freedSpace > this.maxSize) {
          toRemove.push(entry.id);
          freedSpace += entry.sizeBytes;
          cursor.continue();
        } else {
          // Enough space freed
          toRemove.forEach((id) => store.delete(id));
          this.currentSize -= freedSpace;
          this.evictionCount += toRemove.length;
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete waveform from cache
   */
  async delete(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      // Get entry to update size
      const getTransaction = db.transaction(WAVEFORM_STORE_NAME, 'readonly');
      const getStore = getTransaction.objectStore(WAVEFORM_STORE_NAME);
      const getRequest = getStore.get(id);

      const entry = await new Promise<WaveformCacheEntry | null>((resolve, reject) => {
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      });

      if (!entry) return;

      // Delete entry
      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const request = store.delete(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.currentSize -= entry.sizeBytes;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting waveform from cache:', error);
    }
  }

  /**
   * Delete all waveforms for an asset
   */
  async deleteByAssetId(assetId: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const index = store.index('assetId');
      const request = index.openCursor(IDBKeyRange.only(assetId));

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (!cursor) {
            resolve();
            return;
          }

          const entry = cursor.value as WaveformCacheEntry;
          store.delete(entry.id);
          this.currentSize -= entry.sizeBytes;
          cursor.continue();
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting waveforms by asset ID:', error);
    }
  }

  /**
   * Clear all waveforms from cache
   */
  async clear(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.currentSize = 0;
          this.hitCount = 0;
          this.missCount = 0;
          this.evictionCount = 0;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error clearing waveform cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<WaveformStats> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(WAVEFORM_STORE_NAME, 'readonly');
      const store = transaction.objectStore(WAVEFORM_STORE_NAME);
      const countRequest = store.count();

      const totalWaveforms = await new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      const totalRequests = this.hitCount + this.missCount;
      const cacheHitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

      return {
        totalWaveforms,
        totalSizeBytes: this.currentSize,
        cacheHitRate,
        averageGenerationTime: 0, // This would need to be tracked separately
      };
    } catch (error) {
      console.error('Error getting waveform cache stats:', error);
      return {
        totalWaveforms: 0,
        totalSizeBytes: 0,
        cacheHitRate: 0,
        averageGenerationTime: 0,
      };
    }
  }

  /**
   * Set maximum cache size
   */
  setMaxSize(sizeBytes: number): void {
    this.maxSize = sizeBytes;
  }

  /**
   * Get current cache size
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let cacheServiceInstance: WaveformCacheService | null = null;

export function getWaveformCacheService(): WaveformCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new WaveformCacheService();
  }
  return cacheServiceInstance;
}

export { WaveformCacheService };
