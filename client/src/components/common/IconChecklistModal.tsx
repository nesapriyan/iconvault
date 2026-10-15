import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  Search,
  Filter,
  AlertTriangle,
  Layers,
  Sparkles,
  Type,
  Folder as FolderIcon,
  FolderOpen,
  ShieldCheck,
  CheckSquare,
  Square,
  MinusSquare,
  ChevronDown,
  ChevronRight,
  FolderTree
} from 'lucide-react';
import { IconItem, Folder } from '../../types';

interface IconChecklistModalProps {
  isOpen: boolean;
  purpose: 'sprite' | 'font';
  icons: IconItem[];
  folders: Folder[];
  initialSelectedIds?: string[];
  isGenerating?: boolean;
  onClose: () => void;
  onConfirm: (selectedIconIds: string[]) => void;
}

export function IconChecklistModal({
  isOpen,
  purpose,
  icons,
  folders,
  initialSelectedIds,
  isGenerating = false,
  onClose,
  onConfirm
}: IconChecklistModalProps) {
  // Map of selected icon IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return new Set(initialSelectedIds);
    }
    // Default to all active icons
    return new Set(icons.map(i => i.id));
  });

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [warningFilter, setWarningFilter] = useState<'all' | 'safe_only' | 'warnings_only' | 'selected_only'>('all');
  const [groupByFolder, setGroupByFolder] = useState<boolean>(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Sync when modal opens or icons change
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        setSelectedIds(new Set(icons.map(i => i.id)));
      }
      setSearch('');
      setFolderFilter('all');
      setWarningFilter('all');
      setCollapsedFolders(new Set());
    }
  }, [isOpen, initialSelectedIds, icons]);

  const folderMap = useMemo(() => {
    return new Map(folders.map(f => [f.id, f.name]));
  }, [folders]);

  // Helper to build recursive folder path: e.g. "Navigation / Arrows"
  const getFolderPath = (folderId: string): string => {
    const f = folders.find(item => item.id === folderId);
    if (!f) return '';
    if (f.parent_id) {
      const parentPath = getFolderPath(f.parent_id);
      return parentPath ? `${parentPath} / ${f.name}` : f.name;
    }
    return f.name;
  };

  // Filtered list of icons based on search, folder, and warning filter
  const displayedIcons = useMemo(() => {
    return icons.filter(icon => {
      // Folder filter
      if (folderFilter !== 'all') {
        if (folderFilter === 'root' && icon.folder_id !== null) return false;
        if (folderFilter !== 'root' && icon.folder_id !== folderFilter) return false;
      }

      // Warning filter
      const hasWarning = !!(icon.has_stroke || icon.has_gradient || icon.has_text);
      if (warningFilter === 'safe_only' && hasWarning) return false;
      if (warningFilter === 'warnings_only' && !hasWarning) return false;
      if (warningFilter === 'selected_only' && !selectedIds.has(icon.id)) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = icon.name.toLowerCase().includes(q);
        const matchesSlug = (icon.slug || '').toLowerCase().includes(q);
        const tags = Array.isArray(icon.tags) ? icon.tags : [];
        const matchesTag = tags.some(t => typeof t === 'string' && t.toLowerCase().includes(q));
        return matchesName || matchesSlug || matchesTag;
      }

      return true;
    });
  }, [icons, search, folderFilter, warningFilter, selectedIds]);

  // Group displayed icons into folder categories
  const folderGroups = useMemo(() => {
    const map = new Map<string | null, IconItem[]>();
    map.set(null, []);
    folders.forEach(f => map.set(f.id, []));

    displayedIcons.forEach(icon => {
      const fid = icon.folder_id;
      if (fid && map.has(fid)) {
        map.get(fid)!.push(icon);
      } else {
        map.get(null)!.push(icon);
      }
    });

    const groups: Array<{
      key: string;
      folderId: string | null;
      name: string;
      fullPath: string;
      icons: IconItem[];
    }> = [];

    // Root icons group
    const rootIcons = map.get(null) || [];
    if (rootIcons.length > 0 || (folders.length === 0 && !search.trim())) {
      groups.push({
        key: 'root',
        folderId: null,
        name: 'Root / Unfiled',
        fullPath: 'Root Icons',
        icons: rootIcons
      });
    }

    // Sort folders by hierarchical path name
    const sortedFolders = [...folders].sort((a, b) => {
      return getFolderPath(a.id).localeCompare(getFolderPath(b.id));
    });

    sortedFolders.forEach(f => {
      const fIcons = map.get(f.id) || [];
      // Only include folders that have matching icons or when viewing all without filters
      if (fIcons.length > 0 || (!search.trim() && folderFilter === 'all' && warningFilter === 'all')) {
        groups.push({
          key: f.id,
          folderId: f.id,
          name: f.name,
          fullPath: getFolderPath(f.id),
          icons: fIcons
        });
      }
    });

    return groups;
  }, [displayedIcons, folders, search, folderFilter, warningFilter]);

  // Toggle single icon
  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Toggle selection for all icons in a specific folder
  const handleToggleFolderSelect = (folderIcons: IconItem[]) => {
    const next = new Set(selectedIds);
    const allSelected = folderIcons.length > 0 && folderIcons.every(i => next.has(i.id));

    if (allSelected) {
      // Deselect all icons in this folder
      folderIcons.forEach(i => next.delete(i.id));
    } else {
      // Select all icons in this folder
      folderIcons.forEach(i => next.add(i.id));
    }
    setSelectedIds(next);
  };

  // Toggle collapse state for a folder group
  const handleToggleFolderCollapse = (folderKey: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  };

  // Global bulk actions
  const handleSelectAllDisplayed = () => {
    const next = new Set(selectedIds);
    displayedIcons.forEach(i => next.add(i.id));
    setSelectedIds(next);
  };

  const handleDeselectAllDisplayed = () => {
    const next = new Set(selectedIds);
    displayedIcons.forEach(i => next.delete(i.id));
    setSelectedIds(next);
  };

  const handleSelectOnlySafe = () => {
    const safeIds = icons
      .filter(i => !(i.has_stroke || i.has_gradient || i.has_text))
      .map(i => i.id);
    setSelectedIds(new Set(safeIds));
  };

  const selectedCount = selectedIds.size;
  const totalCount = icons.length;

  const warningCountInSelection = useMemo(() => {
    return icons.filter(i => selectedIds.has(i.id) && (i.has_stroke || i.has_gradient || i.has_text)).length;
  }, [icons, selectedIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-5xl w-full flex flex-col shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              purpose === 'font'
                ? 'bg-indigo-500/10 text-indigo-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}>
              {purpose === 'font' ? <Type className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {purpose === 'font'
                    ? 'Icon Selection Checklist for Font'
                    : 'Icon Selection Checklist for Sprite'}
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  purpose === 'font'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {purpose === 'font' ? 'Icon Font' : 'SVG Sprite'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check the icons you want included in this build. You can select or deselect whole folders at once.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-border bg-secondary/30 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter checklist by icon name or tag..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Folder Dropdown */}
            {folders.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderIcon className="w-3.5 h-3.5" />
                <select
                  value={folderFilter}
                  onChange={e => setFolderFilter(e.target.value)}
                  className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All Folders</option>
                  <option value="root">Root only (no folder)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {getFolderPath(f.id)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode & Filter pills */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setGroupByFolder(!groupByFolder)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                  groupByFolder
                    ? 'bg-primary text-white font-medium shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
                title="Toggle Folder Structure Grouping"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Group by Folder</span>
              </button>

              <button
                onClick={() => setWarningFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  warningFilter === 'all'
                    ? 'bg-primary text-white font-medium shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                All ({icons.length})
              </button>
              <button
                onClick={() => setWarningFilter('selected_only')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  warningFilter === 'selected_only'
                    ? 'bg-primary text-white font-medium shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                Selected ({selectedCount})
              </button>
              {purpose === 'font' && (
                <button
                  onClick={() => setWarningFilter(warningFilter === 'safe_only' ? 'all' : 'safe_only')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                    warningFilter === 'safe_only'
                      ? 'bg-emerald-600 text-white font-medium shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                  }`}
                  title="Show only icons with pure fills (no strokes or gradients)"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Clean Fills</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Selection Buttons */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllDisplayed}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors font-medium"
              >
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                Select All ({displayedIcons.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAllDisplayed}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Deselect All
              </button>
              {purpose === 'font' && (
                <button
                  type="button"
                  onClick={handleSelectOnlySafe}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Select Safe Icons Only
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-foreground">
              <span className="text-primary">{selectedCount}</span> of {totalCount} icons selected for build
            </div>
          </div>
        </div>

        {/* Warning Banner if stroke/gradient icons are selected for font */}
        {purpose === 'font' && warningCountInSelection > 0 && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>{warningCountInSelection}</strong> selected icon(s) contain strokes or gradients. Font glyphs render best with outlined fills.
              </span>
            </div>
            <button
              onClick={handleSelectOnlySafe}
              className="text-[11px] underline font-semibold hover:text-amber-400 shrink-0 ml-2"
            >
              Uncheck stroke icons
            </button>
          </div>
        )}

        {/* Checklist Content Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-background space-y-4">
          {displayedIcons.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Layers className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-semibold">No icons match your filter</p>
              <p className="text-xs mt-1">Try clearing your search query or folder filter.</p>
            </div>
          ) : groupByFolder ? (
            // Folder Grouped View
            <div className="space-y-4">
              {folderGroups.map(group => {
                if (group.icons.length === 0) return null;
                const isCollapsed = collapsedFolders.has(group.key);
                const selectedInGroupCount = group.icons.filter(i => selectedIds.has(i.id)).length;
                const allSelected = selectedInGroupCount === group.icons.length;
                const someSelected = selectedInGroupCount > 0 && !allSelected;

                return (
                  <div
                    key={group.key}
                    className="border border-border rounded-2xl overflow-hidden bg-card/60 shadow-xs"
                  >
                    {/* Folder Header with Select All Folder checkbox */}
                    <div
                      onClick={() => handleToggleFolderCollapse(group.key)}
                      className="px-4 py-2.5 bg-secondary/50 border-b border-border flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Collapse chevron */}
                        <div className="text-muted-foreground hover:text-foreground">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>

                        {/* Tri-state folder checkbox */}
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleFolderSelect(group.icons);
                          }}
                          className="flex items-center gap-1.5 p-0.5 hover:opacity-80 transition-opacity"
                          title={allSelected ? 'Deselect all in folder' : 'Select all in folder'}
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : someSelected ? (
                            <MinusSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Folder icon & name */}
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <FolderIcon className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="font-bold text-xs text-foreground">
                            {group.name}
                          </span>
                          {group.folderId && group.fullPath !== group.name && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                              {group.fullPath}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-muted-foreground">
                            ({group.icons.length} {group.icons.length === 1 ? 'icon' : 'icons'})
                          </span>
                        </div>
                      </div>

                      {/* Folder Selection summary and quick button */}
                      <div className="flex items-center gap-3 text-xs" onClick={e => e.stopPropagation()}>
                        <span className="text-[11px] text-muted-foreground">
                          <strong className={selectedInGroupCount > 0 ? 'text-primary' : 'text-foreground'}>
                            {selectedInGroupCount}
                          </strong>{' '}
                          of {group.icons.length} selected
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleFolderSelect(group.icons)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-card border border-border hover:bg-secondary text-foreground transition-colors shadow-xs"
                        >
                          {allSelected ? 'Deselect Folder' : 'Select Folder'}
                        </button>
                      </div>
                    </div>

                    {/* Folder Icons Grid */}
                    {!isCollapsed && (
                      <div className="p-3 bg-card/40">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {group.icons.map(icon => {
                            const isChecked = selectedIds.has(icon.id);
                            const hasWarning = !!(icon.has_stroke || icon.has_gradient || icon.has_text);

                            return (
                              <div
                                key={icon.id}
                                onClick={() => handleToggle(icon.id)}
                                className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                                  isChecked
                                    ? 'border-primary/60 bg-primary/5 hover:border-primary shadow-xs'
                                    : 'border-border/70 bg-card hover:border-border hover:bg-secondary/40 opacity-60 hover:opacity-100'
                                }`}
                              >
                                {/* Checkbox */}
                                <div
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                    isChecked
                                      ? 'bg-primary border-primary text-white'
                                      : 'border-muted-foreground/40 bg-secondary/80 group-hover:border-primary'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>

                                {/* SVG Preview */}
                                <div
                                  style={{ width: '32px', height: '32px' }}
                                  dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                                  className="[&>svg]:w-full [&>svg]:h-full text-foreground shrink-0 flex items-center justify-center"
                                />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-foreground truncate" title={icon.name}>
                                      {icon.name}
                                    </span>
                                    {hasWarning && purpose === 'font' && (
                                      <span
                                        title="Stroke or gradient: outline recommended for font"
                                        className="text-amber-500 shrink-0"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {purpose === 'font' && icon.codepoint && (
                                      <span className="font-mono text-indigo-400 bg-indigo-500/10 px-1 rounded uppercase">
                                        \{icon.codepoint}
                                      </span>
                                    )}
                                    <span>{icon.width}×{icon.height}</span>
                                    <span>•</span>
                                    <span>{(icon.byte_size / 1024).toFixed(1)} KB</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Flat Grid View
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {displayedIcons.map(icon => {
                const isChecked = selectedIds.has(icon.id);
                const hasWarning = !!(icon.has_stroke || icon.has_gradient || icon.has_text);
                const folderName = icon.folder_id ? folderMap.get(icon.folder_id) : null;

                return (
                  <div
                    key={icon.id}
                    onClick={() => handleToggle(icon.id)}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                      isChecked
                        ? 'border-primary/60 bg-primary/5 hover:border-primary shadow-xs'
                        : 'border-border/70 bg-card hover:border-border hover:bg-secondary/40 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isChecked
                          ? 'bg-primary border-primary text-white'
                          : 'border-muted-foreground/40 bg-secondary/80 group-hover:border-primary'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    {/* SVG Preview */}
                    <div
                      style={{ width: '32px', height: '32px' }}
                      dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                      className="[&>svg]:w-full [&>svg]:h-full text-foreground shrink-0 flex items-center justify-center"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-foreground truncate" title={icon.name}>
                          {icon.name}
                        </span>
                        {hasWarning && purpose === 'font' && (
                          <span
                            title="Stroke or gradient: outline recommended for font"
                            className="text-amber-500 shrink-0"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate">
                        {purpose === 'font' && icon.codepoint && (
                          <span className="font-mono text-indigo-400 bg-indigo-500/10 px-1 rounded uppercase">
                            \{icon.codepoint}
                          </span>
                        )}
                        <span>{icon.width}×{icon.height}</span>
                        <span>•</span>
                        <span>{(icon.byte_size / 1024).toFixed(1)} KB</span>
                        {folderName && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[70px] bg-secondary px-1 rounded text-muted-foreground">
                              {folderName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedCount === 0 ? (
              <span className="text-rose-500 font-medium">Please select at least 1 icon to generate.</span>
            ) : (
              <span>
                Ready to generate with <strong>{selectedCount}</strong> icon(s).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || isGenerating}
              onClick={() => onConfirm(Array.from(selectedIds))}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                purpose === 'font'
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
              }`}
            >
              {purpose === 'font' ? <Type className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating
                ? 'Generating...'
                : `Generate ${purpose === 'font' ? 'Font' : 'Sprite'} (${selectedCount} Icons)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
