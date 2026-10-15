import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from '../config.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbDir = path.dirname(CONFIG.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new Database(CONFIG.DB_PATH);
    
    // Performance and safety pragmas
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');

    // Run schema migrations
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
    }
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      dbInstance.exec(schemaSql);
    }

    // Migrations: ensure columns exist in projects
    try {
      dbInstance.exec(`ALTER TABLE projects ADD COLUMN purpose TEXT NOT NULL DEFAULT 'sprite'`);
    } catch {}

    try {
      dbInstance.exec(`ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL`);
    } catch {}

    try {
      dbInstance.exec(`ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`);
    } catch {}

    try {
      dbInstance.exec(`ALTER TABLE projects ADD COLUMN public_access TEXT NOT NULL DEFAULT 'view'`);
    } catch {}

    // Ensure index on owner_id exists
    try {
      dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)`);
    } catch {}

    // Helper to generate salt:hash
    const hashPwd = (pwd: string) => {
      const salt = crypto.randomBytes(16).toString('hex');
      const derivedKey = crypto.scryptSync(pwd, salt, 64);
      return `${salt}:${derivedKey.toString('hex')}`;
    };

    // Seed default admin and member accounts
    const adminId = 'usr-admin-0000-0000-000000000001';
    const memberId = 'usr-member-0000-0000-000000000002';
    const now = new Date().toISOString();

    const existingAdmin = dbInstance.prepare('SELECT id FROM users WHERE id = ? OR email = ?').get(adminId, 'admin@iconvault.local');
    if (!existingAdmin) {
      dbInstance.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, avatar, created_at, updated_at)
        VALUES (?, 'admin@iconvault.local', 'Admin User', ?, 'admin', NULL, ?, ?)
      `).run(adminId, hashPwd('admin123'), now, now);
    } else {
      // Refresh admin password hash to ensure valid scrypt
      dbInstance.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPwd('admin123'), adminId);
    }

    const existingMember = dbInstance.prepare('SELECT id FROM users WHERE id = ? OR email = ?').get(memberId, 'member@iconvault.local');
    if (!existingMember) {
      dbInstance.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, avatar, created_at, updated_at)
        VALUES (?, 'member@iconvault.local', 'Demo Member', ?, 'user', NULL, ?, ?)
      `).run(memberId, hashPwd('member123'), now, now);
    } else {
      // Refresh member password hash to ensure valid scrypt
      dbInstance.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPwd('member123'), memberId);
    }

    // Assign existing projects without owner to the admin user
    dbInstance.prepare(`UPDATE projects SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
  }

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
