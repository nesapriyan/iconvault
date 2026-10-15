export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar?: string | null;
  project_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  name: string;
  description: string;
  prefix: string;
  color: string;
  is_archived: number;
  visibility?: 'public' | 'private';
  public_access?: 'view' | 'edit';
  can_add_icons?: boolean;
  can_edit?: boolean;
  can_manage?: boolean;
  settings_json: string;
  purpose?: 'sprite' | 'font';
  icon_count?: number;
  folderCount?: number;
  trashCount?: number;
  last_build_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  icon_count: number;
  created_at: string;
  updated_at: string;
}

export interface IconItem {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  slug: string;
  svg_path: string;
  tags: string[];
  byte_size: number;
  original_byte_size: number;
  codepoint: string | null;
  width: number;
  height: number;
  view_box: string;
  has_stroke: number | boolean;
  has_gradient: number | boolean;
  has_text: number | boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  rawSvg?: string;
  versions?: IconVersion[];
}

export interface IconVersion {
  id: string;
  icon_id: string;
  svg_path: string;
  byte_size: number;
  created_at: string;
}

export interface BuildItem {
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

export interface SpriteBuildResponse {
  buildId: string;
  spriteSvg: string;
  previewHtml: string;
  cssContent?: string;
  zipPath: string;
  totalOriginalSize: number;
  spriteSize: number;
  savingsPercent: number;
  iconCount: number;
  symbols: Array<{ id: string; name: string; snippet: string }>;
}

export interface FontBuildResponse {
  buildId: string;
  fontName: string;
  prefix: string;
  baseClass: string;
  cssContent: string;
  scssContent: string;
  htmlSpecimen: string;
  glyphMap: Record<string, number>;
  zipPath: string;
  totalSize: number;
  iconCount: number;
  warnings: Array<{ iconName: string; warning: string }>;
  woff2Base64?: string;
  codepoints: Array<{ id: string; name: string; slug: string; codepoint: string; unicodeHex: string }>;
}

export type IconRenderStyle = 'natural' | 'flat' | 'wireframe';
