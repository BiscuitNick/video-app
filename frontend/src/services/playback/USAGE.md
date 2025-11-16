# Playback Services Usage Guide

This directory contains the core playback engine for the video editor, consisting of three main components:

## Components

### 1. PlaybackEngine
Handles frame-accurate playback, time/frame conversions, and clip scheduling.

**Key Features:**
- Frame/time conversion at different timebase rates (24/30/60 fps)
- Clip scheduling system to determine active clips
- requestAnimationFrame-based ticker for smooth playback
- Sub-frame interpolation for jitter-free rendering
- Playback controls: play, pause, seek, stop

**Properties:**
- `currentFrame`: Current frame number
- `timebase_fps`: Frame rate (24, 30, or 60)
- `playbackRate`: Speed multiplier (0.25x - 2.0x)
- `isPlaying`: Playback state

**Methods:**
- `timeToFrame(time: number): number` - Convert seconds to frame number
- `frameToTime(frame: number): number` - Convert frame number to seconds
- `getCurrentFrame(): number` - Get current frame
- `getCurrentFrameInterpolated(): number` - Get frame with sub-frame precision
- `play()` - Start playback
- `pause()` - Pause playback
- `stop()` - Stop and reset to beginning
- `seek(time: number)` - Seek to time in seconds
- `seekToFrame(frame: number)` - Seek to specific frame
- `setPlaybackRate(rate: number)` - Set playback speed
- `setTracks(tracks: Track[])` - Update timeline tracks
- `getActiveClips(): ActiveClip[]` - Get clips active at current frame

### 2. VideoElementManager
Manages HTML5 video elements, preloading, and source switching.

**Key Features:**
- Single active video element with seamless source switching
- Video pool for preloading upcoming clips
- Blob URL support for better caching
- Buffering state monitoring
- Error handling with fallbacks
- Frame-accurate video synchronization

**Configuration:**
- `poolSize`: Number of videos to preload (default: 3)
- `preloadDistance`: Lookahead time in seconds (default: 2.0s)

**Methods:**
- `setMediaAssets(assets: MediaAsset[])` - Set available media library
- `getActiveVideoElement(): HTMLVideoElement` - Get current video element
- `updateActiveClip(clip, time)` - Switch to a different clip
- `preloadUpcomingClips(clips, currentTime)` - Preload clips ahead of playhead
- `play()` - Play active video
- `pause()` - Pause active video
- `setVolume(volume: number)` - Set volume (0-1)
- `setMuted(muted: boolean)` - Set mute state
- `isCurrentlyBuffering(): boolean` - Check if buffering
- `getReadyState(): number` - Get HTMLMediaElement ready state

### 3. TransformController
Manages CSS transforms with keyframe interpolation and easing.

**Key Features:**
- Keyframe-based animation system
- Multiple easing functions
- GPU-accelerated transforms (transform3d)
- Transform batching to minimize reflows
- Built-in animation presets

**Supported Properties:**
- `opacity`: 0-1
- `scale`: 0.1-2.0 (uniform)
- `scaleX`, `scaleY`: Independent axis scaling
- `translateX`, `translateY`: Position offset in pixels
- `rotation`: Degrees

**Easing Functions:**
- `linear`
- `easeIn`, `easeOut`, `easeInOut`
- `easeInCubic`, `easeOutCubic`, `easeInOutCubic`

**Methods:**
- `setKeyframes(clipId, keyframes[])` - Set animation keyframes
- `calculateTransform(clip, frame)` - Calculate interpolated properties
- `applyTransform(element, clip, frame)` - Apply transform to element
- `applyTransformImmediate(element, clip, frame)` - Apply without batching

**Static Helpers:**
- `TransformController.createFadeIn(startFrame, duration)` - Fade in animation
- `TransformController.createFadeOut(startFrame, duration)` - Fade out animation
- `TransformController.createZoomIn(startFrame, duration)` - Zoom in animation
- `TransformController.createSlideIn(startFrame, duration, direction, distance)` - Slide animation

## React Integration

### Using the Hook

```tsx
import { usePlaybackEngine } from '@/services/playback/usePlaybackEngine';

function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    currentFrame,
    activeClips,
    isBuffering,
    error,
    seek,
    seekToFrame,
    setClipKeyframes,
  } = usePlaybackEngine({
    timebase_fps: 30,
    videoElementRef: videoRef,
    containerRef: containerRef,
  });

  // Set up fade in animation for a clip
  useEffect(() => {
    if (activeClips[0]) {
      const fadeKeyframes = TransformController.createFadeIn(0, 30);
      setClipKeyframes(activeClips[0].clip.id, fadeKeyframes);
    }
  }, [activeClips]);

  return (
    <div ref={containerRef}>
      <video ref={videoRef} />
      {isBuffering && <div>Buffering...</div>}
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

## Manual Usage (Without Hook)

```typescript
import {
  PlaybackEngine,
  VideoElementManager,
  TransformController,
} from '@/services/playback';

// Initialize
const engine = new PlaybackEngine({
  timebase_fps: 30,
  onFrameUpdate: (frame, time) => {
    console.log(`Frame ${frame}, Time ${time}s`);
  },
  onClipChange: (activeClips) => {
    console.log(`Active clips:`, activeClips);
  },
});

const videoManager = new VideoElementManager({
  poolSize: 3,
  preloadDistance: 2.0,
  onError: (error, clipId) => {
    console.error(`Error on clip ${clipId}:`, error);
  },
  onBuffering: (isBuffering) => {
    console.log(`Buffering: ${isBuffering}`);
  },
});

const transformController = new TransformController();

// Set up timeline
engine.setTracks(tracks);
videoManager.setMediaAssets(assets);

// Add keyframe animation
const fadeIn = TransformController.createFadeIn(0, 30);
transformController.setKeyframes('clip-id', fadeIn);

// Control playback
engine.play();
engine.setPlaybackRate(1.5);
engine.seek(5.0);

// Clean up
engine.destroy();
videoManager.destroy();
transformController.destroy();
```

## Testing

### Running Tests

Tests can be run in the browser console:

```javascript
// Import the tests
import { runAllTests } from '@/services/playback/__tests__/playback-tests';

// Run all tests
await runAllTests();

// Or run individual tests
import {
  testFrameTimeConversions,
  testClipScheduling,
  testTransformInterpolation,
} from '@/services/playback/__tests__/playback-tests';

testFrameTimeConversions();
testClipScheduling();
testTransformInterpolation();
```

### Running Benchmarks

```javascript
import { runAllBenchmarks } from '@/services/playback/__tests__/performance-benchmarks';

await runAllBenchmarks(
  videoManager,
  engine,
  transformController,
  clips,
  tracks,
  assets
);
```

## Performance Considerations

### Frame Rate Accuracy
- PlaybackEngine uses `requestAnimationFrame` for 60fps ticker
- Sub-frame interpolation ensures smooth playback between frames
- Actual frame update rate depends on browser and system performance

### Video Switching
- Typical switching latency: 50-200ms depending on video codec and size
- Preloading reduces perceived latency
- Blob URLs can improve caching but increase memory usage

### Transform Performance
- Uses `transform3d` for GPU acceleration
- Transform batching reduces layout thrashing
- `will-change` hint optimizes compositor performance
- Typical transform calculation: <0.1ms per frame

### Memory Usage
- Video pool size affects memory footprint
- Each preloaded video: ~10-50MB depending on codec and quality
- Blob URLs double memory usage but improve seek performance
- Cleanup is automatic when clips exit the preload window

## Browser Compatibility

- **Chrome/Edge**: Full support, best performance
- **Firefox**: Full support
- **Safari**: Full support, some MSE limitations
- **Mobile**: Limited by autoplay policies and memory constraints

## Common Patterns

### Smooth Transitions Between Clips

```typescript
// Add crossfade effect at clip boundaries
const clip1End = 100; // frames
const transitionDuration = 10; // frames

transformController.setKeyframes('clip1', [
  { frame: clip1End - transitionDuration, time: 0, opacity: 1 },
  { frame: clip1End, time: 0, opacity: 0, easing: 'easeOut' },
]);

transformController.setKeyframes('clip2', [
  { frame: clip1End, time: 0, opacity: 0 },
  { frame: clip1End + transitionDuration, time: 0, opacity: 1, easing: 'easeIn' },
]);
```

### Ken Burns Effect (Zoom and Pan)

```typescript
transformController.setKeyframes('photo-clip', [
  {
    frame: 0,
    time: 0,
    scale: 1.0,
    translateX: 0,
    translateY: 0,
    easing: 'easeInOut',
  },
  {
    frame: 180, // 6 seconds at 30fps
    time: 6,
    scale: 1.3,
    translateX: -50,
    translateY: -30,
  },
]);
```

### Synchronized Multi-track Playback

```typescript
// Engine automatically handles multiple video tracks
// Just ensure they're in the tracks array
const tracks = [
  { id: 'background', type: 'video', clips: [...] },
  { id: 'overlay', type: 'video', clips: [...] },
];

engine.setTracks(tracks);

// Active clips will be returned in z-order
const activeClips = engine.getActiveClips();
// [{ clip: backgroundClip, track: backgroundTrack },
//  { clip: overlayClip, track: overlayTrack }]
```

## Troubleshooting

### Videos not switching smoothly
- Increase `preloadDistance` in VideoElementManager config
- Check network speed and video file sizes
- Enable blob URL caching for local files

### Playback stuttering
- Check that timebase_fps matches video source fps
- Reduce number of active transforms
- Disable other expensive operations during playback

### Memory issues
- Reduce VideoElementManager `poolSize`
- Disable blob URL caching
- Implement clip cleanup for long timelines

### Transform not applying
- Verify clip ID matches between clip and keyframes
- Check that frame numbers are within clip range
- Ensure element is in DOM when applying transforms
