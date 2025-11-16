import { useProjects, useCreateProject } from '../hooks/useProjects';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Dashboard page - shows all projects
 */
export default function Dashboard() {
  const { data: projectsData, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      const newProject = await createProject.mutateAsync({
        name: 'Untitled Project',
        description: 'New video project',
        project_data: {}
      });
      navigate(`/editor/${newProject.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          Error loading projects: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Projects</h1>
          <p className="text-gray-600">Manage your video editing projects</p>
        </div>
        <button
          onClick={handleCreateProject}
          disabled={isCreating}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          {isCreating ? 'Creating...' : '+ New Project'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projectsData?.projects.map((project) => (
          <div
            key={project.id}
            className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
            {project.description && (
              <p className="text-gray-600 text-sm mb-4">{project.description}</p>
            )}
            <div className="text-xs text-gray-500">
              Last modified: {new Date(project.lastModified).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {projectsData?.projects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects yet. Create your first project to get started!
        </div>
      )}
    </div>
  );
}
