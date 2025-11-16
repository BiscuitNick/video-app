import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useExportStore } from '@/stores/useExportStore';
import { exportsApi } from '@/services/api/exports';
import { useAppStore } from '@/stores/useAppStore';
import { AlertCircle } from 'lucide-react';

export const ExportReview: React.FC = () => {
  const { settings, setCurrentStep, addActiveExport } = useExportStore();
  const project = useAppStore((state) => state.project);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!settings) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No settings configured
      </div>
    );
  }

  const handleBack = () => {
    setCurrentStep('settings');
  };

  const handleStartExport = async () => {
    if (!project.id) {
      setError('No project loaded');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // Create export job via API
      const exportJob = await exportsApi.create({
        projectId: project.id,
        compositionId: project.id, // Assuming composition ID matches project ID
        format: settings.format,
        quality: settings.quality === 100 ? 'ultra' : settings.quality >= 75 ? 'high' : settings.quality >= 50 ? 'medium' : 'low',
        resolution: settings.resolution,
      });

      // Add to active exports
      addActiveExport(exportJob);

      // Move to progress step
      setCurrentStep('progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start export');
    } finally {
      setIsStarting(false);
    }
  };

  const getQualityLabel = (quality: number): string => {
    if (quality >= 90) return 'Ultra';
    if (quality >= 70) return 'High';
    if (quality >= 40) return 'Good';
    if (quality >= 20) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Review Export Settings</h3>
        <p className="text-sm text-muted-foreground">
          Please review your export settings before starting the export process
        </p>
      </div>

      <Card className="p-6">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Name</dt>
            <dd className="text-base mt-1">{settings.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Aspect Ratio
            </dt>
            <dd className="text-base mt-1">{settings.aspectRatio}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Resolution
            </dt>
            <dd className="text-base mt-1">
              {settings.resolution.width} x {settings.resolution.height}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Format</dt>
            <dd className="text-base mt-1">{settings.format.toUpperCase()}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Quality</dt>
            <dd className="text-base mt-1">
              {getQualityLabel(settings.quality)} ({settings.quality}%)
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Frame Rate
            </dt>
            <dd className="text-base mt-1">{settings.frameRate} FPS</dd>
          </div>
        </dl>
      </Card>

      {/* Estimated Size/Time */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Estimated Export Time</p>
            <p className="text-muted-foreground mt-1">
              Export time will vary based on project complexity and system
              performance. You can monitor progress in the next step.
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Error</p>
              <p className="text-destructive/90 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between space-x-2">
        <Button variant="outline" onClick={handleBack} disabled={isStarting}>
          Back to Settings
        </Button>
        <Button onClick={handleStartExport} disabled={isStarting}>
          {isStarting ? 'Starting Export...' : 'Start Export'}
        </Button>
      </div>
    </div>
  );
};
