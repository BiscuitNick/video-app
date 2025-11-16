/**
 * Subtask 20.1: IndexedDB Service
 *
 * Provides persistent storage for thumbnail cache using IndexedDB
 * with automatic fallback to in-memory storage on errors.
 */

import {
  ThumbnailCacheEntry,
  ThumbnailMetadata,
  ThumbnailQuality,
} from './types';
import {
  THUMBNAIL_CACHE_DB_NAME,
  THUMBNAIL_CACHE_DB_VERSION,
  THUMBNAIL_CACHE_STORE_NAME,
} from './constants';

export class ThumbnailDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private useInMemoryFallback = false;
  private inMemoryStore = new Map<string, ThumbnailCacheEntry>();
  private errorListeners: Set<(error: Error) => void> = new Set();

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initialize(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available, using in-memory fallback');
      this.useInMemoryFallback = true;
      return;
    }

    try {
      this.db = await this.openDatabase();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.handleDatabaseError(error as Error);
      this.useInMemoryFallback = true;
    }
  }

  /**
   * Open the IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        THUMBNAIL_CACHE_DB_NAME,
        THUMBNAIL_CACHE_DB_VERSION
      );

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(THUMBNAIL_CACHE_STORE_NAME)) {
          const objectStore = db.createObjectStore(THUMBNAIL_CACHE_STORE_NAME, {
            keyPath: 'id',
          });

          // Create indexes for efficient queries
          objectStore.createIndex('lastAccessedAt', 'lastAccessedAt', {
            unique: false,
          });
          objectStore.createIndex('quality', 'quality', { unique: false });
          objectStore.createIndex('sizeBytes', 'sizeBytes', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get a thumbnail from the cache
   */
  async get(id: string): Promise<ThumbnailCacheEntry | null> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      const entry = this.inMemoryStore.get(id);
      if (entry) {
        // Update last accessed time
        entry.lastAccessedAt = Date.now();
      }
      return entry || null;
    }

    if (!this.db) {
      return null;
    }

    try {
      return await this.performTransaction<ThumbnailCacheEntry | null>(
        'readonly',
        async (store) => {
          const request = store.get(id);
          const entry = await this.promisifyRequest<ThumbnailCacheEntry>(request);

          if (entry) {
            // Update last accessed time asynchronously
            this.updateLastAccessed(id).catch(console.error);
          }

          return entry || null;
        }
      );
    } catch (error) {
      console.error('Failed to get thumbnail:', error);
      this.handleDatabaseError(error as Error);
      return null;
    }
  }

  /**
   * Put a thumbnail into the cache
   */
  async put(entry: ThumbnailCacheEntry): Promise<void> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      this.inMemoryStore.set(entry.id, { ...entry });
      return;
    }

    if (!this.db) {
      return;
    }

    try {
      await this.performTransaction('readwrite', async (store) => {
        const request = store.put(entry);
        await this.promisifyRequest(request);
      });
    } catch (error) {
      console.error('Failed to put thumbnail:', error);
      this.handleDatabaseError(error as Error);
      // Fallback to in-memory
      this.useInMemoryFallback = true;
      this.inMemoryStore.set(entry.id, { ...entry });
    }
  }

  /**
   * Delete a thumbnail from the cache
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      this.inMemoryStore.delete(id);
      return;
    }

    if (!this.db) {
      return;
    }

    try {
      await this.performTransaction('readwrite', async (store) => {
        const request = store.delete(id);
        await this.promisifyRequest(request);
      });
    } catch (error) {
      console.error('Failed to delete thumbnail:', error);
      this.handleDatabaseError(error as Error);
    }
  }

  /**
   * Get all thumbnail metadata (without blobs for efficiency)
   */
  async getAllMetadata(): Promise<ThumbnailMetadata[]> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      return Array.from(this.inMemoryStore.values()).map((entry) => ({
        id: entry.id,
        sizeBytes: entry.sizeBytes,
        lastAccessedAt: entry.lastAccessedAt,
        quality: entry.quality,
        width: entry.width,
        height: entry.height,
      }));
    }

    if (!this.db) {
      return [];
    }

    try {
      return await this.performTransaction<ThumbnailMetadata[]>(
        'readonly',
        async (store) => {
          const request = store.openCursor();
          const metadata: ThumbnailMetadata[] = [];

          return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              if (cursor) {
                const entry = cursor.value as ThumbnailCacheEntry;
                metadata.push({
                  id: entry.id,
                  sizeBytes: entry.sizeBytes,
                  lastAccessedAt: entry.lastAccessedAt,
                  quality: entry.quality,
                  width: entry.width,
                  height: entry.height,
                });
                cursor.continue();
              } else {
                resolve(metadata);
              }
            };

            request.onerror = () => {
              reject(request.error);
            };
          });
        }
      );
    } catch (error) {
      console.error('Failed to get all metadata:', error);
      this.handleDatabaseError(error as Error);
      return [];
    }
  }

  /**
   * Get entries sorted by last accessed time (oldest first)
   */
  async getOldestEntries(limit: number): Promise<ThumbnailMetadata[]> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      return Array.from(this.inMemoryStore.values())
        .map((entry) => ({
          id: entry.id,
          sizeBytes: entry.sizeBytes,
          lastAccessedAt: entry.lastAccessedAt,
          quality: entry.quality,
          width: entry.width,
          height: entry.height,
        }))
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        .slice(0, limit);
    }

    if (!this.db) {
      return [];
    }

    try {
      return await this.performTransaction<ThumbnailMetadata[]>(
        'readonly',
        async (store) => {
          const index = store.index('lastAccessedAt');
          const request = index.openCursor();
          const entries: ThumbnailMetadata[] = [];

          return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              if (cursor && entries.length < limit) {
                const entry = cursor.value as ThumbnailCacheEntry;
                entries.push({
                  id: entry.id,
                  sizeBytes: entry.sizeBytes,
                  lastAccessedAt: entry.lastAccessedAt,
                  quality: entry.quality,
                  width: entry.width,
                  height: entry.height,
                });
                cursor.continue();
              } else {
                resolve(entries);
              }
            };

            request.onerror = () => {
              reject(request.error);
            };
          });
        }
      );
    } catch (error) {
      console.error('Failed to get oldest entries:', error);
      this.handleDatabaseError(error as Error);
      return [];
    }
  }

  /**
   * Clear all thumbnails from the cache
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    if (this.useInMemoryFallback) {
      this.inMemoryStore.clear();
      return;
    }

    if (!this.db) {
      return;
    }

    try {
      await this.performTransaction('readwrite', async (store) => {
        const request = store.clear();
        await this.promisifyRequest(request);
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.handleDatabaseError(error as Error);
    }
  }

  /**
   * Update the last accessed time for an entry
   */
  private async updateLastAccessed(id: string): Promise<void> {
    if (this.useInMemoryFallback) {
      const entry = this.inMemoryStore.get(id);
      if (entry) {
        entry.lastAccessedAt = Date.now();
      }
      return;
    }

    if (!this.db) {
      return;
    }

    try {
      await this.performTransaction('readwrite', async (store) => {
        const getRequest = store.get(id);
        const entry = await this.promisifyRequest<ThumbnailCacheEntry>(getRequest);

        if (entry) {
          entry.lastAccessedAt = Date.now();
          const putRequest = store.put(entry);
          await this.promisifyRequest(putRequest);
        }
      });
    } catch (error) {
      console.error('Failed to update last accessed time:', error);
    }
  }

  /**
   * Perform a transaction on the object store
   */
  private async performTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(
      [THUMBNAIL_CACHE_STORE_NAME],
      mode
    );
    const store = transaction.objectStore(THUMBNAIL_CACHE_STORE_NAME);

    try {
      const result = await operation(store);
      await this.promisifyTransaction(transaction);
      return result;
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }

  /**
   * Convert an IDBRequest to a Promise
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Convert an IDBTransaction to a Promise
   */
  private promisifyTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  /**
   * Handle database errors and notify listeners
   */
  private handleDatabaseError(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  /**
   * Add an error listener
   */
  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSizeBytes: number;
    usingFallback: boolean;
  }> {
    await this.ensureInitialized();

    const metadata = await this.getAllMetadata();
    const totalSizeBytes = metadata.reduce(
      (sum, entry) => sum + entry.sizeBytes,
      0
    );

    return {
      totalEntries: metadata.length,
      totalSizeBytes,
      usingFallback: this.useInMemoryFallback,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let dbServiceInstance: ThumbnailDBService | null = null;

export function getThumbnailDBService(): ThumbnailDBService {
  if (!dbServiceInstance) {
    dbServiceInstance = new ThumbnailDBService();
  }
  return dbServiceInstance;
}
