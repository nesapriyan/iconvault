import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${danger ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-secondary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-xl text-white transition-all shadow-sm ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95'
                : 'bg-primary hover:bg-blue-600 active:scale-95'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
