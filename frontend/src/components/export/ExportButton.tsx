import React from 'react';
import { Button } from '@/components/ui/button';
import { useExportStore } from '@/stores/useExportStore';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * ExportButton - Trigger button to open the export modal
 * 
 * Usage:
 * ```tsx
 * <ExportButton />
 * ```
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  variant = 'default',
  size = 'default',
  className,
}) => {
  const openWizard = useExportStore((state) => state.openWizard);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={openWizard}
      className={className}
    >
      <Download className="w-4 h-4 mr-2" />
      Export
    </Button>
  );
};
