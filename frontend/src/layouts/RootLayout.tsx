import { Outlet, NavLink } from 'react-router';
import { ROUTES } from '../types/routes';
import {
  Home,
  FolderOpen,
  Film,
  Settings as SettingsIcon,
  Image,
  Menu,
  X
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useState, useEffect } from 'react';

/**
 * Root layout component with sidebar navigation and topbar
 */
export default function RootLayout() {
  // Get initial state from localStorage, default to true (expanded)
  const [isNavExpanded, setIsNavExpanded] = useState(() => {
    const saved = localStorage.getItem('nav-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('nav-expanded', JSON.stringify(isNavExpanded));
  }, [isNavExpanded]);

  const toggleNav = () => setIsNavExpanded(!isNavExpanded);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <aside className={`${isNavExpanded ? 'w-64' : 'w-0'} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Logo/Branding */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary whitespace-nowrap">Chronos Editor</h1>
          <button
            onClick={toggleNav}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-accent-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            to={ROUTES.HOME}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to={ROUTES.PROJECTS}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <FolderOpen className="w-5 h-5" />
            <span>Projects</span>
          </NavLink>

          <NavLink
            to={ROUTES.MEDIA}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Image className="w-5 h-5" />
            <span>Media Library</span>
          </NavLink>

          <NavLink
            to={ROUTES.SETTINGS}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Hamburger menu when nav is collapsed */}
            {!isNavExpanded && (
              <button
                onClick={toggleNav}
                className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-accent-foreground transition-colors"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Film className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">Video Editor</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome to Chronos</span>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-screen overflow-hidden bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
