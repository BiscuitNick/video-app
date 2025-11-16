import { Virtuoso } from 'react-virtuoso'
import type { Track, Clip } from '../../types/stores'
import { TrackItem } from './TrackItem'

interface TrackListProps {
  tracks: Track[]
  clips: Map<string, Clip>
  selectedClipIds: string[]
  fps: number
  zoom: number
  duration: number
  playhead: number
  scrollLeft: number
  onClipSelect?: (clipId: string, addToSelection: boolean) => void
  onClipMove?: (clipId: string, trackId: string, startTime: number) => void
  onClipTrim?: (clipId: string, updates: Partial<Clip>) => void
  onTrackUpdate?: (trackId: string, updates: Partial<Track>) => void
}

export function TrackList({
  tracks,
  clips,
  selectedClipIds,
  fps,
  zoom,
  duration,
  playhead,
  scrollLeft,
  onClipSelect,
  onClipMove,
  onClipTrim,
  onTrackUpdate,
}: TrackListProps) {
  // Get clips for a specific track
  const getClipsForTrack = (trackId: string): Clip[] => {
    const trackClips: Clip[] = []
    clips.forEach((clip) => {
      if (clip.trackId === trackId) {
        trackClips.push(clip)
      }
    })
    return trackClips.sort((a, b) => a.startTime - b.startTime)
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        No tracks yet. Add a track to get started.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Virtuoso
        data={tracks}
        itemContent={(_index, track) => {
          const trackClips = getClipsForTrack(track.id)

          return (
            <TrackItem
              key={track.id}
              track={track}
              clips={trackClips}
              selectedClipIds={selectedClipIds}
              fps={fps}
              zoom={zoom}
              duration={duration}
              playhead={playhead}
              scrollLeft={scrollLeft}
              allClips={clips}
              onClipSelect={onClipSelect}
              onClipMove={onClipMove}
              onClipTrim={onClipTrim}
              onTrackUpdate={onTrackUpdate}
            />
          )
        }}
        computeItemKey={(_index, track) => track.id}
        style={{ height: '100%' }}
        overscan={2}
      />
    </div>
  )
}
