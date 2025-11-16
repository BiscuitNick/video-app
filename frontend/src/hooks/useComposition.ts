import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { compositionsApi } from '../services/api/compositions';
import { queryKeys } from '../lib/query-client';
import type { Composition, UpdateCompositionInput } from '../types/api';

/**
 * Hook to get all compositions for a project
 */
export const useCompositions = (projectId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.compositions.list(projectId!),
    queryFn: () => compositionsApi.getAll(projectId!),
    enabled: enabled && !!projectId,
  });
};

/**
 * Hook to get a single composition
 */
export const useComposition = (
  projectId: string | undefined,
  compositionId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.compositions.detail(projectId!, compositionId!),
    queryFn: () => compositionsApi.getById(projectId!, compositionId!),
    enabled: enabled && !!projectId && !!compositionId,
  });
};

/**
 * Hook to get composition history
 */
export const useCompositionHistory = (
  projectId: string | undefined,
  compositionId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.compositions.history(projectId!, compositionId!),
    queryFn: () => compositionsApi.getHistory(projectId!, compositionId!),
    enabled: enabled && !!projectId && !!compositionId,
  });
};

/**
 * Hook to create a composition
 */
export const useCreateComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      compositionsApi.create(projectId, name),
    onSuccess: (newComposition, { projectId }) => {
      // Add to cache
      queryClient.setQueryData(
        queryKeys.compositions.detail(projectId, newComposition.id),
        newComposition
      );

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.compositions.list(projectId),
      });
    },
  });
};

/**
 * Hook to update a composition
 */
export const useUpdateComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      compositionId,
      input,
    }: {
      projectId: string;
      compositionId: string;
      input: UpdateCompositionInput;
    }) => compositionsApi.update(projectId, compositionId, input),
    onMutate: async ({ projectId, compositionId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.compositions.detail(projectId, compositionId),
      });

      // Snapshot previous value
      const previousComposition = queryClient.getQueryData<Composition>(
        queryKeys.compositions.detail(projectId, compositionId)
      );

      // Optimistically update
      if (previousComposition) {
        queryClient.setQueryData(
          queryKeys.compositions.detail(projectId, compositionId),
          {
            ...previousComposition,
            ...input,
          }
        );
      }

      return { previousComposition };
    },
    onError: (_error, { projectId, compositionId }, context) => {
      // Rollback on error
      if (context?.previousComposition) {
        queryClient.setQueryData(
          queryKeys.compositions.detail(projectId, compositionId),
          context.previousComposition
        );
      }
    },
    onSettled: (_data, _error, { projectId, compositionId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({
        queryKey: queryKeys.compositions.detail(projectId, compositionId),
      });
    },
  });
};

/**
 * Hook to save composition (for auto-save)
 * Uses optimistic updates for immediate UI feedback
 */
export const useSaveComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      compositionId,
      input,
    }: {
      projectId: string;
      compositionId: string;
      input: UpdateCompositionInput;
    }) => compositionsApi.save(projectId, compositionId, input),
    onMutate: async ({ projectId, compositionId, input }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.compositions.detail(projectId, compositionId),
      });

      // Snapshot previous value
      const previousComposition = queryClient.getQueryData<Composition>(
        queryKeys.compositions.detail(projectId, compositionId)
      );

      // Optimistically update
      if (previousComposition) {
        queryClient.setQueryData(
          queryKeys.compositions.detail(projectId, compositionId),
          {
            ...previousComposition,
            ...input,
            updatedAt: new Date().toISOString(),
          }
        );
      }

      return { previousComposition };
    },
    onError: (_error, { projectId, compositionId }, context) => {
      // Rollback on error
      if (context?.previousComposition) {
        queryClient.setQueryData(
          queryKeys.compositions.detail(projectId, compositionId),
          context.previousComposition
        );
      }
    },
    // Don't refetch on success to avoid overwriting optimistic updates
    onSuccess: (data, { projectId, compositionId }) => {
      // Just update the cache with the server response
      queryClient.setQueryData(
        queryKeys.compositions.detail(projectId, compositionId),
        data
      );
    },
  });
};

/**
 * Hook to delete a composition
 */
export const useDeleteComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, compositionId }: { projectId: string; compositionId: string }) =>
      compositionsApi.delete(projectId, compositionId),
    onSuccess: (_data, { projectId, compositionId }) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.compositions.detail(projectId, compositionId),
      });

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.compositions.list(projectId),
      });
    },
  });
};

/**
 * Hook to duplicate a composition
 */
export const useDuplicateComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, compositionId }: { projectId: string; compositionId: string }) =>
      compositionsApi.duplicate(projectId, compositionId),
    onSuccess: (newComposition, { projectId }) => {
      // Add to cache
      queryClient.setQueryData(
        queryKeys.compositions.detail(projectId, newComposition.id),
        newComposition
      );

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.compositions.list(projectId),
      });
    },
  });
};

/**
 * Hook to restore composition from version
 */
export const useRestoreComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      compositionId,
      versionId,
    }: {
      projectId: string;
      compositionId: string;
      versionId: string;
    }) => compositionsApi.restoreVersion(projectId, compositionId, versionId),
    onSuccess: (data, { projectId, compositionId }) => {
      // Update cache
      queryClient.setQueryData(
        queryKeys.compositions.detail(projectId, compositionId),
        data
      );

      // Invalidate history
      queryClient.invalidateQueries({
        queryKey: queryKeys.compositions.history(projectId, compositionId),
      });
    },
  });
};
