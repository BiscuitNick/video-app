import pako from 'pako';
import type { ProjectInfo, MediaAsset, Track, Clip } from '@/types';

// Current version of the serialization format
export const SERIALIZATION_VERSION = 1;

export interface SerializedProject {
  version: number;
  timestamp: number;
  compressed: boolean;
  data: {
    // App state
    project: ProjectInfo;
    uiState: {
      sidebarOpen: boolean;
      timelineHeight: number;
      selectedPanel: 'media' | 'effects' | 'properties' | null;
    };

    // Timeline state
    timeline: {
      tracks: Track[];
      zoom: number;
      scrollPosition: number;
      snapEnabled: boolean;
      playhead: number;
    };

    // Media library
    mediaLibrary: {
      assets: MediaAsset[];
    };

    // Export settings (if any)
    exportSettings?: {
      format: string;
      quality: string;
      resolution: {
        width: number;
        height: number;
      };
    };
  };
}

export interface SerializationOptions {
  compress: boolean;
  compressionThreshold: number; // bytes - compress if larger than this
  validate: boolean;
}

export interface DeserializationOptions {
  validate: boolean;
  handleMissingMedia: 'error' | 'placeholder' | 'skip';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Serialize project state to JSON
 */
export const serializeProject = (
  state: {
    app: any;
    timeline: any;
    mediaLibrary: any;
  },
  options: Partial<SerializationOptions> = {}
): SerializedProject => {
  const opts: SerializationOptions = {
    compress: true,
    compressionThreshold: 100 * 1024, // 100KB
    validate: true,
    ...options,
  };

  const serialized: SerializedProject = {
    version: SERIALIZATION_VERSION,
    timestamp: Date.now(),
    compressed: false,
    data: {
      // App state
      project: {
        ...state.app.project,
        // Ensure dates are serialized as ISO strings
        createdAt: state.app.project.createdAt,
        updatedAt: state.app.project.updatedAt,
      },
      uiState: state.app.uiState,

      // Timeline state
      timeline: {
        tracks: state.timeline.tracks,
        zoom: state.timeline.zoom,
        scrollPosition: state.timeline.scrollPosition,
        snapEnabled: state.timeline.snapEnabled,
        playhead: state.timeline.playhead || 0,
      },

      // Media library
      mediaLibrary: {
        assets: state.mediaLibrary.assets.map((asset: MediaAsset) => ({
          ...asset,
          // Ensure dates are serialized
          createdAt: asset.createdAt,
        })),
      },

      // Export settings (placeholder for now)
      exportSettings: undefined,
    },
  };

  // Validate if requested
  if (opts.validate) {
    const validation = validateSerializedProject(serialized);
    if (!validation.valid) {
      console.error('Serialization validation failed:', validation.errors);
      throw new Error(`Serialization validation failed: ${validation.errors.join(', ')}`);
    }
  }

  return serialized;
};

/**
 * Deserialize project state from JSON
 */
export const deserializeProject = (
  serialized: SerializedProject | string,
  options: Partial<DeserializationOptions> = {}
): SerializedProject => {
  const opts: DeserializationOptions = {
    validate: true,
    handleMissingMedia: 'placeholder',
    ...options,
  };

  // Parse if string
  let data: SerializedProject;
  if (typeof serialized === 'string') {
    try {
      data = JSON.parse(serialized);
    } catch (error) {
      throw new Error('Failed to parse serialized project: Invalid JSON');
    }
  } else {
    data = serialized;
  }

  // Decompress if needed
  if (data.compressed) {
    data = decompressProject(data);
  }

  // Validate if requested
  if (opts.validate) {
    const validation = validateSerializedProject(data);
    if (!validation.valid) {
      throw new Error(`Deserialization validation failed: ${validation.errors.join(', ')}`);
    }
  }

  // Migrate if needed
  if (data.version < SERIALIZATION_VERSION) {
    data = migrateProject(data);
  }

  // Handle missing media references
  if (opts.handleMissingMedia !== 'skip') {
    data = handleMissingMediaReferences(data, opts.handleMissingMedia);
  }

  // Restore dates
  data = restoreDates(data);

  return data;
};

/**
 * Compress project data using pako (gzip)
 */
export const compressProject = (project: SerializedProject): SerializedProject => {
  try {
    const jsonString = JSON.stringify(project.data);
    const compressed = pako.gzip(jsonString);
    const base64 = btoa(String.fromCharCode(...compressed));

    return {
      ...project,
      compressed: true,
      data: base64 as any,
    };
  } catch (error) {
    console.error('Compression failed:', error);
    // Return original if compression fails
    return project;
  }
};

/**
 * Decompress project data
 */
export const decompressProject = (project: SerializedProject): SerializedProject => {
  try {
    if (!project.compressed || typeof project.data === 'object') {
      return project;
    }

    const base64 = project.data as unknown as string;
    const compressed = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decompressed = pako.ungzip(compressed, { to: 'string' });
    const data = JSON.parse(decompressed);

    return {
      ...project,
      compressed: false,
      data,
    };
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new Error('Failed to decompress project data');
  }
};

/**
 * Validate serialized project structure
 */
export const validateSerializedProject = (project: SerializedProject): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check version
  if (!project.version || typeof project.version !== 'number') {
    errors.push('Missing or invalid version');
  }

  // Check timestamp
  if (!project.timestamp || typeof project.timestamp !== 'number') {
    errors.push('Missing or invalid timestamp');
  }

  // Check data exists
  if (!project.data) {
    errors.push('Missing project data');
    return { valid: false, errors, warnings };
  }

  // Skip validation if compressed
  if (project.compressed) {
    return { valid: errors.length === 0, errors, warnings };
  }

  const { data } = project;

  // Validate project info
  if (!data.project) {
    errors.push('Missing project info');
  } else {
    if (!data.project.name) warnings.push('Project name is missing');
    if (typeof data.project.fps !== 'number') errors.push('Invalid FPS value');
    if (!data.project.resolution || typeof data.project.resolution.width !== 'number') {
      errors.push('Invalid resolution');
    }
  }

  // Validate timeline
  if (!data.timeline) {
    errors.push('Missing timeline data');
  } else {
    if (!Array.isArray(data.timeline.tracks)) {
      errors.push('Timeline tracks must be an array');
    } else {
      // Validate tracks
      data.timeline.tracks.forEach((track, index) => {
        if (!track.id) errors.push(`Track ${index} missing ID`);
        if (!track.type || !['video', 'audio'].includes(track.type)) {
          errors.push(`Track ${index} has invalid type`);
        }
        if (!Array.isArray(track.clips)) {
          errors.push(`Track ${index} clips must be an array`);
        }
      });
    }

    if (typeof data.timeline.zoom !== 'number') {
      warnings.push('Invalid zoom level, will use default');
    }
  }

  // Validate media library
  if (!data.mediaLibrary) {
    warnings.push('Missing media library data');
  } else {
    if (!Array.isArray(data.mediaLibrary.assets)) {
      errors.push('Media library assets must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Migrate project from older versions
 */
export const migrateProject = (project: SerializedProject): SerializedProject => {
  let migrated = { ...project };

  // Add migration logic for each version
  if (migrated.version < 1) {
    // Migration from version 0 to 1
    // Add any necessary transformations
    console.log('Migrating project from version', migrated.version, 'to 1');
  }

  // Update to current version
  migrated.version = SERIALIZATION_VERSION;

  return migrated;
};

/**
 * Handle missing media references
 */
export const handleMissingMediaReferences = (
  project: SerializedProject,
  strategy: 'error' | 'placeholder'
): SerializedProject => {
  const mediaAssetIds = new Set(
    project.data.mediaLibrary.assets.map((asset) => asset.id)
  );

  const updatedTracks = project.data.timeline.tracks.map((track) => {
    const updatedClips = track.clips
      .map((clip) => {
        if (!mediaAssetIds.has(clip.mediaAssetId)) {
          if (strategy === 'error') {
            throw new Error(
              `Missing media asset reference: ${clip.mediaAssetId} in clip ${clip.id}`
            );
          } else {
            // Create placeholder asset
            const placeholderAsset: MediaAsset = {
              id: clip.mediaAssetId,
              name: 'Missing Media',
              type: track.type === 'video' ? 'video' : 'audio',
              url: '',
              size: 0,
              createdAt: new Date(),
              metadata: { placeholder: true },
            };

            // Add to media library
            project.data.mediaLibrary.assets.push(placeholderAsset);
            mediaAssetIds.add(clip.mediaAssetId);

            return clip;
          }
        }
        return clip;
      })
      .filter(Boolean) as Clip[];

    return {
      ...track,
      clips: updatedClips,
    };
  });

  return {
    ...project,
    data: {
      ...project.data,
      timeline: {
        ...project.data.timeline,
        tracks: updatedTracks,
      },
    },
  };
};

/**
 * Restore Date objects from serialized strings
 */
export const restoreDates = (project: SerializedProject): SerializedProject => {
  return {
    ...project,
    data: {
      ...project.data,
      project: {
        ...project.data.project,
        createdAt: project.data.project.createdAt
          ? new Date(project.data.project.createdAt)
          : null,
        updatedAt: project.data.project.updatedAt
          ? new Date(project.data.project.updatedAt)
          : null,
      },
      mediaLibrary: {
        ...project.data.mediaLibrary,
        assets: project.data.mediaLibrary.assets.map((asset) => ({
          ...asset,
          createdAt: new Date(asset.createdAt),
        })),
      },
    },
  };
};

/**
 * Calculate serialized project size
 */
export const getProjectSize = (project: SerializedProject): number => {
  const jsonString = JSON.stringify(project);
  return new Blob([jsonString]).size;
};

/**
 * Export project to file
 */
export const exportProjectToFile = (
  project: SerializedProject,
  filename: string
): void => {
  const jsonString = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Import project from file
 */
export const importProjectFromFile = (
  file: File
): Promise<SerializedProject> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const project = deserializeProject(content);
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};
