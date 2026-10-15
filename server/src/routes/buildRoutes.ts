import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { FolderRepo } from '../db/repositories/folderRepo.js';
import { IconRepo, IconRecord } from '../db/repositories/iconRepo.js';
import { BuildRepo } from '../db/repositories/buildRepo.js';
import { StorageService } from '../services/storageService.js';
import { SpriteBuilder } from '../services/spriteBuilder.js';
import { FontBuilder } from '../services/fontBuilder.js';
import { buildSpriteSchema, buildFontSchema } from '../utils/validation.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { Permissions } from '../utils/permissions.js';

const router = Router();

// Helper to resolve icons by scope
function resolveScopeIcons(
  projectId: string,
  scope: 'all' | 'folder' | 'selected',
  folderId?: string | null,
  iconIds?: string[]
): IconRecord[] {
  if (iconIds && iconIds.length > 0) {
    const list: IconRecord[] = [];
    for (const id of iconIds) {
      const icon = IconRepo.findById(id);
      if (icon && icon.project_id === projectId && !icon.deleted_at) {
        list.push(icon);
      }
    }
    return list;
  }

  if (scope === 'folder' && folderId) {
    const descendantIds = FolderRepo.getDescendantFolderIds(folderId);
    const { icons } = IconRepo.findMany(projectId, { folderIds: descendantIds, includeDeleted: false });
    return icons;
  }

  // All active icons in project
  const { icons } = IconRepo.findMany(projectId, { includeDeleted: false });
  return icons;
}

// Build SVG Sprite (viewers can generate and preview/download sprites)
router.post('/projects/:projectId/build/sprite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const validated = buildSpriteSchema.parse(req.body);
    const icons = resolveScopeIcons(project.id, validated.scope, validated.folderId, validated.iconIds);

    if (icons.length === 0) {
      throw new BadRequestError('No icons found in the selected scope');
    }

    // Read SVG content for each icon
    const inputIcons = icons.map(icon => ({
      id: icon.id,
      name: icon.name,
      slug: icon.slug,
      svgContent: StorageService.readIconSvg(icon.svg_path)
    }));

    const result = await SpriteBuilder.build(
      project.id,
      project.prefix,
      inputIcons,
      {
        mode: validated.mode,
        idPattern: validated.idPattern,
        stripColors: validated.stripColors,
        keepViewBox: validated.keepViewBox,
        removeDimensions: validated.removeDimensions,
        svgo: validated.svgo,
        namespaceIds: validated.namespaceIds
      }
    );

    // Save build history
    const buildRecord = BuildRepo.create({
      projectId: project.id,
      type: 'sprite',
      scope: validated.scope,
      options: validated,
      outputPath: result.zipPath,
      iconCount: result.iconCount,
      outputSize: result.spriteSize
    });

    res.json({
      success: true,
      data: {
        buildId: buildRecord.id,
        ...result
      }
    });
  } catch (err) {
    next(err);
  }
});

// Build Icon Font (viewers can generate and preview/download font)
router.post('/projects/:projectId/build/font', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const validated = buildFontSchema.parse(req.body);
    const icons = resolveScopeIcons(project.id, validated.scope, validated.folderId, validated.iconIds);

    if (icons.length === 0) {
      throw new BadRequestError('No icons found in the selected scope');
    }

    // Read SVG content for each icon
    const inputIcons = icons.map(icon => ({
      id: icon.id,
      name: icon.name,
      slug: icon.slug,
      svgContent: StorageService.readIconSvg(icon.svg_path),
      codepoint: icon.codepoint,
      hasStroke: !!icon.has_stroke,
      hasGradient: !!icon.has_gradient,
      hasText: !!icon.has_text
    }));

    const result = await FontBuilder.build(
      project.id,
      inputIcons,
      {
        formats: validated.formats,
        fontName: validated.fontName,
        prefix: validated.prefix,
        baseClass: validated.baseClass,
        startCodepoint: validated.startCodepoint,
        fontHeight: validated.fontHeight,
        descent: validated.descent,
        normalize: validated.normalize
      }
    );

    // Save build history
    const buildRecord = BuildRepo.create({
      projectId: project.id,
      type: 'font',
      scope: validated.scope,
      options: validated,
      outputPath: result.zipPath,
      iconCount: result.iconCount,
      outputSize: result.totalSize
    });

    res.json({
      success: true,
      data: {
        buildId: buildRecord.id,
        ...result
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get build history for a project
router.get('/projects/:projectId/builds', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const type = req.query.type as 'sprite' | 'font' | undefined;
    const builds = BuildRepo.findByProject(req.params.projectId, type);
    res.json({ success: true, data: builds });
  } catch (err) {
    next(err);
  }
});

// Download build ZIP
router.get('/builds/:id/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    const build = BuildRepo.findById(req.params.id);
    if (!build) throw new NotFoundError('Build record not found');

    const project = ProjectRepo.findById(build.project_id);
    if (project && !Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to download its builds');
    }

    if (!fs.existsSync(build.output_path)) {
      throw new NotFoundError('Build package file no longer exists on disk');
    }

    const filename = path.basename(build.output_path);
    res.download(build.output_path, filename);
  } catch (err) {
    next(err);
  }
});

// Delete build record (requires edit or manage)
router.delete('/builds/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const build = BuildRepo.findById(req.params.id);
    if (build) {
      const project = ProjectRepo.findById(build.project_id);
      if (project && !Permissions.canEdit(req.user, project)) {
        throw new ForbiddenError('You do not have permission to delete builds in this project');
      }

      if (fs.existsSync(build.output_path)) {
        try { fs.unlinkSync(build.output_path); } catch {}
      }
      BuildRepo.delete(build.id);
    }
    res.json({ success: true, message: 'Build removed successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
