import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { TimecodeInput } from './TimecodeInput';
import { RangeSlider } from './RangeSlider';
import { VolumeControl } from './VolumeControl';
import { NumericInput } from './NumericInput';
import { DualSlider } from './DualSlider';
import { OpacitySlider } from './OpacitySlider';
import { TransitionPicker } from './TransitionPicker';
import { PresetManager } from './PresetManager';
import { useDebounce } from '@/hooks/useDebounce';
import type { Clip, ClipProperties } from '@/types';
import { cn } from '@/lib/utils';

interface MediaDetailsPanelProps {
  className?: string;
}

// Default property values
const DEFAULT_PROPERTIES: ClipProperties = {
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
};

export const MediaDetailsPanel: React.FC<MediaDetailsPanelProps> = ({
  className,
}) => {
  const { selection, getClipById, updateClip } = useTimelineStore();

  // Track which sections are open
  const [openSections, setOpenSections] = useState({
    basic: true,
    transform: true,
    audio: true,
    effects: false,
  });

  // Local state for property values (for real-time preview)
  const [localProperties, setLocalProperties] = useState<ClipProperties | null>(null);

  // Track if we're in batch edit mode
  const isBatchMode = selection.clipIds.length > 1;

  // Get the first selected clip
  const selectedClip = selection.clipIds.length > 0
    ? getClipById(selection.clipIds[0])
    : null;

  // Animation frame for smooth updates
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Partial<ClipProperties> | null>(null);

  // Update local properties when selection changes
  useEffect(() => {
    if (selectedClip?.properties) {
      setLocalProperties(selectedClip.properties);
    } else if (selectedClip) {
      // Initialize with default properties if clip doesn't have them
      setLocalProperties(DEFAULT_PROPERTIES);
    } else {
      setLocalProperties(null);
    }
  }, [selectedClip]);

  // Debounced update function
  const debouncedUpdate = useDebounce((updates: Partial<ClipProperties>) => {
    if (isBatchMode) {
      // Update all selected clips
      selection.clipIds.forEach((clipId) => {
        const clip = getClipById(clipId);
        if (clip) {
          updateClip(clipId, {
            properties: {
              ...clip.properties,
              ...updates,
            },
          });
        }
      });
    } else if (selectedClip) {
      // Update single clip
      updateClip(selectedClip.id, {
        properties: {
          ...selectedClip.properties,
          ...updates,
        },
      });
    }
  }, 50);

  // Schedule property update using requestAnimationFrame for smooth updates
  const scheduleUpdate = useCallback((updates: Partial<ClipProperties>) => {
    pendingUpdateRef.current = {
      ...pendingUpdateRef.current,
      ...updates,
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingUpdateRef.current) {
          debouncedUpdate(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        rafRef.current = null;
      });
    }
  }, [debouncedUpdate]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Property update handlers
  const handlePropertyUpdate = useCallback((path: string, value: any) => {
    if (!localProperties) return;

    const pathParts = path.split('.');
    let updates: any = {};
    let current = updates;

    for (let i = 0; i < pathParts.length - 1; i++) {
      current[pathParts[i]] = { ...localProperties[pathParts[i] as keyof ClipProperties] };
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = value;

    // Update local state immediately for responsive UI
    setLocalProperties((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      let target: any = updated;
      for (let i = 0; i < pathParts.length - 1; i++) {
        target = target[pathParts[i]];
      }
      target[pathParts[pathParts.length - 1]] = value;
      return updated;
    });

    // Schedule debounced store update
    scheduleUpdate(updates);
  }, [localProperties, scheduleUpdate]);

  // Reset properties to defaults
  const handleReset = () => {
    if (isBatchMode) {
      selection.clipIds.forEach((clipId) => {
        updateClip(clipId, { properties: DEFAULT_PROPERTIES });
      });
    } else if (selectedClip) {
      updateClip(selectedClip.id, { properties: DEFAULT_PROPERTIES });
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!selectedClip || !localProperties) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Select a clip to view properties
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="flex-none">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {isBatchMode
              ? `Properties (${selection.clipIds.length} clips)`
              : 'Properties'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {/* Preset Manager */}
        <div className="pb-2 border-b">
          <PresetManager
            currentProperties={localProperties}
            onApplyPreset={(properties) => {
              if (isBatchMode) {
                selection.clipIds.forEach((clipId) => {
                  const clip = getClipById(clipId);
                  if (clip) {
                    updateClip(clipId, {
                      properties: {
                        ...clip.properties,
                        ...properties,
                      },
                    });
                  }
                });
              } else {
                updateClip(selectedClip.id, {
                  properties: {
                    ...selectedClip.properties,
                    ...properties,
                  },
                });
              }
              setLocalProperties((prev) => prev ? { ...prev, ...properties } : prev);
            }}
          />
        </div>

        {/* Basic Properties Section */}
        <Collapsible
          open={openSections.basic}
          onOpenChange={() => toggleSection('basic')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-accent rounded-md px-2">
            <span className="text-sm font-medium">Basic Properties</span>
            {openSections.basic ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2 px-2">
            <TimecodeInput
              value={selectedClip.startTime}
              onChange={(value) =>
                updateClip(selectedClip.id, { startTime: value })
              }
            />
            <TimecodeInput
              value={selectedClip.endTime}
              onChange={(value) =>
                updateClip(selectedClip.id, { endTime: value })
              }
            />
            <RangeSlider
              label="Speed"
              value={localProperties.speed}
              min={0.1}
              max={4}
              step={0.1}
              onChange={(value) => handlePropertyUpdate('speed', value)}
              unit="x"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Transform Properties Section */}
        <Collapsible
          open={openSections.transform}
          onOpenChange={() => toggleSection('transform')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-accent rounded-md px-2">
            <span className="text-sm font-medium">Transform Properties</span>
            {openSections.transform ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2 px-2">
            <DualSlider
              label="Position"
              valueX={localProperties.transform.position.x}
              valueY={localProperties.transform.position.y}
              min={-1000}
              max={1000}
              step={1}
              onChangeX={(value) =>
                handlePropertyUpdate('transform.position.x', value)
              }
              onChangeY={(value) =>
                handlePropertyUpdate('transform.position.y', value)
              }
              unit="px"
            />
            <DualSlider
              label="Scale"
              valueX={localProperties.transform.scale.x}
              valueY={localProperties.transform.scale.y}
              min={1}
              max={500}
              step={1}
              onChangeX={(value) =>
                handlePropertyUpdate('transform.scale.x', value)
              }
              onChangeY={(value) =>
                handlePropertyUpdate('transform.scale.y', value)
              }
              unit="%"
            />
            <NumericInput
              label="Rotation"
              value={localProperties.transform.rotation}
              min={-360}
              max={360}
              step={1}
              onChange={(value) =>
                handlePropertyUpdate('transform.rotation', value)
              }
              unit="°"
            />
            <OpacitySlider
              value={localProperties.transform.opacity}
              onChange={(value) =>
                handlePropertyUpdate('transform.opacity', value)
              }
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Audio Properties Section */}
        <Collapsible
          open={openSections.audio}
          onOpenChange={() => toggleSection('audio')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-accent rounded-md px-2">
            <span className="text-sm font-medium">Audio Properties</span>
            {openSections.audio ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2 px-2">
            {localProperties.audio && (
              <VolumeControl
                volume={localProperties.audio.volume}
                muted={localProperties.audio.muted}
                onVolumeChange={(value) =>
                  handlePropertyUpdate('audio.volume', value)
                }
                onMutedChange={(value) =>
                  handlePropertyUpdate('audio.muted', value)
                }
              />
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Effects Section */}
        <Collapsible
          open={openSections.effects}
          onOpenChange={() => toggleSection('effects')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-accent rounded-md px-2">
            <span className="text-sm font-medium">Effects</span>
            {openSections.effects ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2 px-2">
            {localProperties.transition && (
              <TransitionPicker
                type={localProperties.transition.type}
                duration={localProperties.transition.duration}
                onTypeChange={(value) =>
                  handlePropertyUpdate('transition.type', value)
                }
                onDurationChange={(value) =>
                  handlePropertyUpdate('transition.duration', value)
                }
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
