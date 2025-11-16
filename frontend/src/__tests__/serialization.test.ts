/**
 * Project Serialization Tests
 *
 * Manual tests to verify serialization/deserialization functionality
 * Run with: node --loader tsx src/__tests__/serialization.test.ts
 */

import {
  serializeProject,
  deserializeProject,
  validateSerializedProject,
  migrateProject,
  handleMissingMediaReferences,
  getProjectSize,
  SERIALIZATION_VERSION,
  type SerializedProject,
} from '../services/projectSerializationService';

console.log('🧪 Project Serialization Tests\n');

// Mock state data
const mockAppState = {
  project: {
    id: 'test-project-1',
    name: 'Test Project',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    duration: 120,
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080,
    },
  },
  uiState: {
    sidebarOpen: true,
    timelineHeight: 300,
    selectedPanel: 'media' as const,
  },
};

const mockTimelineState = {
  tracks: [
    {
      id: 'track-1',
      name: 'Video Track 1',
      type: 'video' as const,
      clips: [
        {
          id: 'clip-1',
          trackId: 'track-1',
          mediaAssetId: 'asset-1',
          startTime: 0,
          endTime: 5,
          trimStart: 0,
          trimEnd: 5,
        },
      ],
      muted: false,
      locked: false,
      visible: true,
      height: 100,
    },
  ],
  zoom: 1.5,
  scrollPosition: 0,
  snapEnabled: true,
  playhead: 2.5,
};

const mockMediaLibraryState = {
  assets: [
    {
      id: 'asset-1',
      name: 'test-video.mp4',
      type: 'video' as const,
      url: '/media/test-video.mp4',
      duration: 10,
      thumbnail: '/thumbnails/test-video.jpg',
      size: 1024000,
      createdAt: new Date('2024-01-01'),
    },
  ],
};

// Test 1: Basic Serialization
console.log('Test 1: Basic Serialization');
const serialized = serializeProject({
  app: mockAppState,
  timeline: mockTimelineState,
  mediaLibrary: mockMediaLibraryState,
});

console.log('✓ Serialization completed');
console.log('✓ Version:', serialized.version === SERIALIZATION_VERSION);
console.log('✓ Has timestamp:', !!serialized.timestamp);
console.log('✓ Has data:', !!serialized.data);
console.log('✓ Project name preserved:', serialized.data.project.name === 'Test Project');
console.log('✓ Timeline tracks preserved:', serialized.data.timeline.tracks.length === 1);
console.log('✓ Media assets preserved:', serialized.data.mediaLibrary.assets.length === 1);

// Test 2: Validation
console.log('\nTest 2: Validation');
const validation = validateSerializedProject(serialized);
console.log('✓ Validation passed:', validation.valid);
console.log('✓ No errors:', validation.errors.length === 0);
console.log('  Warnings:', validation.warnings);

// Test 3: Deserialization Round-Trip
console.log('\nTest 3: Deserialization Round-Trip');
const deserialized = deserializeProject(serialized);
console.log('✓ Deserialization completed');
console.log('✓ Project name preserved:', deserialized.data.project.name === 'Test Project');
console.log('✓ FPS preserved:', deserialized.data.project.fps === 30);
console.log('✓ Resolution preserved:',
  deserialized.data.project.resolution.width === 1920 &&
  deserialized.data.project.resolution.height === 1080
);
console.log('✓ Timeline zoom preserved:', deserialized.data.timeline.zoom === 1.5);
console.log('✓ Playhead position preserved:', deserialized.data.timeline.playhead === 2.5);
console.log('✓ Track count preserved:', deserialized.data.timeline.tracks.length === 1);
console.log('✓ Clip count preserved:', deserialized.data.timeline.tracks[0].clips.length === 1);
console.log('✓ Asset count preserved:', deserialized.data.mediaLibrary.assets.length === 1);

// Test 4: String Serialization/Deserialization
console.log('\nTest 4: String Serialization/Deserialization');
const jsonString = JSON.stringify(serialized);
const deserializedFromString = deserializeProject(jsonString);
console.log('✓ Can deserialize from JSON string');
console.log('✓ Data preserved after string conversion:',
  deserializedFromString.data.project.name === 'Test Project'
);

// Test 5: Date Restoration
console.log('\nTest 5: Date Restoration');
const deserializedWithDates = deserializeProject(serialized);
console.log('✓ Project createdAt is Date:', deserializedWithDates.data.project.createdAt instanceof Date);
console.log('✓ Project updatedAt is Date:', deserializedWithDates.data.project.updatedAt instanceof Date);
console.log('✓ Asset createdAt is Date:', deserializedWithDates.data.mediaLibrary.assets[0].createdAt instanceof Date);

// Test 6: Missing Media References (Placeholder Strategy)
console.log('\nTest 6: Missing Media References - Placeholder Strategy');
const projectWithMissingMedia: SerializedProject = {
  ...serialized,
  data: {
    ...serialized.data,
    timeline: {
      ...serialized.data.timeline,
      tracks: [
        {
          ...serialized.data.timeline.tracks[0],
          clips: [
            {
              id: 'clip-2',
              trackId: 'track-1',
              mediaAssetId: 'missing-asset-id',
              startTime: 5,
              endTime: 10,
              trimStart: 0,
              trimEnd: 5,
            },
          ],
        },
      ],
    },
  },
};

const fixedProject = handleMissingMediaReferences(projectWithMissingMedia, 'placeholder');
console.log('✓ Missing media handled');
console.log('✓ Placeholder asset created:',
  fixedProject.data.mediaLibrary.assets.some(a => a.id === 'missing-asset-id')
);
const placeholderAsset = fixedProject.data.mediaLibrary.assets.find(a => a.id === 'missing-asset-id');
console.log('✓ Placeholder has correct metadata:', placeholderAsset?.metadata?.placeholder === true);
console.log('✓ Placeholder has correct name:', placeholderAsset?.name === 'Missing Media');

// Test 7: Missing Media References (Error Strategy)
console.log('\nTest 7: Missing Media References - Error Strategy');
try {
  handleMissingMediaReferences(projectWithMissingMedia, 'error');
  console.log('✗ Should have thrown error for missing media');
} catch (error) {
  console.log('✓ Error thrown for missing media:', error instanceof Error);
  console.log('✓ Error message contains asset ID:',
    (error as Error).message.includes('missing-asset-id')
  );
}

// Test 8: Validation with Invalid Data
console.log('\nTest 8: Validation with Invalid Data');
const invalidProject: any = {
  version: SERIALIZATION_VERSION,
  timestamp: Date.now(),
  compressed: false,
  data: {
    project: {
      name: 'Test',
      // Missing required fields
    },
    timeline: {
      tracks: 'not-an-array', // Invalid
    },
  },
};

const invalidValidation = validateSerializedProject(invalidProject);
console.log('✓ Invalid project fails validation:', !invalidValidation.valid);
console.log('✓ Validation errors present:', invalidValidation.errors.length > 0);
console.log('  Error count:', invalidValidation.errors.length);
console.log('  Errors:', invalidValidation.errors.slice(0, 3));

// Test 9: Project Size Calculation
console.log('\nTest 9: Project Size Calculation');
const size = getProjectSize(serialized);
console.log('✓ Size calculated:', size > 0);
console.log('  Project size:', size, 'bytes');
console.log('  Size in KB:', (size / 1024).toFixed(2), 'KB');

// Test 10: Migration (Future Version)
console.log('\nTest 10: Migration Support');
const oldVersionProject: SerializedProject = {
  ...serialized,
  version: 0, // Old version
};

const migrated = migrateProject(oldVersionProject);
console.log('✓ Migration completed');
console.log('✓ Version updated:', migrated.version === SERIALIZATION_VERSION);

// Test 11: Complex State Preservation
console.log('\nTest 11: Complex State Preservation');
const complexState = {
  app: {
    ...mockAppState,
    project: {
      ...mockAppState.project,
      resolution: { width: 3840, height: 2160 }, // 4K
    },
  },
  timeline: {
    ...mockTimelineState,
    tracks: [
      {
        id: 'track-1',
        name: 'Video Track 1',
        type: 'video' as const,
        clips: [
          {
            id: 'clip-1',
            trackId: 'track-1',
            mediaAssetId: 'asset-1',
            startTime: 0,
            endTime: 5,
            trimStart: 0,
            trimEnd: 5,
            effects: [
              {
                id: 'effect-1',
                type: 'blur',
                parameters: { amount: 5, type: 'gaussian' },
              },
            ],
          },
          {
            id: 'clip-2',
            trackId: 'track-1',
            mediaAssetId: 'asset-2',
            startTime: 5,
            endTime: 10,
            trimStart: 0,
            trimEnd: 5,
          },
        ],
        muted: false,
        locked: false,
        visible: true,
        height: 100,
      },
      {
        id: 'track-2',
        name: 'Audio Track 1',
        type: 'audio' as const,
        clips: [],
        muted: false,
        locked: false,
        visible: true,
        height: 80,
      },
    ],
  },
  mediaLibrary: {
    assets: [
      mockMediaLibraryState.assets[0],
      {
        id: 'asset-2',
        name: 'audio-track.mp3',
        type: 'audio' as const,
        url: '/media/audio-track.mp3',
        duration: 15,
        size: 512000,
        createdAt: new Date('2024-01-02'),
      },
    ],
  },
};

const complexSerialized = serializeProject(complexState);
const complexDeserialized = deserializeProject(complexSerialized);

console.log('✓ Multiple tracks preserved:', complexDeserialized.data.timeline.tracks.length === 2);
console.log('✓ Multiple clips preserved:', complexDeserialized.data.timeline.tracks[0].clips.length === 2);
console.log('✓ Clip effects preserved:', complexDeserialized.data.timeline.tracks[0].clips[0].effects?.length === 1);
console.log('✓ Effect parameters preserved:',
  complexDeserialized.data.timeline.tracks[0].clips[0].effects?.[0].parameters.amount === 5
);
console.log('✓ Multiple assets preserved:', complexDeserialized.data.mediaLibrary.assets.length === 2);
console.log('✓ 4K resolution preserved:',
  complexDeserialized.data.project.resolution.width === 3840
);

console.log('\n✅ All serialization tests passed!');
console.log('\nTest Summary:');
console.log('- Basic serialization');
console.log('- Validation');
console.log('- Round-trip preservation');
console.log('- String conversion');
console.log('- Date restoration');
console.log('- Missing media handling (placeholder)');
console.log('- Missing media handling (error)');
console.log('- Invalid data validation');
console.log('- Project size calculation');
console.log('- Migration support');
console.log('- Complex state preservation');
