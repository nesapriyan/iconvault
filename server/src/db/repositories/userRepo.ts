import crypto from 'crypto';
import { getDatabase } from '../connection.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'user';
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSafe {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithStats extends UserSafe {
  project_count: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

export function toSafeUser(user: UserRecord): UserSafe {
  const { password_hash, ...safe } = user;
  return safe;
}

export const UserRepo = {
  findById(id: string): UserRecord | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord) || null;
  },

  findByEmail(email: string): UserRecord | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as UserRecord) || null;
  },

  findAll(): UserWithStats[] {
    const db = getDatabase();
    const query = `
      SELECT 
        u.id, u.email, u.name, u.role, u.avatar, u.created_at, u.updated_at,
        COUNT(DISTINCT p.id) AS project_count
      FROM users u
      LEFT JOIN projects p ON p.owner_id = u.id
      GROUP BY u.id
      ORDER BY 
        CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END,
        u.created_at ASC
    `;
    return db.prepare(query).all() as UserWithStats[];
  },

  create(data: {
    email: string;
    name: string;
    password: string;
    role?: 'admin' | 'user';
    avatar?: string;
  }): UserRecord {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(data.password);
    const role = data.role === 'admin' ? 'admin' : 'user';
    const avatar = data.avatar || null;

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, avatar, created_at, updated_at)
      VALUES (?, LOWER(?), ?, ?, ?, ?, ?, ?)
    `).run(id, data.email.trim(), data.name.trim(), passwordHash, role, avatar, now, now);

    return this.findById(id)!;
  },

  update(id: string, data: Partial<{
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
    avatar: string;
  }>): UserRecord | null {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.email !== undefined) {
      updates.push('email = LOWER(?)');
      params.push(data.email.trim());
    }
    if (data.password !== undefined && data.password.trim().length > 0) {
      updates.push('password_hash = ?');
      params.push(hashPassword(data.password));
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }
    if (data.avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(data.avatar);
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  },

  delete(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  },

  transferAllProjects(fromUserId: string, toUserId: string): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    const res = db.prepare(`
      UPDATE projects 
      SET owner_id = ?, updated_at = ? 
      WHERE owner_id = ?
    `).run(toUserId, now, fromUserId);
    return res.changes;
  },

  // Sessions
  createSession(userId: string): { token: string; expiresAt: string } {
    const db = getDatabase();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    // 30 days expiration
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, now.toISOString(), expiresAt);

    return { token, expiresAt };
  },

  findUserByToken(token: string): UserRecord | null {
    const db = getDatabase();
    const query = `
      SELECT u.* 
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `;
    return (db.prepare(query).get(token) as UserRecord) || null;
  },

  deleteSession(token: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  // Seeding default users (Admin and Member)
  seedDefaultUsers(): { admin: UserRecord; member: UserRecord } {
    const db = getDatabase();
    const adminId = 'usr-admin-0000-0000-000000000001';
    const memberId = 'usr-member-0000-0000-000000000002';
    const now = new Date().toISOString();

    let admin = this.findById(adminId) || this.findByEmail('admin@iconvault.local');
    if (!admin) {
      const adminHash = hashPassword('admin123');
      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, avatar, created_at, updated_at)
        VALUES (?, 'admin@iconvault.local', 'Admin User', ?, 'admin', NULL, ?, ?)
      `).run(adminId, adminHash, now, now);
      admin = this.findById(adminId)!;
    }

    let member = this.findById(memberId) || this.findByEmail('member@iconvault.local');
    if (!member) {
      const memberHash = hashPassword('member123');
      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, avatar, created_at, updated_at)
        VALUES (?, 'member@iconvault.local', 'Demo Member', ?, 'user', NULL, ?, ?)
      `).run(memberId, memberHash, now, now);
      member = this.findById(memberId)!;
    }

    return { admin, member };
  }
};
