import React, { useState } from 'react';
import {
  Download,
  Copy,
  BookOpen,
  FileArchive,
  Save,
  Lock,
  Sparkles,
  Type,
  Globe,
  Shield,
  Eye,
  Edit3
} from 'lucide-react';
import { Project } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';

interface SettingsTabProps {
  project: Project;
  onUpdate: () => void;
}

export function SettingsTab({ project, onUpdate }: SettingsTabProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [prefix, setPrefix] = useState(project.prefix);
  const [color, setColor] = useState(project.color || '#3b82f6');
  const [visibility, setVisibility] = useState<'public' | 'private'>(project.visibility || 'public');
  const [publicAccess, setPublicAccess] = useState<'view' | 'edit'>(project.public_access || 'view');
  const [saving, setSaving] = useState(false);

  const canManage = project.can_manage ?? true;
  const canEdit = project.can_edit ?? true;
  const isReadOnly = !canEdit && !canManage;

  const { success, error } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    try {
      await api.updateProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        prefix: prefix.trim().toLowerCase(),
        color,
        ...(canManage ? {
          visibility
        } : {})
      });
      success('Project settings saved successfully');
      onUpdate();
    } catch (err: any) {
      error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied snippet to clipboard!');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 w-full max-w-5xl mx-auto">
      {/* Read-Only Notice Banner */}
      {isReadOnly && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs">
          <Lock className="w-4 h-4 shrink-0 text-amber-500" />
          <div>
            <strong>Read-Only Access:</strong> You are viewing this project with View-Only permissions. Settings, visibility, and identifiers can only be modified by project managers or members with edit access.
          </div>
        </div>
      )}

      {/* General Settings */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="text-lg font-bold text-foreground">Project Settings</h2>
          {project.owner_name && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary/60 px-3 py-1 rounded-xl border border-border/80">
              <span className="font-semibold text-foreground">Owner:</span>
              <span>{project.owner_name}</span>
              {project.owner_email && <span className="text-[11px] opacity-75">({project.owner_email})</span>}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Configure project naming, CSS identifiers, branding colors, and visibility permissions.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
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
                project.purpose === 'font' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                {project.purpose === 'font' ? <Type className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  {project.purpose === 'font' ? 'Icon Font Project' : 'SVG Sprite Project'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {project.purpose === 'font'
                    ? 'Outputs web fonts (TTF, WOFF, WOFF2, EOT) with glyph mapping & CSS classes'
                    : 'Outputs optimized <symbol> SVG sprite sheet with <use> tags'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Project Name
            </label>
            <input
              type="text"
              required
              disabled={isReadOnly || !canManage}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                CSS / Symbol Prefix
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={prefix}
                onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Theme Color
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  disabled={isReadOnly}
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="font-mono text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>

          {/* Project Visibility & Access Settings */}
          <div className="pt-4 border-t border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Project Visibility & Access Control
              </label>
              {!canManage && (
                <span className="text-[11px] text-muted-foreground italic">
                  (Managed by Project Owner / Admins)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Public */}
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setVisibility('public')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  visibility === 'public'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-border bg-secondary/40 hover:bg-secondary/70'
                } ${!canManage ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span>Public Project</span>
                  </div>
                  {visibility === 'public' && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Anyone can view and add icons. Only the creator (or workspace admin) can edit project settings and existing icons.
                </div>
              </button>

              {/* Option 2: Private */}
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setVisibility('private')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  visibility === 'private'
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                    : 'border-border bg-secondary/40 hover:bg-secondary/70'
                } ${!canManage ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span>Private Project</span>
                  </div>
                  {visibility === 'private' && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Only the project owner and workspace administrators can view or access this project.
                </div>
              </button>
            </div>
          </div>

          {!isReadOnly && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Project Export */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileArchive className="w-4 h-4 text-blue-500" />
              <h3 className="text-base font-bold text-foreground">Export Entire Project</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              Download complete project ZIP containing all SVGs organized in folder hierarchy, metadata, codepoints mapping, and <code className="text-blue-500 font-mono">manifest.json</code>.
            </p>
          </div>

          <a
            href={api.getExportProjectUrl(project.id)}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Export Project ZIP</span>
          </a>
        </div>
      </div>

      {/* Generated Usage Documentation */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <h3 className="text-base font-bold text-foreground">Integration Guide & Snippets</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Ready-to-use copyable code snippets for incorporating this project's assets into modern frameworks.
        </p>

        {/* Snippet 1: SVG Sprite Use */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">1. SVG Sprite Inline Usage</span>
            <button
              onClick={() => copyToClipboard(`<svg class="icon">\n  <use href="sprite.svg#${project.prefix}-home"/>\n</svg>`)}
              className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-zinc-800">
{`<svg class="icon">
  <use href="sprite.svg#${project.prefix}-home"/>
</svg>`}
          </pre>
        </div>

        {/* Snippet 2: Icon Font */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">2. Icon Font CSS Usage</span>
            <button
              onClick={() => copyToClipboard(`<link rel="stylesheet" href="${project.name.replace(/[^a-zA-Z0-9]/g, '')}.css">\n<i class="${project.prefix}-home"></i>`)}
              className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-zinc-950 text-indigo-300 font-mono text-xs overflow-x-auto border border-zinc-800">
{`<!-- Load stylesheet -->
<link rel="stylesheet" href="${project.name.replace(/[^a-zA-Z0-9]/g, '')}.css">

<!-- Render glyph -->
<i class="${project.prefix}-home"></i>`}
          </pre>
        </div>

        {/* Snippet 3: CLI build command */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">3. Automation CLI Command</span>
            <button
              onClick={() => copyToClipboard(`npx iconvault build "${project.name}" --type both`)}
              className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-zinc-950 text-amber-300 font-mono text-xs overflow-x-auto border border-zinc-800">
{`npx iconvault build "${project.name}" --type both`}
          </pre>
        </div>
      </div>
    </div>
  );
}
