import React from 'react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

export interface ActionSheetOption {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  options: ActionSheetOption[];
  className?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  options,
  className,
}) => {
  const { vibrate } = useHaptics();

  const handleOptionClick = (option: ActionSheetOption) => {
    if (option.disabled) return;

    vibrate(15);
    option.onSelect();
    onClose();
  };

  const handleBackdropClick = () => {
    vibrate(20);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={handleBackdropClick}
      />

      {/* Action Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 animate-slide-up',
          className
        )}
      >
        <div className="mx-4 mb-4 safe-bottom">
          {/* Options Container */}
          <div className="bg-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            {(title || description) && (
              <div className="px-4 py-3 border-b border-zinc-700 text-center">
                {title && (
                  <h3 className="mobile-text-base font-semibold text-zinc-100 mb-1">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mobile-text-sm text-zinc-400">
                    {description}
                  </p>
                )}
              </div>
            )}

            {/* Options */}
            <div className="py-2">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(option)}
                  disabled={option.disabled}
                  className={cn(
                    'w-full touch-target flex items-center gap-3 px-4 py-3',
                    'transition-colors active:bg-zinc-700/50',
                    option.variant === 'destructive' && 'text-red-500',
                    option.variant === 'default' && 'text-zinc-100',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    index !== options.length - 1 && 'border-b border-zinc-700/50'
                  )}
                >
                  {option.icon && (
                    <span className="flex-shrink-0">
                      {option.icon}
                    </span>
                  )}
                  <span className="mobile-text-base font-medium flex-1 text-left">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={handleBackdropClick}
            className="w-full touch-target mt-2 bg-zinc-800 rounded-2xl px-4 py-3 mobile-text-base font-semibold text-blue-400 shadow-xl active:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};
