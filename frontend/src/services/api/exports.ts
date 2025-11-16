import { apiClient } from '../../lib/api-client';
import type { ExportJob, CreateExportInput, ExportProgress } from '../../types/api';

/**
 * Exports API Service
 */

export const exportsApi = {
  /**
   * Get all export jobs for a project
   */
  getAll: async (projectId: string): Promise<ExportJob[]> => {
    const response = await apiClient.get<ExportJob[]>(
      `/api/v1/projects/${projectId}/exports`
    );
    return response.data;
  },

  /**
   * Get a single export job by ID
   */
  getById: async (projectId: string, exportId: string): Promise<ExportJob> => {
    const response = await apiClient.get<ExportJob>(
      `/api/v1/projects/${projectId}/exports/${exportId}`
    );
    return response.data;
  },

  /**
   * Create a new export job
   */
  create: async (input: CreateExportInput): Promise<ExportJob> => {
    const response = await apiClient.post<ExportJob>(
      `/api/v1/projects/${input.projectId}/exports`,
      input
    );
    return response.data;
  },

  /**
   * Cancel an export job
   */
  cancel: async (projectId: string, exportId: string): Promise<void> => {
    await apiClient.post(`/api/v1/projects/${projectId}/exports/${exportId}/cancel`);
  },

  /**
   * Delete an export job
   */
  delete: async (projectId: string, exportId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${projectId}/exports/${exportId}`);
  },

  /**
   * Get export progress
   */
  getProgress: async (projectId: string, exportId: string): Promise<ExportProgress> => {
    const response = await apiClient.get<ExportProgress>(
      `/api/v1/projects/${projectId}/exports/${exportId}/progress`
    );
    return response.data;
  },

  /**
   * Download exported file
   */
  download: async (projectId: string, exportId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/v1/projects/${projectId}/exports/${exportId}/download`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  /**
   * Retry a failed export
   */
  retry: async (projectId: string, exportId: string): Promise<ExportJob> => {
    const response = await apiClient.post<ExportJob>(
      `/api/v1/projects/${projectId}/exports/${exportId}/retry`
    );
    return response.data;
  },

  /**
   * Get export presets/templates
   */
  getPresets: async (): Promise<
    Array<{
      id: string;
      name: string;
      format: string;
      quality: string;
      resolution: { width: number; height: number };
    }>
  > => {
    const response = await apiClient.get('/api/v1/export-presets');
    return response.data;
  },
};

export default exportsApi;
