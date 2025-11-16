/**
 * Integration tests for Effects Panel
 * Demonstrates full workflow of applying effects to clips
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import type { Track, Clip } from '@/types';
import type { TransitionEffect, FilterEffect, TextOverlayEffect } from '@/types/effects';

describe('Effects Panel Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useTimelineStore.getState());
    act(() => {
      // Clear all tracks
      result.current.tracks.forEach((track) => {
        result.current.deleteTrack(track.id);
      });
    });
  });

  it('should add a transition effect to a clip', () => {
    const { result } = renderHook(() => useTimelineStore());

    // Create track and clip
    const track: Track = {
      id: 'track-1',
      name: 'Video Track',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    act(() => {
      result.current.addTrack(track);
    });

    const clip: Clip = {
      id: 'clip-1',
      trackId: 'track-1',
      mediaAssetId: 'media-1',
      startTime: 0,
      endTime: 10,
      trimStart: 0,
      trimEnd: 10,
      effects: [],
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

    act(() => {
      result.current.addClip(clip);
    });

    // Add transition effect
    const transition: TransitionEffect = {
      id: 'effect-1',
      type: 'transition',
      name: 'Fade In',
      enabled: true,
      transitionType: 'fade-in',
      duration: 1.0,
      easing: 'easeInOut',
    };

    act(() => {
      result.current.updateClip('clip-1', {
        effects: [transition],
      });
    });

    // Verify effect was added
    const updatedClip = result.current.getClipById('clip-1');
    expect(updatedClip?.effects).toHaveLength(1);
    expect(updatedClip?.effects?.[0]).toMatchObject({
      type: 'transition',
      transitionType: 'fade-in',
      duration: 1.0,
    });
  });

  it('should add multiple effects to a clip', () => {
    const { result } = renderHook(() => useTimelineStore());

    // Setup
    const track: Track = {
      id: 'track-1',
      name: 'Video Track',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    act(() => {
      result.current.addTrack(track);
    });

    const clip: Clip = {
      id: 'clip-1',
      trackId: 'track-1',
      mediaAssetId: 'media-1',
      startTime: 0,
      endTime: 10,
      trimStart: 0,
      trimEnd: 10,
      effects: [],
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

    act(() => {
      result.current.addClip(clip);
    });

    // Add transition
    const transition: TransitionEffect = {
      id: 'effect-1',
      type: 'transition',
      name: 'Fade In',
      enabled: true,
      transitionType: 'fade-in',
      duration: 1.0,
      easing: 'easeInOut',
    };

    // Add filter
    const filter: FilterEffect = {
      id: 'effect-2',
      type: 'filter',
      name: 'Vibrant',
      enabled: true,
      parameters: {
        brightness: 110,
        contrast: 120,
        saturation: 130,
      },
    };

    // Add text overlay
    const textOverlay: TextOverlayEffect = {
      id: 'effect-3',
      type: 'textOverlay',
      name: 'Title',
      enabled: true,
      text: 'Hello World',
      position: { x: 50, y: 50 },
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        color: '#ffffff',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
      },
      startTime: 0,
      duration: 5,
    };

    act(() => {
      result.current.updateClip('clip-1', {
        effects: [transition, filter, textOverlay],
      });
    });

    // Verify all effects were added
    const updatedClip = result.current.getClipById('clip-1');
    expect(updatedClip?.effects).toHaveLength(3);
    expect(updatedClip?.effects?.map((e) => e.type)).toEqual([
      'transition',
      'filter',
      'textOverlay',
    ]);
  });

  it('should toggle effect enabled/disabled', () => {
    const { result } = renderHook(() => useTimelineStore());

    // Setup
    const track: Track = {
      id: 'track-1',
      name: 'Video Track',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    act(() => {
      result.current.addTrack(track);
    });

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
          name: 'Filter',
          enabled: true,
          parameters: { brightness: 120 },
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

    act(() => {
      result.current.addClip(clip);
    });

    // Toggle effect
    act(() => {
      const currentClip = result.current.getClipById('clip-1');
      const effects = currentClip?.effects || [];
      result.current.updateClip('clip-1', {
        effects: effects.map((e) =>
          e.id === 'effect-1' ? { ...e, enabled: false } : e
        ),
      });
    });

    // Verify effect is disabled
    const updatedClip = result.current.getClipById('clip-1');
    expect(updatedClip?.effects?.[0].enabled).toBe(false);
  });

  it('should delete an effect from a clip', () => {
    const { result } = renderHook(() => useTimelineStore());

    // Setup
    const track: Track = {
      id: 'track-1',
      name: 'Video Track',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    act(() => {
      result.current.addTrack(track);
    });

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
          enabled: true,
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

    act(() => {
      result.current.addClip(clip);
    });

    // Delete first effect
    act(() => {
      const currentClip = result.current.getClipById('clip-1');
      const effects = currentClip?.effects || [];
      result.current.updateClip('clip-1', {
        effects: effects.filter((e) => e.id !== 'effect-1'),
      });
    });

    // Verify effect was deleted
    const updatedClip = result.current.getClipById('clip-1');
    expect(updatedClip?.effects).toHaveLength(1);
    expect(updatedClip?.effects?.[0].id).toBe('effect-2');
  });

  it('should replace existing filter when applying new filter', () => {
    const { result } = renderHook(() => useTimelineStore());

    // Setup
    const track: Track = {
      id: 'track-1',
      name: 'Video Track',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    act(() => {
      result.current.addTrack(track);
    });

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
          id: 'filter-old',
          type: 'filter',
          name: 'Old Filter',
          enabled: true,
          parameters: { brightness: 120 },
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

    act(() => {
      result.current.addClip(clip);
    });

    // Apply new filter (simulating FilterLibrary behavior)
    act(() => {
      const currentClip = result.current.getClipById('clip-1');
      const effects = currentClip?.effects || [];
      const filterIndex = effects.findIndex((e) => e.type === 'filter');

      const newFilter: FilterEffect = {
        id: 'filter-old', // Reuse same ID to replace
        type: 'filter',
        name: 'New Filter',
        enabled: true,
        parameters: {
          brightness: 110,
          contrast: 130,
          saturation: 90,
        },
      };

      const newEffects = [...effects];
      if (filterIndex >= 0) {
        newEffects[filterIndex] = newFilter;
      }

      result.current.updateClip('clip-1', { effects: newEffects });
    });

    // Verify filter was replaced
    const updatedClip = result.current.getClipById('clip-1');
    expect(updatedClip?.effects).toHaveLength(1);
    expect(updatedClip?.effects?.[0]).toMatchObject({
      type: 'filter',
      name: 'New Filter',
      parameters: {
        brightness: 110,
        contrast: 130,
        saturation: 90,
      },
    });
  });
});
