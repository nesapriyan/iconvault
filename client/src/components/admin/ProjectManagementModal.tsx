import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  X, 
  FolderKanban, 
  ShieldCheck, 
  Search, 
  Trash2, 
  ArrowLeftRight, 
  ArrowUpRight, 
  Check, 
  Globe, 
  Lock, 
  Sparkles, 
  Type, 
  User as UserIcon, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { Project, User } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';
import { getAvatarStyle } from '../dashboard/ProjectCard';

interface ProjectManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenProject: (id: string) => void;
}

export function ProjectManagementModal({
  isOpen,
  onClose,
  onRefresh,
  onOpenProject
}: ProjectManagementModalProps) {
  const { success, error } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'sprite' | 'font'>('all');
  // Multi-select for User / Owner filter
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  const [userFilterSearch, setUserFilterSearch] = useState('');
  const userFilterRef = useRef<HTMLDivElement>(null);

  // Close multi-select user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userFilterRef.current && !userFilterRef.current.contains(event.target as Node)) {
        setIsUserFilterOpen(false);
      }
    }
    if (isUserFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserFilterOpen]);

  const toggleOwnerSelection = (id: string) => {
    setSelectedOwnerIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAllOwners = () => {
    const allIds = users.map(u => u.id);
    if (projects.some(p => !p.owner_id)) {
      allIds.push('unassigned');
    }
    setSelectedOwnerIds(allIds);
  };

  const clearOwnerFilter = () => {
    setSelectedOwnerIds([]);
  };

  const getOwnerFilterLabel = () => {
    if (selectedOwnerIds.length === 0) {
      return 'All Users';
    }
    if (selectedOwnerIds.length === 1) {
      const singleId = selectedOwnerIds[0];
      if (singleId === 'unassigned') return 'Unassigned';
      const found = users.find(u => u.id === singleId);
      return found ? found.name : '1 User';
    }
    return `${selectedOwnerIds.length} Users`;
  };

  // Multi-selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Transfer Ownership Dialog State
  const [transferTarget, setTransferTarget] = useState<Project | null>(null);
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [transferring, setTransferring] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load all projects and users for admin
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [projData, userData] = await Promise.all([
        api.getProjects({ visibility: 'all', status: 'all' }),
        api.getUsers()
      ]);
      setProjects(projData);
      setUsers(userData);
      setSelectedIds(new Set());
    } catch (err: any) {
      error(err.message || 'Failed to load projects and users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSearch('');
      setVisibilityFilter('all');
      setPurposeFilter('all');
      setSelectedOwnerIds([]);
      setIsUserFilterOpen(false);
      setUserFilterSearch('');
      setSelectedIds(new Set());
      setTransferTarget(null);
      setDeleteTarget(null);
      setShowBulkDeleteConfirm(false);
    }
  }, [isOpen, loadData]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Visibility
      if (visibilityFilter === 'public' && p.visibility !== 'public') return false;
      if (visibilityFilter === 'private' && p.visibility !== 'private') return false;

      // Purpose
      if (purposeFilter !== 'all' && (p.purpose || 'sprite') !== purposeFilter) return false;

      // Multi-select Owner / User filter
      if (selectedOwnerIds.length > 0) {
        const ownerKey = p.owner_id || 'unassigned';
        if (!selectedOwnerIds.includes(ownerKey)) {
          return false;
        }
      }

      // Search term (name, prefix, description, owner name, owner email)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesPrefix = p.prefix.toLowerCase().includes(q);
        const matchesOwner = (p.owner_name || '').toLowerCase().includes(q) || (p.owner_email || '').toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesPrefix || matchesOwner;
      }
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, search, visibilityFilter, purposeFilter, selectedOwnerIds]);


  // Counts for quick stats
  const stats = useMemo(() => {
    let pub = 0;
    let priv = 0;
    let totalIcons = 0;
    projects.forEach(p => {
      if (p.visibility === 'private') priv++;
      else pub++;
      totalIcons += p.icon_count || 0;
    });
    return {
      total: projects.length,
      public: pub,
      private: priv,
      totalIcons
    };
  }, [projects]);

  // Selection toggle
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map(p => p.id)));
    }
  };

  // Transfer Ownership Handler
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget || !newOwnerId) return;

    try {
      setTransferring(true);
      const recipient = users.find(u => u.id === newOwnerId);
      await api.transferProject(transferTarget.id, newOwnerId);
      success(`Project "${transferTarget.name}" transferred to ${recipient?.name || 'new owner'}!`);
      setTransferTarget(null);
      setNewOwnerId('');
      await loadData();
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to transfer project');
    } finally {
      setTransferring(false);
    }
  };

  // Delete Single Project Handler
  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deleteProject(deleteTarget.id);
      success(`Project "${deleteTarget.name}" deleted permanently`);
      setDeleteTarget(null);
      await loadData();
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  // Bulk Delete Projects Handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      setDeleting(true);
      const ids = Array.from(selectedIds);
      const res = await api.bulkDeleteProjects(ids);
      success(`Deleted ${res.deletedCount} project(s) permanently`);
      setShowBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      await loadData();
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to delete selected projects');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-6xl max-h-[92vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border shrink-0 bg-secondary/30">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Project Management</h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin Console</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full control across all workspaces: view creators, transfer ownership, and delete projects.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 transition-colors cursor-pointer"
              title="Refresh projects list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 sm:px-8 py-3 bg-secondary/15 border-b border-border/80 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total Projects:</span>
            <span className="font-bold text-foreground">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total Icons:</span>
            <span className="font-bold text-foreground">{stats.totalIcons}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Public Projects:</span>
            <span className="font-bold text-blue-500">{stats.public}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Private Projects:</span>
            <span className="font-bold text-purple-500">{stats.private}</span>
          </div>
        </div>

        {/* Search, Filters, and Bulk Actions Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-6 sm:px-8 py-3.5 border-b border-border shrink-0 bg-card">
          {/* Left: Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by project name, prefix, owner name or email..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-secondary/40 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: User, Visibility & Format Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Multi-select User / Owner Filter Popover */}
            <div className="relative" ref={userFilterRef}>
              <button
                type="button"
                onClick={() => setIsUserFilterOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none shadow-2xs ${
                  selectedOwnerIds.length > 0
                    ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/15'
                    : 'bg-secondary/60 border-border/80 text-foreground hover:bg-secondary'
                }`}
                title="Filter projects by one or multiple users"
              >
                <UserIcon className={`w-3.5 h-3.5 ${selectedOwnerIds.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="max-w-[130px] truncate">{getOwnerFilterLabel()}</span>
                {selectedOwnerIds.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {selectedOwnerIds.length}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isUserFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Clear shortcut if filtered */}
              {selectedOwnerIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearOwnerFilter();
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shadow-xs cursor-pointer z-10"
                  title="Clear user filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}

              {/* Multi-select dropdown popover */}
              {isUserFilterOpen && (
                <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  {/* Search user */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userFilterSearch}
                      onChange={e => setUserFilterSearch(e.target.value)}
                      placeholder="Filter users..."
                      className="w-full pl-8 pr-7 py-1 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    {userFilterSearch && (
                      <button
                        type="button"
                        onClick={() => setUserFilterSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Quick Select All / Clear All bar */}
                  <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground border-b border-border/60 pb-1.5">
                    <button
                      type="button"
                      onClick={selectAllOwners}
                      className="font-medium hover:text-primary transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={clearOwnerFilter}
                      className="font-medium hover:text-primary transition-colors cursor-pointer"
                    >
                      Reset (All Users)
                    </button>
                  </div>

                  {/* Scrollable list of users */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {users
                      .filter(u => 
                        u.name.toLowerCase().includes(userFilterSearch.toLowerCase()) || 
                        u.email.toLowerCase().includes(userFilterSearch.toLowerCase())
                      )
                      .map(u => {
                        const isSelected = selectedOwnerIds.includes(u.id);
                        const count = projects.filter(p => p.owner_id === u.id).length;
                        const initial = (u.name || 'U')[0].toUpperCase();

                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleOwnerSelection(u.id)}
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-secondary/60 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-muted-foreground shrink-0">
                                {isSelected ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-slate-600 to-slate-800 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0 truncate">
                                <span className="truncate">{u.name}</span>
                                {u.role === 'admin' && (
                                  <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {count} proj
                            </span>
                          </div>
                        );
                      })}

                    {/* Unassigned / System Option */}
                    {('unassigned'.includes(userFilterSearch.toLowerCase()) || 'system'.includes(userFilterSearch.toLowerCase())) && (
                      <div
                        onClick={() => toggleOwnerSelection('unassigned')}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                          selectedOwnerIds.includes('unassigned')
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-secondary/60 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-muted-foreground shrink-0">
                            {selectedOwnerIds.includes('unassigned') ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0">
                            ⚙️
                          </div>
                          <span className="truncate">Unassigned / System</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {projects.filter(p => !p.owner_id).length} proj
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="flex items-center bg-secondary/60 p-0.5 rounded-xl border border-border/80 text-xs">
              {(['all', 'public', 'private'] as const).map(vis => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => setVisibilityFilter(vis)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                    visibilityFilter === vis
                      ? 'bg-foreground text-background shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {vis}
                </button>
              ))}
            </div>

            {/* Purpose */}
            <div className="flex items-center bg-secondary/60 p-0.5 rounded-xl border border-border/80 text-xs">
              {(['all', 'sprite', 'font'] as const).map(purp => (
                <button
                  key={purp}
                  type="button"
                  onClick={() => setPurposeFilter(purp)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                    purposeFilter === purp
                      ? 'bg-foreground text-background shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {purp === 'all' ? 'All Types' : purp === 'sprite' ? 'Sprites' : 'Fonts'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar (Shows when 1+ projects selected or on select-all toggle) */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-2.5 bg-secondary/30 border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              className="flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer select-none"
            >
              {selectedIds.size === 0 ? (
                <Square className="w-4 h-4 text-muted-foreground" />
              ) : selectedIds.size === filteredProjects.length ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <MinusSquare className="w-4 h-4 text-primary" />
              )}
              <span>Select All ({filteredProjects.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <span className="text-muted-foreground font-medium">
                • {selectedIds.size} project{selectedIds.size === 1 ? '' : 's'} selected
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-destructive/10 hover:bg-destructive text-destructive hover:text-white border border-destructive/20 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}
        </div>

        {/* Scrollable Project Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="h-56 rounded-2xl bg-secondary/30 border border-border animate-pulse p-5" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {filteredProjects.map(project => {
                const isSelected = selectedIds.has(project.id);
                const avatarStyle = getAvatarStyle(project);
                const isPublic = project.visibility === 'public';
                const ownerInitial = (project.owner_name || 'U')[0].toUpperCase();

                return (
                  <div
                    key={project.id}
                    className={`relative bg-card border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-border/90'
                    }`}
                  >
                    {/* Card Top: Checkbox, Avatar, Name & Prefix, Badges */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(project.id)}
                            className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>

                          {/* Avatar letter */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarStyle.className}`}
                            style={avatarStyle.style}
                          >
                            {project.name[0]?.toUpperCase() || 'P'}
                          </div>

                          {/* Name and Prefix */}
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-foreground truncate" title={project.name}>
                              {project.name}
                            </h3>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {project.prefix}-
                            </span>
                          </div>
                        </div>

                        {/* Badges: Visibility & Format */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isPublic
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400'
                          }`}>
                            {isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            <span>{isPublic ? 'Public' : 'Private'}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary border border-border text-muted-foreground">
                            {project.purpose === 'font' ? <Type className="w-2.5 h-2.5 text-indigo-500" /> : <Sparkles className="w-2.5 h-2.5 text-amber-500" />}
                            <span>{project.purpose === 'font' ? 'Font' : 'Sprite'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[32px]">
                        {project.description || 'No description provided.'}
                      </p>

                      {/* Quick Meta */}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                        <span>{project.icon_count || 0} icons</span>
                        <span>•</span>
                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Owner Information Box (Prominent) */}
                      <div className="mt-3 p-2.5 rounded-xl bg-secondary/50 border border-border/70 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedOwnerIds([project.owner_id || 'unassigned'])}
                          className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer group"
                          title={`Filter projects by ${project.owner_name || 'System / Unassigned'}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-600 to-slate-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0 group-hover:scale-105 transition-transform">
                            {ownerInitial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {project.owner_name || 'System / Unassigned'}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {project.owner_email || 'No email associated'}
                            </div>
                          </div>
                        </button>

                        {/* Quick Transfer Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setTransferTarget(project);
                            setNewOwnerId('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card hover:bg-primary hover:text-white border border-border text-foreground text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                          title="Transfer this project to another user"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Transfer</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="mt-3.5 pt-3 border-t border-border/70 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
                        title="Delete this project permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenProject(project.id);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-all cursor-pointer"
                      >
                        <span>Open Vault</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-muted-foreground">
              <FolderKanban className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="font-semibold text-foreground">No projects found</p>
              <p className="mt-1">Try adjusting your search query or filters.</p>
              {(selectedOwnerIds.length > 0 || visibilityFilter !== 'all' || purposeFilter !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOwnerIds([]);
                    setVisibilityFilter('all');
                    setPurposeFilter('all');
                    setSearch('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground hover:bg-secondary/80 font-medium transition-colors cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-border bg-secondary/30 flex items-center justify-between shrink-0 text-xs">
          <span className="text-muted-foreground">
            Showing {filteredProjects.length} of {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-foreground text-background font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>

        {/* Sub-Dialog: Transfer Project Ownership */}
        {transferTarget && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Transfer Project Ownership</h3>
                    <p className="text-[11px] text-muted-foreground">Reassign &ldquo;{transferTarget.name}&rdquo; to a new owner</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Owner Info */}
              <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs">
                <span className="text-muted-foreground">Current Owner:</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {transferTarget.owner_name || 'System / Unassigned'} ({transferTarget.owner_email || 'No email'})
                </div>
              </div>

              {/* New Owner Select */}
              <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Select New Owner *</label>
                  <select
                    value={newOwnerId}
                    onChange={e => setNewOwnerId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="" disabled>Choose a user...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id} disabled={u.id === transferTarget.owner_id}>
                        {u.name} ({u.email}) {u.id === transferTarget.owner_id ? '— (Current Owner)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setTransferTarget(null)}
                    disabled={transferring}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transferring || !newOwnerId}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {transferring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-Dialog: Delete Single Project Confirmation */}
        {deleteTarget && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-destructive">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Delete Project Permanently?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-foreground bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                Are you sure you want to delete <span className="font-bold">&ldquo;{deleteTarget.name}&rdquo;</span>? All folders, icons, and build packages will be removed from disk immediately.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSingle}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Project</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Dialog: Bulk Delete Projects Confirmation */}
        {showBulkDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-destructive">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Delete {selectedIds.size} Projects?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanent bulk deletion</p>
                </div>
              </div>

              <p className="text-xs text-foreground bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                As an administrator, you are deleting <span className="font-bold">{selectedIds.size} project(s)</span> from the application. All icons and assets inside these projects will be erased from storage.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete All {selectedIds.size} Projects</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
