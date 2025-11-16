import { useEffect, useState, useCallback } from 'react';
import { getAutoSaveService, type SaveState, type AutoSaveOptions } from '@/services/autoSaveService';

/**
 * Hook to use auto-save service in React components
 */
export const useAutoSave = (options?: Partial<AutoSaveOptions>) => {
  const [saveState, setSaveState] = useState<SaveState>({
    status: 'idle',
    lastSaveTime: null,
    nextSaveTime: null,
    error: null,
    retryCount: 0,
    progress: 0,
  });

  useEffect(() => {
    const autoSaveService = getAutoSaveService(options);

    // Subscribe to save state changes
    const unsubscribe = autoSaveService.subscribe((state) => {
      setSaveState(state);
    });

    // Initialize the service
    autoSaveService.initialize();

    return () => {
      unsubscribe();
    };
  }, []);

  const saveImmediately = useCallback(() => {
    const autoSaveService = getAutoSaveService();
    autoSaveService.saveImmediately();
  }, []);

  const forceSave = useCallback(async () => {
    const autoSaveService = getAutoSaveService();
    await autoSaveService.forceSave();
  }, []);

  const hasPendingChanges = useCallback(() => {
    const autoSaveService = getAutoSaveService();
    return autoSaveService.hasPendingChanges();
  }, []);

  return {
    saveState,
    saveImmediately,
    forceSave,
    hasPendingChanges,
  };
};

/**
 * Hook to display save status indicator
 */
export const useSaveStatusIndicator = () => {
  const { saveState } = useAutoSave();

  const getStatusText = useCallback(() => {
    switch (saveState.status) {
      case 'idle':
        return saveState.lastSaveTime
          ? `Saved ${formatTimeAgo(saveState.lastSaveTime)}`
          : 'Not saved';
      case 'pending':
        return 'Waiting to save...';
      case 'saving':
        return `Saving... ${saveState.progress}%`;
      case 'success':
        return 'Saved successfully';
      case 'error':
        return `Error: ${saveState.error}`;
      default:
        return '';
    }
  }, [saveState]);

  const getStatusColor = useCallback(() => {
    switch (saveState.status) {
      case 'idle':
        return saveState.lastSaveTime ? 'gray' : 'yellow';
      case 'pending':
        return 'blue';
      case 'saving':
        return 'blue';
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  }, [saveState]);

  return {
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    progress: saveState.progress,
    status: saveState.status,
  };
};

/**
 * Format time ago in human-readable format
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
