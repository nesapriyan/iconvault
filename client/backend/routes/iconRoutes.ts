import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { IconRepo, IconRecord } from '../db/repositories/iconRepo.js';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { FolderRepo } from '../db/repositories/folderRepo.js';
import { StorageService } from '../services/storageService.js';
import { SvgSanitizer } from '../services/svgSanitizer.js';
import { SvgOptimizer } from '../services/svgOptimizer.js';
import {
  updateIconSchema,
  batchMoveIconsSchema,
  batchTagIconsSchema,
  batchDeleteIconsSchema
} from '../utils/validation.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { ImporterService } from '../services/importerService.js';
import { Permissions } from '../utils/permissions.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Helper to generate a clean slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'icon';
}

// Helper to handle duplicate names
async function resolveSlug(projectId: string, baseSlug: string, strategy: 'rename' | 'replace' | 'skip'): Promise<{ slug: string; action: 'insert' | 'replace' | 'skip'; existingIconId?: string }> {
  const existing = (await IconRepo.findBySlug(projectId, baseSlug));
  if (!existing) {
    return { slug: baseSlug, action: 'insert' };
  }

  if (strategy === 'replace') {
    return { slug: baseSlug, action: 'replace', existingIconId: existing.id };
  }

  if (strategy === 'skip') {
    return { slug: baseSlug, action: 'skip', existingIconId: existing.id };
  }

  // Rename with incremental suffix
  let counter = 1;
  while (true) {
    const candidate = `${baseSlug}-${counter}`;
    if (!(await IconRepo.findBySlug(projectId, candidate))) {
      return { slug: candidate, action: 'insert' };
    }
    counter++;
  }
}

// Process and store a single SVG
async function processSvgUpload(
  projectId: string,
  folderId: string | null,
  rawName: string,
  rawSvgContent: string,
  options: {
    duplicateStrategy: 'rename' | 'replace' | 'skip';
    autoOptimize: boolean;
    tags?: string[];
  }
): Promise<{ icon: IconRecord | null; warnings: string[]; skipped?: boolean }> {
  // Sanitize
  const sanitized = SvgSanitizer.sanitize(rawSvgContent);
  let finalSvg = sanitized.sanitizedSvg;
  let finalSize = Buffer.byteLength(finalSvg, 'utf8');
  const originalSize = finalSize;

  // Auto-optimize if requested
  if (options.autoOptimize) {
    const opt = SvgOptimizer.optimize(finalSvg, { multipass: true, keepViewBox: true });
    finalSvg = opt.optimizedSvg;
    finalSize = opt.optimizedSize;
  }

  const baseName = rawName.replace(/\.svg$/i, '').trim();
  const baseSlug = generateSlug(baseName);

  const resolution = (await resolveSlug(projectId, baseSlug, options.duplicateStrategy));

  if (resolution.action === 'skip') {
    return { icon: null, warnings: [], skipped: true };
  }

  if (resolution.action === 'replace' && resolution.existingIconId) {
    const current = (await IconRepo.findById(resolution.existingIconId))!;
    // Save version history
    (await IconRepo.saveVersion(current.id, current.svg_path, current.byte_size));

    // Save new SVG content to file
    const { filePath, byteSize } = (await StorageService.saveIconSvg(projectId, current.id, finalSvg));

    const updated = (await IconRepo.update(current.id, {
          svgPath: filePath,
          byteSize,
          originalByteSize: originalSize,
          width: sanitized.width,
          height: sanitized.height,
          viewBox: sanitized.viewBox,
          hasStroke: sanitized.hasStroke,
          hasGradient: sanitized.hasGradient,
          hasText: sanitized.hasText
        }))!;

    return { icon: updated, warnings: sanitized.warnings };
  }

  // New Icon insert
  const iconId = crypto.randomUUID();
  const { filePath, byteSize } = (await StorageService.saveIconSvg(projectId, iconId, finalSvg));
  const codepoint = (await IconRepo.getNextAvailableCodepoint(projectId));

  const created = (await IconRepo.create({
      projectId,
      folderId,
      name: baseName,
      slug: resolution.slug,
      svgPath: filePath,
      tags: options.tags || [],
      byteSize,
      originalByteSize: originalSize,
      codepoint,
      width: sanitized.width,
      height: sanitized.height,
      viewBox: sanitized.viewBox,
      hasStroke: sanitized.hasStroke,
      hasGradient: sanitized.hasGradient,
      hasText: sanitized.hasText
    }));

  return { icon: created, warnings: sanitized.warnings };
}

// Helper to format icon record with parsed tags array and loaded rawSvg
async function formatIconResponse(icon: IconRecord): Promise<any> {
  let tags: string[] = [];
  try {
    tags = typeof icon.tags === 'string' ? JSON.parse(icon.tags || '[]') : (Array.isArray(icon.tags) ? icon.tags : []);
  } catch {
    tags = [];
  }

  let rawSvg = '';
  try {
    rawSvg = (await StorageService.readIconSvg(icon.svg_path));
  } catch {
    rawSvg = '';
  }

  return {
    ...icon,
    tags,
    rawSvg
  };
}

// List icons
router.get('/projects/:projectId/icons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const folderId = req.query.folderId as string | undefined;
    const includeSubfolders = req.query.includeSubfolders === 'true';
    const search = req.query.search as string | undefined;
    const tag = req.query.tag as string | undefined;
    const sort = req.query.sort as any;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '0', 10);
    const trash = req.query.trash === 'true';

    let folderIds: string[] | undefined;
    if (folderId && folderId !== 'all' && folderId !== 'root' && includeSubfolders) {
      folderIds = (await FolderRepo.getDescendantFolderIds(folderId));
    }

    const { icons, total } = (await IconRepo.findMany(project.id, {
          folderId: folderIds ? undefined : folderId,
          folderIds,
          search,
          tag,
          sort,
          page,
          limit,
          includeDeleted: trash
        }));

    res.json({
      success: true,
      data: {
        icons: await Promise.all(icons.map(formatIconResponse)),
        total,
        page: limit > 0 ? page : 1,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 1
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single icon details including raw SVG and versions
router.get('/icons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canView(req.user, project)) {
      throw new ForbiddenError('You do not have permission to view this icon');
    }

    const rawSvg = (await StorageService.readIconSvg(icon.svg_path));
    const versions = (await IconRepo.getVersions(icon.id));

    let tags: string[] = [];
    try { tags = JSON.parse(icon.tags || '[]'); } catch {}

    res.json({
      success: true,
      data: {
        ...icon,
        tags,
        rawSvg,
        versions
      }
    });
  } catch (err) {
    next(err);
  }
});

// Download single icon SVG directly
router.get('/icons/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon || icon.deleted_at) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to download icons');
    }

    const svgContent = (await StorageService.readIconSvg(icon.svg_path));
    const filename = `${icon.slug || icon.name}.svg`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(svgContent);
  } catch (err) {
    next(err);
  }
});

// Download multiple icons (returns single SVG or ZIP archive)
router.post('/projects/:projectId/icons/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to download icons');
    }

    const { iconIds } = req.body;
    if (!Array.isArray(iconIds) || iconIds.length === 0) {
      throw new BadRequestError('iconIds array is required');
    }

    const allIcons = (await IconRepo.findByIds(iconIds));
    const validIcons = allIcons.filter(i => i.project_id === project.id && !i.deleted_at);

    if (validIcons.length === 0) {
      throw new NotFoundError('No valid icons found to download');
    }

    // Single icon requested -> stream SVG attachment directly
    if (validIcons.length === 1) {
      const single = validIcons[0];
      const svgContent = (await StorageService.readIconSvg(single.svg_path));
      const filename = `${single.slug || single.name}.svg`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(svgContent);
    }

    // Multiple icons -> package into ZIP archive
    const zip = new AdmZip();
    const usedNames = new Set<string>();

    for (const icon of validIcons) {
      try {
        const svgContent = (await StorageService.readIconSvg(icon.svg_path));
        let filename = `${icon.slug || icon.name}.svg`;
        if (usedNames.has(filename)) {
          filename = `${icon.slug || icon.name}-${icon.id.slice(0, 6)}.svg`;
        }
        usedNames.add(filename);
        zip.addFile(filename, Buffer.from(svgContent, 'utf-8'));
      } catch {
        // Skip unreadable files
      }
    }

    const zipBuffer = zip.toBuffer();
    const safeProjectName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeProjectName}-icons.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
});

// Upload multiple SVGs or ZIP
router.post('/projects/:projectId/icons/upload', upload.array('files'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canAddIcons(req.user, project)) {
      throw new ForbiddenError('You do not have permission to upload icons to this project');
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError('No files uploaded');
    }

    const folderId = req.body.folderId || null;
    const duplicateStrategy = (req.body.duplicateStrategy || 'rename') as 'rename' | 'replace' | 'skip';
    const autoOptimize = req.body.autoOptimize !== 'false';
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];

    const uploadedIcons: IconRecord[] = [];
    const allWarnings: Array<{ name: string; warnings: string[] }> = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      const isZip = file.mimetype === 'application/zip' || file.originalname.endsWith('.zip');

      if (isZip) {
        // Unpack zip
        try {
          const zip = new AdmZip(file.buffer);
          const entries = zip.getEntries();

          // Map directory paths in zip to folder IDs in database
          const zipFolderMap = new Map<string, string>();

          for (const entry of entries) {
            if (entry.isDirectory) continue;
            if (!entry.entryName.toLowerCase().endsWith('.svg')) continue;

            const entryDir = entry.entryName.split('/').slice(0, -1).join('/');
            let targetFolderId = folderId;

            if (entryDir) {
              if (zipFolderMap.has(entryDir)) {
                targetFolderId = zipFolderMap.get(entryDir)!;
              } else {
                // Create folder chain for this zip directory
                const parts = entryDir.split('/');
                let parent: string | null = folderId;
                let currentPath = '';

                for (const part of parts) {
                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                  if (zipFolderMap.has(currentPath)) {
                    parent = zipFolderMap.get(currentPath)!;
                  } else {
                    const createdFolder = (await FolderRepo.create({
                                          projectId: project.id,
                                          parentId: parent,
                                          name: part
                                        }));
                    zipFolderMap.set(currentPath, createdFolder.id);
                    parent = createdFolder.id;
                  }
                }
                targetFolderId = parent;
              }
            }

            const rawSvg = entry.getData().toString('utf8');
            const fileName = entry.name;
            try {
              const result = (await processSvgUpload(project.id, targetFolderId, fileName, rawSvg, {
                              duplicateStrategy,
                              autoOptimize,
                              tags
                            }));
              if (result.icon) uploadedIcons.push(result.icon);
              if (result.warnings.length > 0) allWarnings.push({ name: fileName, warnings: result.warnings });
            } catch (err: any) {
              errors.push({ file: entry.entryName, error: err.message });
            }
          }
        } catch (err: any) {
          errors.push({ file: file.originalname, error: `Corrupted ZIP file: ${err.message}` });
        }
      } else {
        // Single SVG file
        const rawSvg = file.buffer.toString('utf8');
        try {
          const result = (await processSvgUpload(project.id, folderId, file.originalname, rawSvg, {
                      duplicateStrategy,
                      autoOptimize,
                      tags
                    }));
          if (result.icon) uploadedIcons.push(result.icon);
          if (result.warnings.length > 0) allWarnings.push({ name: file.originalname, warnings: result.warnings });
        } catch (err: any) {
          errors.push({ file: file.originalname, error: err.message });
        }
      }
    }

    res.status(201).json({
      success: true,
      data: {
        uploaded: await Promise.all(uploadedIcons.map(formatIconResponse)),
        uploadedCount: uploadedIcons.length,
        warnings: allWarnings,
        errors
      }
    });
  } catch (err) {
    next(err);
  }
});

// Paste raw SVG code
router.post('/projects/:projectId/icons/paste', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canAddIcons(req.user, project)) {
      throw new ForbiddenError('You do not have permission to paste icons into this project');
    }

    const { rawSvg, name, folderId, autoOptimize, tags, duplicateStrategy } = req.body;
    if (!rawSvg) throw new BadRequestError('rawSvg content is required');

    const iconName = name?.trim() || 'Pasted Icon';
    const result = (await processSvgUpload(project.id, folderId || null, iconName, rawSvg, {
          duplicateStrategy: duplicateStrategy || 'rename',
          autoOptimize: autoOptimize !== false,
          tags: Array.isArray(tags) ? tags : []
        }));

    if (!result.icon) {
      res.json({ success: true, message: 'Icon skipped according to duplicate strategy' });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        icon: (await formatIconResponse(result.icon)),
        warnings: result.warnings
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update icon (rename, slug, tags, codepoint, or rawSvg editor save)
router.put('/icons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to edit icons in this project (view-only)');
    }

    const validated = updateIconSchema.parse(req.body);

    // If rawSvg code is edited:
    let svgPath = icon.svg_path;
    let byteSize = icon.byte_size;
    let width = icon.width;
    let height = icon.height;
    let viewBox = icon.view_box;
    let hasStroke = !!icon.has_stroke;
    let hasGradient = !!icon.has_gradient;
    let hasText = !!icon.has_text;

    if (validated.rawSvg) {
      // Archive current version
      (await IconRepo.saveVersion(icon.id, icon.svg_path, icon.byte_size));

      // Sanitize edited SVG
      const sanitized = SvgSanitizer.sanitize(validated.rawSvg);
      const saved = (await StorageService.saveIconSvg(icon.project_id, icon.id, sanitized.sanitizedSvg));

      svgPath = saved.filePath;
      byteSize = saved.byteSize;
      width = sanitized.width;
      height = sanitized.height;
      viewBox = sanitized.viewBox;
      hasStroke = sanitized.hasStroke;
      hasGradient = sanitized.hasGradient;
      hasText = sanitized.hasText;
    }

    // Slug check if renamed
    let slug = icon.slug;
    if (validated.name && validated.name !== icon.name) {
      const candidateSlug = generateSlug(validated.name);
      const existing = (await IconRepo.findBySlug(icon.project_id, candidateSlug));
      if (existing && existing.id !== icon.id) {
        slug = `${candidateSlug}-${Date.now().toString().slice(-4)}`;
      } else {
        slug = candidateSlug;
      }
    }

    const updated = (await IconRepo.update(icon.id, {
          name: validated.name,
          slug,
          folderId: validated.folderId,
          tags: validated.tags,
          codepoint: validated.codepoint !== undefined ? validated.codepoint : undefined,
          svgPath,
          byteSize,
          width,
          height,
          viewBox,
          hasStroke,
          hasGradient,
          hasText
        }));

    res.json({ success: true, data: (await formatIconResponse(updated!)) });
  } catch (err) {
    next(err);
  }
});

// Optimize single icon with SVGO
router.post('/icons/:id/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to modify icons in this project (view-only)');
    }

    const currentSvg = (await StorageService.readIconSvg(icon.svg_path));
    // Save version before optimizing
    (await IconRepo.saveVersion(icon.id, icon.svg_path, icon.byte_size));

    const opt = SvgOptimizer.optimize(currentSvg, {
      multipass: true,
      keepViewBox: true,
      removeDimensions: req.body.removeDimensions !== false
    });

    const saved = (await StorageService.saveIconSvg(icon.project_id, icon.id, opt.optimizedSvg));
    const updated = (await IconRepo.update(icon.id, {
          byteSize: saved.byteSize
        }));

    res.json({
      success: true,
      data: {
        icon: (await formatIconResponse(updated!)),
        savingsPercent: opt.savingsPercent,
        originalSize: opt.originalSize,
        optimizedSize: opt.optimizedSize
      }
    });
  } catch (err) {
    next(err);
  }
});

// Restore previous version of an icon
router.post('/icons/:id/versions/:versionId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to restore icons in this project (view-only)');
    }

    const version = (await IconRepo.getVersionById(req.params.versionId));
    if (!version || version.icon_id !== icon.id) throw new NotFoundError('Version not found');

    const previousSvg = (await StorageService.readIconSvg(version.svg_path));

    // Save current as a version first
    (await IconRepo.saveVersion(icon.id, icon.svg_path, icon.byte_size));

    // Overwrite icon with previous version
    const saved = (await StorageService.saveIconSvg(icon.project_id, icon.id, previousSvg));
    const sanitized = SvgSanitizer.sanitize(previousSvg);

    const updated = (await IconRepo.update(icon.id, {
          byteSize: saved.byteSize,
          width: sanitized.width,
          height: sanitized.height,
          viewBox: sanitized.viewBox,
          hasStroke: sanitized.hasStroke,
          hasGradient: sanitized.hasGradient,
          hasText: sanitized.hasText
        }));

    res.json({ success: true, data: (await formatIconResponse(updated!)) });
  } catch (err) {
    next(err);
  }
});

// Soft delete icon
router.delete('/icons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to delete icons in this project (view-only)');
    }

    const permanent = req.query.permanent === 'true';
    if (permanent) {
      (await StorageService.deleteIconFile(icon.svg_path));
      (await IconRepo.permanentDelete(icon.id));
    } else {
      (await IconRepo.softDelete(req.params.id));
    }
    res.json({ success: true, message: 'Icon deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Restore soft-deleted icon
router.post('/icons/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icon = (await IconRepo.findById(req.params.id));
    if (!icon) throw new NotFoundError('Icon not found');

    const project = (await ProjectRepo.findById(icon.project_id));
    if (project && !Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to restore icons in this project (view-only)');
    }

    (await IconRepo.restore(req.params.id));
    res.json({ success: true, message: 'Icon restored successfully' });
  } catch (err) {
    next(err);
  }
});

// Batch move
router.post('/projects/:projectId/icons/batch/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to modify icons in this project (view-only)');
    }

    const validated = batchMoveIconsSchema.parse(req.body);
    const count = (await IconRepo.batchMove(validated.iconIds, validated.targetFolderId));
    res.json({ success: true, movedCount: count });
  } catch (err) {
    next(err);
  }
});

// Batch tag
router.post('/projects/:projectId/icons/batch/tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to modify icons in this project (view-only)');
    }

    const validated = batchTagIconsSchema.parse(req.body);
    const count = (await IconRepo.batchTag(validated.iconIds, validated.tagsToAdd, validated.tagsToRemove));
    res.json({ success: true, updatedCount: count });
  } catch (err) {
    next(err);
  }
});

// Batch delete (soft or permanent)
router.post('/projects/:projectId/icons/batch/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to delete icons in this project (view-only)');
    }

    const validated = batchDeleteIconsSchema.parse(req.body);
    if (validated.permanent) {
      for (const id of validated.iconIds) {
        const icon = (await IconRepo.findById(id));
        if (icon) (await StorageService.deleteIconFile(icon.svg_path));
      }
      const count = (await IconRepo.permanentDelete(validated.iconIds));
      res.json({ success: true, deletedCount: count });
    } else {
      const count = (await IconRepo.softDelete(validated.iconIds));
      res.json({ success: true, deletedCount: count });
    }
  } catch (err) {
    next(err);
  }
});

// Batch restore
router.post('/projects/:projectId/icons/batch/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to restore icons in this project (view-only)');
    }

    const { iconIds } = req.body;
    if (!Array.isArray(iconIds)) throw new BadRequestError('iconIds must be an array');
    const count = (await IconRepo.restore(iconIds));
    res.json({ success: true, restoredCount: count });
  } catch (err) {
    next(err);
  }
});

// Batch optimize with SVGO
router.post('/projects/:projectId/icons/batch/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to modify icons in this project (view-only)');
    }

    const { iconIds } = req.body;
    if (!Array.isArray(iconIds) || iconIds.length === 0) {
      throw new BadRequestError('iconIds must be a non-empty array');
    }

    let optimizedCount = 0;
    let totalSavingsBytes = 0;

    for (const id of iconIds) {
      const icon = (await IconRepo.findById(id));
      if (!icon) continue;

      const currentSvg = (await StorageService.readIconSvg(icon.svg_path));
      (await IconRepo.saveVersion(icon.id, icon.svg_path, icon.byte_size));

      const opt = SvgOptimizer.optimize(currentSvg, { multipass: true, keepViewBox: true });
      const saved = (await StorageService.saveIconSvg(icon.project_id, icon.id, opt.optimizedSvg));

      (await IconRepo.update(icon.id, { byteSize: saved.byteSize }));
      optimizedCount++;
      totalSavingsBytes += Math.max(0, opt.originalSize - opt.optimizedSize);
    }

    res.json({
      success: true,
      data: {
        optimizedCount,
        totalSavingsBytes,
        savingsKb: (totalSavingsBytes / 1024).toFixed(2)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Empty trash
router.delete('/projects/:projectId/icons/trash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');
    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to empty trash in this project (view-only)');
    }

    const { icons } = (await IconRepo.findMany(req.params.projectId, { includeDeleted: true }));
    for (const icon of icons) {
      (await StorageService.deleteIconFile(icon.svg_path));
    }
    const count = (await IconRepo.emptyTrash(req.params.projectId));
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    next(err);
  }
});

// Import icons from an SVG sprite file or raw sprite markup
router.post('/projects/:projectId/icons/import-sprite', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canAddIcons(req.user, project)) {
      throw new ForbiddenError('You do not have permission to import icons to this project');
    }

    let spriteContent = '';
    if (req.file) {
      spriteContent = req.file.buffer.toString('utf8');
    } else if (req.body.rawSpriteSvg) {
      spriteContent = req.body.rawSpriteSvg;
    } else {
      throw new BadRequestError('SVG sprite file or rawSpriteSvg content is required');
    }

    const folderId = req.body.folderId || null;
    const duplicateStrategy = (req.body.duplicateStrategy || 'rename') as 'rename' | 'replace' | 'skip';
    const autoOptimize = req.body.autoOptimize !== 'false';
    let tags: string[] = [];
    if (req.body.tags) {
      try {
        tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
      } catch {
        tags = [];
      }
    }

    const extracted = ImporterService.extractFromSprite(spriteContent);
    if (extracted.length === 0) {
      throw new BadRequestError('No valid symbols or icons found in the provided SVG sprite');
    }

    const uploadedIcons: IconRecord[] = [];
    const allWarnings: Array<{ name: string; warnings: string[] }> = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const item of extracted) {
      try {
        const result = (await processSvgUpload(project.id, folderId, item.name, item.svgContent, {
                  duplicateStrategy,
                  autoOptimize,
                  tags
                }));
        if (result.icon) uploadedIcons.push(result.icon);
        if (result.warnings.length > 0) allWarnings.push({ name: item.name, warnings: result.warnings });
      } catch (err: any) {
        errors.push({ file: item.name, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        uploaded: await Promise.all(uploadedIcons.map(formatIconResponse)),
        uploadedCount: uploadedIcons.length,
        warnings: allWarnings,
        errors
      }
    });
  } catch (err) {
    next(err);
  }
});

// Import vector glyphs from an icon font file (.ttf, .woff, .woff2, .otf, .svg)
router.post('/projects/:projectId/icons/import-font', upload.fields([
  { name: 'fontFile', maxCount: 1 },
  { name: 'mappingFile', maxCount: 1 }
]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = (await ProjectRepo.findById(req.params.projectId));
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canAddIcons(req.user, project)) {
      throw new ForbiddenError('You do not have permission to import icons to this project');
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const fontFile = files?.['fontFile']?.[0];
    if (!fontFile) {
      throw new BadRequestError('Font file (.ttf, .woff, .woff2, .otf, .svg) is required');
    }

    let mappingContent = req.body.mappingContent || '';
    const mappingFile = files?.['mappingFile']?.[0];
    if (mappingFile) {
      mappingContent = mappingFile.buffer.toString('utf8');
    }

    const folderId = req.body.folderId || null;
    const duplicateStrategy = (req.body.duplicateStrategy || 'rename') as 'rename' | 'replace' | 'skip';
    const autoOptimize = req.body.autoOptimize !== 'false';
    let tags: string[] = [];
    if (req.body.tags) {
      try {
        tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
      } catch {
        tags = [];
      }
    }

    const extracted = await ImporterService.extractFromFont(
      fontFile.buffer,
      fontFile.originalname,
      mappingContent
    );

    if (extracted.length === 0) {
      throw new BadRequestError('No vector glyphs could be extracted from this font file');
    }

    const uploadedIcons: IconRecord[] = [];
    const allWarnings: Array<{ name: string; warnings: string[] }> = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const item of extracted) {
      try {
        const result = (await processSvgUpload(project.id, folderId, item.name, item.svgContent, {
                  duplicateStrategy,
                  autoOptimize,
                  tags
                }));
        if (result.icon) {
          // If extracted codepoint exists, preserve it
          if (item.codepoint) {
            (await IconRepo.update(result.icon.id, { codepoint: item.codepoint.toUpperCase() }));
            result.icon.codepoint = item.codepoint.toUpperCase();
          }
          uploadedIcons.push(result.icon);
        }
        if (result.warnings.length > 0) allWarnings.push({ name: item.name, warnings: result.warnings });
      } catch (err: any) {
        errors.push({ file: item.name, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        uploaded: await Promise.all(uploadedIcons.map(formatIconResponse)),
        uploadedCount: uploadedIcons.length,
        warnings: allWarnings,
        errors
      }
    });
  } catch (err) {
    next(err);
  }
});

// Copy / Import icons from another project into current project (duplicate as new icons, leaving source untouched)
router.post('/projects/:projectId/icons/copy-from-project', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetProject = (await ProjectRepo.findById(req.params.projectId));
    if (!targetProject) throw new NotFoundError('Target project not found');

    if (!Permissions.canAddIcons(req.user, targetProject)) {
      throw new ForbiddenError('You do not have permission to add icons to this project');
    }

    const { sourceProjectId, iconIds, folderId, duplicateStrategy, autoOptimize } = req.body;
    if (!sourceProjectId) throw new BadRequestError('sourceProjectId is required');
    if (!Array.isArray(iconIds) || iconIds.length === 0) {
      throw new BadRequestError('iconIds must be a non-empty array of icon IDs');
    }

    if (sourceProjectId === targetProject.id) {
      throw new BadRequestError('Source project cannot be the same as target project');
    }

    const sourceProject = (await ProjectRepo.findById(sourceProjectId));
    if (!sourceProject) throw new NotFoundError('Source project not found');

    if (sourceProject.visibility !== 'public') {
      throw new ForbiddenError('Icons cannot be imported from private projects. Only public projects can be used as an import source.');
    }

    const strategy = (duplicateStrategy || 'rename') as 'rename' | 'replace' | 'skip';
    const optimize = autoOptimize !== false;
    const targetFolderId = folderId || null;

    const copiedIcons: IconRecord[] = [];
    const errors: Array<{ iconId: string; error: string }> = [];

    for (const id of iconIds) {
      try {
        const sourceIcon = (await IconRepo.findById(id));
        if (!sourceIcon || sourceIcon.project_id !== sourceProjectId) {
          errors.push({ iconId: id, error: 'Icon not found in source project' });
          continue;
        }

        const rawSvg = (await StorageService.readIconSvg(sourceIcon.svg_path));
        let tags: string[] = [];
        try {
          tags = typeof sourceIcon.tags === 'string' ? JSON.parse(sourceIcon.tags) : (Array.isArray(sourceIcon.tags) ? sourceIcon.tags : []);
        } catch {
          tags = [];
        }

        const result = (await processSvgUpload(targetProject.id, targetFolderId, sourceIcon.name, rawSvg, {
                  duplicateStrategy: strategy,
                  autoOptimize: optimize,
                  tags
                }));

        if (result.icon) {
          copiedIcons.push(result.icon);
        }
      } catch (err: any) {
        errors.push({ iconId: id, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        copied: await Promise.all(copiedIcons.map(formatIconResponse)),
        copiedCount: copiedIcons.length,
        errors
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
