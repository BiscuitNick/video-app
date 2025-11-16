/**
 * Waveform Generation Web Worker
 *
 * Processes audio files in a separate thread to generate waveform data
 * without blocking the main UI thread.
 */

// Quality configuration (must match constants.ts)
const QUALITY_CONFIG = {
  low: { samplesPerPixel: 128, maxPoints: 2000 },
  medium: { samplesPerPixel: 256, maxPoints: 4000 },
  high: { samplesPerPixel: 512, maxPoints: 8000 },
};

// Active generation requests
const activeRequests = new Map();

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (event) => {
  const { type, requestId, data } = event.data;

  if (type === 'generate') {
    try {
      const { audioUrl, audioBuffer, options = {} } = data;

      // Store request for potential cancellation
      const abortController = new AbortController();
      activeRequests.set(requestId, abortController);

      // Generate waveform
      const waveformData = await generateWaveform(
        audioUrl,
        audioBuffer,
        options,
        requestId,
        abortController.signal
      );

      // Send response
      self.postMessage({
        type: 'response',
        requestId,
        data: { waveformData },
      });

      // Clean up
      activeRequests.delete(requestId);
    } catch (error) {
      self.postMessage({
        type: 'error',
        requestId,
        error: error.message || 'Failed to generate waveform',
      });
      activeRequests.delete(requestId);
    }
  } else if (type === 'cancel') {
    const request = activeRequests.get(requestId);
    if (request) {
      request.abort();
      activeRequests.delete(requestId);
    }
  }
});

/**
 * Generate waveform data from audio
 */
async function generateWaveform(audioUrl, audioBuffer, options, requestId, signal) {
  const quality = options.quality || 'medium';
  const normalize = options.normalize !== false;
  const samplesPerPixel = options.samplesPerPixel || QUALITY_CONFIG[quality].samplesPerPixel;
  const maxPoints = QUALITY_CONFIG[quality].maxPoints;

  // Decode audio if we have a URL
  let audioData;
  if (audioBuffer) {
    audioData = await decodeAudioData(audioBuffer);
  } else if (audioUrl) {
    const buffer = await fetchAudioBuffer(audioUrl, signal);
    audioData = await decodeAudioData(buffer);
  } else {
    throw new Error('Either audioUrl or audioBuffer must be provided');
  }

  if (signal.aborted) {
    throw new Error('Generation cancelled');
  }

  const { channelData, sampleRate, duration, numberOfChannels } = audioData;

  // Calculate number of samples
  const totalSamples = channelData[0].length;
  const targetPoints = Math.min(
    Math.floor(totalSamples / samplesPerPixel),
    maxPoints
  );

  // Adjust samples per pixel based on max points
  const actualSamplesPerPixel = Math.floor(totalSamples / targetPoints);

  // Generate peak and RMS data
  const peaks = new Float32Array(targetPoints);
  const rms = new Float32Array(targetPoints);

  // Progress tracking
  let lastProgressUpdate = Date.now();
  const progressInterval = 100; // Update every 100ms

  for (let i = 0; i < targetPoints; i++) {
    if (signal.aborted) {
      throw new Error('Generation cancelled');
    }

    const start = i * actualSamplesPerPixel;
    const end = Math.min(start + actualSamplesPerPixel, totalSamples);

    let maxPeak = 0;
    let sumSquares = 0;
    const sampleCount = end - start;

    // Process all channels
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const data = channelData[ch];

      for (let j = start; j < end; j++) {
        const sample = Math.abs(data[j]);
        maxPeak = Math.max(maxPeak, sample);
        sumSquares += sample * sample;
      }
    }

    // Average across channels
    maxPeak = maxPeak / numberOfChannels;
    sumSquares = sumSquares / numberOfChannels;

    peaks[i] = maxPeak;
    rms[i] = Math.sqrt(sumSquares / sampleCount);

    // Send progress updates
    const now = Date.now();
    if (now - lastProgressUpdate > progressInterval) {
      const progress = (i + 1) / targetPoints;
      self.postMessage({
        type: 'progress',
        requestId,
        progress,
      });
      lastProgressUpdate = now;
    }
  }

  // Normalize if requested
  if (normalize) {
    const maxValue = Math.max(...peaks);
    if (maxValue > 0) {
      for (let i = 0; i < peaks.length; i++) {
        peaks[i] /= maxValue;
        rms[i] /= maxValue;
      }
    }
  }

  return {
    id: requestId,
    peaks,
    rms,
    sampleRate: targetPoints / duration,
    duration,
    channels: numberOfChannels,
    generatedAt: Date.now(),
  };
}

/**
 * Fetch audio buffer from URL
 */
async function fetchAudioBuffer(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

/**
 * Decode audio data using Web Audio API (OfflineAudioContext)
 */
async function decodeAudioData(arrayBuffer) {
  // Create an offline context to decode audio
  // We need a sample rate - use standard 48kHz
  const offlineContext = new OfflineAudioContext(1, 1, 48000);

  const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

  // Extract channel data
  const numberOfChannels = audioBuffer.numberOfChannels;
  const channelData = [];

  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i));
  }

  return {
    channelData,
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
    numberOfChannels,
  };
}

// Signal worker is ready
self.postMessage({ type: 'ready' });
