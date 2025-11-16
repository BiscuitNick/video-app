import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface NumericInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  className?: string;
  disabled?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
  className,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    let numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      if (min !== undefined) {
        numValue = Math.max(min, numValue);
      }
      if (max !== undefined) {
        numValue = Math.min(max, numValue);
      }
      setInputValue(String(numValue));
      onChange(numValue);
    } else {
      setInputValue(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setInputValue(String(value));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = value + step;
      const clampedValue = max !== undefined ? Math.min(max, newValue) : newValue;
      onChange(clampedValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = value - step;
      const clampedValue = min !== undefined ? Math.max(min, newValue) : newValue;
      onChange(clampedValue);
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="h-6 w-20 text-xs text-right"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
};
