import React from 'react';
import type { SnapIndicator } from '@/lib/timeline/SnapManager';

interface SnapIndicatorsProps {
  indicators: SnapIndicator[];
  timelineHeight: number;
}

export const SnapIndicators: React.FC<SnapIndicatorsProps> = ({
  indicators,
  timelineHeight,
}) => {
  if (indicators.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {indicators.map((indicator, index) => (
        <div
          key={index}
          className="absolute top-0 w-px animate-pulse"
          style={{
            left: `${indicator.position}px`,
            height: `${timelineHeight}px`,
            backgroundColor: indicator.color,
            boxShadow: `0 0 4px ${indicator.color}`,
          }}
        />
      ))}
    </div>
  );
};
