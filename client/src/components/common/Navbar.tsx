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
  Sparkles,
  FolderKanban
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import { UserManagementModal } from '../users/UserManagementModal';
import { ProjectManagementModal } from '../admin/ProjectManagementModal';

interface NavbarProps {
  currentProjectName?: string;
  onNavigateHome: () => void;
  onCreateProject?: () => void;
  onImportProject?: () => void;
  onRefreshProjects?: () => void;
  onOpenProject?: (id: string) => void;
}

export function Navbar({
  currentProjectName,
  onNavigateHome,
  onCreateProject,
  onImportProject,
  onRefreshProjects,
  onOpenProject
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, isAdmin, switchableUsers, switchUser } = useAuth();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showProjectManagement, setShowProjectManagement] = useState(false);
  const [showManageDropdown, setShowManageDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const manageDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (manageDropdownRef.current && !manageDropdownRef.current.contains(e.target as Node)) {
        setShowManageDropdown(false);
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

            {/* Admin Exclusive: Manage Dropdown (Projects & Users) */}
            {isAdmin && (
              <div className="relative" ref={manageDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowManageDropdown(!showManageDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs cursor-pointer select-none"
                  title="Admin Workspace Management"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Manage</span>
                  <ChevronDown className={`w-3 h-3 text-indigo-400 transition-transform duration-200 ${showManageDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showManageDropdown && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card border border-border shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                      Admin Tools
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowManageDropdown(false);
                        setShowProjectManagement(true);
                      }}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-secondary transition-colors cursor-pointer group mt-1"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground group-hover:text-blue-500 transition-colors">
                          Manage Projects
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          View all projects, owners, transfer & delete
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowManageDropdown(false);
                        setShowUserManagement(true);
                      }}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-secondary transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground group-hover:text-indigo-500 transition-colors">
                          Manage Users
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          Add, edit users, switch accounts & roles
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-border hover:bg-secondary/70 transition-all text-left group"
                title="Switch User / View Permissions"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold leading-tight text-foreground truncate max-w-[100px]">
                    {currentUser?.name || 'User'}
                  </span>
                  <span className="text-[10px] leading-tight text-muted-foreground flex items-center gap-1">
                    {isAdmin ? (
                      <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5 inline" /> Admin
                      </span>
                    ) : (
                      <span>Member</span>
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
                          {currentUser?.name}
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

                  {/* Switch User Section */}
                  <div className="border-t border-border/60 pt-2">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Switch Profile (Quick Test)</span>
                      <Sparkles className="w-3 h-3 text-amber-500" />
                    </div>
                    <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                      {switchableUsers.map((u) => {
                        const isCurrent = u.id === currentUser?.id;
                        return (
                          <button
                            key={u.id}
                            onClick={async () => {
                              if (!isCurrent) {
                                await switchUser(u.id);
                                setShowUserDropdown(false);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-xl transition-all text-left ${
                              isCurrent
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'hover:bg-secondary text-foreground'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="truncate font-medium flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.role === 'admin' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-bold">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
      />

      {/* Admin Project Management Modal */}
      {isAdmin && (
        <ProjectManagementModal
          isOpen={showProjectManagement}
          onClose={() => setShowProjectManagement(false)}
          onRefresh={() => {
            if (onRefreshProjects) onRefreshProjects();
          }}
          onOpenProject={(id) => {
            setShowProjectManagement(false);
            if (onOpenProject) onOpenProject(id);
          }}
        />
      )}

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
