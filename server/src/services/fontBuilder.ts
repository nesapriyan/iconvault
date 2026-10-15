import { generateFonts, FontAssetType, OtherAssetType } from 'fantasticon';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import crypto from 'crypto';
import { StorageService } from './storageService.js';
import { IconRepo } from '../db/repositories/iconRepo.js';

export interface FontIconInput {
  id: string;
  name: string;
  slug: string;
  svgContent: string;
  codepoint: string | null;
  hasStroke: boolean;
  hasGradient: boolean;
  hasText: boolean;
}

export interface FontBuildOptions {
  formats: ('ttf' | 'woff' | 'woff2' | 'eot' | 'svg')[];
  fontName: string;
  prefix: string;
  baseClass: string;
  startCodepoint: string; // e.g. "E001"
  fontHeight: number;
  descent: number;
  normalize: boolean;
}

export interface FontBuildResult {
  fontName: string;
  prefix: string;
  baseClass: string;
  cssContent: string;
  scssContent: string;
  htmlSpecimen: string;
  glyphMap: Record<string, number>;
  zipPath: string;
  totalSize: number;
  iconCount: number;
  warnings: Array<{ iconName: string; warning: string }>;
  woff2Base64?: string;
  codepoints: Array<{ id: string; name: string; slug: string; codepoint: string; unicodeHex: string }>;
}

export const FontBuilder = {
  async build(
    projectId: string,
    icons: FontIconInput[],
    options: FontBuildOptions
  ): Promise<FontBuildResult> {
    if (icons.length === 0) {
      throw new Error('No icons selected for font generation');
    }

    const { buildsDir } = StorageService.initProjectStorage(projectId);
    const buildId = crypto.randomUUID();
    const tempInDir = path.join(buildsDir, `tmp-font-in-${buildId}`);
    const tempOutDir = path.join(buildsDir, `font-${buildId}`);

    fs.mkdirSync(tempInDir, { recursive: true });
    fs.mkdirSync(tempOutDir, { recursive: true });

    try {
      const warnings: Array<{ iconName: string; warning: string }> = [];
      const codepointMap: Record<string, number> = {};
      const codepointsResult: Array<{ id: string; name: string; slug: string; codepoint: string; unicodeHex: string }> = [];

      // Determine starting codepoint integer
      let nextCodepointInt = parseInt(options.startCodepoint || 'E001', 16);
      if (isNaN(nextCodepointInt)) nextCodepointInt = 0xE001;

      // Track already used codepoints across this build
      const usedCodepointInts = new Set<number>();

      // First pass: assign existing persistent codepoints
      for (const icon of icons) {
        if (icon.codepoint) {
          const val = parseInt(icon.codepoint, 16);
          if (!isNaN(val)) {
            usedCodepointInts.add(val);
          }
        }
      }

      // Second pass: process each icon and guarantee unique stable codepoint
      for (const icon of icons) {
        // Collect conversion quality warnings
        if (icon.hasStroke) {
          warnings.push({
            iconName: icon.name,
            warning: 'Contains stroke attributes. Icon fonts require filled vector paths for accurate rendering.'
          });
        }
        if (icon.hasGradient) {
          warnings.push({
            iconName: icon.name,
            warning: 'Contains color gradients. Icon fonts only render single-color monochrome glyphs.'
          });
        }
        if (icon.hasText) {
          warnings.push({
            iconName: icon.name,
            warning: 'Contains text elements. Text should be converted into path outlines.'
          });
        }

        // Determine codepoint
        let cpInt: number;
        if (icon.codepoint) {
          cpInt = parseInt(icon.codepoint, 16);
        } else {
          while (usedCodepointInts.has(nextCodepointInt)) {
            nextCodepointInt++;
          }
          cpInt = nextCodepointInt;
          usedCodepointInts.add(cpInt);
          nextCodepointInt++;

          // Persist back to database so future builds use this exact codepoint
          const hex = cpInt.toString(16).toUpperCase().padStart(4, '0');
          IconRepo.update(icon.id, { codepoint: hex });
        }

        const hexStr = cpInt.toString(16).toUpperCase().padStart(4, '0');
        codepointMap[icon.slug] = cpInt;
        codepointsResult.push({
          id: icon.id,
          name: icon.name,
          slug: icon.slug,
          codepoint: hexStr,
          unicodeHex: `\\${hexStr.toLowerCase()}`
        });

        // Write cleaned SVG into input folder
        const cleanFilePath = path.join(tempInDir, `${icon.slug}.svg`);
        fs.writeFileSync(cleanFilePath, icon.svgContent, 'utf8');
      }

      // Safe font name and normalized prefix
      const fontName = options.fontName.replace(/[^a-zA-Z0-9_-]/g, '') || 'IconFont';
      const prefix = (options.prefix || 'icon').replace(/-+$/, '');

      // Fantasticon generation
      await generateFonts({
        inputDir: tempInDir,
        outputDir: tempOutDir,
        name: fontName,
        fontTypes: options.formats as FontAssetType[],
        assetTypes: ['css', 'scss', 'json', 'html'] as OtherAssetType[],
        formatOptions: {
          json: { indent: 2 }
        },
        codepoints: codepointMap,
        prefix,
        fontHeight: options.fontHeight || 1000,
        descent: options.descent ?? 0,
        normalize: options.normalize !== false
      });

      // Read output files
      const cssPath = path.join(tempOutDir, `${fontName}.css`);
      const scssPath = path.join(tempOutDir, `${fontName}.scss`);
      const htmlPath = path.join(tempOutDir, `${fontName}.html`);
      const jsonPath = path.join(tempOutDir, `${fontName}.json`);
      const woff2Path = path.join(tempOutDir, `${fontName}.woff2`);

      const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
      const scssContent = fs.existsSync(scssPath) ? fs.readFileSync(scssPath, 'utf8') : '';
      const htmlSpecimen = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
      const glyphMap = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : codepointMap;

      let woff2Base64: string | undefined;
      if (fs.existsSync(woff2Path)) {
        woff2Base64 = fs.readFileSync(woff2Path).toString('base64');
      }

      // Generate README documentation for developer integration
      const readmePath = path.join(tempOutDir, 'README.md');
      const readme = `# ${fontName} Icon Font\n\nGenerated with IconVault.\n\n## Quick Start\n\n1. Include the CSS in your HTML:\n\`\`\`html\n<link rel="stylesheet" href="${fontName}.css">\n\`\`\`\n\n2. Use an icon:\n\`\`\`html\n<i class="${prefix}${icons[0]?.slug || 'sample'}"></i>\n\`\`\`\n\nTotal icons: ${icons.length}\n`;
      fs.writeFileSync(readmePath, readme, 'utf8');

      // Package into ZIP
      const zipPath = path.join(buildsDir, `font-${buildId}.zip`);
      await new Promise<void>((resolveZip, rejectZip) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolveZip());
        archive.on('error', err => rejectZip(err));
        archive.pipe(output);
        archive.directory(tempOutDir, false);
        archive.finalize();
      });

      const totalSize = fs.statSync(zipPath).size;

      return {
        fontName,
        prefix,
        baseClass: options.baseClass || 'icon',
        cssContent,
        scssContent,
        htmlSpecimen,
        glyphMap,
        zipPath,
        totalSize,
        iconCount: icons.length,
        warnings,
        woff2Base64,
        codepoints: codepointsResult
      };
    } finally {
      // Clean up input SVGs directory
      if (fs.existsSync(tempInDir)) {
        fs.rmSync(tempInDir, { recursive: true, force: true });
      }
    }
  }
};
