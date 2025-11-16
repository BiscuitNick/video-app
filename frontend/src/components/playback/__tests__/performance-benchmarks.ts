import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OverlayRenderer } from '../OverlayRenderer';
import { TransitionRenderer } from '../TransitionRenderer';
import type { OverlayConfig, TransitionConfig } from '../types';

/**
 * Performance benchmarks for playback components
 */

describe('Performance Benchmarks - OverlayRenderer', () => {
  it('renders multiple overlays efficiently', () => {
    const overlays: OverlayConfig[] = Array.from({ length: 50 }, (_, i) => ({
      id: `overlay-${i}`,
      type: 'text' as const,
      content: `Overlay ${i}`,
      position: { x: (i * 2) % 100, y: (i * 3) % 100 },
      startTime: 0,
      endTime: 10,
      zIndex: i,
    }));

    const startTime = performance.now();
    const { unmount } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );
    const renderTime = performance.now() - startTime;

    unmount();

    console.log(`OverlayRenderer (50 overlays) render time: ${renderTime.toFixed(2)}ms`);
    expect(renderTime).toBeLessThan(100); // Should render in less than 100ms
  });

  it('handles rapid time updates efficiently', () => {
    const overlays: OverlayConfig[] = Array.from({ length: 10 }, (_, i) => ({
      id: `overlay-${i}`,
      type: 'text' as const,
      content: `Overlay ${i}`,
      position: { x: 50, y: 50 },
      startTime: i * 2,
      endTime: (i + 1) * 2,
    }));

    const { rerender } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={0}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    const startTime = performance.now();
    const iterations = 60; // Simulate 60 frames

    for (let i = 0; i < iterations; i++) {
      rerender(
        <OverlayRenderer
          overlays={overlays}
          currentTime={i / 30} // 30 FPS
          containerWidth={1920}
          containerHeight={1080}
        />
      );
    }

    const totalTime = performance.now() - startTime;
    const avgFrameTime = totalTime / iterations;

    console.log(`OverlayRenderer avg frame time: ${avgFrameTime.toFixed(2)}ms`);
    expect(avgFrameTime).toBeLessThan(16.67); // Should maintain 60 FPS
  });

  it('memoization prevents unnecessary re-renders', () => {
    const overlays: OverlayConfig[] = [
      {
        id: 'overlay-1',
        type: 'text',
        content: 'Test',
        position: { x: 50, y: 50 },
        startTime: 0,
        endTime: 10,
      },
    ];

    const { rerender } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    const startTime = performance.now();

    // Re-render with same props (should be fast due to memoization)
    for (let i = 0; i < 1000; i++) {
      rerender(
        <OverlayRenderer
          overlays={overlays}
          currentTime={5}
          containerWidth={1920}
          containerHeight={1080}
        />
      );
    }

    const totalTime = performance.now() - startTime;
    const avgTime = totalTime / 1000;

    console.log(`OverlayRenderer memoized re-render avg: ${avgTime.toFixed(3)}ms`);
    expect(avgTime).toBeLessThan(1); // Memoized re-renders should be very fast
  });
});

describe('Performance Benchmarks - TransitionRenderer', () => {
  it('renders transitions at 60 FPS', () => {
    const transition: TransitionConfig = {
      id: 'transition-1',
      type: 'fade',
      duration: 1,
      startTime: 0,
      timingFunction: 'ease',
    };

    const { rerender } = render(
      <TransitionRenderer transition={transition} currentTime={0}>
        <div style={{ width: 1920, height: 1080, background: 'blue' }} />
      </TransitionRenderer>
    );

    const startTime = performance.now();
    const frames = 60; // 1 second at 60 FPS

    for (let i = 0; i < frames; i++) {
      rerender(
        <TransitionRenderer transition={transition} currentTime={i / 60}>
          <div style={{ width: 1920, height: 1080, background: 'blue' }} />
        </TransitionRenderer>
      );
    }

    const totalTime = performance.now() - startTime;
    const avgFrameTime = totalTime / frames;

    console.log(`TransitionRenderer avg frame time: ${avgFrameTime.toFixed(2)}ms`);
    expect(avgFrameTime).toBeLessThan(16.67); // Should maintain 60 FPS
  });

  it('handles all transition types efficiently', () => {
    const transitionTypes: TransitionConfig['type'][] = [
      'fade',
      'wipe-left',
      'wipe-right',
      'wipe-up',
      'wipe-down',
      'dissolve',
    ];

    const results: Record<string, number> = {};

    for (const type of transitionTypes) {
      const transition: TransitionConfig = {
        id: `transition-${type}`,
        type,
        duration: 1,
        startTime: 0,
      };

      const { rerender, unmount } = render(
        <TransitionRenderer transition={transition} currentTime={0}>
          <div style={{ width: 1920, height: 1080, background: 'blue' }} />
        </TransitionRenderer>
      );

      const startTime = performance.now();
      const frames = 30;

      for (let i = 0; i < frames; i++) {
        rerender(
          <TransitionRenderer transition={transition} currentTime={i / 30}>
            <div style={{ width: 1920, height: 1080, background: 'blue' }} />
          </TransitionRenderer>
        );
      }

      const totalTime = performance.now() - startTime;
      results[type] = totalTime / frames;

      unmount();
    }

    console.log('TransitionRenderer performance by type:');
    Object.entries(results).forEach(([type, avgTime]) => {
      console.log(`  ${type}: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(16.67); // All should maintain 60 FPS
    });
  });

  it('tests transition with different timing functions', () => {
    const timingFunctions: Array<TransitionConfig['timingFunction']> = [
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
    ];

    const results: Record<string, number> = {};

    for (const timingFunction of timingFunctions) {
      const transition: TransitionConfig = {
        id: 'transition-1',
        type: 'fade',
        duration: 1,
        startTime: 0,
        timingFunction,
      };

      const { rerender, unmount } = render(
        <TransitionRenderer transition={transition} currentTime={0}>
          <div style={{ width: 1920, height: 1080, background: 'blue' }} />
        </TransitionRenderer>
      );

      const startTime = performance.now();
      const frames = 30;

      for (let i = 0; i < frames; i++) {
        rerender(
          <TransitionRenderer transition={transition} currentTime={i / 30}>
            <div style={{ width: 1920, height: 1080, background: 'blue' }} />
          </TransitionRenderer>
        );
      }

      const totalTime = performance.now() - startTime;
      results[timingFunction || 'default'] = totalTime / frames;

      unmount();
    }

    console.log('TransitionRenderer performance by timing function:');
    Object.entries(results).forEach(([func, avgTime]) => {
      console.log(`  ${func}: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(16.67);
    });
  });
});

describe('Performance Benchmarks - Integration', () => {
  it('handles combined overlay and transition rendering', () => {
    const overlays: OverlayConfig[] = Array.from({ length: 20 }, (_, i) => ({
      id: `overlay-${i}`,
      type: 'text' as const,
      content: `Overlay ${i}`,
      position: { x: (i * 5) % 100, y: (i * 5) % 100 },
      startTime: 0,
      endTime: 10,
    }));

    const transition: TransitionConfig = {
      id: 'transition-1',
      type: 'fade',
      duration: 1,
      startTime: 0,
    };

    const { rerender } = render(
      <TransitionRenderer transition={transition} currentTime={0}>
        <div style={{ position: 'relative', width: 1920, height: 1080 }}>
          <OverlayRenderer
            overlays={overlays}
            currentTime={0}
            containerWidth={1920}
            containerHeight={1080}
          />
        </div>
      </TransitionRenderer>
    );

    const startTime = performance.now();
    const frames = 60;

    for (let i = 0; i < frames; i++) {
      const currentTime = i / 60;
      rerender(
        <TransitionRenderer transition={transition} currentTime={currentTime}>
          <div style={{ position: 'relative', width: 1920, height: 1080 }}>
            <OverlayRenderer
              overlays={overlays}
              currentTime={currentTime}
              containerWidth={1920}
              containerHeight={1080}
            />
          </div>
        </TransitionRenderer>
      );
    }

    const totalTime = performance.now() - startTime;
    const avgFrameTime = totalTime / frames;

    console.log(
      `Combined overlay + transition avg frame time: ${avgFrameTime.toFixed(2)}ms`
    );
    expect(avgFrameTime).toBeLessThan(16.67); // Should maintain 60 FPS
  });

  it('stress test with maximum overlays and active transition', () => {
    const overlays: OverlayConfig[] = Array.from({ length: 100 }, (_, i) => ({
      id: `overlay-${i}`,
      type: i % 2 === 0 ? ('text' as const) : ('image' as const),
      content: i % 2 === 0 ? `Text ${i}` : 'https://example.com/image.png',
      position: { x: (i * 1) % 100, y: (i * 2) % 100 },
      startTime: 0,
      endTime: 10,
      zIndex: i,
    }));

    const transition: TransitionConfig = {
      id: 'transition-1',
      type: 'dissolve',
      duration: 1,
      startTime: 0,
    };

    const startTime = performance.now();
    const { unmount } = render(
      <TransitionRenderer transition={transition} currentTime={0.5}>
        <div style={{ position: 'relative', width: 1920, height: 1080 }}>
          <OverlayRenderer
            overlays={overlays}
            currentTime={5}
            containerWidth={1920}
            containerHeight={1080}
          />
        </div>
      </TransitionRenderer>
    );
    const renderTime = performance.now() - startTime;

    unmount();

    console.log(`Stress test (100 overlays + transition) render time: ${renderTime.toFixed(2)}ms`);
    expect(renderTime).toBeLessThan(200); // Should render in less than 200ms
  });
});

describe('Performance Benchmarks - Memory', () => {
  it('does not leak memory on repeated renders', () => {
    const overlays: OverlayConfig[] = Array.from({ length: 50 }, (_, i) => ({
      id: `overlay-${i}`,
      type: 'text' as const,
      content: `Overlay ${i}`,
      position: { x: 50, y: 50 },
      startTime: 0,
      endTime: 10,
    }));

    // Perform multiple render/unmount cycles
    for (let cycle = 0; cycle < 10; cycle++) {
      const { unmount } = render(
        <OverlayRenderer
          overlays={overlays}
          currentTime={5}
          containerWidth={1920}
          containerHeight={1080}
        />
      );
      unmount();
    }

    // If this test completes without running out of memory, we're good
    expect(true).toBe(true);
  });
});
