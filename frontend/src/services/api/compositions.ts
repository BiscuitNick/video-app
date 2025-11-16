import { apiClient } from '../../lib/api-client';
import type { Composition, UpdateCompositionInput } from '../../types/api';

/**
 * Compositions API Service
 */

export const compositionsApi = {
  /**
   * Get all compositions for a project
   */
  getAll: async (projectId: string): Promise<Composition[]> => {
    const response = await apiClient.get<Composition[]>(
      `/api/v1/projects/${projectId}/compositions`
    );
    return response.data;
  },

  /**
   * Get a single composition by ID
   */
  getById: async (projectId: string, compositionId: string): Promise<Composition> => {
    const response = await apiClient.get<Composition>(
      `/api/v1/projects/${projectId}/compositions/${compositionId}`
    );
    return response.data;
  },

  /**
   * Create a new composition
   */
  create: async (projectId: string, name: string): Promise<Composition> => {
    const response = await apiClient.post<Composition>(
      `/api/v1/projects/${projectId}/compositions`,
      { name }
    );
    return response.data;
  },

  /**
   * Update a composition
   */
  update: async (
    projectId: string,
    compositionId: string,
    input: UpdateCompositionInput
  ): Promise<Composition> => {
    const response = await apiClient.patch<Composition>(
      `/api/v1/projects/${projectId}/compositions/${compositionId}`,
      input
    );
    return response.data;
  },

  /**
   * Delete a composition
   */
  delete: async (projectId: string, compositionId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${projectId}/compositions/${compositionId}`);
  },

  /**
   * Duplicate a composition
   */
  duplicate: async (projectId: string, compositionId: string): Promise<Composition> => {
    const response = await apiClient.post<Composition>(
      `/api/v1/projects/${projectId}/compositions/${compositionId}/duplicate`
    );
    return response.data;
  },

  /**
   * Save composition (optimistic update)
   * This endpoint is designed for frequent auto-saves
   */
  save: async (
    projectId: string,
    compositionId: string,
    input: UpdateCompositionInput
  ): Promise<Composition> => {
    const response = await apiClient.put<Composition>(
      `/api/v1/projects/${projectId}/compositions/${compositionId}`,
      input
    );
    return response.data;
  },

  /**
   * Get composition history/versions
   */
  getHistory: async (
    projectId: string,
    compositionId: string
  ): Promise<
    Array<{
      id: string;
      version: number;
      createdAt: string;
      description?: string;
    }>
  > => {
    const response = await apiClient.get(
      `/api/v1/projects/${projectId}/compositions/${compositionId}/history`
    );
    return response.data;
  },

  /**
   * Restore composition from a specific version
   */
  restoreVersion: async (
    projectId: string,
    compositionId: string,
    versionId: string
  ): Promise<Composition> => {
    const response = await apiClient.post<Composition>(
      `/api/v1/projects/${projectId}/compositions/${compositionId}/restore/${versionId}`
    );
    return response.data;
  },
};

export default compositionsApi;
