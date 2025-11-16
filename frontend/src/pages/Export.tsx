import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { useExportPresets } from '../hooks/useExports';

/**
 * Export page - export configuration modal
 */
export default function Export() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const { data: project } = useProject(projectId || undefined);
  const { data: presets } = useExportPresets();

  const handleClose = () => {
    if (projectId) {
      navigate(`/editor/${projectId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Export Video</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {project && (
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm font-medium text-gray-700">Project</div>
              <div className="text-lg font-semibold">{project.name}</div>
            </div>
          )}

          {/* Export Presets */}
          <div>
            <label className="block text-sm font-medium mb-3">Export Preset</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets?.map((preset) => (
                <button
                  key={preset.id}
                  className="border rounded-lg p-4 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-semibold">{preset.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {preset.format.toUpperCase()} • {preset.quality} • {preset.resolution.width}×
                    {preset.resolution.height}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Custom Settings</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <select className="border rounded px-3 py-2 w-full">
                <option>MP4</option>
                <option>MOV</option>
                <option>WebM</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Quality</label>
              <select className="border rounded px-3 py-2 w-full">
                <option>Ultra</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Resolution</label>
              <select className="border rounded px-3 py-2 w-full">
                <option>Same as project</option>
                <option>3840 × 2160 (4K)</option>
                <option>1920 × 1080 (Full HD)</option>
                <option>1280 × 720 (HD)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Start Export
          </button>
        </div>
      </div>
    </div>
  );
}
