import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { ProjectRepo, ProjectRecord } from '../db/repositories/projectRepo.js';
import { FolderRepo, FolderRecord } from '../db/repositories/folderRepo.js';
import { IconRepo, IconRecord } from '../db/repositories/iconRepo.js';
import { StorageService } from './storageService.js';
import { SvgSanitizer } from './svgSanitizer.js';
import { CONFIG } from '../config.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export interface ProjectManifest {
  version: '1.0';
  exportedAt: string;
  project: {
    name: string;
    description: string;
    prefix: string;
    color: string;
    purpose?: 'sprite' | 'font';
    settings: any;
  };
  folders: Array<{
    tempId: string;
    parentTempId: string | null;
    name: string;
    orderIndex: number;
    path: string;
  }>;
  icons: Array<{
    name: string;
    slug: string;
    folderPath: string | null;
    tags: string[];
    codepoint: string | null;
    fileName: string;
  }>;
}

export const ExportImportService = {
  async exportProject(projectId: string): Promise<{ zipPath: string; fileName: string }> {
    const project = ProjectRepo.findById(projectId);
    if (!project) throw new NotFoundError('Project not found');

    const folders = FolderRepo.findByProject(projectId);
    const { icons } = IconRepo.findMany(projectId, { includeDeleted: false });

    // Build folder paths map
    const folderPathMap = new Map<string, string>();
    const folderMap = new Map<string, FolderRecord>(folders.map(f => [f.id, f]));

    function getFolderPath(folderId: string): string {
      if (folderPathMap.has(folderId)) return folderPathMap.get(folderId)!;
      const folder = folderMap.get(folderId);
      if (!folder) return '';
      const parentPath = folder.parent_id ? getFolderPath(folder.parent_id) : '';
      const full = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      folderPathMap.set(folderId, full);
      return full;
    }

    folders.forEach(f => getFolderPath(f.id));

    // Construct manifest
    let parsedSettings = {};
    try {
      parsedSettings = JSON.parse(project.settings_json || '{}');
    } catch {}

    const manifest: ProjectManifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
        prefix: project.prefix,
        color: project.color,
        purpose: project.purpose,
        settings: parsedSettings
      },
      folders: folders.map(f => ({
        tempId: f.id,
        parentTempId: f.parent_id,
        name: f.name,
        orderIndex: f.order_index,
        path: folderPathMap.get(f.id) || f.name
      })),
      icons: icons.map(i => {
        let tags: string[] = [];
        try { tags = JSON.parse(i.tags || '[]'); } catch {}
        return {
          name: i.name,
          slug: i.slug,
          folderPath: i.folder_id ? folderPathMap.get(i.folder_id) || null : null,
          tags,
          codepoint: i.codepoint,
          fileName: `${i.slug}.svg`
        };
      })
    };

    const tempExportDir = path.join(CONFIG.STORAGE_DIR, 'exports');
    if (!fs.existsSync(tempExportDir)) {
      fs.mkdirSync(tempExportDir, { recursive: true });
    }

    const exportId = crypto.randomUUID();
    const zipName = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_export_${Date.now()}.zip`;
    const zipPath = path.join(tempExportDir, zipName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve({ zipPath, fileName: zipName });
      });

      archive.on('error', err => reject(err));
      archive.pipe(output);

      // Append manifest.json
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Append icons
      for (const icon of icons) {
        if (fs.existsSync(icon.svg_path)) {
          const folderRelative = icon.folder_id ? folderPathMap.get(icon.folder_id) || '' : '';
          const zipEntryPath = folderRelative 
            ? `icons/${folderRelative}/${icon.slug}.svg`
            : `icons/${icon.slug}.svg`;
          archive.file(icon.svg_path, { name: zipEntryPath });
        }
      }

      archive.finalize();
    });
  },

  async importProject(zipBuffer: Buffer, overrideName?: string): Promise<ProjectRecord> {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const manifestEntry = zipEntries.find(e => e.entryName === 'manifest.json' || e.entryName.endsWith('/manifest.json'));
    if (!manifestEntry) {
      throw new BadRequestError('Invalid project archive: manifest.json is missing');
    }

    let manifest: ProjectManifest;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch {
      throw new BadRequestError('Corrupted manifest.json in archive');
    }

    // Create the project
    const projectName = overrideName?.trim() || `${manifest.project.name} (Imported)`;
    const newProject = ProjectRepo.create({
      name: projectName,
      description: manifest.project.description,
      prefix: manifest.project.prefix,
      color: manifest.project.color,
      purpose: (manifest.project.purpose as any) || 'sprite',
      settings_json: JSON.stringify(manifest.project.settings || {})
    });

    // Recreate folder structure
    const tempIdToNewId = new Map<string, string>();
    const folderPathToNewId = new Map<string, string>();

    // Sort folders by depth to create parents first
    const sortedFolders = [...manifest.folders].sort((a, b) => {
      const depthA = (a.path.match(/\//g) || []).length;
      const depthB = (b.path.match(/\//g) || []).length;
      return depthA - depthB;
    });

    for (const f of sortedFolders) {
      const parentId = f.parentTempId ? tempIdToNewId.get(f.parentTempId) || null : null;
      const createdFolder = FolderRepo.create({
        projectId: newProject.id,
        parentId,
        name: f.name,
        orderIndex: f.orderIndex
      });
      tempIdToNewId.set(f.tempId, createdFolder.id);
      folderPathToNewId.set(f.path, createdFolder.id);
    }

    // Import icons
    for (const iconMeta of manifest.icons) {
      // Find the file in zip
      const targetFileName = iconMeta.fileName || `${iconMeta.slug}.svg`;
      const fileEntry = zipEntries.find(e => !e.isDirectory && (
        e.entryName === `icons/${iconMeta.folderPath ? iconMeta.folderPath + '/' : ''}${targetFileName}` ||
        e.entryName.endsWith(`/${targetFileName}`) ||
        e.entryName === targetFileName
      ));

      if (!fileEntry) continue;

      const rawSvg = fileEntry.getData().toString('utf8');
      try {
        const sanitized = SvgSanitizer.sanitize(rawSvg);
        const iconId = crypto.randomUUID();
        const { filePath, byteSize } = StorageService.saveIconSvg(newProject.id, iconId, sanitized.sanitizedSvg);

        const folderId = iconMeta.folderPath ? folderPathToNewId.get(iconMeta.folderPath) || null : null;

        IconRepo.create({
          projectId: newProject.id,
          folderId,
          name: iconMeta.name,
          slug: iconMeta.slug,
          svgPath: filePath,
          tags: iconMeta.tags,
          byteSize,
          originalByteSize: byteSize,
          codepoint: iconMeta.codepoint,
          width: sanitized.width,
          height: sanitized.height,
          viewBox: sanitized.viewBox,
          hasStroke: sanitized.hasStroke,
          hasGradient: sanitized.hasGradient,
          hasText: sanitized.hasText
        });
      } catch (err) {
        console.warn(`Failed to import icon ${iconMeta.name}:`, err);
      }
    }

    return newProject;
  }
};
