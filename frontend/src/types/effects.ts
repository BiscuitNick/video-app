/**
 * Effect types and interfaces for the video editor
 */

/**
 * Base effect interface
 */
export interface BaseEffect {
  id: string;
  type: EffectType;
  enabled: boolean;
  name: string;
}

/**
 * Effect type enumeration
 */
export type EffectType =
  | 'transition'
  | 'filter'
  | 'textOverlay'
  | 'transform';

/**
 * Transition types
 */
export type TransitionType =
  | 'fade-in'
  | 'fade-out'
  | 'crossfade'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'dissolve';

/**
 * Transition effect
 */
export interface TransitionEffect extends BaseEffect {
  type: 'transition';
  transitionType: TransitionType;
  duration: number; // in seconds
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/**
 * Filter effect for video adjustments
 */
export interface FilterEffect extends BaseEffect {
  type: 'filter';
  parameters: {
    brightness?: number; // 0-200, default 100
    contrast?: number; // 0-200, default 100
    saturation?: number; // 0-200, default 100
    hue?: number; // 0-360, default 0
    blur?: number; // 0-10, default 0
    grayscale?: number; // 0-100, default 0
    sepia?: number; // 0-100, default 0
    invert?: number; // 0-100, default 0
  };
}

/**
 * Text animation types
 */
export type TextAnimationType =
  | 'none'
  | 'fade-in'
  | 'fade-out'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out';

/**
 * Text overlay effect
 */
export interface TextOverlayEffect extends BaseEffect {
  type: 'textOverlay';
  text: string;
  position: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
  };
  style: {
    fontFamily: string;
    fontSize: number; // in pixels
    color: string; // hex color
    backgroundColor?: string; // hex color
    fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    textShadow?: {
      offsetX: number;
      offsetY: number;
      blur: number;
      color: string;
    };
    padding?: number;
    borderRadius?: number;
  };
  animation?: {
    type: TextAnimationType;
    duration: number; // in seconds
    delay?: number; // in seconds
  };
  startTime: number; // relative to clip start, in seconds
  duration: number; // in seconds
}

/**
 * Transform effect (uses TransformController)
 */
export interface TransformEffect extends BaseEffect {
  type: 'transform';
  keyframes: Array<{
    time: number; // in seconds relative to clip start
    opacity?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    translateX?: number;
    translateY?: number;
    rotation?: number;
  }>;
}

/**
 * Union type for all effects
 */
export type Effect =
  | TransitionEffect
  | FilterEffect
  | TextOverlayEffect
  | TransformEffect;

/**
 * Effect template for the library
 */
export interface EffectTemplate {
  id: string;
  name: string;
  description: string;
  type: EffectType;
  thumbnail?: string;
  category?: string;
  createEffect: () => Omit<Effect, 'id' | 'enabled'>;
}

/**
 * Effect library category
 */
export interface EffectCategory {
  id: string;
  name: string;
  templates: EffectTemplate[];
}
