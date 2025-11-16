/**
 * Waveform Worker Service
 *
 * Manages a pool of web workers for waveform generation.
 * Handles worker communication, load balancing, and error handling.
 */

import type {
  WaveformData,
  WaveformGenerationOptions,
  WaveformWorkerMessage,
} from '@/lib/waveform/types';
import {
  WORKER_POOL_SIZE,
  WORKER_TIMEOUT,
} from '@/lib/waveform/constants';

interface WorkerTask {
  requestId: string;
  resolve: (data: WaveformData) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  onProgress?: (progress: number) => void;
}

class WaveformWorkerService {
  private workers: Worker[] = [];
  private activeWorker = 0;
  private pendingTasks: Map<string, WorkerTask> = new Map();
  private taskQueue: Array<() => void> = [];
  private activeTasks = 0;
  private maxConcurrentTasks: number;

  constructor(maxConcurrentTasks = WORKER_POOL_SIZE) {
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      try {
        const worker = new Worker('/workers/waveform.worker.js');
        worker.addEventListener('message', (event) => this.handleWorkerMessage(event));
        worker.addEventListener('error', (error) => this.handleWorkerError(error));
        this.workers.push(worker);
      } catch (error) {
        console.error('Failed to create waveform worker:', error);
      }
    }

    if (this.workers.length === 0) {
      console.warn('No waveform workers available. Waveform generation will be disabled.');
    }
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(event: MessageEvent<WaveformWorkerMessage>): void {
    const { type, requestId, data, error, progress } = event.data;

    const task = this.pendingTasks.get(requestId);
    if (!task) return;

    switch (type) {
      case 'response':
        if (data?.waveformData) {
          clearTimeout(task.timeout);
          this.pendingTasks.delete(requestId);
          this.activeTasks--;
          this.processQueue();
          task.resolve(data.waveformData);
        }
        break;

      case 'error':
        clearTimeout(task.timeout);
        this.pendingTasks.delete(requestId);
        this.activeTasks--;
        this.processQueue();
        task.reject(new Error(error || 'Unknown error in waveform generation'));
        break;

      case 'progress':
        if (progress !== undefined && task.onProgress) {
          task.onProgress(progress);
        }
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Waveform worker error:', error);
  }

  /**
   * Get next available worker (round-robin)
   */
  private getNextWorker(): Worker | null {
    if (this.workers.length === 0) return null;

    const worker = this.workers[this.activeWorker];
    this.activeWorker = (this.activeWorker + 1) % this.workers.length;
    return worker;
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks < this.maxConcurrentTasks
    ) {
      const task = this.taskQueue.shift();
      if (task) {
        task();
      }
    }
  }

  /**
   * Generate waveform from audio URL
   */
  async generateWaveform(
    audioUrl: string,
    options: WaveformGenerationOptions = {}
  ): Promise<WaveformData> {
    return new Promise((resolve, reject) => {
      const executeTask = () => {
        const worker = this.getNextWorker();
        if (!worker) {
          reject(new Error('No workers available'));
          return;
        }

        const requestId = `waveform_${Date.now()}_${Math.random()}`;
        this.activeTasks++;

        // Set up timeout
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(requestId);
          this.activeTasks--;
          this.processQueue();
          reject(new Error('Waveform generation timeout'));

          // Send cancel message to worker
          worker.postMessage({
            type: 'cancel',
            requestId,
          });
        }, WORKER_TIMEOUT);

        // Store task
        this.pendingTasks.set(requestId, {
          requestId,
          resolve,
          reject,
          timeout,
          onProgress: options.onProgress,
        });

        // Send generation request to worker
        worker.postMessage({
          type: 'generate',
          requestId,
          data: {
            audioUrl,
            options,
          },
        });
      };

      // Queue or execute immediately
      if (this.activeTasks >= this.maxConcurrentTasks) {
        this.taskQueue.push(executeTask);
      } else {
        executeTask();
      }
    });
  }

  /**
   * Generate waveform from audio buffer
   */
  async generateWaveformFromBuffer(
    audioBuffer: ArrayBuffer,
    options: WaveformGenerationOptions = {}
  ): Promise<WaveformData> {
    return new Promise((resolve, reject) => {
      const executeTask = () => {
        const worker = this.getNextWorker();
        if (!worker) {
          reject(new Error('No workers available'));
          return;
        }

        const requestId = `waveform_${Date.now()}_${Math.random()}`;
        this.activeTasks++;

        // Set up timeout
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(requestId);
          this.activeTasks--;
          this.processQueue();
          reject(new Error('Waveform generation timeout'));

          // Send cancel message to worker
          worker.postMessage({
            type: 'cancel',
            requestId,
          });
        }, WORKER_TIMEOUT);

        // Store task
        this.pendingTasks.set(requestId, {
          requestId,
          resolve,
          reject,
          timeout,
          onProgress: options.onProgress,
        });

        // Send generation request to worker
        worker.postMessage(
          {
            type: 'generate',
            requestId,
            data: {
              audioBuffer,
              options,
            },
          },
          [audioBuffer] // Transfer buffer for performance
        );
      };

      // Queue or execute immediately
      if (this.activeTasks >= this.maxConcurrentTasks) {
        this.taskQueue.push(executeTask);
      } else {
        executeTask();
      }
    });
  }

  /**
   * Cancel a pending generation request
   */
  cancelGeneration(requestId: string): void {
    const task = this.pendingTasks.get(requestId);
    if (task) {
      clearTimeout(task.timeout);
      this.pendingTasks.delete(requestId);
      this.activeTasks--;
      this.processQueue();

      // Send cancel message to all workers (we don't know which one has it)
      this.workers.forEach((worker) => {
        worker.postMessage({
          type: 'cancel',
          requestId,
        });
      });
    }
  }

  /**
   * Get service stats
   */
  getStats() {
    return {
      workersAvailable: this.workers.length,
      activeTasks: this.activeTasks,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
    };
  }

  /**
   * Destroy all workers
   */
  destroy(): void {
    // Clear all pending tasks
    this.pendingTasks.forEach((task) => {
      clearTimeout(task.timeout);
      task.reject(new Error('Service destroyed'));
    });
    this.pendingTasks.clear();
    this.taskQueue = [];

    // Terminate all workers
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.activeTasks = 0;
  }
}

// Singleton instance
let workerServiceInstance: WaveformWorkerService | null = null;

export function getWaveformWorkerService(): WaveformWorkerService {
  if (!workerServiceInstance) {
    workerServiceInstance = new WaveformWorkerService();
  }
  return workerServiceInstance;
}

export { WaveformWorkerService };
