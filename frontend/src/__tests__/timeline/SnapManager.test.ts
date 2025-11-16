import { describe, it, expect, beforeEach } from 'vitest';
import {
  SnapManager,
  createDefaultSnapConfig,
  type SnapConfig,
} from '@/lib/timeline/SnapManager';
import type { Track, Clip } from '@/types';

describe('SnapManager', () => {
  let snapManager: SnapManager;
  let tracks: Track[];
  const pixelsPerSecond = 100;
  const fps = 30;
  const zoom = 1;

  beforeEach(() => {
    const config = createDefaultSnapConfig();
    snapManager = new SnapManager(config, pixelsPerSecond, zoom, fps);

    // Create test tracks with clips
    tracks = [
      {
        id: 'track1',
        name: 'Video Track 1',
        type: 'video',
        muted: false,
        locked: false,
        visible: true,
        height: 80,
        clips: [
          {
            id: 'clip1',
            trackId: 'track1',
            mediaAssetId: 'asset1',
            startTime: 0,
            endTime: 5,
            trimStart: 0,
            trimEnd: 0,
          },
          {
            id: 'clip2',
            trackId: 'track1',
            mediaAssetId: 'asset2',
            startTime: 10,
            endTime: 15,
            trimStart: 0,
            trimEnd: 0,
          },
        ],
      },
    ];
  });

  describe('calculateSnapPoints', () => {
    it('should generate snap points for clips', () => {
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);

      // Should have points for clip starts and ends
      const clipPoints = snapPoints.filter(
        (p) => p.type === 'clip-start' || p.type === 'clip-end'
      );
      expect(clipPoints.length).toBeGreaterThan(0);
    });

    it('should include playhead snap point when enabled', () => {
      const playheadTime = 7.5;
      const snapPoints = snapManager.calculateSnapPoints(
        tracks,
        playheadTime,
        []
      );

      const playheadPoint = snapPoints.find((p) => p.type === 'playhead');
      expect(playheadPoint).toBeDefined();
      expect(playheadPoint?.time).toBe(playheadTime);
    });

    it('should exclude specified clips', () => {
      const excludeIds = ['clip1'];
      const snapPoints = snapManager.calculateSnapPoints(
        tracks,
        0,
        excludeIds
      );

      const clip1Points = snapPoints.filter((p) => p.clipId === 'clip1');
      expect(clip1Points.length).toBe(0);
    });

    it('should generate grid snap points', () => {
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);

      const gridPoints = snapPoints.filter((p) => p.type === 'grid');
      expect(gridPoints.length).toBeGreaterThan(0);
    });
  });

  describe('findSnapPoint', () => {
    it('should find nearest snap point within threshold', () => {
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);

      // Try to snap to a position close to clip1 end (5 seconds)
      const targetTime = 5.05; // 5px off at 100px/s
      const result = snapManager.findSnapPoint(targetTime, snapPoints);

      expect(result.snapped).toBe(true);
      expect(result.snapTime).toBe(5);
    });

    it('should not snap if distance exceeds threshold', () => {
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);

      // Try to snap to a position far from any snap point
      const targetTime = 7.5;
      const result = snapManager.findSnapPoint(targetTime, snapPoints);

      // Depending on grid snapping, this might still snap to grid
      // Let's disable grid snapping for this test
      snapManager.updateConfig({ snapToGrid: false });
      const snapPointsNoGrid = snapManager.calculateSnapPoints(tracks, 0, []);
      const resultNoGrid = snapManager.findSnapPoint(
        targetTime,
        snapPointsNoGrid
      );

      expect(resultNoGrid.snapTime).not.toBe(5);
      expect(resultNoGrid.snapTime).not.toBe(10);
    });

    it('should return visual indicators when snapped', () => {
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);
      const targetTime = 5.05;
      const result = snapManager.findSnapPoint(targetTime, snapPoints);

      expect(result.visualIndicators.length).toBeGreaterThan(0);
      expect(result.visualIndicators[0].type).toBe('vertical-line');
    });
  });

  describe('snapGroup', () => {
    it('should snap multiple clips as a group', () => {
      const clips: Clip[] = [
        {
          id: 'newClip1',
          trackId: 'track1',
          mediaAssetId: 'asset3',
          startTime: 2,
          endTime: 4,
          trimStart: 0,
          trimEnd: 0,
        },
        {
          id: 'newClip2',
          trackId: 'track1',
          mediaAssetId: 'asset4',
          startTime: 5,
          endTime: 7,
          trimStart: 0,
          trimEnd: 0,
        },
      ];

      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, [
        'newClip1',
        'newClip2',
      ]);

      // Move clips so leftmost edge is close to time 0
      const deltaTime = -1.95; // Would put leftmost at 0.05
      const result = snapManager.snapGroup(clips, deltaTime, snapPoints);

      expect(result.snapped).toBe(true);
      expect(result.snapTime).toBeCloseTo(-2, 1);
    });
  });

  describe('config updates', () => {
    it('should update config correctly', () => {
      snapManager.updateConfig({ enabled: false });
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);
      const result = snapManager.findSnapPoint(5.05, snapPoints);

      expect(result.snapped).toBe(false);
    });

    it('should update zoom correctly', () => {
      snapManager.updateZoom(2);
      const snapPoints = snapManager.calculateSnapPoints(tracks, 0, []);

      // With higher zoom, snap points should have different pixel positions
      const clipStartPoint = snapPoints.find(
        (p) => p.type === 'clip-start' && p.time === 0
      );
      expect(clipStartPoint?.pixel).toBe(0);

      const clipEndPoint = snapPoints.find(
        (p) => p.type === 'clip-end' && p.time === 5
      );
      // At zoom 2, 5 seconds should be at 1000px (5 * 100 * 2)
      expect(clipEndPoint?.pixel).toBe(1000);
    });
  });

  describe('snapTimeToFrame', () => {
    it('should snap time to frame boundary', () => {
      const snappedTime = snapManager.snapTimeToFrame(1.02);
      const expectedFrame = Math.round(1.02 * fps);
      const expectedTime = expectedFrame / fps;

      expect(snappedTime).toBeCloseTo(expectedTime, 3);
    });
  });
});
