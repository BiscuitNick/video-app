import { useCallback } from 'react';

interface HapticsOptions {
  enabled?: boolean;
}

export const useHaptics = (options: HapticsOptions = {}) => {
  const { enabled = true } = options;

  /**
   * Trigger haptic feedback using the Vibration API
   * @param duration Duration in milliseconds (10-100ms recommended)
   * @param pattern Optional vibration pattern [duration, pause, duration, ...]
   */
  const vibrate = useCallback(
    (duration: number | number[]) => {
      if (!enabled) return;

      // Check if Vibration API is supported
      if (!('vibrate' in navigator)) {
        return;
      }

      try {
        navigator.vibrate(duration);
      } catch (error) {
        console.warn('Vibration API error:', error);
      }
    },
    [enabled]
  );

  /**
   * Cancel any ongoing vibration
   */
  const cancel = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  /**
   * Predefined haptic patterns
   */
  const patterns = {
    // Light tap (UI interactions)
    light: () => vibrate(10),

    // Medium tap (selections, toggles)
    medium: () => vibrate(15),

    // Strong tap (confirmations, important actions)
    strong: () => vibrate(20),

    // Error (something went wrong)
    error: () => vibrate([10, 50, 10, 50, 20]),

    // Success (action completed)
    success: () => vibrate([10, 50, 15]),

    // Warning (attention needed)
    warning: () => vibrate([15, 100, 15]),

    // Double tap
    doubleTap: () => vibrate([10, 50, 10]),

    // Long press acknowledged
    longPress: () => vibrate(30),
  };

  return {
    vibrate,
    cancel,
    patterns,
    isSupported: 'vibrate' in navigator,
  };
};
