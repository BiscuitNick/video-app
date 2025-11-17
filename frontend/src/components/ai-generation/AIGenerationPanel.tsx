import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import PromptInput from './PromptInput'
import GenerationQueue from './GenerationQueue'
import GenerationHistory from './GenerationHistory'
import { useAIGenerationStore, useMediaStore, useWebSocketStore } from '../../contexts/StoreContext'
import { generateImage, generateVideo, cancelGeneration as cancelGenerationAPI } from '../../services/aiGenerationService'
import { importFromUrl } from '../../services/uploadService'
import type { GenerationType, QualityTier } from '../../types/stores'

export default function AIGenerationPanel() {
  const [activeTab, setActiveTab] = useState('generate')

  // Get state and actions from stores - get the Map directly without transformation
  const activeGenerationsMap = useAIGenerationStore((state) => state.activeGenerations)
  const generationHistory = useAIGenerationStore((state) => state.generationHistory)
  const maxConcurrent = useAIGenerationStore((state) => state.maxConcurrentGenerations)

  // Get store actions
  const queueGeneration = useAIGenerationStore((state) => state.queueGeneration)
  const updateGenerationStatus = useAIGenerationStore((state) => state.updateGenerationStatus)
  const cancelGeneration = useAIGenerationStore((state) => state.cancelGeneration)
  const removeGeneration = useAIGenerationStore((state) => state.removeGeneration)
  const addToHistory = useAIGenerationStore((state) => state.addToHistory)
  const toggleFavorite = useAIGenerationStore((state) => state.toggleFavorite)
  const removeFromHistory = useAIGenerationStore((state) => state.removeFromHistory)

  const addAsset = useMediaStore((state) => state.addAsset)

  // Memoize the sorted array to prevent infinite loops
  const activeGenerations = useMemo(
    () =>
      Array.from(activeGenerationsMap.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
    [activeGenerationsMap]
  )

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
        const generationId = queueGeneration({
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
        updateGenerationStatus(generationId, 'generating', {
          jobId: response.job_id,
        })

        // Switch to queue tab to show progress
        setActiveTab('queue')
      } catch (error) {
        console.error('Failed to start generation:', error)
        // Note: Can't get generationId after error, would need to track it
      }
    },
    [queueGeneration, updateGenerationStatus]
  )

  // Handle generation cancellation
  const handleCancelGeneration = useCallback(
    async (generationId: string) => {
      const generation = activeGenerations.find((g) => g.id === generationId)
      if (generation?.jobId) {
        try {
          await cancelGenerationAPI(generation.jobId)
        } catch (error) {
          console.error('Failed to cancel generation:', error)
        }
      }
      cancelGeneration(generationId)
    },
    [activeGenerations, cancelGeneration]
  )

  // Handle removing completed/failed generations
  const handleRemoveGeneration = useCallback(
    (generationId: string) => {
      const generation = activeGenerations.find((g) => g.id === generationId)
      if (generation && (generation.status === 'completed' || generation.status === 'failed')) {
        // Add to history before removing
        if (generation.status === 'completed') {
          addToHistory(generation)
        }
        removeGeneration(generationId)
      }
    },
    [activeGenerations, addToHistory, removeGeneration]
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

  // Get WebSocket jobs Map
  const wsJobs = useWebSocketStore((state) => state.jobs)

  // Track processed job updates to prevent duplicate processing
  const processedJobsRef = useRef(new Map<string, { status: string; timestamp: number }>())

  // Sync WebSocket job updates to AI generation store
  useEffect(() => {
    // For each active generation with a jobId, check if there's a corresponding WebSocket job update
    activeGenerations.forEach((generation) => {
      if (!generation.jobId) return

      const job = wsJobs.get(generation.jobId)
      if (!job) return

      // Check if we've already processed this job update
      const processed = processedJobsRef.current.get(generation.jobId)

      // Skip if already processed this exact update (except for running jobs which can have progress updates)
      if (processed && processed.status === job.status && job.status !== 'running') {
        return
      }

      // Only update if generation is still in 'generating' or 'queued' status
      if (generation.status !== 'generating' && generation.status !== 'queued') return

      // Handle successful completion
      if (job.status === 'succeeded') {
        const result = job.result as { url?: string; output?: string[] } | undefined
        const resultUrl = result?.url || result?.output?.[0]

        if (resultUrl) {
          console.log(`[AIGenerationPanel] Job ${generation.jobId} completed with URL: ${resultUrl}`)

          // Mark as processed
          processedJobsRef.current.set(generation.jobId, {
            status: job.status,
            timestamp: Date.now()
          })

          // Update generation status to completed
          updateGenerationStatus(generation.id, 'completed', {
            resultUrl,
            progress: 100,
          })

          // Import to S3 and persist to database
          const assetName = `AI ${generation.type === 'image' ? 'Image' : 'Video'}: ${generation.prompt.substring(0, 30)}...`

          // Start import process (async, don't block UI)
          importFromUrl(
            resultUrl,
            assetName,
            generation.type === 'image' ? 'image' : 'video',
            {
              aiGenerated: true,
              prompt: generation.prompt,
              generationType: generation.type,
              qualityTier: generation.qualityTier,
              aspectRatio: generation.aspectRatio,
              replicateJobId: generation.jobId,
            }
          )
            .then((importedAsset) => {
              console.log(`[AIGenerationPanel] Successfully imported asset to S3: ${importedAsset.id}`)

              // Add the persisted asset to media store with permanent S3 URL
              addAsset({
                id: importedAsset.id,
                name: importedAsset.name,
                type: generation.type === 'image' ? 'image' : 'video',
                url: importedAsset.url, // Permanent S3 URL
                thumbnailUrl: importedAsset.thumbnail_url || (generation.type === 'image' ? importedAsset.url : undefined),
                size: importedAsset.size,
                duration: generation.type === 'video' ? 5 : undefined, // Default 5s for videos
                createdAt: new Date(importedAsset.created_at),
                metadata: importedAsset.metadata,
              })
            })
            .catch((error) => {
              console.error(`[AIGenerationPanel] Failed to import asset:`, error)

              // Fallback: Add temporary asset with Replicate URL
              addAsset({
                id: `ai-${generation.id}`,
                name: assetName,
                type: generation.type === 'image' ? 'image' : 'video',
                url: resultUrl,
                thumbnailUrl: generation.type === 'image' ? resultUrl : undefined,
                size: 0,
                duration: generation.type === 'video' ? 5 : undefined,
                createdAt: new Date(),
                metadata: {
                  aiGenerated: true,
                  prompt: generation.prompt,
                  generationType: generation.type,
                  qualityTier: generation.qualityTier,
                  importFailed: true,
                  importError: error instanceof Error ? error.message : 'Unknown error',
                },
              })
            })
        }
      }

      // Handle failure
      if (job.status === 'failed') {
        console.error(`[AIGenerationPanel] Job ${generation.jobId} failed:`, job.error)

        // Mark as processed
        processedJobsRef.current.set(generation.jobId, {
          status: job.status,
          timestamp: Date.now()
        })

        updateGenerationStatus(generation.id, 'failed', {
          error: job.error || 'Generation failed',
        })
      }

      // Handle cancellation
      if (job.status === 'canceled') {
        console.log(`[AIGenerationPanel] Job ${generation.jobId} was canceled`)

        // Mark as processed
        processedJobsRef.current.set(generation.jobId, {
          status: job.status,
          timestamp: Date.now()
        })

        updateGenerationStatus(generation.id, 'cancelled')
      }

      // Update progress for running jobs (allow repeated updates for progress)
      if (job.status === 'running' && job.progress !== undefined) {
        // Only update if progress has changed
        if (!processed || processed.status !== 'running' || Math.abs((job.progress || 0) - (processed.timestamp || 0)) > 5) {
          updateGenerationStatus(generation.id, 'generating', {
            progress: job.progress,
          })

          // Update processed status for running jobs
          processedJobsRef.current.set(generation.jobId, {
            status: job.status,
            timestamp: job.progress || 0
          })
        }
      }
    })
  }, [wsJobs, activeGenerations, updateGenerationStatus, addAsset])

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
              onToggleFavorite={toggleFavorite}
              onDelete={removeFromHistory}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
