import type {
  GenerationHistoryItem,
  GenerationQueueItem,
  ReplicateGenerationRequest,
} from '../types/replicate';
import type { MediaAsset } from '../types/api';
import { mediaApi } from './api/media';

/**
 * Generation History Service
 * Manages generation history, auto-import, and search/filter functionality
 */

const HISTORY_STORAGE_KEY = 'ai_generation_history';
const MAX_HISTORY_ITEMS = 100;

export interface HistoryFilterOptions {
  type?: 'image' | 'video';
  status?: 'completed' | 'failed';
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export class GenerationHistoryService {
  private static instance: GenerationHistoryService;
  private history: GenerationHistoryItem[] = [];
  private onUpdateCallback?: (history: GenerationHistoryItem[]) => void;

  private constructor() {
    this.loadHistory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GenerationHistoryService {
    if (!GenerationHistoryService.instance) {
      GenerationHistoryService.instance = new GenerationHistoryService();
    }
    return GenerationHistoryService.instance;
  }

  /**
   * Set update callback
   */
  setOnUpdate(callback: (history: GenerationHistoryItem[]) => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * Add generation to history
   */
  addToHistory(item: GenerationQueueItem): GenerationHistoryItem {
    const historyItem: GenerationHistoryItem = {
      id: item.id,
      request: item.request,
      status: item.status,
      outputUrl: item.outputUrl,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    };

    // Add to beginning of history
    this.history.unshift(historyItem);

    // Limit history size
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveHistory();
    this.notifyUpdate();

    return historyItem;
  }

  /**
   * Auto-import completed generation as media asset
   */
  async autoImport(
    projectId: string,
    historyItem: GenerationHistoryItem
  ): Promise<MediaAsset | null> {
    if (!historyItem.outputUrl || historyItem.status !== 'completed') {
      console.warn('Cannot import: generation not completed or no output URL');
      return null;
    }

    try {
      // Download the asset from Replicate URL
      const response = await fetch(historyItem.outputUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Determine file type and extension
      const mimeType = blob.type;
      const extension = this.getExtensionFromMimeType(mimeType);
      const fileName = `ai_generated_${historyItem.request.type}_${Date.now()}${extension}`;

      // Create File object
      const file = new File([blob], fileName, { type: mimeType });

      // Upload to media library
      const mediaAsset = await mediaApi.upload({
        projectId,
        file,
        name: this.generateMediaName(historyItem),
      });

      // Update history item with media ID and thumbnail
      const index = this.history.findIndex((i) => i.id === historyItem.id);
      if (index !== -1) {
        this.history[index].mediaId = mediaAsset.id;
        this.history[index].thumbnailUrl = mediaAsset.thumbnailUrl;
        this.saveHistory();
        this.notifyUpdate();
      }

      return mediaAsset;
    } catch (error) {
      console.error('Failed to auto-import generation:', error);
      throw error;
    }
  }

  /**
   * Get all history items
   */
  getHistory(filter?: HistoryFilterOptions): GenerationHistoryItem[] {
    let filtered = [...this.history];

    if (filter) {
      // Filter by type
      if (filter.type) {
        filtered = filtered.filter((item) => item.request.type === filter.type);
      }

      // Filter by status
      if (filter.status) {
        filtered = filtered.filter((item) => item.status === filter.status);
      }

      // Filter by date range
      if (filter.dateFrom) {
        filtered = filtered.filter(
          (item) => new Date(item.createdAt) >= new Date(filter.dateFrom!)
        );
      }
      if (filter.dateTo) {
        filtered = filtered.filter(
          (item) => new Date(item.createdAt) <= new Date(filter.dateTo!)
        );
      }

      // Filter by search query (searches in prompt)
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        filtered = filtered.filter((item) =>
          item.request.prompt.toLowerCase().includes(query)
        );
      }
    }

    return filtered;
  }

  /**
   * Get history item by ID
   */
  getHistoryItem(id: string): GenerationHistoryItem | undefined {
    return this.history.find((item) => item.id === id);
  }

  /**
   * Delete history item
   */
  deleteHistoryItem(id: string): void {
    const index = this.history.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.saveHistory();
      this.notifyUpdate();
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.notifyUpdate();
  }

  /**
   * Get history statistics
   */
  getStatistics(): {
    total: number;
    completed: number;
    failed: number;
    images: number;
    videos: number;
    imported: number;
  } {
    return {
      total: this.history.length,
      completed: this.history.filter((i) => i.status === 'completed').length,
      failed: this.history.filter((i) => i.status === 'failed').length,
      images: this.history.filter((i) => i.request.type === 'image').length,
      videos: this.history.filter((i) => i.request.type === 'video').length,
      imported: this.history.filter((i) => i.mediaId !== undefined).length,
    };
  }

  /**
   * Generate a descriptive name for imported media
   */
  private generateMediaName(historyItem: GenerationHistoryItem): string {
    const type = historyItem.request.type;
    const promptPreview = historyItem.request.prompt.slice(0, 50);
    const timestamp = new Date().toLocaleDateString();
    return `AI ${type} - ${promptPreview}... (${timestamp})`;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };

    return mimeMap[mimeType] || '.bin';
  }

  /**
   * Load history from localStorage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
      this.history = [];
    }
  }

  /**
   * Save history to localStorage
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  }

  /**
   * Notify update callback
   */
  private notifyUpdate(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback([...this.history]);
    }
  }
}

// Export singleton getter
export const getHistoryService = () => GenerationHistoryService.getInstance();

export default GenerationHistoryService;
