import { useState, useEffect, useCallback } from 'react';
import type {
  GenerationQueueItem,
  ReplicateGenerationRequest,
  GenerationHistoryItem,
} from '../types/replicate';
import { getQueueManager } from '../services/generationQueueManager';
import { webSocketProgressService } from '../services/webSocketProgressService';
import { getHistoryService } from '../services/generationHistoryService';

/**
 * Custom hook for AI generation management
 */
export function useAIGeneration(projectId?: string) {
  const [queue, setQueue] = useState<GenerationQueueItem[]>([]);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize services
  useEffect(() => {
    const queueManager = getQueueManager({
      onUpdate: (updatedQueue) => {
        setQueue(updatedQueue);
        setIsGenerating(
          updatedQueue.some(
            (item) => item.status === 'processing' || item.status === 'pending'
          )
        );
      },
      onComplete: (item) => {
        // Add to history when completed
        const historyService = getHistoryService();
        historyService.addToHistory(item);
      },
      onError: (item, error) => {
        console.error('Generation error:', error);
      },
    });

    const historyService = getHistoryService();
    historyService.setOnUpdate((updatedHistory) => {
      setHistory(updatedHistory);
    });

    // Load initial state
    setQueue(queueManager.getQueue());
    setHistory(historyService.getHistory());

    // Setup WebSocket connection
    webSocketProgressService.connect();
    const unsubscribe = webSocketProgressService.onConnectionChange(setIsConnected);

    return () => {
      unsubscribe();
      webSocketProgressService.disconnect();
    };
  }, []);

  // Subscribe to WebSocket progress updates for active generations
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    queue.forEach((item) => {
      if (item.status === 'processing') {
        const unsubscribe = webSocketProgressService.subscribe(item.id, (event) => {
          const queueManager = getQueueManager();
          queueManager.updateStatus(
            event.generationId,
            event.status,
            event.outputUrl,
            event.error
          );
          if (event.progress !== undefined) {
            queueManager.updateProgress(
              event.generationId,
              event.progress,
              event.estimatedTimeRemaining
            );
          }
        });
        unsubscribers.push(unsubscribe);
      }
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [queue]);

  /**
   * Start a new generation
   */
  const generate = useCallback(
    async (request: ReplicateGenerationRequest, priority: number = 0) => {
      try {
        const queueManager = getQueueManager();
        const item = await queueManager.addToQueue(request, priority);
        return item;
      } catch (error) {
        console.error('Failed to start generation:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Cancel a generation
   */
  const cancelGeneration = useCallback(async (generationId: string) => {
    try {
      const queueManager = getQueueManager();
      await queueManager.cancelGeneration(generationId);
    } catch (error) {
      console.error('Failed to cancel generation:', error);
      throw error;
    }
  }, []);

  /**
   * Remove from queue
   */
  const removeFromQueue = useCallback((generationId: string) => {
    const queueManager = getQueueManager();
    queueManager.removeFromQueue(generationId);
  }, []);

  /**
   * Clear completed items from queue
   */
  const clearCompleted = useCallback(() => {
    const queueManager = getQueueManager();
    queueManager.clearCompleted();
  }, []);

  /**
   * Import generation to media library
   */
  const importToLibrary = useCallback(
    async (historyItem: GenerationHistoryItem) => {
      if (!projectId) {
        throw new Error('Project ID is required for import');
      }

      try {
        const historyService = getHistoryService();
        const mediaAsset = await historyService.autoImport(projectId, historyItem);
        return mediaAsset;
      } catch (error) {
        console.error('Failed to import to library:', error);
        throw error;
      }
    },
    [projectId]
  );

  /**
   * Delete history item
   */
  const deleteHistoryItem = useCallback((id: string) => {
    const historyService = getHistoryService();
    historyService.deleteHistoryItem(id);
  }, []);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    const historyService = getHistoryService();
    historyService.clearHistory();
  }, []);

  /**
   * Get filtered history
   */
  const getFilteredHistory = useCallback(
    (filter?: Parameters<typeof getHistoryService>[0]) => {
      const historyService = getHistoryService();
      return historyService.getHistory(filter as any);
    },
    []
  );

  /**
   * Get statistics
   */
  const getStatistics = useCallback(() => {
    const historyService = getHistoryService();
    return historyService.getStatistics();
  }, []);

  return {
    // State
    queue,
    history,
    isConnected,
    isGenerating,

    // Queue actions
    generate,
    cancelGeneration,
    removeFromQueue,
    clearCompleted,

    // History actions
    importToLibrary,
    deleteHistoryItem,
    clearHistory,
    getFilteredHistory,
    getStatistics,
  };
}

export default useAIGeneration;
