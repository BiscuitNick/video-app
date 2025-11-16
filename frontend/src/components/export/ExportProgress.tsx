import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useExportStore, type ExportStage } from '@/stores/useExportStore';
import { useWebSocketStore } from '@/stores/useWebSocketStore';
import { env } from '@/config/env';
import {
  Download,
  Video,
  FileCode,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGE_CONFIG: Record<
  ExportStage,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  downloading: {
    label: 'Downloading Assets',
    icon: <Download className="w-5 h-5" />,
    color: 'text-blue-500',
  },
  rendering: {
    label: 'Rendering Frames',
    icon: <Video className="w-5 h-5" />,
    color: 'text-purple-500',
  },
  encoding: {
    label: 'Encoding Video',
    icon: <FileCode className="w-5 h-5" />,
    color: 'text-orange-500',
  },
  uploading: {
    label: 'Uploading Result',
    icon: <Upload className="w-5 h-5" />,
    color: 'text-green-500',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'text-green-600',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-destructive',
  },
};

export const ExportProgress: React.FC = () => {
  const { activeExports, closeWizard, completeExport, failExport } = useExportStore();
  const {
    connectionState,
    connect,
    disconnect,
    messages,
    clearMessages,
  } = useWebSocketStore();
  const [reconnecting, setReconnecting] = useState(false);

  // Get the first active export (assuming wizard only tracks one at a time)
  const activeExportsList = Array.from(activeExports.values());
  const currentExport = activeExportsList[0];

  useEffect(() => {
    // Connect to WebSocket if not already connected
    if (connectionState === 'disconnected' && currentExport) {
      const wsUrl = `\${env.wsBaseUrl}/exports/\${currentExport.id}/progress`;
      connect(wsUrl);
    }

    return () => {
      // Clean up messages when component unmounts
      clearMessages();
    };
  }, [currentExport?.id, connectionState]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!currentExport) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    // Handle export progress updates
    if (latestMessage.type === 'export:progress') {
      const progressData = latestMessage.payload as any;
      useExportStore.getState().updateExportProgress(currentExport.id, {
        stage: progressData.stage,
        progress: progressData.progress,
        estimatedTimeRemaining: progressData.estimatedTimeRemaining,
        currentFrame: progressData.currentFrame,
        totalFrames: progressData.totalFrames,
        message: progressData.message,
      });
    }

    // Handle export completion
    if (latestMessage.type === 'export:completed') {
      const exportData = latestMessage.payload as any;
      completeExport(currentExport.id, {
        ...currentExport,
        status: 'completed',
        outputUrl: exportData.outputUrl,
        completedAt: new Date().toISOString(),
      });
    }

    // Handle export failure
    if (latestMessage.type === 'export:failed') {
      const errorData = latestMessage.payload as any;
      failExport(currentExport.id, errorData.error || 'Export failed');
    }
  }, [messages, currentExport?.id]);

  const handleRetryConnection = () => {
    setReconnecting(true);
    disconnect();
    setTimeout(() => {
      if (currentExport) {
        const wsUrl = `\${env.wsBaseUrl}/exports/\${currentExport.id}/progress`;
        connect(wsUrl);
      }
      setReconnecting(false);
    }, 1000);
  };

  const handleClose = () => {
    disconnect();
    closeWizard();
  };

  if (!currentExport) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No active export</p>
      </div>
    );
  }

  const progressDetails = currentExport.progressDetails;
  const currentStage = progressDetails?.stage || 'downloading';
  const progress = progressDetails?.progress || 0;
  const eta = progressDetails?.estimatedTimeRemaining;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `\${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `\${minutes}m \${remainingSeconds}s`;
  };

  const isCompleted = currentStage === 'completed';
  const isFailed = currentStage === 'failed';
  const isProcessing = !isCompleted && !isFailed;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {connectionState !== 'connected' && !isCompleted && !isFailed && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                {connectionState === 'connecting' || reconnecting
                  ? 'Connecting...'
                  : connectionState === 'error'
                    ? 'Connection Error'
                    : 'Disconnected'}
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                {connectionState === 'error'
                  ? 'Unable to connect to progress updates'
                  : 'Attempting to reconnect...'}
              </p>
            </div>
            {connectionState === 'error' && !reconnecting && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryConnection}
              >
                Retry
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Stage Visualization */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Export Progress</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['downloading', 'rendering', 'encoding', 'uploading'] as ExportStage[]).map(
            (stage) => {
              const config = STAGE_CONFIG[stage];
              const isActive = currentStage === stage;
              const isCompleteStage =
                ['downloading', 'rendering', 'encoding', 'uploading'].indexOf(stage) <
                ['downloading', 'rendering', 'encoding', 'uploading'].indexOf(currentStage);

              return (
                <Card
                  key={stage}
                  className={cn(
                    'p-4 transition-all',
                    isActive && 'ring-2 ring-primary shadow-md',
                    isCompleteStage && 'opacity-60'
                  )}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div
                      className={cn(
                        'transition-colors',
                        isActive ? config.color : 'text-muted-foreground'
                      )}
                    >
                      {isActive && isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        config.icon
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                </Card>
              );
            }
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {STAGE_CONFIG[currentStage].label}
            </span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {eta !== undefined && (
            <p className="text-xs text-muted-foreground text-right">
              Estimated time remaining: {formatTime(eta)}
            </p>
          )}
        </div>
      )}

      {/* Frame Progress (if available) */}
      {progressDetails?.currentFrame !== undefined &&
        progressDetails?.totalFrames !== undefined && (
          <Card className="p-4 bg-muted/50">
            <div className="flex justify-between text-sm">
              <span>Frames Processed</span>
              <span className="font-medium">
                {progressDetails.currentFrame.toLocaleString()} /{' '}
                {progressDetails.totalFrames.toLocaleString()}
              </span>
            </div>
          </Card>
        )}

      {/* Status Message */}
      {progressDetails?.message && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            {progressDetails.message}
          </p>
        </Card>
      )}

      {/* Completion Status */}
      {isCompleted && (
        <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Export Completed Successfully
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Your video is ready for download
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Failure Status */}
      {isFailed && (
        <Card className="p-6 bg-destructive/10 border-destructive">
          <div className="flex items-start space-x-3">
            <XCircle className="w-8 h-8 text-destructive mt-1" />
            <div>
              <p className="font-semibold text-destructive">Export Failed</p>
              <p className="text-sm text-destructive/90 mt-1">
                {currentExport.error || 'An error occurred during export'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        {isCompleted && (
          <Button onClick={handleClose}>Close</Button>
        )}
        {isFailed && (
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
};
