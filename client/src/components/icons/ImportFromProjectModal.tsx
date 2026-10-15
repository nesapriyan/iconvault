import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FolderInput,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  ChevronRight,
  Folder as FolderIcon,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  AlertCircle,
  Copy,
  Globe,
  Lock
} from 'lucide-react';
import { Project, Folder, IconItem } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';

interface ImportFromProjectModalProps {
  isOpen: boolean;
  targetProjectId: string;
  targetProjectName: string;
  targetFolders: Folder[];
  currentTargetFolderId: string | null | 'all' | 'root';
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportFromProjectModal({
  isOpen,
  targetProjectId,
  targetProjectName,
  targetFolders,
  currentTargetFolderId,
  onClose,
  onSuccess
}: ImportFromProjectModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState<string>('');

  const [sourceFolders, setSourceFolders] = useState<Folder[]>([]);
  const [sourceIcons, setSourceIcons] = useState<IconItem[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(false);

  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIconIds, setSelectedIconIds] = useState<Set<string>>(new Set());

  // Destination options
  const [targetFolderId, setTargetFolderId] = useState<string | null>(() => {
    return (currentTargetFolderId && currentTargetFolderId !== 'all' && currentTargetFolderId !== 'root')
      ? currentTargetFolderId
      : null;
  });
  const [duplicateStrategy, setDuplicateStrategy] = useState<'rename' | 'replace' | 'skip'>('rename');
  const [autoOptimize, setAutoOptimize] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  // Load available source projects when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingProjects(true);
      setError(null);
      setSelectedIconIds(new Set());
      setSearchQuery('');
      setSelectedFolderFilter('all');
      setTargetFolderId(
        currentTargetFolderId && currentTargetFolderId !== 'all' && currentTargetFolderId !== 'root'
          ? currentTargetFolderId
          : null
      );

      api.getProjects({ visibility: 'public' })
        .then(allProjects => {
          // Exclude target project and exclude private projects (only public projects can be used as an import source)
          const available = allProjects.filter(p => p.id !== targetProjectId && p.visibility === 'public');
          setProjects(available);
          if (available.length > 0) {
            setSelectedSourceProjectId(available[0].id);
          } else {
            setSelectedSourceProjectId('');
          }
        })
        .catch(err => {
          setError(err.message || 'Failed to load projects');
        })
        .finally(() => {
          setLoadingProjects(false);
        });
    }
  }, [isOpen, targetProjectId, currentTargetFolderId]);

  // Load source project's folders and icons when source project changes
  useEffect(() => {
    if (!isOpen || !selectedSourceProjectId) {
      setSourceFolders([]);
      setSourceIcons([]);
      setSelectedIconIds(new Set());
      return;
    }

    setLoadingIcons(true);
    setSelectedIconIds(new Set());
    setError(null);

    Promise.all([
      api.getFolders(selectedSourceProjectId),
      api.getIcons(selectedSourceProjectId, { limit: 1000 })
    ])
      .then(([foldersRes, iconsRes]) => {
        setSourceFolders(foldersRes);
        setSourceIcons(iconsRes.icons || []);
      })
      .catch(err => {
        setError(err.message || 'Failed to load icons from the selected project');
      })
      .finally(() => {
        setLoadingIcons(false);
      });
  }, [isOpen, selectedSourceProjectId]);

  // Selected source project object
  const currentSourceProject = useMemo(() => {
    return projects.find(p => p.id === selectedSourceProjectId) || null;
  }, [projects, selectedSourceProjectId]);

  // Filtered source icons based on folder and search query
  const filteredIcons = useMemo(() => {
    return sourceIcons.filter(icon => {
      // Folder filter
      if (selectedFolderFilter === 'root') {
        if (icon.folder_id !== null) return false;
      } else if (selectedFolderFilter !== 'all') {
        if (icon.folder_id !== selectedFolderFilter) return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = icon.name.toLowerCase().includes(q);
      const matchSlug = (icon.slug || '').toLowerCase().includes(q);
      const matchTags = Array.isArray(icon.tags) && icon.tags.some(t => t.toLowerCase().includes(q));
      return matchName || matchSlug || matchTags;
    });
  }, [sourceIcons, selectedFolderFilter, searchQuery]);

  // Selection handlers
  const handleToggleIcon = (iconId: string) => {
    setSelectedIconIds(prev => {
      const next = new Set(prev);
      if (next.has(iconId)) next.delete(iconId);
      else next.add(iconId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (filteredIcons.every(i => selectedIconIds.has(i.id))) {
      // Deselect all filtered
      setSelectedIconIds(prev => {
        const next = new Set(prev);
        filteredIcons.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIconIds(prev => {
        const next = new Set(prev);
        filteredIcons.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  const isAllFilteredSelected = filteredIcons.length > 0 && filteredIcons.every(i => selectedIconIds.has(i.id));
  const isSomeFilteredSelected = filteredIcons.length > 0 && filteredIcons.some(i => selectedIconIds.has(i.id)) && !isAllFilteredSelected;

  // Submit copy request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIconIds.size === 0) {
      setError('Please select at least one icon to copy');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.copyIconsFromProject(targetProjectId, {
        sourceProjectId: selectedSourceProjectId,
        iconIds: Array.from(selectedIconIds),
        folderId: targetFolderId,
        duplicateStrategy,
        autoOptimize
      });

      success(`Successfully copied ${res.copiedCount} icon${res.copiedCount === 1 ? '' : 's'} into "${targetProjectName}"`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to copy icons from project');
      toastError(err.message || 'Copy failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Add Icons from Another Project
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Copy existing icons from another public workspace into{' '}
                <span className="font-semibold text-foreground">"{targetProjectName}"</span>. Private projects cannot be used as an import source.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Selector Section */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Select Source Project
            </label>
            {loadingProjects ? (
              <div className="p-4 bg-secondary/50 rounded-xl border border-border text-xs text-muted-foreground animate-pulse">
                Loading available projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="p-6 bg-secondary/30 rounded-xl border border-dashed border-border text-center">
                <Copy className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No other public projects found</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Only public projects can be used to copy icons into other workspaces. Private projects cannot be used as an import source.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSourceProjectId}
                  onChange={e => setSelectedSourceProjectId(e.target.value)}
                  className="bg-secondary/70 border border-border rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-md w-full sm:w-auto"
                >
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.icon_count || 0} icons)
                    </option>
                  ))}
                </select>

                {currentSourceProject && (
                  <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-muted-foreground">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: currentSourceProject.color || '#3b82f6' }}
                    />
                    <span>Prefix: <span className="font-mono text-foreground">{currentSourceProject.prefix}</span></span>
                    <span>•</span>
                    <span>Total Icons: <strong className="text-foreground">{sourceIcons.length}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> Public Project
                      </span>
                    </span>
                    {currentSourceProject.owner_name && (
                      <>
                        <span>•</span>
                        <span className="text-[11px]">Owner: {currentSourceProject.owner_name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Icon Explorer & Selection (Only if source project selected) */}
          {selectedSourceProjectId && (
            <div className="border border-border rounded-xl overflow-hidden bg-card/40 flex flex-col">
              {/* Explorer Toolbar */}
              <div className="p-3 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    disabled={filteredIcons.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : isSomeFilteredSelected ? (
                      <MinusSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>
                      {isAllFilteredSelected ? 'Deselect All' : 'Select All'} ({filteredIcons.length})
                    </span>
                  </button>

                  <span className="text-xs text-muted-foreground font-medium">
                    <strong className="text-foreground font-semibold">{selectedIconIds.size}</strong> selected
                  </span>
                </div>

                {/* Folder filter & Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  {sourceFolders.length > 0 && (
                    <select
                      value={selectedFolderFilter}
                      onChange={e => setSelectedFolderFilter(e.target.value)}
                      className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="all">All Folders ({sourceIcons.length})</option>
                      <option value="root">Root / Unfiled ({sourceIcons.filter(i => !i.folder_id).length})</option>
                      {sourceFolders.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({sourceIcons.filter(i => i.folder_id === f.id).length})
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="relative w-40 sm:w-52">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search icons..."
                      className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Icon Grid Area */}
              <div className="p-4 max-h-72 overflow-y-auto">
                {loadingIcons ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading source icons...
                  </div>
                ) : filteredIcons.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No icons match the selected criteria in this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {filteredIcons.map(icon => {
                      const isSelected = selectedIconIds.has(icon.id);
                      return (
                        <div
                          key={icon.id}
                          onClick={() => handleToggleIcon(icon.id)}
                          className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center select-none ${
                            isSelected
                              ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary'
                              : 'bg-card border-border hover:border-border/80 hover:bg-secondary/40'
                          }`}
                        >
                          {/* Top-Right Checkbox */}
                          <div className="absolute top-1.5 right-1.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                            )}
                          </div>

                          {/* SVG Preview */}
                          <div
                            className="w-10 h-10 flex items-center justify-center text-foreground my-1.5 [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-[36px] [&>svg]:max-h-[36px]"
                            dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                          />

                          {/* Icon Name & Size */}
                          <span
                            className="text-[11px] font-medium text-foreground truncate w-full px-1"
                            title={icon.name}
                          >
                            {icon.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {(icon.byte_size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Destination Options */}
          {selectedSourceProjectId && sourceIcons.length > 0 && (
            <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>Destination Options in "{targetProjectName}"</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Folder */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Destination Folder
                  </label>
                  <select
                    value={targetFolderId || ''}
                    onChange={e => setTargetFolderId(e.target.value ? e.target.value : null)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Root / Unfiled (No folder)</option>
                    {targetFolders.map(f => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duplicate Strategy */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Duplicate Name Handling
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={e => setDuplicateStrategy(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="rename">Auto-rename duplicates (e.g. icon-1)</option>
                    <option value="replace">Replace existing icon if name matches</option>
                    <option value="skip">Skip duplicates (do not overwrite)</option>
                  </select>
                </div>
              </div>

              {/* Optimize toggle */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <input
                  type="checkbox"
                  id="copy-auto-optimize"
                  checked={autoOptimize}
                  onChange={e => setAutoOptimize(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                />
                <label htmlFor="copy-auto-optimize" className="text-xs text-foreground cursor-pointer flex items-center gap-1">
                  <span>Auto-optimize SVGs with SVGO (removes junk XML & minifies paths)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card/60">
          <div className="text-xs text-muted-foreground">
            {selectedIconIds.size > 0 ? (
              <span>
                <strong className="text-foreground font-semibold">{selectedIconIds.size}</strong> icon{selectedIconIds.size === 1 ? '' : 's'} ready to copy
              </span>
            ) : (
              <span>Select icons above to copy into this project</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedIconIds.size === 0 || projects.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-blue-600 text-white font-semibold text-xs transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Copying...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Add {selectedIconIds.size} Icons</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
