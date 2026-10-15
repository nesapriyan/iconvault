import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getDatabase } from '../src/db/connection.js';
import { UserRepo } from '../src/db/repositories/userRepo.js';
import authRoutes from '../src/routes/authRoutes.js';
import userRoutes from '../src/routes/userRoutes.js';
import projectRoutes from '../src/routes/projectRoutes.js';
import iconRoutes from '../src/routes/iconRoutes.js';
import folderRoutes from '../src/routes/folderRoutes.js';
import { authenticate } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/utils/errors.js';

const app = express();
app.use(express.json());
app.use(authenticate);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', folderRoutes);
app.use('/api', iconRoutes);
app.use(errorHandler);

describe('Authentication & User Management Module', () => {
  let adminToken = '';
  let memberToken = '';
  let secondMemberToken = '';
  let testMemberId = '';

  beforeAll(async () => {
    getDatabase();
    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@iconvault.local', password: 'admin123' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;
    expect(adminLogin.body.data.user.role).toBe('admin');

    // Login as member
    const memberLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@iconvault.local', password: 'member123' });
    expect(memberLogin.status).toBe(200);
    memberToken = memberLogin.body.data.token;
    expect(memberLogin.body.data.user.role).toBe('user');
  });

  it('GET /api/auth/me should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@iconvault.local');
    expect(res.body.data.role).toBe('admin');
  });

  it('User Management: Admin can view all users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('User Management: Non-admin gets 403 Forbidden when accessing /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Administrator');
  });

  it('User Management: Admin can create a new user', async () => {
    const devEmail = `developer2-${Date.now()}@iconvault.local`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: devEmail,
        name: 'Developer Two',
        password: 'password123',
        role: 'user'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(devEmail);
    testMemberId = res.body.data.id;

    // Login as the newly created user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: devEmail, password: 'password123' });
    expect(loginRes.status).toBe(200);
    secondMemberToken = loginRes.body.data.token;
  });

  it('User Management: Admin can edit a user and delete a user', async () => {
    // Edit
    const editRes = await request(app)
      .put(`/api/users/${testMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Developer Two Updated' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.name).toBe('Developer Two Updated');

    // Delete
    const delRes = await request(app)
      .delete(`/api/users/${testMemberId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
  });
});

describe('Project Visibility & Permission Enforcement', () => {
  let adminToken = '';
  let member1Token = '';
  let member2Token = '';
  let privateProjectId = '';
  let publicProjectId = '';
  let starIconId = '';
  let privateIconId = '';

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@iconvault.local', password: 'admin123' });
    adminToken = adminRes.body.data.token;

    // Member 1 login
    const m1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@iconvault.local', password: 'member123' });
    member1Token = m1Res.body.data.token;

    // Register Member 2
    const aliceEmail = `alice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}@iconvault.local`;
    const m2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: aliceEmail,
        name: 'Alice Designer',
        password: 'securepassword123'
      });
    member2Token = m2Res.body.data.token;

    // Member 1 creates a PRIVATE project with an icon
    const proj1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        name: 'Secret Private Project',
        visibility: 'private',
        prefix: 'sec'
      });
    privateProjectId = proj1.body.data.id;

    // Add icon to private project
    const privIconRes = await request(app)
      .post(`/api/projects/${privateProjectId}/icons/paste`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        name: 'Lock Icon',
        rawSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
      });
    privateIconId = privIconRes.body.data.icon.id;

    // Member 1 creates a PUBLIC project with an icon
    const proj2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        name: 'Public Design System',
        visibility: 'public',
        prefix: 'ds'
      });
    publicProjectId = proj2.body.data.id;

    const pubIconRes = await request(app)
      .post(`/api/projects/${publicProjectId}/icons/paste`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        name: 'Shared Star',
        rawSvg: '<svg viewBox="0 0 24 24"><polygon points="12 2 15 8 22 9 17 14 18 21 12 17 6 21 7 14 2 9 9 8 12 2"/></svg>'
      });
    starIconId = pubIconRes.body.data.icon.id;
  });

  it('Private Project: Owner and Admin can view, but another user gets 403 Forbidden', async () => {
    // Owner can view
    const ownerRes = await request(app)
      .get(`/api/projects/${privateProjectId}`)
      .set('Authorization', `Bearer ${member1Token}`);
    expect(ownerRes.status).toBe(200);

    // Admin can view
    const adminRes = await request(app)
      .get(`/api/projects/${privateProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);

    // Member 2 gets 403 Forbidden
    const otherRes = await request(app)
      .get(`/api/projects/${privateProjectId}`)
      .set('Authorization', `Bearer ${member2Token}`);
    expect(otherRes.status).toBe(403);
    expect(otherRes.body.error.message).toContain('private');
  });

  it('Private Project: Hidden from another user project listing', async () => {
    const listRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${member2Token}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((p: any) => p.id);
    expect(ids).not.toContain(privateProjectId);
    expect(ids).toContain(publicProjectId);
  });

  it('Public Project: Any member CAN view and add icons, but CANNOT edit existing icons or folders', async () => {
    // Can view
    const viewRes = await request(app)
      .get(`/api/projects/${publicProjectId}`)
      .set('Authorization', `Bearer ${member2Token}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.can_add_icons).toBe(true);
    expect(viewRes.body.data.can_edit).toBe(false);
    expect(viewRes.body.data.can_manage).toBe(false);

    // CAN upload / paste a new icon
    const uploadRes = await request(app)
      .post(`/api/projects/${publicProjectId}/icons/paste`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({
        name: 'Community Icon by Alice',
        rawSvg: '<svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="5"/></svg>'
      });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.icon.name).toBe('Community Icon by Alice');

    // CANNOT modify an existing icon (creator only!)
    const updateRes = await request(app)
      .put(`/api/icons/${starIconId}`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({ name: 'Hacked Star' });
    expect(updateRes.status).toBe(403);

    // CANNOT delete an existing icon (creator only!)
    const deleteRes = await request(app)
      .delete(`/api/icons/${starIconId}`)
      .set('Authorization', `Bearer ${member2Token}`);
    expect(deleteRes.status).toBe(403);

    // CANNOT create folder (creator only!)
    const folderRes = await request(app)
      .post(`/api/projects/${publicProjectId}/folders`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({ name: 'Hacker Folder' });
    expect(folderRes.status).toBe(403);
  });

  it('Cross-Project Copy: Can copy icon from public project into own project', async () => {
    // Alice (Member 2) creates her own workspace
    const aliceProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${member2Token}`)
      .send({ name: 'Alice Private Vault', visibility: 'private', prefix: 'al' });
    const aliceProjectId = aliceProj.body.data.id;

    // Get icon from public project
    const iconsRes = await request(app)
      .get(`/api/projects/${publicProjectId}/icons`)
      .set('Authorization', `Bearer ${member2Token}`);
    const sharedStar = iconsRes.body.data.icons.find((i: any) => i.id === starIconId);
    expect(sharedStar).toBeDefined();

    // Copy into Alice's project (allowed because source project is public)
    const copyRes = await request(app)
      .post(`/api/projects/${aliceProjectId}/icons/copy-from-project`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({
        sourceProjectId: publicProjectId,
        iconIds: [sharedStar.id],
        duplicateStrategy: 'rename'
      });

    expect(copyRes.status).toBe(201);
    expect(copyRes.body.data.copiedCount).toBe(1);
    expect(copyRes.body.data.copied[0].name).toBe('Shared Star');

    // Clean up
    await request(app).delete(`/api/projects/${aliceProjectId}`).set('Authorization', `Bearer ${member2Token}`);
  });

  it('Cross-Project Copy: CANNOT copy icons from any private project (403 Forbidden)', async () => {
    // Alice (Member 2) creates her own workspace
    const aliceProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${member2Token}`)
      .send({ name: 'Alice Target Vault', visibility: 'private', prefix: 'al2' });
    const aliceProjectId = aliceProj.body.data.id;

    // Attempt to copy from private project
    const copyRes = await request(app)
      .post(`/api/projects/${aliceProjectId}/icons/copy-from-project`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({
        sourceProjectId: privateProjectId,
        iconIds: [privateIconId]
      });

    expect(copyRes.status).toBe(403);
    expect(copyRes.body.error.message).toContain('private');

    // Clean up
    await request(app).delete(`/api/projects/${aliceProjectId}`).set('Authorization', `Bearer ${member2Token}`);
  });
});
