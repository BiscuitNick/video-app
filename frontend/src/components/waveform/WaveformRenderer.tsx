/**
 * Waveform Renderer Component
 *
 * Canvas-based component for rendering audio waveforms with:
 * - Color-coded volume levels
 * - Zoom support
 * - Trim indicators
 * - Playhead position
 * - Progressive rendering for long audio
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { WaveformData, WaveformRenderOptions } from '@/lib/waveform/types';
import {
  DEFAULT_COLOR_SCHEME,
  VOLUME_THRESHOLDS,
  PLAYHEAD_WIDTH,
  TRIM_INDICATOR_WIDTH,
  PROGRESSIVE_RENDER_CHUNK_SIZE,
  PROGRESSIVE_RENDER_DELAY,
} from '@/lib/waveform/constants';

interface WaveformRendererProps {
  /** Waveform data to render */
  waveformData: WaveformData | null;
  /** Render options */
  options: WaveformRenderOptions;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

export const WaveformRenderer: React.FC<WaveformRendererProps> = ({
  waveformData,
  options,
  className = '',
  isLoading = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const progressiveRenderRef = useRef<{
    offset: number;
    isRendering: boolean;
  }>({ offset: 0, isRendering: false });

  /**
   * Get color for amplitude value
   */
  const getColorForAmplitude = useCallback(
    (amplitude: number): string => {
      const colorScheme = options.colorScheme || DEFAULT_COLOR_SCHEME;

      if (amplitude >= VOLUME_THRESHOLDS.PEAK) {
        return colorScheme.peak;
      } else if (amplitude >= VOLUME_THRESHOLDS.LOUD) {
        return colorScheme.loud;
      } else if (amplitude >= VOLUME_THRESHOLDS.MEDIUM) {
        return colorScheme.medium;
      } else {
        return colorScheme.quiet;
      }
    },
    [options.colorScheme]
  );

  /**
   * Render waveform on canvas
   */
  const renderWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = options;
    const { peaks, rms, duration } = waveformData;

    // Set canvas size (accounting for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    const colorScheme = options.colorScheme || DEFAULT_COLOR_SCHEME;
    ctx.fillStyle = colorScheme.background;
    ctx.fillRect(0, 0, width, height);

    // Calculate visible range
    const zoom = options.zoom || 1;
    const startTime = options.startTime || 0;
    const endTime = options.endTime || duration;
    const visibleDuration = (endTime - startTime) / zoom;

    // Calculate sample range
    const samplesPerSecond = peaks.length / duration;
    const startSample = Math.floor(startTime * samplesPerSecond);
    const endSample = Math.min(
      Math.ceil((startTime + visibleDuration) * samplesPerSecond),
      peaks.length
    );
    const visibleSamples = endSample - startSample;

    // Calculate bar width
    const barWidth = Math.max(1, width / visibleSamples);
    const barSpacing = barWidth > 2 ? 0.5 : 0;

    // Center line
    const centerY = height / 2;

    // Volume envelope
    const volumeEnvelope = options.volumeEnvelope || 1;

    // Render peaks
    for (let i = 0; i < visibleSamples; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex >= peaks.length) break;

      const peak = peaks[sampleIndex] * volumeEnvelope;
      const rmsValue = options.showRMS ? rms[sampleIndex] * volumeEnvelope : 0;

      const x = i * barWidth;
      const barHeight = peak * (height / 2);

      // Determine if this sample is in a trimmed region
      const sampleTime = sampleIndex / samplesPerSecond;
      const isTrimmed =
        (options.trimStart && sampleTime < options.trimStart) ||
        (options.trimEnd && sampleTime > duration - options.trimEnd);

      // Get color
      const color = isTrimmed
        ? colorScheme.trimmed
        : getColorForAmplitude(peak);

      // Draw peak
      ctx.fillStyle = color;
      ctx.fillRect(
        x,
        centerY - barHeight,
        barWidth - barSpacing,
        barHeight * 2
      );

      // Draw RMS overlay if enabled
      if (options.showRMS && !isTrimmed) {
        const rmsHeight = rmsValue * (height / 2);
        ctx.fillStyle = colorScheme.rms || colorScheme.medium;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(
          x,
          centerY - rmsHeight,
          barWidth - barSpacing,
          rmsHeight * 2
        );
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw playhead if specified
    if (options.playheadPosition !== undefined) {
      const playheadTime = options.playheadPosition - startTime;
      if (playheadTime >= 0 && playheadTime <= visibleDuration) {
        const playheadX = (playheadTime / visibleDuration) * width;
        ctx.fillStyle = colorScheme.playhead;
        ctx.fillRect(playheadX - PLAYHEAD_WIDTH / 2, 0, PLAYHEAD_WIDTH, height);
      }
    }

    // Draw trim indicators
    if (options.trimStart && options.trimStart > 0) {
      const trimStartTime = options.trimStart - startTime;
      if (trimStartTime >= 0 && trimStartTime <= visibleDuration) {
        const trimX = (trimStartTime / visibleDuration) * width;
        ctx.fillStyle = colorScheme.peak;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(0, 0, trimX, height);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = colorScheme.peak;
        ctx.fillRect(trimX, 0, TRIM_INDICATOR_WIDTH, height);
      }
    }

    if (options.trimEnd && options.trimEnd > 0) {
      const trimEndTime = duration - options.trimEnd - startTime;
      if (trimEndTime >= 0 && trimEndTime <= visibleDuration) {
        const trimX = (trimEndTime / visibleDuration) * width;
        ctx.fillStyle = colorScheme.peak;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(trimX, 0, width - trimX, height);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = colorScheme.peak;
        ctx.fillRect(trimX - TRIM_INDICATOR_WIDTH, 0, TRIM_INDICATOR_WIDTH, height);
      }
    }
  }, [waveformData, options, getColorForAmplitude]);

  /**
   * Render waveform progressively (for long audio)
   */
  const renderWaveformProgressive = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { peaks } = waveformData;

    // Check if we should use progressive rendering
    if (peaks.length < PROGRESSIVE_RENDER_CHUNK_SIZE * 2) {
      // Small enough to render at once
      renderWaveform();
      return;
    }

    // Progressive rendering
    if (progressiveRenderRef.current.isRendering) return;

    progressiveRenderRef.current.isRendering = true;
    progressiveRenderRef.current.offset = 0;

    const renderChunk = () => {
      const { offset } = progressiveRenderRef.current;

      if (offset >= peaks.length) {
        // Rendering complete
        progressiveRenderRef.current.isRendering = false;
        return;
      }

      // Render chunk
      // Note: This is a simplified approach. In production, you'd want to
      // render chunks of the canvas rather than the entire waveform
      renderWaveform();

      progressiveRenderRef.current.offset += PROGRESSIVE_RENDER_CHUNK_SIZE;

      // Schedule next chunk
      animationFrameRef.current = window.setTimeout(
        renderChunk,
        PROGRESSIVE_RENDER_DELAY
      );
    };

    renderChunk();
  }, [waveformData, renderWaveform]);

  /**
   * Effect: Render waveform when data or options change
   */
  useEffect(() => {
    if (!waveformData) return;

    // Cancel any ongoing progressive render
    if (animationFrameRef.current !== null) {
      clearTimeout(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Render waveform
    renderWaveformProgressive();

    return () => {
      if (animationFrameRef.current !== null) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [waveformData, renderWaveformProgressive]);

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800/50 ${className}`}
        style={{ width: options.width, height: options.height }}
      >
        <div className="text-xs text-gray-400">Generating waveform...</div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!waveformData) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800/50 ${className}`}
        style={{ width: options.width, height: options.height }}
      >
        <div className="text-xs text-gray-400">No waveform data</div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: options.width,
        height: options.height,
        display: 'block',
      }}
    />
  );
};
