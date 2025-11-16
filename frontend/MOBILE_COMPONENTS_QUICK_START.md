# Mobile Components Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Import the Components

```tsx
import {
  // UI Patterns
  BottomSheet,
  ActionSheet,
  CollapsiblePanel,

  // Timeline & Playback
  TimelineMobile,
  PlaybackControls,
  GestureControls,
  ClipTrimmer,

  // Asset Browser
  AssetBrowserMobile,

  // Orientation & Onboarding
  OrientationLock,
  MobileOnboarding,
} from '@/components/mobile';

// Hooks
import {
  useHaptics,
  useOrientation,
  useTouchHandlers,
  useInfiniteScroll,
  usePullToRefresh,
} from '@/hooks';
```

### 2. Basic Implementation Examples

#### Show a Bottom Sheet
```tsx
const [isOpen, setIsOpen] = useState(false);

<button onClick={() => setIsOpen(true)}>Open Sheet</button>

<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Options"
>
  <p>Your content here</p>
</BottomSheet>
```

#### Add Haptic Feedback
```tsx
const { patterns } = useHaptics();

<button onClick={() => {
  patterns.medium();
  handleAction();
}}>
  Click me
</button>
```

#### Mobile Timeline
```tsx
<TimelineMobile
  fps={30}
  pixelsPerSecond={50}
/>
```

#### Asset Browser
```tsx
<AssetBrowserMobile
  assets={myAssets}
  onAssetSelect={(asset) => console.log(asset)}
  enableInfiniteScroll
  enablePullToRefresh
/>
```

### 3. Common Patterns

#### Modal with Action Sheet
```tsx
const [showActions, setShowActions] = useState(false);

const options = [
  { label: 'Edit', icon: <Edit />, onSelect: () => {} },
  { label: 'Delete', icon: <Trash />, onSelect: () => {}, variant: 'destructive' },
];

<ActionSheet
  isOpen={showActions}
  onClose={() => setShowActions(false)}
  title="Choose an action"
  options={options}
/>
```

#### Collapsible Sections
```tsx
<StackedPanelLayout>
  <CollapsiblePanel title="Section 1" icon={<Icon />}>
    Content 1
  </CollapsiblePanel>
  <CollapsiblePanel title="Section 2" badge="3">
    Content 2
  </CollapsiblePanel>
</StackedPanelLayout>
```

#### Gesture-Enabled Content
```tsx
<GestureControls
  onSplit={(time) => handleSplit(time)}
  enableDoubleTapPlayPause
  enableTwoFingerScrub
>
  <YourContent />
</GestureControls>
```

### 4. Responsive Layout Classes

```tsx
// Touch targets
<button className="touch-target">Large Button</button>
<button className="touch-target-min">Minimum Size</button>

// Mobile spacing
<div className="mobile-p-sm">Padding</div>

// Mobile typography
<h1 className="mobile-text-2xl">Heading</h1>
<p className="mobile-text-base">Body text</p>

// Safe areas
<div className="safe-top safe-bottom">Content</div>

// Utilities
<div className="momentum-scroll">Scrollable</div>
<div className="no-select">No text selection</div>
```

### 5. Hooks Usage

#### Haptics
```tsx
const { vibrate, patterns } = useHaptics();

vibrate(10); // 10ms vibration
patterns.success(); // Success pattern
```

#### Orientation
```tsx
const { orientation, lockOrientation, isPortrait } = useOrientation();

// Lock to landscape
await lockOrientation('landscape');

// Check orientation
if (isPortrait) {
  // Show portrait warning
}
```

#### Touch Handlers
```tsx
const handlers = useTouchHandlers({
  containerRef,
  onZoomChange: (scale) => setZoom(zoom * scale),
  enableMomentumScroll: true,
  enablePinchZoom: true,
});

<div
  ref={containerRef}
  onTouchStart={handlers.handleTouchStart}
  onTouchMove={handlers.handleTouchMove}
  onTouchEnd={handlers.handleTouchEnd}
>
  Content
</div>
```

---

## 📱 Common Mobile Patterns

### Pattern 1: Edit Modal
```tsx
function EditClipModal({ clip }) {
  const [isOpen, setIsOpen] = useState(false);
  const { patterns } = useHaptics();

  return (
    <>
      <button onClick={() => {
        patterns.medium();
        setIsOpen(true);
      }}>
        Edit Clip
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit Clip"
        snapPoints={[50, 100]}
      >
        <ClipTrimmer
          clip={clip}
          onTrim={(id, start, end) => {
            patterns.success();
            handleTrim(id, start, end);
          }}
        />
      </BottomSheet>
    </>
  );
}
```

### Pattern 2: Context Menu
```tsx
function ClipContextMenu({ clip }) {
  const [showMenu, setShowMenu] = useState(false);

  const options = [
    { label: 'Duplicate', icon: <Copy />, onSelect: () => duplicate(clip) },
    { label: 'Split', icon: <Scissors />, onSelect: () => split(clip) },
    { label: 'Delete', icon: <Trash />, onSelect: () => remove(clip), variant: 'destructive' },
  ];

  return (
    <>
      <button onLongPress={() => setShowMenu(true)}>
        {clip.name}
      </button>

      <ActionSheet
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        title={clip.name}
        options={options}
      />
    </>
  );
}
```

### Pattern 3: Settings Panel
```tsx
function MobileSettings() {
  return (
    <StackedPanelLayout spacing="normal">
      <CollapsiblePanel title="Video Settings" icon={<Video />}>
        <VideoSettingsForm />
      </CollapsiblePanel>

      <CollapsiblePanel title="Audio Settings" icon={<Music />}>
        <AudioSettingsForm />
      </CollapsiblePanel>

      <CollapsiblePanel title="Export Settings" icon={<Download />}>
        <ExportSettingsForm />
      </CollapsiblePanel>
    </StackedPanelLayout>
  );
}
```

---

## 🎯 Best Practices

### DO ✅
- Use `touch-target` class on all buttons
- Add haptic feedback for important actions
- Implement pull-to-refresh on lists
- Use momentum scrolling on containers
- Test on real mobile devices
- Provide visual feedback for gestures
- Use safe area insets

### DON'T ❌
- Make touch targets smaller than 44x44px
- Overuse haptic feedback (annoying)
- Forget to disable text selection on draggables
- Block native browser gestures
- Use mouse-only events
- Ignore orientation changes
- Forget viewport meta tag

---

## 🧪 Testing Checklist

```
□ Touch targets are ≥ 44x44px
□ Haptic feedback works (on device)
□ Gestures don't conflict with browser
□ Scrolling is smooth (momentum)
□ Layout adapts to orientation
□ Safe areas are respected
□ Pull-to-refresh works
□ Infinite scroll loads correctly
□ Animations are smooth (60fps)
□ Works on iOS and Android
```

---

## 🔥 Pro Tips

1. **Always test on real devices** - Desktop simulators can't replicate touch accuracy
2. **Use haptics sparingly** - Only for important feedback
3. **Provide visual feedback** - Users should see their touch registering
4. **Support both orientations** - Don't lock unless necessary
5. **Optimize for one-handed use** - Place important actions within thumb reach
6. **Test in poor network conditions** - Implement proper loading states
7. **Consider battery life** - Avoid excessive animations and haptics

---

## 📚 Additional Resources

- Full Documentation: `/frontend/src/components/mobile/README.md`
- Demo Component: `/frontend/src/components/mobile/MobileDemo.tsx`
- Implementation Report: `/frontend/TASK_21_MOBILE_IMPLEMENTATION.md`

---

**Happy Mobile Development!** 📱✨
