import { useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';

/**
 * Editor page - main video editing interface
 */
export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading: projectLoading } = useProject(projectId);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading editor...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Project not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Editor header */}
      <div className="bg-gray-800 text-white p-4">
        <h1 className="text-xl font-semibold">{project.name}</h1>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex">
        {/* Sidebar - media library and effects */}
        <div className="w-64 bg-gray-100 border-r p-4">
          <h2 className="font-semibold mb-4">Media Library</h2>
          <p className="text-sm text-gray-600">Media assets will appear here</p>
        </div>

        {/* Center - preview and timeline */}
        <div className="flex-1 flex flex-col">
          {/* Preview */}
          <div className="flex-1 bg-black flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-4xl mb-2">▶</div>
              <div>Preview Window</div>
              <div className="text-sm text-gray-400 mt-2">
                {project.resolution.width} × {project.resolution.height} @ {project.fps} fps
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="h-64 bg-gray-900 border-t border-gray-700 p-4">
            <div className="text-white text-sm mb-2">Timeline</div>
            <div className="text-gray-400 text-xs">
              Composition tracks will appear here
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-64 bg-gray-100 border-l p-4">
          <h2 className="font-semibold mb-4">Properties</h2>
          <p className="text-sm text-gray-600">Clip properties will appear here</p>
        </div>
      </div>
    </div>
  );
}
