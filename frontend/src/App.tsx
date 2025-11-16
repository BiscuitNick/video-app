import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/query-client';
import ErrorBoundary from './components/errors/ErrorBoundary';
import QueryErrorBoundary from './components/errors/QueryErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Settings from './pages/Settings';
import Export from './pages/Export';

/**
 * Main App component
 * Sets up routing, React Query, and error boundaries
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <QueryErrorBoundary>
          <BrowserRouter>
            <Routes>
              {/* Main layout routes */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/editor/:projectId" element={<Editor />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Export modal route (no layout) */}
              <Route path="/export" element={<Export />} />

              {/* Catch-all redirect to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>

          {/* React Query Devtools - only in development */}
          <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        </QueryErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
