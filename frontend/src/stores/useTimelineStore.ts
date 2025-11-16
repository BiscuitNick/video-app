import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { Track, Clip, TimelineSelection } from '@/types';
import { dirtyStateMiddleware, type WithDirtyState } from './middleware/dirtyStateMiddleware';

interface ClipboardData {
  clips: Clip[];
  copiedAt: number;
}

interface TimelineState {
  // Tracks and clips
  tracks: Track[];

  // Track operations
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;

  // Clip operations
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  deleteClip: (id: string) => void;
  moveClip: (clipId: string, trackId: string, startTime: number) => void;

  // Selection
  selection: TimelineSelection;
  lastSelectedClipId: string | null;
  selectClip: (clipId: string, addToSelection?: boolean, rangeSelect?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  selectTrack: (trackId: string, addToSelection?: boolean) => void;
  toggleClipSelection: (clipId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Clipboard operations
  clipboard: ClipboardData | null;
  copySelectedClips: () => void;
  pasteClips: (targetTime?: number) => void;
  deleteSelectedClips: () => void;

  // Batch operations
  groupSelectedClips: () => void;

  // Timeline view state
  zoom: number;
  setZoom: (zoom: number) => void;
  scrollPosition: number;
  setScrollPosition: (position: number) => void;
  playhead: number;
  setPlayhead: (position: number) => void;

  // Snapping
  snapEnabled: boolean;
  toggleSnap: () => void;

  // Queries
  getTrackById: (id: string) => Track | undefined;
  getClipById: (id: string) => Clip | undefined;
  getClipsByTrack: (trackId: string) => Clip[];
  getSelectedClips: () => Clip[];
}

export const useTimelineStore = create<WithDirtyState<TimelineState>>()(
  temporal(
    devtools(
      persist(
        dirtyStateMiddleware(
          (set, get) => ({
        // State
        tracks: [],
        selection: {
          clipIds: [],
          trackIds: [],
        },
        lastSelectedClipId: null,
        clipboard: null,
        zoom: 1,
        scrollPosition: 0,
        playhead: 0,
        snapEnabled: true,

        // Track operations
        addTrack: (track) =>
          set((state) => ({
            tracks: [...state.tracks, track],
          })),

        updateTrack: (id, updates) =>
          set((state) => ({
            tracks: state.tracks.map((track) =>
              track.id === id ? { ...track, ...updates } : track
            ),
          })),

        deleteTrack: (id) =>
          set((state) => ({
            tracks: state.tracks.filter((track) => track.id !== id),
            selection: {
              ...state.selection,
              trackIds: state.selection.trackIds.filter(
                (trackId) => trackId !== id
              ),
            },
          })),

        reorderTracks: (startIndex, endIndex) =>
          set((state) => {
            const result = Array.from(state.tracks);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { tracks: result };
          }),

        // Clip operations
        addClip: (clip) =>
          set((state) => ({
            tracks: state.tracks.map((track) =>
              track.id === clip.trackId
                ? { ...track, clips: [...track.clips, clip] }
                : track
            ),
          })),

        updateClip: (id, updates) =>
          set((state) => ({
            tracks: state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) =>
                clip.id === id ? { ...clip, ...updates } : clip
              ),
            })),
          })),

        deleteClip: (id) =>
          set((state) => ({
            tracks: state.tracks.map((track) => ({
              ...track,
              clips: track.clips.filter((clip) => clip.id !== id),
            })),
            selection: {
              ...state.selection,
              clipIds: state.selection.clipIds.filter((clipId) => clipId !== id),
            },
          })),

        moveClip: (clipId, trackId, startTime) =>
          set((state) => {
            let clipToMove: Clip | undefined;
            let duration = 0;

            // Find and remove the clip from its current track
            const tracksWithoutClip = state.tracks.map((track) => {
              const clip = track.clips.find((c) => c.id === clipId);
              if (clip) {
                clipToMove = clip;
                duration = clip.endTime - clip.startTime;
                return {
                  ...track,
                  clips: track.clips.filter((c) => c.id !== clipId),
                };
              }
              return track;
            });

            if (!clipToMove) return state;

            // Add the clip to the new track with updated times
            const updatedClip = {
              ...clipToMove,
              trackId,
              startTime,
              endTime: startTime + duration,
            };

            return {
              tracks: tracksWithoutClip.map((track) =>
                track.id === trackId
                  ? { ...track, clips: [...track.clips, updatedClip] }
                  : track
              ),
            };
          }),

        // Selection
        selectClip: (clipId, addToSelection = false, rangeSelect = false) =>
          set((state) => {
            if (rangeSelect && state.lastSelectedClipId) {
              // Range selection - select all clips between last and current
              const allClips: Clip[] = [];
              state.tracks.forEach(track => {
                allClips.push(...track.clips);
              });

              const lastIndex = allClips.findIndex(c => c.id === state.lastSelectedClipId);
              const currentIndex = allClips.findIndex(c => c.id === clipId);

              if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const rangeClipIds = allClips.slice(start, end + 1).map(c => c.id);

                return {
                  selection: {
                    ...state.selection,
                    clipIds: Array.from(new Set([...state.selection.clipIds, ...rangeClipIds])),
                  },
                  lastSelectedClipId: clipId,
                };
              }
            }

            return {
              selection: {
                ...state.selection,
                clipIds: addToSelection
                  ? [...state.selection.clipIds, clipId]
                  : [clipId],
              },
              lastSelectedClipId: clipId,
            };
          }),

        selectClips: (clipIds) =>
          set((state) => ({
            selection: {
              ...state.selection,
              clipIds,
            },
            lastSelectedClipId: clipIds[clipIds.length - 1] || null,
          })),

        selectTrack: (trackId, addToSelection = false) =>
          set((state) => ({
            selection: {
              ...state.selection,
              trackIds: addToSelection
                ? [...state.selection.trackIds, trackId]
                : [trackId],
            },
          })),

        toggleClipSelection: (clipId) =>
          set((state) => {
            const isSelected = state.selection.clipIds.includes(clipId);
            return {
              selection: {
                ...state.selection,
                clipIds: isSelected
                  ? state.selection.clipIds.filter(id => id !== clipId)
                  : [...state.selection.clipIds, clipId],
              },
              lastSelectedClipId: isSelected ? state.lastSelectedClipId : clipId,
            };
          }),

        selectAll: () =>
          set((state) => {
            const allClipIds: string[] = [];
            state.tracks.forEach(track => {
              track.clips.forEach(clip => {
                allClipIds.push(clip.id);
              });
            });
            return {
              selection: {
                ...state.selection,
                clipIds: allClipIds,
              },
              lastSelectedClipId: allClipIds[allClipIds.length - 1] || null,
            };
          }),

        clearSelection: () =>
          set({
            selection: {
              clipIds: [],
              trackIds: [],
            },
            lastSelectedClipId: null,
          }),

        // Clipboard operations
        copySelectedClips: () =>
          set((state) => {
            const selectedClips = get().getSelectedClips();
            if (selectedClips.length === 0) return state;

            return {
              clipboard: {
                clips: selectedClips,
                copiedAt: Date.now(),
              },
            };
          }),

        pasteClips: (targetTime) =>
          set((state) => {
            if (!state.clipboard || state.clipboard.clips.length === 0) return state;

            // Find the earliest start time in copied clips
            const minStartTime = Math.min(...state.clipboard.clips.map(c => c.startTime));
            const pasteTime = targetTime !== undefined ? targetTime : state.playhead;
            const timeOffset = pasteTime - minStartTime;

            // Create new clips with new IDs and adjusted times
            const newClips = state.clipboard.clips.map(clip => ({
              ...clip,
              id: `${clip.id}-copy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              startTime: clip.startTime + timeOffset,
              endTime: clip.endTime + timeOffset,
            }));

            // Add clips to their respective tracks
            const updatedTracks = state.tracks.map(track => {
              const clipsForThisTrack = newClips.filter(c => c.trackId === track.id);
              if (clipsForThisTrack.length > 0) {
                return {
                  ...track,
                  clips: [...track.clips, ...clipsForThisTrack],
                };
              }
              return track;
            });

            return {
              tracks: updatedTracks,
              selection: {
                ...state.selection,
                clipIds: newClips.map(c => c.id),
              },
            };
          }),

        deleteSelectedClips: () =>
          set((state) => {
            const selectedIds = new Set(state.selection.clipIds);
            return {
              tracks: state.tracks.map(track => ({
                ...track,
                clips: track.clips.filter(clip => !selectedIds.has(clip.id)),
              })),
              selection: {
                ...state.selection,
                clipIds: [],
              },
              lastSelectedClipId: null,
            };
          }),

        // Batch operations
        groupSelectedClips: () =>
          set((state) => {
            // Group functionality - for now, just a placeholder
            // In a real implementation, this would create a group/compound clip
            console.log('Group selected clips:', state.selection.clipIds);
            return state;
          }),

        // Timeline view state
        setZoom: (zoom) => set({ zoom }),
        setScrollPosition: (position) => set({ scrollPosition: position }),
        setPlayhead: (position) => set({ playhead: position }),
        toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

        // Queries
        getTrackById: (id) => {
          return get().tracks.find((track) => track.id === id);
        },

        getClipById: (id) => {
          for (const track of get().tracks) {
            const clip = track.clips.find((c) => c.id === id);
            if (clip) return clip;
          }
          return undefined;
        },

        getClipsByTrack: (trackId) => {
          const track = get().tracks.find((t) => t.id === trackId);
          return track?.clips || [];
        },

        getSelectedClips: () => {
          const state = get();
          const selectedIds = new Set(state.selection.clipIds);
          const selectedClips: Clip[] = [];

          state.tracks.forEach(track => {
            track.clips.forEach(clip => {
              if (selectedIds.has(clip.id)) {
                selectedClips.push(clip);
              }
            });
          });

          return selectedClips;
        },
        }),
        {
          // Track specific fields for dirty state
          trackedFields: ['tracks', 'zoom', 'scrollPosition', 'playhead', 'snapEnabled'],
          excludedFields: ['selection'], // Don't track selection changes as dirty
        }
      ),
      {
        name: 'chronos-timeline-store',
        partialize: (state) => ({
          tracks: state.tracks,
          zoom: state.zoom,
          playhead: state.playhead,
          snapEnabled: state.snapEnabled,
        }),
      }
    ),
    { name: 'TimelineStore' }
    ),
    {
      limit: 50, // Maximum 50 undo/redo states
      equality: (a, b) => a === b,
      partialize: (state) => {
        // Only track changes to these fields for undo/redo
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tracks, zoom, playhead, ...rest } = state;
        return { tracks, zoom, playhead };
      },
    }
  )
);
