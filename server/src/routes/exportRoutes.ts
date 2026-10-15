import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ExportImportService } from '../services/exportImport.js';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { Permissions } from '../utils/permissions.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max for project import
});

// Export project as ZIP (enforcing canView)
router.get('/projects/:projectId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = ProjectRepo.findById(req.params.projectId);
    if (!project) throw new NotFoundError('Project not found');

    if (!Permissions.canView(req.user, project)) {
      throw new ForbiddenError('This project is private and you do not have permission to export it');
    }

    const { zipPath, fileName } = await ExportImportService.exportProject(req.params.projectId);
    res.download(zipPath, fileName);
  } catch (err) {
    next(err);
  }
});

// Import project from ZIP
router.post('/projects/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestError('ZIP file is required for project import');
    }

    const overrideName = req.body.name as string | undefined;
    const project = await ExportImportService.importProject(req.file.buffer, overrideName);

    // Set owner to current user
    if (req.user && project) {
      ProjectRepo.update(project.id, { owner_id: req.user.id });
      project.owner_id = req.user.id;
    }

    res.status(201).json({
      success: true,
      data: project,
      message: 'Project imported successfully'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
