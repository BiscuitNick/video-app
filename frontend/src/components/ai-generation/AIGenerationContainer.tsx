import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Sparkles, List, History } from 'lucide-react';
import { AIGenerationModal } from './AIGenerationModal';
import { GenerationQueueViewer } from './GenerationQueueViewer';
import { GenerationHistory } from './GenerationHistory';
import { useAIGeneration } from '../../hooks/useAIGeneration';
import type { ReplicateGenerationRequest } from '../../types/replicate';

interface AIGenerationContainerProps {
  projectId?: string;
}

export function AIGenerationContainer({ projectId }: AIGenerationContainerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');

  const {
    queue,
    history,
    isConnected,
    isGenerating,
    generate,
    cancelGeneration,
    removeFromQueue,
    clearCompleted,
    importToLibrary,
    deleteHistoryItem,
    clearHistory,
    getStatistics,
  } = useAIGeneration(projectId);

  const handleGenerate = async (request: ReplicateGenerationRequest) => {
    try {
      await generate(request);
      setActiveTab('queue');
    } catch (error) {
      console.error('Failed to generate:', error);
      alert('Failed to start generation. Please try again.');
    }
  };

  const handleImport = async (item: any) => {
    if (!projectId) {
      alert('Please select a project first');
      return;
    }

    try {
      const mediaAsset = await importToLibrary(item);
      alert(`Successfully imported to library: ${mediaAsset?.name}`);
    } catch (error) {
      console.error('Failed to import:', error);
      alert('Failed to import to library. Please try again.');
    }
  };

  const stats = getStatistics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Generation
              </CardTitle>
              <CardDescription>
                Generate images and videos using AI, manage your queue, and view history
              </CardDescription>
            </div>
            <Button onClick={() => setModalOpen(true)} size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              New Generation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {queue.length} active {queue.length === 1 ? 'generation' : 'generations'}
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.total} total history items
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue" className="gap-2">
            <List className="h-4 w-4" />
            Queue ({queue.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History ({stats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Generation Queue</h3>
            {queue.some(
              (item) => item.status === 'completed' || item.status === 'failed'
            ) && (
              <Button variant="outline" size="sm" onClick={clearCompleted}>
                Clear Completed
              </Button>
            )}
          </div>
          <GenerationQueueViewer
            queue={queue}
            onCancel={cancelGeneration}
            onRemove={removeFromQueue}
            onDownload={handleImport}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <GenerationHistory
            history={history}
            onImport={handleImport}
            onDelete={deleteHistoryItem}
            onClearAll={clearHistory}
          />
        </TabsContent>
      </Tabs>

      {/* Generation Modal */}
      <AIGenerationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onGenerate={handleGenerate}
      />
    </div>
  );
}

export default AIGenerationContainer;
