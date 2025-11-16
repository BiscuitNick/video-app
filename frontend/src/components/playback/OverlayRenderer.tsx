import React, { memo, useMemo } from 'react';
import type { OverlayConfig } from './types';

interface OverlayRendererProps {
  overlays: OverlayConfig[];
  currentTime: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * OverlayRenderer renders text and image overlays on top of video
 * Uses absolute positioning and CSS transforms for optimal performance
 * Memoized to prevent unnecessary re-renders
 */
export const OverlayRenderer = memo<OverlayRendererProps>(({
  overlays,
  currentTime,
  containerWidth,
  containerHeight,
}) => {
  // Filter overlays that should be visible at current time
  const activeOverlays = useMemo(() => {
    return overlays.filter(
      (overlay) => currentTime >= overlay.startTime && currentTime < overlay.endTime
    );
  }, [overlays, currentTime]);

  // Sort by z-index for proper layering
  const sortedOverlays = useMemo(() => {
    return [...activeOverlays].sort((a, b) => {
      const zIndexA = a.zIndex ?? 0;
      const zIndexB = b.zIndex ?? 0;
      return zIndexA - zIndexB;
    });
  }, [activeOverlays]);

  return (
    <div
      className="overlay-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {sortedOverlays.map((overlay) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${overlay.position.x}%`,
          top: `${overlay.position.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: overlay.zIndex ?? 0,
          opacity: overlay.style?.opacity ?? 1,
        };

        if (overlay.type === 'text') {
          return (
            <TextOverlay
              key={overlay.id}
              overlay={overlay}
              style={style}
            />
          );
        } else {
          return (
            <ImageOverlay
              key={overlay.id}
              overlay={overlay}
              style={style}
            />
          );
        }
      })}
    </div>
  );
});

OverlayRenderer.displayName = 'OverlayRenderer';

/**
 * TextOverlay renders text with customizable styling
 */
const TextOverlay = memo<{
  overlay: OverlayConfig;
  style: React.CSSProperties;
}>(({ overlay, style }) => {
  const textStyle: React.CSSProperties = {
    ...style,
    fontFamily: overlay.style?.fontFamily ?? 'Arial, sans-serif',
    fontSize: `${overlay.style?.fontSize ?? 24}px`,
    color: overlay.style?.color ?? '#ffffff',
    backgroundColor: overlay.style?.backgroundColor ?? 'transparent',
    textShadow: overlay.style?.textShadow ?? '2px 2px 4px rgba(0, 0, 0, 0.8)',
    padding: '8px 16px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  return (
    <div style={textStyle}>
      {overlay.content}
    </div>
  );
});

TextOverlay.displayName = 'TextOverlay';

/**
 * ImageOverlay renders images
 */
const ImageOverlay = memo<{
  overlay: OverlayConfig;
  style: React.CSSProperties;
}>(({ overlay, style }) => {
  const imageStyle: React.CSSProperties = {
    ...style,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  };

  return (
    <img
      src={overlay.content}
      alt=""
      style={imageStyle}
      draggable={false}
    />
  );
});

ImageOverlay.displayName = 'ImageOverlay';
