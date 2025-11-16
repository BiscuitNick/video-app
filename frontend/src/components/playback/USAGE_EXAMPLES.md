# Playback Components - Usage Examples

This document provides examples of how to use the playback components (16.4-16.7).

## OverlayRenderer (16.4)

### Basic Text Overlay

```tsx
import { OverlayRenderer } from '@/components/playback';

const overlays = [
  {
    id: 'title-overlay',
    type: 'text',
    content: 'My Video Title',
    position: { x: 50, y: 10 }, // Centered at top
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 48,
      color: '#ffffff',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    },
    zIndex: 10,
    startTime: 0,
    endTime: 5,
  },
];

<OverlayRenderer
  overlays={overlays}
  currentTime={currentTime}
  containerWidth={1920}
  containerHeight={1080}
/>
```

### Image Overlay

```tsx
const overlays = [
  {
    id: 'logo-overlay',
    type: 'image',
    content: '/assets/logo.png',
    position: { x: 90, y: 90 }, // Bottom right
    style: {
      opacity: 0.8,
    },
    zIndex: 5,
    startTime: 0,
    endTime: 60,
  },
];
```

### Multiple Layered Overlays

```tsx
const overlays = [
  {
    id: 'background',
    type: 'text',
    content: 'Background Layer',
    position: { x: 50, y: 50 },
    zIndex: 1,
    startTime: 0,
    endTime: 10,
  },
  {
    id: 'foreground',
    type: 'text',
    content: 'Foreground Layer',
    position: { x: 50, y: 50 },
    zIndex: 10,
    startTime: 0,
    endTime: 10,
  },
];
```

## TransitionRenderer (16.5)

### Fade Transition

```tsx
import { TransitionRenderer } from '@/components/playback';

const transition = {
  id: 'fade-transition',
  type: 'fade',
  duration: 1.0, // 1 second
  timingFunction: 'ease-in-out',
  startTime: 5.0,
};

<TransitionRenderer transition={transition} currentTime={currentTime}>
  <VideoContent />
</TransitionRenderer>
```

### Wipe Transitions

```tsx
// Wipe from left
const wipeLeft = {
  id: 'wipe-left',
  type: 'wipe-left',
  duration: 0.5,
  timingFunction: 'ease',
  startTime: 10.0,
};

// Wipe from right
const wipeRight = {
  id: 'wipe-right',
  type: 'wipe-right',
  duration: 0.5,
  timingFunction: 'ease',
  startTime: 15.0,
};

// Wipe from top
const wipeUp = {
  id: 'wipe-up',
  type: 'wipe-up',
  duration: 0.5,
  timingFunction: 'ease',
  startTime: 20.0,
};

// Wipe from bottom
const wipeDown = {
  id: 'wipe-down',
  type: 'wipe-down',
  duration: 0.5,
  timingFunction: 'ease',
  startTime: 25.0,
};
```

### Dissolve Transition

```tsx
const dissolve = {
  id: 'dissolve',
  type: 'dissolve',
  duration: 1.5,
  timingFunction: 'linear',
  startTime: 30.0,
};
```

### Transition Preview

```tsx
import { TransitionPreview } from '@/components/playback';

// Preview a transition effect
<TransitionPreview type="fade" duration={1.0} />
<TransitionPreview type="wipe-left" duration={0.5} />
<TransitionPreview type="dissolve" duration={1.5} />
```

## AudioSyncManager (16.6)

### Basic Setup

```tsx
import { AudioSyncManager } from '@/services/playback';

// Create audio sync manager
const audioManager = new AudioSyncManager();

// Set master volume
audioManager.setMasterVolume(0.8);

// Set playback rate
audioManager.setPlaybackRate(1.0);
```

### Loading and Playing Audio

```tsx
// Load audio buffer from URL
const buffer = await audioManager.loadAudioBuffer('/audio/track1.mp3');

// Create audio track
const track = audioManager.createAudioTrack('track-1', buffer, 0, {
  volume: 0.8,
  crossfadeDuration: 0.2, // 200ms crossfade
});

// Add track
audioManager.addAudioTrack(track);

// Start playback
audioManager.play(0);
```

### Synchronized Playback with Video

```tsx
// Play audio and video in sync
const startTime = 5.0; // Start at 5 seconds

// Start audio
audioManager.play(startTime);

// Start video (using PlaybackEngine)
playbackEngine.play();

// Both should use shared clock for perfect sync
```

### Crossfading

```tsx
const track1 = audioManager.createAudioTrack('track-1', buffer1, 0, {
  volume: 1.0,
  crossfadeDuration: 0.5, // 500ms fade in/out
});

const track2 = audioManager.createAudioTrack('track-2', buffer2, 9.5, {
  volume: 1.0,
  crossfadeDuration: 0.5, // Overlaps with track1 for smooth transition
});

audioManager.setAudioTracks([track1, track2]);
audioManager.play(0);
```

### Control Methods

```tsx
// Play from specific time
audioManager.play(10.0);

// Pause
audioManager.pause();

// Stop and reset
audioManager.stop();

// Seek to time
audioManager.seek(5.0);

// Change playback speed
audioManager.setPlaybackRate(1.5); // 1.5x speed

// Get current state
const state = audioManager.getState();
console.log(state.currentTime, state.isPlaying);

// Cleanup
await audioManager.destroy();
```

## PlaybackControls (16.7)

### Basic Usage

```tsx
import { PlaybackControls } from '@/components/playback';

const state = {
  isPlaying: false,
  currentTime: 0,
  duration: 60,
  playbackRate: 1.0,
  currentFrame: 0,
  totalFrames: 1800,
};

<PlaybackControls
  state={state}
  onPlay={() => playbackEngine.play()}
  onPause={() => playbackEngine.pause()}
  onStop={() => playbackEngine.stop()}
  onSeek={(time) => playbackEngine.seek(time)}
  onSeekToFrame={(frame) => playbackEngine.seekToFrame(frame)}
  onPlaybackRateChange={(rate) => playbackEngine.setPlaybackRate(rate)}
  onFrameStep={(direction) => {
    if (direction === 'forward') {
      playbackEngine.seekToFrame(state.currentFrame + 1);
    } else {
      playbackEngine.seekToFrame(state.currentFrame - 1);
    }
  }}
  fps={30}
/>
```

### Keyboard Shortcuts

The PlaybackControls component includes built-in keyboard shortcuts:

- **Space**: Play/Pause
- **Left Arrow**: Previous frame
- **Right Arrow**: Next frame
- **Home**: Jump to start
- **End**: Jump to end

### Custom Styling

```tsx
// The component uses CSS classes that can be styled:
// .playback-controls
// .transport-controls
// .timeline-scrubber
// .time-display
// .playback-rate-selector
```

## PerformanceMonitor (16.7)

### Basic Usage

```tsx
import { PerformanceMonitor } from '@/components/playback';

<PerformanceMonitor
  enabled={true}
  position="top-right"
  updateInterval={100} // Update every 100ms
/>
```

### Different Positions

```tsx
// Top left
<PerformanceMonitor position="top-left" />

// Top right (default)
<PerformanceMonitor position="top-right" />

// Bottom left
<PerformanceMonitor position="bottom-left" />

// Bottom right
<PerformanceMonitor position="bottom-right" />
```

### Programmatic Access

```tsx
import { usePerformanceMonitor } from '@/components/playback';

function MyComponent() {
  const metrics = usePerformanceMonitor(100); // Update every 100ms

  console.log(`FPS: ${metrics.fps}`);
  console.log(`Frame Time: ${metrics.frameTime}ms`);
  console.log(`Dropped Frames: ${metrics.droppedFrames}`);
  console.log(`Memory Usage: ${metrics.memoryUsage}MB`);

  return <div>FPS: {metrics.fps}</div>;
}
```

## Complete Integration Example

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { PlaybackEngine } from '@/services/playback';
import { AudioSyncManager } from '@/services/playback';
import {
  OverlayRenderer,
  TransitionRenderer,
  PlaybackControls,
  PerformanceMonitor,
} from '@/components/playback';

function VideoPlayer() {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackEngineRef = useRef<PlaybackEngine>();
  const audioManagerRef = useRef<AudioSyncManager>();

  useEffect(() => {
    // Initialize playback engine
    playbackEngineRef.current = new PlaybackEngine({
      timebase_fps: 30,
      onFrameUpdate: (frame, time) => {
        setCurrentTime(time);
      },
    });

    // Initialize audio manager
    audioManagerRef.current = new AudioSyncManager();

    return () => {
      playbackEngineRef.current?.destroy();
      audioManagerRef.current?.destroy();
    };
  }, []);

  const overlays = [
    {
      id: 'title',
      type: 'text',
      content: 'My Video',
      position: { x: 50, y: 10 },
      startTime: 0,
      endTime: 5,
    },
  ];

  const transition = {
    id: 'fade-in',
    type: 'fade',
    duration: 1.0,
    startTime: 0,
  };

  const state = {
    isPlaying,
    currentTime,
    duration: 60,
    playbackRate: 1.0,
    currentFrame: Math.floor(currentTime * 30),
    totalFrames: 1800,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Performance Monitor */}
      <PerformanceMonitor enabled={true} position="top-right" />

      {/* Video Canvas */}
      <div style={{ position: 'relative', width: 1920, height: 1080 }}>
        <TransitionRenderer transition={transition} currentTime={currentTime}>
          <div>
            {/* Video content would go here */}
            <OverlayRenderer
              overlays={overlays}
              currentTime={currentTime}
              containerWidth={1920}
              containerHeight={1080}
            />
          </div>
        </TransitionRenderer>
      </div>

      {/* Playback Controls */}
      <PlaybackControls
        state={state}
        onPlay={() => {
          playbackEngineRef.current?.play();
          audioManagerRef.current?.play(currentTime);
          setIsPlaying(true);
        }}
        onPause={() => {
          playbackEngineRef.current?.pause();
          audioManagerRef.current?.pause();
          setIsPlaying(false);
        }}
        onStop={() => {
          playbackEngineRef.current?.stop();
          audioManagerRef.current?.stop();
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onSeek={(time) => {
          playbackEngineRef.current?.seek(time);
          audioManagerRef.current?.seek(time);
        }}
        onSeekToFrame={(frame) => {
          playbackEngineRef.current?.seekToFrame(frame);
        }}
        onPlaybackRateChange={(rate) => {
          playbackEngineRef.current?.setPlaybackRate(rate);
          audioManagerRef.current?.setPlaybackRate(rate);
        }}
        onFrameStep={(direction) => {
          const currentFrame = Math.floor(currentTime * 30);
          const newFrame = direction === 'forward' ? currentFrame + 1 : currentFrame - 1;
          playbackEngineRef.current?.seekToFrame(newFrame);
        }}
        fps={30}
      />
    </div>
  );
}

export default VideoPlayer;
```

## Performance Tips

1. **OverlayRenderer**: Use `React.memo` for overlay content components to prevent unnecessary re-renders
2. **TransitionRenderer**: Keep transition durations reasonable (0.5-2 seconds) for smooth performance
3. **AudioSyncManager**: Preload audio buffers before playback starts
4. **PlaybackControls**: Debounce seek operations during timeline scrubbing for better performance
5. **PerformanceMonitor**: Use update intervals >= 100ms to avoid excessive re-renders

## Browser Compatibility

- **OverlayRenderer**: All modern browsers
- **TransitionRenderer**: All modern browsers (CSS clip-path support required)
- **AudioSyncManager**: All modern browsers (Web Audio API required)
- **PlaybackControls**: All modern browsers
- **PerformanceMonitor**: All modern browsers (memory metrics require Chrome/Edge)
