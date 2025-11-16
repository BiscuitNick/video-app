/**
 * Subtask 20.6: Retry Logic and Progressive Loading
 *
 * Provides retry logic with exponential backoff, quality level selection
 * based on display size, bandwidth-aware loading strategies, and fallback
 * placeholder system.
 */

import {
  ThumbnailQuality,
  RetryConfig,
  BandwidthMetrics,
  LoadOptions,
} from './types';
import {
  DEFAULT_RETRY_CONFIG,
  BANDWIDTH_THRESHOLDS,
  QUALITY_CONFIGS,
} from './constants';

export class RetryManager {
  private config: RetryConfig;
  private retryAttempts = new Map<string, number>();
  private bandwidthMetrics: BandwidthMetrics = {
    estimatedBandwidth: BANDWIDTH_THRESHOLDS.MEDIUM,
    lastUpdated: Date.now(),
    sampleCount: 0,
  };
  private loadTimings: Array<{ size: number; duration: number }> = [];
  private maxTimingSamples = 10;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    const attempts = this.retryAttempts.get(key) || 0;

    try {
      // Check if aborted
      if (options?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const result = await fn();
      this.retryAttempts.delete(key);
      return result;
    } catch (error) {
      if (options?.signal?.aborted || (error as Error).name === 'AbortError') {
        throw error;
      }

      if (attempts >= this.config.maxRetries) {
        this.retryAttempts.delete(key);
        throw new Error(
          `Max retries (${this.config.maxRetries}) exceeded for ${key}: ${(error as Error).message}`
        );
      }

      const nextAttempt = attempts + 1;
      this.retryAttempts.set(key, nextAttempt);

      const delay = this.calculateBackoffDelay(nextAttempt);
      console.log(
        `Retrying ${key} (attempt ${nextAttempt}/${this.config.maxRetries}) after ${delay}ms`
      );

      await this.sleep(delay);
      return this.executeWithRetry(key, fn, options);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelayMs
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Select optimal quality based on display size and bandwidth
   */
  selectQuality(
    displayWidth: number,
    displayHeight: number,
    options?: LoadOptions
  ): ThumbnailQuality {
    // If quality is explicitly requested, use it
    if (options?.quality) {
      return options.quality;
    }

    // Determine quality based on bandwidth
    const bandwidthQuality = this.getQualityForBandwidth();

    // Determine quality based on display size
    const displayQuality = this.getQualityForDisplaySize(
      displayWidth,
      displayHeight
    );

    // Return the lower quality (more conservative)
    return this.compareQuality(bandwidthQuality, displayQuality) <= 0
      ? bandwidthQuality
      : displayQuality;
  }

  /**
   * Get quality based on current bandwidth
   */
  private getQualityForBandwidth(): ThumbnailQuality {
    const bandwidth = this.bandwidthMetrics.estimatedBandwidth;

    if (bandwidth < BANDWIDTH_THRESHOLDS.SLOW) {
      return ThumbnailQuality.LOW;
    } else if (bandwidth < BANDWIDTH_THRESHOLDS.MEDIUM) {
      return ThumbnailQuality.MEDIUM;
    } else {
      return ThumbnailQuality.HIGH;
    }
  }

  /**
   * Get quality based on display size
   */
  private getQualityForDisplaySize(
    width: number,
    height: number
  ): ThumbnailQuality {
    // Check against quality configs
    const lowConfig = QUALITY_CONFIGS[ThumbnailQuality.LOW];
    const mediumConfig = QUALITY_CONFIGS[ThumbnailQuality.MEDIUM];

    if (width <= lowConfig.maxWidth && height <= lowConfig.maxHeight) {
      return ThumbnailQuality.LOW;
    } else if (
      width <= mediumConfig.maxWidth &&
      height <= mediumConfig.maxHeight
    ) {
      return ThumbnailQuality.MEDIUM;
    } else {
      return ThumbnailQuality.HIGH;
    }
  }

  /**
   * Compare two quality levels
   */
  private compareQuality(a: ThumbnailQuality, b: ThumbnailQuality): number {
    const order = {
      [ThumbnailQuality.LOW]: 0,
      [ThumbnailQuality.MEDIUM]: 1,
      [ThumbnailQuality.HIGH]: 2,
    };
    return order[a] - order[b];
  }

  /**
   * Update bandwidth metrics based on a load timing
   */
  updateBandwidth(sizeBytes: number, durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }

    // Calculate bandwidth in bytes per second
    const bandwidth = (sizeBytes / durationMs) * 1000;

    // Add to timing samples
    this.loadTimings.push({ size: sizeBytes, duration: durationMs });
    if (this.loadTimings.length > this.maxTimingSamples) {
      this.loadTimings.shift();
    }

    // Calculate moving average
    const totalSize = this.loadTimings.reduce((sum, t) => sum + t.size, 0);
    const totalDuration = this.loadTimings.reduce((sum, t) => sum + t.duration, 0);
    const averageBandwidth = (totalSize / totalDuration) * 1000;

    // Update metrics with smoothing
    const smoothingFactor = 0.3;
    this.bandwidthMetrics.estimatedBandwidth =
      this.bandwidthMetrics.estimatedBandwidth * (1 - smoothingFactor) +
      averageBandwidth * smoothingFactor;

    this.bandwidthMetrics.lastUpdated = Date.now();
    this.bandwidthMetrics.sampleCount++;
  }

  /**
   * Get current bandwidth estimate
   */
  getBandwidthEstimate(): BandwidthMetrics {
    return { ...this.bandwidthMetrics };
  }

  /**
   * Get network speed category
   */
  getNetworkSpeed(): 'slow' | 'medium' | 'fast' {
    const bandwidth = this.bandwidthMetrics.estimatedBandwidth;

    if (bandwidth < BANDWIDTH_THRESHOLDS.SLOW) {
      return 'slow';
    } else if (bandwidth < BANDWIDTH_THRESHOLDS.FAST) {
      return 'medium';
    } else {
      return 'fast';
    }
  }

  /**
   * Determine if we should use progressive loading
   */
  shouldUseProgressiveLoading(): boolean {
    const networkSpeed = this.getNetworkSpeed();
    return networkSpeed === 'slow' || networkSpeed === 'medium';
  }

  /**
   * Get progressive loading strategy (quality sequence)
   */
  getProgressiveLoadingSequence(
    targetQuality: ThumbnailQuality
  ): ThumbnailQuality[] {
    const sequence: ThumbnailQuality[] = [];

    // Always start with low quality for progressive loading
    sequence.push(ThumbnailQuality.LOW);

    // Add medium if target is medium or high
    if (
      targetQuality === ThumbnailQuality.MEDIUM ||
      targetQuality === ThumbnailQuality.HIGH
    ) {
      sequence.push(ThumbnailQuality.MEDIUM);
    }

    // Add high if target is high
    if (targetQuality === ThumbnailQuality.HIGH) {
      sequence.push(ThumbnailQuality.HIGH);
    }

    return sequence;
  }

  /**
   * Get suggested concurrent load count based on bandwidth
   */
  getSuggestedConcurrency(): number {
    const networkSpeed = this.getNetworkSpeed();

    switch (networkSpeed) {
      case 'slow':
        return 2;
      case 'medium':
        return 4;
      case 'fast':
        return 8;
      default:
        return 4;
    }
  }

  /**
   * Clear retry attempts for a key
   */
  clearRetries(key: string): void {
    this.retryAttempts.delete(key);
  }

  /**
   * Clear all retry attempts
   */
  clearAllRetries(): void {
    this.retryAttempts.clear();
  }

  /**
   * Get retry count for a key
   */
  getRetryCount(key: string): number {
    return this.retryAttempts.get(key) || 0;
  }

  /**
   * Reset bandwidth metrics
   */
  resetBandwidthMetrics(): void {
    this.bandwidthMetrics = {
      estimatedBandwidth: BANDWIDTH_THRESHOLDS.MEDIUM,
      lastUpdated: Date.now(),
      sampleCount: 0,
    };
    this.loadTimings = [];
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

/**
 * Fallback Placeholder Generator
 */
export class FallbackPlaceholderGenerator {
  /**
   * Generate a solid color placeholder
   */
  static generateSolidColor(
    width: number,
    height: number,
    color: string = '#e0e0e0'
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate a gradient placeholder
   */
  static generateGradient(
    width: number,
    height: number,
    color1: string = '#e0e0e0',
    color2: string = '#f5f5f5'
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate a placeholder with text
   */
  static generateWithText(
    width: number,
    height: number,
    text: string = 'Loading...',
    bgColor: string = '#e0e0e0',
    textColor: string = '#666'
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Text
    const fontSize = Math.min(width, height) / 10;
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate an SVG placeholder
   */
  static generateSVGPlaceholder(
    width: number,
    height: number,
    iconPath?: string
  ): string {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#e0e0e0"/>
        ${iconPath ? `<path d="${iconPath}" fill="#999"/>` : ''}
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
}

// Singleton instance
let retryManagerInstance: RetryManager | null = null;

export function getRetryManager(): RetryManager {
  if (!retryManagerInstance) {
    retryManagerInstance = new RetryManager();
  }
  return retryManagerInstance;
}
