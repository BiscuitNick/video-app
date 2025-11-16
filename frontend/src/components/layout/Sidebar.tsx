import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMediaLibrary } from '../../hooks/useMediaLibrary';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

/**
 * Sidebar component
 * Collapsible panel for media library, effects, and tools
 */
export default function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState<'media' | 'effects' | 'tools'>('media');
  const { data: mediaData } = useMediaLibrary(projectId);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-100 border-r flex flex-col items-center py-4 gap-4">
        <button
          onClick={onToggle}
          className="text-gray-600 hover:text-gray-900 transition-colors"
          title="Expand sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-gray-50 border-r flex flex-col">
      {/* Sidebar header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Sidebar</h2>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-600 hover:text-gray-900 transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            activeTab === 'media'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Media
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            activeTab === 'effects'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Effects
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            activeTab === 'tools'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tools
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'media' && (
          <div className="space-y-2">
            <div className="mb-4">
              <button className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium">
                + Upload Media
              </button>
            </div>

            {mediaData?.items && mediaData.items.length > 0 ? (
              mediaData.items.map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 bg-white border rounded hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <div className="aspect-video bg-gray-200 rounded mb-2 flex items-center justify-center text-gray-400">
                    {asset.type === 'video' && '🎬'}
                    {asset.type === 'audio' && '🎵'}
                    {asset.type === 'image' && '🖼️'}
                  </div>
                  <div className="text-xs font-medium truncate">{asset.name}</div>
                  <div className="text-xs text-gray-500">
                    {(asset.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">
                No media assets yet. Upload some media to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-4">Video Effects</div>
            {['Blur', 'Brightness', 'Contrast', 'Saturation', 'Color Grading'].map(
              (effect) => (
                <div
                  key={effect}
                  className="p-3 bg-white border rounded hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <div className="text-sm font-medium">{effect}</div>
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-4">Editing Tools</div>
            {['Cut', 'Trim', 'Split', 'Merge', 'Speed'].map((tool) => (
              <div
                key={tool}
                className="p-3 bg-white border rounded hover:border-blue-500 cursor-pointer transition-colors"
              >
                <div className="text-sm font-medium">{tool}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
