import { useState, useEffect } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Layers,
  Sparkles,
  Check,
  History,
  FileArchive,
  Trash2,
  CheckSquare
} from 'lucide-react';
import { Project, Folder, SpriteBuildResponse, BuildItem, IconItem } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';
import { IconChecklistModal } from '../common/IconChecklistModal';

interface SpriteTabProps {
  project: Project;
  folders: Folder[];
  currentFolderId: string | null | 'all' | 'root';
  selectedIconIds: string[];
}

export function SpriteTab({
  project,
  folders,
  currentFolderId,
  selectedIconIds
}: SpriteTabProps) {
  // Build configuration options
  const [scope, setScope] = useState<'all' | 'folder' | 'selected'>(() => {
    if (selectedIconIds.length > 0) return 'selected';
    if (currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root') return 'folder';
    return 'all';
  });
  const [targetFolderId, setTargetFolderId] = useState<string | null>(() => {
    return (currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root') ? currentFolderId : null;
  });
  const [mode, setMode] = useState<'symbol' | 'stack' | 'css'>('symbol');
  const [idPattern, setIdPattern] = useState('{prefix}-{name}');
  const [stripColors, setStripColors] = useState(false);
  const [keepViewBox, setKeepViewBox] = useState(true);
  const [removeDimensions, setRemoveDimensions] = useState(true);
  const [svgo, setSvgo] = useState(true);
  const [namespaceIds, setNamespaceIds] = useState(true);

  // Icon Checklist state
  const [allIcons, setAllIcons] = useState<IconItem[]>([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>([]);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  // Results & History
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<SpriteBuildResponse | null>(null);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      const [history, iconsRes] = await Promise.all([
        api.getBuilds(project.id, 'sprite'),
        api.getIcons(project.id, { limit: 1000 })
      ]);
      setBuilds(history);
      setAllIcons(iconsRes.icons);
      if (selectedIconIds && selectedIconIds.length > 0) {
        setSelectedChecklistIds(selectedIconIds);
      } else {
        setSelectedChecklistIds(iconsRes.icons.map(i => i.id));
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, [project.id]);

  const handleGenerate = async (customIds?: string[]) => {
    const idsToUse = customIds || (selectedChecklistIds.length > 0 ? selectedChecklistIds : allIcons.map(i => i.id));
    if (idsToUse.length === 0) {
      error('Please select at least 1 icon from the checklist');
      setChecklistModalOpen(true);
      return;
    }

    setBuilding(true);
    try {
      const res = await api.buildSprite(project.id, {
        scope: 'selected',
        iconIds: idsToUse,
        mode,
        idPattern,
        stripColors,
        keepViewBox,
        removeDimensions,
        svgo,
        namespaceIds
      });

      setBuildResult(res);
      success(`SVG Sprite generated successfully! (${res.iconCount} icons, ${res.savingsPercent}% savings)`);
      loadData();
    } catch (err: any) {
      error(err.message || 'Sprite generation failed');
    } finally {
      setBuilding(false);
    }
  };

  const handleConfirmChecklist = async (chosenIds: string[]) => {
    setSelectedChecklistIds(chosenIds);
    setChecklistModalOpen(false);
    await handleGenerate(chosenIds);
  };

  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(snippet);
    success('Copied SVG use snippet!');
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleDeleteBuild = async (buildId: string) => {
    try {
      await api.deleteBuild(buildId);
      success('Build deleted');
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to delete build');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* Configuration Header */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">SVG Sprite Generator</h2>
              <p className="text-xs text-muted-foreground">
                Consolidate SVGs into a single cached file for maximum web performance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setChecklistModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border shadow-xs transition-colors"
            >
              <CheckSquare className="w-4 h-4 text-amber-500" />
              <span>Icon Checklist ({selectedChecklistIds.length})</span>
            </button>

            <button
              onClick={() => setChecklistModalOpen(true)}
              disabled={building}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{building ? 'Building Sprite...' : `Generate Sprite (${selectedChecklistIds.length})`}</span>
            </button>
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Column 1: Scope */}
          <div className="space-y-3">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              1. Scope Selection
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-medium">Entire Project ({project.icon_count || 0} icons)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'folder'}
                  onChange={() => setScope('folder')}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-medium">Selected Folder</span>
              </label>

              {scope === 'folder' && (
                <select
                  value={targetFolderId || ''}
                  onChange={e => setTargetFolderId(e.target.value || null)}
                  className="w-full mt-1.5 px-3 py-2 text-xs rounded-xl bg-secondary border border-border text-foreground"
                >
                  <option value="">Choose a folder...</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.icon_count} icons)
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-medium">Selected Icons ({selectedIconIds.length} chosen)</span>
              </label>
            </div>

            {/* Checklist Overview Card */}
            <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                  Icon Checklist
                </span>
                <span className="text-amber-500 font-bold">{selectedChecklistIds.length} / {allIcons.length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Only checked icons will be bundled into the generated SVG sprite.
              </p>
              <button
                type="button"
                onClick={() => setChecklistModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-card hover:bg-secondary text-foreground text-xs font-semibold border border-border transition-colors shadow-xs"
              >
                <span>Review / Edit Checklist</span>
              </button>
            </div>
          </div>

          {/* Column 2: Sprite Mode */}
          <div className="space-y-3">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              2. Sprite Architecture
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'symbol'}
                  onChange={() => setMode('symbol')}
                  className="text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium block">Symbol Sprite (Recommended)</span>
                  <span className="text-[10px] text-muted-foreground">Uses &lt;symbol&gt; with &lt;use href="...#id"&gt;</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'stack'}
                  onChange={() => setMode('stack')}
                  className="text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium block">Stack Sprite</span>
                  <span className="text-[10px] text-muted-foreground">Uses :target CSS for &lt;img&gt; or backgrounds</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'css'}
                  onChange={() => setMode('css')}
                  className="text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium block">CSS Companion Sprite</span>
                  <span className="text-[10px] text-muted-foreground">Generates sprite.svg + sprite.css stylesheet</span>
                </div>
              </label>
            </div>
          </div>

          {/* Column 3: Processing Options */}
          <div className="space-y-3">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              3. Processing Options
            </span>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">ID Pattern:</label>
              <input
                type="text"
                value={idPattern}
                onChange={e => setIdPattern(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border font-mono text-foreground"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripColors}
                  onChange={e => setStripColors(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Convert to currentColor (Monochrome)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={svgo}
                  onChange={e => setSvgo(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Run SVGO optimization</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={namespaceIds}
                  onChange={e => setNamespaceIds(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Namespace gradient/mask IDs (Prevent clash)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepViewBox}
                  onChange={e => setKeepViewBox(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Preserve viewBox coordinates</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Sprite Result Panel */}
      {buildResult && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border">
            <div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full">
                Build Ready
              </span>
              <h3 className="text-lg font-bold text-foreground mt-2">
                Sprite Generated: {buildResult.iconCount} Glyphs
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={api.getDownloadBuildUrl(buildResult.buildId)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sprite ZIP</span>
              </a>
            </div>
          </div>

          {/* Size metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-center">
              <span className="text-xs text-muted-foreground block">Original SVGs Combined</span>
              <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                {(buildResult.totalOriginalSize / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-center">
              <span className="text-xs text-muted-foreground block">Consolidated Sprite Size</span>
              <span className="text-xl font-bold font-mono text-blue-500 mt-1 block">
                {(buildResult.spriteSize / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">Bandwidth Savings</span>
              <span className="text-xl font-bold font-mono text-emerald-500 mt-1 block">
                {buildResult.savingsPercent}% Reduced
              </span>
            </div>
          </div>

          {/* Interactive Specimen Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Live Symbols Specimen (Click icon to copy &lt;use&gt; snippet)
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {buildResult.symbols.length} symbols
              </span>
            </div>

            {/* Hidden live sprite payload for browser rendering */}
            <div style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: buildResult.spriteSvg }} />

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-72 overflow-y-auto p-1">
              {buildResult.symbols.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleCopySnippet(s.snippet)}
                  className="group bg-secondary/40 border border-border hover:border-blue-500/50 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:shadow transition-all relative select-none"
                >
                  <div className="w-8 h-8 flex items-center justify-center my-1.5 text-foreground group-hover:text-primary transition-colors">
                    <svg className="w-6 h-6 fill-current">
                      <use href={`#${s.id}`} />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground truncate w-full text-center">
                    {s.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono truncate w-full text-center">
                    #{s.id}
                  </span>

                  {copiedSnippet === s.snippet && (
                    <div className="absolute inset-0 bg-emerald-600/90 text-white rounded-xl flex items-center justify-center text-xs font-semibold gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Copy Snippet */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              HTML Implementation Snippet
            </span>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-zinc-800">
                {buildResult.symbols[0]?.snippet || `<svg class="icon"><use href="sprite.svg#icon-sample"/></svg>`}
              </pre>
              <button
                onClick={() => handleCopySnippet(buildResult.symbols[0]?.snippet || '')}
                className="absolute right-2.5 top-2.5 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build History */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Sprite Build History</h3>
        </div>

        {builds.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No sprite builds recorded yet. Generate your first sprite above.
          </div>
        ) : (
          <div className="space-y-2">
            {builds.map(b => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/40 border border-border text-xs"
              >
                <div className="flex items-center gap-3">
                  <FileArchive className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="font-semibold text-foreground block">
                      Sprite Build ({b.icon_count} icons)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()} • {(b.output_size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={api.getDownloadBuildUrl(b.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-secondary text-foreground text-xs font-medium transition-colors"
                  >
                    <Download className="w-3 h-3 text-blue-500" />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => handleDeleteBuild(b.id)}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <IconChecklistModal
        isOpen={checklistModalOpen}
        purpose="sprite"
        icons={allIcons}
        folders={folders}
        initialSelectedIds={selectedChecklistIds}
        isGenerating={building}
        onClose={() => setChecklistModalOpen(false)}
        onConfirm={handleConfirmChecklist}
      />
    </div>
  );
}
