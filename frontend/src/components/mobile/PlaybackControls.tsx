import React, { useCallback, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

interface PlaybackControlsProps {
  className?: string;
  size?: 'default' | 'large';
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  className,
  size = 'large',
}) => {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const duration = usePlaybackStore((state) => state.duration);
  const play = usePlaybackStore((state) => state.play);
  const pause = usePlaybackStore((state) => state.pause);
  const seek = usePlaybackStore((state) => state.seek);
  const stop = usePlaybackStore((state) => state.stop);

  const { vibrate, patterns } = useHaptics();
  const lastTapRef = useRef<number>(0);
  const [showDoubleTapFeedback, setShowDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Button sizes
  const buttonSizes = {
    default: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const iconSizes = {
    default: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const buttonSize = buttonSizes[size];
  const iconSize = iconSizes[size];

  // Play/Pause toggle
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
      patterns.medium();
    } else {
      play();
      patterns.medium();
    }
  }, [isPlaying, play, pause, patterns]);

  // Skip forward/backward
  const handleSkipBackward = useCallback(() => {
    seek(Math.max(0, currentTime - 10));
    patterns.light();
  }, [currentTime, seek, patterns]);

  const handleSkipForward = useCallback(() => {
    seek(Math.min(duration, currentTime + 10));
    patterns.light();
  }, [currentTime, duration, seek, patterns]);

  // Stop playback
  const handleStop = useCallback(() => {
    stop();
    patterns.strong();
  }, [stop, patterns]);

  // Double-tap to skip (used with gesture detection)
  const handleDoubleTap = useCallback((direction: 'left' | 'right') => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      // Double tap detected
      patterns.doubleTap();

      if (direction === 'left') {
        handleSkipBackward();
        setShowDoubleTapFeedback('left');
      } else {
        handleSkipForward();
        setShowDoubleTapFeedback('right');
      }

      setTimeout(() => setShowDoubleTapFeedback(null), 500);
    }

    lastTapRef.current = now;
  }, [handleSkipBackward, handleSkipForward, patterns]);

  return (
    <div className={cn('relative', className)}>
      {/* Double-tap feedback */}
      {showDoubleTapFeedback && (
        <div
          className={cn(
            'absolute inset-0 pointer-events-none flex items-center justify-center',
            'animate-fade-in'
          )}
        >
          <div className="bg-black/70 rounded-full px-6 py-3">
            <span className="mobile-text-base text-white font-medium">
              {showDoubleTapFeedback === 'left' ? '⏪ -10s' : '+10s ⏩'}
            </span>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Skip Backward */}
        <button
          onClick={handleSkipBackward}
          onDoubleClick={() => handleDoubleTap('left')}
          className={cn(
            buttonSize,
            'touch-target flex items-center justify-center',
            'bg-zinc-700 hover:bg-zinc-600 rounded-full',
            'transition-all active:scale-95 active:bg-zinc-500',
            'text-zinc-200'
          )}
          aria-label="Skip backward 10 seconds"
        >
          <SkipBack className={iconSize} />
        </button>

        {/* Play/Pause (Primary Action) */}
        <button
          onClick={handlePlayPause}
          className={cn(
            size === 'large' ? 'w-20 h-20' : 'w-16 h-16',
            'touch-target flex items-center justify-center',
            'bg-blue-600 hover:bg-blue-500 rounded-full',
            'transition-all active:scale-95 active:bg-blue-400',
            'text-white shadow-lg'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className={size === 'large' ? 'w-10 h-10' : 'w-8 h-8'} fill="currentColor" />
          ) : (
            <Play className={size === 'large' ? 'w-10 h-10' : 'w-8 h-8'} fill="currentColor" />
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={handleSkipForward}
          onDoubleClick={() => handleDoubleTap('right')}
          className={cn(
            buttonSize,
            'touch-target flex items-center justify-center',
            'bg-zinc-700 hover:bg-zinc-600 rounded-full',
            'transition-all active:scale-95 active:bg-zinc-500',
            'text-zinc-200'
          )}
          aria-label="Skip forward 10 seconds"
        >
          <SkipForward className={iconSize} />
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          className={cn(
            buttonSize,
            'touch-target flex items-center justify-center',
            'bg-zinc-700 hover:bg-zinc-600 rounded-full',
            'transition-all active:scale-95 active:bg-zinc-500',
            'text-zinc-200'
          )}
          aria-label="Stop playback"
        >
          <Square className={iconSize} />
        </button>
      </div>
    </div>
  );
};
