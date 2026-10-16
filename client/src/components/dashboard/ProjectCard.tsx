import React, { useState, useRef, useEffect } from 'react';
import { Layers, Copy, Edit2, Trash2, Clock, Sparkles, Type, Lock, Globe, MoreVertical } from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onEdit: (project: Project) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

const AVATAR_GRADIENTS = [
  'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/20',
  'bg-gradient-to-tr from-purple-600 to-pink-500 shadow-purple-500/20',
  'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20',
  'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-500/20',
  'bg-gradient-to-tr from-rose-600 to-pink-500 shadow-rose-500/20',
  'bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-cyan-500/20',
  'bg-gradient-to-tr from-violet-600 to-purple-500 shadow-violet-500/20',
  'bg-gradient-to-tr from-fuchsia-600 to-rose-500 shadow-fuchsia-500/20',
  'bg-gradient-to-tr from-teal-600 to-emerald-500 shadow-teal-500/20',
  'bg-gradient-to-tr from-orange-600 to-amber-500 shadow-orange-500/20',
  'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-500/20',
  'bg-gradient-to-tr from-pink-600 to-rose-500 shadow-pink-500/20',
  'bg-gradient-to-tr from-sky-600 to-cyan-500 shadow-sky-500/20',
  'bg-gradient-to-tr from-lime-600 to-emerald-500 shadow-lime-500/20',
  'bg-gradient-to-tr from-red-600 to-orange-500 shadow-red-500/20'
];

export function getAvatarStyle(project: { id?: string; name?: string; color?: string }): { className: string; style?: React.CSSProperties } {
  if (project.color && project.color !== '#3b82f6') {
    return {
      className: 'shadow-xs',
      style: { backgroundColor: project.color }
    };
  }

  const key = `${project.id || ''}:${project.name || ''}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return {
    className: AVATAR_GRADIENTS[index]
  };
}

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatar = getAvatarStyle(project);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const formattedDate = new Date(project.updated_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      onClick={() => onOpen(project.id)}
      className={`group relative bg-card border border-border hover:border-blue-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${
        menuOpen ? 'z-20 ring-1 ring-border shadow-md' : 'z-0'
      }`}
    >
      <div>
        {/* Line 1: Avatar with Title & Actions Menu */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Single letter Avatar with distinct random color */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 select-none ring-2 ring-card ${avatar.className}`}
              style={avatar.style}
            >
              {(project.name || 'P').charAt(0).toUpperCase()}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-foreground group-hover:text-blue-500 transition-colors truncate">
              {project.name}
            </h3>
          </div>

          {/* Single Menu Dropdown */}
          <div
            className="relative shrink-0"
            ref={menuRef}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setMenuOpen(prev => !prev);
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                menuOpen
                  ? 'bg-secondary text-foreground opacity-100 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 focus:opacity-100'
              }`}
              title="Project options"
              aria-label="Project options"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44 bg-card border border-border rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
              >
                {/* Edit (only if user can_edit or can_manage) */}
                {(project.can_manage || project.can_edit) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(project);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Edit Project</span>
                  </button>
                )}

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate(project.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Duplicate Project</span>
                </button>

                {/* Delete (owner or admin only) */}
                {project.can_manage && (
                  <>
                    <div className="my-1 border-t border-border/60" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(project.id, project.name);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete Project</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Line 2: Description */}
        <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
          {project.description || 'No description provided.'}
        </p>

        {/* Line 3: Badges (Prefix, Format, Visibility) */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
            {project.prefix}
          </span>

          {project.purpose === 'font' ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Type className="w-2.5 h-2.5" />
              Font
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              Sprite
            </span>
          )}

          {/* Visibility: Icon alone */}
          {project.visibility === 'private' ? (
            <span
              title="Private Project"
              className="inline-flex items-center justify-center p-1 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20"
            >
              <Lock className="w-3 h-3" />
            </span>
          ) : (
            <span
              title="Public Project"
              className="inline-flex items-center justify-center p-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20"
            >
              <Globe className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* Line 4: Sample Icons Preview */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5 font-semibold text-foreground/85">
              <span>Sample Icons</span>
              {project.sample_icons && project.sample_icons.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono text-muted-foreground">
                  {project.sample_icons.length}
                </span>
              )}
            </span>
            {project.icon_count !== undefined && project.icon_count > (project.sample_icons?.length || 0) && (
              <span className="text-[10px] text-muted-foreground/75 font-medium">
                +{project.icon_count - (project.sample_icons?.length || 0)} more
              </span>
            )}
          </div>

          {project.sample_icons && project.sample_icons.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {(() => {
                const hasMoreThan5 = (project.icon_count || 0) > 5;
                const displayed = hasMoreThan5
                  ? project.sample_icons.slice(0, 4)
                  : project.sample_icons.slice(0, 5);
                const overflowCount = (project.icon_count || 0) - displayed.length;

                return (
                  <>
                    {displayed.map((icon) => (
                      <div
                        key={icon.id}
                        title={icon.name}
                        className="aspect-square rounded-xl bg-secondary/50 hover:bg-secondary border border-border/60 hover:border-blue-500/50 p-2 flex items-center justify-center transition-all duration-150 group/icon relative overflow-hidden"
                      >
                        <div
                          className="w-full h-full flex items-center justify-center text-foreground group-hover/icon:text-blue-500 transition-colors [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full svg-recolor"
                          dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                        />
                      </div>
                    ))}
                    {hasMoreThan5 && (
                      <div
                        title={`View all ${project.icon_count} icons`}
                        className="aspect-square rounded-xl bg-secondary/70 hover:bg-secondary border border-border/70 hover:border-blue-500/50 flex flex-col items-center justify-center text-[11px] font-bold text-muted-foreground group-hover:text-blue-500 transition-all cursor-pointer"
                      >
                        <span>+{overflowCount}</span>
                      </div>
                    )}
                    {!hasMoreThan5 &&
                      Array.from({ length: 5 - displayed.length }).map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="aspect-square rounded-xl border border-dashed border-border/30 bg-secondary/5 flex items-center justify-center opacity-30"
                        />
                      ))}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="py-2.5 px-3 rounded-xl bg-secondary/20 border border-dashed border-border/50 flex items-center justify-center text-[11px] text-muted-foreground/60 gap-1.5 select-none">
              <span>No icons added yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>{project.icon_count ?? 0} icons</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground/70" />
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
