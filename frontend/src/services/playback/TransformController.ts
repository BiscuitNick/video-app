import type { Clip } from '@/types';

/**
 * Keyframe for transform animations
 */
export interface TransformKeyframe {
  frame: number;
  time: number;
  opacity?: number; // 0-1
  scale?: number; // 0.1-2.0
  scaleX?: number;
  scaleY?: number;
  translateX?: number; // pixels or percentage
  translateY?: number;
  rotation?: number; // degrees
  easing?: EasingFunction;
}

/**
 * Transform properties that can be animated
 */
export interface TransformProperties {
  opacity: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

/**
 * Easing function type
 */
export type EasingFunction =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic';

/**
 * Transform calculation result
 */
export interface TransformResult {
  cssTransform: string;
  opacity: number;
  willChange: string;
}

/**
 * TransformController manages CSS transforms for video clips with keyframe interpolation
 * Optimized for performance using transform3d and will-change
 */
export class TransformController {
  private keyframes: Map<string, TransformKeyframe[]> = new Map();
  private batchedTransforms: Map<HTMLElement, TransformResult> = new Map();
  private rafId: number | null = null;

  /**
   * Default transform properties
   */
  private static DEFAULT_TRANSFORM: TransformProperties = {
    opacity: 1.0,
    scale: 1.0,
    scaleX: 1.0,
    scaleY: 1.0,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  };

  /**
   * Set keyframes for a clip
   */
  setKeyframes(clipId: string, keyframes: TransformKeyframe[]): void {
    // Sort keyframes by frame
    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    this.keyframes.set(clipId, sorted);
  }

  /**
   * Get keyframes for a clip
   */
  getKeyframes(clipId: string): TransformKeyframe[] {
    return this.keyframes.get(clipId) || [];
  }

  /**
   * Clear keyframes for a clip
   */
  clearKeyframes(clipId: string): void {
    this.keyframes.delete(clipId);
  }

  /**
   * Calculate interpolated transform properties at a given frame
   */
  calculateTransform(clip: Clip, currentFrame: number): TransformProperties {
    const keyframes = this.keyframes.get(clip.id);

    if (!keyframes || keyframes.length === 0) {
      return { ...TransformController.DEFAULT_TRANSFORM };
    }

    // Find surrounding keyframes
    const { before, after } = this.findSurroundingKeyframes(keyframes, currentFrame);

    if (!before && !after) {
      return { ...TransformController.DEFAULT_TRANSFORM };
    }

    if (!after || before?.frame === currentFrame) {
      // Use before keyframe directly
      return this.keyframeToProperties(before!);
    }

    if (!before || after.frame === currentFrame) {
      // Use after keyframe directly
      return this.keyframeToProperties(after);
    }

    // Interpolate between keyframes
    return this.interpolateKeyframes(before, after, currentFrame);
  }

  /**
   * Find keyframes surrounding the current frame
   */
  private findSurroundingKeyframes(
    keyframes: TransformKeyframe[],
    currentFrame: number
  ): { before: TransformKeyframe | null; after: TransformKeyframe | null } {
    let before: TransformKeyframe | null = null;
    let after: TransformKeyframe | null = null;

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];

      if (kf.frame <= currentFrame) {
        before = kf;
      }

      if (kf.frame >= currentFrame) {
        after = kf;
        break;
      }
    }

    return { before, after };
  }

  /**
   * Convert keyframe to full transform properties
   */
  private keyframeToProperties(keyframe: TransformKeyframe): TransformProperties {
    return {
      opacity: keyframe.opacity ?? TransformController.DEFAULT_TRANSFORM.opacity,
      scale: keyframe.scale ?? TransformController.DEFAULT_TRANSFORM.scale,
      scaleX: keyframe.scaleX ?? keyframe.scale ?? TransformController.DEFAULT_TRANSFORM.scaleX,
      scaleY: keyframe.scaleY ?? keyframe.scale ?? TransformController.DEFAULT_TRANSFORM.scaleY,
      translateX: keyframe.translateX ?? TransformController.DEFAULT_TRANSFORM.translateX,
      translateY: keyframe.translateY ?? TransformController.DEFAULT_TRANSFORM.translateY,
      rotation: keyframe.rotation ?? TransformController.DEFAULT_TRANSFORM.rotation,
    };
  }

  /**
   * Interpolate between two keyframes
   */
  private interpolateKeyframes(
    before: TransformKeyframe,
    after: TransformKeyframe,
    currentFrame: number
  ): TransformProperties {
    const frameDelta = after.frame - before.frame;
    const progress = (currentFrame - before.frame) / frameDelta;

    // Apply easing function
    const easedProgress = this.applyEasing(progress, after.easing || 'linear');

    const beforeProps = this.keyframeToProperties(before);
    const afterProps = this.keyframeToProperties(after);

    return {
      opacity: this.lerp(beforeProps.opacity, afterProps.opacity, easedProgress),
      scale: this.lerp(beforeProps.scale, afterProps.scale, easedProgress),
      scaleX: this.lerp(beforeProps.scaleX, afterProps.scaleX, easedProgress),
      scaleY: this.lerp(beforeProps.scaleY, afterProps.scaleY, easedProgress),
      translateX: this.lerp(beforeProps.translateX, afterProps.translateX, easedProgress),
      translateY: this.lerp(beforeProps.translateY, afterProps.translateY, easedProgress),
      rotation: this.lerp(beforeProps.rotation, afterProps.rotation, easedProgress),
    };
  }

  /**
   * Linear interpolation
   */
  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Apply easing function to progress value
   */
  private applyEasing(t: number, easing: EasingFunction): number {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    switch (easing) {
      case 'linear':
        return t;

      case 'easeIn':
        return t * t;

      case 'easeOut':
        return t * (2 - t);

      case 'easeInOut':
        return t < 0.5
          ? 2 * t * t
          : -1 + (4 - 2 * t) * t;

      case 'easeInCubic':
        return t * t * t;

      case 'easeOutCubic':
        return (--t) * t * t + 1;

      case 'easeInOutCubic':
        return t < 0.5
          ? 4 * t * t * t
          : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

      default:
        return t;
    }
  }

  /**
   * Convert transform properties to CSS transform string
   */
  toCSSTransform(props: TransformProperties): TransformResult {
    // Use transform3d for GPU acceleration
    const transform = [
      `translate3d(${props.translateX}px, ${props.translateY}px, 0)`,
      `scale3d(${props.scaleX}, ${props.scaleY}, 1)`,
      `rotate(${props.rotation}deg)`,
    ].join(' ');

    // Determine which properties will change
    const willChangeProps = ['transform'];
    if (props.opacity < 1.0) {
      willChangeProps.push('opacity');
    }

    return {
      cssTransform: transform,
      opacity: props.opacity,
      willChange: willChangeProps.join(', '),
    };
  }

  /**
   * Apply transform to a video element
   */
  applyTransform(element: HTMLElement, clip: Clip, currentFrame: number): void {
    const props = this.calculateTransform(clip, currentFrame);
    const result = this.toCSSTransform(props);

    // Batch the transform for RAF
    this.batchedTransforms.set(element, result);

    // Schedule RAF if not already scheduled
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flushTransforms());
    }
  }

  /**
   * Apply transform immediately (bypassing batching)
   */
  applyTransformImmediate(element: HTMLElement, clip: Clip, currentFrame: number): void {
    const props = this.calculateTransform(clip, currentFrame);
    const result = this.toCSSTransform(props);
    this.applyTransformResult(element, result);
  }

  /**
   * Flush batched transforms to DOM
   */
  private flushTransforms(): void {
    this.rafId = null;

    this.batchedTransforms.forEach((result, element) => {
      this.applyTransformResult(element, result);
    });

    this.batchedTransforms.clear();
  }

  /**
   * Apply transform result to element
   */
  private applyTransformResult(element: HTMLElement, result: TransformResult): void {
    element.style.transform = result.cssTransform;
    element.style.opacity = result.opacity.toString();
    element.style.willChange = result.willChange;
  }

  /**
   * Create a simple fade-in keyframe animation
   */
  static createFadeIn(startFrame: number, durationFrames: number): TransformKeyframe[] {
    return [
      { frame: startFrame, time: 0, opacity: 0, easing: 'easeOut' },
      { frame: startFrame + durationFrames, time: 0, opacity: 1 },
    ];
  }

  /**
   * Create a simple fade-out keyframe animation
   */
  static createFadeOut(startFrame: number, durationFrames: number): TransformKeyframe[] {
    return [
      { frame: startFrame, time: 0, opacity: 1, easing: 'easeIn' },
      { frame: startFrame + durationFrames, time: 0, opacity: 0 },
    ];
  }

  /**
   * Create a zoom-in keyframe animation
   */
  static createZoomIn(startFrame: number, durationFrames: number): TransformKeyframe[] {
    return [
      { frame: startFrame, time: 0, scale: 0.5, opacity: 0, easing: 'easeOut' },
      { frame: startFrame + durationFrames, time: 0, scale: 1.0, opacity: 1 },
    ];
  }

  /**
   * Create a slide-in keyframe animation
   */
  static createSlideIn(
    startFrame: number,
    durationFrames: number,
    direction: 'left' | 'right' | 'top' | 'bottom',
    distance: number = 100
  ): TransformKeyframe[] {
    const start: TransformKeyframe = {
      frame: startFrame,
      time: 0,
      opacity: 0,
      easing: 'easeOut'
    };
    const end: TransformKeyframe = {
      frame: startFrame + durationFrames,
      time: 0,
      opacity: 1,
      translateX: 0,
      translateY: 0,
    };

    switch (direction) {
      case 'left':
        start.translateX = -distance;
        break;
      case 'right':
        start.translateX = distance;
        break;
      case 'top':
        start.translateY = -distance;
        break;
      case 'bottom':
        start.translateY = distance;
        break;
    }

    return [start, end];
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.keyframes.clear();
    this.batchedTransforms.clear();
  }
}
