import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { TimelineStore, Clip, Track } from '../types/stores'

// Initial state
const initialState = {
  clips: new Map<string, Clip>(),
  tracks: [] as Track[],
  playhead: 0,
  zoom: 1,
  selectedClipIds: [] as string[],
  duration: 0,
  fps: 30,
}

// Create the vanilla store with devtools and immer middleware
export const createTimelineStore = () => {
  return createStore<TimelineStore>()(
    devtools(
      immer((set, get) => ({
      ...initialState,

      // Clip operations
      addClip: (clip) =>
        set((state) => {
          state.clips.set(clip.id, clip)
          // Update duration if clip extends beyond current duration
          const clipEnd = clip.startTime + clip.duration
          if (clipEnd > state.duration) {
            state.duration = clipEnd
          }
        }),

      removeClip: (clipId) =>
        set((state) => {
          state.clips.delete(clipId)
          // Remove from selection if selected
          state.selectedClipIds = state.selectedClipIds.filter((id) => id !== clipId)
        }),

      updateClip: (clipId, updates) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            state.clips.set(clipId, { ...clip, ...updates })
            // Update duration if needed
            const updatedClip = state.clips.get(clipId)!
            const clipEnd = updatedClip.startTime + updatedClip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      moveClip: (clipId, trackId, startTime) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            state.clips.set(clipId, { ...clip, trackId, startTime })
            // Update duration if needed
            const clipEnd = startTime + clip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      duplicateClip: (clipId) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            const newClip: Clip = {
              ...clip,
              id: `${clip.id}-copy-${Date.now()}`,
              startTime: clip.startTime + clip.duration + 10, // Offset by 10 frames
            }
            state.clips.set(newClip.id, newClip)
            const clipEnd = newClip.startTime + newClip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      splitClip: (clipId, frame) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (!clip || frame <= clip.startTime || frame >= clip.startTime + clip.duration) {
            return // Invalid split point
          }

          const splitPoint = frame - clip.startTime
          const firstClipDuration = splitPoint
          const secondClipDuration = clip.duration - splitPoint

          // Create first clip (before split)
          const firstClip: Clip = {
            ...clip,
            duration: firstClipDuration,
            outPoint: clip.inPoint + firstClipDuration,
          }

          // Create second clip (after split)
          const secondClip: Clip = {
            ...clip,
            id: `${clip.id}-split-${Date.now()}`,
            startTime: frame,
            duration: secondClipDuration,
            inPoint: clip.inPoint + firstClipDuration,
          }

          // Update clips map
          state.clips.set(clip.id, firstClip)
          state.clips.set(secondClip.id, secondClip)
        }),

      // Track operations
      addTrack: (track) =>
        set((state) => {
          const newTrack: Track = {
            ...track,
            id: `track-${Date.now()}`,
            order: state.tracks.length,
          }
          state.tracks.push(newTrack)
        }),

      removeTrack: (trackId) =>
        set((state) => {
          // Remove all clips on this track
          const clipsToRemove: string[] = []
          state.clips.forEach((clip) => {
            if (clip.trackId === trackId) {
              clipsToRemove.push(clip.id)
            }
          })
          clipsToRemove.forEach((clipId) => state.clips.delete(clipId))

          // Remove track
          state.tracks = state.tracks.filter((track) => track.id !== trackId)

          // Reorder remaining tracks
          state.tracks.forEach((track, index) => {
            track.order = index
          })
        }),

      updateTrack: (trackId, updates) =>
        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === trackId)
          if (trackIndex !== -1) {
            state.tracks[trackIndex] = { ...state.tracks[trackIndex], ...updates }
          }
        }),

      reorderTracks: (trackIds) =>
        set((state) => {
          const trackMap = new Map(state.tracks.map((track) => [track.id, track]))
          state.tracks = trackIds
            .map((id) => trackMap.get(id))
            .filter((track): track is Track => track !== undefined)
            .map((track, index) => ({ ...track, order: index }))
        }),

      // Playhead and view
      setPlayhead: (frame) =>
        set((state) => {
          state.playhead = Math.max(0, Math.min(frame, state.duration))
        }),

      setZoom: (zoom) =>
        set((state) => {
          state.zoom = Math.max(0.25, Math.min(8, zoom))
        }),

      // Selection
      selectClip: (clipId, addToSelection = false) =>
        set((state) => {
          if (addToSelection) {
            if (!state.selectedClipIds.includes(clipId)) {
              state.selectedClipIds.push(clipId)
            }
          } else {
            state.selectedClipIds = [clipId]
          }
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedClipIds = []
        }),

      // Utility
      reset: () => set(initialState),
      })),
      { name: 'TimelineStore' }
    )
  )
}

// Export type for the store instance
export type TimelineStoreInstance = ReturnType<typeof createTimelineStore>
