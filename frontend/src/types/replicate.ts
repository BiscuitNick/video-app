/**
 * Replicate AI Generation Types
 */

export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16';
export type GenerationType = 'image' | 'video';
export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ReplicateGenerationRequest {
  prompt: string;
  type: GenerationType;
  aspectRatio: AspectRatio;
  templateId?: string;
  advancedSettings?: AdvancedSettings;
}

export interface AdvancedSettings {
  // Image generation settings
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;

  // Video generation settings
  fps?: number;
  duration?: number;
  motionScale?: number;
}

export interface GenerationTemplate {
  id: string;
  name: string;
  description: string;
  type: GenerationType;
  prompt: string;
  defaultSettings?: AdvancedSettings;
}

export interface ReplicateGenerationResponse {
  id: string;
  status: GenerationStatus;
  outputUrl?: string;
  progress?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationQueueItem {
  id: string;
  request: ReplicateGenerationRequest;
  status: GenerationStatus;
  priority: number;
  progress: number;
  outputUrl?: string;
  error?: string;
  estimatedTimeRemaining?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GenerationHistoryItem {
  id: string;
  request: ReplicateGenerationRequest;
  status: GenerationStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  mediaId?: string; // ID of imported media asset
  createdAt: string;
  completedAt?: string;
}

export interface WebSocketProgressEvent {
  generationId: string;
  status: GenerationStatus;
  progress: number;
  estimatedTimeRemaining?: number;
  outputUrl?: string;
  error?: string;
}
