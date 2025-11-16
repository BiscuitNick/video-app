/**
 * Tests for Effects and Transitions
 */

import { describe, it, expect } from 'vitest';
import {
  getFilterCSS,
  getActiveEffects,
  getTransitionOpacity,
  getTransitionTransform,
  applyEasing,
  generateEffectId,
} from '@/lib/effects/effectUtils';
import type {
  FilterEffect,
  TransitionEffect,
  TextOverlayEffect,
} from '@/types/effects';
import type { Clip } from '@/types';

describe('Effect Utilities', () => {
  describe('getFilterCSS', () => {
    it('should generate correct CSS filter string', () => {
      const filter: FilterEffect = {
        id: 'test-filter',
        type: 'filter',
        name: 'Test Filter',
        enabled: true,
        parameters: {
          brightness: 120,
          contrast: 110,
          saturation: 90,
        },
      };

      const css = getFilterCSS(filter);
      expect(css).toContain('brightness(120%)');
      expect(css).toContain('contrast(110%)');
      expect(css).toContain('saturate(90%)');
    });

    it('should skip default values', () => {
      const filter: FilterEffect = {
        id: 'test-filter',
        type: 'filter',
        name: 'Test Filter',
        enabled: true,
        parameters: {
          brightness: 100, // Default
          contrast: 100, // Default
          saturation: 120,
        },
      };

      const css = getFilterCSS(filter);
      expect(css).not.toContain('brightness');
      expect(css).not.toContain('contrast');
      expect(css).toContain('saturate(120%)');
    });
  });

  describe('getActiveEffects', () => {
    it('should return enabled effects only', () => {
      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        effects: [
          {
            id: 'effect-1',
            type: 'filter',
            name: 'Filter 1',
            enabled: true,
            parameters: { brightness: 120 },
          } as FilterEffect,
          {
            id: 'effect-2',
            type: 'filter',
            name: 'Filter 2',
            enabled: false,
            parameters: { contrast: 120 },
          } as FilterEffect,
        ],
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      const activeEffects = getActiveEffects(clip, 5);
      expect(activeEffects).toHaveLength(1);
      expect(activeEffects[0].id).toBe('effect-1');
    });

    it('should filter text overlays by time range', () => {
      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        effects: [
          {
            id: 'text-1',
            type: 'textOverlay',
            name: 'Text 1',
            enabled: true,
            text: 'Hello',
            position: { x: 50, y: 50 },
            style: {
              fontFamily: 'Arial',
              fontSize: 24,
              color: '#fff',
              fontWeight: 'normal',
              fontStyle: 'normal',
              textAlign: 'center',
            },
            startTime: 2, // Relative to clip
            duration: 3,
          } as TextOverlayEffect,
        ],
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      // Before text overlay
      expect(getActiveEffects(clip, 1)).toHaveLength(0);

      // During text overlay (clip start 0 + text start 2 = time 2)
      expect(getActiveEffects(clip, 3)).toHaveLength(1);

      // After text overlay (text ends at 2 + 3 = 5)
      expect(getActiveEffects(clip, 6)).toHaveLength(0);
    });
  });

  describe('getTransitionOpacity', () => {
    it('should calculate fade-in opacity correctly', () => {
      const transition: TransitionEffect = {
        id: 'trans-1',
        type: 'transition',
        name: 'Fade In',
        enabled: true,
        transitionType: 'fade-in',
        duration: 2,
        easing: 'linear',
      };

      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      expect(getTransitionOpacity(transition, clip, 0)).toBe(0);
      expect(getTransitionOpacity(transition, clip, 1)).toBe(0.5);
      expect(getTransitionOpacity(transition, clip, 2)).toBe(1);
    });

    it('should calculate fade-out opacity correctly', () => {
      const transition: TransitionEffect = {
        id: 'trans-1',
        type: 'transition',
        name: 'Fade Out',
        enabled: true,
        transitionType: 'fade-out',
        duration: 2,
        easing: 'linear',
      };

      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      // Fade out starts at 10 - 2 = 8
      expect(getTransitionOpacity(transition, clip, 8)).toBe(1);
      expect(getTransitionOpacity(transition, clip, 9)).toBe(0.5);
      expect(getTransitionOpacity(transition, clip, 10)).toBe(0);
    });
  });

  describe('getTransitionTransform', () => {
    it('should calculate zoom-in transform correctly', () => {
      const transition: TransitionEffect = {
        id: 'trans-1',
        type: 'transition',
        name: 'Zoom In',
        enabled: true,
        transitionType: 'zoom-in',
        duration: 2,
        easing: 'linear',
      };

      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      expect(getTransitionTransform(transition, clip, 0)).toBe('scale(0.5)');
      expect(getTransitionTransform(transition, clip, 1)).toBe('scale(0.75)');
      expect(getTransitionTransform(transition, clip, 2)).toBe('scale(1)');
    });

    it('should calculate wipe transforms correctly', () => {
      const transition: TransitionEffect = {
        id: 'trans-1',
        type: 'transition',
        name: 'Wipe Left',
        enabled: true,
        transitionType: 'wipe-left',
        duration: 2,
        easing: 'linear',
      };

      const clip: Clip = {
        id: 'clip-1',
        trackId: 'track-1',
        mediaAssetId: 'media-1',
        startTime: 0,
        endTime: 10,
        trimStart: 0,
        trimEnd: 10,
        properties: {
          speed: 1,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            opacity: 1,
          },
        },
      };

      expect(getTransitionTransform(transition, clip, 0)).toBe('translateX(100%)');
      expect(getTransitionTransform(transition, clip, 1)).toBe('translateX(50%)');
      expect(getTransitionTransform(transition, clip, 2)).toBe('translateX(0%)');
    });
  });

  describe('applyEasing', () => {
    it('should apply linear easing', () => {
      expect(applyEasing(0, 'linear')).toBe(0);
      expect(applyEasing(0.5, 'linear')).toBe(0.5);
      expect(applyEasing(1, 'linear')).toBe(1);
    });

    it('should apply easeIn easing', () => {
      expect(applyEasing(0, 'easeIn')).toBe(0);
      expect(applyEasing(0.5, 'easeIn')).toBe(0.25);
      expect(applyEasing(1, 'easeIn')).toBe(1);
    });

    it('should clamp values to [0, 1]', () => {
      expect(applyEasing(-0.5, 'linear')).toBe(0);
      expect(applyEasing(1.5, 'linear')).toBe(1);
    });
  });

  describe('generateEffectId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateEffectId();
      const id2 = generateEffectId();

      expect(id1).toMatch(/^effect-/);
      expect(id2).toMatch(/^effect-/);
      expect(id1).not.toBe(id2);
    });
  });
});
