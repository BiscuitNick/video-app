import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { FilterEffect } from '@/types/effects';

interface FilterParameters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  grayscale: number;
  sepia: number;
  invert: number;
}

const defaultFilters: FilterParameters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

interface FilterPreset {
  name: string;
  description: string;
  icon: string;
  filters: Partial<FilterParameters>;
}

const filterPresets: FilterPreset[] = [
  {
    name: 'None',
    description: 'Original video',
    icon: '🎬',
    filters: {},
  },
  {
    name: 'Vibrant',
    description: 'Boost colors and contrast',
    icon: '🌈',
    filters: {
      brightness: 110,
      contrast: 120,
      saturation: 130,
    },
  },
  {
    name: 'Vintage',
    description: 'Old film look',
    icon: '📽️',
    filters: {
      brightness: 95,
      contrast: 90,
      saturation: 80,
      sepia: 30,
    },
  },
  {
    name: 'Black & White',
    description: 'Grayscale filter',
    icon: '⚫⚪',
    filters: {
      grayscale: 100,
      contrast: 110,
    },
  },
  {
    name: 'Warm',
    description: 'Warm color tone',
    icon: '🔥',
    filters: {
      brightness: 105,
      saturation: 110,
      hue: 10,
    },
  },
  {
    name: 'Cool',
    description: 'Cool color tone',
    icon: '❄️',
    filters: {
      brightness: 95,
      saturation: 105,
      hue: 190,
    },
  },
];

interface FilterLibraryProps {
  onApplyFilter: (filter: Omit<FilterEffect, 'id' | 'enabled'>) => void;
  selectedClipId?: string;
  currentFilter?: FilterEffect;
}

export const FilterLibrary: React.FC<FilterLibraryProps> = ({
  onApplyFilter,
  selectedClipId,
  currentFilter,
}) => {
  const [filters, setFilters] = useState<FilterParameters>(
    currentFilter?.parameters
      ? { ...defaultFilters, ...currentFilter.parameters }
      : defaultFilters
  );

  const handleFilterChange = (key: keyof FilterParameters, value: number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetApply = (preset: FilterPreset) => {
    const newFilters = { ...defaultFilters, ...preset.filters };
    setFilters(newFilters);
  };

  const handleApply = () => {
    const filter: Omit<FilterEffect, 'id' | 'enabled'> = {
      type: 'filter',
      name: 'Video Filter',
      parameters: filters,
    };
    onApplyFilter(filter);
  };

  const handleReset = () => {
    setFilters(defaultFilters);
  };

  const hasChanges = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {selectedClipId
          ? 'Adjust filters for the selected clip'
          : 'Select a clip first to apply filters'}
      </div>

      {/* Presets */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Presets</h4>
        <div className="grid grid-cols-3 gap-2">
          {filterPresets.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              className="flex flex-col h-auto py-3 px-2"
              onClick={() => handlePresetApply(preset)}
              disabled={!selectedClipId}
            >
              <span className="text-xl mb-1">{preset.icon}</span>
              <span className="text-xs font-medium">{preset.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Controls</CardTitle>
          <CardDescription>Fine-tune individual parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Brightness */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Brightness</label>
              <span className="text-sm text-muted-foreground">{filters.brightness}%</span>
            </div>
            <Slider
              value={[filters.brightness]}
              onValueChange={(values) => handleFilterChange('brightness', values[0])}
              min={0}
              max={200}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Contrast</label>
              <span className="text-sm text-muted-foreground">{filters.contrast}%</span>
            </div>
            <Slider
              value={[filters.contrast]}
              onValueChange={(values) => handleFilterChange('contrast', values[0])}
              min={0}
              max={200}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Saturation</label>
              <span className="text-sm text-muted-foreground">{filters.saturation}%</span>
            </div>
            <Slider
              value={[filters.saturation]}
              onValueChange={(values) => handleFilterChange('saturation', values[0])}
              min={0}
              max={200}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Hue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Hue</label>
              <span className="text-sm text-muted-foreground">{filters.hue}°</span>
            </div>
            <Slider
              value={[filters.hue]}
              onValueChange={(values) => handleFilterChange('hue', values[0])}
              min={0}
              max={360}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Blur */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Blur</label>
              <span className="text-sm text-muted-foreground">{filters.blur}px</span>
            </div>
            <Slider
              value={[filters.blur]}
              onValueChange={(values) => handleFilterChange('blur', values[0])}
              min={0}
              max={10}
              step={0.5}
              disabled={!selectedClipId}
            />
          </div>

          {/* Grayscale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Grayscale</label>
              <span className="text-sm text-muted-foreground">{filters.grayscale}%</span>
            </div>
            <Slider
              value={[filters.grayscale]}
              onValueChange={(values) => handleFilterChange('grayscale', values[0])}
              min={0}
              max={100}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Sepia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Sepia</label>
              <span className="text-sm text-muted-foreground">{filters.sepia}%</span>
            </div>
            <Slider
              value={[filters.sepia]}
              onValueChange={(values) => handleFilterChange('sepia', values[0])}
              min={0}
              max={100}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Invert */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Invert</label>
              <span className="text-sm text-muted-foreground">{filters.invert}%</span>
            </div>
            <Slider
              value={[filters.invert]}
              onValueChange={(values) => handleFilterChange('invert', values[0])}
              min={0}
              max={100}
              step={1}
              disabled={!selectedClipId}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
              disabled={!selectedClipId || !hasChanges}
            >
              Reset
            </Button>
            <Button
              className="flex-1"
              onClick={handleApply}
              disabled={!selectedClipId}
            >
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
