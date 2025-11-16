import { apiClient } from '../../lib/api-client';
import type {
  MediaAsset,
  UploadMediaInput,
  MediaUploadProgress,
  PaginatedResponse,
  PaginationParams,
} from '../../types/api';

/**
 * Media API Service
 */

export const mediaApi = {
  /**
   * Get all media assets for a project
   */
  getAll: async (
    projectId: string,
    params?: PaginationParams & { type?: 'video' | 'audio' | 'image' }
  ): Promise<PaginatedResponse<MediaAsset>> => {
    const response = await apiClient.get<PaginatedResponse<MediaAsset>>(
      `/api/v1/projects/${projectId}/media`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a single media asset by ID
   */
  getById: async (projectId: string, mediaId: string): Promise<MediaAsset> => {
    const response = await apiClient.get<MediaAsset>(
      `/api/v1/projects/${projectId}/media/${mediaId}`
    );
    return response.data;
  },

  /**
   * Upload media file with progress tracking
   */
  upload: async (
    input: UploadMediaInput,
    onProgress?: (progress: MediaUploadProgress) => void
  ): Promise<MediaAsset> => {
    const formData = new FormData();
    formData.append('file', input.file);
    if (input.name) {
      formData.append('name', input.name);
    }

    const response = await apiClient.post<MediaAsset>(
      `/api/v1/projects/${input.projectId}/media`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress: MediaUploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
            };
            onProgress(progress);
          }
        },
      }
    );
    return response.data;
  },

  /**
   * Update media metadata
   */
  update: async (
    projectId: string,
    mediaId: string,
    input: { name?: string }
  ): Promise<MediaAsset> => {
    const response = await apiClient.patch<MediaAsset>(
      `/api/v1/projects/${projectId}/media/${mediaId}`,
      input
    );
    return response.data;
  },

  /**
   * Delete a media asset
   */
  delete: async (projectId: string, mediaId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${projectId}/media/${mediaId}`);
  },

  /**
   * Generate thumbnail for media
   */
  generateThumbnail: async (
    projectId: string,
    mediaId: string,
    timestamp: number
  ): Promise<{ thumbnailUrl: string }> => {
    const response = await apiClient.post(
      `/api/v1/projects/${projectId}/media/${mediaId}/thumbnail`,
      { timestamp }
    );
    return response.data;
  },

  /**
   * Get media processing status
   */
  getProcessingStatus: async (
    projectId: string,
    mediaId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }> => {
    const response = await apiClient.get(
      `/api/v1/projects/${projectId}/media/${mediaId}/status`
    );
    return response.data;
  },
};

export default mediaApi;
