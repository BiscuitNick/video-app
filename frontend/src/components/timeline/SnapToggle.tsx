import React from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { Magnet } from 'lucide-react';

export const SnapToggle: React.FC = () => {
  const snapEnabled = useTimelineStore((state) => state.snapEnabled);
  const toggleSnap = useTimelineStore((state) => state.toggleSnap);

  return (
    <button
      onClick={toggleSnap}
      className={
        snapEnabled
          ? 'flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-600 border-blue-500 text-white hover:bg-blue-700 transition-all'
          : 'flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 transition-all'
      }
      title="Toggle snapping (S)"
    >
      <Magnet className="w-4 h-4" />
      <span className="text-xs font-medium">
        {snapEnabled ? 'Snap On' : 'Snap Off'}
      </span>
    </button>
  );
};
