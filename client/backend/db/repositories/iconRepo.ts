import crypto from 'crypto';
import { getDatabase } from '../connection.js';

export interface IconRecord {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  slug: string;
  svg_path: string;
  tags: string; // JSON string array
  byte_size: number;
  original_byte_size: number;
  codepoint: string | null;
  width: number;
  height: number;
  view_box: string;
  has_stroke: number;
  has_gradient: number;
  has_text: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface IconVersionRecord {
  id: string;
  icon_id: string;
  svg_path: string;
  byte_size: number;
  created_at: string;
}

export interface IconQueryOptions {
  folderId?: string | null; // null = root or all? We can distinguish 'all', 'root', or folderId
  includeSubfolders?: boolean;
  folderIds?: string[]; // for specific set of folders
  search?: string;
  tag?: string;
  sort?: 'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'size_asc' | 'size_desc';
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export const IconRepo = {
  async findMany(projectId: string, options: IconQueryOptions = {}): Promise<{ icons: IconRecord[]; total: number }> {
    const db = getDatabase();
    let whereClause = 'WHERE project_id = ?';
    const params: any[] = [projectId];

    if (options.includeDeleted) {
      whereClause += ' AND deleted_at IS NOT NULL';
    } else {
      whereClause += ' AND deleted_at IS NULL';
    }

    if (options.folderIds && options.folderIds.length > 0) {
      const placeholders = options.folderIds.map(() => '?').join(',');
      whereClause += ` AND folder_id IN (${placeholders})`;
      params.push(...options.folderIds);
    } else if (options.folderId !== undefined) {
      if (options.folderId === null || options.folderId === 'root') {
        whereClause += ' AND folder_id IS NULL';
      } else if (options.folderId !== 'all') {
        whereClause += ' AND folder_id = ?';
        params.push(options.folderId);
      }
    }

    if (options.search) {
      whereClause += ' AND (name ILIKE ? OR slug ILIKE ? OR tags ILIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    if (options.tag) {
      whereClause += ' AND tags ILIKE ?';
      params.push(`%"${options.tag}"%`);
    }

    // Count query
    const countRow = (await db.prepare(`SELECT COUNT(*) as count FROM icons ${whereClause}`).get(...params)) as { count: number };
    const total = countRow.count;

    // Order
    let orderClause = 'ORDER BY created_at DESC';
    switch (options.sort) {
      case 'name_asc': orderClause = 'ORDER BY name ASC'; break;
      case 'name_desc': orderClause = 'ORDER BY name DESC'; break;
      case 'newest': orderClause = 'ORDER BY created_at DESC'; break;
      case 'oldest': orderClause = 'ORDER BY created_at ASC'; break;
      case 'size_asc': orderClause = 'ORDER BY byte_size ASC'; break;
      case 'size_desc': orderClause = 'ORDER BY byte_size DESC'; break;
    }

    // Pagination
    let limitClause = '';
    if (options.limit && options.limit > 0) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const offset = (page - 1) * options.limit;
      limitClause = ` LIMIT ${options.limit} OFFSET ${offset}`;
    }

    const icons = (await db.prepare(`SELECT * FROM icons ${whereClause} ${orderClause} ${limitClause}`).all(...params)) as IconRecord[];
    return { icons, total };
  },

  async findById(id: string): Promise<IconRecord | null> {
    const db = getDatabase();
    return ((await db.prepare('SELECT * FROM icons WHERE id = ?').get(id)) as IconRecord) || null;
  },

  async findByIds(ids: string[]): Promise<IconRecord[]> {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    return (await db.prepare(`SELECT * FROM icons WHERE id IN (${placeholders})`).all(...ids)) as IconRecord[];
  },

  async findBySlug(projectId: string, slug: string): Promise<IconRecord | null> {
    const db = getDatabase();
    return ((await db.prepare('SELECT * FROM icons WHERE project_id = ? AND slug = ? AND deleted_at IS NULL').get(projectId, slug)) as IconRecord) || null;
  },

  async create(data: {
    projectId: string;
    folderId?: string | null;
    name: string;
    slug: string;
    svgPath: string;
    tags?: string[];
    byteSize: number;
    originalByteSize?: number;
    codepoint?: string | null;
    width?: number;
    height?: number;
    viewBox?: string;
    hasStroke?: boolean;
    hasGradient?: boolean;
    hasText?: boolean;
  }): Promise<IconRecord> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(data.tags || []);

    (await db.prepare(`
      INSERT INTO icons (
        id, project_id, folder_id, name, slug, svg_path, tags, byte_size, original_byte_size,
        codepoint, width, height, view_box, has_stroke, has_gradient, has_text, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            data.projectId,
            data.folderId || null,
            data.name.trim(),
            data.slug.trim(),
            data.svgPath,
            tagsJson,
            data.byteSize,
            data.originalByteSize ?? data.byteSize,
            data.codepoint || null,
            data.width ?? 24,
            data.height ?? 24,
            data.viewBox ?? '0 0 24 24',
            data.hasStroke ? 1 : 0,
            data.hasGradient ? 1 : 0,
            data.hasText ? 1 : 0,
            now,
            now
          ));

    return (await this.findById(id))!;
  },

  async update(id: string, data: Partial<{
    name: string;
    slug: string;
    folderId: string | null;
    svgPath: string;
    tags: string[];
    byteSize: number;
    originalByteSize: number;
    codepoint: string | null;
    width: number;
    height: number;
    viewBox: string;
    hasStroke: boolean;
    hasGradient: boolean;
    hasText: boolean;
  }>): Promise<IconRecord | null> {
    const db = getDatabase();
    const current = (await this.findById(id));
    if (!current) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      params.push(data.slug.trim());
    }
    if (data.folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(data.folderId);
    }
    if (data.svgPath !== undefined) {
      updates.push('svg_path = ?');
      params.push(data.svgPath);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.byteSize !== undefined) {
      updates.push('byte_size = ?');
      params.push(data.byteSize);
    }
    if (data.originalByteSize !== undefined) {
      updates.push('original_byte_size = ?');
      params.push(data.originalByteSize);
    }
    if (data.codepoint !== undefined) {
      updates.push('codepoint = ?');
      params.push(data.codepoint);
    }
    if (data.width !== undefined) {
      updates.push('width = ?');
      params.push(data.width);
    }
    if (data.height !== undefined) {
      updates.push('height = ?');
      params.push(data.height);
    }
    if (data.viewBox !== undefined) {
      updates.push('view_box = ?');
      params.push(data.viewBox);
    }
    if (data.hasStroke !== undefined) {
      updates.push('has_stroke = ?');
      params.push(data.hasStroke ? 1 : 0);
    }
    if (data.hasGradient !== undefined) {
      updates.push('has_gradient = ?');
      params.push(data.hasGradient ? 1 : 0);
    }
    if (data.hasText !== undefined) {
      updates.push('has_text = ?');
      params.push(data.hasText ? 1 : 0);
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    (await db.prepare(`UPDATE icons SET ${updates.join(', ')} WHERE id = ?`).run(...params));
    return (await this.findById(id));
  },

  async softDelete(ids: string | string[]): Promise<number> {
    const db = getDatabase();
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return 0;

    const placeholders = idList.map(() => '?').join(',');
    const now = new Date().toISOString();
    const res = (await db.prepare(`UPDATE icons SET deleted_at = ? WHERE id IN (${placeholders})`).run(now, ...idList));
    return res.changes;
  },

  async restore(ids: string | string[]): Promise<number> {
    const db = getDatabase();
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return 0;

    const placeholders = idList.map(() => '?').join(',');
    const res = (await db.prepare(`UPDATE icons SET deleted_at = NULL WHERE id IN (${placeholders})`).run(...idList));
    return res.changes;
  },

  async permanentDelete(ids: string | string[]): Promise<number> {
    const db = getDatabase();
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return 0;

    const placeholders = idList.map(() => '?').join(',');
    const res = (await db.prepare(`DELETE FROM icons WHERE id IN (${placeholders})`).run(...idList));
    return res.changes;
  },

  async emptyTrash(projectId: string): Promise<number> {
    const db = getDatabase();
    const res = (await db.prepare('DELETE FROM icons WHERE project_id = ? AND deleted_at IS NOT NULL').run(projectId));
    return res.changes;
  },

  async batchMove(iconIds: string[], targetFolderId: string | null): Promise<number> {
    const db = getDatabase();
    if (iconIds.length === 0) return 0;
    const placeholders = iconIds.map(() => '?').join(',');
    const now = new Date().toISOString();
    const res = (await db.prepare(`UPDATE icons SET folder_id = ?, updated_at = ? WHERE id IN (${placeholders})`).run(targetFolderId, now, ...iconIds));
    return res.changes;
  },

  async batchTag(iconIds: string[], tagsToAdd: string[], tagsToRemove: string[] = []): Promise<number> {
    const db = getDatabase();
    if (iconIds.length === 0) return 0;
    let count = 0;

    const transaction = db.transaction(async () => {
      for (const id of iconIds) {
        const icon = (await this.findById(id));
        if (!icon) continue;

        let tags: string[] = [];
        try {
          tags = JSON.parse(icon.tags || '[]');
        } catch {
          tags = [];
        }

        const tagSet = new Set(tags);
        for (const t of tagsToAdd) {
          if (t.trim()) tagSet.add(t.trim().toLowerCase());
        }
        for (const t of tagsToRemove) {
          tagSet.delete(t.trim().toLowerCase());
        }

        const updatedTags = Array.from(tagSet);
        (await this.update(id, { tags: updatedTags }));
        count++;
      }
    });

    await transaction();
    return count;
  },

  // Versioning
  async saveVersion(iconId: string, svgPath: string, byteSize: number): Promise<IconVersionRecord> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    (await db.prepare(`
      INSERT INTO icon_versions (id, icon_id, svg_path, byte_size, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, iconId, svgPath, byteSize, now));

    return ((await db.prepare('SELECT * FROM icon_versions WHERE id = ?').get(id)) as IconVersionRecord);
  },

  async getVersions(iconId: string): Promise<IconVersionRecord[]> {
    const db = getDatabase();
    return (await db.prepare('SELECT * FROM icon_versions WHERE icon_id = ? ORDER BY created_at DESC').all(iconId)) as IconVersionRecord[];
  },

  async getVersionById(versionId: string): Promise<IconVersionRecord | null> {
    const db = getDatabase();
    return ((await db.prepare('SELECT * FROM icon_versions WHERE id = ?').get(versionId)) as IconVersionRecord) || null;
  },

  // Codepoint allocation
  async getNextAvailableCodepoint(projectId: string, startHex: string = 'E001'): Promise<string> {
    const db = getDatabase();
    const rows = (await db.prepare(`
      SELECT codepoint FROM icons 
      WHERE project_id = ? AND codepoint IS NOT NULL
    `).all(projectId)) as { codepoint: string }[];

    const used = new Set(rows.map(r => r.codepoint.toUpperCase()));
    let currentCode = parseInt(startHex, 16);
    if (isNaN(currentCode)) currentCode = 0xE001;

    while (true) {
      const hex = currentCode.toString(16).toUpperCase().padStart(4, '0');
      if (!used.has(hex)) {
        return hex;
      }
      currentCode++;
    }
  }
};
