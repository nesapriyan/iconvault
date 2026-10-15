import { useState, useRef, useEffect } from 'react';
import { 
  Layers, 
  Sun, 
  Moon, 
  Keyboard, 
  FolderPlus, 
  Upload, 
  X, 
  Users, 
  ShieldCheck, 
  User as UserIcon, 
  ChevronDown, 
  Check, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from './AuthModal';
import { UserManagementModal } from '../users/UserManagementModal';

interface NavbarProps {
  currentProjectName?: string;
  onNavigateHome: () => void;
  onCreateProject?: () => void;
  onImportProject?: () => void;
}

export function Navbar({
  currentProjectName,
  onNavigateHome,
  onCreateProject,
  onImportProject
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, isAdmin, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2.5 font-bold text-lg text-foreground hover:opacity-85 transition-opacity cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <span className="tracking-tight">Icon<span className="text-blue-500">Vault</span></span>
            </button>

            {currentProjectName && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span>/</span>
                <span className="font-semibold text-foreground bg-secondary px-2.5 py-1 rounded-lg">
                  {currentProjectName}
                </span>
              </div>
            )}
          </div>

          {/* Center Navigation: Project Breadcrumbs when in a project */}
          {currentProjectName && (
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border text-xs shadow-xs">
                <button
                  onClick={onNavigateHome}
                  className="text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  Dashboard
                </button>
                <span className="text-muted-foreground/60">/</span>
                <span className="font-bold text-foreground max-w-[240px] truncate">
                  {currentProjectName}
                </span>
              </div>
            </div>
          )}

          {/* Quick Actions & Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onCreateProject && (
              <button
                onClick={onCreateProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors shadow-sm"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            )}

            {onImportProject && (
              <button
                onClick={onImportProject}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary text-foreground transition-colors"
                title="Import Project from ZIP"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
            )}

            {/* Admin Exclusive: User Management Button */}
            {isAdmin && (
              <button
                onClick={() => setShowUserManagement(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
                title="Manage Workspace Users & Permissions"
              >
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>Manage Users</span>
              </button>
            )}

            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* User Profile & Role Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => currentUser ? setShowUserDropdown(!showUserDropdown) : setShowAuth(true)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-border hover:bg-secondary/70 transition-all text-left group"
                title={currentUser ? "Account and permissions" : "Sign in"}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold leading-tight text-foreground truncate max-w-[100px]">
                    {currentUser?.name || 'Sign in'}
                  </span>
                  <span className="text-[10px] leading-tight text-muted-foreground flex items-center gap-1">
                    {isAdmin ? (
                      <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5 inline" /> Admin
                      </span>
                    ) : (
                      <span>{currentUser ? 'Member' : 'Guest'}</span>
                    )}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-card border border-border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Current User Header */}
                  <div className="p-3 bg-secondary/50 rounded-xl mb-2">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {currentUser?.name || 'Guest'}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {currentUser?.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground">Permission:</span>
                      {isAdmin ? (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center gap-1 text-[10px]">
                          <ShieldCheck className="w-3 h-3" /> Admin (Full Access)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1 text-[10px]">
                          <UserIcon className="w-3 h-3" /> Member
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin User Management Shortcut */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowUserManagement(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors mb-2 text-left"
                    >
                      <Users className="w-4 h-4" />
                      <span>Open User Management</span>
                    </button>
                  )}

                  <div className="border-t border-border/60 pt-2">
                    {currentUser ? (
                      <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
                        onClick={async () => { await logout(); setShowUserDropdown(false); onNavigateHome(); }}>Sign out</button>
                    ) : (
                      <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
                        onClick={() => { setShowAuth(true); setShowUserDropdown(false); }}>Sign in or create account</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-semibold">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Focus Search</span>
                <kbd className="px-2 py-1 bg-secondary text-xs rounded border border-border font-mono font-semibold">⌘ K / Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Open Upload Modal</span>
                <kbd className="px-2 py-1 bg-secondary text-xs rounded border border-border font-mono font-semibold">⌘ U / Ctrl+U</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Delete Selected Icons</span>
                <kbd className="px-2 py-1 bg-secondary text-xs rounded border border-border font-mono font-semibold">Del / Backspace</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Close Drawers / Modals</span>
                <kbd className="px-2 py-1 bg-secondary text-xs rounded border border-border font-mono font-semibold">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
