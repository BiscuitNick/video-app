import type {
  GenerationQueueItem,
  ReplicateGenerationRequest,
  GenerationStatus,
} from '../types/replicate';
import { replicateService } from './api/replicate';

/**
 * Generation Queue Manager
 * Manages AI generation queue with priority, limits, and persistence
 */

export const MAX_GENERATIONS = 5;
const QUEUE_STORAGE_KEY = 'ai_generation_queue';

export interface QueueManagerOptions {
  maxConcurrent?: number;
  onUpdate?: (queue: GenerationQueueItem[]) => void;
  onComplete?: (item: GenerationQueueItem) => void;
  onError?: (item: GenerationQueueItem, error: Error) => void;
}

export class GenerationQueueManager {
  private static instance: GenerationQueueManager;
  private queue: GenerationQueueItem[] = [];
  private activeGenerations = new Set<string>();
  private maxConcurrent: number;
  private onUpdate?: (queue: GenerationQueueItem[]) => void;
  private onComplete?: (item: GenerationQueueItem) => void;
  private onError?: (item: GenerationQueueItem, error: Error) => void;

  private constructor(options: QueueManagerOptions = {}) {
    this.maxConcurrent = options.maxConcurrent || MAX_GENERATIONS;
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.loadQueue();
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: QueueManagerOptions): GenerationQueueManager {
    if (!GenerationQueueManager.instance) {
      GenerationQueueManager.instance = new GenerationQueueManager(options);
    } else if (options) {
      // Update callbacks if provided
      if (options.onUpdate) GenerationQueueManager.instance.onUpdate = options.onUpdate;
      if (options.onComplete) GenerationQueueManager.instance.onComplete = options.onComplete;
      if (options.onError) GenerationQueueManager.instance.onError = options.onError;
    }
    return GenerationQueueManager.instance;
  }

  /**
   * Add generation to queue
   */
  async addToQueue(
    request: ReplicateGenerationRequest,
    priority: number = 0
  ): Promise<GenerationQueueItem> {
    if (this.queue.length >= this.maxConcurrent) {
      throw new Error(`Queue is full. Maximum ${this.maxConcurrent} generations allowed.`);
    }

    const item: GenerationQueueItem = {
      id: this.generateId(),
      request,
      status: 'pending',
      priority,
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    this.queue.push(item);
    this.sortQueueByPriority();
    this.saveQueue();
    this.notifyUpdate();
    this.processQueue();

    return item;
  }

  /**
   * Cancel a generation
   */
  async cancelGeneration(generationId: string): Promise<void> {
    const item = this.queue.find((i) => i.id === generationId);
    if (!item) {
      throw new Error('Generation not found in queue');
    }

    if (item.status === 'processing') {
      try {
        await replicateService.cancelGeneration(generationId);
      } catch (error) {
        console.error('Failed to cancel generation:', error);
      }
      this.activeGenerations.delete(generationId);
    }

    item.status = 'cancelled';
    this.saveQueue();
    this.notifyUpdate();
    this.processQueue();
  }

  /**
   * Remove completed/failed/cancelled generation from queue
   */
  removeFromQueue(generationId: string): void {
    const index = this.queue.findIndex((i) => i.id === generationId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveQueue();
      this.notifyUpdate();
    }
  }

  /**
   * Get current queue
   */
  getQueue(): GenerationQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get queue item by ID
   */
  getItem(generationId: string): GenerationQueueItem | undefined {
    return this.queue.find((i) => i.id === generationId);
  }

  /**
   * Update item progress
   */
  updateProgress(generationId: string, progress: number, estimatedTimeRemaining?: number): void {
    const item = this.queue.find((i) => i.id === generationId);
    if (item) {
      item.progress = progress;
      item.estimatedTimeRemaining = estimatedTimeRemaining;
      this.saveQueue();
      this.notifyUpdate();
    }
  }

  /**
   * Update item status
   */
  updateStatus(
    generationId: string,
    status: GenerationStatus,
    outputUrl?: string,
    error?: string
  ): void {
    const item = this.queue.find((i) => i.id === generationId);
    if (item) {
      item.status = status;
      if (outputUrl) item.outputUrl = outputUrl;
      if (error) item.error = error;

      if (status === 'completed') {
        item.completedAt = new Date().toISOString();
        item.progress = 100;
        this.activeGenerations.delete(generationId);
        if (this.onComplete) this.onComplete(item);
      } else if (status === 'failed' || status === 'cancelled') {
        item.completedAt = new Date().toISOString();
        this.activeGenerations.delete(generationId);
      }

      this.saveQueue();
      this.notifyUpdate();
      this.processQueue();
    }
  }

  /**
   * Clear completed/failed/cancelled items
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(
      (item) => item.status === 'pending' || item.status === 'processing'
    );
    this.saveQueue();
    this.notifyUpdate();
  }

  /**
   * Process queue - start pending generations
   */
  private async processQueue(): Promise<void> {
    // Find pending items that can be started
    const pendingItems = this.queue
      .filter((item) => item.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    for (const item of pendingItems) {
      if (this.activeGenerations.size >= this.maxConcurrent) {
        break;
      }

      this.startGeneration(item);
    }
  }

  /**
   * Start a generation
   */
  private async startGeneration(item: GenerationQueueItem): Promise<void> {
    item.status = 'processing';
    item.startedAt = new Date().toISOString();
    this.activeGenerations.add(item.id);
    this.saveQueue();
    this.notifyUpdate();

    try {
      const response = await replicateService.generate(item.request);

      // Update with response
      this.updateStatus(item.id, response.status, response.outputUrl);
    } catch (error) {
      console.error('Generation failed:', error);
      this.updateStatus(item.id, 'failed', undefined, (error as Error).message);
      if (this.onError) {
        this.onError(item, error as Error);
      }
    }
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueueByPriority(): void {
    this.queue.sort((a, b) => {
      // Keep processing items at the top
      if (a.status === 'processing' && b.status !== 'processing') return -1;
      if (a.status !== 'processing' && b.status === 'processing') return 1;

      // Then sort by priority
      return b.priority - a.priority;
    });
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);

        // Reset processing items to pending on app restart
        this.queue.forEach((item) => {
          if (item.status === 'processing') {
            item.status = 'pending';
            item.progress = 0;
          }
        });

        this.activeGenerations.clear();
      }
    } catch (error) {
      console.error('Failed to load queue from localStorage:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue to localStorage:', error);
    }
  }

  /**
   * Notify listeners of queue update
   */
  private notifyUpdate(): void {
    if (this.onUpdate) {
      this.onUpdate([...this.queue]);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton getter
export const getQueueManager = (options?: QueueManagerOptions) =>
  GenerationQueueManager.getInstance(options);

export default GenerationQueueManager;
