import fs from 'node:fs';
import path from 'node:path';
import { getStore } from '@netlify/blobs';
import { CONFIG } from '../config.js';
import { BadRequestError } from '../utils/errors.js';

function store() {
  // New uploads are immediately read back for previews and processing.
  return getStore({ name: 'iconvault-files', consistency: 'strong' });
}
export const StorageService = {
  initProjectStorage(projectId: string) {
    const projectDir = this.safePath(CONFIG.PROJECTS_DIR, projectId);
    const iconsDir = path.join(projectDir, 'icons');
    const versionsDir = path.join(projectDir, 'versions');
    const buildsDir = path.join(projectDir, 'builds');
    for (const dir of [iconsDir, versionsDir, buildsDir]) fs.mkdirSync(dir, { recursive: true });
    return { projectDir, iconsDir, versionsDir, buildsDir };
  },
  safePath(baseDir: string, name: string): string {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, name);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new BadRequestError('Invalid file path');
    return resolved;
  },
  async saveIconSvg(projectId: string, iconId: string, content: string) {
    const filePath = `projects/${projectId}/icons/${iconId}.svg`;
    await store().set(filePath, content);
    return { filePath, byteSize: Buffer.byteLength(content) };
  },
  async readIconSvg(filePath: string): Promise<string> {
    const content = await store().get(filePath, { type: 'text' });
    if (content === null) throw new BadRequestError('Icon file not found');
    return content;
  },
  async saveVersionSnapshot(projectId: string, versionId: string, content: string) {
    const filePath = `projects/${projectId}/versions/${versionId}.svg`;
    await store().set(filePath, content);
    return { filePath, byteSize: Buffer.byteLength(content) };
  },
  async deleteIconFile(filePath: string): Promise<void> { await store().delete(filePath); },
  async deleteProjectStorage(projectId: string): Promise<void> {
    const { blobs } = await store().list({ prefix: `projects/${projectId}/` });
    for (const blob of blobs) await store().delete(blob.key);
  },
  async persistBuild(projectId: string, filePath: string): Promise<string> {
    const key = `projects/${projectId}/builds/${path.basename(filePath)}`;
    await store().set(key, new Blob([fs.readFileSync(filePath)]));
    return key;
  },
  async readBuild(key: string): Promise<Buffer | null> {
    const content = await store().get(key, { type: 'arrayBuffer' });
    return content === null ? null : Buffer.from(content);
  },
};
