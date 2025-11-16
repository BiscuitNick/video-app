import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransitionLibrary } from './TransitionLibrary';
import { FilterLibrary } from './FilterLibrary';
import { TextOverlayCreator } from './TextOverlayCreator';
import { EffectPreview } from './EffectPreview';
import { EffectProperties } from './EffectProperties';
import { useTimelineStore } from '@/stores/useTimelineStore';
import type {
  Effect,
  TransitionEffect,
  FilterEffect,
  TextOverlayEffect,
} from '@/types/effects';

interface EffectsPanelProps {
  className?: string;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ className }) => {
  const [selectedTab, setSelectedTab] = useState('transitions');
  const [selectedEffectId, setSelectedEffectId] = useState<string | undefined>();

  // Get selected clip from timeline store
  const selection = useTimelineStore((state) => state.selection);
  const getClipById = useTimelineStore((state) => state.getClipById);
  const updateClip = useTimelineStore((state) => state.updateClip);

  const selectedClipId = selection.clipIds[0];
  const selectedClip = selectedClipId ? getClipById(selectedClipId) : undefined;
  const clipEffects = selectedClip?.effects || [];

  // Generate unique effect ID
  const generateEffectId = (): string => {
    return `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add effect to selected clip
  const handleAddEffect = (effect: Omit<Effect, 'id' | 'enabled'>) => {
    if (!selectedClipId) return;

    const newEffect: Effect = {
      ...effect,
      id: generateEffectId(),
      enabled: true,
    };

    const currentEffects = selectedClip?.effects || [];
    updateClip(selectedClipId, {
      effects: [...currentEffects, newEffect],
    });
  };

  // Apply transition
  const handleApplyTransition = (transition: Omit<TransitionEffect, 'id' | 'enabled'>) => {
    handleAddEffect(transition);
  };

  // Apply filter
  const handleApplyFilter = (filter: Omit<FilterEffect, 'id' | 'enabled'>) => {
    // Replace existing filter if one exists
    if (!selectedClipId) return;

    const currentEffects = selectedClip?.effects || [];
    const existingFilterIndex = currentEffects.findIndex((e) => e.type === 'filter');

    if (existingFilterIndex >= 0) {
      // Replace existing filter
      const newEffects = [...currentEffects];
      newEffects[existingFilterIndex] = {
        ...filter,
        id: currentEffects[existingFilterIndex].id,
        enabled: true,
      };
      updateClip(selectedClipId, { effects: newEffects });
    } else {
      // Add new filter
      handleAddEffect(filter);
    }
  };

  // Apply text overlay
  const handleApplyText = (textOverlay: Omit<TextOverlayEffect, 'id' | 'enabled'>) => {
    handleAddEffect(textOverlay);
  };

  // Delete effect
  const handleDeleteEffect = (effectId: string) => {
    if (!selectedClipId) return;

    const currentEffects = selectedClip?.effects || [];
    updateClip(selectedClipId, {
      effects: currentEffects.filter((e) => e.id !== effectId),
    });

    if (selectedEffectId === effectId) {
      setSelectedEffectId(undefined);
    }
  };

  // Toggle effect enabled/disabled
  const handleToggleEffect = (effectId: string) => {
    if (!selectedClipId) return;

    const currentEffects = selectedClip?.effects || [];
    updateClip(selectedClipId, {
      effects: currentEffects.map((e) =>
        e.id === effectId ? { ...e, enabled: !e.enabled } : e
      ),
    });
  };

  // Get current filter for editing
  const currentFilter = clipEffects.find((e) => e.type === 'filter') as
    | FilterEffect
    | undefined;

  // Get clip duration (mock for now, should come from media asset)
  const clipDuration = selectedClip
    ? selectedClip.endTime - selectedClip.startTime
    : 5;

  // Get video URL for preview (would need to fetch from media library)
  const videoUrl = selectedClip ? undefined : undefined; // TODO: Get from media library

  return (
    <div className={className}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Effects & Transitions</CardTitle>
          <CardDescription>
            {selectedClipId
              ? `Editing clip with ${clipEffects.length} effect(s)`
              : 'Select a clip to add effects'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview */}
          <EffectPreview
            effect={
              selectedEffectId
                ? clipEffects.find((e) => e.id === selectedEffectId)
                : clipEffects.find((e) => e.enabled)
            }
            videoUrl={videoUrl}
            width={320}
            height={180}
          />

          {/* Tabs for different effect types */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transitions">Transitions</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>

            <TabsContent value="transitions" className="space-y-4">
              <TransitionLibrary
                onApplyTransition={handleApplyTransition}
                selectedClipId={selectedClipId}
              />
            </TabsContent>

            <TabsContent value="filters" className="space-y-4">
              <FilterLibrary
                onApplyFilter={handleApplyFilter}
                selectedClipId={selectedClipId}
                currentFilter={currentFilter}
              />
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <TextOverlayCreator
                onApplyText={handleApplyText}
                selectedClipId={selectedClipId}
                clipDuration={clipDuration}
              />
            </TabsContent>
          </Tabs>

          {/* Applied Effects */}
          <EffectProperties
            effects={clipEffects}
            selectedEffectId={selectedEffectId}
            onSelectEffect={setSelectedEffectId}
            onDeleteEffect={handleDeleteEffect}
            onToggleEffect={handleToggleEffect}
          />
        </CardContent>
      </Card>
    </div>
  );
};
