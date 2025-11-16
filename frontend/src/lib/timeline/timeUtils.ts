/**
 * Time calculation utilities for the timeline
 */

export interface TimeFormat {
  frames: number;
  seconds: number;
  minutes: number;
  hours: number;
}

/**
 * Convert time in seconds to frame number
 */
export function timeToFrame(time: number, fps: number): number {
  return Math.round(time * fps);
}

/**
 * Convert frame number to time in seconds
 */
export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * Convert time to pixels based on zoom level
 * @param time Time in seconds
 * @param pixelsPerSecond Base pixels per second (at zoom = 1)
 * @param zoom Zoom multiplier
 */
export function timeToPixels(
  time: number,
  pixelsPerSecond: number,
  zoom: number
): number {
  return time * pixelsPerSecond * zoom;
}

/**
 * Convert pixels to time based on zoom level
 */
export function pixelsToTime(
  pixels: number,
  pixelsPerSecond: number,
  zoom: number
): number {
  return pixels / (pixelsPerSecond * zoom);
}

/**
 * Format time as HH:MM:SS:FF (hours:minutes:seconds:frames)
 */
export function formatTime(time: number, fps: number): string {
  const totalFrames = timeToFrame(time, fps);
  const hours = Math.floor(totalFrames / (fps * 3600));
  const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const seconds = Math.floor((totalFrames % (fps * 60)) / fps);
  const frames = totalFrames % fps;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Format time based on zoom level (adaptive formatting)
 */
export function formatTimeAdaptive(
  time: number,
  fps: number,
  zoom: number
): string {
  if (zoom >= 4) {
    // Show frames when zoomed in
    const frame = timeToFrame(time, fps);
    return `${frame}f`;
  } else if (zoom >= 1) {
    // Show seconds
    const seconds = Math.floor(time);
    const frames = timeToFrame(time, fps) % fps;
    return `${seconds}s ${frames}f`;
  } else {
    // Show minutes:seconds when zoomed out
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Calculate appropriate tick interval based on zoom level
 */
export function getTickInterval(
  zoom: number,
  fps: number
): { major: number; minor: number } {
  // Base intervals in seconds
  const baseIntervals = [
    { major: 60, minor: 10 }, // 1 min major, 10 sec minor
    { major: 10, minor: 1 }, // 10 sec major, 1 sec minor
    { major: 5, minor: 1 }, // 5 sec major, 1 sec minor
    { major: 1, minor: 1 / fps }, // 1 sec major, 1 frame minor
    { major: 1 / fps, minor: 1 / fps }, // 1 frame for both
  ];

  if (zoom < 0.5) {
    return baseIntervals[0];
  } else if (zoom < 1) {
    return baseIntervals[1];
  } else if (zoom < 2) {
    return baseIntervals[2];
  } else if (zoom < 4) {
    return baseIntervals[3];
  } else {
    return baseIntervals[4];
  }
}

/**
 * Snap time to nearest frame
 */
export function snapToFrame(time: number, fps: number): number {
  const frame = Math.round(time * fps);
  return frame / fps;
}

/**
 * Calculate logarithmic zoom value
 */
export function calculateZoom(
  currentZoom: number,
  delta: number,
  min = 0.25,
  max = 8
): number {
  // Logarithmic zoom feels more natural
  const logZoom = Math.log2(currentZoom);
  const newLogZoom = logZoom + delta;
  const newZoom = Math.pow(2, newLogZoom);

  return Math.max(min, Math.min(max, newZoom));
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
