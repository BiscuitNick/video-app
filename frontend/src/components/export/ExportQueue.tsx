import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useExportStore, type ActiveExport } from '@/stores/useExportStore';
import { exportsApi } from '@/services/api/exports';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const ExportQueue: React.FC = () => {
  const { activeExports, cancelExport, removeActiveExport } = useExportStore();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);

  const activeExportsList = Array.from(activeExports.values());

  const handleCancelConfirm = async (exportJob: ActiveExport) => {
    if (!exportJob.projectId) return;

    setCancellingId(exportJob.id);
    setShowCancelDialog(null);

    try {
      await exportsApi.cancel(exportJob.projectId, exportJob.id);
      cancelExport(exportJob.id);
    } catch (error) {
      console.error('Failed to cancel export:', error);
      // Still remove from UI even if API call fails
      removeActiveExport(exportJob.id);
    } finally {
      setCancellingId(null);
    }
  };

  if (activeExportsList.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p>No active exports</p>
          <p className="text-sm mt-1">
            Your exports will appear here while they are processing
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Active Exports ({activeExportsList.length})
        </h3>
      </div>

      <div className="space-y-3">
        {activeExportsList.map((exportJob) => (
          <ExportQueueItem
            key={exportJob.id}
            exportJob={exportJob}
            onCancel={() => setShowCancelDialog(exportJob.id)}
            isCancelling={cancellingId === exportJob.id}
          />
        ))}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <CancelDialog
          exportId={showCancelDialog}
          onConfirm={() => {
            const exportJob = activeExports.get(showCancelDialog);
            if (exportJob) {
              handleCancelConfirm(exportJob);
            }
          }}
          onCancel={() => setShowCancelDialog(null)}
        />
      )}
    </div>
  );
};

interface ExportQueueItemProps {
  exportJob: ActiveExport;
  onCancel: () => void;
  isCancelling: boolean;
}

const ExportQueueItem: React.FC<ExportQueueItemProps> = ({
  exportJob,
  onCancel,
  isCancelling,
}) => {
  const progressDetails = exportJob.progressDetails;
  const stage = progressDetails?.stage || 'downloading';
  const progress = progressDetails?.progress || 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `\${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `\${minutes}m \${remainingSeconds}s`;
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium">{exportJob.format.toUpperCase()} Export</h4>
            <p className="text-sm text-muted-foreground">
              {exportJob.resolution.width} x {exportJob.resolution.height}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Stage */}
        <div className="flex items-center space-x-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="font-medium">
            {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}%</span>
            {progressDetails?.estimatedTimeRemaining !== undefined && (
              <span>ETA: {formatTime(progressDetails.estimatedTimeRemaining)}</span>
            )}
          </div>
        </div>

        {/* Message */}
        {progressDetails?.message && (
          <p className="text-xs text-muted-foreground">
            {progressDetails.message}
          </p>
        )}
      </div>
    </Card>
  );
};

interface CancelDialogProps {
  exportId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const CancelDialog: React.FC<CancelDialogProps> = ({
  exportId,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Export?</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this export? This action cannot be
            undone and you will need to start a new export.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Keep Export
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Cancel Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
