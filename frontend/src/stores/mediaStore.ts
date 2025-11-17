import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools } from 'zustand/middleware'
import { createIndexedDBStorage, STORE_NAMES } from '../lib/indexedDBStorage'
import type { MediaStore, MediaAsset, MediaFolder, UploadItem } from '../types/stores'

// Initial state
const initialState = {
  assets: new Map<string, MediaAsset>(),
  folders: [] as MediaFolder[],
  uploadQueue: [] as UploadItem[],
  thumbnailCache: new Map<string, string>(),
  selectedAssetIds: [] as string[],
  currentFolderId: undefined as string | undefined,
}

// Create the vanilla store with devtools, persist, and immer middleware
export const createMediaStore = () => {
  return createStore<MediaStore>()(
    devtools(
      persist(
        immer((set, get) => ({
      ...initialState,

      // Asset operations
      addAsset: (asset) =>
        set((state) => {
          state.assets.set(asset.id, asset)
        }),

      removeAsset: (assetId) =>
        set((state) => {
          state.assets.delete(assetId)
          // Remove from selection
          state.selectedAssetIds = state.selectedAssetIds.filter((id) => id !== assetId)
          // Clean up thumbnail cache
          const thumbnailUrl = state.thumbnailCache.get(assetId)
          if (thumbnailUrl) {
            URL.revokeObjectURL(thumbnailUrl)
            state.thumbnailCache.delete(assetId)
          }
        }),

      updateAsset: (assetId, updates) =>
        set((state) => {
          const asset = state.assets.get(assetId)
          if (asset) {
            state.assets.set(assetId, { ...asset, ...updates })
          }
        }),

      moveAsset: (assetId, folderId) =>
        set((state) => {
          const asset = state.assets.get(assetId)
          if (asset) {
            state.assets.set(assetId, { ...asset, folderId })
          }
        }),

      selectAsset: (assetId, addToSelection = false) =>
        set((state) => {
          if (addToSelection) {
            if (!state.selectedAssetIds.includes(assetId)) {
              state.selectedAssetIds.push(assetId)
            }
          } else {
            state.selectedAssetIds = [assetId]
          }
        }),

      clearAssetSelection: () =>
        set((state) => {
          state.selectedAssetIds = []
        }),

      // Folder operations
      createFolder: (folder) =>
        set((state) => {
          const newFolder: MediaFolder = {
            ...folder,
            id: `folder-${Date.now()}`,
            createdAt: new Date(),
          }
          state.folders.push(newFolder)
        }),

      removeFolder: (folderId) =>
        set((state) => {
          // Move all assets in this folder to root
          state.assets.forEach((asset) => {
            if (asset.folderId === folderId) {
              state.assets.set(asset.id, { ...asset, folderId: undefined })
            }
          })

          // Remove child folders recursively
          const childFolders = state.folders.filter((f) => f.parentId === folderId)
          childFolders.forEach((child) => {
            get().removeFolder(child.id)
          })

          // Remove the folder
          state.folders = state.folders.filter((f) => f.id !== folderId)

          // Clear current folder if it was deleted
          if (state.currentFolderId === folderId) {
            state.currentFolderId = undefined
          }
        }),

      setCurrentFolder: (folderId) =>
        set((state) => {
          state.currentFolderId = folderId
        }),

      // Upload operations
      queueUpload: (file) => {
        const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`
        set((state) => {
          const uploadItem: UploadItem = {
            id: uploadId,
            file,
            progress: 0,
            status: 'queued',
            retryCount: 0,
          }
          state.uploadQueue.push(uploadItem)
        })
        return uploadId
      },

      updateUploadProgress: (uploadId, progress) =>
        set((state) => {
          const upload = state.uploadQueue.find((u) => u.id === uploadId)
          if (upload) {
            upload.progress = Math.max(0, Math.min(100, progress))
          }
        }),

      setUploadStatus: (uploadId, status, error) =>
        set((state) => {
          const upload = state.uploadQueue.find((u) => u.id === uploadId)
          if (upload) {
            upload.status = status
            if (error) {
              upload.error = error
            }
          }
        }),

      updateUpload: (uploadId, updates) =>
        set((state) => {
          const upload = state.uploadQueue.find((u) => u.id === uploadId)
          if (upload) {
            Object.assign(upload, updates)
          }
        }),

      cancelUpload: (uploadId) =>
        set((state) => {
          const upload = state.uploadQueue.find((u) => u.id === uploadId)
          if (upload && upload.status === 'uploading') {
            upload.status = 'cancelled'
          }
        }),

      removeFromQueue: (uploadId) =>
        set((state) => {
          state.uploadQueue = state.uploadQueue.filter((u) => u.id !== uploadId)
        }),

      clearCompletedUploads: () =>
        set((state) => {
          state.uploadQueue = state.uploadQueue.filter(
            (u) => u.status !== 'completed' && u.status !== 'cancelled' && u.status !== 'failed'
          )
        }),

      // Thumbnail operations
      cacheThumbnail: (assetId, blobUrl) =>
        set((state) => {
          // Revoke old blob URL if it exists
          const oldUrl = state.thumbnailCache.get(assetId)
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl)
          }
          state.thumbnailCache.set(assetId, blobUrl)
        }),

      // Search and filter
      searchAssets: (query) => {
        const { assets, currentFolderId } = get()
        const lowerQuery = query.toLowerCase()
        const results: MediaAsset[] = []

        assets.forEach((asset) => {
          // Filter by current folder if set
          if (currentFolderId && asset.folderId !== currentFolderId) {
            return
          }

          // Search in name and metadata
          if (
            asset.name.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(asset.metadata).toLowerCase().includes(lowerQuery)
          ) {
            results.push(asset)
          }
        })

        return results
      },

      // Utility
      reset: () => {
        const { thumbnailCache } = get()
        // Clean up all blob URLs
        thumbnailCache.forEach((url) => URL.revokeObjectURL(url))
        set(initialState)
      },
        })),
        {
          name: 'media-store',
          storage: createIndexedDBStorage(STORE_NAMES.MEDIA),
          // Only persist data, not functions
          partialize: (state) => ({
            assets: state.assets,
            folders: state.folders,
            thumbnailCache: state.thumbnailCache,
            selectedAssetIds: state.selectedAssetIds,
            currentFolderId: state.currentFolderId,
            // Don't persist uploadQueue
          }),
          // Custom serialization for Maps and Dates
          serialize: (state) => {
            return JSON.stringify({
              state: {
                assets: Array.from(state.state.assets.entries()),
                folders: state.state.folders.map((folder) => ({
                  ...folder,
                  createdAt: folder.createdAt.toISOString(),
                })),
                thumbnailCache: Array.from(state.state.thumbnailCache.entries()),
                selectedAssetIds: state.state.selectedAssetIds,
                currentFolderId: state.state.currentFolderId,
              },
              version: state.version,
            })
          },
          deserialize: (str) => {
            const parsed = JSON.parse(str)
            return {
              state: {
                ...initialState,
                assets: new Map(
                  parsed.state.assets.map(([id, asset]: [string, MediaAsset & { createdAt: string }]) => [
                    id,
                    {
                      ...asset,
                      createdAt: new Date(asset.createdAt),
                    },
                  ])
                ),
                folders: parsed.state.folders.map((folder: MediaFolder & { createdAt: string }) => ({
                  ...folder,
                  createdAt: new Date(folder.createdAt),
                })),
                thumbnailCache: new Map(parsed.state.thumbnailCache),
                selectedAssetIds: parsed.state.selectedAssetIds,
                currentFolderId: parsed.state.currentFolderId,
              },
              version: parsed.version,
            }
          },
        }
      ),
      { name: 'MediaStore' }
    )
  )
}

// Export type for the store instance
export type MediaStoreInstance = ReturnType<typeof createMediaStore>
