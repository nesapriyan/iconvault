import type { User } from '@netlify/identity';
import { getDatabase } from '../connection.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar: string | null;
  created_at: string;
  updated_at: string;
}
export type UserSafe = UserRecord;
export type UserWithStats = UserRecord & { project_count: number };
export function toSafeUser(user: UserRecord): UserSafe { return user; }

export const UserRepo = {
  async sync(user: User): Promise<UserRecord> {
    const now = new Date().toISOString();
    const role = user.roles?.includes('admin') ? 'admin' : 'user';
    await getDatabase().prepare(`INSERT INTO users (id, email, name, role, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
      avatar = EXCLUDED.avatar, updated_at = EXCLUDED.updated_at`).run(
      user.id, user.email || '', user.name || user.email || 'User', role,
      user.pictureUrl || null, user.createdAt || now, now);
    return (await this.findById(user.id))!;
  },
  async findById(id: string): Promise<UserRecord | null> {
    return (await getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id)) || null;
  },
  async findAll(): Promise<UserWithStats[]> {
    return (await getDatabase().prepare(`SELECT u.*, COUNT(p.id) AS project_count FROM users u
      LEFT JOIN projects p ON p.owner_id = u.id GROUP BY u.id ORDER BY u.created_at`).all());
  },
  async delete(id: string): Promise<void> {
    await getDatabase().prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};
