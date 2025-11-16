import { useParams } from 'react-router';
import { Play, SkipBack, SkipForward } from 'lucide-react';

/**
 * Project editor page with basic editor shell and route param handling
 */
export default function ProjectEditorPage() {
  const { projectId } = useParams();

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Editor Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Project Editor</h2>
            <p className="text-sm text-zinc-500">Project ID: {projectId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
              Save
            </button>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col bg-zinc-950 p-6">
          <div className="flex-1 flex items-center justify-center bg-black rounded-lg border border-zinc-800">
            <div className="text-center text-zinc-600">
              <Play className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">Preview Area</p>
              <p className="text-sm mt-2">Timeline clips will appear here</p>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <button className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
              <SkipBack className="w-5 h-5 text-zinc-300" />
            </button>
            <button className="p-4 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
              <Play className="w-6 h-6 text-white" />
            </button>
            <button className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
              <SkipForward className="w-5 h-5 text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Properties</h3>
          <div className="space-y-4">
            <div className="p-4 bg-zinc-800 rounded-lg text-center text-zinc-500">
              <p className="text-sm">Select a clip to edit properties</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="h-64 bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="h-full flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
          <div className="text-center text-zinc-600">
            <p className="text-lg">Timeline</p>
            <p className="text-sm mt-2">Drag media here to start editing</p>
          </div>
        </div>
      </div>
    </div>
  );
}
