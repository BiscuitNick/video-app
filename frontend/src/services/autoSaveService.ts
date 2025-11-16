import { useAppStore } from '@/stores/useAppStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useMediaLibraryStore } from '@/stores/useMediaLibraryStore';
import { serializeProject, type SerializedProject } from './projectSerializationService';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'success' | 'error';

export interface SaveState {
  status: SaveStatus;
  lastSaveTime: number | null;
  nextSaveTime: number | null;
  error: string | null;
  retryCount: number;
  progress: number; // 0-100
}

export interface AutoSaveOptions {
  enabled: boolean;
  debounceInterval: number; // milliseconds
  maxRetries: number;
  baseBackoffDelay: number; // milliseconds for exponential backoff
  onSave?: (data: SerializedProject) => Promise<void>;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

class AutoSaveService {
  private options: AutoSaveOptions;
  private saveState: SaveState;
  private debounceTimer: number | null = null;
  private saveQueue: Array<() => Promise<void>> = [];
  private isSaving = false;
  private listeners: Set<(state: SaveState) => void> = new Set();
  private unsubscribers: Array<() => void> = [];

  constructor(options: Partial<AutoSaveOptions> = {}) {
    this.options = {
      enabled: true,
      debounceInterval: 30000, // 30 seconds
      maxRetries: 3,
      baseBackoffDelay: 1000, // 1 second
      ...options,
    };

    this.saveState = {
      status: 'idle',
      lastSaveTime: null,
      nextSaveTime: null,
      error: null,
      retryCount: 0,
      progress: 0,
    };
  }

  /**
   * Initialize the auto-save service and subscribe to store changes
   */
  public initialize() {
    if (!this.options.enabled) return;

    // Subscribe to timeline store changes
    const timelineUnsubscribe = useTimelineStore.subscribe(
      (state) => state.isDirty,
      (isDirty) => {
        if (isDirty) {
          this.scheduleSave();
        }
      }
    );

    // Subscribe to app store changes
    const appUnsubscribe = useAppStore.subscribe(
      (state) => state.isDirty,
      (isDirty) => {
        if (isDirty) {
          this.scheduleSave();
        }
      }
    );

    this.unsubscribers.push(timelineUnsubscribe, appUnsubscribe);
  }

  /**
   * Destroy the service and clean up subscriptions
   */
  public destroy() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  /**
   * Schedule a debounced save
   */
  public scheduleSave(immediate: boolean = false) {
    if (!this.options.enabled) return;

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const delay = immediate ? 0 : this.options.debounceInterval;

    this.updateState({
      status: 'pending',
      nextSaveTime: Date.now() + delay,
    });

    this.debounceTimer = window.setTimeout(() => {
      this.enqueueSave();
    }, delay);
  }

  /**
   * Trigger an immediate save (for significant operations)
   */
  public saveImmediately() {
    this.scheduleSave(true);
  }

  /**
   * Add a save operation to the queue
   */
  private enqueueSave() {
    this.saveQueue.push(() => this.performSave());
    this.processSaveQueue();
  }

  /**
   * Process the save queue
   */
  private async processSaveQueue() {
    if (this.isSaving || this.saveQueue.length === 0) return;

    this.isSaving = true;

    // Process all queued saves (they'll be coalesced into one)
    while (this.saveQueue.length > 0) {
      const saveOperation = this.saveQueue.shift();
      if (saveOperation) {
        try {
          await saveOperation();
          // Clear the queue since we just saved everything
          this.saveQueue = [];
        } catch (error) {
          console.error('Save operation failed:', error);
        }
      }
    }

    this.isSaving = false;
  }

  /**
   * Perform the actual save operation
   */
  private async performSave() {
    try {
      this.updateState({
        status: 'saving',
        progress: 10,
      });

      // Serialize the project state
      const serializedData = this.serializeCurrentState();

      this.updateState({ progress: 50 });

      // Call the save callback if provided
      if (this.options.onSave) {
        await this.options.onSave(serializedData);
      } else {
        // Default save behavior - store in localStorage
        await this.saveToLocalStorage(serializedData);
      }

      this.updateState({ progress: 90 });

      // Mark stores as clean
      this.markStoresClean();

      this.updateState({
        status: 'success',
        lastSaveTime: Date.now(),
        nextSaveTime: null,
        error: null,
        retryCount: 0,
        progress: 100,
      });

      // Call success callback
      this.options.onSuccess?.();

      // Reset to idle after a short delay
      setTimeout(() => {
        this.updateState({ status: 'idle', progress: 0 });
      }, 2000);

    } catch (error) {
      await this.handleSaveError(error as Error);
    }
  }

  /**
   * Handle save errors with exponential backoff
   */
  private async handleSaveError(error: Error) {
    const newRetryCount = this.saveState.retryCount + 1;

    this.updateState({
      status: 'error',
      error: error.message,
      retryCount: newRetryCount,
      progress: 0,
    });

    // Call error callback
    this.options.onError?.(error);

    // Retry with exponential backoff if under max retries
    if (newRetryCount < this.options.maxRetries) {
      const backoffDelay = this.options.baseBackoffDelay * Math.pow(2, newRetryCount);

      console.log(`Retrying save in ${backoffDelay}ms (attempt ${newRetryCount + 1}/${this.options.maxRetries})`);

      setTimeout(() => {
        this.enqueueSave();
      }, backoffDelay);
    } else {
      console.error('Max retries reached for save operation');
      // Reset retry count after max retries
      this.updateState({ retryCount: 0 });
    }
  }

  /**
   * Serialize the current application state
   */
  private serializeCurrentState(): SerializedProject {
    const appState = useAppStore.getState();
    const timelineState = useTimelineStore.getState();
    const mediaLibraryState = useMediaLibraryStore.getState();

    return serializeProject({
      app: appState,
      timeline: timelineState,
      mediaLibrary: mediaLibraryState,
    });
  }

  /**
   * Mark all stores as clean after successful save
   */
  private markStoresClean() {
    const timelineStore = useTimelineStore.getState();
    const appStore = useAppStore.getState();

    timelineStore.markClean?.();
    appStore.markClean?.();
  }

  /**
   * Save to localStorage as default behavior
   */
  private async saveToLocalStorage(data: SerializedProject): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem('chronos-autosave', serialized);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Load from localStorage
   */
  public async loadFromLocalStorage(): Promise<SerializedProject | null> {
    try {
      const data = localStorage.getItem('chronos-autosave');
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Update the save state and notify listeners
   */
  private updateState(updates: Partial<SaveState>) {
    this.saveState = {
      ...this.saveState,
      ...updates,
    };

    this.notifyListeners();
  }

  /**
   * Subscribe to save state changes
   */
  public subscribe(listener: (state: SaveState) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => {
      listener(this.saveState);
    });
  }

  /**
   * Get the current save state
   */
  public getState(): SaveState {
    return { ...this.saveState };
  }

  /**
   * Update auto-save options
   */
  public updateOptions(options: Partial<AutoSaveOptions>) {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  /**
   * Check if there are pending changes
   */
  public hasPendingChanges(): boolean {
    const timelineState = useTimelineStore.getState();
    const appState = useAppStore.getState();

    return timelineState.isDirty || appState.isDirty;
  }

  /**
   * Force a save regardless of dirty state
   */
  public async forceSave(): Promise<void> {
    this.enqueueSave();

    // Wait for save to complete
    return new Promise((resolve) => {
      const checkStatus = () => {
        const state = this.getState();
        if (state.status === 'idle' || state.status === 'success') {
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      };
      checkStatus();
    });
  }
}

// Singleton instance
let autoSaveServiceInstance: AutoSaveService | null = null;

/**
 * Get or create the auto-save service singleton
 */
export const getAutoSaveService = (options?: Partial<AutoSaveOptions>): AutoSaveService => {
  if (!autoSaveServiceInstance) {
    autoSaveServiceInstance = new AutoSaveService(options);
  }
  return autoSaveServiceInstance;
};

/**
 * Reset the auto-save service (useful for testing)
 */
export const resetAutoSaveService = () => {
  if (autoSaveServiceInstance) {
    autoSaveServiceInstance.destroy();
    autoSaveServiceInstance = null;
  }
};

export default AutoSaveService;
