import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileVideo, FileAudio, FileImage } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  className?: string;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  accept = 'video/*,audio/*,image/*',
  maxSize = 500 * 1024 * 1024, // 500MB default
  multiple = true,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${formatBytes(maxSize)}`);
        return;
      }

      // Check file type
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const fileType = file.type;
      const isAccepted = acceptedTypes.some((type) => {
        if (type === '*/*') return true;
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.replace('/*', ''));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        errors.push(`${file.name} is not an accepted file type`);
        return;
      }

      valid.push(file);
    });

    return { valid, errors };
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    if (errors.length > 0) {
      setError(errors.join(', '));
      setTimeout(() => setError(null), 5000);
    }

    if (valid.length > 0) {
      onFilesSelected(valid);
      setError(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-accent/50',
          error && 'border-destructive'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="flex gap-2">
              <FileVideo className="w-6 h-6 text-muted-foreground" />
              <FileAudio className="w-6 h-6 text-muted-foreground" />
              <FileImage className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="text-lg font-medium">
              {isDragging ? 'Drop files here' : 'Drag and drop media files'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Supported: Video, Audio, Image files</p>
            <p>Max size: {formatBytes(maxSize)}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
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

export default UploadZone;
