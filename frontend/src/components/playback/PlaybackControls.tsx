import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PlaybackControlsState } from './types';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  state: PlaybackControlsState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSeekToFrame: (frame: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onFrameStep: (direction: 'forward' | 'backward') => void;
  fps?: number;
}

/**
 * PlaybackControls component provides comprehensive playback control interface
 */
export const PlaybackControls = memo<PlaybackControlsProps>(({
  state,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSeekToFrame,
  onPlaybackRateChange,
  onFrameStep,
  fps = 30,
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (state.isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [state.isPlaying, onPlay, onPause]);

  // Handle timeline scrubbing
  const handleScrubStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    handleScrubMove(e);
  }, []);

  const handleScrubMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;

    const rect = scrubberRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    const newTime = progress * state.duration;

    onSeek(newTime);
  }, [state.duration, onSeek]);

  const handleScrubEnd = useCallback(() => {
    setIsScrubbing(false);
  }, []);

  // Mouse move and up handlers for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrubberRef.current) return;

      const rect = scrubberRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const progress = x / rect.width;
      const newTime = progress * state.duration;

      onSeek(newTime);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, state.duration, onSeek]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space bar - play/pause
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handlePlayPause();
      }
      // Left arrow - previous frame
      else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onFrameStep('backward');
      }
      // Right arrow - next frame
      else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onFrameStep('forward');
      }
      // Home - jump to start
      else if (e.code === 'Home') {
        e.preventDefault();
        onSeek(0);
      }
      // End - jump to end
      else if (e.code === 'End') {
        e.preventDefault();
        onSeek(state.duration);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlayPause, onFrameStep, onSeek, state.duration]);

  // Format time as HH:MM:SS:FF
  const formatTime = useCallback((time: number, currentFrame: number) => {
    const totalSeconds = Math.floor(time);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const frames = currentFrame % fps;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }, [fps]);

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="playback-controls">
      <div className="playback-controls-top">
        {/* Timeline Scrubber */}
        <div className="timeline-container">
          <div
            ref={scrubberRef}
            className="timeline-scrubber"
            onMouseDown={handleScrubStart}
          >
            <div className="timeline-track">
              <div className="timeline-progress" style={{ width: `${progress}%` }} />
            </div>
            <div
              className="timeline-handle"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="playback-controls-bottom">
        {/* Transport Controls */}
        <div className="transport-controls">
          {/* Stop */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            title="Stop (Ctrl+.)"
          >
            <StopIcon />
          </Button>

          {/* Previous Frame */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFrameStep('backward')}
            title="Previous Frame (Left Arrow)"
          >
            <SkipBackIcon />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="default"
            size="sm"
            onClick={handlePlayPause}
            title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {state.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>

          {/* Next Frame */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFrameStep('forward')}
            title="Next Frame (Right Arrow)"
          >
            <SkipForwardIcon />
          </Button>
        </div>

        {/* Time Display */}
        <div className="time-display">
          <span className="current-time">
            {formatTime(state.currentTime, state.currentFrame)}
          </span>
          <span className="time-separator">/</span>
          <span className="total-time">
            {formatTime(state.duration, state.totalFrames)}
          </span>
        </div>

        {/* Playback Rate Selector */}
        <div className="playback-rate-selector">
          <Select
            value={state.playbackRate.toString()}
            onValueChange={(value) => onPlaybackRateChange(parseFloat(value))}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">0.25x</SelectItem>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="0.75">0.75x</SelectItem>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="1.25">1.25x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jump Controls */}
        <div className="jump-controls">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSeek(Math.max(0, state.currentTime - 1))}
            title="Jump Back 1s"
          >
            -1s
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSeek(Math.min(state.duration, state.currentTime + 1))}
            title="Jump Forward 1s"
          >
            +1s
          </Button>
        </div>
      </div>
    </div>
  );
});

PlaybackControls.displayName = 'PlaybackControls';

// Icon components (simple SVG icons)
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2v12l10-6L4 2z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2h3v12H4V2zm5 0h3v12H9V2z" />
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="4" width="8" height="8" />
  </svg>
);

const SkipBackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2v12h2V8l6 6V2L6 8V2H4z" />
  </svg>
);

const SkipForwardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12 2v12h-2V8L4 14V2l6 6V2h2z" />
  </svg>
);
