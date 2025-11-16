import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Effect, FilterEffect, TextOverlayEffect } from '@/types/effects';

interface EffectPreviewProps {
  effect?: Effect;
  videoUrl?: string;
  width?: number;
  height?: number;
}

export const EffectPreview: React.FC<EffectPreviewProps> = ({
  effect,
  videoUrl,
  width = 320,
  height = 180,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Apply filter effects to the preview
  useEffect(() => {
    if (!effect || !videoRef.current) return;

    if (effect.type === 'filter') {
      const filterEffect = effect as FilterEffect;
      const filters: string[] = [];

      const params = filterEffect.parameters;

      if (params.brightness !== undefined && params.brightness !== 100) {
        filters.push(`brightness(${params.brightness}%)`);
      }
      if (params.contrast !== undefined && params.contrast !== 100) {
        filters.push(`contrast(${params.contrast}%)`);
      }
      if (params.saturation !== undefined && params.saturation !== 100) {
        filters.push(`saturate(${params.saturation}%)`);
      }
      if (params.hue !== undefined && params.hue !== 0) {
        filters.push(`hue-rotate(${params.hue}deg)`);
      }
      if (params.blur !== undefined && params.blur > 0) {
        filters.push(`blur(${params.blur}px)`);
      }
      if (params.grayscale !== undefined && params.grayscale > 0) {
        filters.push(`grayscale(${params.grayscale}%)`);
      }
      if (params.sepia !== undefined && params.sepia > 0) {
        filters.push(`sepia(${params.sepia}%)`);
      }
      if (params.invert !== undefined && params.invert > 0) {
        filters.push(`invert(${params.invert}%)`);
      }

      videoRef.current.style.filter = filters.join(' ');
    }
  }, [effect]);

  const getCSSFilter = (filterEffect?: FilterEffect): string => {
    if (!filterEffect) return '';

    const filters: string[] = [];
    const params = filterEffect.parameters;

    if (params.brightness !== undefined && params.brightness !== 100) {
      filters.push(`brightness(${params.brightness}%)`);
    }
    if (params.contrast !== undefined && params.contrast !== 100) {
      filters.push(`contrast(${params.contrast}%)`);
    }
    if (params.saturation !== undefined && params.saturation !== 100) {
      filters.push(`saturate(${params.saturation}%)`);
    }
    if (params.hue !== undefined && params.hue !== 0) {
      filters.push(`hue-rotate(${params.hue}deg)`);
    }
    if (params.blur !== undefined && params.blur > 0) {
      filters.push(`blur(${params.blur}px)`);
    }
    if (params.grayscale !== undefined && params.grayscale > 0) {
      filters.push(`grayscale(${params.grayscale}%)`);
    }
    if (params.sepia !== undefined && params.sepia > 0) {
      filters.push(`sepia(${params.sepia}%)`);
    }
    if (params.invert !== undefined && params.invert > 0) {
      filters.push(`invert(${params.invert}%)`);
    }

    return filters.join(' ');
  };

  const renderTextOverlay = (textEffect: TextOverlayEffect) => {
    const style = textEffect.style;
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${textEffect.position.x}%`,
          top: `${textEffect.position.y}%`,
          transform: 'translate(-50%, -50%)',
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize * 0.3}px`, // Scale down for preview
          color: style.color,
          backgroundColor: style.backgroundColor || 'transparent',
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textAlign: style.textAlign,
          padding: style.padding ? `${style.padding * 0.3}px` : undefined,
          borderRadius: style.borderRadius ? `${style.borderRadius * 0.3}px` : undefined,
          textShadow: style.textShadow
            ? `${style.textShadow.offsetX}px ${style.textShadow.offsetY}px ${style.textShadow.blur}px ${style.textShadow.color}`
            : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        {textEffect.text}
      </div>
    );
  };

  const getEffectDescription = (): string => {
    if (!effect) return 'No effect selected';

    switch (effect.type) {
      case 'transition':
        return `${effect.name} - ${effect.duration}s`;
      case 'filter':
        return 'Video filter applied';
      case 'textOverlay':
        return (effect as TextOverlayEffect).text;
      case 'transform':
        return `Transform with ${effect.keyframes.length} keyframes`;
      default:
        return effect.name;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Effect Preview</CardTitle>
        <CardDescription>{getEffectDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ width, height }}
        >
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-cover"
                style={{
                  filter: effect?.type === 'filter' ? getCSSFilter(effect as FilterEffect) : undefined,
                }}
                loop
                muted
                autoPlay
              />
              {effect?.type === 'textOverlay' && renderTextOverlay(effect as TextOverlayEffect)}
            </>
          ) : (
            <div className="text-center p-6">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-sm text-muted-foreground">
                Select a clip to preview effects
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
