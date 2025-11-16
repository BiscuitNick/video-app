import React from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { MediaUploadProgress } from '@/types/api';

interface UploadItem {
  id: string;
  fileName: string;
  progress: MediaUploadProgress | null;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface UploadProgressBarProps {
  uploads: UploadItem[];
  onCancel?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  uploads,
  onCancel,
  onDismiss,
}) => {
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[400px] overflow-y-auto space-y-2">
      {uploads.map((upload) => (
        <div
          key={upload.id}
          className="bg-card border border-border rounded-lg shadow-lg p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {upload.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
                {upload.status === 'processing' && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                {upload.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm font-medium truncate" title={upload.fileName}>
                  {upload.fileName}
                </span>
              </div>

              {/* Progress bar */}
              {upload.status === 'uploading' && upload.progress && (
                <div className="space-y-1">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${upload.progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{upload.progress.percentage}%</span>
                    <span>
                      {formatBytes(upload.progress.loaded)} / {formatBytes(upload.progress.total)}
                    </span>
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {upload.status === 'processing' && (
                <div className="space-y-1">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-500 h-full w-full animate-pulse" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Processing media...
                  </div>
                </div>
              )}

              {/* Completed message */}
              {upload.status === 'completed' && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  Upload completed successfully
                </div>
              )}

              {/* Error message */}
              {upload.status === 'error' && upload.error && (
                <div className="text-xs text-destructive">
                  {upload.error}
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={() => {
                if (upload.status === 'uploading' && onCancel) {
                  onCancel(upload.id);
                } else if (onDismiss) {
                  onDismiss(upload.id);
                }
              }}
              className="p-1 hover:bg-accent rounded-md transition-colors"
              title={upload.status === 'uploading' ? 'Cancel' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default UploadProgressBar;
export type { UploadItem };
