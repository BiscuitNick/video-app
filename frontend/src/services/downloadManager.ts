import { exportsApi } from './api/exports';
import { apiClient } from '@/lib/api-client';

/**
 * Download Manager Service
 * Handles download operations with retry logic and signed URL generation
 */

interface DownloadOptions {
  projectId: string;
  exportId: string;
  filename?: string;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

class DownloadManagerService {
  private activeDownloads: Map<string, AbortController> = new Map();
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  /**
   * Generate signed URL for export download
   */
  async generateSignedUrl(
    projectId: string,
    exportId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const response = await apiClient.post<{ url: string; expiresAt: string }>(
        `/api/v1/projects/\${projectId}/exports/\${exportId}/signed-url`,
        { expiresIn }
      );
      return response.data.url;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Generate shareable link for export
   */
  async generateShareableLink(
    projectId: string,
    exportId: string,
    options?: {
      expiresIn?: number;
      password?: string;
      maxDownloads?: number;
    }
  ): Promise<{ url: string; expiresAt: string; shareId: string }> {
    try {
      const response = await apiClient.post<{
        url: string;
        expiresAt: string;
        shareId: string;
      }>(`/api/v1/projects/\${projectId}/exports/\${exportId}/share`, options);
      return response.data;
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      throw new Error('Failed to generate shareable link');
    }
  }

  /**
   * Download export file with retry logic
   */
  async download(options: DownloadOptions): Promise<void> {
    const {
      projectId,
      exportId,
      filename,
      onProgress,
      onError,
      maxRetries = this.retryConfig.maxRetries,
    } = options;

    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        await this.performDownload(
          projectId,
          exportId,
          filename,
          onProgress
        );
        // Download successful
        return;
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          const downloadError = error instanceof Error 
            ? error 
            : new Error('Download failed');
          onError?.(downloadError);
          throw downloadError;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(
          `Download attempt \${attempt} failed, retrying in \${delay}ms...`,
          error
        );
        
        await this.sleep(delay);
      }
    }
  }

  /**
   * Perform the actual download operation
   */
  private async performDownload(
    projectId: string,
    exportId: string,
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const downloadId = `\${projectId}-\${exportId}`;

    // Create abort controller for this download
    const abortController = new AbortController();
    this.activeDownloads.set(downloadId, abortController);

    try {
      // Get signed URL
      const url = await this.generateSignedUrl(projectId, exportId);

      // Fetch with progress tracking
      const response = await fetch(url, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Download failed: \${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0 && onProgress) {
          const progress = (loaded / total) * 100;
          onProgress(progress);
        }
      }

      // Combine chunks into blob
      const blob = new Blob(chunks);

      // Trigger download
      this.triggerBrowserDownload(blob, filename || `export-\${exportId}.mp4`);
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Trigger browser download for blob
   */
  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Cancel an active download
   */
  cancelDownload(projectId: string, exportId: string): void {
    const downloadId = `\${projectId}-\${exportId}`;
    const controller = this.activeDownloads.get(downloadId);
    
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Cancel all active downloads
   */
  cancelAllDownloads(): void {
    this.activeDownloads.forEach((controller) => controller.abort());
    this.activeDownloads.clear();
  }

  /**
   * Check if a download is active
   */
  isDownloadActive(projectId: string, exportId: string): boolean {
    const downloadId = `\${projectId}-\${exportId}`;
    return this.activeDownloads.has(downloadId);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config,
    };
  }

  /**
   * Copy shareable link to clipboard
   */
  async copyShareableLink(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.error('Failed to copy link:', error);
      return false;
    }
  }
}

// Export singleton instance
export const downloadManager = new DownloadManagerService();

// Export class for testing
export { DownloadManagerService };
