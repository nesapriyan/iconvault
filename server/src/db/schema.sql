CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  prefix TEXT DEFAULT 'icon',
  color TEXT DEFAULT '#3b82f6',
  is_archived INTEGER DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public', -- 'public' | 'private'
  public_access TEXT NOT NULL DEFAULT 'view', -- 'view' | 'edit'
  settings_json TEXT DEFAULT '{}',
  purpose TEXT NOT NULL DEFAULT 'sprite',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS icons (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  svg_path TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  byte_size INTEGER NOT NULL DEFAULT 0,
  original_byte_size INTEGER NOT NULL DEFAULT 0,
  codepoint TEXT,
  width INTEGER DEFAULT 24,
  height INTEGER DEFAULT 24,
  view_box TEXT DEFAULT '0 0 24 24',
  has_stroke INTEGER DEFAULT 0,
  has_gradient INTEGER DEFAULT 0,
  has_text INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS icon_versions (
  id TEXT PRIMARY KEY,
  icon_id TEXT NOT NULL REFERENCES icons(id) ON DELETE CASCADE,
  svg_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  options_json TEXT DEFAULT '{}',
  output_path TEXT NOT NULL,
  icon_count INTEGER DEFAULT 0,
  output_size INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_icons_project ON icons(project_id);
CREATE INDEX IF NOT EXISTS idx_icons_folder ON icons(folder_id);
CREATE INDEX IF NOT EXISTS idx_icons_deleted ON icons(deleted_at);
CREATE INDEX IF NOT EXISTS idx_icons_slug ON icons(project_id, slug);
CREATE INDEX IF NOT EXISTS idx_builds_project ON builds(project_id);
