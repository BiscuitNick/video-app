import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Check, RefreshCw, Image as ImageIcon, Video, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  thumbnail?: string;
  duration?: number;
  size: number;
  createdAt: Date;
}

interface AssetBrowserMobileProps {
  assets: Asset[];
  onLoadMore?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onAssetSelect?: (asset: Asset) => void;
  onBatchSelect?: (assets: Asset[]) => void;
  className?: string;
  columns?: { mobile: number; tablet: number };
  enableInfiniteScroll?: boolean;
  enablePullToRefresh?: boolean;
  enableBatchSelection?: boolean;
}

export const AssetBrowserMobile: React.FC<AssetBrowserMobileProps> = ({
  assets,
  onLoadMore,
  onRefresh,
  onAssetSelect,
  onBatchSelect,
  className,
  columns = { mobile: 2, tablet: 3 },
  enableInfiniteScroll = true,
  enablePullToRefresh = true,
  enableBatchSelection = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<number | null>(null);
  const { vibrate, patterns } = useHaptics();

  // Infinite scroll
  const { isLoading: isLoadingMore } = useInfiniteScroll({
    containerRef,
    onLoadMore: onLoadMore || (async () => {}),
    enabled: enableInfiniteScroll && !!onLoadMore,
  });

  // Pull to refresh
  const { isPulling, pullDistance } = usePullToRefresh({
    containerRef,
    onRefresh: onRefresh || (async () => {}),
    enabled: enablePullToRefresh && !!onRefresh,
  });

  // Toggle batch selection mode
  const handleLongPress = useCallback((assetId: string) => {
    if (!enableBatchSelection) return;

    setBatchMode(true);
    setSelectedAssets(new Set([assetId]));
    patterns.longPress();
  }, [enableBatchSelection, patterns]);

  // Toggle asset selection
  const handleAssetClick = useCallback((asset: Asset) => {
    if (batchMode) {
      setSelectedAssets((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(asset.id)) {
          newSet.delete(asset.id);
          patterns.light();
        } else {
          newSet.add(asset.id);
          patterns.medium();
        }
        return newSet;
      });
    } else {
      onAssetSelect?.(asset);
      patterns.medium();
    }
  }, [batchMode, onAssetSelect, patterns]);

  // Exit batch mode
  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedAssets(new Set());
    patterns.light();
  }, [patterns]);

  // Confirm batch selection
  const confirmBatchSelection = useCallback(() => {
    const selected = assets.filter((a) => selectedAssets.has(a.id));
    onBatchSelect?.(selected);
    exitBatchMode();
    patterns.success();
  }, [assets, selectedAssets, onBatchSelect, exitBatchMode, patterns]);

  // Swipe navigation for preview
  const handleSwipePreview = useCallback((direction: 'left' | 'right') => {
    if (currentPreview === null) return;

    if (direction === 'left' && currentPreview < assets.length - 1) {
      setCurrentPreview(currentPreview + 1);
      patterns.light();
    } else if (direction === 'right' && currentPreview > 0) {
      setCurrentPreview(currentPreview - 1);
      patterns.light();
    }
  }, [currentPreview, assets.length, patterns]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get asset icon
  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-8 h-8" />;
      case 'video':
        return <Video className="w-8 h-8" />;
      case 'audio':
        return <Music className="w-8 h-8" />;
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-zinc-900', className)}>
      {/* Header */}
      <div className="safe-top flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        {batchMode ? (
          <>
            <button
              onClick={exitBatchMode}
              className="touch-target-min mobile-text-sm text-blue-400"
            >
              Cancel
            </button>
            <span className="mobile-text-sm text-zinc-300">
              {selectedAssets.size} selected
            </span>
            <button
              onClick={confirmBatchSelection}
              disabled={selectedAssets.size === 0}
              className={cn(
                'touch-target-min mobile-text-sm font-medium',
                selectedAssets.size > 0 ? 'text-blue-400' : 'text-zinc-600'
              )}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="mobile-text-lg font-semibold text-zinc-100">Assets</h2>
            <span className="mobile-text-sm text-zinc-400">{assets.length} items</span>
          </>
        )}
      </div>

      {/* Pull to refresh indicator */}
      {isPulling && (
        <div
          className="flex items-center justify-center py-2 bg-zinc-800/50 transition-all"
          style={{ height: `${Math.min(pullDistance, 60)}px` }}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5 text-zinc-400 transition-transform',
              pullDistance > 50 && 'animate-spin'
            )}
          />
        </div>
      )}

      {/* Asset Grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto momentum-scroll px-4 py-4"
      >
        <div
          className={cn(
            'grid gap-3',
            'grid-cols-2', // Mobile: 2 columns
            'md:grid-cols-3', // Tablet: 3 columns
            'lg:grid-cols-4' // Desktop: 4 columns
          )}
        >
          {assets.map((asset, index) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isSelected={selectedAssets.has(asset.id)}
              isBatchMode={batchMode}
              onClick={() => handleAssetClick(asset)}
              onLongPress={() => handleLongPress(asset.id)}
              onPreview={() => setCurrentPreview(index)}
              formatSize={formatSize}
              formatDuration={formatDuration}
              getAssetIcon={getAssetIcon}
            />
          ))}
        </div>

        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        )}

        {/* Batch selection hint */}
        {!batchMode && enableBatchSelection && assets.length > 0 && (
          <p className="text-center mobile-text-xs text-zinc-500 py-4">
            Long press on an asset to select multiple
          </p>
        )}
      </div>
    </div>
  );
};

// Asset Card Component
interface AssetCardProps {
  asset: Asset;
  isSelected: boolean;
  isBatchMode: boolean;
  onClick: () => void;
  onLongPress: () => void;
  onPreview: () => void;
  formatSize: (bytes: number) => string;
  formatDuration: (seconds?: number) => string;
  getAssetIcon: (type: Asset['type']) => React.ReactNode;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isSelected,
  isBatchMode,
  onClick,
  onLongPress,
  onPreview,
  formatSize,
  formatDuration,
  getAssetIcon,
}) => {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      onLongPress();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <button
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'relative aspect-square rounded-lg overflow-hidden',
        'bg-zinc-800 border-2 transition-all',
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-zinc-700',
        'active:scale-95'
      )}
    >
      {/* Thumbnail */}
      <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
        {asset.thumbnail ? (
          <img
            src={asset.thumbnail}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          getAssetIcon(asset.type)
        )}
      </div>

      {/* Selection indicator */}
      {isBatchMode && (
        <div
          className={cn(
            'absolute top-2 right-2 w-6 h-6 rounded-full border-2',
            'flex items-center justify-center transition-all',
            isSelected
              ? 'bg-blue-500 border-blue-500'
              : 'bg-zinc-800/80 border-zinc-500'
          )}
        >
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="mobile-text-xs text-white truncate font-medium">
          {asset.name}
        </p>
        <div className="flex items-center justify-between mobile-text-xs text-zinc-300">
          <span>{formatSize(asset.size)}</span>
          {asset.duration && <span>{formatDuration(asset.duration)}</span>}
        </div>
      </div>
    </button>
  );
};
