import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '../services/api/media';
import { queryKeys } from '../lib/query-client';
import type {
  MediaAsset,
  UploadMediaInput,
  MediaUploadProgress,
  PaginationParams,
} from '../types/api';
import { useState } from 'react';

/**
 * Hook to get all media assets for a project
 */
export const useMediaLibrary = (
  projectId: string | undefined,
  params?: PaginationParams & { type?: 'video' | 'audio' | 'image' },
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.media.list(projectId!, params as Record<string, unknown>),
    queryFn: () => mediaApi.getAll(projectId!, params),
    enabled: enabled && !!projectId,
  });
};

/**
 * Hook to get a single media asset
 */
export const useMediaAsset = (
  projectId: string | undefined,
  mediaId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.media.detail(projectId!, mediaId!),
    queryFn: () => mediaApi.getById(projectId!, mediaId!),
    enabled: enabled && !!projectId && !!mediaId,
  });
};

/**
 * Hook to get media processing status
 */
export const useMediaStatus = (
  projectId: string | undefined,
  mediaId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.media.status(projectId!, mediaId!),
    queryFn: () => mediaApi.getProcessingStatus(projectId!, mediaId!),
    enabled: enabled && !!projectId && !!mediaId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if still processing
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'pending' ? 2000 : false;
    },
  });
};

/**
 * Hook to upload media with progress tracking
 */
export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<MediaUploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: (input: UploadMediaInput) =>
      mediaApi.upload(input, (progress) => setUploadProgress(progress)),
    onMutate: () => {
      setUploadProgress(null);
    },
    onSuccess: (newMedia, variables) => {
      // Add to cache
      queryClient.setQueryData(
        queryKeys.media.detail(variables.projectId, newMedia.id),
        newMedia
      );

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.lists(),
      });

      // Reset progress
      setUploadProgress(null);
    },
    onError: () => {
      setUploadProgress(null);
    },
  });

  return {
    ...mutation,
    uploadProgress,
  };
};

/**
 * Hook to update media metadata
 */
export const useUpdateMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      mediaId,
      input,
    }: {
      projectId: string;
      mediaId: string;
      input: { name?: string };
    }) => mediaApi.update(projectId, mediaId, input),
    onMutate: async ({ projectId, mediaId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.media.detail(projectId, mediaId),
      });

      // Snapshot previous value
      const previousMedia = queryClient.getQueryData<MediaAsset>(
        queryKeys.media.detail(projectId, mediaId)
      );

      // Optimistically update
      if (previousMedia) {
        queryClient.setQueryData(queryKeys.media.detail(projectId, mediaId), {
          ...previousMedia,
          ...input,
        });
      }

      return { previousMedia };
    },
    onError: (_error, { projectId, mediaId }, context) => {
      // Rollback on error
      if (context?.previousMedia) {
        queryClient.setQueryData(
          queryKeys.media.detail(projectId, mediaId),
          context.previousMedia
        );
      }
    },
    onSettled: (_data, _error, { projectId, mediaId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.detail(projectId, mediaId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.lists(),
      });
    },
  });
};

/**
 * Hook to delete media
 */
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, mediaId }: { projectId: string; mediaId: string }) =>
      mediaApi.delete(projectId, mediaId),
    onSuccess: (_data, { projectId, mediaId }) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.media.detail(projectId, mediaId),
      });

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.lists(),
      });
    },
  });
};

/**
 * Hook to generate thumbnail
 */
export const useGenerateThumbnail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      mediaId,
      timestamp,
    }: {
      projectId: string;
      mediaId: string;
      timestamp: number;
    }) => mediaApi.generateThumbnail(projectId, mediaId, timestamp),
    onSuccess: (_data, { projectId, mediaId }) => {
      // Refetch media to get updated thumbnail
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.detail(projectId, mediaId),
      });
    },
  });
};
