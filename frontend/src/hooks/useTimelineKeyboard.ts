import { useEffect } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { frameToTime } from '@/lib/timeline/timeUtils';

interface UseTimelineKeyboardOptions {
  fps?: number;
  enabled?: boolean;
}

export const useTimelineKeyboard = ({
  fps = 30,
  enabled = true,
}: UseTimelineKeyboardOptions = {}) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { currentTime, seek, togglePlay } = usePlaybackStore.getState();
      const {
        toggleSnap,
        selectAll,
        clearSelection,
        copySelectedClips,
        pasteClips,
        deleteSelectedClips,
        selection,
      } = useTimelineStore.getState();

      // Get temporal functions from store
      const { undo, redo } = useTimelineStore.temporal.getState();

      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        // Playback controls
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;

        // Frame-by-frame navigation
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            // Jump back 1 second
            seek(Math.max(0, currentTime - 1));
          } else {
            // Step back 1 frame
            const frameTime = 1 / fps;
            seek(Math.max(0, currentTime - frameTime));
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Jump forward 1 second
            seek(currentTime + 1);
          } else {
            // Step forward 1 frame
            const frameTime = 1 / fps;
            seek(currentTime + frameTime);
          }
          break;

        // Jump to start/end
        case 'Home':
          e.preventDefault();
          seek(0);
          break;

        case 'End':
          e.preventDefault();
          // Jump to end of timeline (would need duration from props)
          break;

        // Toggle snapping
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleSnap();
          }
          break;

        // Markers (I/O for in/out points)
        case 'i':
        case 'I':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Set in point (would be implemented in parent)
            console.log('Set in point at', currentTime);
          }
          break;

        case 'o':
        case 'O':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Set out point (would be implemented in parent)
            console.log('Set out point at', currentTime);
          }
          break;

        // Selection shortcuts
        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            selectAll();
          }
          break;

        case 'Escape':
          e.preventDefault();
          clearSelection();
          break;

        // Undo/Redo
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              // Redo (Ctrl+Shift+Z)
              redo();
            } else {
              // Undo (Ctrl+Z)
              undo();
            }
          }
          break;

        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Redo (Ctrl+Y)
            redo();
          }
          break;

        // Clipboard operations
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selection.clipIds.length > 0) {
              copySelectedClips();
            }
          }
          break;

        case 'x':
        case 'X':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selection.clipIds.length > 0) {
              copySelectedClips();
              deleteSelectedClips();
            }
          }
          break;

        case 'v':
        case 'V':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pasteClips();
          }
          break;

        // Delete selected clips
        case 'Delete':
        case 'Backspace':
          if (selection.clipIds.length > 0) {
            e.preventDefault();
            deleteSelectedClips();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fps, enabled]);
};
