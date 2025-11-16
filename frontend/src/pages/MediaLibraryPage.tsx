import { Upload, Search } from 'lucide-react';

/**
 * Media library page for asset management interface
 */
export default function MediaLibraryPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Media Library</h1>
            <p className="text-zinc-400 mt-2">Manage your media assets</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
            <Upload className="w-5 h-5" />
            Upload Media
          </button>
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
                Upload images, videos, or audio files to get started
              </p>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                Upload Media
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
