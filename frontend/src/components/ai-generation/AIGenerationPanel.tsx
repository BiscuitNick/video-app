import { useState, useCallback, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import PromptInput from './PromptInput'
import GenerationQueue from './GenerationQueue'
import GenerationHistory from './GenerationHistory'
import { useAIGenerationStore } from '../../contexts/StoreContext'
import { useWebSocketStore } from '../../contexts/StoreContext'
import { useMediaStore } from '../../contexts/StoreContext'
import { generateImage, generateVideo, cancelGeneration as cancelGenerationAPI } from '../../services/aiGenerationService'
import type { GenerationType, QualityTier } from '../../types/stores'

export default function AIGenerationPanel() {
  const [activeTab, setActiveTab] = useState('generate')

  // Store hooks
  const aiStore = useAIGenerationStore()
  const wsStore = useWebSocketStore()
  const mediaStore = useMediaStore()

  // Get active generations and history
  const activeGenerations = useAIGenerationStore(
    (state) => Array.from(state.activeGenerations.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  )
  const generationHistory = useAIGenerationStore((state) => state.generationHistory)
  const maxConcurrent = useAIGenerationStore((state) => state.maxConcurrentGenerations)

  // Check if we can queue more generations
  const activeCount = activeGenerations.filter(
    (g) => g.status === 'generating' || g.status === 'queued'
  ).length
  const canGenerate = activeCount < maxConcurrent

  // Handle generation request
  const handleGenerate = useCallback(
    async (params: {
      prompt: string
      type: GenerationType
      qualityTier: QualityTier
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
    }) => {
      try {
        // Queue the generation in the store
        const generationId = aiStore.queueGeneration({
          type: params.type,
          prompt: params.prompt,
          qualityTier: params.qualityTier,
          aspectRatio: params.aspectRatio,
        })

        // Call the appropriate API based on type
        let response
        if (params.type === 'image') {
          response = await generateImage({
            prompt: params.prompt,
            qualityTier: params.qualityTier,
            aspectRatio: params.aspectRatio,
          })
        } else {
          response = await generateVideo({
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
          })
        }

        // Update with job ID
        aiStore.updateGenerationStatus(generationId, 'generating', {
          jobId: response.job_id,
        })

        // Switch to queue tab to show progress
        setActiveTab('queue')
      } catch (error) {
        console.error('Failed to start generation:', error)
        // Update status to failed
        const genId = Array.from(aiStore.activeGenerations.keys()).pop()
        if (genId) {
          aiStore.updateGenerationStatus(genId, 'failed', {
            error: error instanceof Error ? error.message : 'Failed to start generation',
          })
        }
      }
    },
    [aiStore]
  )

  // Handle generation cancellation
  const handleCancelGeneration = useCallback(
    async (generationId: string) => {
      const generation = aiStore.activeGenerations.get(generationId)
      if (generation?.jobId) {
        try {
          await cancelGenerationAPI(generation.jobId)
        } catch (error) {
          console.error('Failed to cancel generation:', error)
        }
      }
      aiStore.cancelGeneration(generationId)
    },
    [aiStore]
  )

  // Handle removing completed/failed generations
  const handleRemoveGeneration = useCallback(
    (generationId: string) => {
      const generation = aiStore.activeGenerations.get(generationId)
      if (generation && (generation.status === 'completed' || generation.status === 'failed')) {
        // Add to history before removing
        if (generation.status === 'completed') {
          aiStore.addToHistory(generation)
        }
        aiStore.removeGeneration(generationId)
      }
    },
    [aiStore]
  )

  // Handle rerunning a generation from history
  const handleRerun = useCallback(
    (prompt: string, type: 'image' | 'video', aspectRatio: string, qualityTier?: string) => {
      handleGenerate({
        prompt,
        type,
        qualityTier: (qualityTier as QualityTier) || 'draft',
        aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3',
      })
    },
    [handleGenerate]
  )

  // Listen to WebSocket job updates
  useEffect(() => {
    const handleJobUpdate = (jobId: string, status: string, progress?: number, resultUrl?: string, error?: string) => {
      // Find generation with this job ID
      const generation = Array.from(aiStore.activeGenerations.values()).find((g) => g.jobId === jobId)
      if (!generation) return

      // Update generation status
      if (status === 'succeeded' || status === 'completed') {
        aiStore.updateGenerationStatus(generation.id, 'completed', {
          resultUrl,
          progress: 100,
        })

        // Auto-import to media library
        if (resultUrl) {
          mediaStore.addAsset({
            id: `ai-gen-${Date.now()}`,
            name: `AI Generated ${generation.type}`,
            type: generation.type === 'video' ? 'video' : 'image',
            url: resultUrl,
            size: 0, // Size unknown
            createdAt: new Date(),
            metadata: {
              aiGenerated: true,
              prompt: generation.prompt,
              generationType: generation.type,
            },
          })
        }
      } else if (status === 'failed') {
        aiStore.updateGenerationStatus(generation.id, 'failed', {
          error: error || 'Generation failed',
        })
      } else if (status === 'running') {
        aiStore.updateGenerationProgress(generation.id, progress || 0)
      }
    }

    // Subscribe to WebSocket job updates
    // This is a simplified version - in reality, you'd listen to WebSocket events
    // For now, we'll rely on the WebSocketStore to handle updates
    const unsubscribe = wsStore.handleJobUpdate

    return () => {
      // Cleanup
    }
  }, [aiStore, mediaStore, wsStore])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-zinc-800 px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="queue">
              Queue
              {activeCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="generate" className="p-4 m-0">
            {!canGenerate && (
              <div className="mb-4 p-3 bg-yellow-950/30 border border-yellow-900/50 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Maximum concurrent generations reached ({maxConcurrent}). Please wait for current
                  generations to complete.
                </p>
              </div>
            )}
            <PromptInput onGenerate={handleGenerate} isGenerating={!canGenerate} />
          </TabsContent>

          <TabsContent value="queue" className="p-4 m-0">
            <GenerationQueue
              generations={activeGenerations}
              onCancel={handleCancelGeneration}
              onRemove={handleRemoveGeneration}
            />
          </TabsContent>

          <TabsContent value="history" className="p-4 m-0">
            <GenerationHistory
              history={generationHistory}
              onRerun={handleRerun}
              onToggleFavorite={aiStore.toggleFavorite}
              onDelete={aiStore.removeFromHistory}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
