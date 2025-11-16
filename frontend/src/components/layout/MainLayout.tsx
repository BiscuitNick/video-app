import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

/**
 * MainLayout wrapper
 * Responsive grid layout with header and optional sidebar
 */
export default function MainLayout() {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Determine if we should show the sidebar (only on editor page)
  const isEditorPage = location.pathname.includes('/editor/');
  const isExportPage = location.pathname.includes('/export');

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {!isExportPage && <Header />}

      {/* Mobile menu button (hamburger) */}
      {isEditorPage && !isExportPage && (
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - desktop */}
        {isEditorPage && !isExportPage && (
          <div className="hidden md:block">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          </div>
        )}

        {/* Sidebar - mobile (overlay) */}
        {isEditorPage && !isExportPage && isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <div className="md:hidden fixed left-0 top-16 bottom-0 z-50 w-64">
              <Sidebar onToggle={() => setIsMobileMenuOpen(false)} />
            </div>
          </>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
