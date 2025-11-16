import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TransitionEffect, TransitionType } from '@/types/effects';
import { Slider } from '@/components/ui/slider';

interface TransitionTemplate {
  type: TransitionType;
  name: string;
  description: string;
  icon: string;
}

const transitionTemplates: TransitionTemplate[] = [
  {
    type: 'fade-in',
    name: 'Fade In',
    description: 'Gradually appears from transparent',
    icon: '🌅',
  },
  {
    type: 'fade-out',
    name: 'Fade Out',
    description: 'Gradually disappears to transparent',
    icon: '🌆',
  },
  {
    type: 'crossfade',
    name: 'Crossfade',
    description: 'Smooth blend between clips',
    icon: '🔄',
  },
  {
    type: 'wipe-left',
    name: 'Wipe Left',
    description: 'Reveals from right to left',
    icon: '⬅️',
  },
  {
    type: 'wipe-right',
    name: 'Wipe Right',
    description: 'Reveals from left to right',
    icon: '➡️',
  },
  {
    type: 'wipe-up',
    name: 'Wipe Up',
    description: 'Reveals from bottom to top',
    icon: '⬆️',
  },
  {
    type: 'wipe-down',
    name: 'Wipe Down',
    description: 'Reveals from top to bottom',
    icon: '⬇️',
  },
  {
    type: 'zoom-in',
    name: 'Zoom In',
    description: 'Scales up from small',
    icon: '🔍',
  },
  {
    type: 'zoom-out',
    name: 'Zoom Out',
    description: 'Scales down to small',
    icon: '🔎',
  },
  {
    type: 'dissolve',
    name: 'Dissolve',
    description: 'Pixelated transition effect',
    icon: '✨',
  },
];

interface TransitionLibraryProps {
  onApplyTransition: (transition: Omit<TransitionEffect, 'id' | 'enabled'>) => void;
  selectedClipId?: string;
}

export const TransitionLibrary: React.FC<TransitionLibraryProps> = ({
  onApplyTransition,
  selectedClipId,
}) => {
  const [selectedTransition, setSelectedTransition] = useState<TransitionType | null>(null);
  const [duration, setDuration] = useState(1.0);
  const [easing, setEasing] = useState<'linear' | 'easeIn' | 'easeOut' | 'easeInOut'>('easeInOut');

  const handleApply = (type: TransitionType) => {
    const transition: Omit<TransitionEffect, 'id' | 'enabled'> = {
      type: 'transition',
      name: transitionTemplates.find((t) => t.type === type)?.name || 'Transition',
      transitionType: type,
      duration,
      easing,
    };

    onApplyTransition(transition);
    setSelectedTransition(null);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {selectedClipId
          ? 'Select a transition to apply to the selected clip'
          : 'Select a clip first to apply transitions'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {transitionTemplates.map((template) => (
          <Card
            key={template.type}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
              selectedTransition === template.type && 'border-primary shadow-md',
              !selectedClipId && 'opacity-50 pointer-events-none'
            )}
            onClick={() => setSelectedTransition(template.type)}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{template.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate">{template.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTransition && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-base">Transition Settings</CardTitle>
            <CardDescription>
              Customize {transitionTemplates.find((t) => t.type === selectedTransition)?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              value={[duration]}
              onValueChange={(values) => setDuration(values[0])}
              min={0.1}
              max={5}
              step={0.1}
              className="w-full"
            />
            <div className="text-sm text-muted-foreground">
              Duration: {duration.toFixed(1)}s
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Easing</label>
              <div className="grid grid-cols-2 gap-2">
                {(['linear', 'easeIn', 'easeOut', 'easeInOut'] as const).map((easingType) => (
                  <Button
                    key={easingType}
                    variant={easing === easingType ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEasing(easingType)}
                  >
                    {easingType}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => handleApply(selectedTransition)}
            >
              Apply Transition
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
