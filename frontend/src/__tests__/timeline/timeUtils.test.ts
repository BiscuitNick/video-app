import { describe, it, expect } from 'vitest';
import {
  timeToFrame,
  frameToTime,
  timeToPixels,
  pixelsToTime,
  formatTime,
  formatTimeAdaptive,
  getTickInterval,
  snapToFrame,
  calculateZoom,
  clamp,
} from '@/lib/timeline/timeUtils';

describe('timeUtils', () => {
  describe('timeToFrame and frameToTime', () => {
    it('should convert time to frame correctly', () => {
      expect(timeToFrame(1, 30)).toBe(30);
      expect(timeToFrame(0.5, 30)).toBe(15);
      expect(timeToFrame(2, 24)).toBe(48);
    });

    it('should convert frame to time correctly', () => {
      expect(frameToTime(30, 30)).toBe(1);
      expect(frameToTime(15, 30)).toBe(0.5);
      expect(frameToTime(48, 24)).toBe(2);
    });

    it('should be reversible', () => {
      const time = 1.5;
      const fps = 30;
      const frame = timeToFrame(time, fps);
      const backToTime = frameToTime(frame, fps);
      expect(Math.abs(backToTime - time)).toBeLessThan(0.01);
    });
  });

  describe('timeToPixels and pixelsToTime', () => {
    const pixelsPerSecond = 100;

    it('should convert time to pixels correctly', () => {
      expect(timeToPixels(1, pixelsPerSecond, 1)).toBe(100);
      expect(timeToPixels(1, pixelsPerSecond, 2)).toBe(200);
      expect(timeToPixels(0.5, pixelsPerSecond, 1)).toBe(50);
    });

    it('should convert pixels to time correctly', () => {
      expect(pixelsToTime(100, pixelsPerSecond, 1)).toBe(1);
      expect(pixelsToTime(200, pixelsPerSecond, 2)).toBe(1);
      expect(pixelsToTime(50, pixelsPerSecond, 1)).toBe(0.5);
    });

    it('should be reversible', () => {
      const time = 2.5;
      const zoom = 1.5;
      const pixels = timeToPixels(time, pixelsPerSecond, zoom);
      const backToTime = pixelsToTime(pixels, pixelsPerSecond, zoom);
      expect(backToTime).toBeCloseTo(time);
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      expect(formatTime(0, 30)).toBe('00:00:00:00');
      expect(formatTime(1, 30)).toBe('00:00:01:00');
      expect(formatTime(60, 30)).toBe('00:01:00:00');
      expect(formatTime(3600, 30)).toBe('01:00:00:00');
    });

    it('should handle fractional seconds', () => {
      expect(formatTime(1.5, 30)).toBe('00:00:01:15');
      expect(formatTime(0.5, 24)).toBe('00:00:00:12');
    });
  });

  describe('formatTimeAdaptive', () => {
    it('should format differently based on zoom', () => {
      const time = 1.5;
      const fps = 30;

      // Zoomed out - show minutes:seconds
      const zoomedOut = formatTimeAdaptive(time, fps, 0.5);
      expect(zoomedOut).toMatch(/:/);

      // Normal zoom - show seconds and frames
      const normal = formatTimeAdaptive(time, fps, 1);
      expect(normal).toContain('s');

      // Zoomed in - show frames
      const zoomedIn = formatTimeAdaptive(time, fps, 4);
      expect(zoomedIn).toContain('f');
    });
  });

  describe('getTickInterval', () => {
    const fps = 30;

    it('should return appropriate intervals for different zoom levels', () => {
      const veryZoomedOut = getTickInterval(0.25, fps);
      expect(veryZoomedOut.major).toBeGreaterThan(veryZoomedOut.minor);

      const normal = getTickInterval(1, fps);
      expect(normal.major).toBeGreaterThan(0);

      const veryZoomedIn = getTickInterval(8, fps);
      expect(veryZoomedIn.minor).toBeLessThanOrEqual(1 / fps);
    });
  });

  describe('snapToFrame', () => {
    it('should snap time to nearest frame', () => {
      expect(snapToFrame(1.01, 30)).toBeCloseTo(1.0, 2);
      expect(snapToFrame(1.49, 30)).toBeCloseTo(1.467, 2);
      expect(snapToFrame(0.5, 24)).toBeCloseTo(0.5, 2);
    });
  });

  describe('calculateZoom', () => {
    it('should calculate logarithmic zoom', () => {
      expect(calculateZoom(1, 0.5, 0.25, 8)).toBeGreaterThan(1);
      expect(calculateZoom(1, -0.5, 0.25, 8)).toBeLessThan(1);
    });

    it('should clamp to min and max', () => {
      expect(calculateZoom(0.25, -1, 0.25, 8)).toBe(0.25);
      expect(calculateZoom(8, 1, 0.25, 8)).toBe(8);
    });
  });

  describe('clamp', () => {
    it('should clamp values correctly', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(11, 0, 10)).toBe(10);
    });
  });
});
