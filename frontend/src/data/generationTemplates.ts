import type { GenerationTemplate } from '../types/replicate';

/**
 * Preset templates for AI generation
 */

export const imageTemplates: GenerationTemplate[] = [
  {
    id: 'cinematic',
    name: 'Cinematic Shot',
    description: 'Professional cinematic photography style',
    type: 'image',
    prompt: 'cinematic shot, dramatic lighting, professional photography, 8k, highly detailed',
    defaultSettings: {
      numInferenceSteps: 4,
      guidanceScale: 3.5,
    },
  },
  {
    id: 'product',
    name: 'Product Photography',
    description: 'Clean product shot with studio lighting',
    type: 'image',
    prompt: 'product photography, studio lighting, white background, professional, high quality',
    defaultSettings: {
      numInferenceSteps: 4,
      guidanceScale: 4.0,
    },
  },
  {
    id: 'landscape',
    name: 'Landscape',
    description: 'Beautiful landscape photography',
    type: 'image',
    prompt: 'stunning landscape, golden hour, dramatic sky, professional photography, 8k',
    defaultSettings: {
      numInferenceSteps: 4,
      guidanceScale: 3.5,
    },
  },
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Professional portrait photography',
    type: 'image',
    prompt: 'professional portrait, soft lighting, shallow depth of field, 85mm lens, high quality',
    defaultSettings: {
      numInferenceSteps: 4,
      guidanceScale: 3.5,
    },
  },
  {
    id: 'abstract',
    name: 'Abstract Art',
    description: 'Creative abstract artwork',
    type: 'image',
    prompt: 'abstract art, vibrant colors, creative composition, digital art, highly detailed',
    defaultSettings: {
      numInferenceSteps: 4,
      guidanceScale: 4.5,
    },
  },
];

export const videoTemplates: GenerationTemplate[] = [
  {
    id: 'motion',
    name: 'Dynamic Motion',
    description: 'Video with dynamic camera movement',
    type: 'video',
    prompt: 'dynamic camera movement, smooth motion, cinematic, professional video',
    defaultSettings: {
      fps: 24,
      duration: 3,
      motionScale: 1.2,
    },
  },
  {
    id: 'subtle',
    name: 'Subtle Animation',
    description: 'Gentle, subtle movement',
    type: 'video',
    prompt: 'subtle animation, gentle movement, calm, smooth transitions',
    defaultSettings: {
      fps: 24,
      duration: 3,
      motionScale: 0.8,
    },
  },
  {
    id: 'atmospheric',
    name: 'Atmospheric',
    description: 'Atmospheric video with mood',
    type: 'video',
    prompt: 'atmospheric, moody lighting, cinematic ambiance, professional cinematography',
    defaultSettings: {
      fps: 24,
      duration: 3,
      motionScale: 1.0,
    },
  },
];

export const getAllTemplates = (): GenerationTemplate[] => {
  return [...imageTemplates, ...videoTemplates];
};

export const getTemplatesByType = (
  type: 'image' | 'video'
): GenerationTemplate[] => {
  return type === 'image' ? imageTemplates : videoTemplates;
};

export const getTemplateById = (id: string): GenerationTemplate | undefined => {
  return getAllTemplates().find((t) => t.id === id);
};
