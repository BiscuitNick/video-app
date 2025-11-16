import { Link, useLocation, useParams } from 'react-router-dom';
import { useProject } from '../../hooks/useProjects';
import { useState, useEffect } from 'react';

/**
 * Header component
 * Shows project name, save status, and user menu
 */
export default function Header() {
  const location = useLocation();
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Simulate save status (in real app, this would come from a save hook)
  useEffect(() => {
    // This is a placeholder - real implementation would track composition changes
    const interval = setInterval(() => {
      setSaveStatus('saved');
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isEditorPage = location.pathname.includes('/editor/');

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        {/* Logo */}
        <Link to="/" className="font-bold text-xl text-blue-600 hover:text-blue-700">
          VideoApp
        </Link>

        {/* Breadcrumb separator */}
        {isEditorPage && project && (
          <>
            <span className="text-gray-400">/</span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">{project.name}</span>
              {saveStatus === 'saved' && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                  Saved
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="text-xs text-yellow-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></span>
                  Saving...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  Unsaved changes
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right side - actions and user menu */}
      <div className="flex items-center gap-4">
        {isEditorPage && projectId && (
          <Link
            to={`/export?projectId=${projectId}`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Export
          </Link>
        )}

        <Link
          to="/settings"
          className="text-gray-600 hover:text-gray-900 transition-colors"
          title="Settings"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>

        {/* User menu placeholder */}
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
          U
        </div>
      </div>
    </header>
  );
}
