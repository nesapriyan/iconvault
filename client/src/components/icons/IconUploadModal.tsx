import React, { useState } from 'react';
import { X, UploadCloud, Code, FileText, Check, AlertCircle, Sparkles, Type, Layers, FileCode } from 'lucide-react';
import { Folder } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';

interface IconUploadModalProps {
  isOpen: boolean;
  projectId: string;
  folders: Folder[];
  currentFolderId: string | null | 'all' | 'root';
  initialTab?: 'files' | 'sprite' | 'font' | 'paste';
  onClose: () => void;
  onSuccess: () => void;
}

export function IconUploadModal({
  isOpen,
  projectId,
  folders,
  currentFolderId,
  initialTab = 'files',
  onClose,
  onSuccess
}: IconUploadModalProps) {
  const [tab, setTab] = useState<'files' | 'sprite' | 'font' | 'paste'>(initialTab);
  
  // Files tab state
  const [files, setFiles] = useState<File[]>([]);

  // Sprite import state
  const [spriteFile, setSpriteFile] = useState<File | null>(null);
  const [rawSpriteSvg, setRawSpriteSvg] = useState('');
  const [spriteInputMode, setSpriteInputMode] = useState<'file' | 'paste'>('file');

  // Font import state
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingContent, setMappingContent] = useState('');
  const [fontMappingMode, setFontMappingMode] = useState<'none' | 'file' | 'paste'>('none');

  // Paste single SVG state
  const [rawSvg, setRawSvg] = useState('');
  const [pastedName, setPastedName] = useState('');

  // Common options
  const [targetFolderId, setTargetFolderId] = useState<string | null>(() => {
    return (currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root') ? currentFolderId : null;
  });
  const [duplicateStrategy, setDuplicateStrategy] = useState<'rename' | 'replace' | 'skip'>('rename');
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      if (initialTab) setTab(initialTab);
      setTargetFolderId(
        currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root' ? currentFolderId : null
      );
      setError(null);
    }
  }, [isOpen, initialTab, currentFolderId]);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const selected = Array.from(e.dataTransfer.files).filter(f => 
        f.name.toLowerCase().endsWith('.svg') || f.name.toLowerCase().endsWith('.zip')
      );
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'files') {
        if (files.length === 0) {
          setError('Please select at least one SVG or ZIP file');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        if (targetFolderId) formData.append('folderId', targetFolderId);
        formData.append('duplicateStrategy', duplicateStrategy);
        formData.append('autoOptimize', autoOptimize ? 'true' : 'false');
        formData.append('tags', JSON.stringify(tags));

        const res = await api.uploadIcons(projectId, formData);
        success(`Successfully uploaded ${res.uploadedCount} icon(s)!`);
        if (res.errors.length > 0) {
          toastError(`${res.errors.length} file(s) failed validation.`);
        }
      } else if (tab === 'sprite') {
        if (spriteInputMode === 'file' && !spriteFile) {
          setError('Please select an SVG sprite file');
          setLoading(false);
          return;
        }
        if (spriteInputMode === 'paste' && !rawSpriteSvg.trim()) {
          setError('Please paste raw SVG sprite markup');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        if (spriteInputMode === 'file' && spriteFile) {
          formData.append('file', spriteFile);
        } else {
          formData.append('rawSpriteSvg', rawSpriteSvg.trim());
        }
        if (targetFolderId) formData.append('folderId', targetFolderId);
        formData.append('duplicateStrategy', duplicateStrategy);
        formData.append('autoOptimize', autoOptimize ? 'true' : 'false');
        formData.append('tags', JSON.stringify(tags));

        const res = await api.importSprite(projectId, formData);
        success(`Successfully imported ${res.uploadedCount} icon(s) from SVG sprite!`);
        if (res.errors && res.errors.length > 0) {
          toastError(`${res.errors.length} symbol(s) could not be extracted.`);
        }
      } else if (tab === 'font') {
        if (!fontFile) {
          setError('Please select an icon font file (.ttf, .woff, .woff2, .otf, .svg)');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('fontFile', fontFile);
        if (fontMappingMode === 'file' && mappingFile) {
          formData.append('mappingFile', mappingFile);
        } else if (fontMappingMode === 'paste' && mappingContent.trim()) {
          formData.append('mappingContent', mappingContent.trim());
        }
        if (targetFolderId) formData.append('folderId', targetFolderId);
        formData.append('duplicateStrategy', duplicateStrategy);
        formData.append('autoOptimize', autoOptimize ? 'true' : 'false');
        formData.append('tags', JSON.stringify(tags));

        const res = await api.importFont(projectId, formData);
        success(`Successfully imported ${res.uploadedCount} icon(s) from font file!`);
        if (res.errors && res.errors.length > 0) {
          toastError(`${res.errors.length} glyph(s) could not be extracted.`);
        }
      } else {
        // Raw SVG paste
        if (!rawSvg.trim()) {
          setError('Please paste raw SVG code');
          setLoading(false);
          return;
        }

        await api.pasteIcon(projectId, {
          rawSvg: rawSvg.trim(),
          name: pastedName.trim() || undefined,
          folderId: targetFolderId,
          duplicateStrategy,
          autoOptimize,
          tags
        });
        success('Icon created from raw SVG!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (tab === 'files') return files.length === 0;
    if (tab === 'sprite') return spriteInputMode === 'file' ? !spriteFile : !rawSpriteSvg.trim();
    if (tab === 'font') return !fontFile;
    if (tab === 'paste') return !rawSvg.trim();
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Add & Import Icons</h3>
              <p className="text-xs text-muted-foreground">
                Upload files, import existing SVG sprites or icon fonts, or paste SVG code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-4 bg-secondary p-1 rounded-xl border border-border text-xs font-semibold mb-4 gap-1">
          <button
            type="button"
            onClick={() => { setTab('files'); setError(null); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all truncate ${
              tab === 'files' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Files & ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('sprite'); setError(null); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all truncate ${
              tab === 'sprite' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span className="truncate">SVG Sprite</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('font'); setError(null); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all truncate ${
              tab === 'font' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Type className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
            <span className="truncate">Icon Font</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('paste'); setError(null); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all truncate ${
              tab === 'paste' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Paste SVG</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: Individual SVGs or ZIP */}
          {tab === 'files' && (
            <div>
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-border hover:border-blue-500/50 transition-colors rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-secondary/30"
              >
                <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
                <span className="text-sm font-semibold text-foreground">
                  Drag & Drop SVGs or ZIP file
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Folder structure inside ZIP archives will be preserved automatically
                </span>
                <input
                  type="file"
                  multiple
                  accept=".svg,.zip,application/zip,image/svg+xml"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>

              {files.length > 0 && (
                <div className="mt-3 max-h-36 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2 bg-secondary/30">
                  <div className="text-[11px] font-semibold text-muted-foreground px-1 mb-1">
                    Selected Files ({files.length}):
                  </div>
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card border border-border/50 text-foreground"
                    >
                      <span className="truncate max-w-[280px]">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(i)}
                          className="text-muted-foreground hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SVG Sprite Import */}
          {tab === 'sprite' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-foreground">Import from SVG Sprite</span>
                  <span>Extracts all &lt;symbol&gt; or &lt;g id="..."&gt; elements into standalone icons.</span>
                </div>
              </div>

              <div className="flex bg-secondary p-0.5 rounded-lg border border-border text-xs w-fit">
                <button
                  type="button"
                  onClick={() => setSpriteInputMode('file')}
                  className={`px-3 py-1 rounded-md transition-all font-medium ${
                    spriteInputMode === 'file' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Upload Sprite File
                </button>
                <button
                  type="button"
                  onClick={() => setSpriteInputMode('paste')}
                  className={`px-3 py-1 rounded-md transition-all font-medium ${
                    spriteInputMode === 'paste' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Paste Sprite XML
                </button>
              </div>

              {spriteInputMode === 'file' ? (
                <div>
                  <label className="border-2 border-dashed border-border hover:border-amber-500/50 transition-colors rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-secondary/30">
                    <Sparkles className="w-7 h-7 text-amber-500 mb-1.5" />
                    <span className="text-sm font-semibold text-foreground">
                      {spriteFile ? spriteFile.name : 'Select or Drop SVG Sprite File'}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {spriteFile ? `${(spriteFile.size / 1024).toFixed(1)} KB` : 'Accepts sprite.svg containing <symbol> tags'}
                    </span>
                    <input
                      type="file"
                      accept=".svg,image/svg+xml"
                      onChange={e => {
                        if (e.target.files?.[0]) setSpriteFile(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                  </label>
                  {spriteFile && (
                    <button
                      type="button"
                      onClick={() => setSpriteFile(null)}
                      className="text-xs text-muted-foreground hover:text-rose-500 mt-1.5 inline-flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear selected sprite file
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Raw SVG Sprite XML *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={rawSpriteSvg}
                    onChange={e => setRawSpriteSvg(e.target.value)}
                    placeholder="<svg xmlns=...><symbol id='heart' viewBox='0 0 24 24'>...</symbol></svg>"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Icon Font Import */}
          {tab === 'font' && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-400 flex items-start gap-2.5">
                <Type className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
                <div>
                  <span className="font-semibold block text-foreground">Import from Font File</span>
                  <span>Extracts vector glyph outlines from TTF, WOFF, WOFF2, OTF, or SVG icon fonts into clean SVGs.</span>
                </div>
              </div>

              {/* Font File Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  1. Icon Font File * (.ttf, .woff, .woff2, .otf, .svg)
                </label>
                <label className="border-2 border-dashed border-border hover:border-indigo-500/50 transition-colors rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-secondary/30">
                  <Type className="w-6 h-6 text-indigo-500 mb-1" />
                  <span className="text-xs font-semibold text-foreground">
                    {fontFile ? fontFile.name : 'Select or Drop Font File'}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {fontFile ? `${(fontFile.size / 1024).toFixed(1)} KB` : 'Supports TTF, WOFF, WOFF2, OTF, and SVG fonts'}
                  </span>
                  <input
                    type="file"
                    accept=".ttf,.woff,.woff2,.otf,.svg"
                    onChange={e => {
                      if (e.target.files?.[0]) setFontFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                </label>
                {fontFile && (
                  <button
                    type="button"
                    onClick={() => setFontFile(null)}
                    className="text-xs text-muted-foreground hover:text-rose-500 mt-1 inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear font file
                  </button>
                )}
              </div>

              {/* Optional CSS / JSON Mapping */}
              <div className="pt-1 border-t border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    2. Optional Name / Codepoint Mapping
                  </label>
                  <div className="flex bg-secondary p-0.5 rounded-lg border border-border text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFontMappingMode('none')}
                      className={`px-2 py-0.5 rounded ${fontMappingMode === 'none' ? 'bg-card text-foreground font-semibold' : 'text-muted-foreground'}`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontMappingMode('file')}
                      className={`px-2 py-0.5 rounded ${fontMappingMode === 'file' ? 'bg-card text-foreground font-semibold' : 'text-muted-foreground'}`}
                    >
                      Upload CSS/JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontMappingMode('paste')}
                      className={`px-2 py-0.5 rounded ${fontMappingMode === 'paste' ? 'bg-card text-foreground font-semibold' : 'text-muted-foreground'}`}
                    >
                      Paste CSS
                    </button>
                  </div>
                </div>

                {fontMappingMode === 'file' && (
                  <div>
                    <label className="border border-dashed border-border rounded-xl p-3 flex items-center justify-between cursor-pointer bg-secondary/30 hover:border-indigo-500/50 text-xs">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-indigo-400" />
                        <span>{mappingFile ? mappingFile.name : 'Select CSS or JSON mapping file'}</span>
                      </div>
                      <input
                        type="file"
                        accept=".css,.json,text/css,application/json"
                        onChange={e => {
                          if (e.target.files?.[0]) setMappingFile(e.target.files[0]);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {fontMappingMode === 'paste' && (
                  <div>
                    <textarea
                      rows={3}
                      value={mappingContent}
                      onChange={e => setMappingContent(e.target.value)}
                      placeholder={`.icon-heart:before { content: "\\e001"; }\n.icon-star:before { content: "\\e002"; }`}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  If provided, icon names like <code className="text-primary font-mono">.icon-heart</code> will be assigned to their corresponding unicode glyphs.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Paste Raw SVG */}
          {tab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Icon Name
                </label>
                <input
                  type="text"
                  value={pastedName}
                  onChange={e => setPastedName(e.target.value)}
                  placeholder="e.g. User Profile"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Raw SVG Code *
                </label>
                <textarea
                  rows={5}
                  required
                  value={rawSvg}
                  onChange={e => setRawSvg(e.target.value)}
                  placeholder="<svg xmlns=...><path .../></svg>"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* Target Folder Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Target Folder
            </label>
            <select
              value={targetFolderId || ''}
              onChange={e => setTargetFolderId(e.target.value || null)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">Root (No Folder)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Options: Duplicate Strategy & SVGO Auto-Optimize */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Name Conflict Handling
              </label>
              <select
                value={duplicateStrategy}
                onChange={e => setDuplicateStrategy(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="rename">Rename (Add suffix -1)</option>
                <option value="replace">Replace (Save version)</option>
                <option value="skip">Skip duplicate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Optimization
              </label>
              <button
                type="button"
                onClick={() => setAutoOptimize(!autoOptimize)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border transition-colors ${
                  autoOptimize
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 font-semibold'
                    : 'bg-secondary border-border text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>SVGO Auto-Optimize</span>
                </div>
                {autoOptimize && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Add Tags (Press Enter)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="e.g. outline, navigation, actions..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] bg-secondary text-foreground px-2 py-0.5 rounded-md border border-border font-medium"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled()}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-blue-600 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading
                ? 'Processing...'
                : tab === 'sprite'
                ? 'Import Sprite Icons'
                : tab === 'font'
                ? 'Extract & Import Glyphs'
                : 'Upload & Process'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
