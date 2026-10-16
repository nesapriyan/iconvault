import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, FolderKanban, Sparkles, Type, Globe, Lock, X, Copy, Loader2, ArrowRight } from 'lucide-react';
import { Project, GlobalSearchIconItem } from '../../types';
import { ProjectCard } from './ProjectCard';
import { GlobalIconSearchCard } from './GlobalIconSearchCard';
import { CopyIconModal } from '../icons/CopyIconModal';
import { CreateProjectModal } from './CreateProjectModal';
import { ImportProjectModal } from './ImportProjectModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';
import { useAuth } from '../../context/AuthContext';

interface DashboardViewProps {
  projects: Project[];
  loading: boolean;
  onRefresh: () => void;
  onOpenProject: (id: string) => void;
}

export function DashboardView({
  projects,
  loading,
  onRefresh,
  onOpenProject
}: DashboardViewProps) {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');

  // Icon search state & tabs
  const [iconResults, setIconResults] = useState<GlobalSearchIconItem[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [searchTab, setSearchTab] = useState<'all' | 'projects' | 'icons'>('all');
  const [copyModalIcon, setCopyModalIcon] = useState<GlobalSearchIconItem | null>(null);
  
  // Default to 'private' and 'all' when user is logged in
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>(() => {
    return currentUser ? 'private' : 'all';
  });
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'sprite' | 'font'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // When a user logs in or switches account, default to 'private' and 'all'
  useEffect(() => {
    if (currentUser) {
      setVisibilityFilter('private');
      setPurposeFilter('all');
    } else {
      setVisibilityFilter('all');
      setPurposeFilter('all');
    }
  }, [currentUser?.id]);

  // Debounced Global Icon Search
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setIconResults([]);
      setLoadingIcons(false);
      setSearchTab('all');
      return;
    }

    setLoadingIcons(true);
    const timeout = setTimeout(() => {
      api.searchIcons(trimmed, 60)
        .then(res => {
          setIconResults(res.icons || []);
        })
        .catch(err => {
          console.warn('Global icon search failed:', err);
          setIconResults([]);
        })
        .finally(() => {
          setLoadingIcons(false);
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  // Download individual icon SVG directly as blob
  const handleDownloadIcon = (icon: GlobalSearchIconItem) => {
    try {
      const svgBlob = new Blob([icon.rawSvg || ''], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${icon.slug || icon.name}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(`Downloaded ${icon.name}.svg`);
    } catch (err: any) {
      error(err.message || 'Failed to download icon');
    }
  };

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { success, error } = useToast();

  // Visibility counts for badges
  const visibilityCounts = useMemo(() => {
    let pub = 0;
    let priv = 0;
    projects.forEach(p => {
      const vis = p.visibility || 'public';
      if (vis === 'private') priv++;
      else pub++;
    });
    return {
      all: projects.length,
      public: pub,
      private: priv
    };
  }, [projects]);

  // Purpose counts for badges
  const purposeCounts = useMemo(() => {
    let sprite = 0;
    let font = 0;
    projects.forEach(p => {
      const purp = p.purpose || 'sprite';
      if (purp === 'font') font++;
      else sprite++;
    });
    return {
      all: projects.length,
      sprite,
      font
    };
  }, [projects]);

  // Filter & sort projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Visibility filter (All / Public / Private)
      const projectVisibility = p.visibility || 'public';
      if (visibilityFilter === 'public' && projectVisibility !== 'public') return false;
      if (visibilityFilter === 'private' && projectVisibility !== 'private') return false;

      // Purpose filter
      const projectPurpose = p.purpose || 'sprite';
      if (purposeFilter !== 'all' && projectPurpose !== purposeFilter) return false;

      // Search term
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesPrefix = p.prefix.toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesPrefix;
      }
      return true;
    }).sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [projects, search, visibilityFilter, purposeFilter]);

  const handleCreateOrEdit = async (data: { name: string; description?: string; prefix?: string; color?: string; purpose?: 'sprite' | 'font'; visibility?: 'public' | 'private' }) => {
    if (editingProject) {
      await api.updateProject(editingProject.id, data);
      success('Project updated successfully');
    } else {
      const created = await api.createProject(data);
      success('Project created successfully');
      onOpenProject(created.id);
    }
    onRefresh();
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.duplicateProject(id);
      success('Project duplicated successfully');
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to duplicate project');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteProject(deleteTarget.id);
      success(`Project "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to delete project');
    }
  };

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto px-6 sm:px-8 lg:px-12 py-6 sm:py-8 flex flex-col">
      {/* Control Bar: Search on Left; Sort, Visibility, Purpose on Right */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 mb-6 shrink-0 bg-card/70 backdrop-blur-md border border-border p-3.5 rounded-2xl shadow-xs">
        {/* Left: Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-sm sm:max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="global-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects and icons across all vaults... (⌘K)"
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-secondary transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right side: Visibility and Purpose Filters */}
        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 shrink-0">
          {/* Project Visibility Filter (All, Private, Public) */}
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-2xl border border-border/80 shadow-xs">
            <button
              type="button"
              onClick={() => setVisibilityFilter('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                visibilityFilter === 'all'
                  ? 'bg-foreground text-background shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/70'
              }`}
              title="Show all projects"
            >
              <span>All</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                visibilityFilter === 'all'
                  ? 'bg-background/20 text-background'
                  : 'bg-card text-muted-foreground border border-border/60'
              }`}>
                {visibilityCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVisibilityFilter('private')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                visibilityFilter === 'private'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-500'
                  : 'text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-card/70'
              }`}
              title="Show your private projects"
            >
              <Lock className={`w-3.5 h-3.5 ${visibilityFilter === 'private' ? 'text-white' : 'text-purple-500'}`} />
              <span>Private</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                visibilityFilter === 'private'
                  ? 'bg-white/20 text-white'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
              }`}>
                {visibilityCounts.private}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVisibilityFilter('public')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                visibilityFilter === 'public'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500'
                  : 'text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-card/70'
              }`}
              title="Show public projects"
            >
              <Globe className={`w-3.5 h-3.5 ${visibilityFilter === 'public' ? 'text-white' : 'text-blue-500'}`} />
              <span>Public</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                visibilityFilter === 'public'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}>
                {visibilityCounts.public}
              </span>
            </button>
          </div>

          {/* 1st place from right (most right): Project Format / Purpose Filter (All Types, Sprites, Fonts) */}
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-2xl border border-border/80 shadow-xs">
            <button
              type="button"
              onClick={() => setPurposeFilter('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                purposeFilter === 'all'
                  ? 'bg-foreground text-background shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/70'
              }`}
              title="Show all project formats"
            >
              <span>All Types</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                purposeFilter === 'all'
                  ? 'bg-background/20 text-background'
                  : 'bg-card text-muted-foreground border border-border/60'
              }`}>
                {purposeCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPurposeFilter('sprite')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                purposeFilter === 'sprite'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-1 ring-amber-400'
                  : 'text-muted-foreground hover:text-amber-500 hover:bg-card/70'
              }`}
              title="Show SVG Sprite projects"
            >
              <Sparkles className={`w-3.5 h-3.5 ${purposeFilter === 'sprite' ? 'text-white' : 'text-amber-500'}`} />
              <span>Sprites</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                purposeFilter === 'sprite'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {purposeCounts.sprite}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPurposeFilter('font')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                purposeFilter === 'font'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500'
                  : 'text-muted-foreground hover:text-indigo-500 hover:bg-card/70'
              }`}
              title="Show Icon Font projects"
            >
              <Type className={`w-3.5 h-3.5 ${purposeFilter === 'font' ? 'text-white' : 'text-indigo-500'}`} />
              <span>Fonts</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                purposeFilter === 'font'
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
              }`}>
                {purposeCounts.font}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* When Search is Active: 2-Part View (Projects + Icons) */}
      {search.trim().length > 0 ? (
        <div className="flex flex-col gap-6 pb-10">
          {/* Search Result Summary Header & Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/80 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                Search results for &ldquo;{search.trim()}&rdquo;
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border/70 text-muted-foreground font-medium">
                {filteredProjects.length + iconResults.length} total
              </span>
            </div>

            {/* 2-Part Switcher Tabs: All / Projects / Icons */}
            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border/80 shadow-xs">
              <button
                type="button"
                onClick={() => setSearchTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchTab === 'all'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>All Results</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  searchTab === 'all' ? 'bg-background/20 text-background' : 'bg-card text-muted-foreground'
                }`}>
                  {filteredProjects.length + iconResults.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchTab('projects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchTab === 'projects'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Projects</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  searchTab === 'projects' ? 'bg-white/20 text-white' : 'bg-card text-muted-foreground'
                }`}>
                  {filteredProjects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchTab('icons')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchTab === 'icons'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Icons</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  searchTab === 'icons' ? 'bg-white/20 text-white' : 'bg-card text-muted-foreground'
                }`}>
                  {loadingIcons ? '...' : iconResults.length}
                </span>
              </button>
            </div>
          </div>

          {/* Part 1: Projects Section */}
          {(searchTab === 'all' || searchTab === 'projects') && (
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-blue-500" />
                  <span>Matching Projects</span>
                  <span className="text-xs font-normal text-muted-foreground">({filteredProjects.length})</span>
                </h3>
              </div>

              {filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                  {filteredProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={onOpenProject}
                      onEdit={p => {
                        setEditingProject(p);
                        setCreateModalOpen(true);
                      }}
                      onDuplicate={handleDuplicate}
                      onDelete={(id, name) => setDeleteTarget({ id, name })}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-secondary/30 border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                  No projects matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Part 2: Icons Section */}
          {(searchTab === 'all' || searchTab === 'icons') && (
            <div className={searchTab === 'all' ? 'mt-2' : ''}>
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Matching Icons</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {loadingIcons ? '(searching...)' : `(${iconResults.length})`}
                  </span>
                </h3>
              </div>

              {loadingIcons ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <div key={n} className="h-48 rounded-2xl bg-card border border-border animate-pulse p-4" />
                  ))}
                </div>
              ) : iconResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {iconResults.map(icon => (
                    <GlobalIconSearchCard
                      key={`${icon.project_id}:${icon.id}`}
                      icon={icon}
                      onOpenProject={onOpenProject}
                      onCopyIcon={iconItem => setCopyModalIcon(iconItem)}
                      onDownloadIcon={handleDownloadIcon}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-secondary/30 border border-dashed border-border/80 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-muted-foreground/60" />
                  <p>No icons found matching &ldquo;{search}&rdquo; across any accessible project.</p>
                </div>
              )}
            </div>
          )}

          {/* Completely empty state if neither has results */}
          {filteredProjects.length === 0 && iconResults.length === 0 && !loadingIcons && (
            <div className="text-center py-12 bg-card border border-dashed border-border rounded-3xl p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">No matches found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                We couldn&apos;t find any projects or icons matching &ldquo;{search}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-4 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground border border-border transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Regular Dashboard View when search is empty */
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <div key={n} className="h-44 rounded-2xl bg-card border border-border animate-pulse p-5" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 pb-8">
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={onOpenProject}
                  onEdit={p => {
                    setEditingProject(p);
                    setCreateModalOpen(true);
                  }}
                  onDuplicate={handleDuplicate}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground mb-4">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">No projects found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {visibilityFilter === 'private'
                  ? 'No private projects found in your workspace.'
                  : visibilityFilter === 'public'
                  ? 'No public projects found.'
                  : 'Create your first project to start organizing SVG icons, sprites, and icon fonts.'}
              </p>
              {visibilityFilter === 'private' && visibilityCounts.public > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter('public')}
                    className="text-xs font-semibold text-blue-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>View {visibilityCounts.public} public project{visibilityCounts.public === 1 ? '' : 's'}</span>
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setEditingProject(null);
                  setCreateModalOpen(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-blue-600 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals & Dialogs */}
      <CreateProjectModal
        isOpen={createModalOpen}
        editingProject={editingProject}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleCreateOrEdit}
      />

      <ImportProjectModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={onRefresh}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Project?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? All folders, icons, and generated build packages will be removed from disk. This action cannot be undone.`}
        confirmLabel="Delete Project"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* Copy Icon to Project Modal */}
      <CopyIconModal
        isOpen={!!copyModalIcon}
        icon={copyModalIcon}
        projects={projects}
        onClose={() => setCopyModalIcon(null)}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </div>
  );
}
