import { Project, Folder, IconItem, GlobalSearchIconItem, BuildItem, SpriteBuildResponse, FontBuildResponse, User } from '../types';

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

function parseNonJsonResponse(res: Response, text: string, defaultAction = 'Request'): Error {
  if (text.trim().startsWith('<') || res.status === 404 || res.status === 502 || res.status === 503) {
    return new Error(`Backend server not reachable (${res.status} ${res.statusText}). If you are hosting on a static platform like Netlify, deploy the full-stack Node.js server on Render.com or Railway.`);
  }
  return new Error(text || `${defaultAction} error (${res.status} ${res.statusText})`);
}

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('iconvault_token') : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('iconvault_token', token);
    } else {
      localStorage.removeItem('iconvault_token');
    }
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers
    }
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw parseNonJsonResponse(res, text, 'Server');
  }

  const data = await res.json();
  if (!res.ok || data.success === false) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data.data !== undefined ? data.data : data;
}

export function normalizeIcon(icon: any): IconItem {
  if (!icon) return icon;
  let tags: string[] = [];
  if (Array.isArray(icon.tags)) {
    tags = icon.tags;
  } else if (typeof icon.tags === 'string') {
    try {
      const parsed = JSON.parse(icon.tags);
      tags = Array.isArray(parsed) ? parsed : [];
    } catch {
      tags = [];
    }
  }
  return {
    ...icon,
    tags
  };
}

export function downloadSvgContent(rawSvg: string, filename: string) {
  const blob = new Blob([rawSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  // Projects
  async getProjects(params?: { search?: string; status?: 'all' | 'active' | 'archived'; visibility?: 'all' | 'public' | 'private'; sort?: string }): Promise<Project[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.visibility) query.set('visibility', params.visibility);
    if (params?.sort) query.set('sort', params.sort);
    return fetchJson<Project[]>(`${API_BASE}/projects?${query.toString()}`);
  },

  async getProject(id: string): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects/${id}`);
  },

  async createProject(data: {
    name: string;
    description?: string;
    prefix?: string;
    color?: string;
    purpose?: 'sprite' | 'font';
    visibility?: 'public' | 'private';
    publicAccess?: 'view' | 'edit';
  }): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProject(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      prefix: string;
      color: string;
      isArchived: boolean;
      visibility: 'public' | 'private';
      publicAccess: 'view' | 'edit';
      settings: any;
    }>
  ): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id: string): Promise<void> {
    await fetchJson(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  },

  async duplicateProject(id: string): Promise<Project> {
    return fetchJson<Project>(`${API_BASE}/projects/${id}/duplicate`, { method: 'POST' });
  },

  async transferProject(projectId: string, newOwnerId: string): Promise<Project> {
    const res = await fetchJson<{ data: Project; message: string }>(`${API_BASE}/projects/${projectId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId })
    });
    return (res as any).data || res;
  },

  async bulkDeleteProjects(projectIds: string[]): Promise<{ deletedCount: number }> {
    return fetchJson<{ deletedCount: number }>(`${API_BASE}/projects/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ projectIds })
    });
  },

  // Folders
  async getFolders(projectId: string): Promise<Folder[]> {
    return fetchJson<Folder[]>(`${API_BASE}/projects/${projectId}/folders`);
  },

  async createFolder(projectId: string, data: { name: string; parentId?: string | null; orderIndex?: number }): Promise<Folder> {
    return fetchJson<Folder>(`${API_BASE}/projects/${projectId}/folders`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateFolder(id: string, data: { name?: string; parentId?: string | null; orderIndex?: number }): Promise<Folder> {
    return fetchJson<Folder>(`${API_BASE}/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async moveFolder(id: string, parentId: string | null, orderIndex?: number): Promise<Folder> {
    return fetchJson<Folder>(`${API_BASE}/folders/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parentId, orderIndex })
    });
  },

  async deleteFolder(id: string): Promise<void> {
    await fetchJson(`${API_BASE}/folders/${id}`, { method: 'DELETE' });
  },

  // Icons
  async getIcons(projectId: string, params?: {
    folderId?: string | null;
    includeSubfolders?: boolean;
    search?: string;
    tag?: string;
    sort?: string;
    page?: number;
    limit?: number;
    trash?: boolean;
  }): Promise<{ icons: IconItem[]; total: number; page: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params?.folderId !== undefined && params.folderId !== null) query.set('folderId', params.folderId);
    if (params?.includeSubfolders) query.set('includeSubfolders', 'true');
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.trash) query.set('trash', 'true');

    const res = await fetchJson<{ icons: IconItem[]; total: number; page: number; totalPages: number }>(
      `${API_BASE}/projects/${projectId}/icons?${query.toString()}`
    );
    return {
      ...res,
      icons: (res.icons || []).map(normalizeIcon)
    };
  },

  async getIcon(id: string): Promise<IconItem> {
    const icon = await fetchJson<IconItem>(`${API_BASE}/icons/${id}`);
    return normalizeIcon(icon);
  },

  async searchIcons(query: string, limit = 60, page = 1): Promise<{
    icons: GlobalSearchIconItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const q = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      page: page.toString()
    });
    const res = await fetchJson<{
      icons: any[];
      total: number;
      page: number;
      totalPages: number;
    }>(`${API_BASE}/icons/search?${q.toString()}`);
    return {
      ...res,
      icons: (res.icons || []).map(icon => ({
        ...normalizeIcon(icon),
        project_name: icon.project_name,
        project_prefix: icon.project_prefix,
        project_color: icon.project_color,
        project_visibility: icon.project_visibility,
        project_purpose: icon.project_purpose
      }))
    };
  },

  async uploadIcons(projectId: string, formData: FormData): Promise<{
    uploaded: IconItem[];
    uploadedCount: number;
    warnings: Array<{ name: string; warnings: string[] }>;
    errors: Array<{ file: string; error: string }>;
  }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/icons/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw parseNonJsonResponse(res, text, 'Upload');
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data?.error?.message || 'Upload failed');
    }
    return {
      ...data.data,
      uploaded: (data.data?.uploaded || []).map(normalizeIcon)
    };
  },

  async importSprite(projectId: string, formData: FormData): Promise<{
    uploaded: IconItem[];
    uploadedCount: number;
    warnings: Array<{ name: string; warnings: string[] }>;
    errors: Array<{ file: string; error: string }>;
  }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/icons/import-sprite`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw parseNonJsonResponse(res, text, 'Sprite import');
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data?.error?.message || 'Sprite import failed');
    }
    return {
      ...data.data,
      uploaded: (data.data?.uploaded || []).map(normalizeIcon)
    };
  },

  async importFont(projectId: string, formData: FormData): Promise<{
    uploaded: IconItem[];
    uploadedCount: number;
    warnings: Array<{ name: string; warnings: string[] }>;
    errors: Array<{ file: string; error: string }>;
  }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/icons/import-font`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw parseNonJsonResponse(res, text, 'Font import');
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data?.error?.message || 'Font import failed');
    }
    return {
      ...data.data,
      uploaded: (data.data?.uploaded || []).map(normalizeIcon)
    };
  },

  async copyIconsFromProject(
    targetProjectId: string,
    data: {
      sourceProjectId: string;
      iconIds: string[];
      folderId?: string | null;
      duplicateStrategy?: 'rename' | 'replace' | 'skip';
      autoOptimize?: boolean;
    }
  ): Promise<{
    copied: IconItem[];
    copiedCount: number;
    errors: Array<{ iconId: string; error: string }>;
  }> {
    const res = await fetchJson<{
      copied: any[];
      copiedCount: number;
      errors: Array<{ iconId: string; error: string }>;
    }>(`${API_BASE}/projects/${targetProjectId}/icons/copy-from-project`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return {
      ...res,
      copied: (res.copied || []).map(normalizeIcon)
    };
  },

  async pasteIcon(projectId: string, data: {
    rawSvg: string;
    name?: string;
    folderId?: string | null;
    autoOptimize?: boolean;
    tags?: string[];
    duplicateStrategy?: 'rename' | 'replace' | 'skip';
  }): Promise<{ icon: IconItem; warnings: string[] }> {
    const res = await fetchJson<{ icon: IconItem; warnings: string[] }>(`${API_BASE}/projects/${projectId}/icons/paste`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return {
      ...res,
      icon: normalizeIcon(res.icon)
    };
  },

  async updateIcon(id: string, data: {
    name?: string;
    folderId?: string | null;
    tags?: string[];
    codepoint?: string | null;
    rawSvg?: string;
  }): Promise<IconItem> {
    const icon = await fetchJson<IconItem>(`${API_BASE}/icons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return normalizeIcon(icon);
  },

  async optimizeIcon(id: string, options?: { removeDimensions?: boolean }): Promise<{
    icon: IconItem;
    savingsPercent: number;
    originalSize: number;
    optimizedSize: number;
  }> {
    const res = await fetchJson<{
      icon: IconItem;
      savingsPercent: number;
      originalSize: number;
      optimizedSize: number;
    }>(`${API_BASE}/icons/${id}/optimize`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
    return {
      ...res,
      icon: normalizeIcon(res.icon)
    };
  },

  async restoreIconVersion(iconId: string, versionId: string): Promise<IconItem> {
    const icon = await fetchJson<IconItem>(`${API_BASE}/icons/${iconId}/versions/${versionId}/restore`, {
      method: 'POST'
    });
    return normalizeIcon(icon);
  },

  async deleteIcon(id: string, permanent = false): Promise<void> {
    await fetchJson(`${API_BASE}/icons/${id}?permanent=${permanent}`, { method: 'DELETE' });
  },

  async restoreIcon(id: string): Promise<void> {
    await fetchJson(`${API_BASE}/icons/${id}/restore`, { method: 'POST' });
  },

  async batchMoveIcons(projectId: string, iconIds: string[], targetFolderId: string | null): Promise<number> {
    const res = await fetchJson<{ movedCount: number }>(`${API_BASE}/projects/${projectId}/icons/batch/move`, {
      method: 'POST',
      body: JSON.stringify({ iconIds, targetFolderId })
    });
    return res.movedCount;
  },

  async batchTagIcons(projectId: string, iconIds: string[], tagsToAdd: string[], tagsToRemove: string[] = []): Promise<number> {
    const res = await fetchJson<{ updatedCount: number }>(`${API_BASE}/projects/${projectId}/icons/batch/tag`, {
      method: 'POST',
      body: JSON.stringify({ iconIds, tagsToAdd, tagsToRemove })
    });
    return res.updatedCount;
  },

  async batchDeleteIcons(projectId: string, iconIds: string[], permanent = false): Promise<number> {
    const res = await fetchJson<{ deletedCount: number }>(`${API_BASE}/projects/${projectId}/icons/batch/delete`, {
      method: 'POST',
      body: JSON.stringify({ iconIds, permanent })
    });
    return res.deletedCount;
  },

  async batchRestoreIcons(projectId: string, iconIds: string[]): Promise<number> {
    const res = await fetchJson<{ restoredCount: number }>(`${API_BASE}/projects/${projectId}/icons/batch/restore`, {
      method: 'POST',
      body: JSON.stringify({ iconIds })
    });
    return res.restoredCount;
  },

  async batchOptimizeIcons(projectId: string, iconIds: string[]): Promise<{ optimizedCount: number; savingsKb: string }> {
    return fetchJson(`${API_BASE}/projects/${projectId}/icons/batch/optimize`, {
      method: 'POST',
      body: JSON.stringify({ iconIds })
    });
  },

  async emptyTrash(projectId: string): Promise<number> {
    const res = await fetchJson<{ deletedCount: number }>(`${API_BASE}/projects/${projectId}/icons/trash`, {
      method: 'DELETE'
    });
    return res.deletedCount;
  },

  // Builds
  async buildSprite(projectId: string, options: any): Promise<SpriteBuildResponse> {
    return fetchJson<SpriteBuildResponse>(`${API_BASE}/projects/${projectId}/build/sprite`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  },

  async buildFont(projectId: string, options: any): Promise<FontBuildResponse> {
    return fetchJson<FontBuildResponse>(`${API_BASE}/projects/${projectId}/build/font`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  },

  async getBuilds(projectId: string, type?: 'sprite' | 'font'): Promise<BuildItem[]> {
    const query = type ? `?type=${type}` : '';
    return fetchJson<BuildItem[]>(`${API_BASE}/projects/${projectId}/builds${query}`);
  },

  async deleteBuild(buildId: string): Promise<void> {
    await fetchJson(`${API_BASE}/builds/${buildId}`, { method: 'DELETE' });
  },

  getDownloadBuildUrl(buildId: string): string {
    const token = getAuthToken();
    return `${API_BASE}/builds/${buildId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  getExportProjectUrl(projectId: string): string {
    const token = getAuthToken();
    return `${API_BASE}/projects/${projectId}/export${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  async importProject(file: File, overrideName?: string): Promise<Project> {
    const formData = new FormData();
    formData.append('file', file);
    if (overrideName) formData.append('name', overrideName);

    const res = await fetch(`${API_BASE}/projects/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw parseNonJsonResponse(res, text, 'Import');
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data?.error?.message || 'Project import failed');
    }
    return data.data;
  },

  getIconDownloadUrl(iconId: string): string {
    const token = getAuthToken();
    return `${API_BASE}/icons/${iconId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  async downloadIcons(projectId: string, iconIds: string[], fallbackName = 'icons'): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/icons/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ iconIds })
    });

    if (!res.ok) {
      let errorMsg = 'Failed to download icons';
      try {
        const data = await res.json();
        errorMsg = data?.error?.message || data?.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    let filename = `${fallbackName}.zip`;
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    } else if (iconIds.length === 1) {
      filename = `${fallbackName}.svg`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Authentication
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetchJson<{ user: User; token: string }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async register(email: string, name: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetchJson<{ user: User; token: string }>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, name, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async getMe(): Promise<User> {
    return fetchJson<User>(`${API_BASE}/auth/me`);
  },

  async logout(): Promise<void> {
    try {
      await fetchJson(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch {}
    setAuthToken(null);
  },

  async getSwitchableUsers(): Promise<User[]> {
    return fetchJson<User[]>(`${API_BASE}/auth/switchable-users`);
  },

  async switchUser(userId: string): Promise<{ user: User; token: string }> {
    const res = await fetchJson<{ user: User; token: string }>(`${API_BASE}/auth/switch-user`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    setAuthToken(res.token);
    return res;
  },

  // User Management (Admin Only)
  async getUsers(): Promise<User[]> {
    return fetchJson<User[]>(`${API_BASE}/users`);
  },

  async createUser(data: { email: string; name: string; password: string; role?: 'admin' | 'user' }): Promise<User> {
    return fetchJson<User>(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateUser(id: string, data: Partial<{ email: string; name: string; password: string; role: 'admin' | 'user' }>): Promise<User> {
    return fetchJson<User>(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteUser(id: string, transferTo?: string): Promise<{ transferredCount?: number }> {
    const query = transferTo ? `?transferTo=${encodeURIComponent(transferTo)}` : '';
    return fetchJson<{ transferredCount?: number }>(`${API_BASE}/users/${id}${query}`, {
      method: 'DELETE',
      headers: transferTo ? { 'Content-Type': 'application/json' } : undefined,
      body: transferTo ? JSON.stringify({ transferTo }) : undefined
    });
  },

  async transferUserProjects(userId: string, newOwnerId: string): Promise<{ transferredCount: number; newOwnerName: string }> {
    return fetchJson<{ transferredCount: number; newOwnerName: string }>(`${API_BASE}/users/${userId}/transfer-projects`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId })
    });
  }
};

