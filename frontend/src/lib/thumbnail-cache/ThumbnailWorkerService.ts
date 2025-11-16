/**
 * Subtask 20.4: WebWorker for Thumbnail Generation (Service)
 *
 * Manages a pool of thumbnail generation workers and handles
 * message communication between main thread and workers.
 */

import { WorkerMessage, ThumbnailQuality } from './types';
import { LRUCacheManager, getLRUCacheManager } from './LRUCacheManager';

interface PendingRequest {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class ThumbnailWorkerService {
  private workers: Worker[] = [];
  private workerPool: Worker[] = [];
  private pendingRequests = new Map<string, PendingRequest>();
  private workerCount = 2; // Number of workers in pool
  private cacheManager: LRUCacheManager;
  private requestIdCounter = 0;
  private requestTimeout = 30000; // 30 seconds

  constructor(workerCount?: number, cacheManager?: LRUCacheManager) {
    if (workerCount !== undefined) {
      this.workerCount = workerCount;
    }
    this.cacheManager = cacheManager || getLRUCacheManager();
    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported');
      return;
    }

    try {
      for (let i = 0; i < this.workerCount; i++) {
        const worker = new Worker('/workers/thumbnail-worker.js');
        worker.onmessage = (event) => this.handleWorkerMessage(event);
        worker.onerror = (error) => this.handleWorkerError(error);

        this.workers.push(worker);
        this.workerPool.push(worker);
      }

      console.log(`Initialized ${this.workerCount} thumbnail workers`);
    } catch (error) {
      console.error('Failed to initialize workers:', error);
    }
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const message = event.data;
    const { type, requestId, data, error } = message;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(requestId);

    // Return worker to pool
    const worker = event.target as Worker;
    if (!this.workerPool.includes(worker)) {
      this.workerPool.push(worker);
    }

    if (type === 'response' && data?.blob) {
      pending.resolve(data.blob);
    } else if (type === 'error') {
      pending.reject(new Error(error || 'Unknown worker error'));
    } else {
      pending.reject(new Error('Invalid worker response'));
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);
  }

  /**
   * Generate thumbnail using worker
   */
  async generateThumbnail(
    videoUrl: string,
    timestamp: number,
    quality: ThumbnailQuality = ThumbnailQuality.MEDIUM,
    cacheKey?: string
  ): Promise<Blob> {
    // Check cache first
    if (cacheKey) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Wait for available worker
    const worker = await this.getAvailableWorker();

    // Generate unique request ID
    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

    // Create promise for request
    const resultPromise = new Promise<Blob>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Set timeout
      setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          // Return worker to pool
          if (!this.workerPool.includes(worker)) {
            this.workerPool.push(worker);
          }
          reject(new Error('Thumbnail generation timeout'));
        }
      }, this.requestTimeout);
    });

    // Send message to worker
    const message: WorkerMessage = {
      type: 'generate',
      requestId,
      data: {
        videoUrl,
        timestamp,
        targetQuality: quality,
      },
    };

    worker.postMessage(message);

    const blob = await resultPromise;

    // Cache the result
    if (cacheKey && blob) {
      await this.cacheManager.put({
        id: cacheKey,
        blob,
        sizeBytes: blob.size,
        lastAccessedAt: Date.now(),
        quality,
        width: 0, // Will be updated by caller if needed
        height: 0,
      });
    }

    return blob;
  }

  /**
   * Generate thumbnails for multiple quality levels
   */
  async generateMultiQuality(
    videoUrl: string,
    timestamp: number,
    qualities: ThumbnailQuality[],
    baseId: string
  ): Promise<Map<ThumbnailQuality, Blob>> {
    const results = new Map<ThumbnailQuality, Blob>();

    // Generate all qualities in parallel
    const promises = qualities.map(async (quality) => {
      const cacheKey = `${baseId}_${quality}`;
      try {
        const blob = await this.generateThumbnail(
          videoUrl,
          timestamp,
          quality,
          cacheKey
        );
        results.set(quality, blob);
      } catch (error) {
        console.error(`Failed to generate ${quality} thumbnail:`, error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get an available worker from pool
   */
  private async getAvailableWorker(): Promise<Worker> {
    // If no workers available, wait
    if (this.workerPool.length === 0) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.workerPool.length > 0) {
            clearInterval(checkInterval);
            resolve(this.workerPool.shift()!);
          }
        }, 100);
      });
    }

    return this.workerPool.shift()!;
  }

  /**
   * Get number of active requests
   */
  getActiveRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get number of available workers
   */
  getAvailableWorkerCount(): number {
    return this.workerPool.length;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingRequests.clear();

    // Return all workers to pool
    this.workerPool = [...this.workers];
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelAllRequests();

    for (const worker of this.workers) {
      worker.terminate();
    }

    this.workers = [];
    this.workerPool = [];
  }

  /**
   * Check if workers are available
   */
  isAvailable(): boolean {
    return this.workers.length > 0;
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    activeRequests: number;
    pendingRequests: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.workerPool.length,
      activeRequests: this.pendingRequests.size,
      pendingRequests: this.workers.length - this.workerPool.length,
    };
  }
}

// Singleton instance
let workerServiceInstance: ThumbnailWorkerService | null = null;

export function getThumbnailWorkerService(): ThumbnailWorkerService {
  if (!workerServiceInstance) {
    workerServiceInstance = new ThumbnailWorkerService();
  }
  return workerServiceInstance;
}
