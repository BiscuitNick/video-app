import React from 'react';
import { NumericInput } from './NumericInput';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface DualSliderProps {
  label: string;
  valueX: number;
  valueY: number;
  min?: number;
  max?: number;
  step?: number;
  onChangeX: (value: number) => void;
  onChangeY: (value: number) => void;
  unit?: string;
  className?: string;
  disabled?: boolean;
}

export const DualSlider: React.FC<DualSliderProps> = ({
  label,
  valueX,
  valueY,
  min,
  max,
  step = 1,
  onChangeX,
  onChangeY,
  unit = '',
  className,
  disabled = false,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <NumericInput
          label="X"
          value={valueX}
          min={min}
          max={max}
          step={step}
          onChange={onChangeX}
          unit={unit}
          disabled={disabled}
        />
        <NumericInput
          label="Y"
          value={valueY}
          min={min}
          max={max}
          step={step}
          onChange={onChangeY}
          unit={unit}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
