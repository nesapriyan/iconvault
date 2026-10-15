import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/index.js';
import { ImporterService } from '../src/services/importerService.js';
import { ProjectRepo } from '../src/db/repositories/projectRepo.js';

describe('ImporterService and Import Endpoints', () => {
  let projectId: string;

  beforeAll(() => {
    const proj = ProjectRepo.create({
      name: 'Import Test Project',
      prefix: 'imp',
      purpose: 'sprite'
    });
    projectId = proj.id;
  });

  afterAll(() => {
    if (projectId) {
      ProjectRepo.delete(projectId);
    }
  });

  describe('Sprite Extraction', () => {
    it('should extract symbols from standard SVG sprite', () => {
      const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <symbol id="icon-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></symbol>
        <symbol id="icon-close" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
      </svg>`;

      const extracted = ImporterService.extractFromSprite(spriteSvg);
      expect(extracted).toHaveLength(2);
      expect(extracted[0].name).toBe('icon-search');
      expect(extracted[0].svgContent).toContain('viewBox="0 0 24 24"');
      expect(extracted[0].svgContent).toContain('<circle');
      expect(extracted[1].name).toBe('icon-close');
    });

    it('should extract groups with ids from defs sprite', () => {
      const defsSprite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <defs>
          <g id="check-icon"><path d="M5 12l5 5L20 7"/></g>
        </defs>
      </svg>`;

      const extracted = ImporterService.extractFromSprite(defsSprite);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].name).toBe('check-icon');
      expect(extracted[0].svgContent).toContain('id="check-icon"');
    });
  });

  describe('Mapping Parser', () => {
    it('should parse CSS mappings', () => {
      const css = `
        .icon-star:before { content: "\\e001"; }
        .fa-heart:before { content: "\\e002"; }
      `;
      const map = ImporterService.parseMapping(css);
      expect(map.get('e001')).toBe('star');
      expect(map.get('e002')).toBe('heart');
    });

    it('should parse JSON mappings', () => {
      const json = JSON.stringify({ star: 57345, heart: 'E002' });
      const map = ImporterService.parseMapping(json);
      expect(map.get('e001')).toBe('star');
      expect(map.get('e002')).toBe('heart');
    });
  });

  describe('API: POST /api/projects/:id/icons/import-sprite', () => {
    it('should import sprite via raw markup', async () => {
      const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <symbol id="nav-home" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
      </svg>`;

      const res = await request(app)
        .post(`/api/projects/${projectId}/icons/import-sprite`)
        .send({ rawSpriteSvg: spriteSvg });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadedCount).toBe(1);
      expect(res.body.data.uploaded[0].name).toBe('nav-home');
    });
  });

  describe('Font Extraction and API', () => {
    const ttfPath = '/Users/NESAPRIYANMANI/testing/iconvault/storage/projects/064a72d5-366d-4308-9706-a6992f7e608f/builds/font-8a8dc728-b471-400d-931e-b8307a405e3e/GlyphStudioUpdated.ttf';

    it('should extract glyphs from existing TTF font', async () => {
      if (!fs.existsSync(ttfPath)) return;
      const buffer = fs.readFileSync(ttfPath);
      const glyphs = await ImporterService.extractFromFont(buffer, 'test.ttf');
      expect(glyphs.length).toBeGreaterThan(0);
      expect(glyphs[0].svgContent).toContain('<svg');
      expect(glyphs[0].svgContent).toContain('<path');
      expect(glyphs[0].name).toBeDefined();
    });

    it('should import font file via API', async () => {
      if (!fs.existsSync(ttfPath)) return;
      const buffer = fs.readFileSync(ttfPath);

      const res = await request(app)
        .post(`/api/projects/${projectId}/icons/import-font`)
        .attach('fontFile', buffer, 'icons.ttf')
        .field('duplicateStrategy', 'rename');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadedCount).toBeGreaterThan(0);
    });
  });
});
