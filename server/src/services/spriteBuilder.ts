import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import crypto from 'crypto';
import { SvgOptimizer } from './svgOptimizer.js';
import { StorageService } from './storageService.js';

export interface SpriteIconInput {
  id: string;
  name: string;
  slug: string;
  svgContent: string;
}

export interface SpriteBuildOptions {
  mode: 'symbol' | 'stack' | 'css';
  idPattern: string;
  stripColors: boolean;
  keepViewBox: boolean;
  removeDimensions: boolean;
  svgo: boolean;
  namespaceIds: boolean;
}

export interface SpriteBuildResult {
  spriteSvg: string;
  previewHtml: string;
  cssContent?: string;
  zipPath: string;
  totalOriginalSize: number;
  spriteSize: number;
  savingsPercent: number;
  iconCount: number;
  symbols: Array<{ id: string; name: string; snippet: string }>;
}

export const SpriteBuilder = {
  build(
    projectId: string,
    prefix: string,
    icons: SpriteIconInput[],
    options: SpriteBuildOptions
  ): Promise<SpriteBuildResult> {
    return new Promise((resolve, reject) => {
      try {
        let totalOriginalSize = 0;
        const processedIcons: Array<{
          id: string;
          name: string;
          slug: string;
          viewBox: string;
          innerContent: string;
          symbolId: string;
          snippet: string;
        }> = [];

        for (const icon of icons) {
          totalOriginalSize += Buffer.byteLength(icon.svgContent, 'utf8');

          let svgCode = icon.svgContent;

          // Optional SVGO optimization
          if (options.svgo) {
            const opt = SvgOptimizer.optimize(svgCode, {
              multipass: true,
              keepViewBox: options.keepViewBox,
              removeDimensions: options.removeDimensions,
              stripColors: options.stripColors
            });
            svgCode = opt.optimizedSvg;
          }

          // Parse with JSDOM
          const dom = new JSDOM(svgCode, { contentType: 'image/svg+xml' });
          const document = dom.window.document;
          const svgEl = document.querySelector('svg');

          if (!svgEl) continue;

          let viewBox = svgEl.getAttribute('viewBox') || '0 0 24 24';

          // Strip colors if requested
          if (options.stripColors) {
            svgEl.setAttribute('fill', 'currentColor');
            const shapeElements = svgEl.querySelectorAll('path, circle, rect, polygon, polyline, ellipse, line');
            shapeElements.forEach(el => {
              const fill = el.getAttribute('fill');
              if (fill !== 'none' && fill !== 'transparent') {
                el.setAttribute('fill', 'currentColor');
              }
              const stroke = el.getAttribute('stroke');
              if (stroke && stroke !== 'none' && stroke !== 'transparent') {
                el.setAttribute('stroke', 'currentColor');
              }
            });
          }

          // Namespace IDs to avoid collision (e.g. clipPath id="a", linearGradient id="b")
          if (options.namespaceIds) {
            const elementsWithId = svgEl.querySelectorAll('[id]');
            const idMap = new Map<string, string>();

            elementsWithId.forEach(el => {
              const currentId = el.getAttribute('id');
              if (currentId) {
                const newId = `${icon.slug}-${currentId}`;
                idMap.set(currentId, newId);
                el.setAttribute('id', newId);
              }
            });

            // Update references: url(#id), href="#id"
            idMap.forEach((newId, oldId) => {
              const urlRegex = new RegExp(`url\\(#${oldId}\\)`, 'g');
              const hrefRegex = new RegExp(`#${oldId}`, 'g');

              svgEl.querySelectorAll('*').forEach(el => {
                ['fill', 'stroke', 'clip-path', 'mask', 'filter'].forEach(attr => {
                  const val = el.getAttribute(attr);
                  if (val && urlRegex.test(val)) {
                    el.setAttribute(attr, val.replace(urlRegex, `url(#${newId})`));
                  }
                });

                ['href', 'xlink:href'].forEach(attr => {
                  const val = el.getAttribute(attr);
                  if (val === `#${oldId}`) {
                    el.setAttribute(attr, `#${newId}`);
                  }
                });
              });
            });
          }

          // Calculate symbol ID
          const symbolId = options.idPattern
            .replace('{prefix}', prefix)
            .replace('{name}', icon.slug);

          const innerContent = svgEl.innerHTML;
          const snippet = `<svg class="icon"><use href="sprite.svg#${symbolId}"/></svg>`;

          processedIcons.push({
            id: icon.id,
            name: icon.name,
            slug: icon.slug,
            viewBox,
            innerContent,
            symbolId,
            snippet
          });
        }

        // Generate Sprite SVG according to mode
        let spriteSvg = '';
        let cssContent = '';

        if (options.mode === 'stack') {
          // SVG Stack mode
          spriteSvg = [
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
            '  <style>',
            '    :root > svg { display: none; }',
            '    :root > svg:target { display: inline; }',
            '  </style>'
          ].join('\n');

          for (const icon of processedIcons) {
            spriteSvg += `\n  <svg id="${icon.symbolId}" viewBox="${icon.viewBox}">${icon.innerContent}</svg>`;
          }

          spriteSvg += '\n</svg>';
        } else {
          // Symbol mode (default) and CSS mode
          spriteSvg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">\n';
          for (const icon of processedIcons) {
            spriteSvg += `  <symbol id="${icon.symbolId}" viewBox="${icon.viewBox}">\n    ${icon.innerContent}\n  </symbol>\n`;
          }
          spriteSvg += '</svg>';

          if (options.mode === 'css') {
            cssContent = `/* IconVault Generated Sprite CSS */\n.icon {\n  display: inline-block;\n  width: 1em;\n  height: 1em;\n  stroke-width: 0;\n  stroke: currentColor;\n  fill: currentColor;\n  vertical-align: -0.125em;\n}\n\n`;
            for (const icon of processedIcons) {
              cssContent += `.${icon.symbolId} { /* Symbol ID: ${icon.symbolId} */ }\n`;
            }
          }
        }

        const spriteSize = Buffer.byteLength(spriteSvg, 'utf8');
        const savingsPercent = totalOriginalSize > 0
          ? Math.max(0, Math.round(((totalOriginalSize - spriteSize) / totalOriginalSize) * 100))
          : 0;

        // Generate HTML Specimen Page
        const previewHtml = generateSpritePreviewHtml({
          prefix,
          mode: options.mode,
          spriteSvg,
          icons: processedIcons
        });

        // Write output to build storage and create ZIP
        const { buildsDir } = StorageService.initProjectStorage(projectId);
        const buildId = crypto.randomUUID();
        const buildFolder = path.join(buildsDir, `sprite-${buildId}`);
        fs.mkdirSync(buildFolder, { recursive: true });

        const spritePath = path.join(buildFolder, 'sprite.svg');
        fs.writeFileSync(spritePath, spriteSvg, 'utf8');

        const htmlPath = path.join(buildFolder, 'preview.html');
        fs.writeFileSync(htmlPath, previewHtml, 'utf8');

        if (cssContent) {
          fs.writeFileSync(path.join(buildFolder, 'sprite.css'), cssContent, 'utf8');
        }

        const readmeContent = `# ${prefix.toUpperCase()} SVG Sprite Package\n\nGenerated by IconVault.\n\n## Usage\n\n\`\`\`html\n<!-- Inline usage with SVG <use> -->\n<svg class="icon">\n  <use href="sprite.svg#${processedIcons[0]?.symbolId || 'icon-sample'}"/>\n</svg>\n\`\`\`\n\nTotal icons: ${processedIcons.length}\nOriginal size: ${(totalOriginalSize / 1024).toFixed(2)} KB\nSprite size: ${(spriteSize / 1024).toFixed(2)} KB\n`;
        fs.writeFileSync(path.join(buildFolder, 'README.md'), readmeContent, 'utf8');

        // Create ZIP archive
        const zipPath = path.join(buildsDir, `sprite-${buildId}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
          resolve({
            spriteSvg,
            previewHtml,
            cssContent: cssContent || undefined,
            zipPath,
            totalOriginalSize,
            spriteSize,
            savingsPercent,
            iconCount: processedIcons.length,
            symbols: processedIcons.map(i => ({ id: i.symbolId, name: i.name, snippet: i.snippet }))
          });
        });

        archive.on('error', err => reject(err));
        archive.pipe(output);
        archive.directory(buildFolder, false);
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }
};

function generateSpritePreviewHtml(data: {
  prefix: string;
  mode: string;
  spriteSvg: string;
  icons: Array<{ symbolId: string; name: string; snippet: string }>;
}): string {
  const iconCards = data.icons.map(icon => `
    <div class="card" onclick="copySnippet('${icon.snippet.replace(/"/g, '&quot;')}')">
      <div class="icon-wrap">
        <svg class="icon"><use href="#${icon.symbolId}"></use></svg>
      </div>
      <div class="name">${icon.name}</div>
      <div class="id">#${icon.symbolId}</div>
      <div class="badge">Click to copy</div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.prefix} - SVG Sprite Preview</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #18181b;
      --card-border: #27272a;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --accent: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px 24px;
    }
    header {
      max-width: 1200px;
      margin: 0 auto 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    h1 { font-size: 24px; font-weight: 700; }
    .badge-count {
      background: #27272a;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .search-input {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      width: 260px;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }
    .card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .icon-wrap {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .icon {
      width: 32px;
      height: 32px;
      fill: currentColor;
    }
    .name {
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .id {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .badge {
      display: none;
      position: absolute;
      top: 6px;
      right: 6px;
      background: var(--accent);
      color: #fff;
      font-size: 9px;
      padding: 2px 5px;
      border-radius: 4px;
      font-weight: 600;
    }
    .card:hover .badge { display: block; }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #22c55e;
      color: #fff;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <!-- Hidden Sprite Inclusion for Preview Rendering -->
  <div style="display: none;">
    ${data.spriteSvg}
  </div>

  <header>
    <div>
      <h1>${data.prefix} SVG Sprite <span class="badge-count">${data.icons.length} icons</span></h1>
    </div>
    <input type="text" id="search" class="search-input" placeholder="Search icons..." oninput="filterIcons()">
  </header>

  <main class="grid" id="iconGrid">
    ${iconCards}
  </main>

  <div id="toast" class="toast">Copied snippet to clipboard!</div>

  <script>
    function copySnippet(snippet) {
      navigator.clipboard.writeText(snippet);
      const toast = document.getElementById('toast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function filterIcons() {
      const q = document.getElementById('search').value.toLowerCase();
      document.querySelectorAll('.card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;
}
