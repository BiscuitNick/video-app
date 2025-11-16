import React from 'react';
import { cn } from '@/lib/utils';
import { Filter, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import type { MediaAsset } from '@/types/api';

interface MediaFiltersProps {
  typeFilter: MediaAsset['type'] | 'all';
  onTypeFilterChange: (type: MediaAsset['type'] | 'all') => void;
  sortBy: 'name' | 'date' | 'size' | 'duration';
  onSortByChange: (sortBy: 'name' | 'date' | 'size' | 'duration') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  className?: string;
}

const MediaFilters: React.FC<MediaFiltersProps> = ({
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-4 flex-wrap', className)}>
      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          <button
            onClick={() => onTypeFilterChange('all')}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              typeFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            All
          </button>
          <button
            onClick={() => onTypeFilterChange('video')}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              typeFilter === 'video'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            Video
          </button>
          <button
            onClick={() => onTypeFilterChange('audio')}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              typeFilter === 'audio'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            Audio
          </button>
          <button
            onClick={() => onTypeFilterChange('image')}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              typeFilter === 'image'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            Image
          </button>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as typeof sortBy)}
          className="h-9 px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="name">Name</option>
          <option value="date">Date</option>
          <option value="size">Size</option>
          <option value="duration">Duration</option>
        </select>
        <button
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className={cn(
            'px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors',
            'flex items-center gap-1'
          )}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden ml-auto">
        <button
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'p-2 transition-colors',
            viewMode === 'grid'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          )}
          title="Grid view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={cn(
            'p-2 transition-colors',
            viewMode === 'list'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          )}
          title="List view"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MediaFilters;
