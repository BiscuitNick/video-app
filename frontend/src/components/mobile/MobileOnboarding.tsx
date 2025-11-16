import React, { useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface OnboardingStep {
  title: string;
  description: string;
  illustration?: React.ReactNode;
  image?: string;
}

interface MobileOnboardingProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip?: () => void;
  className?: string;
  showSkip?: boolean;
  storageKey?: string;
}

export const MobileOnboarding: React.FC<MobileOnboardingProps> = ({
  steps,
  onComplete,
  onSkip,
  className,
  showSkip = true,
  storageKey = 'mobile-onboarding-completed',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { patterns } = useHaptics();

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  // Handle next step
  const handleNext = useCallback(() => {
    if (isLastStep) {
      patterns.success();
      try {
        localStorage.setItem(storageKey, 'true');
      } catch (error) {
        console.warn('Failed to save onboarding state:', error);
      }
      onComplete();
    } else {
      patterns.medium();
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [isLastStep, steps.length, onComplete, patterns, storageKey]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    patterns.light();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [patterns]);

  // Handle skip
  const handleSkip = useCallback(() => {
    patterns.medium();
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (error) {
      console.warn('Failed to save onboarding state:', error);
    }
    onSkip?.();
    onComplete();
  }, [onSkip, onComplete, patterns, storageKey]);

  // Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe threshold
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next
        handleNext();
      } else {
        // Swipe right - previous
        if (currentStep > 0) {
          handlePrevious();
        }
      }
    }

    setTouchStart(null);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-zinc-900 safe-top safe-bottom',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={cn(
              'touch-target-min p-2',
              currentStep === 0
                ? 'opacity-0 pointer-events-none'
                : 'text-zinc-400 active:text-zinc-200'
            )}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex gap-1.5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === currentStep
                    ? 'w-8 bg-blue-500'
                    : index < currentStep
                    ? 'w-1.5 bg-blue-500/50'
                    : 'w-1.5 bg-zinc-700'
                )}
              />
            ))}
          </div>

          {showSkip && !isLastStep && (
            <button
              onClick={handleSkip}
              className="touch-target-min mobile-text-sm text-zinc-400 active:text-zinc-200"
            >
              Skip
            </button>
          )}
          {isLastStep && <div className="w-12" />}
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 flex flex-col items-center justify-center px-6 text-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Illustration */}
          <div className="mb-8 w-full max-w-xs aspect-square flex items-center justify-center">
            {step.illustration ? (
              step.illustration
            ) : step.image ? (
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 rounded-2xl flex items-center justify-center">
                <span className="text-6xl">📱</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="mobile-text-2xl font-bold text-zinc-100 mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="mobile-text-base text-zinc-400 max-w-md">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleNext}
            className={cn(
              'w-full touch-target py-4 rounded-xl font-semibold mobile-text-base',
              'transition-all active:scale-98',
              isLastStep
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {isLastStep ? (
                <>
                  <Check className="w-5 h-5" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </span>
          </button>

          <p className="mobile-text-xs text-zinc-500 text-center mt-3">
            Swipe left or right to navigate
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook to check if onboarding is needed
export const useOnboardingStatus = (storageKey = 'mobile-onboarding-completed') => {
  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const markCompleted = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true');
      setIsCompleted(true);
    } catch (error) {
      console.warn('Failed to mark onboarding as completed:', error);
    }
  }, [storageKey]);

  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setIsCompleted(false);
    } catch (error) {
      console.warn('Failed to reset onboarding:', error);
    }
  }, [storageKey]);

  return {
    isCompleted,
    markCompleted,
    resetOnboarding,
  };
};
