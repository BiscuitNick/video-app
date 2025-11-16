import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimecodeInputProps {
  value: number; // Time in seconds
  fps?: number; // Frames per second
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Convert seconds to timecode string (HH:MM:SS:FF)
 */
const secondsToTimecode = (seconds: number, fps: number): string => {
  const totalFrames = Math.floor(seconds * fps);
  const hours = Math.floor(totalFrames / (fps * 3600));
  const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const secs = Math.floor((totalFrames % (fps * 60)) / fps);
  const frames = totalFrames % fps;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

/**
 * Convert timecode string to seconds
 */
const timecodeToSeconds = (timecode: string, fps: number): number | null => {
  const parts = timecode.split(':').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) {
    return null;
  }

  const [hours, minutes, seconds, frames] = parts;
  if (frames >= fps) {
    return null;
  }

  const totalSeconds =
    hours * 3600 + minutes * 60 + seconds + frames / fps;
  return totalSeconds;
};

export const TimecodeInput: React.FC<TimecodeInputProps> = ({
  value,
  fps = 30,
  onChange,
  className,
  disabled = false,
}) => {
  const [displayValue, setDisplayValue] = useState(secondsToTimecode(value, fps));
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when value prop changes and not editing
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(secondsToTimecode(value, fps));
    }
  }, [value, fps, isEditing]);

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const newValue = timecodeToSeconds(displayValue, fps);
    if (newValue !== null) {
      onChange(newValue);
    } else {
      // Reset to valid value on invalid input
      setDisplayValue(secondsToTimecode(value, fps));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDisplayValue(secondsToTimecode(value, fps));
      inputRef.current?.blur();
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn('font-mono text-sm', className)}
      placeholder="00:00:00:00"
    />
  );
};
