import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExportStore } from '@/stores/useExportStore';
import { ExportWizard } from './ExportWizard';

/**
 * ExportModal - Main modal component for the export workflow
 * Manages the dialog state and integrates with the export store
 */
export const ExportModal: React.FC = () => {
  const { wizardOpen, closeWizard, resetWizard } = useExportStore();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeWizard();
      // Reset wizard state after closing
      setTimeout(() => resetWizard(), 300);
    }
  };

  return (
    <Dialog open={wizardOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Project</DialogTitle>
          <DialogDescription>
            Configure your export settings and monitor the export progress
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ExportWizard />
        </div>
      </DialogContent>
    </Dialog>
  );
};
