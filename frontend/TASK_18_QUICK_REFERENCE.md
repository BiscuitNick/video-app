# Task 18: AI Generation - Quick Reference

## 🚀 Quick Start

```typescript
import { AIGenerationContainer } from '@/components/ai-generation';

function MyPage() {
  return <AIGenerationContainer projectId="project-123" />;
}
```

---

## 📦 Main Components

### AIGenerationContainer
**Path:** `@/components/ai-generation`

**Props:**
- `projectId?: string` - Required for auto-import functionality

**Usage:**
```typescript
<AIGenerationContainer projectId={currentProjectId} />
```

### AIGenerationModal
**Path:** `@/components/ai-generation/AIGenerationModal`

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `onGenerate: (request: ReplicateGenerationRequest) => void`

**Usage:**
```typescript
<AIGenerationModal
  open={isOpen}
  onOpenChange={setIsOpen}
  onGenerate={handleGenerate}
/>
```

---

## 🎣 Custom Hook

### useAIGeneration

```typescript
const {
  // State
  queue,              // GenerationQueueItem[]
  history,            // GenerationHistoryItem[]
  isConnected,        // boolean - WebSocket status
  isGenerating,       // boolean - Any active generations

  // Queue Actions
  generate,           // (request, priority?) => Promise<GenerationQueueItem>
  cancelGeneration,   // (id) => Promise<void>
  removeFromQueue,    // (id) => void
  clearCompleted,     // () => void

  // History Actions
  importToLibrary,    // (item) => Promise<MediaAsset>
  deleteHistoryItem,  // (id) => void
  clearHistory,       // () => void
  getFilteredHistory, // (filter?) => GenerationHistoryItem[]
  getStatistics,      // () => Statistics
} = useAIGeneration(projectId);
```

---

## 🔧 Services

### ReplicateService

```typescript
import { replicateService } from '@/services/api/replicate';

// Generate image
await replicateService.generateImage({
  prompt: 'A beautiful sunset',
  aspectRatio: '16:9',
  numInferenceSteps: 4,
  guidanceScale: 3.5,
});

// Generate video
await replicateService.generateVideo({
  prompt: 'Waves crashing on beach',
  aspectRatio: '16:9',
  fps: 24,
  duration: 3,
  motionScale: 1.0,
});

// Get status
await replicateService.getGenerationStatus(generationId);

// Cancel
await replicateService.cancelGeneration(generationId);
```

### GenerationQueueManager

```typescript
import { getQueueManager } from '@/services/generationQueueManager';

const queueManager = getQueueManager({
  onUpdate: (queue) => console.log('Queue updated:', queue),
  onComplete: (item) => console.log('Completed:', item),
  onError: (item, error) => console.error('Error:', error),
});

// Add to queue
const item = await queueManager.addToQueue(request, priority);

// Update progress
queueManager.updateProgress(id, 50, 120); // 50%, 120s remaining
```

### WebSocketProgressService

```typescript
import { webSocketProgressService } from '@/services/webSocketProgressService';

// Connect
webSocketProgressService.connect();

// Subscribe to generation
const unsubscribe = webSocketProgressService.subscribe(
  generationId,
  (event) => {
    console.log('Progress:', event.progress);
  }
);

// Cleanup
unsubscribe();
webSocketProgressService.disconnect();
```

### GenerationHistoryService

```typescript
import { getHistoryService } from '@/services/generationHistoryService';

const historyService = getHistoryService();

// Get history
const all = historyService.getHistory();
const filtered = historyService.getHistory({
  type: 'image',
  status: 'completed',
  searchQuery: 'sunset',
});

// Auto-import
const mediaAsset = await historyService.autoImport(projectId, historyItem);

// Statistics
const stats = historyService.getStatistics();
// { total, completed, failed, images, videos, imported }
```

---

## 📋 Type Reference

### ReplicateGenerationRequest

```typescript
{
  prompt: string;
  type: 'image' | 'video';
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16';
  templateId?: string;
  advancedSettings?: {
    // Image settings
    numInferenceSteps?: number;
    guidanceScale?: number;
    seed?: number;

    // Video settings
    fps?: number;
    duration?: number;
    motionScale?: number;
  };
}
```

### GenerationQueueItem

```typescript
{
  id: string;
  request: ReplicateGenerationRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  progress: number;
  outputUrl?: string;
  error?: string;
  estimatedTimeRemaining?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### GenerationHistoryItem

```typescript
{
  id: string;
  request: ReplicateGenerationRequest;
  status: GenerationStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  mediaId?: string;
  createdAt: string;
  completedAt?: string;
}
```

---

## 🎨 Templates

```typescript
import {
  imageTemplates,
  videoTemplates,
  getTemplatesByType,
  getTemplateById,
} from '@/data/generationTemplates';

// Get all image templates
const imagePresets = getTemplatesByType('image');

// Get specific template
const template = getTemplateById('cinematic');
```

### Available Templates

**Images:**
- `cinematic` - Cinematic Shot
- `product` - Product Photography
- `landscape` - Landscape
- `portrait` - Portrait
- `abstract` - Abstract Art

**Videos:**
- `motion` - Dynamic Motion
- `subtle` - Subtle Animation
- `atmospheric` - Atmospheric

---

## ⚙️ Configuration

### Queue Limits
```typescript
import { MAX_GENERATIONS } from '@/services/generationQueueManager';
// Default: 5
```

### History Limits
```typescript
// Max 100 items in history
// Auto-prunes oldest items
```

### WebSocket Reconnection
```typescript
// Max attempts: 5
// Initial delay: 1s
// Max delay: 30s
// Exponential backoff
```

---

## 🔍 Debugging

Enable debug mode in `.env`:
```bash
VITE_ENABLE_DEBUG=true
```

This enables detailed console logging for:
- API requests/responses
- WebSocket events
- Queue updates
- Service operations

---

## 📊 Statistics

```typescript
const stats = getStatistics();
```

Returns:
```typescript
{
  total: number;        // Total history items
  completed: number;    // Completed generations
  failed: number;       // Failed generations
  images: number;       // Image generations
  videos: number;       // Video generations
  imported: number;     // Imported to library
}
```

---

## 🎯 Common Patterns

### Pattern 1: Simple Generation
```typescript
const { generate } = useAIGeneration();

await generate({
  prompt: 'A sunset over mountains',
  type: 'image',
  aspectRatio: '16:9',
});
```

### Pattern 2: Generation with Template
```typescript
import { getTemplateById } from '@/data/generationTemplates';

const template = getTemplateById('cinematic');
await generate({
  ...template.request,
  prompt: 'Your custom prompt here',
});
```

### Pattern 3: High Priority Generation
```typescript
await generate(request, 10); // priority = 10
```

### Pattern 4: Auto-Import on Complete
```typescript
const { generate, importToLibrary } = useAIGeneration(projectId);

const item = await generate(request);

// Later, when completed
await importToLibrary(historyItem);
```

### Pattern 5: Monitor Progress
```typescript
useEffect(() => {
  const unsubscribe = webSocketProgressService.subscribe(
    generationId,
    (event) => {
      console.log(`Progress: ${event.progress}%`);
      if (event.status === 'completed') {
        console.log('Download:', event.outputUrl);
      }
    }
  );

  return unsubscribe;
}, [generationId]);
```

---

## 🚨 Error Handling

### API Errors
```typescript
try {
  await generate(request);
} catch (error) {
  if (error.status === 429) {
    // Rate limited
  } else if (error.status === 500) {
    // Server error
  }
  console.error(error.message);
}
```

### Queue Full
```typescript
try {
  await queueManager.addToQueue(request);
} catch (error) {
  if (error.message.includes('Queue is full')) {
    // Handle queue full
  }
}
```

### Import Errors
```typescript
try {
  await importToLibrary(historyItem);
} catch (error) {
  // Handle import failure
  console.error('Import failed:', error);
}
```

---

## 📱 Responsive Design

All components are fully responsive:
- Modal: Max width 2xl, scrollable
- Queue: Stacked cards on mobile
- History: Responsive grid (1-3 columns)
- All touch-friendly

---

## ♿ Accessibility

- Keyboard navigation: ✅
- Screen reader support: ✅
- Focus management: ✅
- ARIA labels: ✅
- Color contrast: ✅

---

## 🔐 Security

- Authentication: Inherited from API client
- Input validation: Client-side
- XSS protection: React auto-escape
- CORS: Backend handled
- Rate limiting: Queue limit (5)

---

## 📦 Exports

### Components
```typescript
import {
  AIGenerationModal,
  GenerationQueueViewer,
  GenerationHistory,
  AIGenerationContainer,
} from '@/components/ai-generation';
```

### Services
```typescript
import { replicateService } from '@/services/api/replicate';
import { getQueueManager } from '@/services/generationQueueManager';
import { webSocketProgressService } from '@/services/webSocketProgressService';
import { getHistoryService } from '@/services/generationHistoryService';
```

### Hooks
```typescript
import { useAIGeneration } from '@/hooks/useAIGeneration';
```

### Types
```typescript
import type {
  ReplicateGenerationRequest,
  GenerationQueueItem,
  GenerationHistoryItem,
  AspectRatio,
  GenerationType,
  GenerationStatus,
} from '@/types/replicate';
```

---

## 📝 Notes

1. **Project ID required for import** - Pass to `useAIGeneration(projectId)`
2. **Queue limit is 5** - Prevent resource exhaustion
3. **History limit is 100** - Auto-prunes oldest
4. **WebSocket auto-reconnects** - Exponential backoff
5. **LocalStorage persistence** - Queue and history saved

---

## 🎓 Learn More

- Full Implementation: `TASK_18_AI_GENERATION_IMPLEMENTATION.md`
- Type Definitions: `src/types/replicate.ts`
- Service Code: `src/services/`
- Component Code: `src/components/ai-generation/`

---

**Last Updated:** November 16, 2025
