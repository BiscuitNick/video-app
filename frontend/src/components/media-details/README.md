# Media Details Panel

A comprehensive property editor for video/audio clips in the timeline.

## Features

### Subtask 17.1: MediaDetailsPanel Component ✅
- Main container with collapsible sections
- Sections: Basic Properties, Transform Properties, Audio Properties, Effects
- Uses shadcn/ui Collapsible components
- Integrates with useTimelineStore
- Batch editing mode for multiple clips

### Subtask 17.2: Custom Property Editors ✅
- **TimecodeInput**: HH:MM:SS:FF format input with validation
- **RangeSlider**: Configurable slider with numeric input (used for speed 0.1x-4x)
- **VolumeControl**: Volume slider with mute toggle (0-100%)
- **NumericInput**: Keyboard-friendly numeric input with arrow key support
- **DualSlider**: X/Y position control with dual numeric inputs
- **OpacitySlider**: Opacity control (0-100%)
- **TransitionPicker**: Dropdown for transition type selection

### Subtask 17.3: Real-time Preview and Bidirectional Sync ✅
- `requestAnimationFrame` for smooth updates
- Debounced property updates (50ms delay via `useDebounce` hook)
- Bidirectional sync between panel and timeline store
- Local state for immediate UI feedback
- Automatic sync to store with debouncing

### Subtask 17.4: Batch Editing and Presets ✅
- **Batch Editing**: Edit multiple clips simultaneously
- **PresetManager**: Save and load property configurations
- **PresetStore**: Persistent storage for presets using Zustand
- Property reset functionality to default values

## Components

### MediaDetailsPanel
Main component that orchestrates all property editors.

```tsx
import { MediaDetailsPanel } from '@/components/media-details';

<MediaDetailsPanel />
```

### Individual Property Editors

```tsx
import {
  TimecodeInput,
  RangeSlider,
  VolumeControl,
  NumericInput,
  DualSlider,
  OpacitySlider,
  TransitionPicker,
  PresetManager
} from '@/components/media-details';
```

## Type Extensions

Extended `Clip` type with new properties:
- `TransformProperties`: position, scale, rotation, opacity
- `AudioProperties`: volume, muted, fadeIn, fadeOut
- `ClipProperties`: speed, transition, transform, audio

## Testing

Run tests with:
```bash
npm test src/components/media-details/__tests__
```

## Demo

Use the demo component to test the panel:
```tsx
import { MediaDetailsDemo } from '@/components/media-details/MediaDetailsDemo';
```

## Architecture

### State Management
- **Timeline Store**: Source of truth for clip properties
- **Local State**: Immediate UI feedback
- **Debounced Updates**: Prevent excessive store updates
- **RAF Batching**: Smooth animations using requestAnimationFrame

### Performance Optimizations
1. Debounced updates (50ms) to reduce store writes
2. RequestAnimationFrame for smooth UI updates
3. Local state for immediate feedback
4. Memoized callbacks to prevent re-renders

### Bidirectional Sync
- Panel reads from store on selection change
- User inputs update local state immediately
- Debounced updates write back to store
- Store changes automatically propagate to panel

## Files Created

- `/src/components/media-details/MediaDetailsPanel.tsx` - Main panel component
- `/src/components/media-details/TimecodeInput.tsx` - Timecode editor
- `/src/components/media-details/RangeSlider.tsx` - Range slider with input
- `/src/components/media-details/VolumeControl.tsx` - Volume control with mute
- `/src/components/media-details/NumericInput.tsx` - Numeric input with keyboard support
- `/src/components/media-details/DualSlider.tsx` - X/Y position control
- `/src/components/media-details/OpacitySlider.tsx` - Opacity slider
- `/src/components/media-details/TransitionPicker.tsx` - Transition selector
- `/src/components/media-details/PresetManager.tsx` - Preset manager UI
- `/src/components/media-details/MediaDetailsDemo.tsx` - Demo component
- `/src/components/media-details/index.ts` - Barrel exports
- `/src/stores/usePresetStore.ts` - Preset store
- `/src/hooks/useDebounce.ts` - Debounce hook
- `/src/components/ui/collapsible.tsx` - Collapsible UI component
- `/src/components/ui/slider.tsx` - Slider UI component
- `/src/components/ui/label.tsx` - Label UI component
- `/src/types/index.ts` - Extended with new property types

## Dependencies Added

- `@radix-ui/react-collapsible`
- `@radix-ui/react-slider`
- `@radix-ui/react-label`
