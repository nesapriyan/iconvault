import React, { useState, useEffect } from 'react';
import { X, Copy, FolderInput, Folder as FolderIcon, Sparkles, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Project, Folder, GlobalSearchIconItem, IconItem } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';
import { getAvatarStyle } from '../dashboard/ProjectCard';

interface CopyIconModalProps {
  isOpen: boolean;
  icon: (IconItem & { project_name?: string; project_prefix?: string; project_color?: string }) | null;
  projects: Project[];
  onClose: () => void;
  onSuccess?: (targetProject: Project) => void;
}

export function CopyIconModal({
  isOpen,
  icon,
  projects,
  onClose,
  onSuccess
}: CopyIconModalProps) {
  const { success, error } = useToast();

  // Eligible destination projects (can add icons)
  const eligibleProjects = React.useMemo(() => {
    return projects.filter(p => !p.is_archived && p.can_add_icons !== false);
  }, [projects]);

  // Initial target project: Pick first eligible project that isn't the icon's current project (or first eligible)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [targetFolders, setTargetFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'rename' | 'replace' | 'skip'>('rename');
  const [autoOptimize, setAutoOptimize] = useState<boolean>(true);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && icon) {
      const defaultTarget = eligibleProjects.find(p => p.id !== icon.project_id) || eligibleProjects[0];
      setSelectedProjectId(defaultTarget?.id || '');
      setSelectedFolderId('');
      setDuplicateStrategy('rename');
      setAutoOptimize(true);
    }
  }, [isOpen, icon, eligibleProjects]);

  // When target project changes, fetch its folders
  useEffect(() => {
    if (!selectedProjectId) {
      setTargetFolders([]);
      return;
    }

    let isMounted = true;
    setLoadingFolders(true);
    api.getFolders(selectedProjectId)
      .then(folders => {
        if (isMounted) {
          setTargetFolders(folders || []);
          setSelectedFolderId('');
        }
      })
      .catch(err => {
        console.warn('Failed to fetch folders for target project:', err);
        if (isMounted) setTargetFolders([]);
      })
      .finally(() => {
        if (isMounted) setLoadingFolders(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  if (!isOpen || !icon) return null;

  const targetProject = projects.find(p => p.id === selectedProjectId);
  const isSameProject = selectedProjectId === icon.project_id;

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      error('Please select a destination project');
      return;
    }
    if (isSameProject) {
      error('Please select a different destination project');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.copyIconsFromProject(selectedProjectId, {
        sourceProjectId: icon.project_id,
        iconIds: [icon.id],
        folderId: selectedFolderId || undefined,
        duplicateStrategy,
        autoOptimize
      });

      if (res.errors && res.errors.length > 0 && res.copiedCount === 0) {
        throw new Error(res.errors[0].error || 'Failed to copy icon');
      }

      success(`Icon "${icon.name}" copied to "${targetProject?.name || 'target project'}" successfully!`);
      if (targetProject && onSuccess) {
        onSuccess(targetProject);
      }
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to copy icon to destination project');
    } finally {
      setSubmitting(false);
    }
  };

  const sourceAvatarStyle = getAvatarStyle({
    id: icon.project_id,
    name: icon.project_name || 'Project',
    color: icon.project_color
  });

  const targetAvatarStyle = targetProject
    ? getAvatarStyle(targetProject)
    : { className: 'bg-muted' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Copy className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Copy Icon to Project</h2>
              <p className="text-xs text-muted-foreground">Duplicate and place this icon into another project vault</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCopy} className="p-6 flex flex-col gap-5">
          {/* Selected Icon Card Preview */}
          <div className="p-3.5 bg-secondary/50 rounded-xl border border-border/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 p-1.5 shadow-2xs">
              <div
                className="w-full h-full flex items-center justify-center text-foreground [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{icon.name}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{(icon.byte_size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span className="truncate">{icon.width || 24}×{icon.height || 24}</span>
              </div>
            </div>
            {/* Source Project Pill */}
            <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-muted-foreground">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${sourceAvatarStyle.className}`}
                style={sourceAvatarStyle.style}
              >
                {(icon.project_name || 'P')[0].toUpperCase()}
              </div>
              <span className="truncate max-w-[110px] font-medium text-foreground text-[11px]">
                {icon.project_name || 'Current Project'}
              </span>
            </div>
          </div>

          {/* Destination Project Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Destination Project *</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {eligibleProjects.length} accessible project{eligibleProjects.length === 1 ? '' : 's'}
              </span>
            </label>
            {eligibleProjects.length === 0 ? (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                No accessible destination projects found. Please create a project first.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs appearance-none pr-9 cursor-pointer"
                  required
                >
                  <option value="" disabled>Select target project...</option>
                  {eligibleProjects.map(proj => (
                    <option key={proj.id} value={proj.id} disabled={proj.id === icon.project_id}>
                      {proj.name} ({proj.prefix}) {proj.id === icon.project_id ? '— (Current project)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {isSameProject && (
              <p className="text-[11px] text-amber-500">
                Please select a project other than the icon's current project.
              </p>
            )}
          </div>

          {/* Destination Folder Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Destination Folder (Optional)</span>
              {loadingFolders && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading folders...
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedFolderId}
                onChange={e => setSelectedFolderId(e.target.value)}
                disabled={!selectedProjectId || loadingFolders}
                className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs appearance-none pr-9 cursor-pointer disabled:opacity-50"
              >
                <option value="">📁 Root (No folder)</option>
                {targetFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    📁 {folder.name} ({folder.icon_count || 0} icons)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Duplicate Conflict Strategy */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground">If icon name already exists in target:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rename', label: 'Rename', desc: 'Add -1 suffix' },
                { id: 'replace', label: 'Replace', desc: 'Overwrite' },
                { id: 'skip', label: 'Skip', desc: 'Do not copy' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDuplicateStrategy(opt.id as any)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs text-center transition-all cursor-pointer ${
                    duplicateStrategy === opt.id
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/30'
                      : 'border-border bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Options: Auto Optimize */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={autoOptimize}
              onChange={e => setAutoOptimize(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-card cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Optimize SVG on copy (clean up paths & attributes)</span>
            </span>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProjectId || isSameProject || eligibleProjects.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Copying...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Copy Icon</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
