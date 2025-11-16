import { memo, useMemo, useRef, useState } from 'react'
import type { Clip, TrackType } from '../../types/stores'
import { framesToPixels } from '../../lib/timebase'

interface ClipRendererProps {
  clip: Clip
  isSelected: boolean
  fps: number
  zoom: number
  trackHeight: number
  trackType: TrackType
  isLocked: boolean
  onSelect?: (clipId: string, addToSelection: boolean) => void
  onMove?: (clipId: string, trackId: string, startTime: number) => void
}

export const ClipRenderer = memo(function ClipRenderer({
  clip,
  isSelected,
  fps,
  zoom,
  trackType,
  isLocked,
  onSelect,
}: ClipRendererProps) {
  const clipRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Calculate clip position and dimensions
  const left = useMemo(
    () => framesToPixels(clip.startTime, fps, zoom),
    [clip.startTime, fps, zoom]
  )

  const width = useMemo(
    () => framesToPixels(clip.duration, fps, zoom),
    [clip.duration, fps, zoom]
  )

  // Get clip color based on track type
  const clipColor = trackType === 'video'
    ? 'bg-purple-700'
    : trackType === 'audio'
    ? 'bg-green-700'
    : 'bg-blue-700'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLocked) {
      onSelect?.(clip.id, e.shiftKey)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return

    e.stopPropagation()
    setIsDragging(true)
    // Future: implement drag and drop here
  }

  // Show clip duration in readable format
  const durationText = useMemo(() => {
    const seconds = Math.floor(clip.duration / fps)
    const frames = clip.duration % fps
    return seconds > 0 ? `${seconds}s ${frames}f` : `${frames}f`
  }, [clip.duration, fps])

  // Determine if clip should show thumbnail or just color block
  const showThumbnail = width > 40 // Only show details if clip is wide enough

  return (
    <div
      ref={clipRef}
      className={`
        absolute top-1 bottom-1 rounded
        ${clipColor}
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-950' : ''}
        ${isDragging ? 'opacity-70 cursor-grabbing' : 'cursor-pointer hover:brightness-110'}
        ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
        transition-all duration-75
        overflow-hidden
      `}
      style={{
        left: `${left}px`,
        width: `${Math.max(width, 4)}px`, // Minimum 4px width
        opacity: clip.opacity,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Clip content */}
      {showThumbnail && (
        <div className="absolute inset-0 p-1 flex flex-col justify-between text-xs text-white pointer-events-none">
          <div className="truncate font-medium">
            {/* In a real app, this would show the asset name */}
            Clip {clip.id.slice(0, 8)}
          </div>
          <div className="text-[10px] opacity-75">
            {durationText}
          </div>
        </div>
      )}

      {/* Transition indicators */}
      {clip.transitionIn && (
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-white/30 to-transparent pointer-events-none" />
      )}
      {clip.transitionOut && (
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-white/30 to-transparent pointer-events-none" />
      )}

      {/* Trim handles */}
      {isSelected && !isLocked && width > 20 && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 cursor-ew-resize hover:w-1.5 transition-all" />
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-400 cursor-ew-resize hover:w-1.5 transition-all" />
        </>
      )}
    </div>
  )
})
