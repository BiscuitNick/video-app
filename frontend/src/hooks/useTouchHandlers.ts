import { useState, useCallback, useRef, type RefObject } from 'react';

interface UseTouchHandlersOptions {
  containerRef: RefObject<HTMLElement>;
  onZoomChange?: (scale: number) => void;
  enableMomentumScroll?: boolean;
  enablePinchZoom?: boolean;
  velocityThreshold?: number;
  decelerationRate?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export const useTouchHandlers = ({
  containerRef,
  onZoomChange,
  enableMomentumScroll = true,
  enablePinchZoom = true,
  velocityThreshold = 0.5,
  decelerationRate = 0.95,
}: UseTouchHandlersOptions) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scale, setScale] = useState(1);

  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchPrevRef = useRef<TouchPoint | null>(null);
  const initialPinchDistanceRef = useRef<number>(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const momentumFrameRef = useRef<number | null>(null);
  const isTwoFingerRef = useRef(false);

  // Calculate distance between two touch points
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get average position of two touches
  const getTouchCenter = (touch1: Touch, touch2: Touch): TouchPoint => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
      timestamp: Date.now(),
    };
  };

  // Momentum scroll animation
  const animateMomentum = useCallback(() => {
    if (!containerRef.current) return;

    const speed = Math.sqrt(
      velocityRef.current.x ** 2 + velocityRef.current.y ** 2
    );

    if (speed < velocityThreshold) {
      momentumFrameRef.current = null;
      return;
    }

    // Apply deceleration
    velocityRef.current.x *= decelerationRate;
    velocityRef.current.y *= decelerationRate;

    // Update scroll position
    const newScrollLeft = containerRef.current.scrollLeft - velocityRef.current.x;
    containerRef.current.scrollLeft = newScrollLeft;
    setScrollOffset(newScrollLeft);

    // Continue animation
    momentumFrameRef.current = requestAnimationFrame(animateMomentum);
  }, [containerRef, velocityThreshold, decelerationRate]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      // Cancel any ongoing momentum
      if (momentumFrameRef.current !== null) {
        cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
      }

      velocityRef.current = { x: 0, y: 0 };

      if (e.touches.length === 1) {
        // Single touch - prepare for scroll
        isTwoFingerRef.current = false;
        const touch = e.touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          timestamp: Date.now(),
        };
        touchPrevRef.current = touchStartRef.current;
      } else if (e.touches.length === 2 && enablePinchZoom) {
        // Two touches - prepare for pinch zoom
        isTwoFingerRef.current = true;
        initialPinchDistanceRef.current = getTouchDistance(
          e.touches[0],
          e.touches[1]
        );
        touchStartRef.current = getTouchCenter(e.touches[0], e.touches[1]);
        touchPrevRef.current = touchStartRef.current;
      }
    },
    [enablePinchZoom]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!containerRef.current || !touchPrevRef.current) return;

      const now = Date.now();
      const timeDelta = now - touchPrevRef.current.timestamp;

      if (e.touches.length === 1 && !isTwoFingerRef.current) {
        // Single touch scroll
        const touch = e.touches[0];
        const deltaX = touchPrevRef.current.x - touch.clientX;
        const deltaY = touchPrevRef.current.y - touch.clientY;

        // Calculate velocity for momentum
        if (timeDelta > 0) {
          velocityRef.current.x = deltaX / timeDelta * 16; // Normalize to 60fps
          velocityRef.current.y = deltaY / timeDelta * 16;
        }

        // Update scroll position
        const newScrollLeft = containerRef.current.scrollLeft + deltaX;
        containerRef.current.scrollLeft = newScrollLeft;
        setScrollOffset(newScrollLeft);

        touchPrevRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          timestamp: now,
        };
      } else if (e.touches.length === 2 && isTwoFingerRef.current && enablePinchZoom) {
        // Two-finger operations
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);

        // Check if this is a pinch (distance change) or a two-finger drag
        const distanceChange = Math.abs(currentDistance - initialPinchDistanceRef.current);
        const centerMovement = Math.sqrt(
          Math.pow(center.x - touchPrevRef.current.x, 2) +
          Math.pow(center.y - touchPrevRef.current.y, 2)
        );

        if (distanceChange > 10) {
          // Pinch to zoom
          e.preventDefault();
          const scaleChange = currentDistance / initialPinchDistanceRef.current;
          setScale(scaleChange);
          onZoomChange?.(scaleChange);
          initialPinchDistanceRef.current = currentDistance;
        } else if (centerMovement > 5) {
          // Two-finger drag for scrubbing
          const deltaX = touchPrevRef.current.x - center.x;
          const newScrollLeft = containerRef.current.scrollLeft + deltaX;
          containerRef.current.scrollLeft = newScrollLeft;
          setScrollOffset(newScrollLeft);
        }

        touchPrevRef.current = center;
      }
    },
    [containerRef, enablePinchZoom, onZoomChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length === 0) {
        // All touches ended
        if (enableMomentumScroll && !isTwoFingerRef.current) {
          // Start momentum scroll
          const speed = Math.sqrt(
            velocityRef.current.x ** 2 + velocityRef.current.y ** 2
          );

          if (speed > velocityThreshold) {
            momentumFrameRef.current = requestAnimationFrame(animateMomentum);
          }
        }

        touchStartRef.current = null;
        touchPrevRef.current = null;
        isTwoFingerRef.current = false;
      } else if (e.touches.length === 1) {
        // One finger lifted during two-finger gesture
        isTwoFingerRef.current = false;
        const touch = e.touches[0];
        touchPrevRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          timestamp: Date.now(),
        };
      }
    },
    [enableMomentumScroll, velocityThreshold, animateMomentum]
  );

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    scrollOffset,
    scale,
  };
};
