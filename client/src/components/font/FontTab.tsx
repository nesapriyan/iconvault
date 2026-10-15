import { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Type,
  Sparkles,
  Check,
  AlertTriangle,
  History,
  FileArchive,
  Trash2,
  Search,
  CheckSquare
} from 'lucide-react';
import { Project, Folder, FontBuildResponse, BuildItem, IconItem } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../common/Toast';
import { IconChecklistModal } from '../common/IconChecklistModal';

interface FontTabProps {
  project: Project;
  folders: Folder[];
  currentFolderId: string | null | 'all' | 'root';
  selectedIconIds: string[];
}

export function FontTab({
  project,
  folders,
  currentFolderId,
  selectedIconIds
}: FontTabProps) {
  // Configuration options
  const [scope, setScope] = useState<'all' | 'folder' | 'selected'>(() => {
    if (selectedIconIds.length > 0) return 'selected';
    if (currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root') return 'folder';
    return 'all';
  });
  const [targetFolderId, setTargetFolderId] = useState<string | null>(() => {
    return (currentFolderId && currentFolderId !== 'all' && currentFolderId !== 'root') ? currentFolderId : null;
  });

  const [fontName, setFontName] = useState(() => project.name.replace(/[^a-zA-Z0-9]/g, '') || 'ProjectIcons');
  const [prefix, setPrefix] = useState(() => `${project.prefix}-`);
  const [baseClass, setBaseClass] = useState(() => project.prefix);
  const [startCodepoint, setStartCodepoint] = useState('E001');
  const [fontHeight, setFontHeight] = useState(1000);
  const [descent, setDescent] = useState(0);
  const [normalize, setNormalize] = useState(true);

  const [selectedFormats, setSelectedFormats] = useState<Record<string, boolean>>({
    woff2: true,
    woff: true,
    ttf: true,
    eot: false,
    svg: false
  });

  // Results & History
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<FontBuildResponse | null>(null);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [specimenFilter, setSpecimenFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Codepoints mapping table data
  const [iconsList, setIconsList] = useState<IconItem[]>([]);
  const [editingCodepoints, setEditingCodepoints] = useState<Record<string, string>>({});

  // Icon Checklist state
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>([]);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  const { success, error } = useToast();

  const loadBuildsAndIcons = async () => {
    try {
      const history = await api.getBuilds(project.id, 'font');
      setBuilds(history);

      const res = await api.getIcons(project.id, { limit: 1000 });
      setIconsList(res.icons);
      if (selectedIconIds && selectedIconIds.length > 0) {
        setSelectedChecklistIds(selectedIconIds);
      } else {
        setSelectedChecklistIds(res.icons.map(i => i.id));
      }

      const cpMap: Record<string, string> = {};
      res.icons.forEach(i => {
        if (i.codepoint) cpMap[i.id] = i.codepoint;
      });
      setEditingCodepoints(cpMap);
    } catch {}
  };

  useEffect(() => {
    loadBuildsAndIcons();
  }, [project.id]);

  // Inject generated font dynamically into DOM for live browser preview
  useEffect(() => {
    if (buildResult?.woff2Base64) {
      const fontFaceRule = `
        @font-face {
          font-family: '${buildResult.fontName}';
          src: url(data:font/woff2;charset=utf-8;base64,${buildResult.woff2Base64}) format('woff2');
          font-weight: normal;
          font-style: normal;
        }
      `;
      const styleId = `dynamic-font-${buildResult.fontName}`;
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = fontFaceRule;
    }
  }, [buildResult]);

  const handleFormatToggle = (fmt: string) => {
    setSelectedFormats(prev => ({ ...prev, [fmt]: !prev[fmt] }));
  };

  const handleGenerate = async (customIds?: string[]) => {
    const formats = Object.keys(selectedFormats).filter(k => selectedFormats[k]);
    if (formats.length === 0) {
      error('Please select at least one font format (e.g. WOFF2)');
      return;
    }

    const idsToUse = customIds || (selectedChecklistIds.length > 0 ? selectedChecklistIds : iconsList.map(i => i.id));
    if (idsToUse.length === 0) {
      error('Please select at least 1 icon from the checklist');
      setChecklistModalOpen(true);
      return;
    }

    setBuilding(true);
    try {
      const res = await api.buildFont(project.id, {
        scope: 'selected',
        iconIds: idsToUse,
        formats,
        fontName,
        prefix,
        baseClass,
        startCodepoint,
        fontHeight,
        descent,
        normalize
      });

      setBuildResult(res);
      success(`Icon Font built successfully! (${res.iconCount} glyphs)`);
      loadBuildsAndIcons();
    } catch (err: any) {
      error(err.message || 'Font generation failed');
    } finally {
      setBuilding(false);
    }
  };

  const handleConfirmChecklist = async (chosenIds: string[]) => {
    setSelectedChecklistIds(chosenIds);
    setChecklistModalOpen(false);
    await handleGenerate(chosenIds);
  };

  const handleSaveCodepoint = async (iconId: string, hexVal: string) => {
    const sanitizedHex = hexVal.toUpperCase().replace(/[^0-9A-F]/g, '');
    try {
      await api.updateIcon(iconId, { codepoint: sanitizedHex || null });
      setEditingCodepoints(prev => ({ ...prev, [iconId]: sanitizedHex }));
      success(`Updated codepoint to \\${sanitizedHex}`);
    } catch (err: any) {
      error(err.message || 'Failed to update codepoint');
    }
  };

  const handleCopy = (text: string, key: string, msg: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    success(msg);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDeleteBuild = async (buildId: string) => {
    try {
      await api.deleteBuild(buildId);
      success('Build deleted');
      loadBuildsAndIcons();
    } catch (err: any) {
      error(err.message || 'Failed to delete build');
    }
  };

  // Filter specimen items
  const filteredCodepoints = (buildResult?.codepoints || []).filter(c => {
    if (!specimenFilter.trim()) return true;
    const q = specimenFilter.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.codepoint.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* Configuration Header */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Icon Font Generator</h2>
              <p className="text-xs text-muted-foreground">
                Compile icons into web fonts with stable unicode codepoints, CSS classes, and HTML specimen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setChecklistModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border shadow-xs transition-colors"
            >
              <CheckSquare className="w-4 h-4 text-indigo-500" />
              <span>Icon Checklist ({selectedChecklistIds.length})</span>
            </button>

            <button
              onClick={() => setChecklistModalOpen(true)}
              disabled={building}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{building ? 'Compiling Font...' : `Generate Font (${selectedChecklistIds.length})`}</span>
            </button>
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Column 1: Scope & Formats */}
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block mb-2">
                1. Scope Selection
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="font-scope"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Whole Project ({project.icon_count || 0} icons)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="font-scope"
                    checked={scope === 'folder'}
                    onChange={() => setScope('folder')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Selected Folder</span>
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
                    name="font-scope"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Selected Icons ({selectedIconIds.length})</span>
                </label>
              </div>

              {/* Checklist Overview Card */}
              <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    Icon Checklist
                  </span>
                  <span className="text-indigo-400 font-bold">{selectedChecklistIds.length} / {iconsList.length}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Only checked icons will be compiled into the font glyphs and CSS.
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

            <div>
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block mb-2">
                Target Formats
              </span>
              <div className="flex flex-wrap gap-2">
                {['woff2', 'woff', 'ttf', 'eot', 'svg'].map(fmt => (
                  <label
                    key={fmt}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold uppercase cursor-pointer transition-colors ${
                      selectedFormats[fmt]
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-500'
                        : 'bg-secondary border-border text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedFormats[fmt]}
                      onChange={() => handleFormatToggle(fmt)}
                      className="hidden"
                    />
                    <span>{fmt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Font Naming & Classes */}
          <div className="space-y-3">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              2. Font & CSS Settings
            </span>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Font Family Name:</label>
              <input
                type="text"
                value={fontName}
                onChange={e => setFontName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">CSS Prefix:</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Base Class:</label>
                <input
                  type="text"
                  value={baseClass}
                  onChange={e => setBaseClass(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Starting Codepoint (Hex):</label>
              <input
                type="text"
                maxLength={6}
                value={startCodepoint}
                onChange={e => setStartCodepoint(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Default: E001 (Private Use Area)</span>
            </div>
          </div>

          {/* Column 3: Metrics */}
          <div className="space-y-3">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] block">
              3. Font Metrics & Normalization
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Font Height (EM):</label>
                <input
                  type="number"
                  min={300}
                  max={2048}
                  value={fontHeight}
                  onChange={e => setFontHeight(parseInt(e.target.value, 10) || 1000)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Descent:</label>
                <input
                  type="number"
                  value={descent}
                  onChange={e => setDescent(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={normalize}
                onChange={e => setNormalize(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Normalize glyph bounds to height</span>
            </label>
          </div>
        </div>
      </div>

      {/* Font Build Result Specimen Panel */}
      {buildResult && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border">
            <div>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-500/10 px-2.5 py-1 rounded-full">
                Font Compiled & Mounted in Browser
              </span>
              <h3 className="text-lg font-bold text-foreground mt-2">
                {buildResult.fontName} ({buildResult.iconCount} Glyphs)
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={api.getDownloadBuildUrl(buildResult.buildId)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Font Package (.zip)</span>
              </a>
            </div>
          </div>

          {/* Warnings Banner */}
          {buildResult.warnings.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Glyph Conversion Warnings ({buildResult.warnings.length}):</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground text-[11px] max-h-24 overflow-y-auto">
                {buildResult.warnings.map((w, i) => (
                  <li key={i}>
                    <strong>{w.iconName}:</strong> {w.warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interactive Live Font Specimen */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Live Font Rendering (Rendered directly via @font-face '{buildResult.fontName}')
              </span>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={specimenFilter}
                  onChange={e => setSpecimenFilter(e.target.value)}
                  placeholder="Filter glyphs..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-secondary border border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto p-1">
              {filteredCodepoints.map(c => {
                const charCode = parseInt(c.codepoint, 16);
                const charSymbol = String.fromCharCode(charCode);
                const classSnippet = `<i class="${buildResult.prefix}${c.slug}"></i>`;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleCopy(classSnippet, c.id, `Copied ${classSnippet}!`)}
                    className="group bg-secondary/40 border border-border hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all relative select-none"
                  >
                    {/* Real font glyph rendering */}
                    <div
                      style={{ fontFamily: `'${buildResult.fontName}', sans-serif` }}
                      className="text-3xl text-foreground group-hover:text-indigo-500 transition-colors my-2 h-10 flex items-center justify-center"
                    >
                      {charSymbol}
                    </div>

                    <span className="text-[11px] font-semibold text-foreground truncate w-full text-center">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">
                      \{c.codepoint}
                    </span>

                    {copiedKey === c.id && (
                      <div className="absolute inset-0 bg-indigo-600/90 text-white rounded-2xl flex items-center justify-center text-xs font-semibold gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick CSS Usage Snippet */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              HTML / CSS Implementation
            </span>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-zinc-950 text-indigo-300 font-mono text-xs overflow-x-auto border border-zinc-800">
{`<!-- 1. Include CSS -->
<link rel="stylesheet" href="${buildResult.fontName}.css">

<!-- 2. Use Icon Class -->
<i class="${buildResult.prefix}${buildResult.codepoints[0]?.slug || 'sample'}"></i>`}
              </pre>
              <button
                onClick={() =>
                  handleCopy(
                    `<link rel="stylesheet" href="${buildResult.fontName}.css">\n<i class="${buildResult.prefix}${buildResult.codepoints[0]?.slug || 'sample'}"></i>`,
                    'html-snippet',
                    'Copied HTML snippet!'
                  )
                }
                className="absolute right-2.5 top-2.5 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stable Codepoints Mapping Table */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Stable Unicode Codepoints Mapping</h3>
            <p className="text-xs text-muted-foreground">
              Codepoints are persistently assigned so rebuilding never breaks existing production CSS rules. You can also manually customize hex values.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="p-3 w-16">Preview</th>
                <th className="p-3">Icon Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3 w-40">Assigned Hex Codepoint</th>
                <th className="p-3 w-32">CSS Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {iconsList.map(icon => {
                const currentHex = editingCodepoints[icon.id] || icon.codepoint || '';
                return (
                  <tr key={icon.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-3">
                      <div
                        style={{ width: '24px', height: '24px' }}
                        dangerouslySetInnerHTML={{ __html: icon.rawSvg || '' }}
                        className="[&>svg]:w-full [&>svg]:h-full text-foreground"
                      />
                    </td>
                    <td className="p-3 font-semibold text-foreground">{icon.name}</td>
                    <td className="p-3 font-mono text-muted-foreground">{icon.slug}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-mono">U+</span>
                        <input
                          type="text"
                          maxLength={6}
                          value={currentHex}
                          onChange={e =>
                            setEditingCodepoints({
                              ...editingCodepoints,
                              [icon.id]: e.target.value.toUpperCase()
                            })
                          }
                          onBlur={e => handleSaveCodepoint(icon.id, e.target.value)}
                          className="w-20 px-2 py-1 text-xs font-mono font-semibold bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      \{currentHex.toLowerCase()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Build History */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Font Build History</h3>
        </div>

        {builds.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No icon font builds recorded yet. Generate your first font above.
          </div>
        ) : (
          <div className="space-y-2">
            {builds.map(b => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/40 border border-border text-xs"
              >
                <div className="flex items-center gap-3">
                  <FileArchive className="w-4 h-4 text-indigo-500" />
                  <div>
                    <span className="font-semibold text-foreground block">
                      Icon Font Build ({b.icon_count} glyphs)
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
                    <Download className="w-3 h-3 text-indigo-500" />
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
        purpose="font"
        icons={iconsList}
        folders={folders}
        initialSelectedIds={selectedChecklistIds}
        isGenerating={building}
        onClose={() => setChecklistModalOpen(false)}
        onConfirm={handleConfirmChecklist}
      />
    </div>
  );
}
