import { useEffect, useState, useRef, type RefObject } from 'react';

interface UseInfiniteScrollOptions {
  containerRef: RefObject<HTMLElement>;
  onLoadMore: () => Promise<void>;
  threshold?: number; // Distance from bottom in pixels
  enabled?: boolean;
}

export const useInfiniteScroll = ({
  containerRef,
  onLoadMore,
  threshold = 200,
  enabled = true,
}: UseInfiniteScrollOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Create a sentinel element at the bottom
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    sentinel.style.marginTop = `-${threshold}px`;
    sentinelRef.current = sentinel;

    containerRef.current.appendChild(sentinel);

    // Set up Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && !isLoading) {
          setIsLoading(true);
          onLoadMore().finally(() => {
            setIsLoading(false);
          });
        }
      },
      {
        root: containerRef.current,
        rootMargin: `${threshold}px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (sentinelRef.current && containerRef.current) {
        containerRef.current.removeChild(sentinelRef.current);
      }
    };
  }, [enabled, containerRef, onLoadMore, threshold, isLoading]);

  return { isLoading };
};
