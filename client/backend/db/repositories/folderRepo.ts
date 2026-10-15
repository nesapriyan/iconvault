import crypto from 'crypto';
import { getDatabase } from '../connection.js';

export interface FolderRecord {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface FolderWithCount extends FolderRecord {
  icon_count: number;
}

export const FolderRepo = {
  async findByProject(projectId: string): Promise<FolderWithCount[]> {
    const db = getDatabase();
    const query = `
      SELECT 
        f.*,
        COUNT(DISTINCT CASE WHEN i.deleted_at IS NULL THEN i.id END) AS icon_count
      FROM folders f
      LEFT JOIN icons i ON i.folder_id = f.id
      WHERE f.project_id = ?
      GROUP BY f.id
      ORDER BY f.order_index ASC, f.name ASC
    `;
    return (await db.prepare(query).all(projectId)) as FolderWithCount[];
  },

  async findById(id: string): Promise<FolderRecord | null> {
    const db = getDatabase();
    return ((await db.prepare('SELECT * FROM folders WHERE id = ?').get(id)) as FolderRecord) || null;
  },

  async create(data: { projectId: string; parentId?: string | null; name: string; orderIndex?: number }): Promise<FolderRecord> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    (await db.prepare(`
      INSERT INTO folders (id, project_id, parent_id, name, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.projectId, data.parentId || null, data.name.trim(), data.orderIndex ?? 0, now, now));

    return (await this.findById(id))!;
  },

  async update(id: string, data: Partial<{ name: string; parentId: string | null; orderIndex: number }>): Promise<FolderRecord | null> {
    const db = getDatabase();
    const current = (await this.findById(id));
    if (!current) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.parentId !== undefined) {
      // Prevent cyclical parenting: cannot parent to self
      if (data.parentId === id) {
        throw new Error('A folder cannot be its own parent');
      }
      updates.push('parent_id = ?');
      params.push(data.parentId);
    }
    if (data.orderIndex !== undefined) {
      updates.push('order_index = ?');
      params.push(data.orderIndex);
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    (await db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).run(...params));
    return (await this.findById(id));
  },

  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    // Foreign key with CASCADE will handle subfolders, but set icons folder_id to NULL
    (await db.prepare('UPDATE icons SET folder_id = NULL WHERE folder_id = ?').run(id));
    const res = (await db.prepare('DELETE FROM folders WHERE id = ?').run(id));
    return res.changes > 0;
  },

  // Helper to get all descendant folder IDs (for folder-scoped builds or deletions)
  async getDescendantFolderIds(folderId: string): Promise<string[]> {
    const db = getDatabase();
    const result: string[] = [folderId];
    const queue: string[] = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = (await db.prepare('SELECT id FROM folders WHERE parent_id = ?').all(currentId)) as { id: string }[];
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }

    return result;
  }
};
