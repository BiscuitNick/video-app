import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import {
  createTimelineStore,
  type TimelineStoreInstance,
} from '../stores/timelineStore'
import {
  createMediaStore,
  type MediaStoreInstance,
} from '../stores/mediaStore'
import {
  createProjectStore,
  type ProjectStoreInstance,
} from '../stores/projectStore'
import {
  createEditorStore,
  type EditorStoreInstance,
} from '../stores/editorStore'
import type { TimelineStore, MediaStore, ProjectStore, EditorStore } from '../types/stores'

// Create contexts for each store
const TimelineStoreContext = createContext<TimelineStoreInstance | null>(null)
const MediaStoreContext = createContext<MediaStoreInstance | null>(null)
const ProjectStoreContext = createContext<ProjectStoreInstance | null>(null)
const EditorStoreContext = createContext<EditorStoreInstance | null>(null)

// Provider props
interface StoreProviderProps {
  children: ReactNode
}

// Combined store provider component
export function StoreProvider({ children }: StoreProviderProps) {
  // Create store instances only once using refs
  const timelineStore = useRef<TimelineStoreInstance>()
  const mediaStore = useRef<MediaStoreInstance>()
  const projectStore = useRef<ProjectStoreInstance>()
  const editorStore = useRef<EditorStoreInstance>()

  if (!timelineStore.current) {
    timelineStore.current = createTimelineStore()
  }
  if (!mediaStore.current) {
    mediaStore.current = createMediaStore()
  }
  if (!projectStore.current) {
    projectStore.current = createProjectStore()
  }
  if (!editorStore.current) {
    editorStore.current = createEditorStore()
  }

  return (
    <TimelineStoreContext.Provider value={timelineStore.current}>
      <MediaStoreContext.Provider value={mediaStore.current}>
        <ProjectStoreContext.Provider value={projectStore.current}>
          <EditorStoreContext.Provider value={editorStore.current}>
            {children}
          </EditorStoreContext.Provider>
        </ProjectStoreContext.Provider>
      </MediaStoreContext.Provider>
    </TimelineStoreContext.Provider>
  )
}

// Custom hooks for accessing stores

/**
 * Hook to access the Timeline store
 * @param selector - Optional selector function to pick specific state
 * @returns Selected state or entire store
 * @example
 * // Get entire store
 * const timelineStore = useTimelineStore()
 *
 * // Get specific state with selector
 * const playhead = useTimelineStore((state) => state.playhead)
 */
export function useTimelineStore<T = TimelineStore>(
  selector?: (state: TimelineStore) => T
): T {
  const store = useContext(TimelineStoreContext)
  if (!store) {
    throw new Error('useTimelineStore must be used within StoreProvider')
  }
  return useStore(store, selector || ((state) => state as T))
}

/**
 * Hook to access the Media store
 * @param selector - Optional selector function to pick specific state
 * @returns Selected state or entire store
 * @example
 * // Get entire store
 * const mediaStore = useMediaStore()
 *
 * // Get specific state with selector
 * const assets = useMediaStore((state) => Array.from(state.assets.values()))
 */
export function useMediaStore<T = MediaStore>(
  selector?: (state: MediaStore) => T
): T {
  const store = useContext(MediaStoreContext)
  if (!store) {
    throw new Error('useMediaStore must be used within StoreProvider')
  }
  return useStore(store, selector || ((state) => state as T))
}

/**
 * Hook to access the Project store
 * @param selector - Optional selector function to pick specific state
 * @returns Selected state or entire store
 * @example
 * // Get entire store
 * const projectStore = useProjectStore()
 *
 * // Get specific state with selector
 * const projectName = useProjectStore((state) => state.metadata.name)
 */
export function useProjectStore<T = ProjectStore>(
  selector?: (state: ProjectStore) => T
): T {
  const store = useContext(ProjectStoreContext)
  if (!store) {
    throw new Error('useProjectStore must be used within StoreProvider')
  }
  return useStore(store, selector || ((state) => state as T))
}

/**
 * Hook to access the Editor store
 * @param selector - Optional selector function to pick specific state
 * @returns Selected state or entire store
 * @example
 * // Get entire store
 * const editorStore = useEditorStore()
 *
 * // Get specific state with selector
 * const isPlaying = useEditorStore((state) => state.isPlaying)
 */
export function useEditorStore<T = EditorStore>(
  selector?: (state: EditorStore) => T
): T {
  const store = useContext(EditorStoreContext)
  if (!store) {
    throw new Error('useEditorStore must be used within StoreProvider')
  }
  return useStore(store, selector || ((state) => state as T))
}

// Export context for advanced use cases
export {
  TimelineStoreContext,
  MediaStoreContext,
  ProjectStoreContext,
  EditorStoreContext,
}
