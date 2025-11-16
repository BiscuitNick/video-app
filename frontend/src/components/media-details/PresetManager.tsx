import React, { useState } from 'react';
import { usePresetStore } from '@/stores/usePresetStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Save, Trash2 } from 'lucide-react';
import type { ClipProperties } from '@/types';
import { cn } from '@/lib/utils';

interface PresetManagerProps {
  currentProperties: ClipProperties;
  onApplyPreset: (properties: Partial<ClipProperties>) => void;
  className?: string;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  currentProperties,
  onApplyPreset,
  className,
}) => {
  const { presets, addPreset, deletePreset } = usePresetStore();
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      addPreset(newPresetName.trim(), currentProperties);
      setNewPresetName('');
      setIsDialogOpen(false);
    }
  };

  const handleApplyPreset = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (preset) {
      onApplyPreset(preset.properties);
    }
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePreset(id);
    if (selectedPresetId === id) {
      setSelectedPresetId('');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">Presets</Label>
      <div className="flex gap-2">
        <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Select preset..." />
          </SelectTrigger>
          <SelectContent>
            {presets.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No presets saved
              </div>
            ) : (
              presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{preset.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      className="h-5 w-5 p-0 ml-2"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleApplyPreset}
          disabled={!selectedPresetId}
          className="h-8"
        >
          Apply
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full h-8">
            <Save className="h-3 w-3 mr-1" />
            Save Current as Preset
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription>
              Save the current property values as a preset for reuse.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g., Zoom In Effect"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePreset();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSavePreset}
              disabled={!newPresetName.trim()}
            >
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
