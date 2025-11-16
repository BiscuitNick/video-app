import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';

interface UsePullToRefreshOptions {
  containerRef: RefObject<HTMLElement>;
  onRefresh: () => Promise<void>;
  threshold?: number; // Pull distance to trigger refresh
  enabled?: boolean;
}

export const usePullToRefresh = ({
  containerRef,
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || !containerRef.current) return;

    // Only start pull if scrolled to top
    if (containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  }, [enabled, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || !enabled) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;

    if (distance > 0) {
      // Pulling down
      e.preventDefault();

      // Apply resistance (diminishing returns)
      const resistance = 0.5;
      const adjustedDistance = distance * resistance;

      setIsPulling(true);
      setPullDistance(adjustedDistance);
    }
  }, [enabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current || !enabled) return;

    isDraggingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setIsRefreshing(false);
        setIsPulling(false);
        setPullDistance(0);
      });
    } else {
      // Cancel pull
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [enabled, pullDistance, threshold, isRefreshing, onRefresh]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
  };
};
