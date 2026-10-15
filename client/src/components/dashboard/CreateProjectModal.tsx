import React, { useState, useEffect } from 'react';
import { X, Sparkles, Type, Lock, Check, Globe, Eye, Edit3, Shield } from 'lucide-react';
import { Project } from '../../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  editingProject?: Project | null;
  onClose: () => void;
  onSubmit: (data: { 
    name: string; 
    description?: string; 
    prefix?: string; 
    color?: string; 
    purpose?: 'sprite' | 'font';
    visibility?: 'public' | 'private';
    publicAccess?: 'view' | 'edit';
  }) => Promise<void>;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b'  // slate
];

export function CreateProjectModal({
  isOpen,
  editingProject,
  onClose,
  onSubmit
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState('icon');
  const [color, setColor] = useState('#3b82f6');
  const [purpose, setPurpose] = useState<'sprite' | 'font'>('sprite');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [publicAccess, setPublicAccess] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description);
      setPrefix(editingProject.prefix);
      setColor(editingProject.color);
      setPurpose(editingProject.purpose || 'sprite');
      setVisibility(editingProject.visibility || 'public');
      setPublicAccess(editingProject.public_access || 'view');
    } else {
      setName('');
      setDescription('');
      setPrefix('icon');
      setColor('#3b82f6');
      setPurpose('sprite');
      setVisibility('public');
      setPublicAccess('view');
    }
    setError(null);
  }, [editingProject, isOpen]);

  // Auto-generate prefix if user hasn't edited prefix manually
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingProject && (!prefix || prefix === 'icon')) {
      const generated = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (generated) setPrefix(generated);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        prefix: prefix.trim().toLowerCase(),
        color,
        purpose: !editingProject ? purpose : undefined,
        visibility,
        publicAccess: visibility === 'public' ? publicAccess : 'view'
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              purpose === 'font' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              {purpose === 'font' ? <Type className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h3>
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
          {/* Project Purpose Selector */}
          {editingProject ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Project Purpose
                </label>
                <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                  <Lock className="w-3 h-3" /> Permanent (Cannot be changed)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-secondary/60 border border-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  purpose === 'font' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {purpose === 'font' ? <Type className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {purpose === 'font' ? 'Icon Font Project' : 'SVG Sprite Project'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {purpose === 'font'
                      ? 'Produces TTF, WOFF, WOFF2 font files, CSS classes & glyph maps'
                      : 'Produces optimized <symbol> SVG sprite sheet & <use> assets'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Project Purpose *
                </label>
                <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                  <Lock className="w-3 h-3" /> Permanent choice
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Option 1: SVG Sprite */}
                <div
                  onClick={() => setPurpose('sprite')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    purpose === 'sprite'
                      ? 'border-amber-500 bg-amber-500/5 shadow-xs'
                      : 'border-border bg-secondary/40 hover:border-border/80 hover:bg-secondary/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      purpose === 'sprite' ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    {purpose === 'sprite' && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">SVG Sprite</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      &lt;symbol&gt; &amp; stack sprites with &lt;use&gt; tags
                    </div>
                  </div>
                </div>

                {/* Option 2: Icon Font */}
                <div
                  onClick={() => setPurpose('font')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    purpose === 'font'
                      ? 'border-indigo-500 bg-indigo-500/5 shadow-xs'
                      : 'border-border bg-secondary/40 hover:border-border/80 hover:bg-secondary/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      purpose === 'font' ? 'bg-indigo-500 text-white' : 'bg-secondary text-muted-foreground'
                    }`}>
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    {purpose === 'font' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">Icon Font</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      Web fonts (WOFF2, TTF) with CSS &amp; glyph codepoints
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Project Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Feather UI Core"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this icon set..."
              className="w-full px-3.5 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                CSS / Symbol Prefix
              </label>
              <input
                type="text"
                value={prefix}
                onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="e.g. icon"
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">IDs: {`{prefix}-{name}`}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Theme Color
              </label>
              <div className="flex items-center gap-1.5 mt-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-card' : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Project Visibility & Permission Settings */}
          <div className="pt-3 border-t border-border/70 space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Project Visibility & Access
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: Public */}
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  visibility === 'public'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-border bg-secondary/40 hover:bg-secondary/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span>Public Project</span>
                  </div>
                  {visibility === 'public' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Anyone can view and add icons. Only creator can edit.
                </div>
              </button>

              {/* Option 2: Private */}
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  visibility === 'private'
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                    : 'border-border bg-secondary/40 hover:bg-secondary/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span>Private Project</span>
                  </div>
                  {visibility === 'private' && <Check className="w-3.5 h-3.5 text-purple-500" />}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Only you and workspace admins can view or access this project.
                </div>
              </button>
            </div>
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
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-primary hover:bg-blue-600 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
