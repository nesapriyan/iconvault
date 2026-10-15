import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { errorHandler } from './utils/errors.js';

import projectRoutes from './routes/projectRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import iconRoutes from './routes/iconRoutes.js';
import buildRoutes from './routes/buildRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { authenticate } from './middlewares/auth.js';

const app = express();

// Initialize database
getDatabase();

// Middlewares
app.use(cors({
  origin: CONFIG.CORS_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Attach user context to all requests
app.use(authenticate);

// Serve storage directory for local asset previews if needed
if (fs.existsSync(CONFIG.STORAGE_DIR)) {
  app.use('/storage', express.static(CONFIG.STORAGE_DIR));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'IconVault API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', folderRoutes);
app.use('/api', iconRoutes);
app.use('/api', buildRoutes);
app.use('/api', exportRoutes);

// In production, serve the built frontend assets
const clientDistCandidates = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), '../client/dist')
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p)) || clientDistCandidates[0];
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

// Start server only when not running in test mode
let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(CONFIG.PORT, () => {
    console.log(`[IconVault Server] running at http://localhost:${CONFIG.PORT}`);
    console.log(`[IconVault Server] Storage directory: ${CONFIG.STORAGE_DIR}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[IconVault Server] Shutting down gracefully...');
  if (server) {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n[IconVault Server] SIGTERM received. Shutting down...');
  if (server) {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
});

export default app;
