/**
 * Performance monitoring utilities for timeline operations
 */

export class PerformanceMonitor {
  private frameTimestamps: number[] = [];
  private maxSamples: number;

  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples;
  }

  /**
   * Record a frame timestamp
   */
  recordFrame() {
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only the last N samples
    if (this.frameTimestamps.length > this.maxSamples) {
      this.frameTimestamps.shift();
    }
  }

  /**
   * Calculate average FPS
   */
  getAverageFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const first = this.frameTimestamps[0];
    const last = this.frameTimestamps[this.frameTimestamps.length - 1];
    const duration = last - first;
    const frames = this.frameTimestamps.length - 1;

    return (frames / duration) * 1000;
  }

  /**
   * Get FPS statistics
   */
  getStats(): {
    average: number;
    min: number;
    max: number;
    samples: number;
  } {
    if (this.frameTimestamps.length < 2) {
      return { average: 0, min: 0, max: 0, samples: 0 };
    }

    const frameTimes: number[] = [];
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      const frameTime = this.frameTimestamps[i] - this.frameTimestamps[i - 1];
      frameTimes.push(1000 / frameTime); // Convert to FPS
    }

    const average = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const min = Math.min(...frameTimes);
    const max = Math.max(...frameTimes);

    return {
      average,
      min,
      max,
      samples: frameTimes.length,
    };
  }

  /**
   * Reset the monitor
   */
  reset() {
    this.frameTimestamps = [];
  }
}

/**
 * Measure the execution time of a function
 */
export async function measureTime<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;

  const durationStr = duration.toFixed(2);
  console.log('[Performance] ' + name + ': ' + durationStr + 'ms');

  return { result, duration };
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a throttled function using requestAnimationFrame
 */
export function throttleRAF<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
        }
        rafId = null;
        lastArgs = null;
      });
    }
  };
}
