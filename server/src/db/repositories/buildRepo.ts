import crypto from 'crypto';
import { getDatabase } from '../connection.js';

export interface BuildRecord {
  id: string;
  project_id: string;
  type: 'sprite' | 'font';
  scope: string;
  options_json: string;
  output_path: string;
  icon_count: number;
  output_size: number;
  created_at: string;
}

export const BuildRepo = {
  create(data: {
    projectId: string;
    type: 'sprite' | 'font';
    scope: string;
    options: Record<string, any>;
    outputPath: string;
    iconCount: number;
    outputSize: number;
  }): BuildRecord {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO builds (id, project_id, type, scope, options_json, output_path, icon_count, output_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.projectId,
      data.type,
      data.scope,
      JSON.stringify(data.options),
      data.outputPath,
      data.iconCount,
      data.outputSize,
      now
    );

    return this.findById(id)!;
  },

  findByProject(projectId: string, type?: 'sprite' | 'font'): BuildRecord[] {
    const db = getDatabase();
    if (type) {
      return db.prepare('SELECT * FROM builds WHERE project_id = ? AND type = ? ORDER BY created_at DESC').all(projectId, type) as BuildRecord[];
    }
    return db.prepare('SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as BuildRecord[];
  },

  findById(id: string): BuildRecord | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM builds WHERE id = ?').get(id) as BuildRecord) || null;
  },

  delete(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM builds WHERE id = ?').run(id);
    return res.changes > 0;
  }
};
