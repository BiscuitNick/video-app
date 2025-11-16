import { useState, useEffect, useCallback } from 'react';

export type OrientationType = 'portrait' | 'landscape';

interface UseOrientationOptions {
  onOrientationChange?: (orientation: OrientationType) => void;
  persistLayout?: boolean;
  storageKey?: string;
}

export const useOrientation = (options: UseOrientationOptions = {}) => {
  const {
    onOrientationChange,
    persistLayout = true,
    storageKey = 'app-orientation-layout',
  } = options;

  const [orientation, setOrientation] = useState<OrientationType>(() => {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  const [isLocked, setIsLocked] = useState(false);

  // Detect orientation change
  const handleOrientationChange = useCallback(() => {
    const newOrientation: OrientationType =
      window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

    if (newOrientation !== orientation) {
      setOrientation(newOrientation);
      onOrientationChange?.(newOrientation);

      // Persist layout if enabled
      if (persistLayout) {
        try {
          const savedLayouts = JSON.parse(
            localStorage.getItem(storageKey) || '{}'
          );
          savedLayouts[newOrientation] = {
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(savedLayouts));
        } catch (error) {
          console.warn('Failed to persist layout:', error);
        }
      }
    }
  }, [orientation, onOrientationChange, persistLayout, storageKey]);

  // Lock screen orientation
  const lockOrientation = useCallback(async (lockType: OrientationType) => {
    if (!('orientation' in screen) || !('lock' in screen.orientation)) {
      console.warn('Screen Orientation API not supported');
      return false;
    }

    try {
      const lockMode =
        lockType === 'portrait' ? 'portrait-primary' : 'landscape-primary';

      await screen.orientation.lock(lockMode as OrientationLockType);
      setIsLocked(true);
      return true;
    } catch (error) {
      console.warn('Failed to lock orientation:', error);
      return false;
    }
  }, []);

  // Unlock screen orientation
  const unlockOrientation = useCallback(() => {
    if (!('orientation' in screen) || !('unlock' in screen.orientation)) {
      console.warn('Screen Orientation API not supported');
      return;
    }

    try {
      screen.orientation.unlock();
      setIsLocked(false);
    } catch (error) {
      console.warn('Failed to unlock orientation:', error);
    }
  }, []);

  // Get saved layout
  const getSavedLayout = useCallback(
    (forOrientation?: OrientationType) => {
      if (!persistLayout) return null;

      try {
        const savedLayouts = JSON.parse(
          localStorage.getItem(storageKey) || '{}'
        );
        return savedLayouts[forOrientation || orientation] || null;
      } catch (error) {
        console.warn('Failed to get saved layout:', error);
        return null;
      }
    },
    [persistLayout, storageKey, orientation]
  );

  // Clear saved layouts
  const clearSavedLayouts = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear saved layouts:', error);
    }
  }, [storageKey]);

  // Listen for orientation changes
  useEffect(() => {
    // Try using Screen Orientation API first
    if ('orientation' in screen && 'addEventListener' in screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);

      return () => {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      };
    }

    // Fallback to window resize
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [handleOrientationChange]);

  return {
    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    isLocked,
    lockOrientation,
    unlockOrientation,
    getSavedLayout,
    clearSavedLayouts,
    isOrientationApiSupported:
      'orientation' in screen && 'lock' in screen.orientation,
  };
};
