import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools } from 'zustand/middleware'
import { createIndexedDBStorage, STORE_NAMES } from '../lib/indexedDBStorage'
import type { ProjectStore, ProjectMetadata, ProjectSettings } from '../types/stores'

// Default project metadata
const defaultMetadata: ProjectMetadata = {
  id: `project-${Date.now()}`,
  name: 'Untitled Project',
  description: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
}

// Default project settings
const defaultSettings: ProjectSettings = {
  fps: 30,
  resolution: { width: 1920, height: 1080 },
  aspectRatio: '16:9',
  duration: 0,
  audioSampleRate: 48000,
}

// Initial state
const initialState = {
  metadata: { ...defaultMetadata },
  settings: { ...defaultSettings },
  isDirty: false,
  lastSaved: undefined as Date | undefined,
  autosaveInterval: 60000, // 1 minute
  isAutoSaveEnabled: true,
}

// Create the vanilla store with devtools, persist, and immer middleware
export const createProjectStore = () => {
  let autosaveTimer: NodeJS.Timeout | null = null

  const store = createStore<ProjectStore>()(
    devtools(
      persist(
        immer((set, get) => ({
      ...initialState,

      // Metadata operations
      updateMetadata: (updates) =>
        set((state) => {
          state.metadata = {
            ...state.metadata,
            ...updates,
            updatedAt: new Date(),
          }
          state.isDirty = true
        }),

      updateSettings: (updates) =>
        set((state) => {
          state.settings = {
            ...state.settings,
            ...updates,
          }
          state.isDirty = true

          // Update metadata timestamp
          state.metadata.updatedAt = new Date()
        }),

      // Dirty state
      setDirty: (isDirty) =>
        set((state) => {
          state.isDirty = isDirty
        }),

      // Save operations
      saveProject: async () => {
        const { metadata, settings, isDirty } = get()

        if (!isDirty) {
          console.log('Project is already saved')
          return
        }

        try {
          // TODO: Implement actual save to backend/storage
          console.log('Saving project...', { metadata, settings })

          // Simulate async save
          await new Promise((resolve) => setTimeout(resolve, 500))

          set((state) => {
            state.isDirty = false
            state.lastSaved = new Date()
            state.metadata.updatedAt = new Date()
          })

          console.log('Project saved successfully')
        } catch (error) {
          console.error('Failed to save project:', error)
          throw error
        }
      },

      loadProject: async (projectId) => {
        try {
          // TODO: Implement actual load from backend/storage
          console.log('Loading project...', projectId)

          // Simulate async load
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Mock loaded data
          const loadedMetadata: ProjectMetadata = {
            ...defaultMetadata,
            id: projectId,
            name: 'Loaded Project',
          }

          set((state) => {
            state.metadata = loadedMetadata
            state.settings = { ...defaultSettings }
            state.isDirty = false
            state.lastSaved = new Date()
          })

          console.log('Project loaded successfully')
        } catch (error) {
          console.error('Failed to load project:', error)
          throw error
        }
      },

      exportProject: async () => {
        const { metadata, settings } = get()

        try {
          // TODO: Implement actual export logic
          console.log('Exporting project...', { metadata, settings })

          // Simulate async export
          await new Promise((resolve) => setTimeout(resolve, 1000))

          console.log('Project exported successfully')
        } catch (error) {
          console.error('Failed to export project:', error)
          throw error
        }
      },

      // Autosave
      enableAutoSave: (enabled) =>
        set((state) => {
          state.isAutoSaveEnabled = enabled

          // Clear existing timer
          if (autosaveTimer) {
            clearInterval(autosaveTimer)
            autosaveTimer = null
          }

          // Start new timer if enabled
          if (enabled) {
            autosaveTimer = setInterval(() => {
              const state = get()
              if (state.isDirty && state.isAutoSaveEnabled) {
                state.saveProject().catch((error) => {
                  console.error('Autosave failed:', error)
                })
              }
            }, state.autosaveInterval)
          }
        }),

      setAutosaveInterval: (interval) =>
        set((state) => {
          state.autosaveInterval = interval

          // Restart autosave timer with new interval
          if (state.isAutoSaveEnabled) {
            if (autosaveTimer) {
              clearInterval(autosaveTimer)
            }

            autosaveTimer = setInterval(() => {
              const state = get()
              if (state.isDirty && state.isAutoSaveEnabled) {
                state.saveProject().catch((error) => {
                  console.error('Autosave failed:', error)
                })
              }
            }, interval)
          }
        }),

      // Utility
      reset: () => {
        if (autosaveTimer) {
          clearInterval(autosaveTimer)
          autosaveTimer = null
        }
        set(initialState)
      },
        })),
        {
          name: 'project-store',
          storage: createIndexedDBStorage(STORE_NAMES.PROJECT),
          // Serialize/deserialize dates properly
          serialize: (state) => {
            return JSON.stringify({
              state: {
                ...state.state,
                metadata: {
                  ...state.state.metadata,
                  createdAt: state.state.metadata.createdAt.toISOString(),
                  updatedAt: state.state.metadata.updatedAt.toISOString(),
                },
                lastSaved: state.state.lastSaved?.toISOString(),
              },
              version: state.version,
            })
          },
          deserialize: (str) => {
            const parsed = JSON.parse(str)
            return {
              state: {
                ...parsed.state,
                metadata: {
                  ...parsed.state.metadata,
                  createdAt: new Date(parsed.state.metadata.createdAt),
                  updatedAt: new Date(parsed.state.metadata.updatedAt),
                },
                lastSaved: parsed.state.lastSaved ? new Date(parsed.state.lastSaved) : undefined,
              },
              version: parsed.version,
            }
          },
        }
      ),
      { name: 'ProjectStore' }
    )
  )

  return store
}

// Export type for the store instance
export type ProjectStoreInstance = ReturnType<typeof createProjectStore>
