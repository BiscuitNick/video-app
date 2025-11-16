import { useRef, useState, useCallback, useEffect } from 'react'
import { TimelineRuler } from './TimelineRuler'
import { TrackList } from './TrackList'
import { ZoomControls } from './ZoomControls'
import type { Track, Clip } from '../../types/stores'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'

interface TimelineProps {
  tracks: Track[]
  clips: Map<string, Clip>
  selectedClipIds: string[]
  playhead: number
  zoom: number
  duration: number
  fps: number
  onPlayheadChange: (frame: number) => void
  onZoomChange: (zoom: number) => void
  onClipSelect?: (clipId: string, addToSelection: boolean) => void
  onClipMove?: (clipId: string, trackId: string, startTime: number) => void
  onTrackUpdate?: (trackId: string, updates: Partial<Track>) => void
  onAddTrack?: () => void
}

export function Timeline({
  tracks,
  clips,
  selectedClipIds,
  playhead,
  zoom,
  duration,
  fps,
  onPlayheadChange,
  onZoomChange,
  onClipSelect,
  onClipMove,
  onTrackUpdate,
  onAddTrack,
}: TimelineProps) {
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const tracksScrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  // Synchronize horizontal scrolling between ruler and tracks
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const newScrollLeft = target.scrollLeft

    setScrollLeft(newScrollLeft)

    // Sync the other scroll container
    if (target === rulerScrollRef.current && tracksScrollRef.current) {
      tracksScrollRef.current.scrollLeft = newScrollLeft
    } else if (target === tracksScrollRef.current && rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = newScrollLeft
    }
  }, [])

  // Update viewport width on resize
  useEffect(() => {
    const updateViewportWidth = () => {
      if (tracksScrollRef.current) {
        setViewportWidth(tracksScrollRef.current.clientWidth)
      }
    }

    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-t border-zinc-700">
      {/* Timeline header with controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-200">Timeline</h3>
          {onAddTrack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddTrack}
              className="h-7"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Track
            </Button>
          )}
        </div>

        <ZoomControls zoom={zoom} onZoomChange={onZoomChange} />
      </div>

      {/* Timeline ruler (scrollable horizontally) */}
      <div
        ref={rulerScrollRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-thin"
        onScroll={handleScroll}
      >
        <TimelineRuler
          duration={duration}
          fps={fps}
          zoom={zoom}
          scrollLeft={scrollLeft}
          viewportWidth={viewportWidth}
          playhead={playhead}
          onSeek={onPlayheadChange}
        />
      </div>

      {/* Timeline tracks (scrollable both directions) */}
      <div
        ref={tracksScrollRef}
        className="flex-1 overflow-auto scrollbar-thin"
        onScroll={handleScroll}
      >
        <div className="min-h-full">
          <TrackList
            tracks={tracks}
            clips={clips}
            selectedClipIds={selectedClipIds}
            fps={fps}
            zoom={zoom}
            duration={duration}
            playhead={playhead}
            scrollLeft={scrollLeft}
            onClipSelect={onClipSelect}
            onClipMove={onClipMove}
            onTrackUpdate={onTrackUpdate}
          />
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .scrollbar-thin::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgb(24 24 27); /* zinc-950 */
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgb(63 63 70); /* zinc-700 */
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgb(82 82 91); /* zinc-600 */
        }
      `}</style>
    </div>
  )
}
