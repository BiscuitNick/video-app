import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMediaLibraryStore } from '@/stores/useMediaLibraryStore';
import { useWebSocketStore } from '@/stores/useWebSocketStore';
import {
  useMediaLibrary,
  useUploadMedia,
  useDeleteMedia,
  useUpdateMedia,
} from '@/hooks/useMediaLibrary';
import MediaGrid from './MediaGrid';
import MediaFilters from './MediaFilters';
import MediaSearch from './MediaSearch';
import UploadZone from './UploadZone';
import UploadProgressBar, { type UploadItem } from './UploadProgressBar';
import { Button } from '@/components/ui/button';
import { Upload as UploadIcon, RefreshCw } from 'lucide-react';
import type { MediaAsset } from '@/types/api';

interface MediaLibraryPanelProps {
  projectId: string;
  onAssetSelect?: (asset: MediaAsset) => void;
  className?: string;
}

const MediaLibraryPanel: React.FC<MediaLibraryPanelProps> = ({
  projectId,
  onAssetSelect,
  className,
}) => {
  // State
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaAsset['type'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  // Store
  const {
    assets: storeAssets,
    selectedAssetIds,
    addAssets,
    updateAsset,
    deleteAsset,
    selectAsset,
    selectAssets,
    deselectAsset,
  } = useMediaLibraryStore();

  // API Hooks
  const { data: mediaData, isLoading, refetch } = useMediaLibrary(projectId);
  const uploadMutation = useUploadMedia();
  const deleteMutation = useDeleteMedia();
  const updateMutation = useUpdateMedia();

  // WebSocket
  const { messages } = useWebSocketStore();

  // Sync API data to store
  useEffect(() => {
    if (mediaData?.items) {
      addAssets(mediaData.items);
    }
  }, [mediaData, addAssets]);

  // WebSocket message handler for real-time updates
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    const { type, payload } = latestMessage;

    switch (type) {
      case 'media:uploaded':
        if (payload && typeof payload === 'object' && 'projectId' in payload) {
          if (payload.projectId === projectId) {
            refetch();
          }
        }
        break;
      case 'media:updated':
        if (payload && typeof payload === 'object' && 'id' in payload && 'projectId' in payload) {
          if (payload.projectId === projectId) {
            updateAsset(payload.id as string, payload as Partial<MediaAsset>);
          }
        }
        break;
      case 'media:deleted':
        if (payload && typeof payload === 'object' && 'id' in payload && 'projectId' in payload) {
          if (payload.projectId === projectId) {
            deleteAsset(payload.id as string);
          }
        }
        break;
      case 'media:processing':
        if (payload && typeof payload === 'object' && 'mediaId' in payload && 'status' in payload) {
          // Update upload progress for processing status
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === payload.mediaId
                ? { ...upload, status: payload.status as UploadItem['status'] }
                : upload
            )
          );
        }
        break;
    }
  }, [messages, projectId, refetch, updateAsset, deleteAsset]);

  // Filter and sort assets
  const filteredAndSortedAssets = useMemo(() => {
    let filtered = storeAssets;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((asset) =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter((asset) => asset.type === typeFilter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [storeAssets, searchQuery, typeFilter, sortBy, sortOrder]);

  // Handlers
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setShowUploadZone(false);

      for (const file of files) {
        const uploadId = crypto.randomUUID();

        // Add to upload tracking
        setUploads((prev) => [
          ...prev,
          {
            id: uploadId,
            fileName: file.name,
            progress: null,
            status: 'uploading',
          },
        ]);

        try {
          await uploadMutation.mutateAsync({
            projectId,
            file,
            name: file.name,
          });

          // Update status to completed
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === uploadId
                ? { ...upload, status: 'completed' }
                : upload
            )
          );

          // Auto-dismiss after 3 seconds
          setTimeout(() => {
            setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
          }, 3000);
        } catch (error) {
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === uploadId
                ? {
                    ...upload,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : upload
            )
          );
        }
      }
    },
    [projectId, uploadMutation]
  );

  const handleSelectAsset = useCallback(
    (id: string, multiSelect: boolean) => {
      if (multiSelect) {
        if (selectedAssetIds.includes(id)) {
          deselectAsset(id);
        } else {
          selectAsset(id);
        }
      } else {
        selectAssets([id]);
        const asset = storeAssets.find((a) => a.id === id);
        if (asset && onAssetSelect) {
          onAssetSelect(asset);
        }
      }
    },
    [selectedAssetIds, selectAsset, selectAssets, deselectAsset, storeAssets, onAssetSelect]
  );

  const handleDeleteAsset = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this media asset?')) {
        return;
      }

      try {
        await deleteMutation.mutateAsync({ projectId, mediaId: id });
        deleteAsset(id);
      } catch (error) {
        console.error('Failed to delete asset:', error);
        alert('Failed to delete asset. Please try again.');
      }
    },
    [projectId, deleteMutation, deleteAsset]
  );

  const handleRenameAsset = useCallback(
    async (id: string, newName: string) => {
      try {
        await updateMutation.mutateAsync({
          projectId,
          mediaId: id,
          input: { name: newName },
        });
        updateAsset(id, { name: newName });
      } catch (error) {
        console.error('Failed to rename asset:', error);
        alert('Failed to rename asset. Please try again.');
      }
    },
    [projectId, updateMutation, updateAsset]
  );

  const handleDismissUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((upload) => upload.id !== id));
  }, []);

  return (
    <div className={`flex flex-col h-full bg-background ${className || ''}`}>
      {/* Header */}
      <div className="flex-none border-b border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowUploadZone(!showUploadZone)}
            >
              <UploadIcon className="w-4 h-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Upload Zone */}
        {showUploadZone && (
          <UploadZone
            onFilesSelected={handleFilesSelected}
            accept="video/*,audio/*,image/*"
          />
        )}

        {/* Search */}
        <MediaSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search media..."
        />

        {/* Filters */}
        <MediaFilters
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading && storeAssets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading media...</p>
            </div>
          </div>
        ) : (
          <MediaGrid
            assets={filteredAndSortedAssets}
            selectedAssetIds={selectedAssetIds}
            onSelectAsset={handleSelectAsset}
            onDeleteAsset={handleDeleteAsset}
            onRenameAsset={handleRenameAsset}
            viewMode={viewMode}
          />
        )}
      </div>

      {/* Upload Progress */}
      <UploadProgressBar
        uploads={uploads}
        onDismiss={handleDismissUpload}
      />
    </div>
  );
};

export default MediaLibraryPanel;
