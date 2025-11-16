/**
 * Demo component showing how to use the EffectsPanel
 */

import React, { useEffect } from 'react';
import { EffectsPanel } from './EffectsPanel';
import { useTimelineStore } from '@/stores/useTimelineStore';
import type { Track, Clip } from '@/types';

/**
 * Demo wrapper component that sets up sample data and demonstrates
 * the EffectsPanel functionality
 */
export const EffectsPanelDemo: React.FC = () => {
  const addTrack = useTimelineStore((state) => state.addTrack);
  const addClip = useTimelineStore((state) => state.addClip);
  const selectClip = useTimelineStore((state) => state.selectClip);

  useEffect(() => {
    // Set up demo data on mount
    const demoTrack: Track = {
      id: 'demo-track-1',
      name: 'Video Track 1',
      type: 'video',
      clips: [],
      muted: false,
      locked: false,
      visible: true,
      height: 60,
    };

    const demoClip: Clip = {
      id: 'demo-clip-1',
      trackId: 'demo-track-1',
      mediaAssetId: 'demo-media-1',
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

    // Add track and clip
    addTrack(demoTrack);
    addClip(demoClip);

    // Select the clip automatically
    selectClip(demoClip.id);
  }, [addTrack, addClip, selectClip]);

  return (
    <div className="p-4 h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Effects Panel Demo</h1>
        <p className="text-muted-foreground mb-6">
          This demo shows the Effects Panel with a sample clip selected. Try adding
          transitions, filters, and text overlays!
        </p>
        <EffectsPanel />
      </div>
    </div>
  );
};

/**
 * Usage Example:
 *
 * Basic integration:
 * ```tsx
 * import { EffectsPanel } from '@/components/effects';
 *
 * function MyEditor() {
 *   return (
 *     <div className="editor-layout">
 *       <div className="sidebar">
 *         <EffectsPanel />
 *       </div>
 *       <div className="timeline">
 *         <Timeline />
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * The EffectsPanel automatically:
 * - Reads the selected clip from useTimelineStore
 * - Updates clip effects when user applies them
 * - Manages effect preview and properties
 * - Handles drag-and-drop (future enhancement)
 *
 * Supported Effects:
 *
 * 1. Transitions:
 *    - Fade In/Out
 *    - Crossfade
 *    - Wipe (Left/Right/Up/Down)
 *    - Zoom In/Out
 *    - Dissolve
 *
 * 2. Filters:
 *    - Brightness (0-200%)
 *    - Contrast (0-200%)
 *    - Saturation (0-200%)
 *    - Hue Rotation (0-360°)
 *    - Blur (0-10px)
 *    - Grayscale (0-100%)
 *    - Sepia (0-100%)
 *    - Invert (0-100%)
 *
 * 3. Text Overlays:
 *    - Custom text content
 *    - Font family, size, weight, style
 *    - Color and background color
 *    - Position (X/Y coordinates)
 *    - Text shadow (offset, blur, color)
 *    - Animations (fade, slide, zoom)
 *    - Timing control (start time, duration)
 *
 * Effect Application:
 *
 * Effects are stored in the clip's effects array:
 * ```typescript
 * clip.effects = [
 *   {
 *     id: 'effect-1',
 *     type: 'transition',
 *     name: 'Fade In',
 *     enabled: true,
 *     transitionType: 'fade-in',
 *     duration: 1.0,
 *     easing: 'easeInOut',
 *   },
 *   {
 *     id: 'effect-2',
 *     type: 'filter',
 *     name: 'Video Filter',
 *     enabled: true,
 *     parameters: {
 *       brightness: 120,
 *       contrast: 110,
 *       saturation: 90,
 *     },
 *   },
 * ];
 * ```
 *
 * Rendering Effects:
 *
 * Use the effect utilities to apply effects during playback:
 * ```typescript
 * import {
 *   getFilterCSS,
 *   getTransitionOpacity,
 *   getTransitionTransform,
 *   getTextOverlayStyle,
 * } from '@/lib/effects/effectUtils';
 *
 * // In your video renderer:
 * const filterEffect = clip.effects.find(e => e.type === 'filter');
 * const transitionEffect = clip.effects.find(e => e.type === 'transition');
 *
 * // Apply filter
 * if (filterEffect) {
 *   videoElement.style.filter = getFilterCSS(filterEffect);
 * }
 *
 * // Apply transition
 * if (transitionEffect) {
 *   const opacity = getTransitionOpacity(transitionEffect, clip, currentTime);
 *   const transform = getTransitionTransform(transitionEffect, clip, currentTime);
 *   videoElement.style.opacity = opacity.toString();
 *   videoElement.style.transform = transform;
 * }
 *
 * // Render text overlays
 * const textOverlays = clip.effects.filter(e => e.type === 'textOverlay');
 * textOverlays.forEach(textEffect => {
 *   const style = getTextOverlayStyle(textEffect, currentTime, clip);
 *   // Render text element with style
 * });
 * ```
 *
 * Integration with TransformController:
 *
 * For more advanced animations, combine with TransformController:
 * ```typescript
 * import { TransformController } from '@/services/playback/TransformController';
 *
 * const controller = new TransformController();
 *
 * // Create keyframes from transition
 * if (transition.transitionType === 'fade-in') {
 *   const keyframes = TransformController.createFadeIn(0, 60); // 60 frames
 *   controller.setKeyframes(clip.id, keyframes);
 * }
 *
 * // Apply during playback
 * controller.applyTransform(videoElement, clip, currentFrame);
 * ```
 */
