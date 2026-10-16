import React from 'react';
import { Copy, Download, Globe, Lock, ArrowUpRight, FolderKanban } from 'lucide-react';
import { GlobalSearchIconItem } from '../../types';
import { getAvatarStyle } from './ProjectCard';

interface GlobalIconSearchCardProps {
  icon: GlobalSearchIconItem;
  onOpenProject: (projectId: string) => void;
  onCopyIcon: (icon: GlobalSearchIconItem) => void;
  onDownloadIcon: (icon: GlobalSearchIconItem) => void;
}

export function GlobalIconSearchCard({
  icon,
  onOpenProject,
  onCopyIcon,
  onDownloadIcon
}: GlobalIconSearchCardProps) {
  const avatarStyle = getAvatarStyle({
    id: icon.project_id,
    name: icon.project_name || 'Project',
    color: icon.project_color
  });

  const isPublic = icon.project_visibility === 'public';

  const tagsList = React.useMemo(() => {
    if (Array.isArray(icon.tags)) return icon.tags;
    if (typeof icon.tags === 'string') {
      try {
        const parsed = JSON.parse(icon.tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [icon.tags]);

  return (
    <div className="group relative bg-card border border-border hover:border-primary/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      {/* Top Bar: Project Badge and Quick Download */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Project Badge - Clickable to open project */}
        <button
          type="button"
          onClick={() => onOpenProject(icon.project_id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary/70 hover:bg-secondary border border-border/70 text-foreground transition-all cursor-pointer max-w-[170px] truncate group/proj"
          title={`Open project: ${icon.project_name}`}
        >
          {/* Avatar Letter */}
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarStyle.className}`}
            style={avatarStyle.style}
          >
            {(icon.project_name || 'P')[0].toUpperCase()}
          </div>
          <span className="text-xs font-semibold truncate text-foreground group-hover/proj:text-primary transition-colors">
            {icon.project_name || 'Project'}
          </span>
          {/* Visibility Icon */}
          <span title={isPublic ? 'Public Project' : 'Private Project'} className="inline-flex">
            {isPublic ? (
              <Globe className="w-3 h-3 text-blue-500 shrink-0" />
            ) : (
              <Lock className="w-3 h-3 text-purple-500 shrink-0" />
            )}
          </span>
          <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/proj:opacity-100 transition-opacity shrink-0" />
        </button>

        {/* Quick Download Button */}
        <button
          type="button"
          onClick={() => onDownloadIcon(icon)}
          className="w-7 h-7 rounded-lg border border-border/70 bg-card hover:bg-blue-600 hover:text-white hover:border-blue-600 text-muted-foreground flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90"
          title={`Download ${icon.name}.svg`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SVG Preview Box */}
      <div className="w-full h-24 my-1 flex items-center justify-center rounded-xl bg-secondary/30 group-hover:bg-secondary/60 transition-colors p-3 select-none">
        <div
          className="w-10 h-10 flex items-center justify-center text-foreground group-hover:text-primary transition-colors [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
        />
      </div>

      {/* Icon Details */}
      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate" title={icon.name}>
            {icon.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {(icon.byte_size / 1024).toFixed(1)} KB
          </span>
        </div>

        {/* Tags or Dimensions */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary border border-border/50 font-mono">
            {icon.project_prefix ? `${icon.project_prefix}-` : ''}{icon.slug}
          </span>
          {tagsList.length > 0 && (
            <span className="text-[10px] text-muted-foreground/80 truncate" title={tagsList.join(', ')}>
              • {tagsList.slice(0, 2).join(', ')}{tagsList.length > 2 ? ` +${tagsList.length - 2}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Action: Copy to Project Button */}
      <div className="mt-3.5 pt-2.5 border-t border-border/70 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCopyIcon(icon)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
          title={`Copy "${icon.name}" to another project`}
        >
          <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Copy to Project</span>
        </button>
      </div>
    </div>
  );
}
