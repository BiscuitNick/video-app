import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VolumeControlProps {
  volume: number; // 0-100
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
  className,
  disabled = false,
}) => {
  const handleVolumeChange = (values: number[]) => {
    onVolumeChange(values[0]);
    if (muted && values[0] > 0) {
      onMutedChange(false);
    }
  };

  const handleMuteToggle = () => {
    onMutedChange(!muted);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Volume</Label>
        <span className="text-xs text-muted-foreground">{volume}%</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMuteToggle}
          disabled={disabled}
          className="h-8 w-8 p-0"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[muted ? 0 : volume]}
          onValueChange={handleVolumeChange}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          className="flex-1"
        />
      </div>
    </div>
  );
};
