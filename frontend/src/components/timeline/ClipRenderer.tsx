import { memo, useMemo, useRef, useState, useEffect } from 'react'
import type { Clip, TrackType } from '../../types/stores'
import { framesToPixels, pixelsToFrames } from '../../lib/timebase'
import { getSnapTargets, snapClipPosition } from '../../lib/snapping'

/**
 * Helper function to snap clip to nearby targets
 */
function snapClipToTargets(
  startTime: number,
  duration: number,
  clipId: string,
  allClips: Map<string, Clip>,
  playhead: number
): number {
  const targets = getSnapTargets(allClips, playhead, [clipId], [])
  const snapResult = snapClipPosition(startTime, duration, targets)
  return snapResult.snapFrame
}

interface ClipRendererProps {
  clip: Clip
  isSelected: boolean
  fps: number
  zoom: number
  trackHeight: number
  trackType: TrackType
  isLocked: boolean
  trackId: string
  allClips?: Map<string, Clip>
  playhead?: number
  onSelect?: (clipId: string, addToSelection: boolean) => void
  onMove?: (clipId: string, trackId: string, startTime: number) => void
  onTrim?: (clipId: string, updates: Partial<Clip>) => void
}

export const ClipRenderer = memo(function ClipRenderer({
  clip,
  isSelected,
  fps,
  zoom,
  trackType,
  isLocked,
  trackId,
  allClips,
  playhead,
  onSelect,
  onMove,
  onTrim,
}: ClipRendererProps) {
  const clipRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStartPosRef = useRef({ x: 0, startTime: 0 })

  // Trim handle state
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null)
  const [trimOffset, setTrimOffset] = useState(0)
  const trimStartRef = useRef({ x: 0, startTime: 0, duration: 0, inPoint: 0, outPoint: 0 })

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
    if (!isLocked && !isDragging) {
      onSelect?.(clip.id, e.shiftKey)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return

    e.stopPropagation()
    e.preventDefault()

    // Store initial drag position
    dragStartPosRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
    }

    setIsDragging(true)
  }

  // Trim handle mouse down handlers
  const handleTrimStartMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return
    e.stopPropagation()
    e.preventDefault()

    trimStartRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
      duration: clip.duration,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
    }

    setIsTrimming('start')
  }

  const handleTrimEndMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return
    e.stopPropagation()
    e.preventDefault()

    trimStartRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
      duration: clip.duration,
      inPoint: clip.inPoint,
      outPoint: clip.outPoint,
    }

    setIsTrimming('end')
  }

  // Handle mouse move for dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPosRef.current.x

      // Convert pixel delta to frame delta
      const frameDelta = pixelsToFrames(deltaX, fps, zoom)

      // Calculate new start time
      let newStartTime = dragStartPosRef.current.startTime + frameDelta

      // Apply snapping if we have clip data
      if (allClips && playhead !== undefined) {
        newStartTime = snapClipToTargets(
          newStartTime,
          clip.duration,
          clip.id,
          allClips,
          playhead
        )
      }

      // Ensure clip doesn't go negative
      newStartTime = Math.max(0, Math.round(newStartTime))

      // Update drag offset for visual feedback
      setDragOffset(framesToPixels(newStartTime - clip.startTime, fps, zoom))
    }

    const handleMouseUp = () => {
      if (isDragging) {
        // Calculate final position
        const frameDelta = pixelsToFrames(dragOffset, fps, zoom)
        let newStartTime = clip.startTime + frameDelta

        // Apply snapping
        if (allClips && playhead !== undefined) {
          newStartTime = snapClipToTargets(
            newStartTime,
            clip.duration,
            clip.id,
            allClips,
            playhead
          )
        }

        newStartTime = Math.max(0, Math.round(newStartTime))

        // Only update if position changed
        if (newStartTime !== clip.startTime) {
          onMove?.(clip.id, trackId, newStartTime)
        }

        setIsDragging(false)
        setDragOffset(0)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, clip.id, clip.startTime, clip.duration, fps, zoom, trackId, allClips, playhead, onMove, dragOffset])

  // Handle trimming
  useEffect(() => {
    if (!isTrimming) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartRef.current.x
      const frameDelta = pixelsToFrames(deltaX, fps, zoom)

      if (isTrimming === 'start') {
        // Trimming the start
        const newStartTime = Math.max(0, Math.round(trimStartRef.current.startTime + frameDelta))

        setTrimOffset(framesToPixels(newStartTime - clip.startTime, fps, zoom))
      } else if (isTrimming === 'end') {
        // Trimming the end
        const newDuration = Math.max(1, Math.round(trimStartRef.current.duration + frameDelta))

        setTrimOffset(framesToPixels(newDuration - clip.duration, fps, zoom))
      }
    }

    const handleMouseUp = () => {
      if (isTrimming) {
        const frameDelta = pixelsToFrames(trimOffset, fps, zoom)

        const updates: Partial<Clip> = {}

        if (isTrimming === 'start') {
          const maxFrameDelta = trimStartRef.current.duration - 1
          const clampedFrameDelta = Math.min(frameDelta, maxFrameDelta)

          updates.startTime = Math.max(0, Math.round(trimStartRef.current.startTime + clampedFrameDelta))
          updates.inPoint = Math.max(0, trimStartRef.current.inPoint + clampedFrameDelta)
          updates.duration = Math.max(1, trimStartRef.current.duration - clampedFrameDelta)
        } else if (isTrimming === 'end') {
          const newDuration = Math.max(1, Math.round(trimStartRef.current.duration + frameDelta))
          updates.duration = newDuration
          updates.outPoint = trimStartRef.current.inPoint + newDuration
        }

        if (Object.keys(updates).length > 0) {
          onTrim?.(clip.id, updates)
        }

        setIsTrimming(null)
        setTrimOffset(0)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isTrimming, clip.id, clip.startTime, clip.duration, clip.inPoint, clip.outPoint, fps, zoom, onTrim, trimOffset])

  // Show clip duration in readable format
  const durationText = useMemo(() => {
    const seconds = Math.floor(clip.duration / fps)
    const frames = clip.duration % fps
    return seconds > 0 ? `${seconds}s ${frames}f` : `${frames}f`
  }, [clip.duration, fps])

  // Determine if clip should show thumbnail or just color block
  const showThumbnail = width > 40 // Only show details if clip is wide enough

  // Calculate visual position/width during trimming
  const visualLeft = isTrimming === 'start' ? left + trimOffset : left
  const visualWidth = isTrimming === 'end' ? width + trimOffset : isTrimming === 'start' ? width - trimOffset : width

  return (
    <div
      ref={clipRef}
      className={`
        absolute top-1 bottom-1 rounded
        ${clipColor}
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-950' : ''}
        ${isDragging || isTrimming ? 'opacity-70 z-50' : 'cursor-pointer hover:brightness-110'}
        ${isDragging ? 'cursor-grabbing' : ''}
        ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
        ${!isDragging && !isTrimming ? 'transition-all duration-75' : ''}
        overflow-hidden
      `}
      style={{
        left: `${isDragging ? left + dragOffset : visualLeft}px`,
        width: `${Math.max(isDragging ? width : visualWidth, 4)}px`, // Minimum 4px width
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
          <div
            className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 cursor-ew-resize hover:w-1.5 transition-all z-10"
            onMouseDown={handleTrimStartMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1 bg-blue-400 cursor-ew-resize hover:w-1.5 transition-all z-10"
            onMouseDown={handleTrimEndMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
    </div>
  )
})
