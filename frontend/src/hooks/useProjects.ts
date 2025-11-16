import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../services/api/projects';
import { queryKeys } from '../lib/query-client';
import type {
  ProjectDetail,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectListParams,
  ShareProjectInput,
  DuplicateProjectInput,
  BulkOperationInput,
} from '../types/api';

/**
 * Hook to get all projects with filtering and sorting
 */
export const useProjects = (params?: ProjectListParams) => {
  return useQuery({
    queryKey: queryKeys.projects.list(params as Record<string, unknown>),
    queryFn: () => projectsApi.getAll(params),
  });
};

/**
 * Hook to get a single project by ID with shares
 */
export const useProject = (id: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.projects.detail(id!),
    queryFn: () => projectsApi.getById(id!),
    enabled: enabled && !!id,
  });
};

/**
 * Hook to get project version history
 */
export const useProjectVersions = (id: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ['projects', id, 'versions'],
    queryFn: () => projectsApi.getVersions(id!),
    enabled: enabled && !!id,
  });
};

/**
 * Hook to get a specific version
 */
export const useProjectVersion = (id: string | undefined, versionNumber: number | undefined, enabled = true) => {
  return useQuery({
    queryKey: ['projects', id, 'versions', versionNumber],
    queryFn: () => projectsApi.getVersion(id!, versionNumber!),
    enabled: enabled && !!id && versionNumber !== undefined,
  });
};

/**
 * Hook to create a project
 */
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      queryClient.setQueryData(queryKeys.projects.detail(newProject.id), newProject);
    },
  });
};

/**
 * Hook to update a project with optimistic locking
 */
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      projectsApi.update(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(id) });
      const previousProject = queryClient.getQueryData<ProjectDetail>(queryKeys.projects.detail(id));

      if (previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(id), {
          ...previousProject,
          ...input,
        });
      }

      return { previousProject };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(id), context.previousProject);
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
};

/**
 * Hook to delete a project
 */
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, hardDelete = false }: { id: string; hardDelete?: boolean }) =>
      projectsApi.delete(id, hardDelete),
    onSuccess: (_data, { id }) => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
};

/**
 * Hook to duplicate a project
 */
export const useDuplicateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DuplicateProjectInput }) =>
      projectsApi.duplicate(id, input),
    onSuccess: (newProject) => {
      queryClient.setQueryData(queryKeys.projects.detail(newProject.id), newProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
};

/**
 * Hook to share a project
 */
export const useShareProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ShareProjectInput }) =>
      projectsApi.share(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
    },
  });
};

/**
 * Hook to remove a share
 */
export const useRemoveShare = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, shareId }: { projectId: string; shareId: string }) =>
      projectsApi.removeShare(projectId, shareId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

/**
 * Hook for bulk operations
 */
export const useBulkOperation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkOperationInput) => projectsApi.bulkOperation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
};
