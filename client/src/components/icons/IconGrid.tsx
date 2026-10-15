import React from 'react';
import { Check, AlertTriangle, Download } from 'lucide-react';
import { IconItem, IconRenderStyle } from '../../types';

interface IconGridProps {
  icons: IconItem[];
  selectedIds: Set<string>;
  cardSize?: number; // e.g. 140 to 220
  iconSize?: number; // e.g. 16 to 96
  iconColor?: string; // 'default' or '#hex'
  renderStyle?: IconRenderStyle;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectIcon: (id: string) => void;
  onDownloadIcon?: (icon: IconItem) => void;
}

export function IconGrid({
  icons,
  selectedIds,
  cardSize = 150,
  iconSize = 36,
  iconColor = 'default',
  renderStyle = 'natural',
  onToggleSelect,
  onSelectIcon,
  onDownloadIcon
}: IconGridProps) {
  const handleDragStart = (e: React.DragEvent, iconId: string) => {
    // If dragging a selected icon, transfer all selected IDs; otherwise transfer just this icon
    const ids = selectedIds.has(iconId) ? Array.from(selectedIds) : [iconId];
    e.dataTransfer.setData('application/json', JSON.stringify({ iconIds: ids }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const effectiveCardSize = Math.max(cardSize, iconSize + 70);
  const isCustomColor = iconColor && iconColor !== 'default';

  // Determine rendering class based on renderStyle
  const getRenderClass = () => {
    if (renderStyle === 'wireframe') return 'svg-mode-wireframe';
    if (renderStyle === 'flat') return 'svg-mode-flat';
    return isCustomColor ? 'svg-mode-flat' : 'svg-mode-natural text-foreground group-hover:text-primary';
  };
  const renderClass = getRenderClass();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${effectiveCardSize}px, 1fr))`,
        gap: '16px'
      }}
      className="p-1"
    >
      {icons.map(icon => {
        const isSelected = selectedIds.has(icon.id);

        return (
          <div
            key={icon.id}
            draggable
            onDragStart={e => handleDragStart(e, icon.id)}
            onClick={() => onSelectIcon(icon.id)}
            className={`group relative bg-card border rounded-2xl p-4 flex flex-col items-center justify-between cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 select-none ${
              isSelected
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                : 'border-border hover:border-blue-500/40'
            }`}
          >
            {/* Selection Checkbox */}
            <div
              onClick={e => {
                e.stopPropagation();
                onToggleSelect(icon.id, e);
              }}
              className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-primary border-primary text-white'
                  : 'border-border/80 bg-secondary/80 opacity-0 group-hover:opacity-100 hover:border-primary'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            {/* Codepoint Badge or Warning + Quick Download Button */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
              {(icon.has_stroke || icon.has_gradient) && (
                <span title="Stroke/gradient warning for icon font" className="text-amber-500">
                  <AlertTriangle className="w-3 h-3" />
                </span>
              )}
              {icon.codepoint && (
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
                  {icon.codepoint}
                </span>
              )}
              {onDownloadIcon && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onDownloadIcon(icon);
                  }}
                  className="w-5 h-5 rounded-md border border-border/80 bg-secondary/90 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-xs active:scale-90"
                  title={`Download ${icon.name}.svg`}
                >
                  <Download className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Live SVG Visual */}
            <div
              className={`w-full flex-1 flex items-center justify-center my-3 transition-all rounded-xl ${
                renderStyle === 'wireframe' ? 'bg-secondary/30 ring-1 ring-border/50' : ''
              }`}
              style={{ minHeight: `${Math.max(iconSize + 16, 56)}px` }}
            >
              <div
                style={{
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  ...(isCustomColor ? ({ '--icon-preview-color': iconColor } as React.CSSProperties) : {})
                }}
                dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                className={`[&>svg]:w-full [&>svg]:h-full flex items-center justify-center transition-all ${renderClass}`}
              />
            </div>

            {/* Footer Name and Size */}
            <div className="w-full text-center">
              <div className="text-xs font-semibold text-foreground truncate w-full" title={icon.name}>
                {icon.name}
              </div>
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{(icon.byte_size / 1024).toFixed(1)} KB</span>
                {(() => {
                  const tagList = Array.isArray(icon.tags)
                    ? icon.tags
                    : typeof icon.tags === 'string'
                    ? (() => { try { const parsed = JSON.parse(icon.tags); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })()
                    : [];
                  if (tagList.length === 0) return null;
                  return (
                    <span className="truncate max-w-[60px]" title={tagList.join(', ')}>
                      #{tagList[0]}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
