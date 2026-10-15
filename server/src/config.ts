import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BASE_DIR, '..');
const DATA_DIR = process.env.DATA_DIR;

const storageDir = process.env.STORAGE_DIR || (DATA_DIR ? path.join(DATA_DIR, 'storage') : path.join(ROOT_DIR, 'storage'));
const projectsDir = path.join(storageDir, 'projects');

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || (DATA_DIR ? path.join(DATA_DIR, 'iconvault.sqlite') : path.join(BASE_DIR, 'iconvault.sqlite')),
  STORAGE_DIR: storageDir,
  PROJECTS_DIR: projectsDir,
  MAX_UPLOAD_SIZE_MB: 25,
  MAX_FILE_COUNT: 200,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

// Ensure critical directories exist
if (!fs.existsSync(storageDir)) {
  try { fs.mkdirSync(storageDir, { recursive: true }); } catch (_) {}
}
if (!fs.existsSync(projectsDir)) {
  try { fs.mkdirSync(projectsDir, { recursive: true }); } catch (_) {}
}
