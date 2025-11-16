import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, Download, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import type { GenerationQueueItem, GenerationStatus } from '../../types/replicate';

interface GenerationQueueViewerProps {
  queue: GenerationQueueItem[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload?: (item: GenerationQueueItem) => void;
}

export function GenerationQueueViewer({
  queue,
  onCancel,
  onRemove,
  onDownload,
}: GenerationQueueViewerProps) {
  const getStatusBadge = (status: GenerationStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="gap-1">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="gap-1">
            <X className="h-3 w-3" />
            Cancelled
          </Badge>
        );
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return 'Calculating...';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No active generations. Start by creating a new generation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {item.request.type === 'image' ? 'Image' : 'Video'} Generation
                  </CardTitle>
                  {getStatusBadge(item.status)}
                </div>
                <CardDescription className="line-clamp-2">
                  {item.request.prompt}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  item.status === 'processing' ? onCancel(item.id) : onRemove(item.id)
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress Bar */}
            {(item.status === 'processing' || item.status === 'pending') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{item.progress}%</span>
                </div>
                <Progress value={item.progress} />
                {item.estimatedTimeRemaining !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Estimated time remaining: {formatTime(item.estimatedTimeRemaining)}
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {item.status === 'failed' && item.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Error:</p>
                <p>{item.error}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Aspect Ratio:</span>{' '}
                {item.request.aspectRatio}
              </div>
              <div>
                <span className="font-medium">Priority:</span> {item.priority}
              </div>
              {item.completedAt && (
                <div>
                  <span className="font-medium">Completed:</span>{' '}
                  {new Date(item.completedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Actions */}
            {item.status === 'completed' && item.outputUrl && onDownload && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onDownload(item)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download & Import to Library
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default GenerationQueueViewer;
