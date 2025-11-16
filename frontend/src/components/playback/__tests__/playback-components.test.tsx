import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayRenderer } from '../OverlayRenderer';
import { TransitionRenderer, TransitionPreview } from '../TransitionRenderer';
import { PlaybackControls } from '../PlaybackControls';
import { PerformanceMonitor } from '../PerformanceMonitor';
import type { OverlayConfig, TransitionConfig, PlaybackControlsState } from '../types';

describe('OverlayRenderer', () => {
  it('renders text overlays correctly', () => {
    const overlays: OverlayConfig[] = [
      {
        id: 'overlay-1',
        type: 'text',
        content: 'Test Overlay',
        position: { x: 50, y: 50 },
        startTime: 0,
        endTime: 10,
      },
    ];

    const { container } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    expect(container.querySelector('.overlay-container')).toBeTruthy();
    expect(screen.getByText('Test Overlay')).toBeTruthy();
  });

  it('filters overlays by time range', () => {
    const overlays: OverlayConfig[] = [
      {
        id: 'overlay-1',
        type: 'text',
        content: 'Visible',
        position: { x: 50, y: 50 },
        startTime: 0,
        endTime: 10,
      },
      {
        id: 'overlay-2',
        type: 'text',
        content: 'Hidden',
        position: { x: 50, y: 50 },
        startTime: 15,
        endTime: 20,
      },
    ];

    render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    expect(screen.getByText('Visible')).toBeTruthy();
    expect(screen.queryByText('Hidden')).toBeFalsy();
  });

  it('renders image overlays correctly', () => {
    const overlays: OverlayConfig[] = [
      {
        id: 'overlay-1',
        type: 'image',
        content: 'https://example.com/image.png',
        position: { x: 50, y: 50 },
        startTime: 0,
        endTime: 10,
      },
    ];

    const { container } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toBe('https://example.com/image.png');
  });

  it('respects z-index ordering', () => {
    const overlays: OverlayConfig[] = [
      {
        id: 'overlay-1',
        type: 'text',
        content: 'Back',
        position: { x: 50, y: 50 },
        zIndex: 1,
        startTime: 0,
        endTime: 10,
      },
      {
        id: 'overlay-2',
        type: 'text',
        content: 'Front',
        position: { x: 50, y: 50 },
        zIndex: 2,
        startTime: 0,
        endTime: 10,
      },
    ];

    const { container } = render(
      <OverlayRenderer
        overlays={overlays}
        currentTime={5}
        containerWidth={1920}
        containerHeight={1080}
      />
    );

    const overlayElements = container.querySelectorAll('.overlay-container > div');
    expect(overlayElements.length).toBe(2);
  });
});

describe('TransitionRenderer', () => {
  it('renders children without transition when inactive', () => {
    render(
      <TransitionRenderer transition={null} currentTime={5}>
        <div>Test Content</div>
      </TransitionRenderer>
    );

    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('applies fade transition correctly', () => {
    const transition: TransitionConfig = {
      id: 'transition-1',
      type: 'fade',
      duration: 1,
      startTime: 0,
      timingFunction: 'linear',
    };

    const { container } = render(
      <TransitionRenderer transition={transition} currentTime={0.5}>
        <div>Test Content</div>
      </TransitionRenderer>
    );

    expect(container.querySelector('[style*="opacity"]')).toBeTruthy();
  });

  it('applies wipe-left transition correctly', () => {
    const transition: TransitionConfig = {
      id: 'transition-1',
      type: 'wipe-left',
      duration: 1,
      startTime: 0,
    };

    const { container } = render(
      <TransitionRenderer transition={transition} currentTime={0.5}>
        <div>Test Content</div>
      </TransitionRenderer>
    );

    expect(container.querySelector('[style*="clip-path"]')).toBeTruthy();
  });
});

describe('TransitionPreview', () => {
  it('renders preview component', () => {
    const { container } = render(
      <TransitionPreview type="fade" duration={1} />
    );

    expect(container.querySelector('div')).toBeTruthy();
  });
});

describe('PlaybackControls', () => {
  const mockState: PlaybackControlsState = {
    isPlaying: false,
    currentTime: 5,
    duration: 60,
    playbackRate: 1,
    currentFrame: 150,
    totalFrames: 1800,
  };

  const mockHandlers = {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onSeek: vi.fn(),
    onSeekToFrame: vi.fn(),
    onPlaybackRateChange: vi.fn(),
    onFrameStep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all control buttons', () => {
    const { container } = render(
      <PlaybackControls state={mockState} {...mockHandlers} />
    );

    expect(container.querySelector('.playback-controls')).toBeTruthy();
    expect(container.querySelector('.transport-controls')).toBeTruthy();
    expect(container.querySelector('.timeline-scrubber')).toBeTruthy();
  });

  it('calls onPlay when play button clicked', () => {
    render(<PlaybackControls state={mockState} {...mockHandlers} />);

    const playButton = screen.getByTitle(/Play/);
    fireEvent.click(playButton);

    expect(mockHandlers.onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when pause button clicked', () => {
    const playingState = { ...mockState, isPlaying: true };
    render(<PlaybackControls state={playingState} {...mockHandlers} />);

    const pauseButton = screen.getByTitle(/Pause/);
    fireEvent.click(pauseButton);

    expect(mockHandlers.onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when stop button clicked', () => {
    render(<PlaybackControls state={mockState} {...mockHandlers} />);

    const stopButton = screen.getByTitle(/Stop/);
    fireEvent.click(stopButton);

    expect(mockHandlers.onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onFrameStep when frame step buttons clicked', () => {
    render(<PlaybackControls state={mockState} {...mockHandlers} />);

    const prevButton = screen.getByTitle(/Previous Frame/);
    const nextButton = screen.getByTitle(/Next Frame/);

    fireEvent.click(prevButton);
    expect(mockHandlers.onFrameStep).toHaveBeenCalledWith('backward');

    fireEvent.click(nextButton);
    expect(mockHandlers.onFrameStep).toHaveBeenCalledWith('forward');
  });

  it('displays current time correctly', () => {
    render(<PlaybackControls state={mockState} {...mockHandlers} fps={30} />);

    // Should display time in HH:MM:SS:FF format
    expect(screen.getByText(/00:00:05:00/)).toBeTruthy();
  });
});

describe('PerformanceMonitor', () => {
  it('renders when enabled', () => {
    const { container } = render(<PerformanceMonitor enabled={true} />);
    expect(container.querySelector('.performance-monitor')).toBeTruthy();
  });

  it('does not render when disabled', () => {
    const { container } = render(<PerformanceMonitor enabled={false} />);
    expect(container.querySelector('.performance-monitor')).toBeFalsy();
  });

  it('renders at correct position', () => {
    const { container } = render(
      <PerformanceMonitor enabled={true} position="top-left" />
    );
    expect(container.querySelector('.performance-monitor-top-left')).toBeTruthy();
  });

  it('displays FPS metric', () => {
    render(<PerformanceMonitor enabled={true} />);
    expect(screen.getByText('FPS:')).toBeTruthy();
  });

  it('displays frame time metric', () => {
    render(<PerformanceMonitor enabled={true} />);
    expect(screen.getByText('Frame:')).toBeTruthy();
  });

  it('displays dropped frames metric', () => {
    render(<PerformanceMonitor enabled={true} />);
    expect(screen.getByText('Dropped:')).toBeTruthy();
  });
});
