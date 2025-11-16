import { Routes, Route } from 'react-router';
import { ROUTES } from '../types/routes';
import RootLayout from '../layouts/RootLayout';
import LandingPage from '../pages/LandingPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectEditorPage from '../pages/ProjectEditorPage';
import MediaLibraryPage from '../pages/MediaLibraryPage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';

/**
 * Main application routes configuration with type-safe paths
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
        <Route path={ROUTES.PROJECT_EDITOR} element={<ProjectEditorPage />} />
        <Route path={ROUTES.MEDIA} element={<MediaLibraryPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
