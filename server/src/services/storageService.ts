import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { BadRequestError } from '../utils/errors.js';

export const StorageService = {
  // Ensure project directory structure exists
  initProjectStorage(projectId: string): {
    projectDir: string;
    iconsDir: string;
    versionsDir: string;
    buildsDir: string;
  } {
    const projectDir = path.join(CONFIG.PROJECTS_DIR, projectId);
    const iconsDir = path.join(projectDir, 'icons');
    const versionsDir = path.join(projectDir, 'versions');
    const buildsDir = path.join(projectDir, 'builds');

    [projectDir, iconsDir, versionsDir, buildsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return { projectDir, iconsDir, versionsDir, buildsDir };
  },

  // Path traversal guard
  safePath(baseDir: string, relativeOrFileName: string): string {
    const safeBase = path.resolve(baseDir);
    const resolved = path.resolve(safeBase, relativeOrFileName);
    if (!resolved.startsWith(safeBase)) {
      throw new BadRequestError('Invalid path: Directory traversal detected');
    }
    return resolved;
  },

  // Save an icon file
  saveIconSvg(projectId: string, iconId: string, svgContent: string): { filePath: string; byteSize: number } {
    const { iconsDir } = this.initProjectStorage(projectId);
    const fileName = `${iconId}.svg`;
    const filePath = this.safePath(iconsDir, fileName);

    fs.writeFileSync(filePath, svgContent, 'utf8');
    const byteSize = Buffer.byteLength(svgContent, 'utf8');
    return { filePath, byteSize };
  },

  // Read an icon file
  readIconSvg(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestError('Icon file not found on disk');
    }
    return fs.readFileSync(filePath, 'utf8');
  },

  // Save an icon version snapshot
  saveVersionSnapshot(projectId: string, versionId: string, currentSvgContent: string): { filePath: string; byteSize: number } {
    const { versionsDir } = this.initProjectStorage(projectId);
    const fileName = `${versionId}.svg`;
    const filePath = this.safePath(versionsDir, fileName);

    fs.writeFileSync(filePath, currentSvgContent, 'utf8');
    const byteSize = Buffer.byteLength(currentSvgContent, 'utf8');
    return { filePath, byteSize };
  },

  // Delete an icon file from disk
  deleteIconFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete file ${filePath}:`, err);
      }
    }
  },

  // Delete entire project storage directory
  deleteProjectStorage(projectId: string): void {
    const projectDir = path.join(CONFIG.PROJECTS_DIR, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }
};
