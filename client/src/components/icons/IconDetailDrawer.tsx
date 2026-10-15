import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Download,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Folder,
  History,
  FileCode,
  Check,
  Save,
  Minus,
  Plus,
  Eye,
  Square,
  Box
} from 'lucide-react';
import { IconItem, Folder as FolderType, IconRenderStyle } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';

interface IconDetailDrawerProps {
  iconId: string | null;
  projectId: string;
  folders: FolderType[];
  canEdit?: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

export function IconDetailDrawer({
  iconId,
  projectId,
  folders,
  canEdit = true,
  onClose,
  onUpdate,
  onDelete
}: IconDetailDrawerProps) {
  const [icon, setIcon] = useState<IconItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [codepoint, setCodepoint] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [rawSvgCode, setRawSvgCode] = useState('');

  // Preview options
  const [previewSize, setPreviewSize] = useState<number>(48);
  const [iconColor, setIconColor] = useState<string>('default');
  const [renderStyle, setRenderStyle] = useState<IconRenderStyle>('natural');
  const [previewBg, setPreviewBg] = useState<'checkerboard' | 'light' | 'dark' | 'custom'>('checkerboard');
  const [customBg, setCustomBg] = useState('#3b82f6');
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'versions'>('preview');

  const { success, error } = useToast();

  useEffect(() => {
    if (!iconId) {
      setIcon(null);
      return;
    }

    setLoading(true);
    api.getIcon(iconId)
      .then(data => {
        setIcon(data);
        setName(data.name);
        setFolderId(data.folder_id);
        const parsedTags = Array.isArray(data.tags)
          ? data.tags
          : typeof data.tags === 'string'
          ? (() => { try { const p = JSON.parse(data.tags); return Array.isArray(p) ? p : []; } catch { return []; } })()
          : [];
        setTags(parsedTags);
        setRawSvgCode(data.rawSvg || '');
      })
      .catch(err => {
        error(err.message || 'Failed to load icon details');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [iconId]);

  if (!iconId) return null;

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(tag => tag !== t));
  };

  // Save metadata & code changes
  const handleSave = async () => {
    if (!icon) return;
    try {
      setSaving(true);
      const isCodeEdited = rawSvgCode !== icon.rawSvg;
      const updated = await api.updateIcon(icon.id, {
        name: name.trim(),
        folderId,
        tags,
        codepoint: codepoint.trim() ? codepoint.trim().toUpperCase() : null,
        rawSvg: isCodeEdited ? rawSvgCode : undefined
      });

      success('Icon details saved successfully!');
      setIcon({ ...updated, rawSvg: isCodeEdited ? rawSvgCode : icon.rawSvg });
      onUpdate();
    } catch (err: any) {
      error(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Optimize with SVGO
  const handleOptimize = async () => {
    if (!icon) return;
    try {
      const res = await api.optimizeIcon(icon.id);
      success(`Optimized with SVGO! Saved ${res.savingsPercent}% (${res.originalSize - res.optimizedSize} bytes)`);
      // Reload icon
      const refreshed = await api.getIcon(icon.id);
      setIcon(refreshed);
      setRawSvgCode(refreshed.rawSvg || '');
      onUpdate();
    } catch (err: any) {
      error(err.message || 'Optimization failed');
    }
  };

  // Restore version
  const handleRestoreVersion = async (versionId: string) => {
    if (!icon) return;
    try {
      await api.restoreIconVersion(icon.id, versionId);
      success('Restored previous version successfully!');
      const refreshed = await api.getIcon(icon.id);
      setIcon(refreshed);
      setRawSvgCode(refreshed.rawSvg || '');
      onUpdate();
    } catch (err: any) {
      error(err.message || 'Failed to restore version');
    }
  };

  // Copy helpers
  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    success(msg);
  };

  const copyAsReact = () => {
    if (!icon || !rawSvgCode) return;
    const componentName = icon.name.replace(/[^a-zA-Z0-9]/g, '') + 'Icon';
    const jsx = rawSvgCode
      .replace(/xmlns="[^"]*"/g, '')
      .replace(/xmlns:xlink="[^"]*"/g, '')
      .replace(/fill-rule=/g, 'fillRule=')
      .replace(/clip-rule=/g, 'clipRule=')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
      .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
      .replace(/<svg/, `<svg className={props.className || 'w-6 h-6'} {...props}`);

    const code = `import React from 'react';\n\nexport function ${componentName}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx.trim()}\n  );\n}\n`;
    copyToClipboard(code, 'Copied React component code!');
  };

  const copyAsVue = () => {
    if (!icon || !rawSvgCode) return;
    const code = `<template>\n  ${rawSvgCode.trim()}\n</template>\n\n<script setup lang="ts">\n// Vue 3 Component for ${icon.name}\n</script>\n`;
    copyToClipboard(code, 'Copied Vue component code!');
  };

  const downloadSvg = () => {
    if (!icon || !rawSvgCode) return;
    const blob = new Blob([rawSvgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold truncate max-w-[280px]">
            {icon ? icon.name : 'Icon Details'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              View Only
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading || !icon ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Conversion Quality Warnings Banner */}
          {(icon.has_stroke || icon.has_gradient || icon.has_text) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Font Conversion Notice:</span>
                <span className="text-muted-foreground">
                  {icon.has_stroke ? 'This icon uses strokes. Convert strokes to filled outlines for pixel-perfect icon font rendering. ' : ''}
                  {icon.has_gradient ? 'Contains gradients. Icon fonts only render single-color glyphs. ' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Live Preview Display Box */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Live Preview
              </span>

              {/* Background selector */}
              <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewBg('checkerboard')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    previewBg === 'checkerboard' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Pattern
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('light')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    previewBg === 'light' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('dark')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    previewBg === 'dark' ? 'bg-zinc-900 text-white shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('custom')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    previewBg === 'custom' ? 'bg-primary text-white shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Color
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div
              style={{
                backgroundColor:
                  previewBg === 'light'
                    ? '#ffffff'
                    : previewBg === 'dark'
                    ? '#09090b'
                    : previewBg === 'custom'
                    ? customBg
                    : undefined
              }}
              className={`w-full h-48 rounded-2xl border border-border flex items-center justify-center p-6 overflow-hidden transition-colors ${
                previewBg === 'checkerboard' ? 'bg-checkerboard' : ''
              } ${renderStyle === 'wireframe' ? 'ring-2 ring-primary/20' : ''}`}
            >
              <div
                style={{
                  width: `${previewSize}px`,
                  height: `${previewSize}px`,
                  ...(iconColor !== 'default' ? ({ '--icon-preview-color': iconColor } as React.CSSProperties) : {})
                }}
                dangerouslySetInnerHTML={{ __html: rawSvgCode || icon.rawSvg || '' }}
                className={`[&>svg]:w-full [&>svg]:h-full transition-all drop-shadow-sm flex items-center justify-center ${
                  renderStyle === 'wireframe'
                    ? 'svg-mode-wireframe'
                    : renderStyle === 'flat'
                    ? 'svg-mode-flat'
                    : iconColor !== 'default'
                    ? 'svg-mode-flat'
                    : 'svg-mode-natural'
                }`}
              />
            </div>

            {/* Custom background color picker row if active */}
            {previewBg === 'custom' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground text-[11px]">Picker:</span>
                <input
                  type="color"
                  value={customBg}
                  onChange={e => setCustomBg(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                />
                <span className="font-mono text-muted-foreground text-[11px]">{customBg}</span>
              </div>
            )}

            {/* Unified Size & Color Adjuster in the same place */}
            <div className="bg-secondary/40 border border-border rounded-xl p-2.5 space-y-2">
              {/* Style Controls: Natural, Flat, Wireframe */}
              <div className="flex items-center justify-between gap-2 text-xs pb-1.5 border-b border-border/60">
                <span className="text-[11px] text-muted-foreground font-semibold">Style:</span>
                <div className="flex bg-secondary p-0.5 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRenderStyle('natural');
                      setIconColor('default');
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      renderStyle === 'natural'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Natural View: Show the icon exactly as added"
                  >
                    <Eye className="w-3 h-3 text-emerald-500" />
                    <span>Natural</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderStyle('flat')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      renderStyle === 'flat'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Flat View: Solid flat fill"
                  >
                    <Square className="w-3 h-3 fill-current text-blue-500" />
                    <span>Flat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderStyle('wireframe')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      renderStyle === 'wireframe'
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Wireframe View: Vector outline blueprint"
                  >
                    <Box className="w-3 h-3 text-purple-500" />
                    <span>Wireframe</span>
                  </button>
                </div>
              </div>

              {/* Size Controls */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-semibold">Size:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewSize(prev => Math.max(16, prev - 8))}
                    className="w-5 h-5 flex items-center justify-center rounded bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
                    title="Decrease Size (-8px)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] font-mono text-foreground font-semibold min-w-[32px] text-center">
                    {previewSize}px
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewSize(prev => Math.min(128, prev + 8))}
                    className="w-5 h-5 flex items-center justify-center rounded bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
                    title="Increase Size (+8px)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex gap-1 flex-wrap justify-end">
                  {[16, 24, 32, 48, 64, 96, 128].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewSize(s)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-colors ${
                        previewSize === s
                          ? 'bg-primary text-white font-semibold'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Controls in the same place */}
              <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground font-semibold">Color:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIconColor('default');
                      setRenderStyle('natural');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      iconColor === 'default' && renderStyle === 'natural'
                        ? 'bg-primary text-white font-semibold'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                    title="Original SVG Colors (Natural View)"
                  >
                    Default
                  </button>

                  {[
                    { label: 'Black', value: '#0f172a' },
                    { label: 'White', value: '#ffffff', border: true },
                    { label: 'Blue', value: '#3b82f6' },
                    { label: 'Emerald', value: '#10b981' },
                    { label: 'Amber', value: '#f59e0b' },
                    { label: 'Rose', value: '#ef4444' },
                    { label: 'Purple', value: '#8b5cf6' }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setIconColor(preset.value);
                        if (renderStyle === 'natural') setRenderStyle('flat');
                      }}
                      className={`w-4 h-4 rounded-full transition-transform hover:scale-125 flex items-center justify-center ${
                        preset.border ? 'border border-border/80' : ''
                      } ${
                        iconColor === preset.value
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={`Color: ${preset.label}`}
                    />
                  ))}

                  {/* Custom color input picker */}
                  <label
                    className={`relative w-4 h-4 rounded-full overflow-hidden cursor-pointer border border-border transition-transform hover:scale-125 flex items-center justify-center ${
                      iconColor !== 'default' &&
                      !['#0f172a', '#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].includes(iconColor)
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                        : ''
                    }`}
                    title="Custom Color Picker"
                    style={{
                      background:
                        iconColor !== 'default' &&
                        !['#0f172a', '#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].includes(iconColor)
                          ? iconColor
                          : 'conic-gradient(from 180deg at 50% 50%, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)'
                    }}
                  >
                    <input
                      type="color"
                      value={iconColor === 'default' ? '#3b82f6' : iconColor}
                      onChange={e => {
                        setIconColor(e.target.value);
                        if (renderStyle === 'natural') setRenderStyle('flat');
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => copyToClipboard(rawSvgCode, 'Copied raw SVG!')}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-blue-500" />
              <span>Copy SVG</span>
            </button>
            <button
              onClick={copyAsReact}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
              <span>React JSX</span>
            </button>
            <button
              onClick={copyAsVue}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-500" />
              <span>Vue 3</span>
            </button>
            <button
              onClick={downloadSvg}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Download</span>
            </button>
          </div>

          {/* Navigation Tabs: Editor vs Info vs Versions */}
          <div className="border-t border-border pt-4">
            <div className="flex bg-secondary p-1 rounded-xl text-xs font-semibold mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'preview' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Metadata
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'code' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                SVG Code Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('versions')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'versions' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Versions ({icon.versions?.length || 0})
              </button>
            </div>

            {/* Tab 1: Metadata */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Icon Name
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                      Folder
                    </label>
                    <select
                      disabled={!canEdit}
                      value={folderId || ''}
                      onChange={e => setFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="">Root</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                      Hex Codepoint
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      disabled={!canEdit}
                      value={codepoint}
                      onChange={e => setCodepoint(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
                      placeholder="e.g. E001"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Tags
                  </label>
                  {canEdit && (
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Add tags (press Enter)..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2"
                    />
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[11px] bg-secondary text-foreground px-2 py-0.5 rounded-md border border-border"
                      >
                        #{t}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats info */}
                <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-secondary/50 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block">Size</span>
                    <span className="font-semibold text-foreground font-mono mt-0.5 block">
                      {(icon.byte_size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <div className="p-2.5 bg-secondary/50 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block">ViewBox</span>
                    <span className="font-semibold text-foreground font-mono mt-0.5 block truncate">
                      {icon.view_box}
                    </span>
                  </div>
                  <div className="p-2.5 bg-secondary/50 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block">Dimensions</span>
                    <span className="font-semibold text-foreground font-mono mt-0.5 block">
                      {icon.width} × {icon.height}
                    </span>
                  </div>
                </div>

                {/* Optimize Button (edit only) */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOptimize}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run SVGO Optimization</span>
                  </button>
                )}
              </div>
            )}

            {/* Tab 2: Raw SVG Code Editor */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{canEdit ? 'Edit raw SVG markup directly. Preview updates live.' : 'Raw SVG markup (View Only)'}</span>
                  <span className="font-mono text-[11px]">{(rawSvgCode.length / 1024).toFixed(2)} KB</span>
                </div>
                <textarea
                  rows={14}
                  readOnly={!canEdit}
                  value={rawSvgCode}
                  onChange={e => setRawSvgCode(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-zinc-950 text-emerald-400 border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Tab 3: Version History */}
            {activeTab === 'versions' && (
              <div className="space-y-2.5">
                <div className="text-xs text-muted-foreground mb-2">
                  Previous versions saved before optimizations and edits.
                </div>
                {icon.versions && icon.versions.length > 0 ? (
                  icon.versions.map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/60 border border-border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-500" />
                        <div>
                          <span className="font-semibold text-foreground block">
                            Version {icon.versions!.length - i}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.created_at).toLocaleString()} • {(v.byte_size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleRestoreVersion(v.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary text-foreground text-xs font-medium transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 text-blue-500" />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No previous versions saved yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete Action */}
          {canEdit && (
            <div className="pt-4 border-t border-border flex justify-between items-center">
              <button
                onClick={() => onDelete(icon.id)}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
              >
                Move to Trash
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
