import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useExportStore } from '@/stores/useExportStore';
import { downloadManager } from '@/services/downloadManager';
import {
  Download,
  Share2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExportJob } from '@/types/api';

const ITEMS_PER_PAGE = 10;

export const ExportHistory: React.FC = () => {
  const { exportHistory, removeFromHistory, clearHistory } = useExportStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const totalPages = Math.ceil(exportHistory.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = exportHistory.slice(startIndex, endIndex);

  const handleDownload = async (exportJob: ExportJob) => {
    if (!exportJob.projectId) return;

    setDownloadingId(exportJob.id);

    try {
      await downloadManager.download({
        projectId: exportJob.projectId,
        exportId: exportJob.id,
        filename: `export-\${exportJob.id}.\${exportJob.format}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = async (exportJob: ExportJob) => {
    if (!exportJob.projectId) return;

    setSharingId(exportJob.id);

    try {
      const shareLink = await downloadManager.generateShareableLink(
        exportJob.projectId,
        exportJob.id,
        { expiresIn: 7 * 24 * 3600 } // 7 days
      );

      const copied = await downloadManager.copyShareableLink(shareLink.url);
      
      if (copied) {
        // Show success message (you could use a toast here)
        alert('Shareable link copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to generate share link:', error);
      alert('Failed to generate shareable link');
    } finally {
      setSharingId(null);
    }
  };

  const handleDelete = (exportId: string) => {
    if (confirm('Are you sure you want to delete this export from history?')) {
      removeFromHistory(exportId);
    }
  };

  const handleClearAll = () => {
    if (
      confirm(
        'Are you sure you want to clear all export history? This cannot be undone.'
      )
    ) {
      clearHistory();
      setCurrentPage(1);
    }
  };

  if (exportHistory.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No export history</p>
          <p className="text-sm mt-1">
            Your completed and failed exports will appear here
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Export History ({exportHistory.length})
        </h3>
        {exportHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {currentItems.map((exportJob) => (
          <ExportHistoryItem
            key={exportJob.id}
            exportJob={exportJob}
            onDownload={() => handleDownload(exportJob)}
            onShare={() => handleShare(exportJob)}
            onDelete={() => handleDelete(exportJob.id)}
            isDownloading={downloadingId === exportJob.id}
            isSharing={sharingId === exportJob.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExportHistoryItemProps {
  exportJob: ExportJob;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  isDownloading: boolean;
  isSharing: boolean;
}

const ExportHistoryItem: React.FC<ExportHistoryItemProps> = ({
  exportJob,
  onDownload,
  onShare,
  onDelete,
  isDownloading,
  isSharing,
}) => {
  const isCompleted = exportJob.status === 'completed';
  const isFailed = exportJob.status === 'failed';

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Status Icon */}
          <div className="mt-1">
            {isCompleted && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
            {isFailed && <XCircle className="w-5 h-5 text-destructive" />}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium">{exportJob.format.toUpperCase()}</h4>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  {
                    'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400':
                      isCompleted,
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400':
                      isFailed,
                  }
                )}
              >
                {exportJob.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {exportJob.resolution.width} x {exportJob.resolution.height} •{' '}
              {exportJob.quality}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(exportJob.createdAt)}
            </p>
            {isFailed && exportJob.error && (
              <p className="text-xs text-destructive mt-2">{exportJob.error}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 ml-4">
          {isCompleted && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                title="Download"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShare}
                disabled={isSharing}
                title="Share"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
