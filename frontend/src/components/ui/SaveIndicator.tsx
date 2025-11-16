import React from 'react';
import { useSaveStatusIndicator } from '@/hooks/useAutoSave';

/**
 * SaveIndicator Component
 *
 * Displays the current save status with visual feedback
 * Shows: saving, saved, error states with appropriate colors
 */
export const SaveIndicator: React.FC = () => {
  const { statusText, statusColor, progress, status } = useSaveStatusIndicator();

  const getColorClass = () => {
    switch (statusColor) {
      case 'green':
        return 'text-green-600 bg-green-50';
      case 'blue':
        return 'text-blue-600 bg-blue-50';
      case 'red':
        return 'text-red-600 bg-red-50';
      case 'yellow':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'success':
      case 'idle':
        return (
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'pending':
        return (
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${getColorClass()}`}>
      {getIcon()}
      <span>{statusText}</span>
      {status === 'saving' && progress > 0 && (
        <div className="ml-2 w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-current transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Compact Save Indicator (for toolbars)
 */
export const CompactSaveIndicator: React.FC = () => {
  const { statusText, status } = useSaveStatusIndicator();

  if (status === 'idle' && !statusText.includes('Saved')) {
    return null; // Hide when nothing to show
  }

  return (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      {status === 'saving' && (
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      <span className="truncate max-w-32">{statusText}</span>
    </div>
  );
};
