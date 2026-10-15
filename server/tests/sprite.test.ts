import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { SpriteBuilder } from '../src/services/spriteBuilder.js';

describe('SpriteBuilder', () => {
  const sampleIcons = [
    {
      id: 'icon-1',
      name: 'Star',
      slug: 'star',
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>`
    },
    {
      id: 'icon-2',
      name: 'Heart',
      slug: 'heart',
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="grad"><stop offset="0%" stop-color="red"/></linearGradient></defs><path fill="url(#grad)" d="M12 21l-1-1C5 15 2 12 2 8a5 5 0 0110-3 5 5 0 0110 3c0 4-3 7-9 12z"/></svg>`
    }
  ];

  it('should generate a valid symbol sprite with custom ID pattern', async () => {
    const result = await SpriteBuilder.build(
      'test-project-1',
      'ui',
      sampleIcons,
      {
        mode: 'symbol',
        idPattern: '{prefix}-{name}',
        stripColors: false,
        keepViewBox: true,
        removeDimensions: true,
        svgo: true,
        namespaceIds: true
      }
    );

    expect(result.iconCount).toBe(2);
    expect(result.spriteSvg).toContain('<svg');
    expect(result.spriteSvg).toContain('<symbol id="ui-star"');
    expect(result.spriteSvg).toContain('<symbol id="ui-heart"');
    expect(result.symbols[0].snippet).toContain('sprite.svg#ui-star');
    expect(fs.existsSync(result.zipPath)).toBe(true);

    // Clean up
    fs.unlinkSync(result.zipPath);
  });

  it('should generate a stack sprite with :target styles', async () => {
    const result = await SpriteBuilder.build(
      'test-project-2',
      'icon',
      sampleIcons,
      {
        mode: 'stack',
        idPattern: '{name}',
        stripColors: false,
        keepViewBox: true,
        removeDimensions: true,
        svgo: false,
        namespaceIds: false
      }
    );

    expect(result.spriteSvg).toContain(':root > svg:target');
    expect(result.spriteSvg).toContain('<svg id="star"');
    expect(result.spriteSvg).toContain('<svg id="heart"');

    // Clean up
    fs.unlinkSync(result.zipPath);
  });

  it('should convert fills to currentColor when stripColors is true', async () => {
    const result = await SpriteBuilder.build(
      'test-project-3',
      'icon',
      [sampleIcons[0]],
      {
        mode: 'symbol',
        idPattern: '{name}',
        stripColors: true,
        keepViewBox: true,
        removeDimensions: true,
        svgo: false,
        namespaceIds: false
      }
    );

    expect(result.spriteSvg).toContain('currentColor');

    // Clean up
    fs.unlinkSync(result.zipPath);
  });
});
