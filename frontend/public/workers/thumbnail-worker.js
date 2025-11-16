/**
 * Subtask 20.4: WebWorker for Thumbnail Generation
 *
 * Worker that generates thumbnails from video frames using OffscreenCanvas.
 * Supports multiple quality levels and communicates with main thread via messages.
 */

// Quality configurations (matching constants.ts)
const QUALITY_CONFIGS = {
  low: {
    maxWidth: 320,
    maxHeight: 180,
    jpegQuality: 0.6,
  },
  medium: {
    maxWidth: 640,
    maxHeight: 360,
    jpegQuality: 0.75,
  },
  high: {
    maxWidth: 1280,
    maxHeight: 720,
    jpegQuality: 0.9,
  },
};

/**
 * Generate thumbnail from video
 */
async function generateThumbnail(videoUrl, timestamp, quality) {
  try {
    // Create video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    // Load video
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = videoUrl;
    });

    // Seek to timestamp
    video.currentTime = timestamp;
    await new Promise((resolve) => {
      video.onseeked = resolve;
    });

    // Get quality config
    const config = QUALITY_CONFIGS[quality] || QUALITY_CONFIGS.medium;

    // Calculate dimensions maintaining aspect ratio
    const { width, height } = calculateDimensions(
      video.videoWidth,
      video.videoHeight,
      config.maxWidth,
      config.maxHeight
    );

    // Create OffscreenCanvas if available, otherwise use regular canvas
    let canvas;
    let ctx;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }

    // Draw video frame
    ctx.drawImage(video, 0, 0, width, height);

    // Convert to blob
    let blob;
    if (canvas.convertToBlob) {
      blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: config.jpegQuality,
      });
    } else {
      // Fallback for regular canvas
      blob = await new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          'image/jpeg',
          config.jpegQuality
        );
      });
    }

    return {
      blob,
      width,
      height,
    };
  } catch (error) {
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  }
}

/**
 * Calculate dimensions maintaining aspect ratio
 */
function calculateDimensions(videoWidth, videoHeight, maxWidth, maxHeight) {
  const aspectRatio = videoWidth / videoHeight;

  let width = videoWidth;
  let height = videoHeight;

  // Scale down if necessary
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.floor(width),
    height: Math.floor(height),
  };
}

/**
 * Message handler
 */
self.onmessage = async function (event) {
  const { type, requestId, data } = event.data;

  if (type !== 'generate') {
    return;
  }

  try {
    const { videoUrl, timestamp, targetQuality } = data;

    const result = await generateThumbnail(
      videoUrl,
      timestamp,
      targetQuality || 'medium'
    );

    // Send success response
    self.postMessage({
      type: 'response',
      requestId,
      data: {
        blob: result.blob,
        width: result.width,
        height: result.height,
        quality: targetQuality || 'medium',
      },
    });
  } catch (error) {
    // Send error response
    self.postMessage({
      type: 'error',
      requestId,
      error: error.message,
    });
  }
};

/**
 * Handle worker errors
 */
self.onerror = function (error) {
  console.error('Worker error:', error);
};
