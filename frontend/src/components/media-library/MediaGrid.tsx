import React, { useMemo, useRef, useState, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import MediaCard from './MediaCard';
import type { MediaAsset } from '@/types/api';
import { FileX } from 'lucide-react';

interface MediaGridProps {
  assets: MediaAsset[];
  selectedAssetIds: string[];
  onSelectAsset: (id: string, multiSelect: boolean) => void;
  onDeleteAsset: (id: string) => void;
  onRenameAsset: (id: string, newName: string) => void;
  onMoveAsset?: (id: string) => void;
  viewMode: 'grid' | 'list';
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 280;
const CARD_SPACING = 16;
const LIST_ITEM_HEIGHT = 80;

const MediaGrid: React.FC<MediaGridProps> = ({
  assets,
  selectedAssetIds,
  onSelectAsset,
  onDeleteAsset,
  onRenameAsset,
  onMoveAsset,
  viewMode,
}) => {
  // Hooks must be called unconditionally
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const columnCount = useMemo(
    () => (width: number) => {
      if (viewMode === 'list') return 1;
      return Math.max(1, Math.floor(width / (CARD_WIDTH + CARD_SPACING)));
    },
    [viewMode]
  );

  const rowCount = useMemo(
    () => (cols: number) => {
      if (viewMode === 'list') return assets.length;
      return Math.ceil(assets.length / cols);
    },
    [assets.length, viewMode]
  );

  const getAssetAtIndex = (rowIndex: number, columnIndex: number, cols: number): MediaAsset | null => {
    if (viewMode === 'list') {
      return assets[rowIndex] || null;
    }
    const index = rowIndex * cols + columnIndex;
    return assets[index] || null;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const cols = columnCount(dimensions.width);
  const rows = rowCount(cols);

  // Empty state
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileX className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium">No media assets found</p>
        <p className="text-sm">Upload some media to get started</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Grid
          columnCount={cols}
          columnWidth={viewMode === 'list' ? dimensions.width : CARD_WIDTH + CARD_SPACING}
          height={dimensions.height}
          rowCount={rows}
          rowHeight={viewMode === 'list' ? LIST_ITEM_HEIGHT : CARD_HEIGHT + CARD_SPACING}
          width={dimensions.width}
          overscanRowCount={2}
        >
          {({ columnIndex, rowIndex, style }) => {
            const asset = getAssetAtIndex(rowIndex, columnIndex, cols);
            if (!asset) return null;

            return (
              <div
                style={{
                  ...style,
                  left: Number(style.left) + CARD_SPACING / 2,
                  top: Number(style.top) + CARD_SPACING / 2,
                  width: viewMode === 'list'
                    ? `calc(100% - ${CARD_SPACING}px)`
                    : CARD_WIDTH,
                  height: viewMode === 'list'
                    ? LIST_ITEM_HEIGHT - CARD_SPACING
                    : CARD_HEIGHT,
                }}
              >
                {viewMode === 'grid' ? (
                  <MediaCard
                    asset={asset}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    onSelect={onSelectAsset}
                    onDelete={onDeleteAsset}
                    onRename={onRenameAsset}
                    onMove={onMoveAsset}
                  />
                ) : (
                  <MediaListItem
                    asset={asset}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    onSelect={onSelectAsset}
                    onDelete={onDeleteAsset}
                    onRename={onRenameAsset}
                    onMove={onMoveAsset}
                  />
                )}
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );
};

// List view item component
interface MediaListItemProps {
  asset: MediaAsset;
  isSelected: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onMove?: (id: string) => void;
}

const MediaListItem: React.FC<MediaListItemProps> = ({
  asset,
  isSelected,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(asset.name);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(asset.id, e.ctrlKey || e.metaKey);
  };

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== asset.name) {
      onRename(asset.id, editName.trim());
    }
    setIsEditing(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-lg border ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
      } cursor-pointer transition-all`}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="w-20 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-xs uppercase">{asset.type}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3 className="font-medium text-sm truncate" title={asset.name}>
            {asset.name}
          </h3>
        )}
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
          <span>{asset.type}</span>
          <span>{formatFileSize(asset.size)}</span>
          {asset.duration && <span>{formatDuration(asset.duration)}</span>}
          {asset.metadata.width && asset.metadata.height && (
            <span>
              {asset.metadata.width} × {asset.metadata.height}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="px-2 py-1 text-xs hover:bg-accent rounded"
        >
          Rename
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(asset.id);
          }}
          className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default MediaGrid;
