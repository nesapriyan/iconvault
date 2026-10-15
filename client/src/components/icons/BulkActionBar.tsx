import React, { useState } from 'react';
import {
  FolderInput,
  Trash2,
  Download,
  X
} from 'lucide-react';
import { Folder } from '../../types';

interface BulkActionBarProps {
  selectedCount: number;
  folders: Folder[];
  canEdit?: boolean;
  onClearSelection: () => void;
  onBatchDownload?: () => Promise<void> | void;
  onBatchMove: (targetFolderId: string | null) => Promise<void>;
  onBatchDelete: () => Promise<void>;
}

export function BulkActionBar({
  selectedCount,
  folders,
  canEdit = true,
  onClearSelection,
  onBatchDownload,
  onBatchMove,
  onBatchDelete
}: BulkActionBarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white border border-zinc-700 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3.5 animate-in slide-in-from-bottom-5 duration-150">
      <div className="flex items-center gap-2 pr-3 border-r border-zinc-700 text-xs font-semibold">
        <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px]">
          {selectedCount}
        </span>
        <span>Selected</span>
      </div>

      {/* Download Action (Available for both Editors and View-Only) */}
      {onBatchDownload && (
        <button
          type="button"
          onClick={async () => {
            try {
              setDownloading(true);
              await onBatchDownload();
            } finally {
              setDownloading(false);
            }
          }}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          title={selectedCount === 1 ? 'Download SVG' : `Download ${selectedCount} icons as ZIP`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{downloading ? 'Downloading...' : selectedCount === 1 ? 'Download SVG' : 'Download ZIP'}</span>
        </button>
      )}

      {/* Action Buttons or View-Only Indicator */}
      {!canEdit ? (
        <span className="text-xs text-amber-400 font-medium pl-1">
          View-Only Mode — Modifications disabled
        </span>
      ) : (
        <div className="flex items-center gap-2">
          {/* Move */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMoveMenu(!showMoveMenu);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium transition-colors"
            >
              <FolderInput className="w-3.5 h-3.5 text-blue-400" />
              <span>Move</span>
            </button>

            {showMoveMenu && (
              <div className="absolute bottom-10 left-0 z-50 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1.5 space-y-1">
                <button
                  onClick={() => {
                    onBatchMove(null);
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-800 text-zinc-200"
                >
                  Root (No Folder)
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onBatchMove(f.id);
                      setShowMoveMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-800 text-zinc-200 truncate"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={onBatchDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Clear selection */}
      <button
        onClick={onClearSelection}
        className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ml-1"
        title="Deselect All"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
