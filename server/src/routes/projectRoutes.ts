import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { FolderRepo } from '../db/repositories/folderRepo.js';
import { IconRepo } from '../db/repositories/iconRepo.js';
import { StorageService } from '../services/storageService.js';
import { createProjectSchema, updateProjectSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { Permissions } from '../utils/permissions.js';
import { UserRepo } from '../db/repositories/userRepo.js';

const router = Router();

// List all projects accessible to the current user
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as 'all' | 'active' | 'archived' | undefined;
    const visibility = req.query.visibility as 'all' | 'public' | 'private' | undefined;
    const sort = req.query.sort as string | undefined;

    const projects = ProjectRepo.findAll({
      user: req.user,
      search,
      status,
      visibility,
      sort
    });
    res.json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
});

// Get single project (enforcing canView)
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const folders = FolderRepo.findByProject(project.id);
    const { total: iconCount, icons: sampleIconRecords } = IconRepo.findMany(project.id, { limit: 5, includeDeleted: false });
    const { total: trashCount } = IconRepo.findMany(project.id, { includeDeleted: true });

    const sample_icons = sampleIconRecords.map(icon => {
      let rawSvg = '';
      try {
        rawSvg = StorageService.readIconSvg(icon.svg_path);
      } catch {
        rawSvg = '';
      }
      return {
        id: icon.id,
        name: icon.name,
        rawSvg
      };
    });

    res.json({
      success: true,
      data: {
        ...project,
        can_add_icons: Permissions.canAddIcons(req.user, project),
        can_edit: Permissions.canEdit(req.user, project),
        can_manage: Permissions.canManage(req.user, project),
        folderCount: folders.length,
        iconCount,
        trashCount,
        sample_icons
      }
    });
  } catch (err) {
    next(err);
  }
});

// Create project
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createProjectSchema.parse(req.body);
    const created = ProjectRepo.create({
      owner_id: req.user?.id || null,
      name: validated.name,
      description: validated.description,
      purpose: validated.purpose,
      prefix: validated.prefix,
      color: validated.color,
      visibility: validated.visibility,
      public_access: validated.publicAccess,
      settings_json: validated.settings ? JSON.stringify(validated.settings) : undefined
    });

    // Ensure storage directories
    StorageService.initProjectStorage(created.id);

    res.status(201).json({
      success: true,
      data: {
        ...created,
        can_add_icons: true,
        can_edit: true,
        can_manage: true
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update project (enforcing permissions)
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.id);
    if (!project) throw new NotFoundError('Project not found');

    const canManage = Permissions.canManage(req.user, project);
    const canEdit = Permissions.canEdit(req.user, project);

    if (!canEdit && !canManage) {
      throw new ForbiddenError('You do not have permission to edit this project');
    }

    const validated = updateProjectSchema.parse(req.body);

    // If changing name, visibility, public_access, or archiving, require canManage
    if (
      (validated.name !== undefined ||
        validated.visibility !== undefined ||
        validated.publicAccess !== undefined ||
        validated.isArchived !== undefined) &&
      !canManage
    ) {
      throw new ForbiddenError('Only the project owner or an administrator can change project settings or visibility');
    }

    const updated = ProjectRepo.update(req.params.id, {
      name: validated.name,
      description: validated.description,
      prefix: validated.prefix,
      color: validated.color,
      visibility: validated.visibility,
      public_access: validated.publicAccess,
      is_archived: validated.isArchived !== undefined ? (validated.isArchived ? 1 : 0) : undefined,
      settings_json: validated.settings ? JSON.stringify(validated.settings) : undefined
    });

    if (!updated) throw new NotFoundError('Project not found');
    res.json({
      success: true,
      data: {
        ...updated,
        can_add_icons: Permissions.canAddIcons(req.user, updated),
        can_edit: Permissions.canEdit(req.user, updated),
        can_manage: Permissions.canManage(req.user, updated)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Delete project (owner or admin only)
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canManage(req.user, project)) {
      throw new ForbiddenError('Only the project owner or an administrator can delete this project');
    }

    ProjectRepo.delete(req.params.id);
    StorageService.deleteProjectStorage(req.params.id);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Bulk delete projects (admin only)
router.post('/bulk-delete', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Only administrators can perform bulk project deletions');
    }

    const { projectIds } = req.body;
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      throw new BadRequestError('projectIds array is required');
    }

    let deletedCount = 0;
    for (const id of projectIds) {
      const p = ProjectRepo.findById(id);
      if (p) {
        ProjectRepo.delete(id);
        StorageService.deleteProjectStorage(id);
        deletedCount++;
      }
    }

    res.json({
      success: true,
      data: { deletedCount },
      message: `Successfully deleted ${deletedCount} project(s)`
    });
  } catch (err) {
    next(err);
  }
});

// Bulk transfer projects ownership (admin only)
router.post('/bulk-transfer', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Only administrators can perform bulk transfer of projects');
    }

    const { projectIds, newOwnerId } = req.body;
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      throw new BadRequestError('projectIds array is required');
    }
    if (!newOwnerId || typeof newOwnerId !== 'string') {
      throw new BadRequestError('newOwnerId is required');
    }

    const targetUser = UserRepo.findById(newOwnerId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    const transferredCount = ProjectRepo.bulkTransfer(projectIds, targetUser.id);

    res.json({
      success: true,
      data: {
        transferredCount,
        newOwnerId: targetUser.id,
        newOwnerName: targetUser.name,
        newOwnerEmail: targetUser.email
      },
      message: `Successfully transferred ${transferredCount} project(s) to ${targetUser.name}`
    });
  } catch (err) {
    next(err);
  }
});

// Transfer project ownership to another user (owner or admin only)
router.post('/:id/transfer', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canManage(req.user, project)) {
      throw new ForbiddenError('Only the project owner or an administrator can transfer this project');
    }

    const { newOwnerId } = req.body;
    if (!newOwnerId) {
      throw new BadRequestError('newOwnerId is required');
    }

    const targetUser = UserRepo.findById(newOwnerId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    const updated = ProjectRepo.update(req.params.id, {
      owner_id: targetUser.id
    });

    res.json({
      success: true,
      data: {
        ...updated,
        owner_name: targetUser.name,
        owner_email: targetUser.email
      },
      message: `Project transferred to ${targetUser.name} successfully`
    });
  } catch (err) {
    next(err);
  }
});

// Duplicate project
router.post('/:id/duplicate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('You do not have permission to duplicate this project');
    }

    const newProject = ProjectRepo.create({
      owner_id: req.user?.id || null,
      name: `${project.name} (Copy)`,
      description: project.description,
      prefix: project.prefix,
      color: project.color,
      purpose: project.purpose,
      visibility: 'private', // Duplicates start private by default
      public_access: 'view',
      settings_json: project.settings_json
    });

    StorageService.initProjectStorage(newProject.id);

    // Duplicate folders
    const oldFolders = FolderRepo.findByProject(project.id);
    const folderIdMap = new Map<string, string>();

    // Duplicate root folders then child folders
    for (const folder of oldFolders) {
      const newFolder = FolderRepo.create({
        projectId: newProject.id,
        parentId: folder.parent_id ? folderIdMap.get(folder.parent_id) || null : null,
        name: folder.name,
        orderIndex: folder.order_index
      });
      folderIdMap.set(folder.id, newFolder.id);
    }

    // Duplicate active icons
    const { icons } = IconRepo.findMany(project.id, { includeDeleted: false });
    for (const icon of icons) {
      try {
        const svgContent = StorageService.readIconSvg(icon.svg_path);
        const { filePath, byteSize } = StorageService.saveIconSvg(newProject.id, crypto.randomUUID(), svgContent);
        const targetFolderId = icon.folder_id ? folderIdMap.get(icon.folder_id) || null : null;

        let tags: string[] = [];
        try { tags = JSON.parse(icon.tags || '[]'); } catch {}

        IconRepo.create({
          projectId: newProject.id,
          folderId: targetFolderId,
          name: icon.name,
          slug: icon.slug,
          svgPath: filePath,
          tags,
          byteSize,
          originalByteSize: icon.original_byte_size,
          codepoint: icon.codepoint,
          width: icon.width,
          height: icon.height,
          viewBox: icon.view_box,
          hasStroke: !!icon.has_stroke,
          hasGradient: !!icon.has_gradient,
          hasText: !!icon.has_text
        });
      } catch (err) {
        console.warn(`Failed to duplicate icon ${icon.name}:`, err);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...newProject,
        can_edit: true,
        can_manage: true
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
