import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportQueue } from './ExportQueue';
import { ExportHistory } from './ExportHistory';
import { useExportStore } from '@/stores/useExportStore';

/**
 * ExportManager - Combined view of export queue and history
 * 
 * Displays:
 * - Active exports in a queue
 * - Historical exports with download/share capabilities
 * 
 * Usage:
 * ```tsx
 * <ExportManager />
 * ```
 */
export const ExportManager: React.FC = () => {
  const hasActiveExports = useExportStore((state) => state.hasActiveExports());

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Tabs defaultValue={hasActiveExports ? 'queue' : 'history'}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue">
            Active Exports
            {hasActiveExports && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {useExportStore.getState().activeExports.size}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-6">
          <ExportQueue />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <ExportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};
