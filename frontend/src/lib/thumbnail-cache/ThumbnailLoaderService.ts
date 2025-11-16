/**
 * Subtask 20.3: Lazy Loading Service
 *
 * Implements lazy loading of thumbnails using Intersection Observer,
 * progressive loading (low-res to high-res), priority queue based on
 * viewport proximity, and scroll debouncing.
 */

import { LRUCacheManager, getLRUCacheManager } from './LRUCacheManager';
import { LoadRequest, ThumbnailQuality, LoadOptions } from './types';
import {
  INTERSECTION_OBSERVER_OPTIONS,
  SCROLL_DEBOUNCE_MS,
  PRIORITY_UPDATE_INTERVAL_MS,
  PROGRESSIVE_LOAD_DELAY_MS,
} from './constants';

interface LoadQueueItem {
  request: LoadRequest;
  element: HTMLElement;
  callback: (blob: Blob | null, quality: ThumbnailQuality) => void;
  errorCallback: (error: Error) => void;
  abortController: AbortController;
  distance: number; // Distance from viewport
}

export class ThumbnailLoaderService {
  private cacheManager: LRUCacheManager;
  private observer: IntersectionObserver | null = null;
  private loadQueue: Map<string, LoadQueueItem> = new Map();
  private activeLoads = new Set<string>();
  private maxConcurrentLoads = 6;
  private priorityUpdateTimer: number | null = null;
  private scrollDebounceTimer: number | null = null;
  private isProcessingQueue = false;
  private observedElements = new Map<HTMLElement, LoadRequest>();

  constructor(cacheManager?: LRUCacheManager) {
    this.cacheManager = cacheManager || getLRUCacheManager();
    this.initializeObserver();
    this.startPriorityUpdateTimer();
  }

  /**
   * Initialize Intersection Observer
   */
  private initializeObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('IntersectionObserver not available');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      INTERSECTION_OBSERVER_OPTIONS
    );
  }

  /**
   * Handle intersection observer entries
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    let shouldProcessQueue = false;

    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      const request = this.observedElements.get(element);

      if (!request) continue;

      if (entry.isIntersecting) {
        // Element is in or near viewport
        const distance = this.calculateViewportDistance(entry);
        const queueItem = this.loadQueue.get(request.id);

        if (queueItem) {
          queueItem.distance = distance;
          queueItem.request.priority = this.calculatePriority(distance);
          shouldProcessQueue = true;
        }
      }
    }

    if (shouldProcessQueue) {
      this.debounceQueueProcessing();
    }
  }

  /**
   * Calculate distance from viewport
   */
  private calculateViewportDistance(entry: IntersectionObserverEntry): number {
    const rect = entry.boundingClientRect;
    const viewportHeight = window.innerHeight;

    if (rect.top >= 0 && rect.bottom <= viewportHeight) {
      // Fully in viewport
      return 0;
    } else if (rect.top < 0 && rect.bottom > 0) {
      // Partially above viewport
      return Math.abs(rect.top);
    } else if (rect.top < viewportHeight && rect.bottom > viewportHeight) {
      // Partially below viewport
      return rect.top;
    } else if (rect.bottom < 0) {
      // Above viewport
      return Math.abs(rect.bottom);
    } else {
      // Below viewport
      return rect.top - viewportHeight;
    }
  }

  /**
   * Calculate priority based on distance (closer = higher priority)
   */
  private calculatePriority(distance: number): number {
    // Priority from 0 (highest) to 1000 (lowest)
    // Elements in viewport get priority 0-100
    // Elements near viewport get priority 100-500
    // Elements far from viewport get priority 500-1000
    if (distance <= 0) {
      return 0;
    } else if (distance < 200) {
      return Math.floor((distance / 200) * 100);
    } else if (distance < 1000) {
      return 100 + Math.floor(((distance - 200) / 800) * 400);
    } else {
      return Math.min(1000, 500 + Math.floor((distance - 1000) / 10));
    }
  }

  /**
   * Observe an element for lazy loading
   */
  observe(
    element: HTMLElement,
    request: LoadRequest,
    callback: (blob: Blob | null, quality: ThumbnailQuality) => void,
    errorCallback: (error: Error) => void
  ): () => void {
    if (!this.observer) {
      // Fallback: load immediately if no observer
      this.load(request, callback, errorCallback);
      return () => {};
    }

    // Store the request
    this.observedElements.set(element, request);

    // Create queue item
    const queueItem: LoadQueueItem = {
      request,
      element,
      callback,
      errorCallback,
      abortController: new AbortController(),
      distance: Infinity,
    };

    this.loadQueue.set(request.id, queueItem);

    // Start observing
    this.observer.observe(element);

    // Return cleanup function
    return () => {
      this.unobserve(element, request.id);
    };
  }

  /**
   * Stop observing an element
   */
  unobserve(element: HTMLElement, requestId: string): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.observedElements.delete(element);

    const queueItem = this.loadQueue.get(requestId);
    if (queueItem) {
      queueItem.abortController.abort();
      this.loadQueue.delete(requestId);
    }

    this.activeLoads.delete(requestId);
  }

  /**
   * Load a thumbnail immediately (bypass queue)
   */
  async load(
    request: LoadRequest,
    callback: (blob: Blob | null, quality: ThumbnailQuality) => void,
    errorCallback: (error: Error) => void,
    options?: LoadOptions
  ): Promise<void> {
    try {
      const abortSignal = options?.abortSignal;

      // Progressive loading: try low quality first, then upgrade
      if (!options?.forceReload) {
        const lowQualityBlob = await this.loadFromCache(
          request.id,
          ThumbnailQuality.LOW,
          abortSignal
        );

        if (lowQualityBlob) {
          callback(lowQualityBlob, ThumbnailQuality.LOW);

          // Continue loading higher quality in background
          setTimeout(() => {
            this.loadHigherQuality(request, callback, errorCallback, abortSignal);
          }, PROGRESSIVE_LOAD_DELAY_MS);
          return;
        }
      }

      // Load requested quality
      const targetQuality = options?.quality || request.quality;
      const blob = await this.loadFromCache(request.id, targetQuality, abortSignal);

      if (blob) {
        callback(blob, targetQuality);
      } else {
        // Generate thumbnail (will be implemented with worker integration)
        callback(null, targetQuality);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        errorCallback(error as Error);
      }
    }
  }

  /**
   * Load higher quality thumbnail
   */
  private async loadHigherQuality(
    request: LoadRequest,
    callback: (blob: Blob | null, quality: ThumbnailQuality) => void,
    errorCallback: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    try {
      const targetQuality = request.quality;

      if (targetQuality === ThumbnailQuality.LOW) {
        return; // Already at lowest quality
      }

      const blob = await this.loadFromCache(request.id, targetQuality, abortSignal);

      if (blob) {
        callback(blob, targetQuality);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        errorCallback(error as Error);
      }
    }
  }

  /**
   * Load thumbnail from cache
   */
  private async loadFromCache(
    id: string,
    quality: ThumbnailQuality,
    abortSignal?: AbortSignal
  ): Promise<Blob | null> {
    if (abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const cacheKey = `${id}_${quality}`;
    return await this.cacheManager.get(cacheKey);
  }

  /**
   * Debounce queue processing on scroll
   */
  private debounceQueueProcessing(): void {
    if (this.scrollDebounceTimer !== null) {
      clearTimeout(this.scrollDebounceTimer);
    }

    this.scrollDebounceTimer = window.setTimeout(() => {
      this.processQueue();
      this.scrollDebounceTimer = null;
    }, SCROLL_DEBOUNCE_MS);
  }

  /**
   * Process the load queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort queue by priority
      const sortedQueue = Array.from(this.loadQueue.values()).sort(
        (a, b) => a.request.priority - b.request.priority
      );

      // Process items up to max concurrent loads
      const availableSlots = this.maxConcurrentLoads - this.activeLoads.size;

      for (let i = 0; i < Math.min(availableSlots, sortedQueue.length); i++) {
        const item = sortedQueue[i];

        if (this.activeLoads.has(item.request.id)) {
          continue;
        }

        this.activeLoads.add(item.request.id);
        this.loadQueueItem(item);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Load a queue item
   */
  private async loadQueueItem(item: LoadQueueItem): Promise<void> {
    try {
      await this.load(
        item.request,
        (blob, quality) => {
          item.callback(blob, quality);
          this.completeLoad(item.request.id);
        },
        (error) => {
          item.errorCallback(error);
          this.completeLoad(item.request.id);
        },
        {
          abortSignal: item.abortController.signal,
        }
      );
    } catch (error) {
      item.errorCallback(error as Error);
      this.completeLoad(item.request.id);
    }
  }

  /**
   * Mark a load as complete and process next items
   */
  private completeLoad(requestId: string): void {
    this.activeLoads.delete(requestId);
    this.loadQueue.delete(requestId);

    // Process next items in queue
    if (this.loadQueue.size > 0) {
      this.processQueue();
    }
  }

  /**
   * Start periodic priority updates
   */
  private startPriorityUpdateTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.priorityUpdateTimer = window.setInterval(() => {
      this.updatePriorities();
    }, PRIORITY_UPDATE_INTERVAL_MS);
  }

  /**
   * Update priorities for all queued items
   */
  private updatePriorities(): void {
    if (this.loadQueue.size === 0) {
      return;
    }

    let hasChanges = false;

    for (const item of this.loadQueue.values()) {
      const rect = item.element.getBoundingClientRect();
      const distance = this.calculateViewportDistanceFromRect(rect);
      const newPriority = this.calculatePriority(distance);

      if (item.request.priority !== newPriority) {
        item.request.priority = newPriority;
        item.distance = distance;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.processQueue();
    }
  }

  /**
   * Calculate viewport distance from bounding rect
   */
  private calculateViewportDistanceFromRect(rect: DOMRect): number {
    const viewportHeight = window.innerHeight;

    if (rect.top >= 0 && rect.bottom <= viewportHeight) {
      return 0;
    } else if (rect.top < 0 && rect.bottom > 0) {
      return Math.abs(rect.top);
    } else if (rect.top < viewportHeight && rect.bottom > viewportHeight) {
      return rect.top;
    } else if (rect.bottom < 0) {
      return Math.abs(rect.bottom);
    } else {
      return rect.top - viewportHeight;
    }
  }

  /**
   * Set maximum concurrent loads
   */
  setMaxConcurrentLoads(max: number): void {
    this.maxConcurrentLoads = max;
    this.processQueue();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.loadQueue.size;
  }

  /**
   * Get active loads count
   */
  getActiveLoadsCount(): number {
    return this.activeLoads.size;
  }

  /**
   * Clear all pending loads
   */
  clearQueue(): void {
    for (const item of this.loadQueue.values()) {
      item.abortController.abort();
    }
    this.loadQueue.clear();
    this.activeLoads.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.priorityUpdateTimer !== null) {
      clearInterval(this.priorityUpdateTimer);
      this.priorityUpdateTimer = null;
    }

    if (this.scrollDebounceTimer !== null) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }

    this.clearQueue();
    this.observedElements.clear();
  }
}

// Singleton instance
let loaderServiceInstance: ThumbnailLoaderService | null = null;

export function getThumbnailLoaderService(): ThumbnailLoaderService {
  if (!loaderServiceInstance) {
    loaderServiceInstance = new ThumbnailLoaderService();
  }
  return loaderServiceInstance;
}
