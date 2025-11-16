import React from 'react';
import { Lock, Unlock, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrientation, type OrientationType } from '@/hooks/useOrientation';
import { useHaptics } from '@/hooks/useHaptics';

interface OrientationLockProps {
  className?: string;
  showIndicator?: boolean;
}

export const OrientationLock: React.FC<OrientationLockProps> = ({
  className,
  showIndicator = true,
}) => {
  const {
    orientation,
    isLocked,
    lockOrientation,
    unlockOrientation,
    isOrientationApiSupported,
  } = useOrientation();

  const { patterns } = useHaptics();

  const handleToggleLock = async () => {
    if (isLocked) {
      unlockOrientation();
      patterns.medium();
    } else {
      const success = await lockOrientation(orientation);
      if (success) {
        patterns.strong();
      } else {
        patterns.error();
      }
    }
  };

  if (!isOrientationApiSupported) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={handleToggleLock}
        className={cn(
          'touch-target-min flex items-center gap-2 px-3 py-2 rounded-lg',
          'transition-colors',
          isLocked
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
        )}
        aria-label={isLocked ? 'Unlock orientation' : 'Lock orientation'}
      >
        {isLocked ? (
          <Lock className="w-4 h-4" />
        ) : (
          <Unlock className="w-4 h-4" />
        )}
        {showIndicator && (
          <span className="mobile-text-xs font-medium">
            {isLocked ? 'Locked' : 'Lock'}
          </span>
        )}
      </button>
    </div>
  );
};

// Orientation Warning Component
interface OrientationWarningProps {
  preferredOrientation: OrientationType;
  message?: string;
  className?: string;
}

export const OrientationWarning: React.FC<OrientationWarningProps> = ({
  preferredOrientation,
  message,
  className,
}) => {
  const { orientation } = useOrientation();

  if (orientation === preferredOrientation) {
    return null;
  }

  const defaultMessage =
    preferredOrientation === 'landscape'
      ? 'For the best experience, please rotate your device to landscape mode'
      : 'For the best experience, please rotate your device to portrait mode';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-zinc-900 p-8',
        className
      )}
    >
      <div className="text-center">
        <RotateCw className="w-16 h-16 text-zinc-400 mx-auto mb-4 animate-spin-slow" />
        <p className="mobile-text-lg text-zinc-200 font-medium mb-2">
          {message || defaultMessage}
        </p>
        <p className="mobile-text-sm text-zinc-400">
          Current: {orientation}
        </p>
      </div>
    </div>
  );
};
