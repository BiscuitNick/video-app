import React from 'react';
import { useExportStore } from '@/stores/useExportStore';
import { ExportSettings } from './ExportSettings';
import { ExportReview } from './ExportReview';
import { ExportProgress } from './ExportProgress';
import { cn } from '@/lib/utils';

/**
 * ExportWizard - Multi-step wizard for export workflow
 * Steps: settings -> review -> progress
 */
export const ExportWizard: React.FC = () => {
  const { currentStep } = useExportStore();

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4">
        <StepIndicator
          step={1}
          label="Settings"
          active={currentStep === 'settings'}
          completed={currentStep === 'review' || currentStep === 'progress'}
        />
        <StepConnector
          completed={currentStep === 'review' || currentStep === 'progress'}
        />
        <StepIndicator
          step={2}
          label="Review"
          active={currentStep === 'review'}
          completed={currentStep === 'progress'}
        />
        <StepConnector completed={currentStep === 'progress'} />
        <StepIndicator
          step={3}
          label="Export"
          active={currentStep === 'progress'}
          completed={false}
        />
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 'settings' && <ExportSettings />}
        {currentStep === 'review' && <ExportReview />}
        {currentStep === 'progress' && <ExportProgress />}
      </div>
    </div>
  );
};

interface StepIndicatorProps {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  label,
  active,
  completed,
}) => {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
          {
            'bg-primary text-primary-foreground': active,
            'bg-primary/70 text-primary-foreground': completed,
            'bg-muted text-muted-foreground': !active && !completed,
          }
        )}
      >
        {completed ? (
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
      </div>
      <span
        className={cn('text-sm font-medium', {
          'text-foreground': active || completed,
          'text-muted-foreground': !active && !completed,
        })}
      >
        {label}
      </span>
    </div>
  );
};

interface StepConnectorProps {
  completed: boolean;
}

const StepConnector: React.FC<StepConnectorProps> = ({ completed }) => {
  return (
    <div className="flex-1 h-0.5 bg-muted relative">
      <div
        className={cn(
          'absolute inset-0 bg-primary transition-all duration-300',
          {
            'w-full': completed,
            'w-0': !completed,
          }
        )}
      />
    </div>
  );
};
