import { apiClient } from '../../lib/api-client';
import type {
  Project,
  ProjectDetail,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectListResponse,
  ProjectListParams,
  ProjectVersion,
  ProjectVersionDetail,
  ProjectShare,
  ShareProjectInput,
  DuplicateProjectInput,
  BulkOperationInput,
  BulkOperationResult,
} from '../../types/api';

/**
 * Projects API Service with version history and sharing support
 */

export const projectsApi = {
  /**
   * Get all projects with pagination and filtering
   */
  getAll: async (params?: ProjectListParams): Promise<ProjectListResponse> => {
    const response = await apiClient.get<ProjectListResponse>('/api/v1/projects', { params });
    return response.data;
  },

  /**
   * Get detailed project information including shares
   */
  getById: async (id: string): Promise<ProjectDetail> => {
    const response = await apiClient.get<ProjectDetail>(`/api/v1/projects/${id}`);
    return response.data;
  },

  /**
   * Create a new project
   */
  create: async (input: CreateProjectInput): Promise<ProjectDetail> => {
    const response = await apiClient.post<ProjectDetail>('/api/v1/projects', input);
    return response.data;
  },

  /**
   * Update project with optimistic locking
   */
  update: async (id: string, input: UpdateProjectInput): Promise<ProjectDetail> => {
    const response = await apiClient.put<ProjectDetail>(`/api/v1/projects/${id}`, input);
    return response.data;
  },

  /**
   * Delete project (soft delete by default)
   */
  delete: async (id: string, hardDelete = false): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${id}`, { params: { hard_delete: hardDelete } });
  },

  /**
   * Duplicate a project
   */
  duplicate: async (id: string, input: DuplicateProjectInput): Promise<ProjectDetail> => {
    const response = await apiClient.post<ProjectDetail>(
      `/api/v1/projects/${id}/duplicate`,
      input
    );
    return response.data;
  },

  // Version History

  /**
   * Get version history for a project
   */
  getVersions: async (id: string, limit = 50): Promise<{ versions: ProjectVersion[]; total: number }> => {
    const response = await apiClient.get(`/api/v1/projects/${id}/versions`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get specific version with full snapshot
   */
  getVersion: async (id: string, versionNumber: number): Promise<ProjectVersionDetail> => {
    const response = await apiClient.get<ProjectVersionDetail>(
      `/api/v1/projects/${id}/versions/${versionNumber}`
    );
    return response.data;
  },

  // Sharing

  /**
   * Share project with a user
   */
  share: async (id: string, input: ShareProjectInput): Promise<ProjectShare> => {
    const response = await apiClient.post<ProjectShare>(`/api/v1/projects/${id}/share`, input);
    return response.data;
  },

  /**
   * Get all shares for a project
   */
  getShares: async (id: string): Promise<ProjectShare[]> => {
    const response = await apiClient.get<ProjectShare[]>(`/api/v1/projects/${id}/shares`);
    return response.data;
  },

  /**
   * Remove a share
   */
  removeShare: async (id: string, shareId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${id}/shares/${shareId}`);
  },

  // Bulk Operations

  /**
   * Perform bulk operations on projects
   */
  bulkOperation: async (input: BulkOperationInput): Promise<BulkOperationResult> => {
    const response = await apiClient.post<BulkOperationResult>('/api/v1/projects/bulk', input);
    return response.data;
  },
};

export default projectsApi;
