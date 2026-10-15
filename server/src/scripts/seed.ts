import crypto from 'crypto';
import { ProjectRepo } from '../db/repositories/projectRepo.js';
import { FolderRepo } from '../db/repositories/folderRepo.js';
import { IconRepo } from '../db/repositories/iconRepo.js';
import { StorageService } from '../services/storageService.js';
import { SvgSanitizer } from '../services/svgSanitizer.js';
import { getDatabase, closeDatabase } from '../db/connection.js';

// Collection of real, clean SVG icons
const SAMPLE_ICONS = [
  // Navigation
  {
    name: 'Home',
    folder: 'Navigation',
    tags: ['nav', 'main', 'house', 'dashboard'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  },
  {
    name: 'Compass',
    folder: 'Navigation',
    tags: ['nav', 'direction', 'explore', 'map'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`
  },
  {
    name: 'Map Pin',
    folder: 'Navigation',
    tags: ['nav', 'location', 'place', 'marker'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
  },
  {
    name: 'Menu',
    folder: 'Navigation',
    tags: ['nav', 'hamburger', 'drawer', 'options'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`
  },
  {
    name: 'Arrow Right',
    folder: 'Navigation',
    tags: ['nav', 'arrow', 'forward', 'next'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
  },
  {
    name: 'Arrow Left',
    folder: 'Navigation',
    tags: ['nav', 'arrow', 'back', 'previous'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`
  },
  {
    name: 'Chevron Down',
    folder: 'Navigation',
    tags: ['nav', 'arrow', 'dropdown', 'expand'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
  },

  // Actions
  {
    name: 'Search',
    folder: 'Actions',
    tags: ['action', 'find', 'magnifier', 'explore'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
  },
  {
    name: 'Edit',
    folder: 'Actions',
    tags: ['action', 'pen', 'write', 'modify'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`
  },
  {
    name: 'Trash',
    folder: 'Actions',
    tags: ['action', 'delete', 'remove', 'bin'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`
  },
  {
    name: 'Plus',
    folder: 'Actions',
    tags: ['action', 'add', 'create', 'new'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`
  },
  {
    name: 'Check',
    folder: 'Actions',
    tags: ['action', 'confirm', 'success', 'done', 'tick'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  },
  {
    name: 'X',
    folder: 'Actions',
    tags: ['action', 'close', 'cancel', 'cross'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`
  },
  {
    name: 'Download',
    folder: 'Actions',
    tags: ['action', 'export', 'save', 'file'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`
  },
  {
    name: 'Share',
    folder: 'Actions',
    tags: ['action', 'network', 'send', 'social'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`
  },
  {
    name: 'Copy',
    folder: 'Actions',
    tags: ['action', 'clipboard', 'duplicate'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
  },
  {
    name: 'Settings',
    folder: 'Actions',
    tags: ['action', 'cog', 'gear', 'preferences'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`
  },

  // Media
  {
    name: 'Play',
    folder: 'Media',
    tags: ['media', 'video', 'music', 'start'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
  },
  {
    name: 'Pause',
    folder: 'Media',
    tags: ['media', 'stop', 'hold'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>`
  },
  {
    name: 'Volume',
    folder: 'Media',
    tags: ['media', 'sound', 'audio', 'speaker'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
  },
  {
    name: 'Camera',
    folder: 'Media',
    tags: ['media', 'photo', 'picture', 'snapshot'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`
  },
  {
    name: 'Image',
    folder: 'Media',
    tags: ['media', 'gallery', 'photo'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
  },

  // Communication
  {
    name: 'Mail',
    folder: 'Communication',
    tags: ['comm', 'email', 'message', 'inbox'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
  },
  {
    name: 'Bell',
    folder: 'Communication',
    tags: ['comm', 'notification', 'alarm', 'alert'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
  },
  {
    name: 'Send',
    folder: 'Communication',
    tags: ['comm', 'submit', 'message', 'paper-plane'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
  },

  // Status & Security
  {
    name: 'Shield',
    folder: 'Status',
    tags: ['security', 'protect', 'safe', 'guard'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`
  },
  {
    name: 'Lock',
    folder: 'Status',
    tags: ['security', 'auth', 'private', 'secure'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
  },
  {
    name: 'Star',
    folder: 'Status',
    tags: ['status', 'favorite', 'rating', 'badge'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  },
  {
    name: 'Heart',
    folder: 'Status',
    tags: ['status', 'love', 'like', 'health'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
  },
  {
    name: 'Alert Circle',
    folder: 'Status',
    tags: ['status', 'warning', 'error', 'danger'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`
  }
];

const ECOMMERCE_ICONS = [
  {
    name: 'Shopping Cart',
    folder: 'Store',
    tags: ['shop', 'cart', 'buy', 'checkout'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`
  },
  {
    name: 'Shopping Bag',
    folder: 'Store',
    tags: ['shop', 'bag', 'purchase'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`
  },
  {
    name: 'Credit Card',
    folder: 'Payments',
    tags: ['pay', 'finance', 'money', 'billing'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
  },
  {
    name: 'Tag',
    folder: 'Store',
    tags: ['shop', 'price', 'discount', 'label'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`
  },
  {
    name: 'Truck',
    folder: 'Delivery',
    tags: ['shipping', 'order', 'delivery', 'transport'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`
  },
  {
    name: 'User',
    folder: 'Customer',
    tags: ['account', 'profile', 'member', 'person'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  }
];

export async function seedDatabase() {
  getDatabase();
  console.log('--- Seeding IconVault Database ---');

  // Check if projects already exist
  const existingProjects = ProjectRepo.findAll();
  if (existingProjects.length > 0) {
    console.log(`Database already has ${existingProjects.length} projects. Skipping seed or appending.`);
    return;
  }

  // Project 1: Feather Core
  const p1 = ProjectRepo.create({
    name: 'Feather Core Icons',
    description: 'Essential UI icons crafted with clean vector paths for navigation, actions, media, and status.',
    prefix: 'feather',
    color: '#3b82f6',
    settings_json: JSON.stringify({
      svgo: { enabled: true, multipass: true },
      font: { fontName: 'FeatherIcons', startCodepoint: 'E001' }
    })
  });
  StorageService.initProjectStorage(p1.id);

  // Folders for Project 1
  const folderNames = ['Navigation', 'Actions', 'Media', 'Communication', 'Status'];
  const folderMap = new Map<string, string>();

  folderNames.forEach((name, idx) => {
    const f = FolderRepo.create({
      projectId: p1.id,
      name,
      orderIndex: idx
    });
    folderMap.set(name, f.id);
  });

  // Insert icons for Project 1
  for (const item of SAMPLE_ICONS) {
    const sanitized = SvgSanitizer.sanitize(item.svg);
    const iconId = crypto.randomUUID();
    const { filePath, byteSize } = StorageService.saveIconSvg(p1.id, iconId, sanitized.sanitizedSvg);
    const codepoint = IconRepo.getNextAvailableCodepoint(p1.id);
    const slug = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    IconRepo.create({
      projectId: p1.id,
      folderId: folderMap.get(item.folder) || null,
      name: item.name,
      slug,
      svgPath: filePath,
      tags: item.tags,
      byteSize,
      originalByteSize: byteSize,
      codepoint,
      width: sanitized.width,
      height: sanitized.height,
      viewBox: sanitized.viewBox,
      hasStroke: sanitized.hasStroke,
      hasGradient: sanitized.hasGradient,
      hasText: sanitized.hasText
    });
  }

  console.log(`✓ Created project: "${p1.name}" with ${SAMPLE_ICONS.length} icons in 5 folders.`);

  // Project 2: E-Commerce UI
  const p2 = ProjectRepo.create({
    name: 'E-Commerce Storefront',
    description: 'Icons for product checkout, carts, payments, customer accounts, and shipment tracking.',
    prefix: 'shop',
    color: '#10b981',
    settings_json: JSON.stringify({
      svgo: { enabled: true, multipass: true },
      font: { fontName: 'ShopIcons', startCodepoint: 'E100' }
    })
  });
  StorageService.initProjectStorage(p2.id);

  const ecomFolders = ['Store', 'Payments', 'Delivery', 'Customer'];
  const ecomFolderMap = new Map<string, string>();
  ecomFolders.forEach((name, idx) => {
    const f = FolderRepo.create({
      projectId: p2.id,
      name,
      orderIndex: idx
    });
    ecomFolderMap.set(name, f.id);
  });

  for (const item of ECOMMERCE_ICONS) {
    const sanitized = SvgSanitizer.sanitize(item.svg);
    const iconId = crypto.randomUUID();
    const { filePath, byteSize } = StorageService.saveIconSvg(p2.id, iconId, sanitized.sanitizedSvg);
    const codepoint = IconRepo.getNextAvailableCodepoint(p2.id, 'E100');
    const slug = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    IconRepo.create({
      projectId: p2.id,
      folderId: ecomFolderMap.get(item.folder) || null,
      name: item.name,
      slug,
      svgPath: filePath,
      tags: item.tags,
      byteSize,
      originalByteSize: byteSize,
      codepoint,
      width: sanitized.width,
      height: sanitized.height,
      viewBox: sanitized.viewBox,
      hasStroke: sanitized.hasStroke,
      hasGradient: sanitized.hasGradient,
      hasText: sanitized.hasText
    });
  }

  console.log(`✓ Created project: "${p2.name}" with ${ECOMMERCE_ICONS.length} icons in 4 folders.`);
  console.log('--- Seeding Completed Successfully ---');
}

// Execute if run directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      closeDatabase();
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed error:', err);
      closeDatabase();
      process.exit(1);
    });
}
