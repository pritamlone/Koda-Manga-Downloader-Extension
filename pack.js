import fs from 'fs';

const paths = [
    'manifest.json',
    'background/service-worker.js',
    'utils/manga_adapters.js',
    'utils/download_queue.js',
    'content/content_script.js',
    'content/content_script.css',
    'popup/popup.html',
    'popup/popup.js',
    'popup/popup.css',
    'options/options.html',
    'options/options.js',
    'options/options.css',
    'offscreen/offscreen.html',
    'offscreen/offscreen.js',
    'lib/jszip.min.js',
    'lib/jspdf_builder.js',
    'README.md',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
];

let out = `import { ExtensionFile } from '../types/extension';

export const EXTENSION_FILES: ExtensionFile[] = [
`;

for (const p of paths) {
  if (p.startsWith('icons/')) {
    out += `  {
    path: '${p}',
    content: '',
    isBase64: true,
    category: 'icons',
    description: ''
  },
`;
    continue;
  }
  
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8');
    out += `  {
    path: '${p}',
    content: ${JSON.stringify(content)},
    category: 'utils',
    description: ''
  },
`;
  }
}

out += `];
`;

fs.writeFileSync('src/data/extensionCodebase.ts', out);
console.log('Done!');
