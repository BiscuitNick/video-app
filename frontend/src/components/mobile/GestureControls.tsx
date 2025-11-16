import React, { useRef, useCallback, useState } from 'react';
import { Scissors, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

interface GestureControlsProps {
  children: React.ReactNode;
  onSplit?: (time: number) => void;
  className?: string;
  enableDoubleTapPlayPause?: boolean;
  enableTwoFingerScrub?: boolean;
  enableSplitGesture?: boolean;
}

export const GestureControls: React.FC<GestureControlsProps> = ({
  children,
  onSplit,
  className,
  enableDoubleTapPlayPause = true,
  enableTwoFingerScrub = true,
  enableSplitGesture = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapTimeRef = useRef<number>(0);
  const twoFingerStartRef = useRef<{ time: number; distance: number } | null>(null);

  const [gestureIndicator, setGestureIndicator] = useState<{
    type: 'play' | 'pause' | 'split' | 'scrub';
    position?: { x: number; y: number };
  } | null>(null);

  const { vibrate, patterns } = useHaptics();

  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const play = usePlaybackStore((state) => state.play);
  const pause = usePlaybackStore((state) => state.pause);
  const seek = usePlaybackStore((state) => state.seek);
  const currentTime = usePlaybackStore((state) => state.currentTime);

  // Double-tap to play/pause
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    if (!enableDoubleTapPlayPause) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      e.preventDefault();

      if (isPlaying) {
        pause();
        setGestureIndicator({ type: 'pause' });
        patterns.medium();
      } else {
        play();
        setGestureIndicator({ type: 'play' });
        patterns.medium();
      }

      setTimeout(() => setGestureIndicator(null), 500);
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  }, [enableDoubleTapPlayPause, isPlaying, play, pause, patterns]);

  // Get distance between two touches
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getTouchCenter = (touch1: Touch, touch2: Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers - prepare for scrub or split
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      twoFingerStartRef.current = {
        time: Date.now(),
        distance,
      };
    }
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && twoFingerStartRef.current && enableTwoFingerScrub) {
      // Two-finger scrub
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      const distance = getTouchDistance(e.touches[0], e.touches[1]);

      // Check if it's a scrub gesture (horizontal movement)
      const movement = Math.abs(e.touches[0].clientX - e.touches[1].clientX);

      if (movement > 50) {
        // Scrub detected
        e.preventDefault();

        // Calculate scrub delta
        const deltaX = e.touches[0].clientX - e.touches[1].clientX;
        const scrubAmount = deltaX / 100; // Adjust sensitivity

        seek(Math.max(0, currentTime + scrubAmount));

        setGestureIndicator({
          type: 'scrub',
          position: center,
        });

        patterns.light();
      }
    }
  }, [enableTwoFingerScrub, currentTime, seek, patterns]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (twoFingerStartRef.current && e.touches.length === 0) {
      // Two fingers lifted - check for split gesture
      const duration = Date.now() - twoFingerStartRef.current.time;

      if (duration < 200 && enableSplitGesture) {
        // Quick two-finger tap = split
        e.preventDefault();

        const splitTime = currentTime;
        onSplit?.(splitTime);

        setGestureIndicator({
          type: 'split',
          position: {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          },
        });

        patterns.strong();

        setTimeout(() => setGestureIndicator(null), 800);
      }

      twoFingerStartRef.current = null;
    }

    // Clear scrub indicator
    if (gestureIndicator?.type === 'scrub') {
      setTimeout(() => setGestureIndicator(null), 200);
    }
  }, [enableSplitGesture, currentTime, onSplit, patterns, gestureIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Convert to TouchEvent-like for double-tap
        const touchEvent = {
          preventDefault: () => e.preventDefault(),
        } as React.TouchEvent;
        handleDoubleTap(touchEvent);
      }}
    >
      {children}

      {/* Gesture Indicator Overlay */}
      {gestureIndicator && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div
            className="bg-black/70 rounded-2xl px-8 py-6 shadow-2xl animate-fade-in"
            style={
              gestureIndicator.position
                ? {
                    position: 'fixed',
                    left: gestureIndicator.position.x,
                    top: gestureIndicator.position.y,
                    transform: 'translate(-50%, -50%)',
                  }
                : {}
            }
          >
            {gestureIndicator.type === 'play' && (
              <Play className="w-16 h-16 text-white" fill="currentColor" />
            )}
            {gestureIndicator.type === 'pause' && (
              <Pause className="w-16 h-16 text-white" fill="currentColor" />
            )}
            {gestureIndicator.type === 'split' && (
              <div className="flex flex-col items-center gap-2">
                <Scissors className="w-16 h-16 text-white" />
                <span className="mobile-text-sm text-white font-medium">Split Clip</span>
              </div>
            )}
            {gestureIndicator.type === 'scrub' && (
              <div className="flex items-center gap-2">
                <span className="mobile-text-lg text-white font-medium">
                  Scrubbing...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
