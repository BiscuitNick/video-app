import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: string | number;
  onToggle?: (isOpen: boolean) => void;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  className,
  headerClassName,
  contentClassName,
  badge,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);
  const contentRef = useRef<HTMLDivElement>(null);
  const { vibrate } = useHaptics();

  // Update height when content changes or open state changes
  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);

      // Set to auto after animation completes
      const timer = setTimeout(() => {
        setHeight('auto');
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // First set to explicit height, then to 0 to trigger animation
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        setHeight(0);
      });
    }
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !isOpen;
    vibrate(10);
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div className={cn('bg-zinc-800 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full touch-target flex items-center justify-between px-4 py-3',
          'transition-colors active:bg-zinc-700',
          headerClassName
        )}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="text-zinc-400">
              {icon}
            </span>
          )}
          <span className="mobile-text-base font-medium text-zinc-100">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full mobile-text-xs font-medium">
              {badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            'w-5 h-5 text-zinc-400 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out'
        )}
        style={{
          height: height === 'auto' ? 'auto' : `${height}px`,
        }}
      >
        <div className={cn('px-4 py-3 border-t border-zinc-700', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Stacked Panel Layout Component
interface StackedPanelLayoutProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'compact' | 'normal' | 'relaxed';
}

export const StackedPanelLayout: React.FC<StackedPanelLayoutProps> = ({
  children,
  className,
  spacing = 'normal',
}) => {
  const spacingMap = {
    compact: 'gap-1',
    normal: 'gap-2',
    relaxed: 'gap-4',
  };

  return (
    <div className={cn('flex flex-col', spacingMap[spacing], className)}>
      {children}
    </div>
  );
};
