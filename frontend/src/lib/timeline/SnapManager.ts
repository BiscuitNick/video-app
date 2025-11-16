/**
 * SnapManager - Handles snapping logic for timeline clips
 */

import type { Clip, Track } from '@/types';
import { timeToPixels, pixelsToTime, snapToFrame } from './timeUtils';

export interface SnapPoint {
  time: number;
  pixel: number;
  type: 'clip-start' | 'clip-end' | 'playhead' | 'grid';
  clipId?: string;
}

export interface SnapResult {
  snapped: boolean;
  snapTime: number;
  snapPoint?: SnapPoint;
  visualIndicators: SnapIndicator[];
}

export interface SnapIndicator {
  position: number; // pixel position
  type: 'vertical-line';
  color: string;
}

export interface SnapConfig {
  enabled: boolean;
  threshold: number; // pixels
  snapToGrid: boolean;
  snapToClips: boolean;
  snapToPlayhead: boolean;
}

export class SnapManager {
  private config: SnapConfig;
  private pixelsPerSecond: number;
  private zoom: number;
  private fps: number;

  constructor(
    config: SnapConfig,
    pixelsPerSecond: number,
    zoom: number,
    fps: number
  ) {
    this.config = config;
    this.pixelsPerSecond = pixelsPerSecond;
    this.zoom = zoom;
    this.fps = fps;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SnapConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update zoom level
   */
  updateZoom(zoom: number) {
    this.zoom = zoom;
  }

  /**
   * Calculate all snap points in the timeline
   */
  calculateSnapPoints(
    tracks: Track[],
    playheadTime: number,
    excludeClipIds: string[] = []
  ): SnapPoint[] {
    const snapPoints: SnapPoint[] = [];

    if (!this.config.enabled) {
      return snapPoints;
    }

    // Add playhead snap point
    if (this.config.snapToPlayhead) {
      snapPoints.push({
        time: playheadTime,
        pixel: timeToPixels(playheadTime, this.pixelsPerSecond, this.zoom),
        type: 'playhead',
      });
    }

    // Add clip start/end snap points
    if (this.config.snapToClips) {
      tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          if (!excludeClipIds.includes(clip.id)) {
            // Clip start
            snapPoints.push({
              time: clip.startTime,
              pixel: timeToPixels(
                clip.startTime,
                this.pixelsPerSecond,
                this.zoom
              ),
              type: 'clip-start',
              clipId: clip.id,
            });

            // Clip end
            snapPoints.push({
              time: clip.endTime,
              pixel: timeToPixels(
                clip.endTime,
                this.pixelsPerSecond,
                this.zoom
              ),
              type: 'clip-end',
              clipId: clip.id,
            });
          }
        });
      });
    }

    // Add grid snap points (every second or frame based on zoom)
    if (this.config.snapToGrid) {
      const gridInterval = this.zoom >= 2 ? 1 / this.fps : 1; // Frame or second
      const maxTime = Math.max(
        ...tracks.flatMap((t) => t.clips.map((c) => c.endTime)),
        playheadTime
      );

      for (let time = 0; time <= maxTime + 10; time += gridInterval) {
        snapPoints.push({
          time,
          pixel: timeToPixels(time, this.pixelsPerSecond, this.zoom),
          type: 'grid',
        });
      }
    }

    return snapPoints;
  }

  /**
   * Find the nearest snap point for a given time
   */
  findSnapPoint(
    targetTime: number,
    snapPoints: SnapPoint[]
  ): SnapResult {
    if (!this.config.enabled || snapPoints.length === 0) {
      return {
        snapped: false,
        snapTime: targetTime,
        visualIndicators: [],
      };
    }

    const targetPixel = timeToPixels(
      targetTime,
      this.pixelsPerSecond,
      this.zoom
    );

    let nearestPoint: SnapPoint | undefined;
    let minDistance = Infinity;

    // Find nearest snap point within threshold
    for (const point of snapPoints) {
      const distance = Math.abs(point.pixel - targetPixel);
      if (distance < this.config.threshold && distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    if (nearestPoint) {
      return {
        snapped: true,
        snapTime: nearestPoint.time,
        snapPoint: nearestPoint,
        visualIndicators: [
          {
            position: nearestPoint.pixel,
            type: 'vertical-line',
            color: this.getSnapColor(nearestPoint.type),
          },
        ],
      };
    }

    return {
      snapped: false,
      snapTime: targetTime,
      visualIndicators: [],
    };
  }

  /**
   * Snap multiple clips as a group
   */
  snapGroup(
    clips: Clip[],
    deltaTime: number,
    snapPoints: SnapPoint[]
  ): SnapResult {
    if (!this.config.enabled || clips.length === 0) {
      return {
        snapped: false,
        snapTime: deltaTime,
        visualIndicators: [],
      };
    }

    // Get the leftmost clip edge
    const leftmostTime = Math.min(...clips.map((c) => c.startTime));
    const newLeftmostTime = leftmostTime + deltaTime;

    // Try to snap the leftmost edge
    const result = this.findSnapPoint(newLeftmostTime, snapPoints);

    if (result.snapped && result.snapPoint) {
      // Adjust delta to snap the group
      const snapDelta = result.snapPoint.time - leftmostTime;
      return {
        ...result,
        snapTime: snapDelta,
      };
    }

    return {
      snapped: false,
      snapTime: deltaTime,
      visualIndicators: [],
    };
  }

  /**
   * Get color for snap indicator based on type
   */
  private getSnapColor(type: SnapPoint['type']): string {
    switch (type) {
      case 'playhead':
        return '#3b82f6'; // blue
      case 'clip-start':
      case 'clip-end':
        return '#10b981'; // green
      case 'grid':
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  }

  /**
   * Snap time to frame boundary
   */
  snapTimeToFrame(time: number): number {
    return snapToFrame(time, this.fps);
  }
}

/**
 * Create a default snap configuration
 */
export function createDefaultSnapConfig(): SnapConfig {
  return {
    enabled: true,
    threshold: 10,
    snapToGrid: true,
    snapToClips: true,
    snapToPlayhead: true,
  };
}
