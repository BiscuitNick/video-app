import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PropertyPreset, ClipProperties } from '@/types';

interface PresetState {
  presets: PropertyPreset[];

  // Preset operations
  addPreset: (name: string, properties: Partial<ClipProperties>) => void;
  deletePreset: (id: string) => void;
  updatePreset: (id: string, updates: Partial<PropertyPreset>) => void;
  getPresetById: (id: string) => PropertyPreset | undefined;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],

      addPreset: (name, properties) => {
        const preset: PropertyPreset = {
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          properties,
          createdAt: new Date(),
        };
        set((state) => ({
          presets: [...state.presets, preset],
        }));
      },

      deletePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((preset) => preset.id !== id),
        })),

      updatePreset: (id, updates) =>
        set((state) => ({
          presets: state.presets.map((preset) =>
            preset.id === id ? { ...preset, ...updates } : preset
          ),
        })),

      getPresetById: (id) => {
        return get().presets.find((preset) => preset.id === id);
      },
    }),
    {
      name: 'chronos-preset-store',
    }
  )
);
