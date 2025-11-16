// Common types for the application

export type ProjectInfo = {
  id: string | null;
  name: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  duration: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
};

export type MediaAsset = {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  duration?: number;
  thumbnail?: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};

export type Track = {
  id: string;
  name: string;
  type: 'video' | 'audio';
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  height: number;
};

export type TransformProperties = {
  position: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
  opacity: number;
};

export type AudioProperties = {
  volume: number; // 0-100
  muted: boolean;
  fadeIn?: number; // duration in seconds
  fadeOut?: number; // duration in seconds
};

export type ClipProperties = {
  speed: number; // 0.1 to 4.0
  transition?: {
    type: 'fade' | 'dissolve' | 'wipe' | 'none';
    duration: number;
  };
  transform: TransformProperties;
  audio?: AudioProperties;
};

export type Clip = {
  id: string;
  trackId: string;
  mediaAssetId: string;
  startTime: number;
  endTime: number;
  trimStart: number;
  trimEnd: number;
  effects?: Effect[];
  properties: ClipProperties;
};

// Re-export effect types from effects module
export type {
  Effect,
  BaseEffect,
  EffectType,
  TransitionEffect,
  TransitionType,
  FilterEffect,
  TextOverlayEffect,
  TextAnimationType,
  TransformEffect,
  EffectTemplate,
  EffectCategory,
} from './effects';

export type TimelineSelection = {
  clipIds: string[];
  trackIds: string[];
};

export type WebSocketMessage = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
};

export type UIState = {
  sidebarOpen: boolean;
  timelineHeight: number;
  selectedPanel: 'media' | 'effects' | 'properties' | null;
};

export type PropertyPreset = {
  id: string;
  name: string;
  properties: Partial<ClipProperties>;
  createdAt: Date;
};

// Re-export AI generation types
export type * from './replicate';

// Re-export keyboard shortcuts types
export type * from './shortcuts';
