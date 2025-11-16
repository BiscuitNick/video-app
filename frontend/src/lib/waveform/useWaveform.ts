/**
 * useWaveform Hook
 *
 * React hook for loading and managing waveform data in components.
 * Handles loading state, caching, and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  WaveformData,
  WaveformGenerationOptions,
  WaveformLoadOptions,
} from './types';
import { getWaveformGenerator } from '@/services/waveform/WaveformGenerator';
import { DEFAULT_GENERATION_OPTIONS } from './constants';

interface UseWaveformOptions extends WaveformGenerationOptions {
  /** Load options */
  loadOptions?: WaveformLoadOptions;
  /** Auto-load on mount */
  autoLoad?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

interface UseWaveformResult {
  /** Waveform data */
  waveformData: WaveformData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Load/reload waveform */
  loadWaveform: () => Promise<void>;
  /** Generation progress (0-1) */
  progress: number;
  /** Clear waveform */
  clear: () => void;
}

/**
 * Hook for loading and managing waveform data
 */
export function useWaveform(
  assetId: string | null,
  audioUrl: string | null,
  options: UseWaveformOptions = {}
): UseWaveformResult {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const generatorRef = useRef(getWaveformGenerator());
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    loadOptions = {},
    autoLoad = true,
    debug = false,
    ...generationOptions
  } = options;

  /**
   * Load waveform data
   */
  const loadWaveform = useCallback(async () => {
    if (!assetId || !audioUrl) {
      if (debug) {
        console.warn('useWaveform: Missing assetId or audioUrl');
      }
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      if (debug) {
        console.log('useWaveform: Loading waveform', { assetId, audioUrl });
      }

      const mergedOptions: WaveformGenerationOptions = {
        ...DEFAULT_GENERATION_OPTIONS,
        ...generationOptions,
        onProgress: (p: number) => {
          setProgress(p);
          generationOptions.onProgress?.(p);
        },
      };

      const data = await generatorRef.current.loadWaveform(
        assetId,
        audioUrl,
        mergedOptions,
        {
          ...loadOptions,
          abortSignal: abortControllerRef.current.signal,
        }
      );

      if (debug) {
        console.log('useWaveform: Loaded waveform', {
          assetId,
          peaks: data.peaks.length,
          duration: data.duration,
        });
      }

      setWaveformData(data);
      setProgress(1);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('useWaveform: Failed to load waveform', err);
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [assetId, audioUrl, generationOptions, loadOptions, debug]);

  /**
   * Clear waveform data
   */
  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setWaveformData(null);
    setError(null);
    setProgress(0);
    setIsLoading(false);
  }, []);

  /**
   * Auto-load effect
   */
  useEffect(() => {
    if (autoLoad && assetId && audioUrl) {
      loadWaveform();
    }

    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [assetId, audioUrl, autoLoad, loadWaveform]);

  return {
    waveformData,
    isLoading,
    error,
    loadWaveform,
    progress,
    clear,
  };
}

/**
 * Hook for prefetching waveforms (doesn't store state)
 */
export function usePrefetchWaveforms() {
  const generatorRef = useRef(getWaveformGenerator());

  const prefetch = useCallback(
    async (
      assets: Array<{ id: string; url: string }>,
      options: WaveformGenerationOptions = {}
    ) => {
      await generatorRef.current.prefetchWaveforms(assets, {
        ...DEFAULT_GENERATION_OPTIONS,
        ...options,
      });
    },
    []
  );

  return { prefetch };
}

/**
 * Hook for waveform statistics
 */
export function useWaveformStats() {
  const [stats, setStats] = useState<{
    totalWaveforms: number;
    totalSizeBytes: number;
    cacheHitRate: number;
    averageGenerationTime: number;
  } | null>(null);

  const generatorRef = useRef(getWaveformGenerator());

  const refreshStats = useCallback(async () => {
    const data = await generatorRef.current.getStats();
    setStats(data);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return { stats, refreshStats };
}
