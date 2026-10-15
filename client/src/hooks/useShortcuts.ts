import { useEffect } from 'react';

interface ShortcutHandlers {
  onSearch?: () => void;
  onUpload?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing inside form inputs or textareas unless it is Escape
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      if (isInput) return;

      // Cmd+K or Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }

      // Cmd+U or Ctrl+U for upload
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handlers.onUpload?.();
        return;
      }

      // Delete or Backspace for delete selected
      if (e.key === 'Delete' || (e.key === 'Backspace' && !isInput)) {
        handlers.onDelete?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
