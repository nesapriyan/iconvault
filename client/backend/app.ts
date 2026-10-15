import express from 'express';
import cors from 'cors';
import projectRoutes from './routes/projectRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import iconRoutes from './routes/iconRoutes.js';
import buildRoutes from './routes/buildRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { errorHandler } from './utils/errors.js';
import type { UserRecord } from './db/repositories/userRepo.js';

export function createApp(user?: UserRecord) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));
  app.use((req, _res, next) => { req.user = user; next(); });
  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok', app: 'IconVault API' } }));
  // Public projects can be viewed anonymously; writes require an Identity session.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.user) {
      res.status(401).json({ success: false, error: { message: 'Please sign in to continue' } });
      return;
    }
    next();
  });
  app.use('/api/auth', authRoutes());
  app.use('/api/users', userRoutes());
  app.use('/api/projects', projectRoutes);
  app.use('/api', folderRoutes, iconRoutes, buildRoutes, exportRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: { message: 'API endpoint not found' } }));
  app.use('/storage', (_req, res) => res.status(404).json({ success: false, error: { message: 'Use the icon or build download endpoint' } }));
  app.use(errorHandler);
  return app;
}
