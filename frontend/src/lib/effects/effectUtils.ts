/**
 * Utility functions for working with effects
 */

import type {
  Effect,
  FilterEffect,
  TransitionEffect,
  TextOverlayEffect,
  TransformEffect,
} from '@/types/effects';
import type { Clip } from '@/types';

/**
 * Apply CSS filter string from FilterEffect
 */
export const getFilterCSS = (filter: FilterEffect): string => {
  const filters: string[] = [];
  const params = filter.parameters;

  if (params.brightness !== undefined && params.brightness !== 100) {
    filters.push(`brightness(${params.brightness}%)`);
  }
  if (params.contrast !== undefined && params.contrast !== 100) {
    filters.push(`contrast(${params.contrast}%)`);
  }
  if (params.saturation !== undefined && params.saturation !== 100) {
    filters.push(`saturate(${params.saturation}%)`);
  }
  if (params.hue !== undefined && params.hue !== 0) {
    filters.push(`hue-rotate(${params.hue}deg)`);
  }
  if (params.blur !== undefined && params.blur > 0) {
    filters.push(`blur(${params.blur}px)`);
  }
  if (params.grayscale !== undefined && params.grayscale > 0) {
    filters.push(`grayscale(${params.grayscale}%)`);
  }
  if (params.sepia !== undefined && params.sepia > 0) {
    filters.push(`sepia(${params.sepia}%)`);
  }
  if (params.invert !== undefined && params.invert > 0) {
    filters.push(`invert(${params.invert}%)`);
  }

  return filters.join(' ');
};

/**
 * Get all active effects for a clip at a specific time
 */
export const getActiveEffects = (
  clip: Clip,
  currentTime: number
): Effect[] => {
  if (!clip.effects) return [];

  return clip.effects.filter((effect) => {
    if (!effect.enabled) return false;

    // For text overlays, check if current time is within their duration
    if (effect.type === 'textOverlay') {
      const textEffect = effect as TextOverlayEffect;
      const effectStart = clip.startTime + textEffect.startTime;
      const effectEnd = effectStart + textEffect.duration;
      return currentTime >= effectStart && currentTime <= effectEnd;
    }

    // Transitions apply at clip boundaries
    if (effect.type === 'transition') {
      const transition = effect as TransitionEffect;
      const transitionType = transition.transitionType;

      // Fade-in, zoom-in, wipe-* at the start
      if (
        transitionType === 'fade-in' ||
        transitionType === 'zoom-in' ||
        transitionType.startsWith('wipe-')
      ) {
        const transitionEnd = clip.startTime + transition.duration;
        return currentTime >= clip.startTime && currentTime <= transitionEnd;
      }

      // Fade-out, zoom-out at the end
      if (transitionType === 'fade-out' || transitionType === 'zoom-out') {
        const transitionStart = clip.endTime - transition.duration;
        return currentTime >= transitionStart && currentTime <= clip.endTime;
      }

      // Crossfade and dissolve apply at both boundaries
      if (transitionType === 'crossfade' || transitionType === 'dissolve') {
        const startTransitionEnd = clip.startTime + transition.duration;
        const endTransitionStart = clip.endTime - transition.duration;
        return (
          (currentTime >= clip.startTime && currentTime <= startTransitionEnd) ||
          (currentTime >= endTransitionStart && currentTime <= clip.endTime)
        );
      }
    }

    // Filters and transforms apply to the entire clip
    return true;
  });
};

/**
 * Calculate transition opacity at a specific time
 */
export const getTransitionOpacity = (
  transition: TransitionEffect,
  clip: Clip,
  currentTime: number
): number => {
  const { transitionType, duration } = transition;

  // Fade-in
  if (transitionType === 'fade-in') {
    const progress = (currentTime - clip.startTime) / duration;
    return Math.min(1, Math.max(0, progress));
  }

  // Fade-out
  if (transitionType === 'fade-out') {
    const transitionStart = clip.endTime - duration;
    const progress = (currentTime - transitionStart) / duration;
    return Math.max(0, Math.min(1, 1 - progress));
  }

  // Crossfade (handles both in and out)
  if (transitionType === 'crossfade') {
    // Fade in at start
    if (currentTime < clip.startTime + duration) {
      const progress = (currentTime - clip.startTime) / duration;
      return Math.min(1, Math.max(0, progress));
    }
    // Fade out at end
    if (currentTime > clip.endTime - duration) {
      const transitionStart = clip.endTime - duration;
      const progress = (currentTime - transitionStart) / duration;
      return Math.max(0, Math.min(1, 1 - progress));
    }
  }

  return 1;
};

/**
 * Calculate transition transform CSS at a specific time
 */
export const getTransitionTransform = (
  transition: TransitionEffect,
  clip: Clip,
  currentTime: number
): string => {
  const { transitionType, duration } = transition;
  let progress = 0;

  // Calculate progress based on transition type
  if (
    transitionType === 'fade-in' ||
    transitionType === 'zoom-in' ||
    transitionType.startsWith('wipe-')
  ) {
    progress = Math.min(1, Math.max(0, (currentTime - clip.startTime) / duration));
  } else if (transitionType === 'fade-out' || transitionType === 'zoom-out') {
    const transitionStart = clip.endTime - duration;
    progress = Math.min(1, Math.max(0, (currentTime - transitionStart) / duration));
  }

  // Apply easing
  progress = applyEasing(progress, transition.easing);

  // Generate transform based on type
  switch (transitionType) {
    case 'zoom-in':
      const scaleIn = 0.5 + progress * 0.5; // Scale from 0.5 to 1
      return `scale(${scaleIn})`;

    case 'zoom-out':
      const scaleOut = 1 - progress * 0.5; // Scale from 1 to 0.5
      return `scale(${scaleOut})`;

    case 'wipe-left':
      const translateLeft = (1 - progress) * 100;
      return `translateX(${translateLeft}%)`;

    case 'wipe-right':
      const translateRight = (1 - progress) * -100;
      return `translateX(${translateRight}%)`;

    case 'wipe-up':
      const translateUp = (1 - progress) * 100;
      return `translateY(${translateUp}%)`;

    case 'wipe-down':
      const translateDown = (1 - progress) * -100;
      return `translateY(${translateDown}%)`;

    default:
      return '';
  }
};

/**
 * Apply easing function to progress value
 */
export const applyEasing = (
  t: number,
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
): number => {
  t = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t;
  }
};

/**
 * Get text overlay style object for rendering
 */
export const getTextOverlayStyle = (
  textEffect: TextOverlayEffect,
  currentTime: number,
  clip: Clip
): React.CSSProperties => {
  const style = textEffect.style;
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${textEffect.position.x}%`,
    top: `${textEffect.position.y}%`,
    transform: 'translate(-50%, -50%)',
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    color: style.color,
    backgroundColor: style.backgroundColor || 'transparent',
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textAlign: style.textAlign,
    padding: style.padding ? `${style.padding}px` : undefined,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    textShadow: style.textShadow
      ? `${style.textShadow.offsetX}px ${style.textShadow.offsetY}px ${style.textShadow.blur}px ${style.textShadow.color}`
      : undefined,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };

  // Apply animation if present
  if (textEffect.animation) {
    const effectStart = clip.startTime + textEffect.startTime;
    const animationDelay = textEffect.animation.delay || 0;
    const animationStart = effectStart + animationDelay;
    const animationEnd = animationStart + textEffect.animation.duration;

    if (currentTime >= animationStart && currentTime <= animationEnd) {
      const progress = (currentTime - animationStart) / textEffect.animation.duration;
      const easedProgress = applyEasing(progress, 'easeOut');

      switch (textEffect.animation.type) {
        case 'fade-in':
          baseStyle.opacity = easedProgress;
          break;
        case 'fade-out':
          baseStyle.opacity = 1 - easedProgress;
          break;
        case 'slide-left':
          baseStyle.transform = `translate(calc(-50% + ${(1 - easedProgress) * 100}px), -50%)`;
          break;
        case 'slide-right':
          baseStyle.transform = `translate(calc(-50% - ${(1 - easedProgress) * 100}px), -50%)`;
          break;
        case 'slide-up':
          baseStyle.transform = `translate(-50%, calc(-50% + ${(1 - easedProgress) * 100}px))`;
          break;
        case 'slide-down':
          baseStyle.transform = `translate(-50%, calc(-50% - ${(1 - easedProgress) * 100}px))`;
          break;
        case 'zoom-in':
          const zoomInScale = 0.5 + easedProgress * 0.5;
          baseStyle.transform = `translate(-50%, -50%) scale(${zoomInScale})`;
          break;
        case 'zoom-out':
          const zoomOutScale = 1 - easedProgress * 0.5;
          baseStyle.transform = `translate(-50%, -50%) scale(${zoomOutScale})`;
          break;
      }
    } else if (currentTime < animationStart) {
      // Before animation starts
      if (textEffect.animation.type.includes('fade')) {
        baseStyle.opacity = 0;
      }
    }
  }

  return baseStyle;
};

/**
 * Check if an effect is applicable at a given time
 */
export const isEffectActive = (
  effect: Effect,
  clip: Clip,
  currentTime: number
): boolean => {
  if (!effect.enabled) return false;

  const activeEffects = getActiveEffects(clip, currentTime);
  return activeEffects.some((e) => e.id === effect.id);
};

/**
 * Generate a unique effect ID
 */
export const generateEffectId = (): string => {
  return `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
