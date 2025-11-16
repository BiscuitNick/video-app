import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface PlaybackState {
  // Playback state
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  loop: boolean;

  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleLoop: () => void;

  // Internal setters (for playback engine)
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // Preview range (for rendering a specific segment)
  previewRange: { start: number; end: number } | null;
  setPreviewRange: (range: { start: number; end: number } | null) => void;

  // Rendering state
  isRendering: boolean;
  renderProgress: number;
  setIsRendering: (isRendering: boolean) => void;
  setRenderProgress: (progress: number) => void;
}

export const usePlaybackStore = create<PlaybackState>()(
  devtools(
    persist(
      (set) => ({
        // State
        playing: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        muted: false,
        playbackRate: 1,
        loop: false,
        previewRange: null,
        isRendering: false,
        renderProgress: 0,

        // Playback controls
        play: () => set({ playing: true }),
        pause: () => set({ playing: false }),
        togglePlay: () => set((state) => ({ playing: !state.playing })),

        seek: (time) =>
          set((state) => ({
            currentTime: Math.max(0, Math.min(time, state.duration)),
          })),

        setVolume: (volume) =>
          set({
            volume: Math.max(0, Math.min(1, volume)),
          }),

        toggleMute: () => set((state) => ({ muted: !state.muted })),

        setPlaybackRate: (rate) =>
          set({
            playbackRate: Math.max(0.25, Math.min(2, rate)),
          }),

        toggleLoop: () => set((state) => ({ loop: !state.loop })),

        // Internal setters
        setPlaying: (playing) => set({ playing }),
        setCurrentTime: (time) => set({ currentTime: time }),
        setDuration: (duration) => set({ duration }),

        // Preview range
        setPreviewRange: (range) => set({ previewRange: range }),

        // Rendering state
        setIsRendering: (isRendering) => set({ isRendering }),
        setRenderProgress: (progress) =>
          set({ renderProgress: Math.max(0, Math.min(100, progress)) }),
      }),
      {
        name: 'chronos-playback-store',
        partialize: (state) => ({
          volume: state.volume,
          muted: state.muted,
          playbackRate: state.playbackRate,
          loop: state.loop,
        }),
      }
    ),
    { name: 'PlaybackStore' }
  )
);
