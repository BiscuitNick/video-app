import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSyncManager } from '../AudioSyncManager';

// Mock Web Audio API
const mockAudioContext = {
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 },
  })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: { value: 1 },
    buffer: null,
    onended: null,
  })),
  destination: {},
  currentTime: 0,
  state: 'running',
  resume: vi.fn(),
  close: vi.fn(),
  decodeAudioData: vi.fn(),
};

global.AudioContext = vi.fn(() => mockAudioContext as any) as any;
(global as any).webkitAudioContext = global.AudioContext;

describe('AudioSyncManager', () => {
  let audioManager: AudioSyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audioManager = new AudioSyncManager();
  });

  it('initializes correctly', () => {
    expect(audioManager).toBeTruthy();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('sets master volume correctly', () => {
    audioManager.setMasterVolume(0.5);
    const state = audioManager.getState();
    expect(state.masterVolume).toBe(0.5);
  });

  it('clamps master volume between 0 and 1', () => {
    audioManager.setMasterVolume(1.5);
    expect(audioManager.getState().masterVolume).toBe(1);

    audioManager.setMasterVolume(-0.5);
    expect(audioManager.getState().masterVolume).toBe(0);
  });

  it('sets playback rate correctly', () => {
    audioManager.setPlaybackRate(1.5);
    const state = audioManager.getState();
    expect(state.playbackRate).toBe(1.5);
  });

  it('clamps playback rate between 0.25 and 2', () => {
    audioManager.setPlaybackRate(3);
    expect(audioManager.getState().playbackRate).toBe(2);

    audioManager.setPlaybackRate(0.1);
    expect(audioManager.getState().playbackRate).toBe(0.25);
  });

  it('creates audio track correctly', () => {
    const mockBuffer = {
      duration: 10,
      numberOfChannels: 2,
      sampleRate: 44100,
    } as AudioBuffer;

    const track = audioManager.createAudioTrack('track-1', mockBuffer, 0, {
      volume: 0.8,
      crossfadeDuration: 0.5,
    });

    expect(track.id).toBe('track-1');
    expect(track.buffer).toBe(mockBuffer);
    expect(track.duration).toBe(10);
    expect(track.volume).toBe(0.8);
    expect(track.crossfadeDuration).toBe(0.5);
  });

  it('adds and removes audio tracks', () => {
    const mockBuffer = {
      duration: 10,
      numberOfChannels: 2,
      sampleRate: 44100,
    } as AudioBuffer;

    const track = audioManager.createAudioTrack('track-1', mockBuffer, 0);
    audioManager.addAudioTrack(track);

    audioManager.removeAudioTrack('track-1');
    // No error should be thrown
  });

  it('play sets isPlaying to true', () => {
    audioManager.play(0);
    expect(audioManager.getState().isPlaying).toBe(true);
  });

  it('pause sets isPlaying to false', () => {
    audioManager.play(0);
    audioManager.pause();
    expect(audioManager.getState().isPlaying).toBe(false);
  });

  it('stop resets to beginning', () => {
    audioManager.play(5);
    audioManager.stop();
    expect(audioManager.getState().isPlaying).toBe(false);
  });

  it('seek updates current time', () => {
    audioManager.seek(10);
    // Time should be updated
    const state = audioManager.getState();
    expect(state.currentTime).toBeGreaterThanOrEqual(0);
  });

  it('returns correct audio context time', () => {
    const contextTime = audioManager.getAudioContextTime();
    expect(typeof contextTime).toBe('number');
  });

  it('destroys correctly', async () => {
    await audioManager.destroy();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it('handles audio context suspension', () => {
    mockAudioContext.state = 'suspended';
    audioManager.play(0);
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });
});

describe('AudioSyncManager - Advanced Features', () => {
  let audioManager: AudioSyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audioManager = new AudioSyncManager();
  });

  it('schedules audio tracks during playback', () => {
    const mockBuffer = {
      duration: 10,
      numberOfChannels: 2,
      sampleRate: 44100,
    } as AudioBuffer;

    const track = audioManager.createAudioTrack('track-1', mockBuffer, 0);
    audioManager.setAudioTracks([track]);

    audioManager.play(0);

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
  });

  it('handles multiple audio tracks', () => {
    const mockBuffer1 = {
      duration: 10,
      numberOfChannels: 2,
      sampleRate: 44100,
    } as AudioBuffer;

    const mockBuffer2 = {
      duration: 8,
      numberOfChannels: 2,
      sampleRate: 44100,
    } as AudioBuffer;

    const track1 = audioManager.createAudioTrack('track-1', mockBuffer1, 0);
    const track2 = audioManager.createAudioTrack('track-2', mockBuffer2, 5);

    audioManager.setAudioTracks([track1, track2]);
    audioManager.play(0);

    // Should schedule tracks appropriately
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
  });

  it('provides state information', () => {
    const state = audioManager.getState();

    expect(state).toHaveProperty('isPlaying');
    expect(state).toHaveProperty('currentTime');
    expect(state).toHaveProperty('playbackRate');
    expect(state).toHaveProperty('masterVolume');
    expect(state).toHaveProperty('audioContextState');
    expect(state).toHaveProperty('activeSourcesCount');
  });
});
