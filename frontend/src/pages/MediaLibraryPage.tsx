import { Upload, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import AIGenerationPanel from '../components/ai-generation/AIGenerationPanel';

/**
 * Media library page for asset management interface
 */
export default function MediaLibraryPage() {
  const [showAIPanel, setShowAIPanel] = useState(false);

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-zinc-100">Media Library</h1>
              <p className="text-zinc-400 mt-2">Manage your media assets</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showAIPanel
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                AI Generate
              </button>
              <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Upload className="w-5 h-5" />
                Upload Media
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search media..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Media Grid Placeholder */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Empty State */}
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg p-12 max-w-md">
                <Upload className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-zinc-300 mb-2">No media yet</h3>
                <p className="text-zinc-500 mb-6">
                  Upload images, videos, or audio files, or generate content with AI
                </p>
                <div className="flex gap-2 justify-center">
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                    Upload Media
                  </button>
                  <button
                    onClick={() => setShowAIPanel(true)}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Generation Panel (Slide-in from right) */}
      {showAIPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowAIPanel(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-[450px] bg-zinc-950 border-l border-zinc-800 z-50 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Generation
              </h2>
              <button
                onClick={() => setShowAIPanel(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="h-[calc(100%-65px)]">
              <AIGenerationPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
