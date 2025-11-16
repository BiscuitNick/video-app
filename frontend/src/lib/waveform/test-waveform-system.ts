/**
 * Waveform System Performance Tests
 *
 * Tests for measuring and validating waveform generation performance.
 */

import { getWaveformGenerator } from '@/services/waveform/WaveformGenerator';
import { getWaveformCacheService } from '@/services/waveform/WaveformCacheService';
import { WaveformQuality } from './types';

interface TestResult {
  testName: string;
  duration: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Test waveform generation performance
 */
export async function testWaveformGeneration(
  audioUrl: string,
  assetId: string = 'test-asset'
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const generator = getWaveformGenerator();

  // Test 1: Low quality generation
  try {
    const startTime = performance.now();
    const waveform = await generator.loadWaveform(assetId, audioUrl, {
      quality: WaveformQuality.LOW,
      normalize: true,
    });
    const duration = performance.now() - startTime;

    results.push({
      testName: 'Low Quality Generation',
      duration,
      success: true,
      details: {
        peaks: waveform.peaks.length,
        duration: waveform.duration,
        channels: waveform.channels,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Low Quality Generation',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 2: Medium quality generation
  try {
    const startTime = performance.now();
    const waveform = await generator.loadWaveform(assetId, audioUrl, {
      quality: WaveformQuality.MEDIUM,
      normalize: true,
    });
    const duration = performance.now() - startTime;

    results.push({
      testName: 'Medium Quality Generation',
      duration,
      success: true,
      details: {
        peaks: waveform.peaks.length,
        duration: waveform.duration,
        channels: waveform.channels,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Medium Quality Generation',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 3: High quality generation
  try {
    const startTime = performance.now();
    const waveform = await generator.loadWaveform(assetId, audioUrl, {
      quality: WaveformQuality.HIGH,
      normalize: true,
    });
    const duration = performance.now() - startTime;

    results.push({
      testName: 'High Quality Generation',
      duration,
      success: true,
      details: {
        peaks: waveform.peaks.length,
        duration: waveform.duration,
        channels: waveform.channels,
      },
    });
  } catch (error) {
    results.push({
      testName: 'High Quality Generation',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * Test waveform caching
 */
export async function testWaveformCaching(
  audioUrl: string,
  assetId: string = 'test-asset-cache'
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const generator = getWaveformGenerator();
  const cache = getWaveformCacheService();

  // Clear cache first
  await cache.clear();

  // Test 1: First load (cache miss)
  try {
    const startTime = performance.now();
    await generator.loadWaveform(assetId, audioUrl, {
      quality: WaveformQuality.MEDIUM,
    });
    const duration = performance.now() - startTime;

    results.push({
      testName: 'Cache Miss (First Load)',
      duration,
      success: true,
      details: {
        cached: false,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Cache Miss (First Load)',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 2: Second load (cache hit)
  try {
    const startTime = performance.now();
    await generator.loadWaveform(assetId, audioUrl, {
      quality: WaveformQuality.MEDIUM,
    });
    const duration = performance.now() - startTime;

    results.push({
      testName: 'Cache Hit (Second Load)',
      duration,
      success: true,
      details: {
        cached: true,
        speedup: results[0] ? results[0].duration / duration : 0,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Cache Hit (Second Load)',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 3: Cache statistics
  try {
    const stats = await cache.getStats();
    results.push({
      testName: 'Cache Statistics',
      duration: 0,
      success: true,
      details: {
        totalWaveforms: stats.totalWaveforms,
        totalSize: stats.totalSizeBytes,
        hitRate: stats.cacheHitRate,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Cache Statistics',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * Test concurrent waveform generation
 */
export async function testConcurrentGeneration(
  audioUrls: string[],
  assetIdPrefix: string = 'test-concurrent'
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const generator = getWaveformGenerator();

  // Test: Generate multiple waveforms concurrently
  try {
    const startTime = performance.now();

    const promises = audioUrls.map((url, index) =>
      generator.loadWaveform(`${assetIdPrefix}-${index}`, url, {
        quality: WaveformQuality.MEDIUM,
      })
    );

    const waveforms = await Promise.all(promises);
    const duration = performance.now() - startTime;

    results.push({
      testName: 'Concurrent Generation',
      duration,
      success: true,
      details: {
        count: waveforms.length,
        averageTime: duration / waveforms.length,
      },
    });
  } catch (error) {
    results.push({
      testName: 'Concurrent Generation',
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * Run all performance tests
 */
export async function runAllWaveformTests(
  audioUrl: string,
  additionalUrls: string[] = []
): Promise<{
  results: TestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averageDuration: number;
  };
}> {
  console.log('Running waveform performance tests...');

  const allResults: TestResult[] = [];

  // Run generation tests
  console.log('Testing waveform generation...');
  const generationResults = await testWaveformGeneration(audioUrl);
  allResults.push(...generationResults);

  // Run caching tests
  console.log('Testing waveform caching...');
  const cachingResults = await testWaveformCaching(audioUrl);
  allResults.push(...cachingResults);

  // Run concurrent tests if additional URLs provided
  if (additionalUrls.length > 0) {
    console.log('Testing concurrent generation...');
    const concurrentResults = await testConcurrentGeneration([
      audioUrl,
      ...additionalUrls,
    ]);
    allResults.push(...concurrentResults);
  }

  // Calculate summary
  const passed = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success).length;
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);
  const averageDuration = totalDuration / allResults.length;

  const summary = {
    totalTests: allResults.length,
    passed,
    failed,
    averageDuration,
  };

  console.log('Test Summary:', summary);

  return {
    results: allResults,
    summary,
  };
}

/**
 * Print test results to console
 */
export function printTestResults(results: TestResult[]): void {
  console.group('Waveform Performance Test Results');

  results.forEach((result, index) => {
    const status = result.success ? '✓' : '✗';
    const color = result.success ? 'color: green' : 'color: red';

    console.group(`${index + 1}. ${status} ${result.testName}`);
    console.log(`%cStatus: ${result.success ? 'PASS' : 'FAIL'}`, color);

    if (result.duration > 0) {
      console.log(`Duration: ${result.duration.toFixed(2)}ms`);
    }

    if (result.error) {
      console.error('Error:', result.error);
    }

    if (result.details) {
      console.log('Details:', result.details);
    }

    console.groupEnd();
  });

  console.groupEnd();
}

/**
 * Benchmark waveform rendering
 */
export function benchmarkWaveformRendering(
  canvas: HTMLCanvasElement,
  peakCount: number = 4000
): TestResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      testName: 'Waveform Rendering Benchmark',
      duration: 0,
      success: false,
      error: 'Canvas context not available',
    };
  }

  // Generate test data
  const peaks = new Float32Array(peakCount);
  for (let i = 0; i < peakCount; i++) {
    peaks[i] = Math.random();
  }

  // Benchmark rendering
  const startTime = performance.now();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / peakCount;
    const centerY = canvas.height / 2;

    for (let j = 0; j < peakCount; j++) {
      const x = j * barWidth;
      const barHeight = peaks[j] * (canvas.height / 2);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
    }
  }

  const duration = performance.now() - startTime;
  const avgFrameTime = duration / iterations;
  const fps = 1000 / avgFrameTime;

  return {
    testName: 'Waveform Rendering Benchmark',
    duration,
    success: true,
    details: {
      iterations,
      peakCount,
      avgFrameTime: avgFrameTime.toFixed(2),
      fps: fps.toFixed(2),
    },
  };
}
