import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { IconRepo } from '../db/repositories/iconRepo.js';
import { SpriteBuilder } from '../services/spriteBuilder.js';
import { FontBuilder } from '../services/fontBuilder.js';
import { StorageService } from '../services/storageService.js';
import { getDatabase, closeDatabase } from '../db/connection.js';

async function main() {
  getDatabase();

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
IconVault CLI Tool

Usage:
  iconvault projects                           List all projects
  iconvault build <projectId|name> [options]   Generate sprite and/or font for project

Options:
  --type <sprite|font|both>                    Build type (default: both)
  --mode <symbol|stack|css>                    Sprite mode (default: symbol)
  --name <fontName>                            Font name (default: from project)
  --prefix <prefix>                            CSS/symbol prefix (default: from project)
`);
    closeDatabase();
    process.exit(0);
  }

  if (command === 'projects') {
    const projects = ProjectRepo.findAll();
    console.log('\nIconVault Projects:');
    console.log('--------------------------------------------------');
    for (const p of projects) {
      console.log(`• [${p.id}] ${p.name} (${p.icon_count} icons) - Prefix: ${p.prefix}`);
    }
    console.log('--------------------------------------------------\n');
    closeDatabase();
    process.exit(0);
  }

  if (command === 'build') {
    const projectIdentifier = args[1];
    if (!projectIdentifier) {
      console.error('Error: Please specify a project ID or name.');
      closeDatabase();
      process.exit(1);
    }

    // Find project by ID or name
    let project = ProjectRepo.findById(projectIdentifier);
    if (!project) {
      const all = ProjectRepo.findAll();
      project = all.find(p => p.name.toLowerCase() === projectIdentifier.toLowerCase()) || null;
    }

    if (!project) {
      console.error(`Error: Project "${projectIdentifier}" not found.`);
      closeDatabase();
      process.exit(1);
    }

    // Parse options
    const typeArgIdx = args.indexOf('--type');
    const buildType = typeArgIdx !== -1 ? args[typeArgIdx + 1] : 'both';

    const modeArgIdx = args.indexOf('--mode');
    const spriteMode = (modeArgIdx !== -1 ? args[modeArgIdx + 1] : 'symbol') as 'symbol' | 'stack' | 'css';

    const { icons } = IconRepo.findMany(project.id, { includeDeleted: false });
    if (icons.length === 0) {
      console.warn(`Project "${project.name}" has no active icons to build.`);
      closeDatabase();
      process.exit(0);
    }

    console.log(`\nBuilding assets for project: "${project.name}" (${icons.length} icons)...`);

    if (buildType === 'sprite' || buildType === 'both') {
      console.log(`→ Generating SVG Sprite (${spriteMode} mode)...`);
      const inputIcons = icons.map(icon => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        svgContent: StorageService.readIconSvg(icon.svg_path)
      }));

      const spriteRes = await SpriteBuilder.build(project.id, project.prefix, inputIcons, {
        mode: spriteMode,
        idPattern: '{prefix}-{name}',
        stripColors: false,
        keepViewBox: true,
        removeDimensions: true,
        svgo: true,
        namespaceIds: true
      });

      console.log(`✓ Sprite built successfully!`);
      console.log(`  Package: ${spriteRes.zipPath}`);
      console.log(`  Total Icons: ${spriteRes.iconCount}`);
      console.log(`  Sprite Size: ${(spriteRes.spriteSize / 1024).toFixed(2)} KB (Savings: ${spriteRes.savingsPercent}%)`);
    }

    if (buildType === 'font' || buildType === 'both') {
      console.log(`→ Generating Icon Font (TTF, WOFF, WOFF2)...`);
      const inputIcons = icons.map(icon => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        svgContent: StorageService.readIconSvg(icon.svg_path),
        codepoint: icon.codepoint,
        hasStroke: !!icon.has_stroke,
        hasGradient: !!icon.has_gradient,
        hasText: !!icon.has_text
      }));

      const fontRes = await FontBuilder.build(project.id, inputIcons, {
        formats: ['woff2', 'woff', 'ttf'],
        fontName: project.name.replace(/[^a-zA-Z0-9]/g, '') || 'IconFont',
        prefix: `${project.prefix}-`,
        baseClass: project.prefix,
        startCodepoint: 'E001',
        fontHeight: 1000,
        descent: 0,
        normalize: true
      });

      console.log(`✓ Icon Font built successfully!`);
      console.log(`  Package: ${fontRes.zipPath}`);
      console.log(`  Total Glyphs: ${fontRes.iconCount}`);
      console.log(`  Font Package Size: ${(fontRes.totalSize / 1024).toFixed(2)} KB`);
      if (fontRes.warnings.length > 0) {
        console.warn(`  Warnings (${fontRes.warnings.length}):`);
        for (const w of fontRes.warnings.slice(0, 3)) {
          console.warn(`    - [${w.iconName}]: ${w.warning}`);
        }
      }
    }

    console.log(`\n✓ All builds completed successfully.\n`);
    closeDatabase();
    process.exit(0);
  }

  console.error(`Unknown command: ${command}. Run "iconvault --help" for usage.`);
  closeDatabase();
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  closeDatabase();
  process.exit(1);
});
