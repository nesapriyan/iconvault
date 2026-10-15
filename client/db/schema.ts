import { pgTable, text, integer, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('user'),
  avatar: text('avatar'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').default(''),
  prefix: text('prefix').default('icon'),
  color: text('color').default('#3b82f6'),
  is_archived: integer('is_archived').default(0),
  visibility: text('visibility').notNull().default('public'),
  public_access: text('public_access').notNull().default('view'),
  settings_json: text('settings_json').default('{}'),
  purpose: text('purpose').notNull().default('sprite'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references((): AnyPgColumn => projects.id, { onDelete: 'cascade' }),
  parent_id: text('parent_id').references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  order_index: integer('order_index').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const icons = pgTable('icons', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references((): AnyPgColumn => projects.id, { onDelete: 'cascade' }),
  folder_id: text('folder_id').references((): AnyPgColumn => folders.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  svg_path: text('svg_path').notNull(),
  tags: text('tags').default('[]'),
  byte_size: integer('byte_size').notNull().default(0),
  original_byte_size: integer('original_byte_size').notNull().default(0),
  codepoint: text('codepoint'),
  width: integer('width').default(24),
  height: integer('height').default(24),
  view_box: text('view_box').default('0 0 24 24'),
  has_stroke: integer('has_stroke').default(0),
  has_gradient: integer('has_gradient').default(0),
  has_text: integer('has_text').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  deleted_at: text('deleted_at'),
});

export const icon_versions = pgTable('icon_versions', {
  id: text('id').primaryKey(),
  icon_id: text('icon_id').notNull().references((): AnyPgColumn => icons.id, { onDelete: 'cascade' }),
  svg_path: text('svg_path').notNull(),
  byte_size: integer('byte_size').notNull(),
  created_at: text('created_at').notNull(),
});

export const builds = pgTable('builds', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references((): AnyPgColumn => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  scope: text('scope').notNull(),
  options_json: text('options_json').default('{}'),
  output_path: text('output_path').notNull(),
  icon_count: integer('icon_count').default(0),
  output_size: integer('output_size').default(0),
  created_at: text('created_at').notNull(),
});
