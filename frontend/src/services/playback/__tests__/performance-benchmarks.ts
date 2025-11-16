/**
 * Performance benchmarks for video switching and playback
 * Run these in a browser with actual video files
 */

import { VideoElementManager } from '../VideoElementManager';
import { PlaybackEngine } from '../PlaybackEngine';
import { TransformController } from '../TransformController';
import type { Clip, MediaAsset, Track } from '@/types';

interface BenchmarkResult {
  name: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  samples: number;
  fps?: number;
}

/**
 * Benchmark 1: Video Source Switching Latency
 */
export async function benchmarkVideoSwitching(
  videoManager: VideoElementManager,
  clips: Clip[],
  assets: MediaAsset[]
): Promise<BenchmarkResult> {
  console.log('\n=== Benchmark 1: Video Source Switching ===\n');

  videoManager.setMediaAssets(assets);

  const times: number[] = [];
  const numSwitches = Math.min(10, clips.length - 1);

  for (let i = 0; i < numSwitches; i++) {
    const nextClip = clips[i + 1];

    if (!nextClip) break;

    const startTime = performance.now();

    await videoManager.updateActiveClip(
      {
        clip: nextClip,
        track: { id: 'track1', type: 'video' } as Track,
        localFrame: 0,
      },
      nextClip.startTime
    );

    const endTime = performance.now();
    const switchTime = endTime - startTime;
    times.push(switchTime);

    console.log(`Switch ${i + 1}: ${switchTime.toFixed(2)}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const result: BenchmarkResult = {
    name: 'Video Source Switching',
    avgTime,
    minTime,
    maxTime,
    samples: times.length,
  };

  console.log('\nResults:');
  console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min: ${minTime.toFixed(2)}ms`);
  console.log(`  Max: ${maxTime.toFixed(2)}ms`);
  console.log(`  Samples: ${times.length}`);

  return result;
}

/**
 * Benchmark 2: Frame Update Rate
 */
export async function benchmarkFrameUpdateRate(
  _engine: PlaybackEngine,
  durationSeconds: number = 5
): Promise<BenchmarkResult> {
  console.log('\n=== Benchmark 2: Frame Update Rate ===\n');

  return new Promise((resolve) => {
    let frameCount = 0;
    let lastTime = performance.now();
    const frameTimes: number[] = [];

    const onFrameUpdate = () => {
      const now = performance.now();
      const frameTime = now - lastTime;
      frameTimes.push(frameTime);
      lastTime = now;
      frameCount++;
    };

    const testEngine = new PlaybackEngine({
      timebase_fps: 60,
      onFrameUpdate,
    });

    testEngine.play();

    setTimeout(() => {
      testEngine.pause();

      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / avgFrameTime;

      const result: BenchmarkResult = {
        name: 'Frame Update Rate',
        avgTime: avgFrameTime,
        minTime: Math.min(...frameTimes),
        maxTime: Math.max(...frameTimes),
        samples: frameCount,
        fps,
      };

      console.log('\nResults:');
      console.log(`  Average frame time: ${avgFrameTime.toFixed(2)}ms`);
      console.log(`  FPS: ${fps.toFixed(2)}`);
      console.log(`  Total frames: ${frameCount}`);
      console.log(`  Min frame time: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max frame time: ${result.maxTime.toFixed(2)}ms`);

      resolve(result);
    }, durationSeconds * 1000);
  });
}

/**
 * Benchmark 3: Transform Application Performance
 */
export function benchmarkTransformApplication(
  controller: TransformController,
  clip: Clip,
  iterations: number = 1000
): BenchmarkResult {
  console.log('\n=== Benchmark 3: Transform Application ===\n');

  // Set up complex keyframes
  controller.setKeyframes(clip.id, [
    { frame: 0, time: 0, opacity: 0, scale: 0.5, rotation: 0, easing: 'easeInOut' },
    { frame: 30, time: 1, opacity: 1, scale: 1.0, rotation: 45 },
    { frame: 60, time: 2, opacity: 0.5, scale: 1.5, rotation: 90 },
  ]);

  const element = document.createElement('div');
  const times: number[] = [];

  // Warm up
  for (let i = 0; i < 10; i++) {
    controller.applyTransformImmediate(element, clip, i % 60);
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const frame = (i % 60);
    const startTime = performance.now();

    controller.applyTransformImmediate(element, clip, frame);

    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const result: BenchmarkResult = {
    name: 'Transform Application',
    avgTime,
    minTime,
    maxTime,
    samples: times.length,
  };

  console.log('\nResults:');
  console.log(`  Average: ${avgTime.toFixed(4)}ms`);
  console.log(`  Min: ${minTime.toFixed(4)}ms`);
  console.log(`  Max: ${maxTime.toFixed(4)}ms`);
  console.log(`  Iterations: ${times.length}`);

  return result;
}

/**
 * Benchmark 4: Clip Scheduling Performance
 */
export function benchmarkClipScheduling(
  engine: PlaybackEngine,
  tracks: Track[],
  iterations: number = 1000
): BenchmarkResult {
  console.log('\n=== Benchmark 4: Clip Scheduling Performance ===\n');

  engine.setTracks(tracks);

  const times: number[] = [];
  const totalDuration = Math.max(...tracks.flatMap(t => t.clips.map(c => c.endTime)));

  for (let i = 0; i < iterations; i++) {
    const time = (i / iterations) * totalDuration;

    const startTime = performance.now();
    engine.seek(time);
    engine.getActiveClips();
    const endTime = performance.now();

    times.push(endTime - startTime);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const result: BenchmarkResult = {
    name: 'Clip Scheduling',
    avgTime,
    minTime,
    maxTime,
    samples: times.length,
  };

  console.log('\nResults:');
  console.log(`  Average: ${avgTime.toFixed(4)}ms`);
  console.log(`  Min: ${minTime.toFixed(4)}ms`);
  console.log(`  Max: ${maxTime.toFixed(4)}ms`);
  console.log(`  Iterations: ${times.length}`);

  return result;
}

/**
 * Benchmark 5: Memory Usage (Video Pool)
 */
export async function benchmarkMemoryUsage(
  videoManager: VideoElementManager,
  clips: Clip[],
  assets: MediaAsset[]
): Promise<void> {
  console.log('\n=== Benchmark 5: Memory Usage ===\n');

  // Check if performance.memory is available (Chrome only)
  const hasMemoryAPI = 'memory' in performance;

  if (!hasMemoryAPI) {
    console.log('⚠️  Performance.memory API not available in this browser');
    return;
  }

  const memory = (performance as any).memory;

  const initialHeap = memory.usedJSHeapSize / 1024 / 1024; // MB
  console.log(`Initial heap size: ${initialHeap.toFixed(2)} MB`);

  videoManager.setMediaAssets(assets);

  // Preload several clips
  const currentTime = clips[0]?.startTime || 0;
  await videoManager.preloadUpcomingClips(clips, currentTime);

  const afterPreloadHeap = memory.usedJSHeapSize / 1024 / 1024;
  console.log(`After preload heap size: ${afterPreloadHeap.toFixed(2)} MB`);
  console.log(`Delta: ${(afterPreloadHeap - initialHeap).toFixed(2)} MB`);

  // Cleanup
  videoManager.destroy();

  // Force garbage collection if available (requires --expose-gc flag)
  const globalAny = globalThis as any;
  if (globalAny.gc) {
    globalAny.gc();
    setTimeout(() => {
      const afterCleanupHeap = memory.usedJSHeapSize / 1024 / 1024;
      console.log(`After cleanup heap size: ${afterCleanupHeap.toFixed(2)} MB`);
      console.log(`Recovered: ${(afterPreloadHeap - afterCleanupHeap).toFixed(2)} MB`);
    }, 100);
  }
}

/**
 * Run all benchmarks
 */
export async function runAllBenchmarks(
  videoManager: VideoElementManager,
  engine: PlaybackEngine,
  transformController: TransformController,
  clips: Clip[],
  tracks: Track[],
  assets: MediaAsset[]
): Promise<BenchmarkResult[]> {
  console.log('\n' + '='.repeat(60));
  console.log('  PLAYBACK PERFORMANCE BENCHMARKS');
  console.log('='.repeat(60));

  const results: BenchmarkResult[] = [];

  try {
    // Benchmark 1: Video switching
    const switchingResult = await benchmarkVideoSwitching(videoManager, clips, assets);
    results.push(switchingResult);

    // Benchmark 2: Frame update rate
    const frameRateResult = await benchmarkFrameUpdateRate(engine, 3);
    results.push(frameRateResult);

    // Benchmark 3: Transform application
    const transformResult = benchmarkTransformApplication(transformController, clips[0]);
    results.push(transformResult);

    // Benchmark 4: Clip scheduling
    const schedulingResult = benchmarkClipScheduling(engine, tracks);
    results.push(schedulingResult);

    // Benchmark 5: Memory usage
    await benchmarkMemoryUsage(videoManager, clips, assets);

    console.log('\n' + '='.repeat(60));
    console.log('  BENCHMARK SUMMARY');
    console.log('='.repeat(60));

    results.forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(`  Avg: ${result.avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
      if (result.fps) {
        console.log(`  FPS: ${result.fps.toFixed(2)}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ ALL BENCHMARKS COMPLETE');
    console.log('='.repeat(60) + '\n');

    return results;
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    throw error;
  }
}

// Export for browser console use
if (typeof window !== 'undefined') {
  (window as any).playbackBenchmarks = {
    runAllBenchmarks,
    benchmarkVideoSwitching,
    benchmarkFrameUpdateRate,
    benchmarkTransformApplication,
    benchmarkClipScheduling,
    benchmarkMemoryUsage,
  };
}
