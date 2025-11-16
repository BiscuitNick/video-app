import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Effect, FilterEffect, TextOverlayEffect, TransitionEffect } from '@/types/effects';

interface EffectPropertiesProps {
  effects: Effect[];
  selectedEffectId?: string;
  onSelectEffect: (effectId: string) => void;
  onDeleteEffect: (effectId: string) => void;
  onToggleEffect: (effectId: string) => void;
}

export const EffectProperties: React.FC<EffectPropertiesProps> = ({
  effects,
  selectedEffectId,
  onSelectEffect,
  onDeleteEffect,
  onToggleEffect,
}) => {
  if (effects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Effect Properties</CardTitle>
          <CardDescription>No effects applied</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm">Add effects from the tabs above</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderEffectDetails = (effect: Effect) => {
    switch (effect.type) {
      case 'transition':
        const transition = effect as TransitionEffect;
        return (
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span>{transition.transitionType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span>{transition.duration}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Easing:</span>
              <span>{transition.easing}</span>
            </div>
          </div>
        );

      case 'filter':
        const filter = effect as FilterEffect;
        const activeFilters = Object.entries(filter.parameters)
          .filter(([_, value]) => {
            if (typeof value === 'number') {
              // Check if value is different from default
              if (_ === 'brightness' || _ === 'contrast' || _ === 'saturation') {
                return value !== 100;
              }
              return value !== 0;
            }
            return false;
          })
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');

        return (
          <div className="text-xs">
            <span className="text-muted-foreground">Active: </span>
            <span>{activeFilters || 'None'}</span>
          </div>
        );

      case 'textOverlay':
        const text = effect as TextOverlayEffect;
        return (
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Text:</span>
              <span className="truncate max-w-[150px]">{text.text}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span>
                ({text.position.x}%, {text.position.y}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span>{text.duration}s</span>
            </div>
            {text.animation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animation:</span>
                <span>{text.animation.type}</span>
              </div>
            )}
          </div>
        );

      case 'transform':
        return (
          <div className="text-xs">
            <span className="text-muted-foreground">Keyframes: </span>
            <span>{effect.keyframes.length}</span>
          </div>
        );

      default:
        return null;
    }
  };

  const getEffectIcon = (effect: Effect): string => {
    switch (effect.type) {
      case 'transition':
        return '🔄';
      case 'filter':
        return '🎨';
      case 'textOverlay':
        return '📝';
      case 'transform':
        return '🔀';
      default:
        return '✨';
    }
  };

  const getEffectTypeName = (effect: Effect): string => {
    switch (effect.type) {
      case 'transition':
        return 'Transition';
      case 'filter':
        return 'Filter';
      case 'textOverlay':
        return 'Text Overlay';
      case 'transform':
        return 'Transform';
      default:
        return 'Effect';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Effect Properties</CardTitle>
        <CardDescription>{effects.length} effect(s) applied</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {effects.map((effect) => (
          <Card
            key={effect.id}
            className={`cursor-pointer transition-all ${
              selectedEffectId === effect.id
                ? 'border-primary shadow-md'
                : 'hover:border-primary/50'
            } ${!effect.enabled ? 'opacity-50' : ''}`}
            onClick={() => onSelectEffect(effect.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getEffectIcon(effect)}</span>
                  <div>
                    <h4 className="text-sm font-semibold">{effect.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {getEffectTypeName(effect)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEffect(effect.id);
                    }}
                  >
                    {effect.enabled ? '👁️' : '👁️‍🗨️'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEffect(effect.id);
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
              {renderEffectDetails(effect)}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
