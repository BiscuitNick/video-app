import { useEffect } from 'react'
import { Timeline } from '../components/timeline'
import { useTimelineStore } from '../contexts/StoreContext'
import type { TrackType } from '../types/stores'

export function TimelinePage() {
  const timelineStore = useTimelineStore()

  // Initialize with some default tracks for demonstration
  useEffect(() => {
    if (timelineStore.tracks.length === 0) {
      // Add default tracks
      timelineStore.addTrack({
        type: 'video' as TrackType,
        name: 'Video 1',
        height: 80,
        locked: false,
        hidden: false,
        muted: false,
        order: 0,
      })

      timelineStore.addTrack({
        type: 'audio' as TrackType,
        name: 'Audio 1',
        height: 60,
        locked: false,
        hidden: false,
        muted: false,
        order: 1,
      })

      timelineStore.addTrack({
        type: 'text' as TrackType,
        name: 'Text/Titles',
        height: 60,
        locked: false,
        hidden: false,
        muted: false,
        order: 2,
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
      type: 'video' as TrackType,
      name: `Track ${trackNumber}`,
      height: 80,
      locked: false,
      hidden: false,
      muted: false,
      order: timelineStore.tracks.length,
    })
  }

  // Calculate duration (use stored duration or default to 5 minutes)
  const duration = timelineStore.duration > 0 ? timelineStore.duration : timelineStore.fps * 300 // 5 minutes default

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
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
          onTrackUpdate={timelineStore.updateTrack}
          onAddTrack={handleAddTrack}
        />
      </div>
    </div>
  )
}
