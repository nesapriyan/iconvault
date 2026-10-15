import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { FontBuilder } from '../src/services/fontBuilder.js';

describe('FontBuilder', () => {
  const sampleIcons = [
    {
      id: 'icon-1',
      name: 'Star',
      slug: 'star',
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
      codepoint: 'E001',
      hasStroke: false,
      hasGradient: false,
      hasText: false
    },
    {
      id: 'icon-2',
      name: 'Heart',
      slug: 'heart',
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
      codepoint: null, // Will auto-increment to E002
      hasStroke: true,
      hasGradient: false,
      hasText: false
    }
  ];

  it('should generate fonts with stable unicode mapping and CSS', async () => {
    const result = await FontBuilder.build(
      'test-font-project',
      sampleIcons,
      {
        formats: ['woff2', 'woff', 'ttf'],
        fontName: 'CustomIcons',
        prefix: 'ci-',
        baseClass: 'ci',
        startCodepoint: 'E001',
        fontHeight: 1000,
        descent: 0,
        normalize: true
      }
    );

    expect(result.iconCount).toBe(2);
    expect(result.cssContent).toContain('@font-face');
    expect(result.cssContent).toContain('.ci-star');
    expect(result.cssContent).toContain('.ci-heart');
    expect(result.codepoints.find(c => c.slug === 'star')?.codepoint).toBe('E001');
    expect(result.codepoints.find(c => c.slug === 'heart')?.codepoint).toBe('E002');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(fs.existsSync(result.zipPath)).toBe(true);

    // Clean up
    fs.unlinkSync(result.zipPath);
  });
});
