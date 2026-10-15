# IconVault

**IconVault** is a production-quality, local-first icon management tool and asset compiler organized like a project manager. Each project is a workspace where you can upload, organize, and edit SVG icons across nested folders, then generate production-ready **SVG Sprites** and **Icon Fonts** (WOFF2, WOFF, TTF, EOT, SVG) with stable unicode codepoint mapping.

---

## Key Features

### 📁 Project Management
- **Workspaces**: Create, rename, duplicate, archive, and delete icon projects.
- **Project Metadata**: Custom prefixes (e.g., `feather-`), branding color tags, descriptions, and timestamps.
- **Dashboard**: Filter projects by status (active vs. archived), search by name/prefix, and sort by last modified or icon count.

### 🌳 Hierarchical Folder Structure
- **Unlimited Nesting**: Organize icons into nested subfolders.
- **Drag-and-Drop**: Drag icon cards directly onto folders in the sidebar to move them.
- **Tree Navigation**: Collapsible folder tree with real-time icon counts per folder.

### 🎨 SVG Icon Management
- **Multi-File & ZIP Upload**: Drag and drop batches of SVGs or entire ZIP archives (unpacks directories into matching folder hierarchy).
- **Paste Raw SVG**: Modal for directly pasting SVG code.
- **Security & Sanitization**: Validates every SVG using DOMPurify and JSDOM. Strips `<script>`, inline event handlers (`onload`, `onclick`), remote image tags, and XML entity expansion (XXE).
- **Auto-Optimization**: Integrates SVGO to optimize vector paths and strip redundant metadata, showing before/after byte sizes and savings percentage.
- **Live Detail Drawer**:
  - Multi-size live preview: 16px, 24px, 32px, 48px, 64px, 128px.
  - Background modes: Light, Dark, Checkerboard (transparency), and Custom color picker.
  - Raw SVG code editor with live syntax view and live re-render.
  - Copy as React JSX/TSX component or Vue 3 component.
  - Version history with one-click restore.
- **Conflict Handling**: Selectable duplicate strategy: Rename (auto-suffix `-1`), Replace (with version snapshot), or Skip.
- **Soft Delete & Trash**: Deleted icons go to a project Trash Bin with restore and permanent wipe options.
- **Bulk Actions**: Select multiple icons to move, tag, delete, or optimize in batch.

### ⚡ SVG Sprite Generator
- **Scopes**: Entire project, selected folder, or selected icons.
- **Sprite Modes**:
  1. **Symbol Sprite**: `<symbol>` definitions with `<use href="sprite.svg#icon-name"/>`.
  2. **Stack Sprite**: `:target` CSS stack for `<img>` tags or CSS backgrounds.
  3. **CSS Companion Sprite**: Generates `sprite.svg` alongside class definitions.
- **Customizable Options**: ID patterns (`{prefix}-{name}`), strip colors for `currentColor`, keep viewBox, remove dimensions, SVGO optimization, and internal gradient/clipPath ID namespacing to prevent clashes.
- **Interactive Visualizer**: Live in-browser specimen grid where clicking any glyph copies its `<use>` snippet.
- **Package Download**: Exports `sprite.svg`, `preview.html`, `README.md`, and optional CSS in a ZIP archive.

### 🔤 Icon Font Generator
- **Formats**: Selectable outputs for **WOFF2**, **WOFF**, **TTF**, **EOT**, and **SVG font**.
- **Stable Unicode Mapping**: Automatically assigns persistent Private Use Area codepoints (`E001`+), persisted in SQLite so rebuilding never breaks production CSS classes. Manual hex overrides supported.
- **Conversion Warning Engine**: Flags vector paths with strokes, gradients, or text elements that require filled outlines.
- **In-Browser Font Preview**: Injects generated `@font-face` WOFF2 directly into the document for live font testing.
- **Package Download**: Generates font binaries, `@font-face` CSS, SCSS, JSON glyph map, and interactive specimen HTML in a ZIP.

### 📦 Full Project Export & Import
- **ZIP Export**: Exports all SVGs preserving directory hierarchy + `manifest.json`.
- **ZIP Import**: Restores projects from archives with original tags and codepoints intact.

### 💻 Automation CLI Tool
- Run `npm run cli build "<Project Name>" --type both` to build sprites and fonts directly from terminal or CI/CD pipelines.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, better-sqlite3 (WAL mode).
- **SVG Processing**: SVGO, DOMPurify, JSDOM.
- **Font Engine**: Fantasticon (SVG to TTF, WOFF, WOFF2, EOT, CSS, SCSS, JSON).
- **Archiving**: Archiver, AdmZip.

---

## Quick Start

### 1. Requirements
- Node.js >= 18 (Pre-configured under `.tools/node` on macOS).

### 2. Install Dependencies
```bash
# In project root:
npm run build
```

### 3. Seed Sample Data
Populates the database with real UI icons across 5 nested folders:
```bash
npm run seed
```

### 4. Start Development Server
Starts the Express API server (port 3001) and Vite frontend (port 5173) concurrently:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## CLI Usage

IconVault includes a standalone CLI utility:

```bash
# List all projects
npm run cli projects

# Generate SVG Sprite & Icon Font for a project
npm run cli build "Feather Core Icons" --type both

# Generate only SVG Sprite in stack mode
npm run cli build "Feather Core Icons" --type sprite --mode stack
```

---

## Running Tests

IconVault includes comprehensive unit and integration tests:

```bash
npm test
```

Test coverage includes:
- `tests/sanitizer.test.ts`: XSS script stripping, event handler removal, XXE protection, stroke detection.
- `tests/sprite.test.ts`: Symbol sprite generation, stack sprite mode, `currentColor` conversion, ID namespacing.
- `tests/font.test.ts`: Fantasticon font pipeline, stable unicode mapping, CSS class generation.
- `tests/api.test.ts`: REST API endpoints for projects, folders, icons, and builds.

---

## REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/projects` | GET, POST | List and create projects |
| `/api/projects/:id` | GET, PUT, DELETE | Retrieve, update, or delete a project |
| `/api/projects/:id/duplicate` | POST | Duplicate project, folders, and icons |
| `/api/projects/:id/folders` | GET, POST | List and create nested folders |
| `/api/folders/:id/move` | POST | Move folder to a new parent or reorder |
| `/api/projects/:id/icons` | GET | List icons (filter by folder, search, tags) |
| `/api/projects/:id/icons/upload` | POST | Upload multiple SVGs or a ZIP archive |
| `/api/projects/:id/icons/paste` | POST | Create an icon from raw SVG code |
| `/api/icons/:id` | GET, PUT, DELETE | Details, code editor update, soft delete |
| `/api/icons/:id/optimize` | POST | Optimize individual icon with SVGO |
| `/api/icons/:id/versions/:vId/restore` | POST | Restore previous icon version |
| `/api/projects/:id/icons/batch/move` | POST | Bulk move icons to folder |
| `/api/projects/:id/icons/batch/tag` | POST | Bulk tag icons |
| `/api/projects/:id/icons/batch/optimize` | POST | Bulk SVGO optimization |
| `/api/projects/:id/build/sprite` | POST | Generate SVG sprite (symbol, stack, css) |
| `/api/projects/:id/build/font` | POST | Generate Icon Font (WOFF2, WOFF, TTF) |
| `/api/builds/:id/download` | GET | Download generated build ZIP package |
| `/api/projects/:id/export` | GET | Download full project ZIP with manifest |
| `/api/projects/import` | POST | Import project ZIP archive |
