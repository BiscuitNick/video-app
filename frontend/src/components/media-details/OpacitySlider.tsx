import React from 'react';
import { RangeSlider } from './RangeSlider';
import { cn } from '@/lib/utils';

interface OpacitySliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export const OpacitySlider: React.FC<OpacitySliderProps> = ({
  value,
  onChange,
  className,
  disabled = false,
}) => {
  return (
    <RangeSlider
      label="Opacity"
      value={value}
      min={0}
      max={100}
      step={1}
      onChange={onChange}
      unit="%"
      className={className}
      disabled={disabled}
    />
  );
};
