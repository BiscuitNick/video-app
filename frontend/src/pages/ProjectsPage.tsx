import { Plus } from 'lucide-react';

/**
 * Projects page with project list placeholder
 */
export default function ProjectsPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Projects</h1>
            <p className="text-zinc-400 mt-2">Manage your video editing projects</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        {/* Project List Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Empty State */}
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg p-12 max-w-md">
              <Plus className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No projects yet</h3>
              <p className="text-zinc-500 mb-6">
                Create your first project to start editing videos
              </p>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                Create Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
