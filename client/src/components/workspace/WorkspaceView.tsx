import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layers,
  Sparkles,
  Type,
  Settings,
  Trash2,
  UploadCloud,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ChevronDown,
  FolderInput,
  Code,
  Filter,
  CheckSquare,
  Square,
  Plus,
  Minus,
  Eye,
  Box,
  Lock,
  Globe
} from 'lucide-react';
import { Project, Folder, IconItem, IconRenderStyle } from '../../types';
import { FolderTree } from './FolderTree';
import { IconGrid } from '../icons/IconGrid';
import { IconList } from '../icons/IconList';
import { IconUploadModal } from '../icons/IconUploadModal';
import { ImportFromProjectModal } from '../icons/ImportFromProjectModal';
import { IconDetailDrawer } from '../icons/IconDetailDrawer';
import { BulkActionBar } from '../icons/BulkActionBar';
import { TrashView } from '../icons/TrashView';
import { SpriteTab } from '../sprite/SpriteTab';
import { FontTab } from '../font/FontTab';
import { SettingsTab } from '../settings/SettingsTab';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { api, downloadSvgContent } from '../../api/client';
import { useToast } from '../common/Toast';
import { useShortcuts } from '../../hooks/useShortcuts';

interface WorkspaceViewProps {
  projectId: string;
  onBackToDashboard: () => void;
}

export function WorkspaceView({ projectId, onBackToDashboard }: WorkspaceViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [icons, setIcons] = useState<IconItem[]>([]);
  const [trashIcons, setTrashIcons] = useState<IconItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'icons' | 'sprite' | 'font' | 'settings' | 'trash'>('icons');

  // Folder filtering
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all' | 'root'>('all');

  // Search & view options
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cardZoom, setCardZoom] = useState<number>(150);
  const [iconSize, setIconSize] = useState<number>(36);
  const [iconColor, setIconColor] = useState<string>('default');
  const [renderStyle, setRenderStyle] = useState<IconRenderStyle>('natural');
  const [sortOption, setSortOption] = useState<'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'size_desc'>('newest');

  // Selection
  const [selectedIconIds, setSelectedIconIds] = useState<Set<string>>(new Set());

  // Detail drawer
  const [detailIconId, setDetailIconId] = useState<string | null>(null);

  // Upload modal & dropdown
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalTab, setUploadModalTab] = useState<'files' | 'sprite' | 'font' | 'paste'>('files');
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const [projectImportModalOpen, setProjectImportModalOpen] = useState(false);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);

  // Close upload dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(e.target as Node)) {
        setUploadDropdownOpen(false);
      }
    }
    if (uploadDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [uploadDropdownOpen]);

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { success, error } = useToast();

  // Load project metadata, folders, and icons
  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const [projData, foldersData, iconsData, trashData] = await Promise.all([
        api.getProject(projectId),
        api.getFolders(projectId),
        api.getIcons(projectId, {
          folderId: selectedFolderId === 'all' ? undefined : selectedFolderId,
          includeSubfolders: true,
          limit: 2000
        }),
        api.getIcons(projectId, { trash: true, limit: 1000 })
      ]);

      setProject(projData);
      setFolders(foldersData);
      setIcons(iconsData.icons);
      setTrashIcons(trashData.icons);
    } catch (err: any) {
      error(err.message || 'Failed to load project workspace');
      onBackToDashboard();
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedFolderId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  useEffect(() => {
    if (project?.purpose === 'font' && activeTab === 'sprite') {
      setActiveTab('font');
    } else if (project?.purpose === 'sprite' && activeTab === 'font') {
      setActiveTab('sprite');
    }
  }, [project?.purpose, activeTab]);

  // Keyboard Shortcuts integration
  useShortcuts({
    onSearch: () => {
      document.getElementById('icon-search-input')?.focus();
    },
    onUpload: () => {
      setUploadModalOpen(true);
    },
    onDelete: () => {
      if (selectedIconIds.size > 0) {
        setDeleteConfirmOpen(true);
      }
    },
    onEscape: () => {
      if (detailIconId) setDetailIconId(null);
      else if (selectedIconIds.size > 0) setSelectedIconIds(new Set());
    }
  });

  // Filtered & sorted icons
  const displayedIcons = useMemo(() => {
    return icons.filter(icon => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchesName = icon.name.toLowerCase().includes(q);
      const matchesSlug = (icon.slug || '').toLowerCase().includes(q);
      const tagList = Array.isArray(icon.tags)
        ? icon.tags
        : typeof icon.tags === 'string'
        ? (() => { try { const parsed = JSON.parse(icon.tags); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })()
        : [];
      const matchesTags = tagList.some(t => typeof t === 'string' && t.toLowerCase().includes(q));
      return matchesName || matchesSlug || matchesTags;
    }).sort((a, b) => {
      switch (sortOption) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'size_desc': return b.byte_size - a.byte_size;
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [icons, search, sortOption]);

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIconIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIconIds.size === displayedIcons.length) {
      setSelectedIconIds(new Set());
    } else {
      setSelectedIconIds(new Set(displayedIcons.map(i => i.id)));
    }
  };

  // Folder actions
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    try {
      await api.createFolder(projectId, { name, parentId });
      success(`Folder "${name}" created`);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await api.updateFolder(folderId, { name: newName });
      success('Folder renamed');
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await api.deleteFolder(folderId);
      success('Folder deleted');
      if (selectedFolderId === folderId) setSelectedFolderId('all');
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to delete folder');
    }
  };

  const handleDropIconsToFolder = async (targetFolderId: string | null, iconIds: string[]) => {
    try {
      const count = await api.batchMoveIcons(projectId, iconIds, targetFolderId);
      success(`Moved ${count} icon(s) to folder`);
      setSelectedIconIds(new Set());
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to move icons');
    }
  };

  // Download actions (Single SVG and Batch ZIP/SVG)
  const handleDownloadIcon = useCallback((icon: IconItem) => {
    if (icon.rawSvg) {
      downloadSvgContent(icon.rawSvg, icon.slug || icon.name);
      success(`Downloaded ${icon.name}.svg`);
    } else {
      const url = api.getIconDownloadUrl(icon.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${icon.slug || icon.name}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      success(`Downloaded ${icon.name}.svg`);
    }
  }, [success]);

  const handleBatchDownload = useCallback(async () => {
    if (selectedIconIds.size === 0 || !project) return;
    const ids = Array.from(selectedIconIds);
    try {
      if (ids.length === 1) {
        const single = icons.find(i => i.id === ids[0]);
        if (single) {
          handleDownloadIcon(single);
          return;
        }
      }
      await api.downloadIcons(project.id, ids, project.name);
      success(`Downloaded ${ids.length} icon(s)${ids.length > 1 ? ' as ZIP' : ''}`);
    } catch (err: any) {
      error(err.message || 'Failed to download icons');
    }
  }, [selectedIconIds, project, icons, handleDownloadIcon, success, error]);

  // Batch actions
  const handleBatchMove = async (targetFolderId: string | null) => {
    const ids = Array.from(selectedIconIds);
    await handleDropIconsToFolder(targetFolderId, ids);
  };

  const handleBatchTag = async (tagsToAdd: string[]) => {
    try {
      const count = await api.batchTagIcons(projectId, Array.from(selectedIconIds), tagsToAdd);
      success(`Tagged ${count} icon(s)`);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to tag icons');
    }
  };

  const handleBatchOptimize = async () => {
    try {
      const res = await api.batchOptimizeIcons(projectId, Array.from(selectedIconIds));
      success(`Optimized ${res.optimizedCount} icons! Saved ${res.savingsKb} KB`);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Batch optimize failed');
    }
  };

  const handleBatchDelete = async () => {
    try {
      const count = await api.batchDeleteIcons(projectId, Array.from(selectedIconIds));
      success(`Moved ${count} icon(s) to trash`);
      setSelectedIconIds(new Set());
      setDeleteConfirmOpen(false);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Batch delete failed');
    }
  };

  // Trash actions
  const handleRestoreIcon = async (id: string) => {
    try {
      await api.restoreIcon(id);
      success('Icon restored');
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to restore icon');
    }
  };

  const handleRestoreAllTrash = async () => {
    try {
      const ids = trashIcons.map(i => i.id);
      await api.batchRestoreIcons(projectId, ids);
      success(`Restored ${ids.length} icon(s)`);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to restore icons');
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const count = await api.emptyTrash(projectId);
      success(`Emptied trash (${count} icons permanently deleted)`);
      loadProjectData();
    } catch (err: any) {
      error(err.message || 'Failed to empty trash');
    }
  };

  // Current folder name for breadcrumbs
  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === 'all') return 'All Icons';
    if (selectedFolderId === 'root') return 'Uncategorized';
    const folder = folders.find(f => f.id === selectedFolderId);
    return folder ? folder.name : 'All Icons';
  }, [folders, selectedFolderId]);

  if (!project) return null;

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
      {/* Top Workspace Header Bar */}
      <div className="border-b border-border bg-card px-6 lg:px-8 py-2.5 flex items-center justify-between shrink-0 relative">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full ring-2 ring-card shadow-sm"
            style={{ backgroundColor: project.color || '#3b82f6' }}
          />
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight flex items-center gap-2">
              <span>{project.name}</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                prefix: {project.prefix}
              </span>
              {project.purpose === 'font' ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Type className="w-2.5 h-2.5" />
                  Icon Font Project
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  SVG Sprite Project
                </span>
              )}

              {/* Visibility Badge */}
              {project.visibility === 'private' ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Lock className="w-2.5 h-2.5" />
                  Private
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Globe className="w-2.5 h-2.5" />
                  Public
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Tab Switcher - Centered */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center">
          <div className="flex bg-secondary p-1 rounded-xl text-xs font-semibold shadow-xs">
            <button
              onClick={() => setActiveTab('icons')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'icons' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Icons</span>
              <span className="text-[10px] font-mono bg-secondary/80 px-1.5 py-0.2 rounded-full">
                {icons.length}
              </span>
            </button>

            {/* Show Sprite tab only if project purpose is sprite */}
            {(!project.purpose || project.purpose === 'sprite') && (
              <button
                onClick={() => setActiveTab('sprite')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'sprite' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>SVG Sprite</span>
              </button>
            )}

            {/* Show Font tab only if project purpose is font */}
            {project.purpose === 'font' && (
              <button
                onClick={() => setActiveTab('font')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'font' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Type className="w-3.5 h-3.5 text-indigo-500" />
                <span>Icon Font</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'settings' ? 'bg-card text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings & Docs</span>
            </button>

            <button
              onClick={() => setActiveTab('trash')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'trash' ? 'bg-card text-rose-500 shadow-xs font-bold' : 'text-muted-foreground hover:text-rose-400'
              }`}
              title="Trash Bin"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {trashIcons.length > 0 && (
                <span className="text-[10px] font-mono bg-rose-500/20 text-rose-500 px-1.5 py-0.2 rounded-full font-bold">
                  {trashIcons.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Upload & Import Action Buttons with Dropdown Menu */}
        <div className="flex items-center gap-2">
          {(project.can_add_icons ?? project.can_edit ?? true) ? (
            <>
              {/* Main Upload Split Dropdown Button */}
              <div className="relative" ref={uploadDropdownRef}>
            <div className="inline-flex rounded-xl shadow-md shadow-blue-500/20">
              <button
                onClick={() => {
                  setUploadModalTab('files');
                  setUploadModalOpen(true);
                  setUploadDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-xl bg-primary hover:bg-blue-600 text-white font-semibold text-xs transition-all active:scale-95"
                title="Upload SVG icons or ZIP archive"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Icons</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadDropdownOpen(prev => !prev)}
                className="px-2 py-1.5 rounded-r-xl bg-primary hover:bg-blue-600 border-l border-white/20 text-white transition-all flex items-center justify-center cursor-pointer"
                title="More upload & import options"
                aria-expanded={uploadDropdownOpen}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${uploadDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {uploadDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-card border border-border rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Add Icons
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUploadModalTab('files');
                    setUploadModalOpen(true);
                    setUploadDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-secondary flex items-start gap-2.5 transition-colors group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      Upload Files / ZIP
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Upload SVGs or drag & drop ZIP files
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProjectImportModalOpen(true);
                    setUploadDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-secondary flex items-start gap-2.5 transition-colors group border-t border-border/50 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <FolderInput className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-emerald-500 transition-colors flex items-center gap-1.5">
                      <span>From Another Project</span>
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded-full">New</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Select and copy icons from other workspaces
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadModalTab('sprite');
                    setUploadModalOpen(true);
                    setUploadDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-secondary flex items-start gap-2.5 transition-colors group border-t border-border/50 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-purple-500 transition-colors">
                      Import SVG Sprite
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Extract symbols from an SVG sprite file
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadModalTab('font');
                    setUploadModalOpen(true);
                    setUploadDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-secondary flex items-start gap-2.5 transition-colors group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-amber-500 transition-colors">
                      Import Icon Font
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Extract glyphs from TTF, WOFF, WOFF2
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadModalTab('paste');
                    setUploadModalOpen(true);
                    setUploadDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-secondary flex items-start gap-2.5 transition-colors group border-t border-border/50 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-foreground transition-colors">
                      Paste SVG Code
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Paste raw SVG markup directly
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Quick Action: From Another Project */}
          <button
            onClick={() => setProjectImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-secondary text-foreground font-semibold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Copy icons directly from another project workspace"
          >
            <FolderInput className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">From Another Project</span>
            <span className="sm:hidden">From Project</span>
          </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold">
                <Eye className="w-3.5 h-3.5" />
                <span>View-Only Mode</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Contributor / View-Only Informational Banner */}
      {project.can_edit === false && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 shrink-0 text-blue-500" />
            <span>
              <strong>Public Project:</strong> You can view icons and add new icons. Existing icons, folders, and project settings can only be edited by the creator.
            </span>
          </div>
          <span className="font-semibold uppercase tracking-wider text-[10px] bg-blue-500/20 px-2.5 py-0.5 rounded-full shrink-0">
            Public Contributor
          </span>
        </div>
      )}

      {/* Main Workspace Body */}
      {activeTab === 'icons' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Collapsible Left Folder Tree */}
          <FolderTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            totalIconsCount={icons.length}
            canEdit={project.can_edit ?? true}
            onSelectFolder={setSelectedFolderId}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropIconsToFolder={handleDropIconsToFolder}
          />

          {/* Right Icon Library Explorer */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Explorer Toolbar */}
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card/40">
              {/* Breadcrumb & Select All */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium p-1 rounded-lg hover:bg-secondary"
                  title={selectedIconIds.size === displayedIcons.length ? 'Deselect All' : 'Select All'}
                >
                  {selectedIconIds.size > 0 && selectedIconIds.size === displayedIcons.length ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>All</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{project.name}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground bg-secondary px-2 py-0.5 rounded-md">
                    {selectedFolderName}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({displayedIcons.length} icons)
                  </span>
                </div>
              </div>

              {/* Controls: Search, Unified Size & Color, View Mode, Sort */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-44 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="icon-search-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search icons / #tags... (⌘K)"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>

                {/* Unified Size & Color Control Widget */}
                <div className="flex items-center bg-card border border-border rounded-xl px-2.5 py-1 shadow-xs gap-2">
                  {/* Size Adjuster */}
                  <div className="flex items-center gap-1.5" title={`Icon Size: ${iconSize}px`}>
                    <button
                      type="button"
                      onClick={() => setIconSize(prev => Math.max(16, prev - 4))}
                      className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Decrease Icon Size (-)"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="range"
                      min={16}
                      max={80}
                      step={2}
                      value={iconSize}
                      onChange={e => setIconSize(Number(e.target.value))}
                      className="w-16 sm:w-20 accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
                      title={`Icon Size: ${iconSize}px`}
                    />
                    <button
                      type="button"
                      onClick={() => setIconSize(prev => Math.min(80, prev + 4))}
                      className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Increase Icon Size (+)"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold min-w-[30px] text-center">
                      {iconSize}px
                    </span>
                  </div>

                  {/* Vertical Divider */}
                  <div className="h-4 w-px bg-border mx-0.5" />

                  {/* Color Changer in the exact same place */}
                  <div className="flex items-center gap-1.5">
                    {/* Default (Original SVG Colors) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIconColor('default');
                        setRenderStyle('natural');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        iconColor === 'default' && renderStyle === 'natural'
                          ? 'bg-primary text-white font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                      title="Reset to Original SVG Colors (Natural View)"
                    >
                      Default
                    </button>

                    {/* Color Swatches */}
                    {[
                      { label: 'Black', value: '#0f172a' },
                      { label: 'White', value: '#ffffff', border: true },
                      { label: 'Blue', value: '#3b82f6' },
                      { label: 'Emerald', value: '#10b981' },
                      { label: 'Amber', value: '#f59e0b' },
                      { label: 'Rose', value: '#ef4444' },
                      { label: 'Purple', value: '#8b5cf6' }
                    ].map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setIconColor(preset.value);
                          if (renderStyle === 'natural') setRenderStyle('flat');
                        }}
                        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 flex items-center justify-center ${
                          preset.border ? 'border border-border/80' : ''
                        } ${
                          iconColor === preset.value
                            ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                            : ''
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={`Color: ${preset.label}`}
                      />
                    ))}

                    {/* Custom Color Input Picker */}
                    <label
                      className={`relative w-4 h-4 rounded-full overflow-hidden cursor-pointer border border-border transition-transform hover:scale-125 flex items-center justify-center ${
                        iconColor !== 'default' &&
                        !['#0f172a', '#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].includes(iconColor)
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                          : ''
                      }`}
                      title="Custom Color Picker"
                      style={{
                        background:
                          iconColor !== 'default' &&
                          !['#0f172a', '#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].includes(iconColor)
                            ? iconColor
                            : 'conic-gradient(from 180deg at 50% 50%, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)'
                      }}
                    >
                      <input
                        type="color"
                        value={iconColor === 'default' ? '#3b82f6' : iconColor}
                        onChange={e => {
                          setIconColor(e.target.value);
                          if (renderStyle === 'natural') setRenderStyle('flat');
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Display Style: Natural, Flat, Wireframe */}
                <div className="flex bg-secondary p-0.5 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRenderStyle('natural');
                      setIconColor('default');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors font-medium text-[11px] ${
                      renderStyle === 'natural'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Natural View: Show the icon exactly as added (original colors & graphics)"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Natural</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderStyle('flat')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors font-medium text-[11px] ${
                      renderStyle === 'flat'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Flat View: Solid monochrome flat fill"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-blue-500" />
                    <span>Flat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderStyle('wireframe')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors font-medium text-[11px] ${
                      renderStyle === 'wireframe'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Wireframe View: Vector outline blueprint"
                  >
                    <Box className="w-3.5 h-3.5 text-purple-500" />
                    <span>Wireframe</span>
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-secondary p-0.5 rounded-xl border border-border">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="List View"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={sortOption}
                    onChange={e => setSortOption(e.target.value as any)}
                    className="bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                  >
                    <option value="newest">Newest First</option>
                    <option value="name_asc">Name (A-Z)</option>
                    <option value="name_desc">Name (Z-A)</option>
                    <option value="size_desc">Largest Size</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Icons Display Container */}
            <div className="flex-1 overflow-y-auto p-5">
              {displayedIcons.length > 0 ? (
                viewMode === 'grid' ? (
                  <IconGrid
                    icons={displayedIcons}
                    selectedIds={selectedIconIds}
                    cardSize={cardZoom}
                    iconSize={iconSize}
                    iconColor={iconColor}
                    renderStyle={renderStyle}
                    onToggleSelect={handleToggleSelect}
                    onSelectIcon={setDetailIconId}
                    onDownloadIcon={handleDownloadIcon}
                  />
                ) : (
                  <IconList
                    icons={displayedIcons}
                    folders={folders}
                    selectedIds={selectedIconIds}
                    iconSize={iconSize}
                    iconColor={iconColor}
                    renderStyle={renderStyle}
                    onToggleSelect={handleToggleSelect}
                    onSelectIcon={setDetailIconId}
                    onDownloadIcon={handleDownloadIcon}
                  />
                )
              ) : (
                <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl p-8 max-w-md mx-auto my-12">
                  <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground mb-3">
                    <UploadCloud className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">No icons in this view</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search ? `No icons matched "${search}".` : 'Upload SVG files or drag and drop a ZIP archive to get started.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setUploadModalTab('files');
                        setUploadModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-blue-600 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload Icons</span>
                    </button>
                    <button
                      onClick={() => setProjectImportModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      <span>From Another Project</span>
                    </button>
                    <button
                      onClick={() => {
                        setUploadModalTab('sprite');
                        setUploadModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      <span>Import Sprite / Font</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SVG Sprite Tab */}
      {activeTab === 'sprite' && (
        <SpriteTab
          project={project}
          folders={folders}
          currentFolderId={selectedFolderId}
          selectedIconIds={Array.from(selectedIconIds)}
        />
      )}

      {/* Icon Font Tab */}
      {activeTab === 'font' && (
        <FontTab
          project={project}
          folders={folders}
          currentFolderId={selectedFolderId}
          selectedIconIds={Array.from(selectedIconIds)}
        />
      )}

      {/* Settings & Docs Tab */}
      {activeTab === 'settings' && (
        <SettingsTab
          project={project}
          onUpdate={loadProjectData}
        />
      )}

      {/* Trash Tab */}
      {activeTab === 'trash' && (
        <TrashView
          trashIcons={trashIcons}
          onBackToIcons={() => setActiveTab('icons')}
          onRestoreIcon={handleRestoreIcon}
          onRestoreAll={handleRestoreAllTrash}
          onEmptyTrash={handleEmptyTrash}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIconIds.size}
        folders={folders}
        canEdit={project.can_edit ?? true}
        onClearSelection={() => setSelectedIconIds(new Set())}
        onBatchDownload={handleBatchDownload}
        onBatchMove={handleBatchMove}
        onBatchDelete={async () => setDeleteConfirmOpen(true)}
      />

      <IconUploadModal
        isOpen={uploadModalOpen}
        projectId={project.id}
        folders={folders}
        currentFolderId={selectedFolderId}
        initialTab={uploadModalTab}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadProjectData}
      />

      <ImportFromProjectModal
        isOpen={projectImportModalOpen}
        targetProjectId={project.id}
        targetProjectName={project.name}
        targetFolders={folders}
        currentTargetFolderId={selectedFolderId}
        onClose={() => setProjectImportModalOpen(false)}
        onSuccess={loadProjectData}
      />

      <IconDetailDrawer
        iconId={detailIconId}
        projectId={project.id}
        folders={folders}
        canEdit={project.can_edit ?? true}
        onClose={() => setDetailIconId(null)}
        onUpdate={loadProjectData}
        onDelete={async (id) => {
          await api.deleteIcon(id);
          success('Icon moved to trash');
          setDetailIconId(null);
          loadProjectData();
        }}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Move Icons to Trash?"
        message={`Are you sure you want to move ${selectedIconIds.size} icon(s) to the trash? You can restore them anytime from the Trash tab.`}
        confirmLabel="Move to Trash"
        danger
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleBatchDelete}
      />
    </div>
  );
}
