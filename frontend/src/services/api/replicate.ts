import { apiClient, type ApiError } from '../../lib/api-client';
import type {
  ReplicateGenerationRequest,
  ReplicateGenerationResponse,
  AspectRatio,
  GenerationType,
} from '../../types/replicate';

/**
 * Replicate API Service
 * Handles communication with backend Replicate endpoints
 */

interface ImageGenerationParams {
  prompt: string;
  aspectRatio: AspectRatio;
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
}

interface VideoGenerationParams {
  prompt: string;
  aspectRatio: AspectRatio;
  fps?: number;
  duration?: number;
  motionScale?: number;
}

export class ReplicateService {
  private static instance: ReplicateService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ReplicateService {
    if (!ReplicateService.instance) {
      ReplicateService.instance = new ReplicateService();
    }
    return ReplicateService.instance;
  }

  /**
   * Generate image using nano-banana model
   */
  async generateImage(params: ImageGenerationParams): Promise<ReplicateGenerationResponse> {
    try {
      const response = await apiClient.post<ReplicateGenerationResponse>(
        '/api/v1/replicate/nano-banana',
        {
          prompt: params.prompt,
          aspect_ratio: params.aspectRatio,
          num_inference_steps: params.numInferenceSteps || 4,
          guidance_scale: params.guidanceScale || 3.5,
          seed: params.seed,
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as ApiError, 'Image generation failed');
      throw error;
    }
  }

  /**
   * Generate video using wan-video-i2v model
   */
  async generateVideo(params: VideoGenerationParams): Promise<ReplicateGenerationResponse> {
    try {
      const response = await apiClient.post<ReplicateGenerationResponse>(
        '/api/v1/replicate/wan-video-i2v',
        {
          prompt: params.prompt,
          aspect_ratio: params.aspectRatio,
          fps: params.fps || 24,
          duration: params.duration || 3,
          motion_scale: params.motionScale || 1.0,
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as ApiError, 'Video generation failed');
      throw error;
    }
  }

  /**
   * Generate content based on type (image or video)
   */
  async generate(request: ReplicateGenerationRequest): Promise<ReplicateGenerationResponse> {
    if (request.type === 'image') {
      return this.generateImage({
        prompt: request.prompt,
        aspectRatio: request.aspectRatio,
        numInferenceSteps: request.advancedSettings?.numInferenceSteps,
        guidanceScale: request.advancedSettings?.guidanceScale,
        seed: request.advancedSettings?.seed,
      });
    } else {
      return this.generateVideo({
        prompt: request.prompt,
        aspectRatio: request.aspectRatio,
        fps: request.advancedSettings?.fps,
        duration: request.advancedSettings?.duration,
        motionScale: request.advancedSettings?.motionScale,
      });
    }
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(generationId: string): Promise<ReplicateGenerationResponse> {
    try {
      const response = await apiClient.get<ReplicateGenerationResponse>(
        `/api/v1/replicate/generations/${generationId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error as ApiError, 'Failed to get generation status');
      throw error;
    }
  }

  /**
   * Cancel a generation
   */
  async cancelGeneration(generationId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/replicate/generations/${generationId}/cancel`);
    } catch (error) {
      this.handleError(error as ApiError, 'Failed to cancel generation');
      throw error;
    }
  }

  /**
   * Handle API errors with logging
   */
  private handleError(error: ApiError, context: string): void {
    console.error(`[ReplicateService] ${context}:`, {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
    });
  }
}

// Export singleton instance
export const replicateService = ReplicateService.getInstance();

export default replicateService;
