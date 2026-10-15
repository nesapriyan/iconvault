import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('IconVault REST API', () => {
  let createdProjectId = '';
  let createdFolderId = '';

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/projects should create a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({
        name: 'API Test Project',
        description: 'Created during integration testing',
        prefix: 'apitest',
        color: '#8b5cf6'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('API Test Project');
    expect(res.body.data.prefix).toBe('apitest');
    createdProjectId = res.body.data.id;
  });

  it('GET /api/projects/:id should fetch project details', async () => {
    const res = await request(app).get(`/api/projects/${createdProjectId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdProjectId);
  });

  it('POST /api/projects/:id/folders should create a folder', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/folders`)
      .send({
        name: 'Icons Folder'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Icons Folder');
    createdFolderId = res.body.data.id;
  });

  it('POST /api/projects/:id/icons/paste should upload raw SVG', async () => {
    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>`;
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/icons/paste`)
      .send({
        name: 'Triangle',
        folderId: createdFolderId,
        rawSvg: sampleSvg,
        tags: ['geometry', 'math']
      });

    expect(res.status).toBe(201);
    expect(res.body.data.icon.name).toBe('Triangle');
    expect(res.body.data.icon.folder_id).toBe(createdFolderId);
  });

  it('POST /api/projects/:id/build/sprite should build a sprite', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/build/sprite`)
      .send({
        scope: 'all',
        mode: 'symbol'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.iconCount).toBe(1);
    expect(res.body.data.spriteSvg).toContain('<symbol');
  });

  it('POST /api/projects/:id/icons/copy-from-project should copy icons from source project to target without moving', async () => {
    // Create second target project
    const targetProjRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Destination Workspace', prefix: 'dest' });
    const targetProjectId = targetProjRes.body.data.id;

    // Get source icons
    const sourceIconsRes = await request(app).get(`/api/projects/${createdProjectId}/icons`);
    const sourceIcon = sourceIconsRes.body.data.icons[0];
    expect(sourceIcon).toBeDefined();

    // Copy to destination
    const copyRes = await request(app)
      .post(`/api/projects/${targetProjectId}/icons/copy-from-project`)
      .send({
        sourceProjectId: createdProjectId,
        iconIds: [sourceIcon.id],
        duplicateStrategy: 'rename'
      });

    expect(copyRes.status).toBe(201);
    expect(copyRes.body.data.copiedCount).toBe(1);
    expect(copyRes.body.data.copied[0].name).toBe('Triangle');
    expect(copyRes.body.data.copied[0].id).not.toBe(sourceIcon.id);

    // Verify source project still contains original icon untouched
    const verifySource = await request(app).get(`/api/projects/${createdProjectId}/icons`);
    expect(verifySource.body.data.icons.length).toBe(1);
    expect(verifySource.body.data.icons[0].id).toBe(sourceIcon.id);

    // Verify target project has its own copied icon
    const verifyTarget = await request(app).get(`/api/projects/${targetProjectId}/icons`);
    expect(verifyTarget.body.data.icons.length).toBe(1);
    expect(verifyTarget.body.data.icons[0].name).toBe('Triangle');

    // Clean up target project
    await request(app).delete(`/api/projects/${targetProjectId}`);
  });

  it('GET /api/icons/:id/download should download individual icon SVG', async () => {
    const iconsRes = await request(app).get(`/api/projects/${createdProjectId}/icons`);
    const icon = iconsRes.body.data.icons[0];

    const res = await request(app).get(`/api/icons/${icon.id}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    const content = res.text || (res.body ? res.body.toString() : '');
    expect(content).toContain('<svg');
  });

  it('POST /api/projects/:id/icons/download should download selected icons', async () => {
    const iconsRes = await request(app).get(`/api/projects/${createdProjectId}/icons`);
    const icon = iconsRes.body.data.icons[0];

    // Single icon -> SVG
    const singleRes = await request(app)
      .post(`/api/projects/${createdProjectId}/icons/download`)
      .send({ iconIds: [icon.id] });
    expect(singleRes.status).toBe(200);
    expect(singleRes.headers['content-type']).toContain('image/svg+xml');

    // Add another icon to test ZIP download
    const secondIcon = await request(app)
      .post(`/api/projects/${createdProjectId}/icons/paste`)
      .send({
        name: 'Circle',
        rawSvg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`
      });

    // Multiple icons -> ZIP
    const multiRes = await request(app)
      .post(`/api/projects/${createdProjectId}/icons/download`)
      .send({ iconIds: [icon.id, secondIcon.body.data.icon.id] });
    expect(multiRes.status).toBe(200);
    expect(multiRes.headers['content-type']).toContain('application/zip');
    expect(multiRes.headers['content-disposition']).toContain('-icons.zip');
  });

  it('DELETE /api/projects/:id should delete project and storage', async () => {
    const res = await request(app).delete(`/api/projects/${createdProjectId}`);
    expect(res.status).toBe(200);
  });
});
