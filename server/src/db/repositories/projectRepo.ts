import crypto from 'crypto';
import { getDatabase } from '../connection.js';
import { UserRecord, UserSafe } from './userRepo.js';
import { Permissions } from '../../utils/permissions.js';

export interface ProjectRecord {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
  prefix: string;
  color: string;
  is_archived: number;
  visibility: 'public' | 'private';
  public_access: 'view' | 'edit';
  settings_json: string;
  purpose: 'sprite' | 'font';
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends ProjectRecord {
  icon_count: number;
  last_build_at: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  can_add_icons?: boolean;
  can_edit?: boolean;
  can_manage?: boolean;
}

export const ProjectRepo = {
  findAll(options: {
    user?: UserRecord | UserSafe | null;
    search?: string;
    status?: 'all' | 'active' | 'archived';
    visibility?: 'all' | 'public' | 'private';
    sort?: string;
  } = {}): ProjectWithStats[] {
    const db = getDatabase();
    let query = `
      SELECT 
        p.*,
        u.name AS owner_name,
        u.email AS owner_email,
        COUNT(DISTINCT CASE WHEN i.deleted_at IS NULL THEN i.id END) AS icon_count,
        MAX(b.created_at) AS last_build_at
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      LEFT JOIN icons i ON i.project_id = p.id
      LEFT JOIN builds b ON b.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Access control filtering:
    // If user is admin: can see all
    // If user is regular: can see their own projects + all public projects
    // If unauthenticated: can only see public projects
    if (options.user?.role !== 'admin') {
      if (options.user) {
        query += ' AND (p.owner_id = ? OR p.visibility = \'public\')';
        params.push(options.user.id);
      } else {
        query += ' AND p.visibility = \'public\'';
      }
    }

    if (options.status === 'active') {
      query += ' AND p.is_archived = 0';
    } else if (options.status === 'archived') {
      query += ' AND p.is_archived = 1';
    }

    if (options.visibility === 'public') {
      query += ' AND p.visibility = \'public\'';
    } else if (options.visibility === 'private') {
      query += ' AND p.visibility = \'private\'';
    }

    if (options.search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.prefix LIKE ? OR u.name LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term, term);
    }

    query += ' GROUP BY p.id';

    if (options.sort === 'name_asc') {
      query += ' ORDER BY p.name ASC';
    } else if (options.sort === 'name_desc') {
      query += ' ORDER BY p.name DESC';
    } else if (options.sort === 'icons_desc') {
      query += ' ORDER BY icon_count DESC';
    } else if (options.sort === 'oldest') {
      query += ' ORDER BY p.created_at ASC';
    } else {
      query += ' ORDER BY p.updated_at DESC';
    }

    const rows = db.prepare(query).all(...params) as ProjectWithStats[];

    // Compute permissions for caller
    return rows.map(p => ({
      ...p,
      can_add_icons: Permissions.canAddIcons(options.user, p),
      can_edit: Permissions.canEdit(options.user, p),
      can_manage: Permissions.canManage(options.user, p)
    }));
  },

  findById(id: string): ProjectRecord | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRecord) || null;
  },

  create(data: {
    owner_id?: string | null;
    name: string;
    description?: string;
    prefix?: string;
    color?: string;
    visibility?: 'public' | 'private';
    public_access?: 'view' | 'edit';
    settings_json?: string;
    purpose?: 'sprite' | 'font';
  }): ProjectRecord {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const prefix = (data.prefix || 'icon').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const color = data.color || '#3b82f6';
    const description = data.description || '';
    const purpose = data.purpose === 'font' ? 'font' : 'sprite';
    const visibility = data.visibility === 'private' ? 'private' : 'public';
    const publicAccess = data.public_access === 'edit' ? 'edit' : 'view';
    const ownerId = data.owner_id || null;

    const settings = data.settings_json || JSON.stringify({
      svgo: { enabled: true, multipass: true },
      font: { fontName: data.name.replace(/[^a-zA-Z0-9]/g, '') || 'IconFont', startCodepoint: 'E001' }
    });

    db.prepare(`
      INSERT INTO projects (
        id, owner_id, name, description, prefix, color, is_archived,
        visibility, public_access, settings_json, purpose, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ownerId, data.name.trim(), description.trim(), prefix, color,
      visibility, publicAccess, settings, purpose, now, now
    );

    return this.findById(id)!;
  },

  update(id: string, data: Partial<{
    owner_id: string | null;
    name: string;
    description: string;
    prefix: string;
    color: string;
    is_archived: number;
    visibility: 'public' | 'private';
    public_access: 'view' | 'edit';
    settings_json: string;
  }>): ProjectRecord | null {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.owner_id !== undefined) {
      updates.push('owner_id = ?');
      params.push(data.owner_id);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description.trim());
    }
    if (data.prefix !== undefined) {
      updates.push('prefix = ?');
      params.push(data.prefix.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.is_archived !== undefined) {
      updates.push('is_archived = ?');
      params.push(data.is_archived ? 1 : 0);
    }
    if (data.visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(data.visibility);
    }
    if (data.public_access !== undefined) {
      updates.push('public_access = ?');
      params.push(data.public_access);
    }
    if (data.settings_json !== undefined) {
      updates.push('settings_json = ?');
      params.push(data.settings_json);
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  },

  delete(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return res.changes > 0;
  }
};
