import React, { memo, useMemo } from 'react';
import type { TransitionConfig } from './types';
import './TransitionRenderer.css';

interface TransitionRendererProps {
  transition: TransitionConfig | null;
  currentTime: number;
  children: React.ReactNode;
}

/**
 * TransitionRenderer applies CSS-based transitions between clips
 * Supports fade, wipe (4 directions), and dissolve effects
 */
export const TransitionRenderer = memo<TransitionRendererProps>(({
  transition,
  currentTime,
  children,
}) => {
  // Calculate transition progress (0 to 1)
  const transitionState = useMemo(() => {
    if (!transition) {
      return { isActive: false, progress: 0 };
    }

    const transitionStartTime = transition.startTime;
    const transitionEndTime = transition.startTime + transition.duration;

    if (currentTime < transitionStartTime || currentTime > transitionEndTime) {
      return { isActive: false, progress: currentTime < transitionStartTime ? 0 : 1 };
    }

    const progress = (currentTime - transitionStartTime) / transition.duration;
    return { isActive: true, progress: Math.max(0, Math.min(1, progress)) };
  }, [transition, currentTime]);

  if (!transition || !transitionState.isActive) {
    return <>{children}</>;
  }

  const timingFunction = transition.timingFunction ?? 'ease';
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle}>
      {transition.type === 'fade' && (
        <FadeTransition progress={transitionState.progress} timingFunction={timingFunction}>
          {children}
        </FadeTransition>
      )}
      {transition.type === 'wipe-left' && (
        <WipeTransition progress={transitionState.progress} direction="left" timingFunction={timingFunction}>
          {children}
        </WipeTransition>
      )}
      {transition.type === 'wipe-right' && (
        <WipeTransition progress={transitionState.progress} direction="right" timingFunction={timingFunction}>
          {children}
        </WipeTransition>
      )}
      {transition.type === 'wipe-up' && (
        <WipeTransition progress={transitionState.progress} direction="up" timingFunction={timingFunction}>
          {children}
        </WipeTransition>
      )}
      {transition.type === 'wipe-down' && (
        <WipeTransition progress={transitionState.progress} direction="down" timingFunction={timingFunction}>
          {children}
        </WipeTransition>
      )}
      {transition.type === 'dissolve' && (
        <DissolveTransition progress={transitionState.progress} timingFunction={timingFunction}>
          {children}
        </DissolveTransition>
      )}
    </div>
  );
});

TransitionRenderer.displayName = 'TransitionRenderer';

/**
 * FadeTransition - Simple opacity fade
 */
const FadeTransition = memo<{
  progress: number;
  timingFunction: string;
  children: React.ReactNode;
}>(({ progress, timingFunction, children }) => {
  const opacity = applyEasing(progress, timingFunction);

  return (
    <div style={{ opacity, transition: 'opacity 0.016s linear' }}>
      {children}
    </div>
  );
});

FadeTransition.displayName = 'FadeTransition';

/**
 * WipeTransition - Directional wipe effect
 */
const WipeTransition = memo<{
  progress: number;
  direction: 'left' | 'right' | 'up' | 'down';
  timingFunction: string;
  children: React.ReactNode;
}>(({ progress, direction, timingFunction, children }) => {
  const easedProgress = applyEasing(progress, timingFunction);

  const getClipPath = () => {
    switch (direction) {
      case 'left':
        return `inset(0 ${100 - easedProgress * 100}% 0 0)`;
      case 'right':
        return `inset(0 0 0 ${100 - easedProgress * 100}%)`;
      case 'up':
        return `inset(${100 - easedProgress * 100}% 0 0 0)`;
      case 'down':
        return `inset(0 0 ${100 - easedProgress * 100}% 0)`;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        clipPath: getClipPath(),
        transition: 'clip-path 0.016s linear',
      }}
    >
      {children}
    </div>
  );
});

WipeTransition.displayName = 'WipeTransition';

/**
 * DissolveTransition - Pixelated dissolve effect using noise
 */
const DissolveTransition = memo<{
  progress: number;
  timingFunction: string;
  children: React.ReactNode;
}>(({ progress, timingFunction, children }) => {
  const easedProgress = applyEasing(progress, timingFunction);

  // Use CSS filter for dissolve effect
  const filter = `brightness(${1 + easedProgress * 0.2}) saturate(${1 - easedProgress * 0.3})`;

  return (
    <div
      style={{
        opacity: easedProgress,
        filter,
        transition: 'opacity 0.016s linear, filter 0.016s linear',
      }}
    >
      {children}
    </div>
  );
});

DissolveTransition.displayName = 'DissolveTransition';

/**
 * Apply easing function to progress value
 */
function applyEasing(progress: number, timingFunction: string): number {
  switch (timingFunction) {
    case 'linear':
      return progress;
    case 'ease':
      return easeInOutCubic(progress);
    case 'ease-in':
      return easeIn(progress);
    case 'ease-out':
      return easeOut(progress);
    case 'ease-in-out':
      return easeInOutCubic(progress);
    default:
      return progress;
  }
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return t * (2 - t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * TransitionPreview - Component for previewing transitions
 */
export const TransitionPreview = memo<{
  type: TransitionConfig['type'];
  duration: number;
}>(({ type, duration }) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const startTime = performance.now();
    let rafId: number;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        // Loop the preview
        setTimeout(() => {
          setProgress(0);
          rafId = requestAnimationFrame(animate);
        }, 500);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [duration, type]);

  const transition: TransitionConfig = {
    id: 'preview',
    type,
    duration,
    timingFunction: 'ease',
    startTime: 0,
  };

  return (
    <div style={{ width: 200, height: 150, backgroundColor: '#000', position: 'relative' }}>
      <TransitionRenderer transition={transition} currentTime={progress * duration}>
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
        }}>
          {type}
        </div>
      </TransitionRenderer>
    </div>
  );
});

TransitionPreview.displayName = 'TransitionPreview';
