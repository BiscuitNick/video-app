import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportsApi } from '../services/api/exports';
import { queryKeys } from '../lib/query-client';
import type { ExportJob, CreateExportInput } from '../types/api';

/**
 * Hook to get all export jobs for a project
 */
export const useExports = (projectId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.exports.list(projectId!),
    queryFn: () => exportsApi.getAll(projectId!),
    enabled: enabled && !!projectId,
  });
};

/**
 * Hook to get a single export job
 */
export const useExport = (
  projectId: string | undefined,
  exportId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.exports.detail(projectId!, exportId!),
    queryFn: () => exportsApi.getById(projectId!, exportId!),
    enabled: enabled && !!projectId && !!exportId,
  });
};

/**
 * Hook to get export progress with polling
 */
export const useExportProgress = (
  projectId: string | undefined,
  exportId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: queryKeys.exports.progress(projectId!, exportId!),
    queryFn: () => exportsApi.getProgress(projectId!, exportId!),
    enabled: enabled && !!projectId && !!exportId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if still processing
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'pending' ? 2000 : false;
    },
  });
};

/**
 * Hook to get export presets
 */
export const useExportPresets = () => {
  return useQuery({
    queryKey: queryKeys.exports.presets,
    queryFn: () => exportsApi.getPresets(),
    staleTime: Infinity, // Presets rarely change
  });
};

/**
 * Hook to create an export job
 */
export const useCreateExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExportInput) => exportsApi.create(input),
    onSuccess: (newExport, variables) => {
      // Add to cache
      queryClient.setQueryData(
        queryKeys.exports.detail(variables.projectId, newExport.id),
        newExport
      );

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.list(variables.projectId),
      });
    },
  });
};

/**
 * Hook to cancel an export job
 */
export const useCancelExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, exportId }: { projectId: string; exportId: string }) =>
      exportsApi.cancel(projectId, exportId),
    onMutate: async ({ projectId, exportId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.exports.detail(projectId, exportId),
      });

      // Snapshot previous value
      const previousExport = queryClient.getQueryData<ExportJob>(
        queryKeys.exports.detail(projectId, exportId)
      );

      // Optimistically update status
      if (previousExport) {
        queryClient.setQueryData(queryKeys.exports.detail(projectId, exportId), {
          ...previousExport,
          status: 'failed',
          error: 'Cancelled by user',
        });
      }

      return { previousExport };
    },
    onError: (_error, { projectId, exportId }, context) => {
      // Rollback on error
      if (context?.previousExport) {
        queryClient.setQueryData(
          queryKeys.exports.detail(projectId, exportId),
          context.previousExport
        );
      }
    },
    onSettled: (_data, _error, { projectId, exportId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.detail(projectId, exportId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.list(projectId),
      });
    },
  });
};

/**
 * Hook to delete an export job
 */
export const useDeleteExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, exportId }: { projectId: string; exportId: string }) =>
      exportsApi.delete(projectId, exportId),
    onSuccess: (_data, { projectId, exportId }) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.exports.detail(projectId, exportId),
      });

      // Invalidate lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.list(projectId),
      });
    },
  });
};

/**
 * Hook to retry a failed export
 */
export const useRetryExport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, exportId }: { projectId: string; exportId: string }) =>
      exportsApi.retry(projectId, exportId),
    onSuccess: (data, { projectId, exportId }) => {
      // Update cache
      queryClient.setQueryData(queryKeys.exports.detail(projectId, exportId), data);

      // Invalidate lists and progress
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.list(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.exports.progress(projectId, exportId),
      });
    },
  });
};

/**
 * Hook to download an export
 */
export const useDownloadExport = () => {
  return useMutation({
    mutationFn: ({ projectId, exportId }: { projectId: string; exportId: string }) =>
      exportsApi.download(projectId, exportId),
    onSuccess: (blob, { exportId }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-${exportId}.mp4`; // You might want to get the actual filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};
