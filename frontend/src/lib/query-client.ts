import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

/**
 * Default options for React Query
 */
const defaultOptions: DefaultOptions = {
  queries: {
    // Retry failed requests
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Stale time: how long until data is considered stale
    staleTime: 5 * 60 * 1000, // 5 minutes

    // Cache time: how long inactive data stays in cache
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime in v4)

    // Refetch settings
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,

    // Prevent refetching on every render
    refetchInterval: false,
  },
  mutations: {
    // Retry failed mutations
    retry: 1,
    retryDelay: 1000,
  },
};

/**
 * Create and export the QueryClient instance
 */
export const queryClient = new QueryClient({
  defaultOptions,
});

/**
 * Query keys factory for type-safe query keys
 */
export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.projects.lists(), params] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    stats: (id: string) => [...queryKeys.projects.detail(id), 'stats'] as const,
  },

  // Media
  media: {
    all: ['media'] as const,
    lists: () => [...queryKeys.media.all, 'list'] as const,
    list: (projectId: string, params?: Record<string, unknown>) =>
      [...queryKeys.media.lists(), projectId, params] as const,
    details: () => [...queryKeys.media.all, 'detail'] as const,
    detail: (projectId: string, mediaId: string) =>
      [...queryKeys.media.details(), projectId, mediaId] as const,
    status: (projectId: string, mediaId: string) =>
      [...queryKeys.media.detail(projectId, mediaId), 'status'] as const,
  },

  // Compositions
  compositions: {
    all: ['compositions'] as const,
    lists: () => [...queryKeys.compositions.all, 'list'] as const,
    list: (projectId: string) => [...queryKeys.compositions.lists(), projectId] as const,
    details: () => [...queryKeys.compositions.all, 'detail'] as const,
    detail: (projectId: string, compositionId: string) =>
      [...queryKeys.compositions.details(), projectId, compositionId] as const,
    history: (projectId: string, compositionId: string) =>
      [...queryKeys.compositions.detail(projectId, compositionId), 'history'] as const,
  },

  // Exports
  exports: {
    all: ['exports'] as const,
    lists: () => [...queryKeys.exports.all, 'list'] as const,
    list: (projectId: string) => [...queryKeys.exports.lists(), projectId] as const,
    details: () => [...queryKeys.exports.all, 'detail'] as const,
    detail: (projectId: string, exportId: string) =>
      [...queryKeys.exports.details(), projectId, exportId] as const,
    progress: (projectId: string, exportId: string) =>
      [...queryKeys.exports.detail(projectId, exportId), 'progress'] as const,
    presets: ['export-presets'] as const,
  },
} as const;

export default queryClient;
