/**
 * API Response Types
 */

// Common types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  owner_id: string;
  folder_id?: string;
  version: number;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  project_data: Record<string, any>;
  shares: ProjectShare[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  project_data?: Record<string, any>;
  thumbnail_url?: string;
  folder_id?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  project_data?: Record<string, any>;
  thumbnail_url?: string;
  folder_id?: string;
  version: number;
  change_summary?: string;
}

export interface ProjectListParams {
  folder_id?: string;
  status_filter?: 'active' | 'archived' | 'deleted';
  search?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  offset: number;
  limit: number;
}

// Project Version types
export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  change_summary?: string;
  is_auto_save: boolean;
  created_by: string;
  created_at: string;
}

export interface ProjectVersionDetail extends ProjectVersion {
  project_data_snapshot: Record<string, any>;
  vector_clock: Record<string, number>;
}

// Project Sharing types
export interface ProjectShare {
  id: string;
  project_id: string;
  shared_with_user_id: string;
  permission: 'view' | 'edit' | 'admin';
  shared_by: string;
  created_at: string;
}

export interface ShareProjectInput {
  shared_with_user_id: string;
  permission: 'view' | 'edit' | 'admin';
}

// Project Operations
export interface DuplicateProjectInput {
  new_name: string;
  include_version_history?: boolean;
}

export interface BulkOperationInput {
  project_ids: string[];
  operation: 'archive' | 'delete' | 'duplicate' | 'move';
  target_folder_id?: string;
}

export interface BulkOperationResult {
  successful_count: number;
  failed_count: number;
  successful_ids: string[];
  failed_ids: string[];
  errors: Record<string, string>;
  message: string;
}

// Media types
export interface MediaAsset {
  id: string;
  projectId: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  size: number;
  mimeType: string;
  metadata: {
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UploadMediaInput {
  projectId: string;
  file: File;
  name?: string;
}

export interface MediaUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Composition types
export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'text';
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  volume: number;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  startTime: number;
  endTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  effects: Effect[];
  transitions: Transition[];
}

export interface Effect {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
}

export interface Transition {
  id: string;
  type: string;
  duration: number;
  parameters: Record<string, unknown>;
}

export interface Composition {
  id: string;
  projectId: string;
  name: string;
  tracks: TimelineTrack[];
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompositionInput {
  name?: string;
  tracks?: TimelineTrack[];
}

// Export types
export interface ExportJob {
  id: string;
  projectId: string;
  compositionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  format: string;
  quality: string;
  resolution: {
    width: number;
    height: number;
  };
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateExportInput {
  projectId: string;
  compositionId: string;
  format: 'mp4' | 'mov' | 'webm';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: {
    width: number;
    height: number;
  };
}

export interface ExportProgress {
  jobId: string;
  progress: number;
  status: ExportJob['status'];
  estimatedTimeRemaining?: number;
}
