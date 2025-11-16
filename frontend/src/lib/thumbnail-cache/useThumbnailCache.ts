/**
 * React Hook for Thumbnail Cache System
 *
 * Provides an easy-to-use React hook interface for the thumbnail cache system.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getThumbnailCacheSystem } from './index';
import { ThumbnailQuality, LoadOptions } from './types';

export interface UseThumbnailCacheOptions extends LoadOptions {
  videoId: string;
  videoUrl: string;
  timestamp: number;
  width: number;
  height: number;
  enabled?: boolean;
}

export interface UseThumbnailCacheResult {
  thumbnailUrl: string | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook for loading thumbnails with caching and lazy loading
 */
export function useThumbnailCache(
  options: UseThumbnailCacheOptions
): UseThumbnailCacheResult {
  const {
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    enabled = true,
    ...loadOptions
  } = options;

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const cacheSystemRef = useRef(getThumbnailCacheSystem());
  const cleanupRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create a temporary element for observation
    const tempElement = document.createElement('div');
    document.body.appendChild(tempElement);

    const cleanup = cacheSystemRef.current.observeElement(
      tempElement,
      videoId,
      videoUrl,
      timestamp,
      width,
      height,
      (dataUrl) => {
        if (dataUrl) {
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
        } else {
          setError(new Error('Failed to load thumbnail'));
          setIsLoading(false);
        }
      },
      loadOptions
    );

    // Store cleanup function
    cleanupRef.current = () => {
      cleanup();
      document.body.removeChild(tempElement);
    };

    return cleanupRef.current;
  }, [
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    enabled,
    loadOptions.quality,
    loadOptions.priority,
    loadOptions.forceReload,
  ]);

  useEffect(() => {
    const cleanup = load();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [load]);

  const reload = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    load();
  }, [load]);

  return {
    thumbnailUrl,
    isLoading,
    error,
    reload,
  };
}

/**
 * Hook for lazy-loaded thumbnail with intersection observer
 */
export function useLazyThumbnail(
  elementRef: React.RefObject<HTMLElement>,
  options: UseThumbnailCacheOptions
): UseThumbnailCacheResult {
  const {
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    enabled = true,
    ...loadOptions
  } = options;

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheSystemRef = useRef(getThumbnailCacheSystem());

  useEffect(() => {
    if (!enabled || !elementRef.current) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const cleanup = cacheSystemRef.current.observeElement(
      elementRef.current,
      videoId,
      videoUrl,
      timestamp,
      width,
      height,
      (dataUrl) => {
        if (dataUrl) {
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
        } else {
          setError(new Error('Failed to load thumbnail'));
          setIsLoading(false);
        }
      },
      loadOptions
    );

    return cleanup;
  }, [
    elementRef,
    videoId,
    videoUrl,
    timestamp,
    width,
    height,
    enabled,
    loadOptions.quality,
    loadOptions.priority,
    loadOptions.forceReload,
  ]);

  const reload = useCallback(() => {
    if (elementRef.current) {
      setThumbnailUrl(null);
      setIsLoading(true);
      setError(null);
    }
  }, [elementRef]);

  return {
    thumbnailUrl,
    isLoading,
    error,
    reload,
  };
}

/**
 * Hook for accessing cache statistics
 */
export function useCacheStats(updateInterval: number = 2000) {
  const [stats, setStats] = useState<any>(null);
  const cacheSystemRef = useRef(getThumbnailCacheSystem());

  useEffect(() => {
    const loadStats = async () => {
      const stats = await cacheSystemRef.current.getStats();
      setStats(stats);
    };

    loadStats();
    const interval = setInterval(loadStats, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return stats;
}

/**
 * Hook for cache management operations
 */
export function useCacheManagement() {
  const cacheSystemRef = useRef(getThumbnailCacheSystem());

  const clearCache = useCallback(async () => {
    await cacheSystemRef.current.clearCache();
  }, []);

  const setMaxCacheSize = useCallback(async (sizeBytes: number) => {
    await cacheSystemRef.current.setMaxCacheSize(sizeBytes);
  }, []);

  const getCurrentCacheSize = useCallback(() => {
    return cacheSystemRef.current.getCurrentCacheSize();
  }, []);

  const getStats = useCallback(async () => {
    return await cacheSystemRef.current.getStats();
  }, []);

  return {
    clearCache,
    setMaxCacheSize,
    getCurrentCacheSize,
    getStats,
  };
}
