import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ExportJob } from '@/types/api';

// Export wizard steps
export type ExportStep = 'settings' | 'review' | 'progress';

// Export settings form data
export interface ExportSettings {
  name: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | 'custom';
  resolution: {
    width: number;
    height: number;
  };
  format: 'mp4' | 'mov' | 'webm';
  quality: number; // 0-100, maps to CRF values
  frameRate: number;
}

// Export progress stage
export type ExportStage = 'downloading' | 'rendering' | 'encoding' | 'uploading' | 'completed' | 'failed';

// Export progress details
export interface ExportProgressDetails {
  stage: ExportStage;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // in seconds
  currentFrame?: number;
  totalFrames?: number;
  message?: string;
}

// Active export job with progress
export interface ActiveExport extends ExportJob {
  progressDetails?: ExportProgressDetails;
}

interface ExportState {
  // Wizard state
  currentStep: ExportStep;
  wizardOpen: boolean;
  settings: ExportSettings | null;

  // Active exports (in progress)
  activeExports: Map<string, ActiveExport>;

  // Export history (completed/failed)
  exportHistory: ExportJob[];

  // Wizard actions
  openWizard: () => void;
  closeWizard: () => void;
  setCurrentStep: (step: ExportStep) => void;
  setSettings: (settings: ExportSettings) => void;
  resetWizard: () => void;

  // Export management
  addActiveExport: (exportJob: ExportJob) => void;
  updateExportProgress: (exportId: string, progress: ExportProgressDetails) => void;
  completeExport: (exportId: string, exportJob: ExportJob) => void;
  failExport: (exportId: string, error: string) => void;
  cancelExport: (exportId: string) => void;
  removeActiveExport: (exportId: string) => void;

  // History management
  addToHistory: (exportJob: ExportJob) => void;
  removeFromHistory: (exportId: string) => void;
  clearHistory: () => void;

  // Utility
  getActiveExport: (exportId: string) => ActiveExport | undefined;
  hasActiveExports: () => boolean;
}

const defaultSettings: ExportSettings = {
  name: 'Untitled Export',
  aspectRatio: '16:9',
  resolution: {
    width: 1920,
    height: 1080,
  },
  format: 'mp4',
  quality: 75,
  frameRate: 30,
};

export const useExportStore = create<ExportState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentStep: 'settings',
        wizardOpen: false,
        settings: null,
        activeExports: new Map(),
        exportHistory: [],

        // Wizard actions
        openWizard: () => {
          set({
            wizardOpen: true,
            currentStep: 'settings',
            settings: defaultSettings,
          });
        },

        closeWizard: () => {
          set({ wizardOpen: false });
        },

        setCurrentStep: (step) => {
          set({ currentStep: step });
        },

        setSettings: (settings) => {
          set({ settings });
        },

        resetWizard: () => {
          set({
            currentStep: 'settings',
            settings: defaultSettings,
          });
        },

        // Export management
        addActiveExport: (exportJob) => {
          const activeExports = new Map(get().activeExports);
          activeExports.set(exportJob.id, {
            ...exportJob,
            progressDetails: {
              stage: 'downloading',
              progress: 0,
            },
          });
          set({ activeExports });
        },

        updateExportProgress: (exportId, progress) => {
          const activeExports = new Map(get().activeExports);
          const exportJob = activeExports.get(exportId);
          if (exportJob) {
            activeExports.set(exportId, {
              ...exportJob,
              progressDetails: progress,
              progress: progress.progress,
            });
            set({ activeExports });
          }
        },

        completeExport: (exportId, exportJob) => {
          const activeExports = new Map(get().activeExports);
          activeExports.delete(exportId);
          
          // Add to history
          get().addToHistory(exportJob);
          
          set({ activeExports });
        },

        failExport: (exportId, error) => {
          const activeExports = new Map(get().activeExports);
          const exportJob = activeExports.get(exportId);
          if (exportJob) {
            const failedJob: ExportJob = {
              ...exportJob,
              status: 'failed',
              error,
            };
            activeExports.delete(exportId);
            get().addToHistory(failedJob);
            set({ activeExports });
          }
        },

        cancelExport: (exportId) => {
          const activeExports = new Map(get().activeExports);
          activeExports.delete(exportId);
          set({ activeExports });
        },

        removeActiveExport: (exportId) => {
          const activeExports = new Map(get().activeExports);
          activeExports.delete(exportId);
          set({ activeExports });
        },

        // History management
        addToHistory: (exportJob) => {
          const history = [exportJob, ...get().exportHistory];
          // Keep only last 50 exports in history
          const limitedHistory = history.slice(0, 50);
          set({ exportHistory: limitedHistory });
        },

        removeFromHistory: (exportId) => {
          const history = get().exportHistory.filter((job) => job.id !== exportId);
          set({ exportHistory: history });
        },

        clearHistory: () => {
          set({ exportHistory: [] });
        },

        // Utility
        getActiveExport: (exportId) => {
          return get().activeExports.get(exportId);
        },

        hasActiveExports: () => {
          return get().activeExports.size > 0;
        },
      }),
      {
        name: 'export-storage',
        // Only persist history, not active exports or wizard state
        partialize: (state) => ({
          exportHistory: state.exportHistory,
        }),
        // Custom serializer for Map
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            return JSON.parse(str);
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'ExportStore' }
  )
);
