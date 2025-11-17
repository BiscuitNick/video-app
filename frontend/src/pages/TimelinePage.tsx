import { useEffect, useMemo } from 'react'
import { useTemporalStore } from 'zundo'
import { Timeline } from '../components/timeline'
import { ClipPropertiesPanel } from '../components/timeline/ClipPropertiesPanel'
import { useTimelineStore } from '../contexts/StoreContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import type { TrackType } from '../types/stores'

export function TimelinePage() {
  const timelineStore = useTimelineStore()

  // Get temporal store actions for undo/redo
  const { undo, redo, futureStates, pastStates } = useTemporalStore(timelineStore as any)
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  // Initialize with a single default track for mixed media
  useEffect(() => {
    if (timelineStore.tracks.length === 0) {
      // Add default track that can handle all media types
      timelineStore.addTrack({
        type: 'video' as TrackType, // Type is now just cosmetic for color
        name: 'Track 1',
        height: 80,
        locked: false,
        hidden: false,
        muted: false,
        order: 0,
      })

      // Set initial timeline duration (5 minutes at 30fps)
      if (timelineStore.duration === 0) {
        // This will be set automatically when clips are added
        // For now, just initialize the timeline
      }
    }
  }, [])

  const handleAddTrack = () => {
    const trackNumber = timelineStore.tracks.length + 1
    timelineStore.addTrack({
      type: 'video' as TrackType, // Type is now just cosmetic for color
      name: `Track ${trackNumber}`,
      height: 80,
      locked: false,
      hidden: false,
      muted: false,
      order: timelineStore.tracks.length,
    })
  }

  const handleSplitClip = (clipId: string, frame: number) => {
    timelineStore.splitClip(clipId, frame)
  }

  const handleDuplicateClips = (clipIds: string[]) => {
    clipIds.forEach((clipId) => {
      timelineStore.duplicateClip(clipId)
    })
  }

  const handleDeleteClips = (clipIds: string[]) => {
    clipIds.forEach((clipId) => {
      timelineStore.removeClip(clipId)
    })
    // Clear selection after deletion
    timelineStore.clearSelection()
  }

  // Calculate duration (use stored duration or default to 5 minutes)
  const duration = timelineStore.duration > 0 ? timelineStore.duration : timelineStore.fps * 300 // 5 minutes default

  // Get selected clip
  const selectedClip = timelineStore.selectedClipIds.length === 1
    ? timelineStore.clips.get(timelineStore.selectedClipIds[0])
    : undefined

  // Define keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      key: 's',
      action: () => {
        // Split clip at playhead
        if (timelineStore.selectedClipIds.length > 0) {
          const clipId = timelineStore.selectedClipIds[0]
          const clip = timelineStore.clips.get(clipId)
          if (clip && timelineStore.playhead >= clip.startTime && timelineStore.playhead < clip.startTime + clip.duration) {
            handleSplitClip(clipId, timelineStore.playhead)
          }
        }
      },
      description: 'Split clip at playhead',
      enabled: timelineStore.selectedClipIds.length > 0,
    },
    {
      key: 'Delete',
      action: () => handleDeleteClips(timelineStore.selectedClipIds),
      description: 'Delete selected clips',
      enabled: timelineStore.selectedClipIds.length > 0,
    },
    {
      key: 'Backspace',
      action: () => handleDeleteClips(timelineStore.selectedClipIds),
      description: 'Delete selected clips',
      enabled: timelineStore.selectedClipIds.length > 0,
    },
    {
      key: 'd',
      ctrl: true,
      action: () => handleDuplicateClips(timelineStore.selectedClipIds),
      description: 'Duplicate selected clips',
      enabled: timelineStore.selectedClipIds.length > 0,
    },
    {
      key: 'a',
      ctrl: true,
      action: () => {
        // Select all clips
        const allClipIds = Array.from(timelineStore.clips.keys())
        allClipIds.forEach((id, index) => {
          timelineStore.selectClip(id, index > 0)
        })
      },
      description: 'Select all clips',
      enabled: timelineStore.clips.size > 0,
    },
    {
      key: 'Escape',
      action: () => timelineStore.clearSelection(),
      description: 'Clear selection',
      enabled: timelineStore.selectedClipIds.length > 0,
    },
    {
      key: 'z',
      ctrl: true,
      action: () => undo(),
      description: 'Undo',
      enabled: canUndo,
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      action: () => redo(),
      description: 'Redo',
      enabled: canRedo,
    },
    {
      key: 'y',
      ctrl: true,
      action: () => redo(),
      description: 'Redo',
      enabled: canRedo,
    },
  ], [timelineStore, handleSplitClip, handleDuplicateClips, handleDeleteClips, undo, redo, canUndo, canRedo])

  // Enable keyboard shortcuts
  useKeyboardShortcuts({ shortcuts, enabled: true })

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col">
        <Timeline
          tracks={timelineStore.tracks}
          clips={timelineStore.clips}
          selectedClipIds={timelineStore.selectedClipIds}
          playhead={timelineStore.playhead}
          zoom={timelineStore.zoom}
          duration={duration}
          fps={timelineStore.fps}
          onPlayheadChange={timelineStore.setPlayhead}
          onZoomChange={timelineStore.setZoom}
          onClipSelect={timelineStore.selectClip}
          onClipMove={timelineStore.moveClip}
          onClipTrim={timelineStore.updateClip}
          onSplitClip={handleSplitClip}
          onDuplicateClips={handleDuplicateClips}
          onDeleteClips={handleDeleteClips}
          onTrackUpdate={timelineStore.updateTrack}
          onAddTrack={handleAddTrack}
        />
      </div>

      {/* Clip Properties Panel */}
      {selectedClip && (
        <div className="w-80 flex-shrink-0">
          <ClipPropertiesPanel
            clip={selectedClip}
            fps={timelineStore.fps}
            onUpdate={timelineStore.updateClip}
          />
        </div>
      )}
    </div>
  )
}
