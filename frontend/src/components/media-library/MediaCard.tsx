import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/types/api';
import {
  FileVideo,
  FileAudio,
  FileImage,
  MoreVertical,
  Edit2,
  Trash2,
  FolderInput,
} from 'lucide-react';

interface MediaCardProps {
  asset: MediaAsset;
  isSelected: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onMove?: (id: string) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({
  asset,
  isSelected,
  onSelect,
  onDelete,
  onRename,
  onMove,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(asset.name);

  const getTypeIcon = () => {
    switch (asset.type) {
      case 'video':
        return <FileVideo className="w-8 h-8" />;
      case 'audio':
        return <FileAudio className="w-8 h-8" />;
      case 'image':
        return <FileImage className="w-8 h-8" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(asset.id, e.ctrlKey || e.metaKey);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu(!showContextMenu);
  };

  const handleRename = () => {
    setIsEditing(true);
    setShowContextMenu(false);
  };

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== asset.name) {
      onRename(asset.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowContextMenu(false);
    onDelete(asset.id);
  };

  const handleMove = () => {
    setShowContextMenu(false);
    if (onMove) {
      onMove(asset.id);
    }
  };

  return (
    <div
      className={cn(
        'relative group rounded-lg border-2 bg-card overflow-hidden cursor-pointer transition-all hover:shadow-lg',
        isSelected ? 'border-primary ring-2 ring-primary' : 'border-border'
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground">{getTypeIcon()}</div>
        )}

        {/* Duration badge for video/audio */}
        {asset.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {formatDuration(asset.duration)}
          </div>
        )}

        {/* Context menu button */}
        <button
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleContextMenu}
        >
          <MoreVertical className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Metadata */}
      <div className="p-3">
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

        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
          <div>{formatFileSize(asset.size)}</div>
          {asset.metadata.width && asset.metadata.height && (
            <div>
              {asset.metadata.width} × {asset.metadata.height}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div className="absolute top-12 right-2 z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg overflow-hidden">
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              onClick={handleRename}
            >
              <Edit2 className="w-4 h-4" />
              Rename
            </button>
            {onMove && (
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                onClick={handleMove}
              >
                <FolderInput className="w-4 h-4" />
                Move to folder
              </button>
            )}
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-accent text-destructive flex items-center gap-2"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MediaCard;
