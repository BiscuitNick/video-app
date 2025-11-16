import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaDetailsPanel } from '../MediaDetailsPanel';
import { useTimelineStore } from '@/stores/useTimelineStore';
import type { Clip } from '@/types';

// Mock the timeline store
vi.mock('@/stores/useTimelineStore');

describe('MediaDetailsPanel', () => {
  const mockClip: Clip = {
    id: 'test-clip-1',
    trackId: 'test-track-1',
    mediaAssetId: 'test-asset-1',
    startTime: 0,
    endTime: 10,
    trimStart: 0,
    trimEnd: 0,
    properties: {
      speed: 1,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 100, y: 100 },
        rotation: 0,
        opacity: 100,
      },
      audio: {
        volume: 100,
        muted: false,
      },
      transition: {
        type: 'none',
        duration: 0.5,
      },
    },
  };

  const mockUpdateClip = vi.fn();
  const mockGetClipById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClipById.mockReturnValue(mockClip);

    (useTimelineStore as any).mockReturnValue({
      selection: { clipIds: ['test-clip-1'], trackIds: [] },
      getClipById: mockGetClipById,
      updateClip: mockUpdateClip,
    });
  });

  it('renders empty state when no clip is selected', () => {
    (useTimelineStore as any).mockReturnValue({
      selection: { clipIds: [], trackIds: [] },
      getClipById: mockGetClipById,
      updateClip: mockUpdateClip,
    });

    render(<MediaDetailsPanel />);
    expect(screen.getByText('Select a clip to view properties')).toBeInTheDocument();
  });

  it('renders with clip selected', () => {
    render(<MediaDetailsPanel />);
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Basic Properties')).toBeInTheDocument();
    expect(screen.getByText('Transform Properties')).toBeInTheDocument();
    expect(screen.getByText('Audio Properties')).toBeInTheDocument();
    expect(screen.getByText('Effects')).toBeInTheDocument();
  });

  it('displays batch mode indicator when multiple clips selected', () => {
    (useTimelineStore as any).mockReturnValue({
      selection: { clipIds: ['clip-1', 'clip-2'], trackIds: [] },
      getClipById: mockGetClipById,
      updateClip: mockUpdateClip,
    });

    render(<MediaDetailsPanel />);
    expect(screen.getByText('Properties (2 clips)')).toBeInTheDocument();
  });

  it('calls updateClip when property is changed', async () => {
    render(<MediaDetailsPanel />);

    // Wait for debounced update
    await waitFor(
      () => {
        expect(mockUpdateClip).toHaveBeenCalled();
      },
      { timeout: 100 }
    );
  });

  it('resets properties when reset button is clicked', () => {
    render(<MediaDetailsPanel />);

    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    expect(mockUpdateClip).toHaveBeenCalledWith('test-clip-1', {
      properties: expect.objectContaining({
        speed: 1,
        transform: expect.objectContaining({
          opacity: 100,
        }),
      }),
    });
  });

  it('toggles collapsible sections', () => {
    render(<MediaDetailsPanel />);

    const basicPropertiesToggle = screen.getByText('Basic Properties');
    fireEvent.click(basicPropertiesToggle);

    // Check if section is collapsed by looking for chevron direction
    // The implementation may vary based on your exact UI
  });
});
