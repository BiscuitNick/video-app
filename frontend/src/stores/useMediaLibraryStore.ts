import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MediaAsset } from '@/types';

interface MediaLibraryState {
  // Media assets
  assets: MediaAsset[];
  selectedAssetIds: string[];

  // CRUD operations
  addAsset: (asset: MediaAsset) => void;
  addAssets: (assets: MediaAsset[]) => void;
  updateAsset: (id: string, updates: Partial<MediaAsset>) => void;
  deleteAsset: (id: string) => void;
  deleteAssets: (ids: string[]) => void;
  clearAssets: () => void;

  // Selection
  selectAsset: (id: string) => void;
  selectAssets: (ids: string[]) => void;
  deselectAsset: (id: string) => void;
  clearSelection: () => void;

  // Queries
  getAssetById: (id: string) => MediaAsset | undefined;
  getAssetsByType: (type: MediaAsset['type']) => MediaAsset[];

  // Upload state
  uploading: boolean;
  uploadProgress: number;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}

export const useMediaLibraryStore = create<MediaLibraryState>()(
  devtools(
    (set, get) => ({
      // State
      assets: [],
      selectedAssetIds: [],
      uploading: false,
      uploadProgress: 0,

      // CRUD operations
      addAsset: (asset) =>
        set((state) => ({
          assets: [...state.assets, asset],
        })),

      addAssets: (assets) =>
        set((state) => ({
          assets: [...state.assets, ...assets],
        })),

      updateAsset: (id, updates) =>
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, ...updates } : asset
          ),
        })),

      deleteAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((asset) => asset.id !== id),
          selectedAssetIds: state.selectedAssetIds.filter(
            (assetId) => assetId !== id
          ),
        })),

      deleteAssets: (ids) =>
        set((state) => ({
          assets: state.assets.filter((asset) => !ids.includes(asset.id)),
          selectedAssetIds: state.selectedAssetIds.filter(
            (assetId) => !ids.includes(assetId)
          ),
        })),

      clearAssets: () =>
        set({
          assets: [],
          selectedAssetIds: [],
        }),

      // Selection
      selectAsset: (id) =>
        set((state) => ({
          selectedAssetIds: [...state.selectedAssetIds, id],
        })),

      selectAssets: (ids) =>
        set({
          selectedAssetIds: ids,
        }),

      deselectAsset: (id) =>
        set((state) => ({
          selectedAssetIds: state.selectedAssetIds.filter(
            (assetId) => assetId !== id
          ),
        })),

      clearSelection: () =>
        set({
          selectedAssetIds: [],
        }),

      // Queries
      getAssetById: (id) => {
        return get().assets.find((asset) => asset.id === id);
      },

      getAssetsByType: (type) => {
        return get().assets.filter((asset) => asset.type === type);
      },

      // Upload state
      setUploading: (uploading) => set({ uploading }),
      setUploadProgress: (progress) => set({ uploadProgress: progress }),
    }),
    { name: 'MediaLibraryStore' }
  )
);
