import React from 'react';
import { Check, AlertTriangle, Download } from 'lucide-react';
import { IconItem, Folder, IconRenderStyle } from '../../types';

interface IconListProps {
  icons: IconItem[];
  folders: Folder[];
  selectedIds: Set<string>;
  iconSize?: number;
  iconColor?: string;
  renderStyle?: IconRenderStyle;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectIcon: (id: string) => void;
  onDownloadIcon?: (icon: IconItem) => void;
}

export function IconList({
  icons,
  folders,
  selectedIds,
  iconSize = 28,
  iconColor = 'default',
  renderStyle = 'natural',
  onToggleSelect,
  onSelectIcon,
  onDownloadIcon
}: IconListProps) {
  const folderMap = new Map<string, string>(folders.map(f => [f.id, f.name]));
  const isCustomColor = iconColor && iconColor !== 'default';
  const listIconPx = Math.min(Math.max(iconSize, 20), 56);

  const getRenderClass = () => {
    if (renderStyle === 'wireframe') return 'svg-mode-wireframe';
    if (renderStyle === 'flat') return 'svg-mode-flat';
    return isCustomColor ? 'svg-mode-flat' : 'svg-mode-natural text-foreground group-hover:text-primary';
  };
  const renderClass = getRenderClass();

  return (
    <div className="w-full overflow-x-auto border border-border rounded-2xl bg-card">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
          <tr>
            <th className="p-3 w-10"></th>
            <th className="p-3 w-16">Preview</th>
            <th className="p-3">Name</th>
            <th className="p-3">Folder</th>
            <th className="p-3">Codepoint</th>
            <th className="p-3">Dimensions</th>
            <th className="p-3">Size</th>
            <th className="p-3">Tags</th>
            <th className="p-3 w-16 text-right">Download</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {icons.map(icon => {
            const isSelected = selectedIds.has(icon.id);
            const folderName = icon.folder_id ? folderMap.get(icon.folder_id) || 'Unknown' : 'Root';

            return (
              <tr
                key={icon.id}
                onClick={() => onSelectIcon(icon.id)}
                className={`group cursor-pointer hover:bg-secondary/50 transition-colors ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                {/* Select */}
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <div
                    onClick={e => onToggleSelect(icon.id, e)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-primary border-primary text-white'
                        : 'border-border bg-card hover:border-primary'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </td>

                {/* Preview */}
                <td className="p-3">
                  <div
                    style={{
                      width: `${listIconPx}px`,
                      height: `${listIconPx}px`,
                      ...(isCustomColor ? ({ '--icon-preview-color': iconColor } as React.CSSProperties) : {})
                    }}
                    dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                    className={`[&>svg]:w-full [&>svg]:h-full flex items-center justify-center transition-all ${renderClass}`}
                  />
                </td>

                {/* Name & Slug */}
                <td className="p-3 font-medium text-foreground">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>{icon.name}</span>
                    {(icon.has_stroke || icon.has_gradient) && (
                      <span title="Stroke/gradient warning">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{icon.slug}</div>
                </td>

                {/* Folder */}
                <td className="p-3 text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-[11px]">
                    {folderName}
                  </span>
                </td>

                {/* Codepoint */}
                <td className="p-3 font-mono text-[11px] text-muted-foreground">
                  {icon.codepoint ? `\\${icon.codepoint}` : '-'}
                </td>

                {/* Dimensions */}
                <td className="p-3 text-muted-foreground font-mono text-[11px]">
                  {icon.width} × {icon.height}
                </td>

                {/* Size */}
                <td className="p-3 text-muted-foreground font-mono text-[11px]">
                  {(icon.byte_size / 1024).toFixed(2)} KB
                </td>

                {/* Tags */}
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(() => {
                      const tagList = Array.isArray(icon.tags)
                        ? icon.tags
                        : typeof icon.tags === 'string'
                        ? (() => { try { const parsed = JSON.parse(icon.tags); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })()
                        : [];
                      if (tagList.length > 0) {
                        return tagList.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">
                            #{t}
                          </span>
                        ));
                      }
                      return <span className="text-muted-foreground/50 text-[11px]">-</span>;
                    })()}
                  </div>
                </td>

                {/* Download Action */}
                <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                  {onDownloadIcon && (
                    <button
                      type="button"
                      onClick={() => onDownloadIcon(icon)}
                      className="p-1.5 rounded-lg border border-border/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-muted-foreground transition-all cursor-pointer inline-flex items-center justify-center shadow-2xs active:scale-95"
                      title={`Download ${icon.name}.svg`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
