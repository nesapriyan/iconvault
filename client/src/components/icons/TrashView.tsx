import { RotateCcw, Trash2, ArrowLeft } from 'lucide-react';
import { IconItem } from '../../types';

interface TrashViewProps {
  trashIcons: IconItem[];
  onBackToIcons: () => void;
  onRestoreIcon: (id: string) => Promise<void>;
  onRestoreAll: () => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export function TrashView({
  trashIcons,
  onBackToIcons,
  onRestoreIcon,
  onRestoreAll,
  onEmptyTrash
}: TrashViewProps) {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToIcons}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">Trash Bin</h2>
            <p className="text-xs text-muted-foreground">
              Soft-deleted icons. Items here can be restored or permanently removed.
            </p>
          </div>
        </div>

        {trashIcons.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onRestoreAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
              <span>Restore All</span>
            </button>
            <button
              onClick={onEmptyTrash}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash</span>
            </button>
          </div>
        )}
      </div>

      {trashIcons.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground mb-3">
            <Trash2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Trash is empty</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No deleted icons found in this project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {trashIcons.map(icon => (
            <div
              key={icon.id}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-between text-center relative group"
            >
              <div
                style={{ width: '40px', height: '40px' }}
                dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                className="[&>svg]:w-full [&>svg]:h-full text-muted-foreground my-2"
              />
              <div className="w-full">
                <span className="text-xs font-semibold text-foreground block truncate">{icon.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  Deleted {icon.deleted_at ? new Date(icon.deleted_at).toLocaleDateString() : ''}
                </span>
              </div>
              <button
                onClick={() => onRestoreIcon(icon.id)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium border border-border transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-blue-500" />
                <span>Restore</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
