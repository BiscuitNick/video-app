/**
 * Waveform Generator Service
 *
 * High-level service for generating and managing waveforms.
 * Coordinates between worker service and cache service.
 * Integrates with AudioSyncManager for audio loading.
 */

import type {
  WaveformData,
  WaveformGenerationOptions,
  WaveformLoadOptions,
  WaveformStats,
} from '@/lib/waveform/types';
import { getWaveformWorkerService } from './WaveformWorkerService';
import { getWaveformCacheService } from './WaveformCacheService';
import { AudioSyncManager } from '../playback/AudioSyncManager';

interface GenerationRequest {
  id: string;
  audioUrl: string;
  assetId: string;
  options: WaveformGenerationOptions;
  promise: Promise<WaveformData>;
  abortController?: AbortController;
}

class WaveformGenerator {
  private workerService = getWaveformWorkerService();
  private cacheService = getWaveformCacheService();
  private audioSyncManager: AudioSyncManager | null = null;
  private activeRequests: Map<string, GenerationRequest> = new Map();
  private generationTimes: number[] = [];
  private maxGenerationTimesSamples = 100;

  /**
   * Set AudioSyncManager for audio loading
   */
  setAudioSyncManager(manager: AudioSyncManager): void {
    this.audioSyncManager = manager;
  }

  /**
   * Generate waveform cache key
   */
  private getCacheKey(
    assetId: string,
    audioUrl: string,
    options: WaveformGenerationOptions
  ): string {
    const quality = options.quality || 'medium';
    const samplesPerPixel = options.samplesPerPixel || 'default';
    return `waveform_${assetId}_${quality}_${samplesPerPixel}`;
  }

  /**
   * Load waveform (from cache or generate)
   */
  async loadWaveform(
    assetId: string,
    audioUrl: string,
    options: WaveformGenerationOptions = {},
    loadOptions: WaveformLoadOptions = {}
  ): Promise<WaveformData> {
    const cacheKey = this.getCacheKey(assetId, audioUrl, options);

    // Check if already generating
    const existingRequest = this.activeRequests.get(cacheKey);
    if (existingRequest && !loadOptions.forceRegenerate) {
      return existingRequest.promise;
    }

    // Check cache
    if (!loadOptions.forceRegenerate) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Generate new waveform
    const abortController = new AbortController();
    const promise = this.generateWaveform(
      cacheKey,
      assetId,
      audioUrl,
      options,
      abortController.signal
    );

    // Store active request
    this.activeRequests.set(cacheKey, {
      id: cacheKey,
      audioUrl,
      assetId,
      options,
      promise,
      abortController,
    });

    // Clean up when done
    promise.finally(() => {
      this.activeRequests.delete(cacheKey);
    });

    return promise;
  }

  /**
   * Generate waveform
   */
  private async generateWaveform(
    cacheKey: string,
    assetId: string,
    audioUrl: string,
    options: WaveformGenerationOptions,
    signal: AbortSignal
  ): Promise<WaveformData> {
    const startTime = performance.now();

    try {
      // Load audio buffer
      const audioBuffer = await this.loadAudioBuffer(audioUrl, signal);

      if (signal.aborted) {
        throw new Error('Generation cancelled');
      }

      // Generate waveform using worker
      const waveformData = await this.workerService.generateWaveformFromBuffer(
        audioBuffer,
        options
      );

      // Track generation time
      const generationTime = performance.now() - startTime;
      this.trackGenerationTime(generationTime);

      // Cache the result
      await this.cacheService.put(cacheKey, waveformData, audioUrl, assetId);

      return waveformData;
    } catch (error) {
      console.error('Failed to generate waveform:', error);
      throw error;
    }
  }

  /**
   * Load audio buffer
   */
  private async loadAudioBuffer(
    audioUrl: string,
    signal: AbortSignal
  ): Promise<ArrayBuffer> {
    // If we have an AudioSyncManager, use it for consistent audio loading
    if (this.audioSyncManager) {
      const audioBuffer = await this.audioSyncManager.loadAudioBuffer(audioUrl);

      // Convert AudioBuffer to ArrayBuffer
      // Note: This is a simplified approach. In production, you might want to
      // store the original ArrayBuffer in AudioSyncManager
      const channels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;

      // Create a simple WAV file in memory
      return this.audioBufferToArrayBuffer(audioBuffer);
    }

    // Fallback: fetch audio file directly
    const response = await fetch(audioUrl, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * Convert Web Audio API AudioBuffer to ArrayBuffer (WAV format)
   * This is a simplified implementation for the worker
   */
  private audioBufferToArrayBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;

    // Calculate buffer size
    const dataSize = length * numberOfChannels * bytesPerSample;
    const bufferSize = 44 + dataSize; // 44 bytes for WAV header

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return buffer;
  }

  /**
   * Track generation time for statistics
   */
  private trackGenerationTime(time: number): void {
    this.generationTimes.push(time);
    if (this.generationTimes.length > this.maxGenerationTimesSamples) {
      this.generationTimes.shift();
    }
  }

  /**
   * Get average generation time
   */
  private getAverageGenerationTime(): number {
    if (this.generationTimes.length === 0) return 0;
    const sum = this.generationTimes.reduce((a, b) => a + b, 0);
    return sum / this.generationTimes.length;
  }

  /**
   * Prefetch waveforms for multiple assets
   */
  async prefetchWaveforms(
    assets: Array<{ id: string; url: string }>,
    options: WaveformGenerationOptions = {}
  ): Promise<void> {
    const promises = assets.map(({ id, url }) =>
      this.loadWaveform(id, url, options).catch((error) => {
        console.error(`Failed to prefetch waveform for ${id}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Cancel waveform generation
   */
  cancelGeneration(assetId: string, audioUrl: string, options: WaveformGenerationOptions = {}): void {
    const cacheKey = this.getCacheKey(assetId, audioUrl, options);
    const request = this.activeRequests.get(cacheKey);

    if (request) {
      request.abortController?.abort();
      this.activeRequests.delete(cacheKey);
    }
  }

  /**
   * Delete waveform from cache
   */
  async deleteWaveform(assetId: string): Promise<void> {
    await this.cacheService.deleteByAssetId(assetId);
  }

  /**
   * Clear all waveforms
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clear();
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<WaveformStats> {
    const cacheStats = await this.cacheService.getStats();
    return {
      ...cacheStats,
      averageGenerationTime: this.getAverageGenerationTime(),
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      activeRequests: this.activeRequests.size,
      workerStats: this.workerService.getStats(),
      cacheSize: this.cacheService.getCurrentSize(),
      averageGenerationTime: this.getAverageGenerationTime(),
    };
  }

  /**
   * Destroy service
   */
  destroy(): void {
    // Cancel all active requests
    this.activeRequests.forEach((request) => {
      request.abortController?.abort();
    });
    this.activeRequests.clear();

    // Destroy services
    this.workerService.destroy();
    this.cacheService.close();
  }
}

// Singleton instance
let generatorInstance: WaveformGenerator | null = null;

export function getWaveformGenerator(): WaveformGenerator {
  if (!generatorInstance) {
    generatorInstance = new WaveformGenerator();
  }
  return generatorInstance;
}

export { WaveformGenerator };
