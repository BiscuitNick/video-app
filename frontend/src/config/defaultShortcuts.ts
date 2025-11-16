import type { ShortcutDefinition } from '@/types/shortcuts';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineStore } from '@/stores/useTimelineStore';

/**
 * Default keyboard shortcuts for the application
 *
 * These are the initial shortcuts that match the requirements.
 * Users can customize these later.
 */

/**
 * Create playback shortcuts
 */
export const createPlaybackShortcuts = (): ShortcutDefinition[] => {
  return [
    {
      id: 'playback.play-pause',
      name: 'Play/Pause',
      description: 'Toggle playback',
      category: 'playback',
      scope: 'global',
      priority: 100,
      defaultKeys: [
        { key: ' ' },
        { key: 'k' },
      ],
      action: () => {
        usePlaybackStore.getState().togglePlay();
      },
    },
    {
      id: 'playback.rewind',
      name: 'Rewind',
      description: 'Jump backward 5 seconds',
      category: 'playback',
      scope: 'global',
      priority: 90,
      defaultKeys: [{ key: 'j' }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        seek(Math.max(0, currentTime - 5));
      },
    },
    {
      id: 'playback.forward',
      name: 'Forward',
      description: 'Jump forward 5 seconds',
      category: 'playback',
      scope: 'global',
      priority: 90,
      defaultKeys: [{ key: 'l' }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        seek(currentTime + 5);
      },
    },
    {
      id: 'playback.frame-back',
      name: 'Previous Frame',
      description: 'Step backward one frame',
      category: 'playback',
      scope: 'global',
      priority: 90,
      defaultKeys: [{ key: 'arrowleft' }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        const fps = 30; // TODO: Get from project settings
        seek(Math.max(0, currentTime - 1 / fps));
      },
    },
    {
      id: 'playback.frame-forward',
      name: 'Next Frame',
      description: 'Step forward one frame',
      category: 'playback',
      scope: 'global',
      priority: 90,
      defaultKeys: [{ key: 'arrowright' }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        const fps = 30; // TODO: Get from project settings
        seek(currentTime + 1 / fps);
      },
    },
    {
      id: 'playback.second-back',
      name: 'Jump Back 1 Second',
      description: 'Jump backward 1 second',
      category: 'playback',
      scope: 'global',
      priority: 95,
      defaultKeys: [{ key: 'arrowleft', shift: true }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        seek(Math.max(0, currentTime - 1));
      },
    },
    {
      id: 'playback.second-forward',
      name: 'Jump Forward 1 Second',
      description: 'Jump forward 1 second',
      category: 'playback',
      scope: 'global',
      priority: 95,
      defaultKeys: [{ key: 'arrowright', shift: true }],
      action: () => {
        const { currentTime, seek } = usePlaybackStore.getState();
        seek(currentTime + 1);
      },
    },
    {
      id: 'playback.set-in-point',
      name: 'Set In Point',
      description: 'Mark the in point at current time',
      category: 'playback',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: 'i' }],
      action: () => {
        const { currentTime } = usePlaybackStore.getState();
        const { setPreviewRange, previewRange } = usePlaybackStore.getState();
        setPreviewRange({
          start: currentTime,
          end: previewRange?.end ?? currentTime + 10,
        });
        console.log('Set in point at', currentTime);
      },
    },
    {
      id: 'playback.set-out-point',
      name: 'Set Out Point',
      description: 'Mark the out point at current time',
      category: 'playback',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: 'o' }],
      action: () => {
        const { currentTime } = usePlaybackStore.getState();
        const { setPreviewRange, previewRange } = usePlaybackStore.getState();
        setPreviewRange({
          start: previewRange?.start ?? 0,
          end: currentTime,
        });
        console.log('Set out point at', currentTime);
      },
    },
    {
      id: 'playback.jump-to-start',
      name: 'Jump to Start',
      description: 'Jump to the beginning of the timeline',
      category: 'playback',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: 'home' }],
      action: () => {
        usePlaybackStore.getState().seek(0);
      },
    },
    {
      id: 'playback.jump-to-end',
      name: 'Jump to End',
      description: 'Jump to the end of the timeline',
      category: 'playback',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: 'end' }],
      action: () => {
        const { duration, seek } = usePlaybackStore.getState();
        seek(duration);
      },
    },
  ];
};

/**
 * Create editing shortcuts
 */
export const createEditingShortcuts = (): ShortcutDefinition[] => {
  return [
    {
      id: 'editing.cut',
      name: 'Cut Clip',
      description: 'Cut clip at playhead position',
      category: 'editing',
      scope: 'timeline',
      priority: 90,
      defaultKeys: [{ key: 'c' }],
      action: () => {
        // TODO: Implement cut at playhead
        console.log('Cut clip at playhead');
      },
    },
    {
      id: 'editing.select-tool',
      name: 'Select Tool',
      description: 'Activate selection tool',
      category: 'editing',
      scope: 'timeline',
      priority: 80,
      defaultKeys: [{ key: 'v' }],
      action: () => {
        // TODO: Implement tool selection
        console.log('Select tool activated');
      },
    },
    {
      id: 'editing.ripple-delete',
      name: 'Ripple Delete',
      description: 'Delete and close gap',
      category: 'editing',
      scope: 'timeline',
      priority: 85,
      defaultKeys: [{ key: 'r' }],
      action: () => {
        // TODO: Implement ripple delete
        console.log('Ripple delete');
      },
    },
    {
      id: 'editing.delete',
      name: 'Delete',
      description: 'Delete selected clips',
      category: 'editing',
      scope: 'timeline',
      priority: 90,
      defaultKeys: [
        { key: 'delete' },
        { key: 'backspace' },
      ],
      action: () => {
        const { selection, deleteSelectedClips } = useTimelineStore.getState();
        if (selection.clipIds.length > 0) {
          deleteSelectedClips();
        }
      },
    },
    {
      id: 'editing.copy',
      name: 'Copy',
      description: 'Copy selected clips',
      category: 'editing',
      scope: 'timeline',
      priority: 100,
      defaultKeys: [{ key: 'c', ctrl: true }],
      action: () => {
        const { selection, copySelectedClips } = useTimelineStore.getState();
        if (selection.clipIds.length > 0) {
          copySelectedClips();
        }
      },
    },
    {
      id: 'editing.paste',
      name: 'Paste',
      description: 'Paste copied clips',
      category: 'editing',
      scope: 'timeline',
      priority: 100,
      defaultKeys: [{ key: 'v', ctrl: true }],
      action: () => {
        useTimelineStore.getState().pasteClips();
      },
    },
    {
      id: 'editing.duplicate',
      name: 'Duplicate',
      description: 'Duplicate selected clips',
      category: 'editing',
      scope: 'timeline',
      priority: 90,
      defaultKeys: [{ key: 'd', ctrl: true }],
      action: () => {
        const { copySelectedClips, pasteClips } = useTimelineStore.getState();
        copySelectedClips();
        pasteClips();
      },
    },
    {
      id: 'editing.undo',
      name: 'Undo',
      description: 'Undo last action',
      category: 'editing',
      scope: 'global',
      priority: 100,
      defaultKeys: [{ key: 'z', ctrl: true }],
      action: () => {
        useTimelineStore.temporal.getState().undo();
      },
    },
    {
      id: 'editing.redo',
      name: 'Redo',
      description: 'Redo last undone action',
      category: 'editing',
      scope: 'global',
      priority: 100,
      defaultKeys: [
        { key: 'z', ctrl: true, shift: true },
        { key: 'y', ctrl: true },
      ],
      action: () => {
        useTimelineStore.temporal.getState().redo();
      },
    },
  ];
};

/**
 * Create timeline shortcuts
 */
export const createTimelineShortcuts = (): ShortcutDefinition[] => {
  return [
    {
      id: 'timeline.zoom-in',
      name: 'Zoom In',
      description: 'Zoom in on timeline',
      category: 'timeline',
      scope: 'timeline',
      priority: 80,
      defaultKeys: [
        { key: '+' },
        { key: '=' },
      ],
      action: () => {
        const { zoom, setZoom } = useTimelineStore.getState();
        setZoom(Math.min(zoom * 1.2, 10));
      },
    },
    {
      id: 'timeline.zoom-out',
      name: 'Zoom Out',
      description: 'Zoom out on timeline',
      category: 'timeline',
      scope: 'timeline',
      priority: 80,
      defaultKeys: [{ key: '-' }],
      action: () => {
        const { zoom, setZoom } = useTimelineStore.getState();
        setZoom(Math.max(zoom / 1.2, 0.1));
      },
    },
    {
      id: 'timeline.toggle-snapping',
      name: 'Toggle Snapping',
      description: 'Enable/disable timeline snapping',
      category: 'timeline',
      scope: 'timeline',
      priority: 80,
      defaultKeys: [{ key: 's' }],
      action: () => {
        useTimelineStore.getState().toggleSnap();
      },
    },
    {
      id: 'timeline.add-marker',
      name: 'Add Marker',
      description: 'Add a marker at current time',
      category: 'timeline',
      scope: 'timeline',
      priority: 80,
      defaultKeys: [{ key: 'm' }],
      action: () => {
        const { currentTime } = usePlaybackStore.getState();
        // TODO: Implement marker system
        console.log('Add marker at', currentTime);
      },
    },
    {
      id: 'timeline.select-all',
      name: 'Select All',
      description: 'Select all clips',
      category: 'timeline',
      scope: 'timeline',
      priority: 90,
      defaultKeys: [{ key: 'a', ctrl: true }],
      action: () => {
        useTimelineStore.getState().selectAll();
      },
    },
    {
      id: 'timeline.deselect',
      name: 'Deselect',
      description: 'Clear selection',
      category: 'timeline',
      scope: 'timeline',
      priority: 90,
      defaultKeys: [{ key: 'escape' }],
      action: () => {
        useTimelineStore.getState().clearSelection();
      },
    },
  ];
};

/**
 * Create view shortcuts
 */
export const createViewShortcuts = (): ShortcutDefinition[] => {
  return [
    {
      id: 'view.toggle-fullscreen',
      name: 'Toggle Fullscreen',
      description: 'Enter/exit fullscreen mode',
      category: 'view',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: '`' }],
      action: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },
    },
    {
      id: 'view.cycle-panels',
      name: 'Cycle Panels',
      description: 'Switch focus between panels',
      category: 'view',
      scope: 'global',
      priority: 80,
      defaultKeys: [{ key: 'tab' }],
      action: () => {
        // TODO: Implement panel cycling
        console.log('Cycle panels');
      },
    },
  ];
};

/**
 * Get all default shortcuts
 */
export const getAllDefaultShortcuts = (): ShortcutDefinition[] => {
  return [
    ...createPlaybackShortcuts(),
    ...createEditingShortcuts(),
    ...createTimelineShortcuts(),
    ...createViewShortcuts(),
  ];
};
