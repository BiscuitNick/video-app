import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // Percentage heights: [50, 75, 100]
  initialSnap?: number; // Index of snapPoints
  className?: string;
  showHandle?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [50, 100],
  initialSnap = 0,
  className,
  showHandle = true,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const { vibrate } = useHaptics();

  const snapHeight = snapPoints[currentSnap];

  // Calculate drag offset
  const dragOffset = isDragging ? currentY - startY : 0;
  const sheetHeight = `${Math.max(0, snapHeight - (dragOffset / window.innerHeight * 100))}%`;

  // Handle drag start
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    setStartY(clientY);
    setCurrentY(clientY);
    vibrate(10); // Light haptic feedback
  }, [vibrate]);

  // Handle drag move
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    setCurrentY(clientY);
  }, [isDragging]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const dragDistance = currentY - startY;
    const dragPercentage = (dragDistance / window.innerHeight) * 100;

    // Determine next snap point
    let nextSnap = currentSnap;

    if (dragPercentage > 15) {
      // Dragged down - go to lower snap point or close
      if (currentSnap === 0) {
        onClose();
        vibrate(20);
        return;
      }
      nextSnap = currentSnap - 1;
    } else if (dragPercentage < -15) {
      // Dragged up - go to higher snap point
      if (currentSnap < snapPoints.length - 1) {
        nextSnap = currentSnap + 1;
      }
    }

    if (nextSnap !== currentSnap) {
      vibrate(15);
      setCurrentSnap(nextSnap);
    }

    setIsDragging(false);
  }, [isDragging, currentY, startY, currentSnap, snapPoints, onClose, vibrate]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target === sheetRef.current || (e.target as HTMLElement).closest('.bottom-sheet-handle')) {
      handleDragStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === sheetRef.current || (e.target as HTMLElement).closest('.bottom-sheet-handle')) {
      handleDragStart(e.clientY);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.clientY);
    }
  }, [isDragging, handleDragMove]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      handleDragEnd();
    }
  }, [isDragging, handleDragEnd]);

  // Add/remove mouse listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Close on backdrop click
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

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-zinc-800 rounded-t-2xl shadow-2xl z-50 overflow-hidden',
          'transition-all duration-300 ease-out',
          isDragging && 'transition-none',
          className
        )}
        style={{
          height: sheetHeight,
          transform: isDragging ? `translateY(${Math.max(0, dragOffset)}px)` : 'translateY(0)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {/* Handle */}
        {showHandle && (
          <div className="bottom-sheet-handle flex justify-center py-3 cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-zinc-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="px-4 pb-3 border-b border-zinc-700">
            <h3 className="mobile-text-lg font-semibold text-zinc-100">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto momentum-scroll safe-bottom">
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};
