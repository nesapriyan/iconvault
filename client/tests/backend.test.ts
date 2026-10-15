import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import request from 'supertest';
import AdmZip from 'adm-zip';

const state = vi.hoisted(() => ({ db: undefined as any, identity: null as any, files: new Map<string, string | Blob>() }));
vi.mock('@netlify/identity', () => ({ getUser: async () => state.identity, admin: {} }));
vi.mock('../db/index.js', () => ({ database: () => state.db }));
vi.mock('@netlify/blobs', () => ({ getStore: () => ({
  set: async (key: string, value: string | Blob) => { state.files.set(key, value); },
  get: async (key: string, options?: { type: string }) => {
    const value = state.files.get(key);
    if (value === undefined) return null;
    if (options?.type === 'arrayBuffer') return typeof value === 'string' ? new TextEncoder().encode(value).buffer : value.arrayBuffer();
    return typeof value === 'string' ? value : value.text();
  },
  delete: async (key: string) => { state.files.delete(key); },
  list: async ({ prefix }: { prefix: string }) => ({ blobs: [...state.files.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
}) }));

import netlifyApi from '../netlify/functions/api.mts';
import { createApp } from '../backend/app.js';
import { UserRepo } from '../backend/db/repositories/userRepo.js';
import { CONFIG } from '../backend/config.js';

const pg = new PGlite();
const ownerIdentity = { id: 'owner-id', email: 'owner@example.test', name: 'Owner' };
const otherIdentity = { id: 'other-id', email: 'other@example.test', name: 'Other' };
let owner: any;
let other: any;
let projectId: string;
let iconId: string;
function binaryParser(res: any, callback: any) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';

function wrap(db: any): any {
  return {
    execute: async (query: any) => {
      const result = await db.execute(query);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
    transaction: (fn: any) => db.transaction((tx: any) => fn(wrap(tx))),
  };
}
beforeAll(async () => {
  // Run the generated production schema against isolated PostgreSQL used only by these tests.
  for (const dir of readdirSync('netlify/database/migrations').sort()) {
    await pg.exec(readFileSync(`netlify/database/migrations/${dir}/migration.sql`, 'utf8'));
  }
  state.db = wrap(drizzle({ client: pg }));
  owner = await UserRepo.sync(ownerIdentity);
  other = await UserRepo.sync(otherIdentity);
}, 30000);
afterAll(async () => { await pg.close(); rmSync(CONFIG.STORAGE_DIR, { recursive: true, force: true }); });

describe('Netlify backend migration', () => {
  it('serves JSON health, unknown API routes, and an empty project list', async () => {
    await request(createApp()).get('/api/health').expect('Content-Type', /json/).expect(200);
    await request(createApp()).get('/api/missing').expect('Content-Type', /json/).expect(404);
    const list = await request(createApp()).get('/api/projects').expect(200);
    expect(list.body.data).toEqual([]);
  });
  it('requires a real session for writes and administrator actions', async () => {
    await request(createApp()).post('/api/projects').send({ name: 'No session' }).expect(401);
    await request(createApp()).get('/api/auth/me').expect(401);
    await request(createApp(owner)).get('/api/users').expect(403);
    await request(createApp(owner)).post('/api/auth/switch-user').send({ userId: other.id }).expect(403);
  });
  it('creates and lists projects with PostgreSQL counts and owner permissions', async () => {
    const created = await request(createApp(owner)).post('/api/projects').send({ name: "Owner's icons", visibility: 'private' }).expect(201);
    projectId = created.body.data.id;
    const list = await request(createApp(owner)).get('/api/projects').expect(200);
    expect(list.body.data[0]).toMatchObject({ id: projectId, icon_count: 0, can_manage: true });
    const publicList = await request(createApp()).get('/api/projects').expect(200);
    expect(publicList.body.data).toHaveLength(0);
    await request(createApp(other)).get(`/api/projects/${projectId}`).expect(403);
  });
  it('stores uploaded SVGs in Blobs and reads them in another app instance', async () => {
    const uploaded = await request(createApp(owner)).post(`/api/projects/${projectId}/icons/upload`)
      .attach('files', Buffer.from(svg), 'square.svg').expect(201);
    expect(uploaded.body.data.uploadedCount).toBe(1);
    iconId = uploaded.body.data.uploaded[0].id;
    expect(uploaded.body.data.uploaded[0].rawSvg).toContain('<svg');
    const list = await request(createApp(owner)).get(`/api/projects/${projectId}/icons`).expect(200);
    expect(list.body.data.icons[0].id).toBe(iconId);
    expect(typeof list.body.data.total).toBe('number');
    const downloaded = await request(createApp(owner)).get(`/api/icons/${iconId}/download`).expect(200);
    expect(downloaded.headers['content-type']).toMatch(/svg/);
    await request(createApp(other)).get(`/api/icons/${iconId}/download`).expect(403);
  });
  it('commits batch tag transactions before returning', async () => {
    const tagged = await request(createApp(owner)).post(`/api/projects/${projectId}/icons/batch/tag`)
      .send({ iconIds: [iconId], tagsToAdd: ['Saved'] }).expect(200);
    expect(tagged.body.updatedCount).toBe(1);
    const icon = await request(createApp(owner)).get(`/api/icons/${iconId}`).expect(200);
    expect(icon.body.data.tags).toEqual(['saved']);
  });
  it('builds sprites and downloads persisted ZIPs after temporary files are removed', async () => {
    const built = await request(createApp(owner)).post(`/api/projects/${projectId}/build/sprite`).send({}).expect(200);
    expect(built.body.data.spriteSvg).toContain('<symbol');
    rmSync(CONFIG.STORAGE_DIR, { recursive: true, force: true });
    const downloaded = await request(createApp(owner)).get(`/api/builds/${built.body.data.buildId}/download`).buffer(true).parse(binaryParser).expect(200);
    expect(downloaded.headers['content-type']).toContain('application/zip');
    expect(new AdmZip(downloaded.body).getEntries().length).toBeGreaterThan(0);
  });
  it('exports and imports projects with Blob-backed SVG files', async () => {
    const exported = await request(createApp(owner)).get(`/api/projects/${projectId}/export`).buffer(true).parse(binaryParser).expect(200);
    const zip = new AdmZip(exported.body);
    expect(zip.getEntries().some(entry => entry.entryName.endsWith('.svg'))).toBe(true);
    const imported = await request(createApp(owner)).post('/api/projects/import')
      .attach('file', exported.body, 'icons.zip').expect(201);
    const icons = await request(createApp(owner)).get(`/api/projects/${imported.body.data.id}/icons`).expect(200);
    expect(icons.body.data.total).toBe(1);
  });
  it('builds fonts and persists the downloadable package', async () => {
    const built = await request(createApp(owner)).post(`/api/projects/${projectId}/build/font`)
      .send({ formats: ['ttf', 'woff', 'woff2'] }).expect(200);
    expect(built.body.data.codepoints).toHaveLength(1);
    await request(createApp(owner)).get(`/api/builds/${built.body.data.buildId}/download`).buffer(true).parse(binaryParser).expect(200);
  }, 30000);
  it('serves real Request/Response API calls through the Netlify adapter', async () => {
    state.identity = ownerIdentity;
    const list = await netlifyApi(new Request('https://example.test/api/projects?status=active'));
    expect(list.status).toBe(200);
    expect((await list.json()).data.some((project: any) => project.id === projectId)).toBe(true);
    const health = await netlifyApi(new Request('https://example.test/api/health'));
    expect(health.headers.get('content-type')).toContain('application/json');
    const form = new FormData();
    form.append('files', new File([svg], 'adapter.svg', { type: 'image/svg+xml' }));
    const uploaded = await netlifyApi(new Request(`https://example.test/api/projects/${projectId}/icons/upload`, {
      method: 'POST', body: form,
    }));
    expect(uploaded.status).toBe(201);
    expect((await uploaded.json()).data.uploadedCount).toBe(1);
    const built = await netlifyApi(new Request(`https://example.test/api/projects/${projectId}/build/sprite`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }));
    expect(built.status).toBe(200);
    const buildId = (await built.json()).data.buildId;
    const download = await netlifyApi(new Request(`https://example.test/api/builds/${buildId}/download`));
    expect(download.status).toBe(200);
    expect(new AdmZip(Buffer.from(await download.arrayBuffer())).getEntries().length).toBeGreaterThan(0);
    state.identity = null;
    const denied = await netlifyApi(new Request('https://example.test/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Anonymous' }),
    }));
    expect(denied.status).toBe(401);
    const oversized = await netlifyApi(new Request('https://example.test/api/projects/import', {
      method: 'POST', body: new Uint8Array(4 * 1024 * 1024 + 1),
    }));
    expect(oversized.status).toBe(413);
  });
  it('supports folders, versions, trash, restore, and deletion', async () => {
    const folder = await request(createApp(owner)).post(`/api/projects/${projectId}/folders`).send({ name: 'Shapes' }).expect(201);
    await request(createApp(owner)).put(`/api/icons/${iconId}`).send({ folderId: folder.body.data.id, rawSvg: svg }).expect(200);
    await request(createApp(owner)).get(`/api/projects/${projectId}/folders`).expect(200);
    const icon = await request(createApp(owner)).get(`/api/icons/${iconId}`).expect(200);
    expect(icon.body.data.versions.length).toBeGreaterThan(0);
    await request(createApp(owner)).delete(`/api/icons/${iconId}`).expect(200);
    await request(createApp(owner)).post(`/api/icons/${iconId}/restore`).expect(200);
    await request(createApp(owner)).delete(`/api/projects/${projectId}`).expect(200);
    expect([...state.files.keys()].some(key => key.startsWith(`projects/${projectId}/`))).toBe(false);
  });
});
