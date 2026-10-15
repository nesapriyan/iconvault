import React, { useState } from 'react';
import { X, UploadCloud, FileArchive } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportProjectModal({ isOpen, onClose, onSuccess }: ImportProjectModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [overrideName, setOverrideName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success } = useToast();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.zip')) {
        setError('Please select a valid IconVault project .zip file');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a project ZIP archive');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.importProject(file, overrideName || undefined);
      success('Project imported successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Import Project Archive</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-secondary/30">
            <FileArchive className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm font-semibold text-foreground">
              {file ? file.name : 'Choose project .zip archive'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Contains SVGs and manifest.json'}
            </span>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Project Name (Optional Override)
            </label>
            <input
              type="text"
              value={overrideName}
              onChange={e => setOverrideName(e.target.value)}
              placeholder="Leave blank to use name from manifest"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-primary hover:bg-blue-600 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
