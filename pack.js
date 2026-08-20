import fs from 'fs';

const fileMetadata = {
  'manifest.json': { category: 'manifest', description: 'Manifest V3 configuration declaring background service worker, permissions, and declarative rules.' },
  'background/service-worker.js': { category: 'background', description: 'Background service worker managing download queue, alarms, storage sync, and offscreen doc.' },
  'utils/manga_adapters.js': { category: 'utils', description: 'Site-specific extraction adapters (MangaDex, Manganato, AsuraScans, and Generic Scraper).' },
  'utils/download_queue.js': { category: 'utils', description: 'Chunked concurrent download queue engine with rate limit throttling and auto-retry.' },
  'content/content_script.js': { category: 'content', description: 'Injected content script with 3-state floating badge (contracted icon, hover bar, clicked popup tab).' },
  'content/content_script.css': { category: 'content', description: 'Neo-brutalist & smooth animation styles for the floating badge and expanded popup window.' },
  'popup/popup.html': { category: 'popup', description: 'Extension popup user interface supporting Single Chapter (LV1), Multi-Chapter Batch (LV2), and Active Queue.' },
  'popup/popup.js': { category: 'popup', description: 'Extension popup controller handling tab scraping, LV2 batch scans, format selection, and queue triggers.' },
  'popup/popup.css': { category: 'popup', description: 'Theme stylesheets supporting dark/light neo-brutalist styling.' },
  'options/options.html': { category: 'options', description: 'Options settings page for configuring rate limits, concurrency, and filename templates.' },
  'options/options.js': { category: 'options', description: 'Settings persistence manager storing preferences in chrome.storage.local.' },
  'options/options.css': { category: 'options', description: 'Options page styling matching extension aesthetic.' },
  'offscreen/offscreen.html': { category: 'background', description: 'Offscreen document host for memory-intensive DOM parsing, JSZip compression, and PDF generation.' },
  'offscreen/offscreen.js': { category: 'background', description: 'Offscreen worker script orchestrating JSZip compression and jsPDF image compilation.' },
  'lib/jszip.min.js': { category: 'lib', description: 'JSZip library for creating CBZ and ZIP archives.' },
  'lib/jspdf_builder.js': { category: 'lib', description: 'Lightweight PDF archive builder bundling sequential images.' },
  'README.md': { category: 'docs', description: 'Complete installation instructions, architecture overview, and developer documentation.' },
  'icons/icon16.png': { category: 'icons', description: '16x16 extension toolbar icon.' },
  'icons/icon48.png': { category: 'icons', description: '48x48 extension management icon.' },
  'icons/icon128.png': { category: 'icons', description: '128x128 Chrome Web Store icon.' },
};

let out = `import { ExtensionFile } from '../types/extension';

export const EXTENSION_FILES: ExtensionFile[] = [
`;

for (const [p, meta] of Object.entries(fileMetadata)) {
  if (p.startsWith('icons/')) {
    out += `  {
    path: '${p}',
    content: '',
    isBase64: true,
    category: '${meta.category}',
    description: ${JSON.stringify(meta.description)}
  },
`;
    continue;
  }
  
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8');
    out += `  {
    path: '${p}',
    content: ${JSON.stringify(content)},
    category: '${meta.category}',
    description: ${JSON.stringify(meta.description)}
  },
`;
  }
}

out += `];
`;

fs.writeFileSync('src/data/extensionCodebase.ts', out);
console.log('Done packing extension files!');

