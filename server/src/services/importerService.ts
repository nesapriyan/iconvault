import { JSDOM } from 'jsdom';
import opentype from 'opentype.js';
import wawoff2 from 'wawoff2';

export interface ExtractedIcon {
  name: string;
  svgContent: string;
  codepoint?: string;
}

export class ImporterService {
  /**
   * Parse an SVG sprite and extract all symbols/icons into standalone SVGs.
   */
  static extractFromSprite(spriteContent: string): ExtractedIcon[] {
    const dom = new JSDOM(spriteContent, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    const extracted: ExtractedIcon[] = [];

    // 1. Try finding <symbol> elements
    const symbols = Array.from(doc.querySelectorAll('symbol'));
    if (symbols.length > 0) {
      for (const symbol of symbols) {
        const id = symbol.getAttribute('id') || `symbol-${extracted.length + 1}`;
        const viewBox = symbol.getAttribute('viewBox') || '0 0 24 24';
        const inner = symbol.innerHTML.trim();
        if (!inner) continue;
        const standalone = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
        extracted.push({
          name: id,
          svgContent: standalone
        });
      }
      return extracted;
    }

    // 2. Try finding <g id="..."> inside <defs> or root <svg>
    const groups = Array.from(doc.querySelectorAll('defs > g[id], svg > g[id]'));
    if (groups.length > 0) {
      const rootSvg = doc.querySelector('svg');
      const rootVb = rootSvg?.getAttribute('viewBox') || '0 0 24 24';
      for (const g of groups) {
        const id = g.getAttribute('id') || `icon-${extracted.length + 1}`;
        const inner = g.outerHTML.trim();
        const standalone = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rootVb}">${inner}</svg>`;
        extracted.push({
          name: id,
          svgContent: standalone
        });
      }
      return extracted;
    }

    // 3. Try finding nested <svg id="...">
    const nestedSvgs = Array.from(doc.querySelectorAll('svg > svg[id]'));
    if (nestedSvgs.length > 0) {
      for (const s of nestedSvgs) {
        const id = s.getAttribute('id') || `icon-${extracted.length + 1}`;
        const vb = s.getAttribute('viewBox') || '0 0 24 24';
        const inner = s.innerHTML.trim();
        const standalone = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
        extracted.push({
          name: id,
          svgContent: standalone
        });
      }
      return extracted;
    }

    // If it's a single standalone SVG, extract as 1 icon
    const rootSvg = doc.querySelector('svg');
    if (rootSvg) {
      const id = rootSvg.getAttribute('id') || 'imported-icon';
      extracted.push({
        name: id,
        svgContent: spriteContent
      });
    }

    return extracted;
  }

  /**
   * Parse a CSS or JSON mapping file to associate unicode codepoints with icon names.
   * e.g., .icon-heart:before { content: "\e001"; } -> e001 => 'heart'
   */
  static parseMapping(mappingContent: string): Map<string, string> {
    const map = new Map<string, string>(); // unicode hex lowercase => name
    if (!mappingContent || !mappingContent.trim()) return map;

    // Check if JSON
    const trimmed = mappingContent.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === 'number') {
            const hex = val.toString(16).toLowerCase();
            map.set(hex, key);
          } else if (typeof val === 'string') {
            const hexMatch = val.replace(/^\\?u?0*x?/, '').toLowerCase();
            map.set(hexMatch, key);
          }
        }
        return map;
      } catch {
        // Not valid JSON, proceed to CSS regex
      }
    }

    // Parse CSS rules:
    // .icon-name:before { content: "\e001"; }
    // .fa-heart:before { content: "\f004"; }
    const cssRegex = /\.([a-zA-Z0-9_-]+)::?before\s*\{[^}]*content:\s*["']\\?([a-fA-F0-9]+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = cssRegex.exec(mappingContent)) !== null) {
      const className = match[1];
      const unicodeHex = match[2].toLowerCase();
      // clean className (e.g. icon-heart -> heart, fa-heart -> heart)
      const cleanName = className.replace(/^(icon|fa|glyph|ri|bi)-/i, '') || className;
      map.set(unicodeHex, cleanName);
    }

    return map;
  }

  /**
   * Extract vector glyphs from TTF, WOFF, WOFF2, OTF, or SVG font buffers.
   */
  static async extractFromFont(
    fontBuffer: Buffer,
    fontFileName: string,
    mappingContent?: string
  ): Promise<ExtractedIcon[]> {
    const ext = fontFileName.toLowerCase().split('.').pop() || '';
    const mapping = this.parseMapping(mappingContent || '');
    const extracted: ExtractedIcon[] = [];

    // SVG Font format
    const headerSnippet = fontBuffer.subarray(0, 150).toString('utf8');
    if (ext === 'svg' || headerSnippet.includes('<svg') || headerSnippet.includes('<font')) {
      const xml = fontBuffer.toString('utf8');
      const dom = new JSDOM(xml, { contentType: 'image/svg+xml' });
      const doc = dom.window.document;
      const glyphs = Array.from(doc.querySelectorAll('glyph'));
      const fontFace = doc.querySelector('font-face');
      const unitsPerEm = parseInt(fontFace?.getAttribute('units-per-em') || '1000', 10);
      const ascent = parseInt(fontFace?.getAttribute('ascent') || '800', 10);

      for (const glyph of glyphs) {
        const d = glyph.getAttribute('d');
        if (!d || !d.trim()) continue;

        let glyphName = glyph.getAttribute('glyph-name') || '';
        const unicodeRaw = glyph.getAttribute('unicode') || '';
        let unicodeHex = '';
        if (unicodeRaw) {
          unicodeHex = unicodeRaw.codePointAt(0)?.toString(16).toLowerCase() || '';
        }

        if (unicodeHex && mapping.has(unicodeHex)) {
          glyphName = mapping.get(unicodeHex)!;
        }

        if (!glyphName) {
          glyphName = unicodeHex ? `icon-${unicodeHex}` : `glyph-${extracted.length + 1}`;
        }

        // SVG font coordinates have flipped Y-axis, so flip back with scale(1, -1) translate(0, -ascent)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${unitsPerEm} ${unitsPerEm}"><g transform="scale(1, -1) translate(0, -${ascent})"><path d="${d}" fill="currentColor"/></g></svg>`;

        extracted.push({
          name: glyphName,
          svgContent: svg,
          codepoint: unicodeHex || undefined
        });
      }

      return extracted;
    }

    // Binary fonts: TTF, WOFF, WOFF2, OTF
    let ttfBuffer: Buffer = fontBuffer;
    if (ext === 'woff2') {
      const decompressed = await wawoff2.decompress(fontBuffer);
      ttfBuffer = Buffer.from(decompressed);
    }

    const font = opentype.parse(
      ttfBuffer.buffer.slice(ttfBuffer.byteOffset, ttfBuffer.byteOffset + ttfBuffer.byteLength)
    );
    const unitsPerEm = font.unitsPerEm || 1000;
    const ascender = font.ascender || unitsPerEm;

    for (let i = 0; i < font.glyphs.length; i++) {
      const g = font.glyphs.get(i);
      if (g.name === '.notdef' || g.name === '.null') continue;

      const path = g.getPath(0, ascender, unitsPerEm);
      const pathData = path.toPathData(2);
      if (!pathData || pathData.trim().length === 0) continue;

      const unicodeHex = g.unicode ? g.unicode.toString(16).toLowerCase() : undefined;
      let name = '';

      if (unicodeHex && mapping.has(unicodeHex)) {
        name = mapping.get(unicodeHex)!;
      } else if (g.name && !g.name.startsWith('uni') && !g.name.startsWith('u') && g.name !== 'glyph') {
        name = g.name;
      } else if (unicodeHex) {
        name = `icon-${unicodeHex}`;
      } else {
        name = `glyph-${i}`;
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${unitsPerEm} ${unitsPerEm}"><path d="${pathData}" fill="currentColor"/></svg>`;

      extracted.push({
        name,
        svgContent: svg,
        codepoint: unicodeHex
      });
    }

    return extracted;
  }
}
