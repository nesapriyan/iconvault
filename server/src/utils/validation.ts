import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional(),
  purpose: z.enum(['sprite', 'font']).default('sprite'),
  prefix: z.string().max(20).regex(/^[a-z0-9_-]*$/i, 'Prefix must contain only letters, numbers, hyphens or underscores').optional(),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Must be a valid hex color').optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  publicAccess: z.enum(['view', 'edit']).default('view'),
  settings: z.record(z.any()).optional()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  prefix: z.string().max(20).regex(/^[a-z0-9_-]*$/i).optional(),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  isArchived: z.boolean().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  publicAccess: z.enum(['view', 'edit']).optional(),
  settings: z.record(z.any()).optional()
});

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user']).default('user')
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional()
});

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  parentId: z.string().nullable().optional(),
  orderIndex: z.number().int().optional()
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().nullable().optional(),
  orderIndex: z.number().int().optional()
});

export const updateIconSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  codepoint: z.string().regex(/^[0-9A-Fa-f]{4,6}$/, 'Must be a valid 4-6 character hex codepoint').nullable().optional(),
  rawSvg: z.string().optional() // for updating SVG code directly in editor
});

export const batchMoveIconsSchema = z.object({
  iconIds: z.array(z.string()).min(1, 'At least one icon ID is required'),
  targetFolderId: z.string().nullable()
});

export const batchTagIconsSchema = z.object({
  iconIds: z.array(z.string()).min(1, 'At least one icon ID is required'),
  tagsToAdd: z.array(z.string()).default([]),
  tagsToRemove: z.array(z.string()).default([])
});

export const batchDeleteIconsSchema = z.object({
  iconIds: z.array(z.string()).min(1, 'At least one icon ID is required'),
  permanent: z.boolean().default(false)
});

export const buildSpriteSchema = z.object({
  scope: z.enum(['all', 'folder', 'selected']).default('all'),
  folderId: z.string().nullable().optional(),
  iconIds: z.array(z.string()).optional(),
  mode: z.enum(['symbol', 'stack', 'css']).default('symbol'),
  idPattern: z.string().default('{prefix}-{name}'),
  stripColors: z.boolean().default(false), // convert fill/stroke to currentColor
  keepViewBox: z.boolean().default(true),
  removeDimensions: z.boolean().default(true),
  svgo: z.boolean().default(true),
  namespaceIds: z.boolean().default(true)
});

export const buildFontSchema = z.object({
  scope: z.enum(['all', 'folder', 'selected']).default('all'),
  folderId: z.string().nullable().optional(),
  iconIds: z.array(z.string()).optional(),
  formats: z.array(z.enum(['ttf', 'woff', 'woff2', 'eot', 'svg'])).min(1, 'At least one font format is required').default(['woff2', 'woff', 'ttf']),
  fontName: z.string().min(1).max(50).default('IconFont'),
  prefix: z.string().max(20).default('icon-'),
  baseClass: z.string().max(20).default('icon'),
  startCodepoint: z.string().regex(/^[0-9A-Fa-f]{4,6}$/, 'Must be a valid hex codepoint').default('E001'),
  fontHeight: z.number().int().min(300).max(2048).default(1000),
  descent: z.number().int().default(0),
  normalize: z.boolean().default(true)
});
