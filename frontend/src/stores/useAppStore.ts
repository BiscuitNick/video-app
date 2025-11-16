import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ProjectInfo, UIState } from '@/types';
import { dirtyStateMiddleware, type WithDirtyState } from './middleware/dirtyStateMiddleware';

interface AppState {
  // Project info
  project: ProjectInfo;
  setProject: (project: Partial<ProjectInfo>) => void;
  resetProject: () => void;

  // UI state
  uiState: UIState;
  setUIState: (uiState: Partial<UIState>) => void;
  toggleSidebar: () => void;
  setSelectedPanel: (panel: UIState['selectedPanel']) => void;

  // Global state
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const defaultProject: ProjectInfo = {
  id: null,
  name: 'Untitled Project',
  createdAt: null,
  updatedAt: null,
  duration: 0,
  fps: 30,
  resolution: {
    width: 1920,
    height: 1080,
  },
};

const defaultUIState: UIState = {
  sidebarOpen: true,
  timelineHeight: 300,
  selectedPanel: 'media',
};

export const useAppStore = create<WithDirtyState<AppState>>()(
  devtools(
    persist(
      dirtyStateMiddleware(
        (set) => ({
        // Project state
        project: defaultProject,
        setProject: (project) =>
          set((state) => ({
            project: { ...state.project, ...project },
          })),
        resetProject: () => set({ project: defaultProject }),

        // UI state
        uiState: defaultUIState,
        setUIState: (uiState) =>
          set((state) => ({
            uiState: { ...state.uiState, ...uiState },
          })),
        toggleSidebar: () =>
          set((state) => ({
            uiState: {
              ...state.uiState,
              sidebarOpen: !state.uiState.sidebarOpen,
            },
          })),
        setSelectedPanel: (panel) =>
          set((state) => ({
            uiState: { ...state.uiState, selectedPanel: panel },
          })),

        // Global state
        isLoading: false,
        setIsLoading: (isLoading) => set({ isLoading }),
        error: null,
        setError: (error) => set({ error }),
        }),
        {
          // Track specific fields for dirty state
          trackedFields: ['project'],
          excludedFields: ['uiState', 'isLoading', 'error'], // Don't track UI state as dirty
        }
      ),
      {
        name: 'chronos-app-store',
        partialize: (state) => ({
          project: state.project,
          uiState: state.uiState,
        }),
      }
    ),
    { name: 'AppStore' }
  )
);
