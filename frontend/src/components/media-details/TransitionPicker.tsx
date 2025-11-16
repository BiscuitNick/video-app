import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { NumericInput } from './NumericInput';
import { cn } from '@/lib/utils';

type TransitionType = 'fade' | 'dissolve' | 'wipe' | 'none';

interface TransitionPickerProps {
  type: TransitionType;
  duration: number;
  onTypeChange: (type: TransitionType) => void;
  onDurationChange: (duration: number) => void;
  className?: string;
  disabled?: boolean;
}

const transitionOptions: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'wipe', label: 'Wipe' },
];

export const TransitionPicker: React.FC<TransitionPickerProps> = ({
  type,
  duration,
  onTypeChange,
  onDurationChange,
  className,
  disabled = false,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">Transition</Label>
      <div className="space-y-2">
        <Select value={type} onValueChange={onTypeChange} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {transitionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type !== 'none' && (
          <NumericInput
            label="Duration"
            value={duration}
            min={0}
            max={5}
            step={0.1}
            onChange={onDurationChange}
            unit="s"
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};
