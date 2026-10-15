import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';

const workspaces = new AsyncLocalStorage<string>();
export const CONFIG = {
  get STORAGE_DIR() { return workspaces.getStore() || path.join(os.tmpdir(), 'iconvault-work'); },
  get PROJECTS_DIR() { return path.join(this.STORAGE_DIR, 'projects'); },
  MAX_UPLOAD_SIZE_MB: 4,
  MAX_FILE_COUNT: 200,
};
// Disk is scratch space for archive/font processing only. Persistent files live in Blobs.
export async function withWorkspace<T>(fn: () => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'iconvault-'));
  try { return await workspaces.run(directory, fn); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
