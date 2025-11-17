import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import type { MediaStore, MediaAsset, MediaFolder, UploadItem } from '../types/stores'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { getWebSocketService } from '../services/WebSocketService'
import type { WebSocketMessage, JobUpdateMessage } from '../types/websocket'

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
          // Helper function to recursively collect all folder IDs to delete
          const collectFolderIds = (id: string): string[] => {
            const ids = [id]
            const children = state.folders.filter((f) => f.parentId === id)
            children.forEach((child) => {
              ids.push(...collectFolderIds(child.id))
            })
            return ids
          }

          // Get all folder IDs to delete (including children)
          const folderIdsToDelete = collectFolderIds(folderId)

          // Move all assets in these folders to root
          state.assets.forEach((asset) => {
            if (asset.folderId && folderIdsToDelete.includes(asset.folderId)) {
              state.assets.set(asset.id, { ...asset, folderId: undefined })
            }
          })

          // Remove all folders at once
          state.folders = state.folders.filter((f) => !folderIdsToDelete.includes(f.id))

          // Clear current folder if it was deleted
          if (state.currentFolderId && folderIdsToDelete.includes(state.currentFolderId)) {
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

      // Backend API integration
      loadAssets: async (page: number = 1, perPage: number = 50) => {
        try {
          const response = await api.get<{
            items: Array<{
              id: string
              name: string
              file_type: string
              file_size: number
              s3_key: string
              thumbnail_url?: string
              status: string
              metadata?: Record<string, unknown>
              tags?: string[]
              created_at: string
            }>
            total: number
            page: number
            per_page: number
          }>('/media/', {
            params: { page, per_page: perPage },
          })

          set((state) => {
            response.items.forEach((item) => {
              const asset: MediaAsset = {
                id: item.id,
                name: item.name,
                type: item.file_type as 'image' | 'video' | 'audio',
                url: item.s3_key, // TODO: Get presigned URL if needed
                thumbnailUrl: item.thumbnail_url,
                duration: 0, // TODO: Extract from metadata
                size: item.file_size,
                createdAt: new Date(item.created_at),
                metadata: item.metadata || {},
                tags: item.tags || [],
              }
              state.assets.set(asset.id, asset)
            })
          })

          toast.success(`Loaded ${response.items.length} assets`)
        } catch (error) {
          console.error('Failed to load assets:', error)
          toast.error('Failed to load media assets')
          throw error
        }
      },

      uploadAsset: async (file: File, uploadId: string) => {
        try {
          // Step 1: Initiate upload - POST /media/upload
          set((state) => {
            const upload = state.uploadQueue.find((u) => u.id === uploadId)
            if (upload) {
              upload.status = 'uploading'
              upload.progress = 0
            }
          })

          const uploadResponse = await api.post<{
            id: string
            presigned_url: string
            upload_params: {
              method: string
              fields: Record<string, string>
            }
          }>('/media/upload', {
            name: file.name,
            size: file.size,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio',
            checksum: '', // TODO: Calculate checksum if needed
          })

          const assetId = uploadResponse.id

          // Step 2: Upload to S3 using presigned URL
          const formData = new FormData()

          // Add fields from presigned POST
          Object.entries(uploadResponse.upload_params.fields).forEach(([key, value]) => {
            formData.append(key, value)
          })

          // Add file last (required by S3)
          formData.append('file', file)

          // Upload with progress tracking
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100)
                set((state) => {
                  const upload = state.uploadQueue.find((u) => u.id === uploadId)
                  if (upload) {
                    upload.progress = progress
                  }
                })
              }
            })

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response)
              } else {
                reject(new Error(`S3 upload failed: ${xhr.statusText}`))
              }
            })

            xhr.addEventListener('error', () => reject(new Error('S3 upload failed')))
            xhr.addEventListener('abort', () => reject(new Error('S3 upload cancelled')))

            xhr.open(uploadResponse.upload_params.method, uploadResponse.presigned_url)
            xhr.send(formData)
          })

          // Step 3: Confirm upload - PATCH /media/{id}
          await api.patch(`/media/${assetId}`, {
            status: 'ready',
            metadata: {
              // Extract metadata using FFprobe or similar on client if needed
            },
          })

          // Update upload status
          set((state) => {
            const upload = state.uploadQueue.find((u) => u.id === uploadId)
            if (upload) {
              upload.status = 'completed'
              upload.progress = 100
              upload.assetId = assetId
            }

            // Add asset to store
            const asset: MediaAsset = {
              id: assetId,
              name: file.name,
              type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio',
              url: '', // Will be populated when fetching
              size: file.size,
              createdAt: new Date(),
              metadata: {},
              tags: [],
            }
            state.assets.set(assetId, asset)
          })

          toast.success('Upload completed successfully')
          return assetId
        } catch (error) {
          set((state) => {
            const upload = state.uploadQueue.find((u) => u.id === uploadId)
            if (upload) {
              upload.status = 'failed'
              upload.error = error instanceof Error ? error.message : 'Upload failed'
            }
          })
          console.error('Failed to upload asset:', error)
          toast.error('Upload failed')
          throw error
        }
      },

      deleteAsset: async (assetId: string) => {
        try {
          // Call backend API: DELETE /media/{id}
          await api.delete(`/media/${assetId}`)

          // Remove from store
          set((state) => {
            state.assets.delete(assetId)
            state.selectedAssetIds = state.selectedAssetIds.filter((id) => id !== assetId)

            // Clean up thumbnail cache
            const thumbnailUrl = state.thumbnailCache.get(assetId)
            if (thumbnailUrl) {
              URL.revokeObjectURL(thumbnailUrl)
              state.thumbnailCache.delete(assetId)
            }
          })

          toast.success('Asset deleted successfully')
        } catch (error) {
          console.error('Failed to delete asset:', error)
          toast.error('Failed to delete asset')
          throw error
        }
      },

      // WebSocket integration
      initializeWebSocket: () => {
        try {
          const wsService = getWebSocketService()

          const handleJobUpdate = (message: WebSocketMessage) => {
            if (message.event.startsWith('job.')) {
              const jobMessage = message as JobUpdateMessage

              // Handle thumbnail generation and AI generation jobs
              if (jobMessage.jobType === 'thumbnail' || jobMessage.jobType === 'ai_generation') {
                console.log(`[MediaStore] Job update: ${jobMessage.jobId} - ${jobMessage.status}`)

                // Update asset when job completes
                if (jobMessage.status === 'succeeded' && jobMessage.result) {
                  const result = jobMessage.result as { assetId?: string; thumbnailUrl?: string; assetUrl?: string }

                  if (result.assetId) {
                    set((state) => {
                      const asset = state.assets.get(result.assetId!)
                      if (asset) {
                        if (result.thumbnailUrl) {
                          asset.thumbnailUrl = result.thumbnailUrl
                        }
                        if (result.assetUrl) {
                          asset.url = result.assetUrl
                        }
                      }
                    })

                    if (jobMessage.jobType === 'thumbnail') {
                      toast.success('Thumbnail generated')
                    } else {
                      toast.success('AI generation completed')
                    }
                  }
                } else if (jobMessage.status === 'failed') {
                  toast.error(`${jobMessage.jobType} job failed`, {
                    description: jobMessage.error || 'Unknown error',
                  })
                }
              }
            }
          }

          wsService.on('message', handleJobUpdate)
        } catch (error) {
          console.error('Failed to initialize WebSocket for mediaStore:', error)
        }
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
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({
            assets: Array.from(state.assets.entries()),
            folders: state.folders,
            selectedAssetIds: state.selectedAssetIds,
            currentFolderId: state.currentFolderId,
            // Don't persist uploadQueue or thumbnailCache
          }),
          merge: (persistedState, currentState) => {
            // Merge persisted state back into current state
            const persisted = persistedState as any

            // Reconstruct assets Map with proper Date objects
            const assetsMap = new Map(
              (persisted.assets || []).map(([id, asset]: [string, any]) => [
                id,
                {
                  ...asset,
                  createdAt: new Date(asset.createdAt),
                }
              ])
            )

            return {
              ...currentState,
              assets: assetsMap,
              folders: (persisted.folders || []).map((folder: any) => ({
                ...folder,
                createdAt: new Date(folder.createdAt),
              })),
              selectedAssetIds: persisted.selectedAssetIds || [],
              currentFolderId: persisted.currentFolderId,
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
