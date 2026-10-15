import { Router, Request, Response, NextFunction } from 'express';
import { FolderRepo } from '../db/repositories/folderRepo.js';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { createFolderSchema, updateFolderSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { Permissions } from '../utils/permissions.js';

const router = Router();

// Get all folders for a project (enforcing canView)
router.get('/projects/:projectId/folders', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to view it');
    }

    const folders = FolderRepo.findByProject(project.id);
    res.json({ success: true, data: folders });
  } catch (err) {
    next(err);
  }
});

// Create folder in project (enforcing canEdit)
router.post('/projects/:projectId/folders', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to create folders in this project (view-only)');
    }

    const validated = createFolderSchema.parse(req.body);
    const created = FolderRepo.create({
      projectId: project.id,
      parentId: validated.parentId,
      name: validated.name,
      orderIndex: validated.orderIndex
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// Update folder (enforcing canEdit)
router.put('/folders/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = FolderRepo.findById(req.params.id);
    if (!folder) throw new NotFoundError('Folder not found');

    const project = ProjectRepo.findById(folder.project_id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to modify folders in this project');
    }

    const validated = updateFolderSchema.parse(req.body);
    const updated = FolderRepo.update(req.params.id, {
      name: validated.name,
      parentId: validated.parentId,
      orderIndex: validated.orderIndex
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Move folder (enforcing canEdit)
router.post('/folders/:id/move', (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = FolderRepo.findById(req.params.id);
    if (!folder) throw new NotFoundError('Folder not found');

    const project = ProjectRepo.findById(folder.project_id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to move folders in this project');
    }

    const { parentId, orderIndex } = req.body;
    const updated = FolderRepo.update(req.params.id, {
      parentId: parentId !== undefined ? parentId : null,
      orderIndex: typeof orderIndex === 'number' ? orderIndex : undefined
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Delete folder (enforcing canEdit)
router.delete('/folders/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = FolderRepo.findById(req.params.id);
    if (!folder) throw new NotFoundError('Folder not found');

    const project = ProjectRepo.findById(folder.project_id);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canEdit(req.user, project)) {
      throw new ForbiddenError('You do not have permission to delete folders in this project');
    }

    FolderRepo.delete(req.params.id);
    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
