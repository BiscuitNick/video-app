/**
 * Manual tests for PlaybackEngine frame calculations and performance
 * Run these in a browser console or with ts-node
 */

import { PlaybackEngine } from '../PlaybackEngine';
import { TransformController } from '../TransformController';
import type { Track, Clip } from '@/types';

// Test utilities
const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
};

const assertApprox = (actual: number, expected: number, tolerance: number, message: string) => {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.error(`❌ FAILED: ${message} (${actual} vs ${expected}, diff: ${diff})`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
};

/**
 * Test 1: Frame/Time Conversion Accuracy
 */
export function testFrameTimeConversions() {
  console.log('\n=== Test 1: Frame/Time Conversion Accuracy ===\n');

  // Test at 24 FPS
  const engine24 = new PlaybackEngine({ timebase_fps: 24 });

  assert(engine24.timeToFrame(1.0) === 24, 'timeToFrame at 24fps: 1.0s = 24 frames');
  assert(engine24.timeToFrame(2.0) === 48, 'timeToFrame at 24fps: 2.0s = 48 frames');
  assert(engine24.timeToFrame(0.5) === 12, 'timeToFrame at 24fps: 0.5s = 12 frames');

  assertApprox(engine24.frameToTime(24), 1.0, 0.001, 'frameToTime at 24fps: 24 frames = 1.0s');
  assertApprox(engine24.frameToTime(48), 2.0, 0.001, 'frameToTime at 24fps: 48 frames = 2.0s');
  assertApprox(engine24.frameToTime(12), 0.5, 0.001, 'frameToTime at 24fps: 12 frames = 0.5s');

  // Test at 30 FPS
  const engine30 = new PlaybackEngine({ timebase_fps: 30 });

  assert(engine30.timeToFrame(1.0) === 30, 'timeToFrame at 30fps: 1.0s = 30 frames');
  assert(engine30.timeToFrame(2.0) === 60, 'timeToFrame at 30fps: 2.0s = 60 frames');

  assertApprox(engine30.frameToTime(30), 1.0, 0.001, 'frameToTime at 30fps: 30 frames = 1.0s');
  assertApprox(engine30.frameToTime(60), 2.0, 0.001, 'frameToTime at 30fps: 60 frames = 2.0s');

  // Test at 60 FPS
  const engine60 = new PlaybackEngine({ timebase_fps: 60 });

  assert(engine60.timeToFrame(1.0) === 60, 'timeToFrame at 60fps: 1.0s = 60 frames');
  assert(engine60.timeToFrame(0.5) === 30, 'timeToFrame at 60fps: 0.5s = 30 frames');

  assertApprox(engine60.frameToTime(60), 1.0, 0.001, 'frameToTime at 60fps: 60 frames = 1.0s');
  assertApprox(engine60.frameToTime(30), 0.5, 0.001, 'frameToTime at 60fps: 30 frames = 0.5s');

  // Test round-trip conversion
  const time = 5.25;
  const frame24 = engine24.timeToFrame(time);
  const backToTime = engine24.frameToTime(frame24);
  assertApprox(backToTime, Math.floor(time * 24) / 24, 0.001, 'Round-trip conversion at 24fps');

  console.log('\n✅ All frame/time conversion tests passed!\n');
}

/**
 * Test 2: Clip Scheduling Accuracy
 */
export function testClipScheduling() {
  console.log('\n=== Test 2: Clip Scheduling Accuracy ===\n');

  const engine = new PlaybackEngine({ timebase_fps: 30 });

  // Create mock tracks and clips
  const track1: Track = {
    id: 'track1',
    name: 'Video Track 1',
    type: 'video',
    clips: [
      {
        id: 'clip1',
        trackId: 'track1',
        mediaAssetId: 'asset1',
        startTime: 0,
        endTime: 2.0,
        trimStart: 0,
        trimEnd: 2.0,
      },
      {
        id: 'clip2',
        trackId: 'track1',
        mediaAssetId: 'asset2',
        startTime: 2.0,
        endTime: 4.0,
        trimStart: 0,
        trimEnd: 2.0,
      },
    ],
    muted: false,
    locked: false,
    visible: true,
    height: 100,
  };

  engine.setTracks([track1]);

  // Test clip scheduling at different times
  engine.seek(0.5);
  let activeClips = engine.getActiveClips();
  assert(activeClips.length === 1, 'One active clip at t=0.5s');
  assert(activeClips[0].clip.id === 'clip1', 'Clip1 is active at t=0.5s');

  engine.seek(1.5);
  activeClips = engine.getActiveClips();
  assert(activeClips.length === 1, 'One active clip at t=1.5s');
  assert(activeClips[0].clip.id === 'clip1', 'Clip1 is active at t=1.5s');

  engine.seek(2.0);
  activeClips = engine.getActiveClips();
  assert(activeClips.length === 1, 'One active clip at t=2.0s (boundary)');
  assert(activeClips[0].clip.id === 'clip2', 'Clip2 is active at t=2.0s');

  engine.seek(3.0);
  activeClips = engine.getActiveClips();
  assert(activeClips.length === 1, 'One active clip at t=3.0s');
  assert(activeClips[0].clip.id === 'clip2', 'Clip2 is active at t=3.0s');

  engine.seek(4.0);
  activeClips = engine.getActiveClips();
  assert(activeClips.length === 0, 'No active clips at t=4.0s (after all clips)');

  console.log('\n✅ All clip scheduling tests passed!\n');
}

/**
 * Test 3: Transform Interpolation Accuracy
 */
export function testTransformInterpolation() {
  console.log('\n=== Test 3: Transform Interpolation Accuracy ===\n');

  const controller = new TransformController();

  // Create a mock clip
  const clip: Clip = {
    id: 'clip1',
    trackId: 'track1',
    mediaAssetId: 'asset1',
    startTime: 0,
    endTime: 2.0,
    trimStart: 0,
    trimEnd: 2.0,
  };

  // Set keyframes: opacity fade from 0 to 1 over 60 frames
  controller.setKeyframes('clip1', [
    { frame: 0, time: 0, opacity: 0, easing: 'linear' },
    { frame: 60, time: 2.0, opacity: 1 },
  ]);

  // Test interpolation at different frames
  const props0 = controller.calculateTransform(clip, 0);
  assertApprox(props0.opacity, 0, 0.001, 'Opacity at frame 0 = 0');

  const props30 = controller.calculateTransform(clip, 30);
  assertApprox(props30.opacity, 0.5, 0.001, 'Opacity at frame 30 = 0.5 (linear)');

  const props60 = controller.calculateTransform(clip, 60);
  assertApprox(props60.opacity, 1.0, 0.001, 'Opacity at frame 60 = 1.0');

  // Test scale interpolation
  controller.setKeyframes('clip1', [
    { frame: 0, time: 0, scale: 0.5, easing: 'linear' },
    { frame: 100, time: 0, scale: 1.5 },
  ]);

  const scaleProps0 = controller.calculateTransform(clip, 0);
  assertApprox(scaleProps0.scale, 0.5, 0.001, 'Scale at frame 0 = 0.5');

  const scaleProps50 = controller.calculateTransform(clip, 50);
  assertApprox(scaleProps50.scale, 1.0, 0.001, 'Scale at frame 50 = 1.0 (linear)');

  const scaleProps100 = controller.calculateTransform(clip, 100);
  assertApprox(scaleProps100.scale, 1.5, 0.001, 'Scale at frame 100 = 1.5');

  // Test CSS transform generation
  const result = controller.toCSSTransform(scaleProps50);
  assert(result.cssTransform.includes('scale3d'), 'CSS transform uses scale3d');
  assert(result.cssTransform.includes('translate3d'), 'CSS transform uses translate3d');

  console.log('\n✅ All transform interpolation tests passed!\n');
}

/**
 * Test 4: Playback Rate Performance
 */
export async function testPlaybackRate() {
  console.log('\n=== Test 4: Playback Rate Accuracy ===\n');

  return new Promise<void>((resolve) => {
    const engine = new PlaybackEngine({
      timebase_fps: 30,
      onFrameUpdate: () => {
        // Track frame updates
      },
    });

    const startTime = performance.now();

    engine.play();
    engine.setPlaybackRate(2.0); // 2x speed

    setTimeout(() => {
      engine.pause();
      const elapsed = (performance.now() - startTime) / 1000;
      const currentFrame = engine.getCurrentFrame();

      // At 2x speed and 30fps, we should have ~60 frames per second
      const expectedFrames = elapsed * 30 * 2.0;
      const tolerance = expectedFrames * 0.1; // 10% tolerance

      assertApprox(
        currentFrame,
        expectedFrames,
        tolerance,
        `Playback at 2x speed: ${currentFrame} frames in ${elapsed.toFixed(2)}s`
      );

      console.log('\n✅ Playback rate test passed!\n');
      resolve();
    }, 1000); // Run for 1 second
  });
}

/**
 * Test 5: Sub-frame Interpolation
 */
export function testSubFrameInterpolation() {
  console.log('\n=== Test 5: Sub-frame Interpolation ===\n');

  const engine = new PlaybackEngine({ timebase_fps: 30 });

  engine.seekToFrame(10);
  const exactFrame = engine.getCurrentFrame();
  assert(exactFrame === 10, 'Exact frame position = 10');

  // In a real scenario, during playback, getCurrentFrameInterpolated()
  // would return sub-frame values between tick updates
  const interpolated = engine.getCurrentFrameInterpolated();
  assert(interpolated >= 10 && interpolated <= 11, 'Interpolated frame in valid range');

  console.log('\n✅ Sub-frame interpolation test passed!\n');
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  PLAYBACK ENGINE TEST SUITE');
  console.log('='.repeat(60));

  try {
    testFrameTimeConversions();
    testClipScheduling();
    testTransformInterpolation();
    await testPlaybackRate();
    testSubFrameInterpolation();

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ ALL TESTS PASSED!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('  ❌ TESTS FAILED');
    console.log('='.repeat(60) + '\n');
    throw error;
  }
}

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).playbackTests = {
    runAllTests,
    testFrameTimeConversions,
    testClipScheduling,
    testTransformInterpolation,
    testPlaybackRate,
    testSubFrameInterpolation,
  };
}
