# Mobile-Responsive Components - Task 21 Implementation

This directory contains all mobile-responsive components and utilities for the video editing application. These components are optimized for touch interactions, mobile devices, and provide a seamless mobile experience.

## 📱 Overview

Task 21 implements a comprehensive mobile-responsive layout system with:

- **Responsive Tailwind Configuration**: Custom breakpoints and mobile utilities
- **Touch-Optimized Timeline**: Single-track mobile timeline with gesture controls
- **Mobile UI Patterns**: Bottom sheets, action sheets, and collapsible panels
- **Touch Controls**: Large buttons, gesture recognition, and haptic feedback
- **Mobile Asset Browser**: Responsive grid with infinite scroll and pull-to-refresh
- **Orientation Handling**: Screen lock and layout persistence
- **Onboarding Flow**: First-time user experience

## 🎯 Components

### Mobile UI Patterns

#### BottomSheet
A draggable bottom sheet with snap points and drag-to-dismiss functionality.

```tsx
import { BottomSheet } from '@/components/mobile';

<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Sheet Title"
  snapPoints={[50, 75, 100]} // Percentage heights
  initialSnap={0}
  showHandle={true}
>
  <YourContent />
</BottomSheet>
```

**Features:**
- Drag-to-dismiss with haptic feedback
- Multiple snap points
- Smooth animations
- Touch and mouse support (for desktop testing)

#### ActionSheet
iOS-style action sheet for context menus.

```tsx
import { ActionSheet, type ActionSheetOption } from '@/components/mobile';

const options: ActionSheetOption[] = [
  {
    label: 'Edit',
    icon: <Edit />,
    onSelect: () => console.log('Edit'),
  },
  {
    label: 'Delete',
    icon: <Trash />,
    onSelect: () => console.log('Delete'),
    variant: 'destructive',
  },
];

<ActionSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Choose an action"
  options={options}
/>
```

**Features:**
- Touch-optimized buttons (48x48px minimum)
- Haptic feedback
- Destructive action styling
- Smooth slide-up animation

#### CollapsiblePanel
Expandable panel with smooth animations.

```tsx
import { CollapsiblePanel, StackedPanelLayout } from '@/components/mobile';

<StackedPanelLayout spacing="normal">
  <CollapsiblePanel
    title="Panel Title"
    icon={<Icon />}
    badge="3"
    defaultOpen={false}
  >
    <YourContent />
  </CollapsiblePanel>
</StackedPanelLayout>
```

**Features:**
- Smooth expand/collapse animations
- Badge support
- Icon support
- Stacked layout system

### Timeline Components

#### TimelineMobile
Mobile-optimized single-track timeline with touch gestures.

```tsx
import { TimelineMobile } from '@/components/mobile';

<TimelineMobile
  fps={30}
  pixelsPerSecond={50}
/>
```

**Features:**
- Single-track view for mobile
- Swipe-to-scroll with momentum
- Pinch-to-zoom
- Touch-optimized clip cards (44x44px minimum)
- Auto-scroll to playhead
- Virtualized rendering for performance

**Gestures:**
- **Single finger swipe**: Scroll timeline horizontally
- **Pinch**: Zoom in/out
- **Two-finger drag**: Scrub playhead
- **Tap clip**: Select and show details

### Playback Controls

#### PlaybackControls
Large, touch-optimized playback buttons.

```tsx
import { PlaybackControls } from '@/components/mobile';

<PlaybackControls size="large" />
```

**Features:**
- 48x48px minimum touch targets
- Primary play/pause button (64x64px)
- Skip forward/backward (10s)
- Double-tap gesture support
- Haptic feedback on all interactions

#### GestureControls
Wrapper component for advanced gesture recognition.

```tsx
import { GestureControls } from '@/components/mobile';

<GestureControls
  onSplit={(time) => console.log('Split at', time)}
  enableDoubleTapPlayPause={true}
  enableTwoFingerScrub={true}
  enableSplitGesture={true}
>
  <YourVideoPlayer />
</GestureControls>
```

**Supported Gestures:**
- **Double-tap**: Play/pause
- **Two-finger tap**: Split clip at current time
- **Two-finger horizontal drag**: Scrub timeline
- Visual feedback overlays

#### ClipTrimmer
Touch-optimized clip trimming interface.

```tsx
import { ClipTrimmer } from '@/components/mobile';

<ClipTrimmer
  clip={clip}
  onTrim={(clipId, start, end) => handleTrim(clipId, start, end)}
  pixelsPerSecond={50}
/>
```

**Features:**
- Large draggable handles
- Real-time preview
- Haptic feedback during trimming
- Minimum duration enforcement (0.5s)
- Touch and mouse support

### Asset Browser

#### AssetBrowserMobile
Responsive asset grid with mobile features.

```tsx
import { AssetBrowserMobile } from '@/components/mobile';

<AssetBrowserMobile
  assets={assets}
  onLoadMore={async () => loadMoreAssets()}
  onRefresh={async () => refreshAssets()}
  onAssetSelect={(asset) => console.log('Selected', asset)}
  onBatchSelect={(assets) => console.log('Batch', assets)}
  columns={{ mobile: 2, tablet: 3 }}
  enableInfiniteScroll={true}
  enablePullToRefresh={true}
  enableBatchSelection={true}
/>
```

**Features:**
- Responsive grid (2 cols mobile, 3-4 tablet)
- Infinite scroll with Intersection Observer
- Pull-to-refresh
- Long-press for batch selection
- Swipe navigation for preview
- Touch-optimized cards

**Gestures:**
- **Long press**: Enter batch selection mode
- **Pull down**: Refresh assets
- **Scroll to bottom**: Load more assets
- **Swipe on preview**: Navigate between assets

### Orientation & Onboarding

#### OrientationLock
Screen orientation lock control.

```tsx
import { OrientationLock, OrientationWarning } from '@/components/mobile';

// Lock button
<OrientationLock showIndicator={true} />

// Orientation warning overlay
<OrientationWarning
  preferredOrientation="landscape"
  message="Please rotate to landscape"
/>
```

**Features:**
- Screen Orientation API integration
- Lock/unlock toggle with haptics
- Automatic layout persistence
- Warning overlay for incorrect orientation

#### MobileOnboarding
First-time user onboarding flow.

```tsx
import { MobileOnboarding, useOnboardingStatus } from '@/components/mobile';

const { isCompleted, resetOnboarding } = useOnboardingStatus();

const steps = [
  {
    title: 'Welcome',
    description: 'Get started with our app',
    illustration: <YourIllustration />,
  },
  // ... more steps
];

<MobileOnboarding
  steps={steps}
  onComplete={() => console.log('Onboarding complete')}
  onSkip={() => console.log('Skipped')}
  showSkip={true}
/>
```

**Features:**
- Swipe navigation between steps
- Progress indicators
- Skip option
- LocalStorage persistence
- Custom illustrations

## 🎣 Hooks

### useTouchHandlers
Advanced touch gesture handling.

```tsx
import { useTouchHandlers } from '@/hooks/useTouchHandlers';

const {
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  scrollOffset,
  scale,
} = useTouchHandlers({
  containerRef,
  onZoomChange: (scale) => setZoom(zoom * scale),
  enableMomentumScroll: true,
  enablePinchZoom: true,
});
```

**Features:**
- Momentum scrolling with deceleration
- Pinch-to-zoom
- Two-finger gestures
- Velocity tracking

### useHaptics
Vibration API integration.

```tsx
import { useHaptics } from '@/hooks/useHaptics';

const { vibrate, patterns, isSupported } = useHaptics();

// Basic vibration
vibrate(10); // 10ms

// Pattern
vibrate([10, 50, 10, 50, 20]);

// Predefined patterns
patterns.light();    // UI interactions
patterns.medium();   // Selections
patterns.strong();   // Confirmations
patterns.error();    // Errors
patterns.success();  // Success
patterns.doubleTap(); // Double tap
patterns.longPress(); // Long press
```

### useOrientation
Screen orientation detection and control.

```tsx
import { useOrientation } from '@/hooks/useOrientation';

const {
  orientation,
  isPortrait,
  isLandscape,
  isLocked,
  lockOrientation,
  unlockOrientation,
  getSavedLayout,
} = useOrientation({
  onOrientationChange: (orientation) => console.log(orientation),
  persistLayout: true,
});

// Lock to landscape
await lockOrientation('landscape');

// Unlock
unlockOrientation();
```

### useInfiniteScroll
Intersection Observer-based infinite scrolling.

```tsx
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

const { isLoading } = useInfiniteScroll({
  containerRef,
  onLoadMore: async () => {
    // Load more data
  },
  threshold: 200, // Pixels from bottom
  enabled: true,
});
```

### usePullToRefresh
Pull-to-refresh gesture.

```tsx
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const { isPulling, pullDistance } = usePullToRefresh({
  containerRef,
  onRefresh: async () => {
    // Refresh data
  },
  threshold: 80,
  enabled: true,
});
```

## 🎨 Tailwind Utilities

### Touch Targets
```css
.touch-target-min  /* 44x44px minimum */
.touch-target      /* 48x48px comfortable */
```

### Mobile Spacing
```css
.mobile-p-xs   /* 0.5rem */
.mobile-p-sm   /* 1rem */
.mobile-p-md   /* 1.5rem */
.mobile-p-lg   /* 2rem */
.mobile-p-xl   /* 3rem */
```

### Mobile Typography
```css
.mobile-text-xs    /* 0.75rem */
.mobile-text-sm    /* 0.875rem */
.mobile-text-base  /* 1rem */
.mobile-text-lg    /* 1.125rem */
.mobile-text-xl    /* 1.25rem */
.mobile-text-2xl   /* 1.5rem */
```

### Utilities
```css
.momentum-scroll  /* -webkit-overflow-scrolling: touch */
.no-select        /* Disable text selection */
.safe-top         /* Safe area inset top */
.safe-bottom      /* Safe area inset bottom */
.safe-left        /* Safe area inset left */
.safe-right       /* Safe area inset right */
```

### Responsive Breakpoints
```css
sm:   /* 640px  - Mobile landscape */
md:   /* 768px  - Tablet portrait */
lg:   /* 1024px - Tablet landscape / Small desktop */
xl:   /* 1280px - Desktop */
2xl:  /* 1536px - Large desktop */
```

## 🧪 Testing

### Desktop Testing
All mobile components support mouse events for desktop testing:
- Click = Tap
- Mouse drag = Touch drag
- Scroll wheel = Swipe

### Mobile Testing Tips

1. **Use Chrome DevTools Device Toolbar**
   - Enable touch simulation
   - Test different viewport sizes
   - Throttle network for testing infinite scroll

2. **Real Device Testing**
   - Test on iOS and Android
   - Verify haptic feedback
   - Check orientation changes
   - Test gesture conflicts

3. **Performance Testing**
   - Monitor frame rate during scroll
   - Check virtualization effectiveness
   - Test with large datasets

## 📝 Best Practices

### Touch Targets
- Minimum 44x44px (iOS HIG)
- Comfortable size: 48x48px
- Critical actions: 64x64px or larger

### Haptic Feedback
- Use sparingly for important interactions
- Light (10ms): UI interactions
- Medium (15-20ms): Selections, confirmations
- Strong (20-30ms): Important actions
- Patterns: Complex feedback

### Gestures
- Provide visual feedback
- Show gesture hints for first-time users
- Don't override native browser gestures
- Support both touch and mouse

### Performance
- Use virtualization for long lists
- Implement infinite scroll for large datasets
- Debounce expensive operations
- Use CSS transforms for animations
- Enable momentum scrolling

### Accessibility
- Large touch targets
- High contrast ratios
- Support for reduced motion
- Keyboard navigation fallbacks
- ARIA labels for screen readers

## 🐛 Known Issues

1. **Vibration API**
   - Not supported on all devices
   - May be blocked by browser settings
   - Requires user gesture to activate

2. **Screen Orientation API**
   - Limited browser support
   - May fail in fullscreen mode
   - iOS Safari has restrictions

3. **Pinch Zoom**
   - May conflict with browser zoom
   - Requires proper viewport configuration
   - Test with different mobile browsers

## 🔧 Configuration

### Viewport Meta Tag
Ensure your HTML has the correct viewport configuration:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

### PWA Manifest
For full mobile app experience:

```json
{
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#18181b",
  "background_color": "#09090b"
}
```

## 📦 Component Dependencies

```
Timeline Components
├── TimelineMobile
│   ├── useTouchHandlers
│   └── useTimelineStore
├── PlaybackControls
│   ├── useHaptics
│   └── usePlaybackStore
└── ClipTrimmer
    └── useHaptics

UI Patterns
├── BottomSheet
│   └── useHaptics
├── ActionSheet
│   └── useHaptics
└── CollapsiblePanel
    └── useHaptics

Asset Browser
└── AssetBrowserMobile
    ├── useHaptics
    ├── useInfiniteScroll
    └── usePullToRefresh

Orientation & Onboarding
├── OrientationLock
│   ├── useOrientation
│   └── useHaptics
└── MobileOnboarding
    ├── useHaptics
    └── useOnboardingStatus
```

## 🎬 Demo

Run the demo component to see all features in action:

```tsx
import { MobileDemo } from '@/components/mobile/MobileDemo';

function App() {
  return <MobileDemo />;
}
```

## 📚 Additional Resources

- [MDN - Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [MDN - Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [MDN - Screen Orientation API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Orientation_API)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design - Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
