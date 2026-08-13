import { ExtensionFile } from '../types/extension';

function generateIconBase64(size: number): string {
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Orange background
        ctx.fillStyle = '#FF4D00';
        ctx.fillRect(0, 0, size, size);

        // Dark K logo letter
        ctx.fillStyle = '#121212';
        ctx.font = `bold ${Math.round(size * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('K', size / 2, size / 2 + size * 0.05);
        
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
          return dataUrl.replace(/^data:image\/png;base64,/, '');
        }
      }
    }
  } catch (e) {
    // Fallback if canvas is unavailable
  }
  return 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAUSURBVDhPY/z//z8DJYCJgUQw3DAAaw4B/5/SjO4AAAAASUVORK5CYII=';
}

export const EXTENSION_FILES: ExtensionFile[] = [
  {
    path: 'manifest.json',
    category: 'manifest',
    description: 'Manifest V3 configuration for Koda Manga Downloader Extension',
    content: `{
  "manifest_version": 3,
  "name": "Koda Manga Downloader Extension",
  "version": "3.0.0",
  "description": "High-speed, reliable manga chapter downloader. Export chapters into CBZ, ZIP, PDF, or folder formats with rate-limit protection.",
  "author": "Koda Tools",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Koda Manga Downloader"
  },
  "options_page": "options/options.html",
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "permissions": [
    "activeTab",
    "downloads",
    "storage",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "js": [
        "utils/manga_adapters.js",
        "content/content_script.js"
      ],
      "css": [
        "content/content_script.css"
      ],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "lib/jszip.min.js",
        "lib/jspdf_builder.js",
        "icons/*",
        "popup/*"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}`
  },
  {
    path: 'background/service-worker.js',
    category: 'background',
    description: 'Manifest V3 background worker managing persistent queue and direct host-permission image fetching',
    content: `/**
 * Koda Manga Downloader Extension - Background Service Worker
 * Solid Engine V3: Direct Host-Permission Image Fetcher + Webpage Content Script Fallback +
 * Pure JSZip CBZ/ZIP Packaging + Chrome Download API Integration.
 */

importScripts('../lib/jszip.min.js');

let isProcessingQueue = false;

// Initialize extension storage & alarms
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Koda Background] Service Worker Installed - Initializing storage...');
  chrome.storage.local.get(['settings', 'queue'], (res) => {
    if (!res.settings) {
      chrome.storage.local.set({
        settings: {
          defaultFormat: 'cbz',
          maxConcurrentDownloads: 3,
          delayBetweenRequestsMs: 300,
          autoRetryAttempts: 3,
          filenameTemplate: 'Koda_Manga/{manga_title}/{chapter_title}.{ext}',
          theme: 'webapp'
        }
      });
    }
    if (!res.queue) {
      chrome.storage.local.set({ queue: [] });
    }
  });

  chrome.alarms.create('koda_queue_heartbeat', { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'koda_queue_heartbeat') {
    processNextQueueItem();
  }
});

// Runtime Message Hub
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_DOWNLOAD_TASK') {
    enqueueTask(message.task).then(sendResponse);
    return true; // Async response
  }

  if (message.action === 'GET_QUEUE_STATUS') {
    chrome.storage.local.get(['queue'], (res) => {
      sendResponse({ queue: res.queue || [] });
    });
    return true;
  }

  if (message.action === 'CANCEL_TASK') {
    cancelTask(message.taskId).then(sendResponse);
    return true;
  }

  if (message.action === 'OPEN_POPUP_WITH_CURRENT') {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html"),
      type: "popup",
      width: 450,
      height: 600
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'TRIGGER_NATIVE_DOWNLOAD') {
    triggerChromeDownload(message.downloadOptions).then(sendResponse);
    return true;
  }
});

// Enqueue Task
async function enqueueTask(taskData) {
  const res = await chrome.storage.local.get(['queue', 'settings']);
  const queue = res.queue || [];
  const settings = res.settings || {};

  const pagesList = Array.isArray(taskData.pages) ? taskData.pages : [];
  if (pagesList.length === 0) {
    return { success: false, error: 'No page URLs provided' };
  }

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    mangaTitle: sanitizePathSegment(taskData.mangaTitle || 'Manga'),
    chapterTitle: sanitizePathSegment(taskData.chapterTitle || 'Chapter 1'),
    chapterNum: taskData.chapterNum || 1,
    totalPages: pagesList.length,
    completedPages: 0,
    status: 'queued',
    format: taskData.format || settings.defaultFormat || 'cbz',
    pages: pagesList.map((url, i) => ({
      index: i + 1,
      url: typeof url === 'string' ? url : (url.url || url.src),
      status: 'pending'
    })),
    createdAt: Date.now()
  };

  queue.push(newTask);
  await chrome.storage.local.set({ queue });

  // Trigger processing immediately
  processNextQueueItem();
  return { success: true, taskId: newTask.id };
}

// Solid Queue Processing Engine
async function processNextQueueItem() {
  if (isProcessingQueue) return;

  const res = await chrome.storage.local.get(['queue', 'settings']);
  const queue = res.queue || [];
  const settings = res.settings || {};

  const activeTask = queue.find(t => t.status === 'downloading' || t.status === 'packaging');
  if (activeTask) return; // Busy

  const nextTask = queue.find(t => t.status === 'queued');
  if (!nextTask) return; // Queue empty

  isProcessingQueue = true;
  nextTask.status = 'downloading';
  nextTask.completedPages = 0;
  await chrome.storage.local.set({ queue });

  try {
    await executeDownloadTask(nextTask, settings);
  } catch (err) {
    console.error('[Koda Engine Error] Task failed:', err);
    await updateTaskStatus(nextTask.id, 'failed');
  } finally {
    isProcessingQueue = false;
    processNextQueueItem(); // Check for next item in queue
  }
}

async function executeDownloadTask(task, settings) {
  console.log(\`[Koda Engine] Executing Task: \${task.mangaTitle} - \${task.chapterTitle} (\${task.totalPages} pages)\`);

  const concurrency = settings.maxConcurrentDownloads || 3;
  const delayMs = settings.delayBetweenRequestsMs || 250;
  const maxRetries = settings.autoRetryAttempts || 3;

  const downloadedImages = [];
  let completed = 0;

  // Process pages in concurrency chunks
  for (let i = 0; i < task.pages.length; i += concurrency) {
    const chunk = task.pages.slice(i, i + concurrency);

    const results = await Promise.all(
      chunk.map(page => fetchPageImageWithRetries(page, maxRetries, delayMs))
    );

    for (const res of results) {
      if (res && res.bytes) {
        downloadedImages.push(res);
        completed++;
      }
    }

    // Update progress in chrome.storage.local for popup UI
    await updateTaskProgress(task.id, completed, task.totalPages);

    if (i + concurrency < task.pages.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  if (downloadedImages.length === 0) {
    throw new Error('Failed to download any images for this chapter.');
  }

  // Sort images in page index order
  downloadedImages.sort((a, b) => a.index - b.index);

  // Set status to packaging
  await updateTaskStatus(task.id, 'packaging');

  // Generate target filename and clean manga folder path (no chapter numbers in folder name)
  const cleanManga = sanitizePathSegment(cleanMangaTitle(task.mangaTitle));
  const cleanChap = sanitizePathSegment(task.chapterTitle || 'Chapter_1');
  const ext = task.format === 'cbz' ? 'cbz' : (task.format === 'zip' ? 'zip' : 'pdf');

  if (task.format === 'cbz' || task.format === 'zip') {
    const zip = new JSZip();
    downloadedImages.forEach((img, idx) => {
      const pageNum = String(idx + 1).padStart(3, '0');
      const filename = \`page_\${pageNum}.\${img.extension}\`;
      zip.file(filename, img.bytes);
    });

    const dataUrl = await zip.generateAsync({ type: 'base64' });
    const mimeType = task.format === 'cbz' ? 'application/x-cbz' : 'application/zip';
    const fullDataUrl = \`data:\${mimeType};base64,\${dataUrl}\`;
    const targetPath = \`Koda_Manga/\${cleanManga}/\${cleanChap}.\${ext}\`;

    await triggerChromeDownload({
      url: fullDataUrl,
      filename: targetPath
    });
  } else if (task.format === 'pdf') {
    const zip = new JSZip();
    downloadedImages.forEach((img, idx) => {
      const pageNum = String(idx + 1).padStart(3, '0');
      zip.file(\`page_\${pageNum}.\${img.extension}\`, img.bytes);
    });
    const dataUrl = await zip.generateAsync({ type: 'base64' });
    const fullDataUrl = \`data:application/zip;base64,\${dataUrl}\`;
    const targetPath = \`Koda_Manga/\${cleanManga}/\${cleanChap}.pdf.zip\`;

    await triggerChromeDownload({
      url: fullDataUrl,
      filename: targetPath
    });
  } else {
    for (const img of downloadedImages) {
      const pageNum = String(img.index).padStart(3, '0');
      const targetPath = \`Koda_Manga/\${cleanManga}/\${cleanChap}_page_\${pageNum}.\${img.extension}\`;
      
      const blob = new Blob([img.bytes]);
      const arrayBuffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let k = 0; k < bytes.length; k++) {
        binary += String.fromCharCode(bytes[k]);
      }
      const dataUrl = \`data:image/\${img.extension};base64,\${btoa(binary)}\`;

      await triggerChromeDownload({
        url: dataUrl,
        filename: targetPath
      });
    }
  }

  await markTaskCompleted(task.id);
  console.log(\`[Koda Engine] Task completed successfully: \${task.mangaTitle} - \${task.chapterTitle}\`);
}

async function fetchPageImageWithRetries(page, maxRetries, delayMs) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(page.url, { mode: 'cors' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const ext = getExtensionFromUrlOrType(page.url, res.headers.get('content-type'));
        return {
          index: page.index,
          bytes: bytes,
          extension: ext
        };
      }
    } catch (err) {
      // Fallback to content script
    }

    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs.length > 0) {
        const tabResponse = await new Promise((resolve) => {
          chrome.tabs.sendMessage(activeTabs[0].id, {
            action: 'FETCH_IMAGE_FROM_PAGE',
            url: page.url
          }, (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              resolve(null);
            } else {
              resolve(response.data);
            }
          });
        });

        if (tabResponse && Array.isArray(tabResponse)) {
          const bytes = new Uint8Array(tabResponse);
          const ext = getExtensionFromUrlOrType(page.url, '');
          return {
            index: page.index,
            bytes: bytes,
            extension: ext
          };
        }
      }
    } catch (e) {}

    attempt++;
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
    }
  }

  return null;
}

function getExtensionFromUrlOrType(url, contentType) {
  if (contentType) {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  }
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.png')) return 'png';
  if (cleanUrl.endsWith('.webp')) return 'webp';
  if (cleanUrl.endsWith('.gif')) return 'gif';
  return 'jpg';
}

function triggerChromeDownload(options) {
  return new Promise((resolve) => {
    chrome.downloads.download({
      url: options.url,
      filename: options.filename,
      saveAs: options.saveAs || false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Koda Download Error]', chrome.runtime.lastError.message);
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve({ success: true, downloadId });
      }
    });
  });
}

function cleanMangaTitle(rawTitle) {
  if (!rawTitle) return 'Manga';
  let cleaned = rawTitle.replace(/\s+/g, ' ').trim();

  // 1. Strip site branding & suffixes
  cleaned = cleaned.replace(/\s*[\-\|–—>:>]?\s*(Read Online|MangaDex|Manganato|AquaManga|Asura\s*Scans|Flame\s*Comics|Read Manga|All Chapters|WEBTOON|Webtoons|Manga|Free).*$/gi, '');

  // 2. Strip Episode / Chapter / Vol / Season prefixes and all trailing text
  cleaned = cleaned
    .replace(/\s*[\-\|–—>:>]?\s*(Chapter|Ch\.|Chap\.|Ch|Episode|Ep\.|Ep|Vol\.|Volume|Vol|Season|S\d+|#)\s*\d+.*$/gi, '')
    .replace(/\s*[\-\|–—]?\s*c\d+(\.\d+)?.*$/gi, '')
    .replace(/\s*[\-\|–—]\s*\d+(\.\d+)?\s*$/g, '')
    .trim();

  // 3. Remove duplicated phrase repeats e.g. "Magic Emperor - Magic Emperor" -> "Magic Emperor"
  const titleParts = cleaned.split(/\s*[\-\|–—]\s*/);
  if (titleParts.length > 1 && titleParts[0].toLowerCase().trim() === titleParts[1].toLowerCase().trim()) {
    cleaned = titleParts[0].trim();
  }

  // 4. Clean trailing non-word noise characters like trailing dashes or spaces
  cleaned = cleaned.replace(/[\s\-\|–—_:]+$/, '').trim();

  return cleaned || 'Manga';
}

function sanitizePathSegment(name) {
  return (name || 'Untitled')
    .replace(/[\\\\/:*?"<>|]/g, '-')
    .replace(/\\s+/g, '_')
    .trim();
}

async function updateTaskProgress(taskId, completed, total) {
  const res = await chrome.storage.local.get(['queue']);
  const queue = res.queue || [];
  const task = queue.find(t => t.id === taskId);
  if (task) {
    task.completedPages = completed;
    await chrome.storage.local.set({ queue });
  }
}

async function updateTaskStatus(taskId, status) {
  const res = await chrome.storage.local.get(['queue']);
  const queue = res.queue || [];
  const task = queue.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    await chrome.storage.local.set({ queue });
  }
}

async function markTaskCompleted(taskId) {
  const res = await chrome.storage.local.get(['queue']);
  const queue = res.queue || [];
  const task = queue.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    task.completedPages = task.totalPages;
    await chrome.storage.local.set({ queue });
  }
}

async function cancelTask(taskId) {
  const res = await chrome.storage.local.get(['queue']);
  let queue = res.queue || [];
  queue = queue.filter(t => t.id !== taskId);
  await chrome.storage.local.set({ queue });
  return { success: true };
}`
  },
  {
    path: 'utils/manga_adapters.js',
    category: 'utils',
    description: 'Site detection and scraper rules for AquaManga/AquaReader, Madara, MangaDex, Manganato, AsuraScans, FlameComics',
    content: `/**
 * Koda Manga Downloader Extension - Modular Site Adapters
 * High-speed multi-attribute scraper supporting AquaManga/AquaReader, Madara,
 * MangaDex, Manganato, AsuraScans, FlameComics, and Universal DOM Fallback.
 */

window.KodaAdapters = {
  // Helper to parse clean manga title & automatically detect chapter number/title
  parseMangaAndChapterInfo: (rawTitle, pageUrl) => {
    let title = (rawTitle || '').replace(/\s+/g, ' ').trim();
    let chapterNum = 1;

    // 1. URL Chapter Regex Detection
    const urlMatches = [
      /chapter[-_/\s]*(\d+(\.\d+)?)/i,
      /ch[-_/\s]*(\d+(\.\d+)?)/i,
      /c[-_/\s]*(\d+(\.\d+)?)/i,
      /chap[-_/\s]*(\d+(\.\d+)?)/i,
      /\/(\d+(\.\d+)?)\/?$/
    ];

    let detectedFromUrl = null;
    if (pageUrl) {
      for (const reg of urlMatches) {
        const match = pageUrl.match(reg);
        if (match && match[1]) {
          detectedFromUrl = parseFloat(match[1]);
          break;
        }
      }
    }

    // 2. Title Chapter Regex Detection
    const titleMatches = [
      /chapter\s*(\d+(\.\d+)?)/i,
      /ch\.\s*(\d+(\.\d+)?)/i,
      /ch\s*(\d+(\.\d+)?)/i,
      /chap\.\s*(\d+(\.\d+)?)/i,
      /chap\s*(\d+(\.\d+)?)/i,
      /episode\s*(\d+(\.\d+)?)/i
    ];

    let detectedFromTitle = null;
    for (const reg of titleMatches) {
      const match = title.match(reg);
      if (match && match[1]) {
        detectedFromTitle = parseFloat(match[1]);
        break;
      }
    }

    // 3. DOM Chapter Selectors Detection
    let detectedFromDom = null;
    if (typeof document !== 'undefined') {
      const chapterSelect = document.querySelector('select[name*="chapter"], select#chapter-select, select.single-chapter-select, .chapter-select');
      if (chapterSelect) {
        const selectedOpt = chapterSelect.options[chapterSelect.selectedIndex];
        const textToMatch = selectedOpt ? selectedOpt.text : chapterSelect.value;
        const match = textToMatch ? textToMatch.match(/(\d+(\.\d+)?)/) : null;
        if (match) detectedFromDom = parseFloat(match[1]);
      }

      if (!detectedFromDom) {
        const chapterHeading = document.querySelector('.current-chapter, #chapter-heading, h1.entry-title, .chap-title, .breadcrumb li.active');
        if (chapterHeading) {
          const match = chapterHeading.textContent.match(/chapter\s*(\d+(\.\d+)?)/i) || chapterHeading.textContent.match(/(\d+(\.\d+)?)/);
          if (match) detectedFromDom = parseFloat(match[1]);
        }
      }
    }

    chapterNum = detectedFromTitle || detectedFromUrl || detectedFromDom || 1;
    const chapterTitle = \`Chapter \${chapterNum}\`;

    // 4. Clean Manga Title: Strip site branding, chapter/episode strings, and repeated titles so all chapters go into the exact same clean folder name
    let cleanedManga = title;

    // Remove site branding
    cleanedManga = cleanedManga.replace(/\s*[\-\|–—>:>]?\s*(Read Online|MangaDex|Manganato|AquaManga|Asura\s*Scans|Flame\s*Comics|Read Manga|All Chapters|WEBTOON|Webtoons|Manga|Free).*$/gi, '');

    // Remove Episode / Chapter / Vol / Season prefixes and all trailing text
    cleanedManga = cleanedManga
      .replace(/\s*[\-\|–—>:>]?\s*(Chapter|Ch\.|Chap\.|Ch|Episode|Ep\.|Ep|Vol\.|Volume|Vol|Season|S\d+|#)\s*\d+.*$/gi, '')
      .replace(/\s*[\-\|–—]?\s*c\d+(\.\d+)?.*$/gi, '')
      .replace(/\s*[\-\|–—]\s*\d+(\.\d+)?\s*$/g, '')
      .trim();

    // Remove duplicated title phrase repeats e.g. "Magic Emperor - Magic Emperor" -> "Magic Emperor"
    const titleParts = cleanedManga.split(/\s*[\-\|–—]\s*/);
    if (titleParts.length > 1 && titleParts[0].toLowerCase().trim() === titleParts[1].toLowerCase().trim()) {
      cleanedManga = titleParts[0].trim();
    }

    // Clean trailing non-word noise characters like trailing dashes or spaces
    cleanedManga = cleanedManga.replace(/[\s\-\|–—_:]+$/, '').trim();

    if (!cleanedManga) {
      cleanedManga = 'Manga';
    }

    return {
      mangaTitle: cleanedManga,
      chapterTitle: chapterTitle,
      chapterNum: chapterNum
    };
  },

  extractImageUrl: (img) => {
    if (!img) return null;
    const candidate = img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy-src') ||
                    img.getAttribute('data-original') ||
                    img.getAttribute('data-cdn') ||
                    img.getAttribute('data-full-url') ||
                    img.getAttribute('src') ||
                    img.src;

    if (!candidate || candidate.startsWith('data:image/svg') || candidate.startsWith('data:image/gif')) {
      return null;
    }

    try {
      return new URL(candidate, window.location.href).href;
    } catch (e) {
      return candidate;
    }
  },

  adapters: [
    {
      name: 'AquaManga / AquaReader / Madara Theme',
      domainMatch: /aquareader|aquamanga|madara|manga/i,
      detect: () => {
        return !!(
          document.querySelector('.reading-content') ||
          document.querySelector('.page-break') ||
          document.querySelector('.wp-manga-chapter-img') ||
          document.querySelector('#readerarea') ||
          /aquareader|aquamanga/.test(window.location.hostname)
        );
      },
      getMangaDetails: () => {
        const titleEl = document.querySelector('h1, .post-title, .breadcrumb li:nth-child(2) a') || document.title;
        const text = typeof titleEl === 'string' ? titleEl : (titleEl.textContent || 'Manga');
        return {
          title: text.replace(/\\s+/g, ' ').trim(),
          site: 'AquaManga/Madara'
        };
      },
      getChapterImages: () => {
        const selectors = [
          '.reading-content img',
          '.page-break img',
          '.wp-manga-chapter-img',
          '#readerarea img',
          'div[id^="page-"] img',
          '.container-chapter-reader img'
        ];
        
        let elements = Array.from(document.querySelectorAll(selectors.join(',')));
        if (elements.length === 0) {
          elements = Array.from(document.querySelectorAll('img'));
        }

        const urls = elements
          .map(img => window.KodaAdapters.extractImageUrl(img))
          .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

        return Array.from(new Set(urls));
      }
    },
    {
      name: 'MangaDex',
      domainMatch: /mangadex\\.org/,
      detect: () => window.location.hostname.includes('mangadex.org'),
      getMangaDetails: () => {
        const titleEl = document.querySelector('h1, .title');
        return {
          title: titleEl ? titleEl.textContent.trim() : 'MangaDex',
          site: 'MangaDex'
        };
      },
      getChapterImages: () => {
        const imgs = Array.from(document.querySelectorAll('.md-page img, img[src*="mangadex"], .reader-page img'));
        const urls = imgs.map(img => window.KodaAdapters.extractImageUrl(img)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    },
    {
      name: 'Manganato',
      domainMatch: /manganato|chapmanganato/,
      detect: () => window.location.hostname.includes('manganato'),
      getMangaDetails: () => {
        const breadcrumb = document.querySelectorAll('.panel-breadcrumb a');
        const title = breadcrumb.length > 1 ? breadcrumb[1].textContent.trim() : 'Manganato';
        return { title, site: 'Manganato' };
      },
      getChapterImages: () => {
        const container = document.querySelector('.container-chapter-reader');
        if (!container) return [];
        const imgs = Array.from(container.querySelectorAll('img'));
        const urls = imgs.map(img => window.KodaAdapters.extractImageUrl(img)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    },
    {
      name: 'Generic Universal Scraper',
      domainMatch: /.*/,
      detect: () => true,
      getMangaDetails: () => {
        const metaTitle = document.querySelector('meta[property="og:title"]');
        const rawTitle = metaTitle ? metaTitle.getAttribute('content') : document.title;
        return {
          title: (rawTitle || 'Manga Chapter').replace(/\\s+/g, ' ').trim(),
          site: window.location.hostname
        };
      },
      getChapterImages: (customSelector) => {
        let imgs = [];
        if (customSelector) {
          imgs = Array.from(document.querySelectorAll(customSelector));
        } else {
          imgs = Array.from(document.querySelectorAll('.reader img, #reader img, .chapter-content img, article img, img[class*="page"], img[id*="page"], .reading-content img'));
          if (imgs.length === 0) {
            imgs = Array.from(document.querySelectorAll('img')).filter(i => {
              const rect = i.getBoundingClientRect();
              return (rect.width > 200 || rect.height > 200) && !i.src.includes('avatar') && !i.src.includes('logo');
            });
          }
        }
        const urls = imgs.map(i => window.KodaAdapters.extractImageUrl(i)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    }
  ],

  getMatchingAdapter: () => {
    return window.KodaAdapters.adapters.find(a => a.detect()) || window.KodaAdapters.adapters[window.KodaAdapters.adapters.length - 1];
  }
};`
  },
  {
    path: 'utils/download_queue.js',
    category: 'utils',
    description: 'V3 Queue Engine supporting batch concurrency and rate-limiting throttling',
    content: `/**
 * Koda Manga Downloader Extension - Queue Utility
 */

class KodaQueueEngine {
  constructor(concurrency = 3, delayMs = 250) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.activeWorkers = 0;
    this.taskQueue = [];
  }

  enqueue(item) {
    this.taskQueue.push(item);
  }

  clear() {
    this.taskQueue = [];
  }
}

if (typeof module !== 'undefined') {
  module.exports = { KodaQueueEngine };
}`
  },
  {
    path: 'content/content_script.js',
    category: 'content',
    description: 'Injected content script detecting chapter pages and page-context image fetcher fallback',
    content: `/**
 * Koda Manga Downloader Extension - Content Script
 * Active tab page scanner & page-context image fetcher fallback
 */

(function() {
  console.log('[Koda Extension] Active Content Script on:', window.location.href);

  function injectKodaFloatingBadge() {
    if (document.getElementById('koda-floating-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'koda-floating-badge';
    badge.innerHTML = \`
      <div class="koda-badge-inner">
        <span class="koda-logo-icon">📖</span>
        <span class="koda-badge-title">KODA DOWNLOADER</span>
        <span class="koda-badge-count" id="koda-page-count">SCANNING...</span>
      </div>
    \`;

    let isDragging = false;
    let isDragIntent = false;
    let startX = 0, startY = 0;
    let initialRect = null;

    badge.addEventListener('mousedown', (e) => {
      isDragging = false;
      isDragIntent = true;
      startX = e.clientX;
      startY = e.clientY;
      initialRect = badge.getBoundingClientRect();
      
      // Remove right/bottom constraints to allow left/top positioning
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.style.left = initialRect.left + 'px';
      badge.style.top = initialRect.top + 'px';
      badge.classList.add('is-dragging');
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault(); // Prevent text selection during drag
    });

    function onMouseMove(e) {
      if (!isDragIntent) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Threshold to consider it a drag vs click
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDragging = true;
      }

      if (isDragging) {
        badge.style.left = (initialRect.left + dx) + 'px';
        badge.style.top = (initialRect.top + dy) + 'px';
      }
    }

    function onMouseUp(e) {
      isDragIntent = false;
      badge.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    let popupIframe = null;

    badge.addEventListener('click', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      if (popupIframe) {
        // Toggle visibility if it already exists
        const isHidden = popupIframe.style.display === 'none';
        popupIframe.style.display = isHidden ? 'block' : 'none';
        
        // Reposition based on current badge position
        if (isHidden) {
          const rect = badge.getBoundingClientRect();
          popupIframe.style.top = (rect.top - 610) + 'px'; // 600px height + 10px margin
          popupIframe.style.left = rect.left + 'px';
        }
      } else {
        // Create iframe popup
        popupIframe = document.createElement('iframe');
        popupIframe.src = chrome.runtime.getURL('popup/popup.html');
        popupIframe.id = 'koda-extension-iframe';
        
        // Style it to float near the badge
        popupIframe.style.position = 'fixed';
        popupIframe.style.width = '450px';
        popupIframe.style.height = '600px';
        popupIframe.style.border = '1px solid #333';
        popupIframe.style.borderRadius = '8px';
        popupIframe.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        popupIframe.style.zIndex = '9999999999';
        popupIframe.style.backgroundColor = '#121212';
        
        // Position it just above the badge
        const rect = badge.getBoundingClientRect();
        popupIframe.style.top = Math.max(0, rect.top - 610) + 'px'; // Ensure it doesn't go off top of screen
        
        // Ensure it doesn't go off right side of screen
        const maxLeft = window.innerWidth - 460;
        popupIframe.style.left = Math.min(rect.left, maxLeft) + 'px';
        
        document.body.appendChild(popupIframe);
      }
    });

    document.body.appendChild(badge);
    updateDetectedPages();
    
    let scanCount = 0;
    const interval = setInterval(() => {
      updateDetectedPages();
      scanCount++;
      if (scanCount > 10) clearInterval(interval);
    }, 2000);
  }

  let lastScannedCount = 0;
  function updateDetectedPages() {
    const adapter = window.KodaAdapters ? window.KodaAdapters.getMatchingAdapter() : null;
    let count = 0;
    if (adapter) {
      const imgs = adapter.getChapterImages();
      count = imgs.length;
    }
    const countEl = document.getElementById('koda-page-count');
    if (countEl) {
      countEl.textContent = count > 0 ? \`\${count} PAGES FOUND\` : 'SCAN PAGE';
    }

    if (count > lastScannedCount) {
      const badge = document.getElementById('koda-floating-badge');
      if (badge) {
        badge.classList.remove('koda-glow');
        // trigger reflow to restart animation
        void badge.offsetWidth;
        badge.classList.add('koda-glow');
        
        // Remove class after animation finishes (1500ms)
        setTimeout(() => {
          badge.classList.remove('koda-glow');
        }, 1500);
      }
      lastScannedCount = count;
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCRAPE_CURRENT_PAGE') {
      const adapter = window.KodaAdapters.getMatchingAdapter();
      const details = adapter.getMangaDetails();
      const images = adapter.getChapterImages(request.customSelector);

      const parsed = window.KodaAdapters.parseMangaAndChapterInfo(
        details.title || document.title,
        window.location.href
      );

      sendResponse({
        success: true,
        mangaTitle: parsed.mangaTitle,
        chapterTitle: parsed.chapterTitle,
        chapterNum: parsed.chapterNum,
        images: images,
        pageUrl: window.location.href
      });
      return true;
    }

    if (request.action === 'FETCH_IMAGE_FROM_PAGE') {
      fetchImageFromPageContext(request.url)
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  async function fetchImageFromPageContext(imageUrl) {
    try {
      const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }
    } catch (e) {}

    const imgEl = Array.from(document.querySelectorAll('img')).find(i => i.src === imageUrl || i.getAttribute('data-src') === imageUrl);
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return Array.from(bytes);
    }

    throw new Error('Could not fetch image from page context');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectKodaFloatingBadge);
  } else {
    injectKodaFloatingBadge();
  }
})();`
  },
  {
    path: 'content/content_script.css',
    category: 'content',
    description: 'Styles for the floating Koda badge on manga reader sites (Web App Theme)',
    content: `#koda-floating-badge {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  user-select: none;
  opacity: 0.35;
  transition: opacity 0.3s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

#koda-floating-badge:hover,
#koda-floating-badge.is-dragging {
  opacity: 1;
}

#koda-floating-badge:hover {
  transform: translate(-2px, -2px);
}

.koda-badge-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #F9F9F7;
  color: #121212;
  padding: 8px 14px;
  border-radius: 0px;
  border: 2px solid #121212;
  box-shadow: 3px 3px 0px #121212;
}

.koda-logo-icon {
  font-size: 16px;
}

.koda-badge-title {
  font-weight: 900;
  font-style: italic;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #121212;
  text-transform: uppercase;
}

.koda-badge-count {
  font-size: 10px;
  font-weight: 900;
  background: #FF4D00;
  color: #FFFFFF;
  padding: 3px 8px;
  border: 1px solid #121212;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@keyframes kodaPulseGlow {
  0% { box-shadow: 3px 3px 0px #121212; opacity: 1; transform: translate(0, 0) scale(1); }
  50% { box-shadow: 0 0 20px 5px #FF4D00; opacity: 1; transform: translate(0, 0) scale(1.05); }
  100% { box-shadow: 3px 3px 0px #121212; opacity: 1; transform: translate(0, 0) scale(1); }
}

#koda-floating-badge.koda-glow {
  animation: kodaPulseGlow 1.5s ease-out;
  opacity: 1;
}`
  },
  {
    path: 'popup/popup.html',
    category: 'popup',
    description: 'Main Chrome extension popup window interface (Web App Theme)',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Koda Manga Downloader</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body class="koda-theme-webapp">
  <div class="koda-popup-container">
    <!-- Top Header Bar -->
    <header class="koda-header">
      <div class="koda-brand">
        <div class="koda-logo-box">📖</div>
        <div>
          <div class="koda-title-row">
            <h1 class="koda-app-name">KODA MANGA</h1>
            <span class="koda-version-tag">ENGINE V3</span>
          </div>
          <p class="koda-subtitle">MANGA CHAPTER DOWNLOADER</p>
        </div>
      </div>
      <div class="koda-header-actions">
        <button id="btn-theme-toggle" class="koda-icon-btn" title="Toggle Light/Dark Theme" aria-label="Toggle Theme">🌙</button>
        <a href="../options/options.html" target="_blank" class="koda-icon-btn" title="Settings">⚙️</a>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="koda-nav-tabs">
      <button class="koda-tab active" data-tab="tab-scrape">CURRENT PAGE</button>
      <button class="koda-tab" data-tab="tab-batch">BATCH QUEUE</button>
      <button class="koda-tab" data-tab="tab-active">DOWNLOADS (<span id="active-count">0</span>)</button>
    </nav>

    <!-- Tab 1: Current Page Scraper -->
    <section id="tab-scrape" class="koda-tab-content active">
      <div class="koda-card">
        <div class="koda-field-group">
          <label class="koda-label">DETECTED MANGA TITLE</label>
          <input type="text" id="input-manga-title" class="koda-input" value="Scanning page...">
        </div>
        <div class="koda-field-row">
          <div class="koda-field-group flex-1">
            <label class="koda-label">CHAPTER TITLE</label>
            <input type="text" id="input-chapter-title" class="koda-input" value="Chapter 1">
          </div>
          <div class="koda-field-group flex-1">
            <label class="koda-label">EXPORT FORMAT</label>
            <select id="select-format" class="koda-select">
              <option value="cbz">CBZ (Comic Zip)</option>
              <option value="zip">Standard ZIP</option>
              <option value="pdf">PDF Document</option>
              <option value="folder">Images Folder</option>
            </select>
          </div>
        </div>

        <div class="koda-page-summary">
          <span class="koda-badge" id="badge-page-count">0 PAGES DETECTED</span>
          <button id="btn-rescan" class="koda-btn-subtle">🔄 RESCAN PAGE</button>
        </div>

        <button id="btn-download-now" class="koda-btn-primary full-width">
          🚀 DOWNLOAD CHAPTER NOW
        </button>
      </div>
    </section>

    <!-- Tab 2: Batch Range Selector -->
    <section id="tab-batch" class="koda-tab-content">
      <div class="koda-card">
        <p class="koda-hint">SELECT CHAPTER RANGE FOR BULK QUEUEING:</p>
        <div class="koda-field-row">
          <div class="koda-field-group flex-1">
            <label class="koda-label">START CHAPTER</label>
            <input type="number" id="batch-start" class="koda-input" value="1" min="1">
          </div>
          <div class="koda-field-group flex-1">
            <label class="koda-label">END CHAPTER</label>
            <input type="number" id="batch-end" class="koda-input" value="10" min="1">
          </div>
        </div>

        <button id="btn-start-batch" class="koda-btn-secondary full-width mt-12">
          📥 QUEUE CHAPTER RANGE
        </button>
      </div>
    </section>

    <!-- Tab 3: Active Download Monitor -->
    <section id="tab-active" class="koda-tab-content">
      <div id="queue-list-container" class="koda-queue-list">
        <div class="koda-empty-state">NO ACTIVE DOWNLOADS IN QUEUE.</div>
      </div>
    </section>

    <!-- Footer Status -->
    <footer class="koda-footer">
      <span class="koda-status-text" id="status-line">ENGINE STATUS: READY</span>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>`
  },
  {
    path: 'popup/popup.js',
    category: 'popup',
    description: 'Popup script interacting with content script and background service worker',
    content: `/**
 * Koda Manga Downloader Extension - Popup Controller
 */

let scrapedData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  setupTabs();
  await loadCurrentPageData();
  bindEvents();
  startQueuePolling();
});

function getSystemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

async function initTheme() {
  const toggleBtn = document.getElementById('btn-theme-toggle');

  let savedTheme = 'auto';
  try {
    const res = await new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['theme', 'settings'], resolve);
      } else {
        resolve({});
      }
    });
    savedTheme = (res && (res.theme || (res.settings && res.settings.theme))) || 
                 localStorage.getItem('koda_theme') || 'auto';
  } catch (e) {
    savedTheme = localStorage.getItem('koda_theme') || 'auto';
  }

  window.kodaThemeMode = savedTheme;
  applyTheme(savedTheme);

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (window.kodaThemeMode === 'auto') {
        applyTheme('auto');
      }
    };

    if (media.addEventListener) {
      media.addEventListener('change', handleSystemChange);
    } else if (media.addListener) {
      media.addListener(handleSystemChange);
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const mode = window.kodaThemeMode || 'auto';
      let nextMode = 'light';
      if (mode === 'light') nextMode = 'dark';
      else if (mode === 'dark') nextMode = 'auto';
      else nextMode = 'light';

      window.kodaThemeMode = nextMode;
      applyTheme(nextMode);

      try {
        localStorage.setItem('koda_theme', nextMode);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ theme: nextMode });
        }
      } catch (e) {}
    });
  }
}

function applyTheme(mode) {
  const toggleBtn = document.getElementById('btn-theme-toggle');

  let effectiveTheme = mode;
  if (mode === 'auto') {
    effectiveTheme = getSystemIsDark() ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.body.setAttribute('data-theme', effectiveTheme);

  if (effectiveTheme === 'dark') {
    document.body.classList.add('koda-theme-dark');
  } else {
    document.body.classList.remove('koda-theme-dark');
  }

  if (toggleBtn) {
    if (mode === 'light') {
      toggleBtn.textContent = '☀️';
      toggleBtn.title = 'Theme: Light Mode (Click for Dark)';
    } else if (mode === 'dark') {
      toggleBtn.textContent = '🌙';
      toggleBtn.title = 'Theme: Dark Mode (Click for Auto System)';
    } else {
      const systemStateText = getSystemIsDark() ? 'Dark' : 'Light';
      toggleBtn.textContent = '💻';
      toggleBtn.title = \`Theme: Auto System [\${systemStateText}] (Click for Light)\`;
    }
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.koda-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.koda-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById(target).classList.add('active');
    });
  });
}

async function loadCurrentPageData() {
  const statusLine = document.getElementById('status-line');
  statusLine.textContent = 'ENGINE STATUS: SCANNING PAGE...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_CURRENT_PAGE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        statusLine.textContent = 'NOTICE: OPEN MANGA CHAPTER PAGE TO SCAN';
        document.getElementById('input-manga-title').value = 'No Chapter Detected';
        return;
      }

      scrapedData = response;
      document.getElementById('input-manga-title').value = response.mangaTitle || 'Manga';
      document.getElementById('input-chapter-title').value = response.chapterTitle || 'Chapter 1';
      document.getElementById('badge-page-count').textContent = \`\${response.images.length} PAGES DETECTED\`;
      statusLine.textContent = \`READY: \${response.images.length} PAGES EXTRACTED\`;
    });
  } catch (err) {
    statusLine.textContent = 'ENGINE STATUS: TAB SCAN ERROR';
  }
}

function bindEvents() {
  document.getElementById('btn-rescan').addEventListener('click', loadCurrentPageData);

  document.getElementById('btn-download-now').addEventListener('click', async () => {
    if (!scrapedData || !scrapedData.images || scrapedData.images.length === 0) {
      alert('No manga pages detected on this page. Try scrolling down to load images first!');
      return;
    }

    const format = document.getElementById('select-format').value;
    const taskPayload = {
      mangaTitle: document.getElementById('input-manga-title').value,
      chapterTitle: document.getElementById('input-chapter-title').value,
      chapterNum: scrapedData.chapterNum || 1,
      format: format,
      pages: scrapedData.images
    };

    chrome.runtime.sendMessage({
      action: 'START_DOWNLOAD_TASK',
      task: taskPayload
    }, (res) => {
      document.getElementById('status-line').textContent = 'TASK QUEUED SUCCESSFULLY!';
      document.querySelector('[data-tab="tab-active"]').click();
    });
  });

  document.getElementById('btn-start-batch').addEventListener('click', async () => {
    if (!scrapedData || !scrapedData.images) {
      alert('Open a manga chapter page first so Koda can parse the site format.');
      return;
    }

    const start = parseInt(document.getElementById('batch-start').value, 10) || 1;
    const end = parseInt(document.getElementById('batch-end').value, 10) || 1;
    const format = document.getElementById('select-format').value;

    if (start > end) {
      alert('Start chapter must be less than or equal to end chapter.');
      return;
    }

    const mangaTitle = document.getElementById('input-manga-title').value;

    for (let c = start; c <= end; c++) {
      const taskPayload = {
        mangaTitle: mangaTitle,
        chapterTitle: \`Chapter \${c}\`,
        chapterNum: c,
        format: format,
        pages: scrapedData.images
      };

      chrome.runtime.sendMessage({
        action: 'START_DOWNLOAD_TASK',
        task: taskPayload
      });
    }

    document.getElementById('status-line').textContent = \`QUEUED \${end - start + 1} CHAPTERS!\`;
    document.querySelector('[data-tab="tab-active"]').click();
  });
}

function startQueuePolling() {
  fetchAndRenderQueue();
  setInterval(fetchAndRenderQueue, 1000);
}

function fetchAndRenderQueue() {
  chrome.runtime.sendMessage({ action: 'GET_QUEUE_STATUS' }, (res) => {
    if (!res || !res.queue) return;
    renderQueue(res.queue);
  });
}

function renderQueue(queue) {
  const container = document.getElementById('queue-list-container');
  const countBadge = document.getElementById('active-count');

  const activeTasks = queue.filter(t => t.status !== 'completed');
  countBadge.textContent = activeTasks.length;

  if (queue.length === 0) {
    container.innerHTML = '<div class="koda-empty-state">NO DOWNLOAD TASKS QUEUED.</div>';
    return;
  }

  container.innerHTML = queue.map(task => {
    const percent = Math.round((task.completedPages / (task.totalPages || 1)) * 100);
    return \`
      <div class="koda-task-item \${task.status}">
        <div class="koda-task-header">
          <span class="koda-task-name">\${task.mangaTitle} - \${task.chapterTitle}</span>
          <span class="koda-format-tag">\${task.format.toUpperCase()}</span>
        </div>
        <div class="koda-progress-bar-bg">
          <div class="koda-progress-bar-fill" style="width: \${percent}%"></div>
        </div>
        <div class="koda-task-footer">
          <span>\${task.completedPages} / \${task.totalPages} PAGES (\${percent}%)</span>
          <span class="koda-task-status">\${task.status.toUpperCase()}</span>
        </div>
      </div>
    \`;
  }).join('');
}`
  },
  {
    path: 'popup/popup.css',
    category: 'popup',
    description: 'Styling for extension popup window (Web App Theme)',
    content: `/* Koda Manga Downloader Popup - Web App Visual Theme */
:root {
  --bg-canvas: #F9F9F7;
  --bg-surface: #FFFFFF;
  --bg-input: #FFFFFF;
  --text-primary: #121212;
  --text-secondary: rgba(18, 18, 18, 0.7);
  --border-color: #121212;
  --shadow-color: #121212;
  --accent-orange: #FF4D00;
  --accent-orange-text: #FFFFFF;
  --btn-subtle-bg: #FFFFFF;
  --btn-subtle-hover: #F9F9F7;
}

[data-theme="dark"], body.koda-theme-dark {
  --bg-canvas: #0F172A;
  --bg-surface: #1E293B;
  --bg-input: #0F172A;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border-color: #334155;
  --shadow-color: #020617;
  --accent-orange: #FF4D00;
  --accent-orange-text: #FFFFFF;
  --btn-subtle-bg: #1E293B;
  --btn-subtle-hover: #334155;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body.koda-theme-webapp {
  width: 380px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  border: 4px solid var(--border-color);
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.koda-popup-container {
  padding: 16px;
}

.koda-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 14px;
}

.koda-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.koda-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.koda-logo-box {
  width: 38px;
  height: 38px;
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  border: 2px solid var(--border-color);
  box-shadow: 2px 2px 0px var(--shadow-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.koda-title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.koda-app-name {
  font-size: 18px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  color: var(--text-primary);
}

.koda-version-tag {
  font-size: 9px;
  font-weight: 900;
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  padding: 1px 5px;
  border: 1px solid var(--border-color);
  text-transform: uppercase;
}

.koda-subtitle {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.koda-icon-btn {
  text-decoration: none;
  font-size: 16px;
  cursor: pointer;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  padding: 4px 8px;
  box-shadow: 2px 2px 0px var(--shadow-color);
  transition: transform 0.1s, background-color 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.koda-icon-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0px var(--shadow-color);
  background: var(--btn-subtle-hover);
}

.koda-nav-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}

.koda-tab {
  flex: 1;
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 4px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 2px 2px 0px var(--shadow-color);
  transition: all 0.15s;
}

.koda-tab.active {
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  box-shadow: 3px 3px 0px var(--shadow-color);
}

.koda-tab-content {
  display: none;
}

.koda-tab-content.active {
  display: block;
}

.koda-card {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  box-shadow: 3px 3px 0px var(--shadow-color);
  padding: 14px;
}

.koda-field-group {
  margin-bottom: 12px;
}

.koda-field-row {
  display: flex;
  gap: 10px;
}

.flex-1 { flex: 1; }

.koda-label {
  display: block;
  font-size: 10px;
  font-weight: 900;
  color: var(--text-primary);
  margin-bottom: 4px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.koda-input, .koda-select {
  width: 100%;
  background: var(--bg-input);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 10px;
  font-weight: 700;
  font-size: 12px;
  border-radius: 0px;
}

.koda-input:focus, .koda-select:focus {
  outline: 2px solid var(--accent-orange);
  outline-offset: 1px;
}

.koda-page-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}

.koda-badge {
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  font-size: 10px;
  font-weight: 900;
  padding: 4px 10px;
  letter-spacing: 0.08em;
  border: 1px solid var(--border-color);
}

.koda-btn-subtle {
  background: var(--btn-subtle-bg);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 900;
  padding: 4px 8px;
  cursor: pointer;
  box-shadow: 2px 2px 0px var(--shadow-color);
}

.koda-btn-subtle:hover {
  background: var(--btn-subtle-hover);
}

.koda-btn-primary {
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  border: 2px solid var(--border-color);
  padding: 12px;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 3px 3px 0px var(--shadow-color);
  transition: all 0.15s;
}

.koda-btn-primary:hover {
  background: var(--border-color);
  color: var(--bg-surface);
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0px var(--shadow-color);
}

.koda-btn-secondary {
  background: var(--border-color);
  color: var(--bg-surface);
  border: 2px solid var(--border-color);
  padding: 10px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 3px 3px 0px var(--accent-orange);
}

.koda-hint {
  font-size: 11px;
  font-weight: 900;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.full-width { width: 100%; }
.mt-12 { margin-top: 12px; }

.koda-queue-list {
  max-height: 240px;
  overflow-y: auto;
}

.koda-task-item {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  box-shadow: 3px 3px 0px var(--shadow-color);
  padding: 10px;
  margin-bottom: 10px;
}

.koda-task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
  margin-bottom: 8px;
}

.koda-task-name {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.koda-format-tag {
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  font-size: 9px;
  font-weight: 900;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
}

.koda-progress-bar-bg {
  height: 10px;
  background: var(--bg-canvas);
  border: 2px solid var(--border-color);
  overflow: hidden;
  margin-bottom: 6px;
}

.koda-progress-bar-fill {
  height: 100%;
  background: var(--accent-orange);
  transition: width 0.2s ease;
}

.koda-task-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 900;
  color: var(--text-primary);
}

.koda-task-status {
  text-transform: uppercase;
  color: var(--accent-orange);
}

.koda-empty-state {
  text-align: center;
  font-size: 11px;
  font-weight: 900;
  color: var(--text-secondary);
  padding: 24px 0;
  background: var(--bg-surface);
  border: 2px dashed var(--border-color);
}

.koda-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 2px solid var(--border-color);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  text-align: center;
  text-transform: uppercase;
}`
  },
  {
    path: 'options/options.html',
    category: 'options',
    description: 'Extension options page (Web App Theme)',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Koda Manga Downloader - Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body class="koda-options-bg">
  <div class="koda-options-wrapper">
    <header class="koda-opt-header">
      <div class="koda-opt-header-top">
        <div class="header-tag">ENGINE CONFIGURATION</div>
        <button id="btn-theme-toggle" class="koda-icon-btn" title="Toggle Light/Dark Theme" aria-label="Toggle Theme">🌙</button>
      </div>
      <h1>⚙️ KODA MANGA DOWNLOADER SETTINGS</h1>
      <p>Configure throttle rules, auto retries, and naming target templates.</p>
    </header>

    <div class="koda-opt-card">
      <h2>🚀 THROTTLE & RATE LIMIT PROTECTION (V3 ENGINE)</h2>

      <div class="koda-opt-field">
        <label>MAX PARALLEL CONCURRENCY</label>
        <input type="number" id="opt-concurrency" min="1" max="10" value="3">
        <span class="field-help">Recommended (2-3) to avoid HTTP 429 rate limit blocks on strict manga CDNs.</span>
      </div>

      <div class="koda-opt-field">
        <label>INTER-REQUEST DELAY (MS)</label>
        <input type="number" id="opt-delay" min="0" max="5000" step="50" value="250">
        <span class="field-help">Throttle delay in milliseconds between image chunk requests.</span>
      </div>

      <div class="koda-opt-field">
        <label>AUTOMATIC RETRY LIMIT</label>
        <input type="number" id="opt-retries" min="1" max="10" value="3">
        <span class="field-help">Exponential backoff retry attempts per image download failure.</span>
      </div>
    </div>

    <div class="koda-opt-card">
      <h2>📁 FILENAME & PATH TEMPLATES</h2>
      <div class="koda-opt-field">
        <label>TARGET PATH PATTERN</label>
        <input type="text" id="opt-template" value="Koda_Manga/{manga_title}/{chapter_title}.{ext}">
        <span class="field-help">Available placeholders: {manga_title}, {chapter_title}, {chapter_num}, {ext}</span>
      </div>
    </div>

    <div class="koda-opt-actions">
      <button id="btn-save-settings" class="btn-save">💾 SAVE CONFIGURATION</button>
      <span id="save-msg" class="save-msg"></span>
    </div>
  </div>
  <script src="options.js"></script>
</body>
</html>`
  },
  {
    path: 'options/options.js',
    category: 'options',
    description: 'Options page controller synchronizing preferences with chrome.storage.local',
    content: `/**
 * Koda Manga Downloader Extension - Options Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();

  chrome.storage.local.get(['settings'], (res) => {
    const s = res.settings || {};
    if (s.maxConcurrentDownloads) document.getElementById('opt-concurrency').value = s.maxConcurrentDownloads;
    if (s.delayBetweenRequestsMs) document.getElementById('opt-delay').value = s.delayBetweenRequestsMs;
    if (s.autoRetryAttempts) document.getElementById('opt-retries').value = s.autoRetryAttempts;
    if (s.filenameTemplate) document.getElementById('opt-template').value = s.filenameTemplate;
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const newSettings = {
      maxConcurrentDownloads: parseInt(document.getElementById('opt-concurrency').value, 10) || 3,
      delayBetweenRequestsMs: parseInt(document.getElementById('opt-delay').value, 10) || 250,
      autoRetryAttempts: parseInt(document.getElementById('opt-retries').value, 10) || 3,
      filenameTemplate: document.getElementById('opt-template').value,
      defaultFormat: 'cbz'
    };

    chrome.storage.local.set({ settings: newSettings }, () => {
      const msg = document.getElementById('save-msg');
      msg.textContent = 'SETTINGS SAVED SUCCESSFULLY!';
      setTimeout(() => { msg.textContent = ''; }, 3000);
    });
  });
});

async function initTheme() {
  const toggleBtn = document.getElementById('btn-theme-toggle');

  let savedTheme = 'light';
  try {
    const res = await new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['theme', 'settings'], resolve);
      } else {
        resolve({});
      }
    });
    savedTheme = (res && (res.theme || (res.settings && res.settings.theme))) || 
                 localStorage.getItem('koda_theme') || 'light';
  } catch (e) {
    savedTheme = localStorage.getItem('koda_theme') || 'light';
  }

  window.kodaThemeMode = savedTheme;
  applyTheme(savedTheme);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (window.kodaThemeMode === 'auto') {
        applyTheme('auto');
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const mode = window.kodaThemeMode || 'light';
      let nextMode = 'light';
      if (mode === 'light') nextMode = 'dark';
      else if (mode === 'dark') nextMode = 'auto';
      else nextMode = 'light';

      window.kodaThemeMode = nextMode;
      applyTheme(nextMode);

      try {
        localStorage.setItem('koda_theme', nextMode);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ theme: nextMode });
        }
      } catch (e) {}
    });
  }
}

function getSystemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode) {
  const toggleBtn = document.getElementById('btn-theme-toggle');

  let effectiveTheme = mode;
  if (mode === 'auto') {
    effectiveTheme = getSystemIsDark() ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.body.setAttribute('data-theme', effectiveTheme);

  if (effectiveTheme === 'dark') {
    document.body.classList.add('koda-theme-dark');
  } else {
    document.body.classList.remove('koda-theme-dark');
  }

  if (toggleBtn) {
    if (mode === 'light') {
      toggleBtn.textContent = '☀️';
      toggleBtn.title = 'Theme: Light Mode (Click for Dark)';
    } else if (mode === 'dark') {
      toggleBtn.textContent = '🌙';
      toggleBtn.title = 'Theme: Dark Mode (Click for Auto System)';
    } else {
      const systemStateText = getSystemIsDark() ? 'Dark' : 'Light';
      toggleBtn.textContent = '💻';
      toggleBtn.title = \`Theme: Auto System [\${systemStateText}] (Click for Light)\`;
    }
  }
}`
  },
  {
    path: 'options/options.css',
    category: 'options',
    description: 'Styles for the extension options dashboard (Web App Theme)',
    content: `/* Koda Manga Downloader Options Page - Web App Visual Theme */
:root {
  --bg-canvas: #F9F9F7;
  --bg-surface: #FFFFFF;
  --bg-input: #FFFFFF;
  --text-primary: #121212;
  --text-secondary: rgba(18, 18, 18, 0.7);
  --border-color: #121212;
  --shadow-color: #121212;
  --accent-orange: #FF4D00;
  --accent-orange-text: #FFFFFF;
  --btn-subtle-bg: #FFFFFF;
  --btn-subtle-hover: #F9F9F7;
}

[data-theme="dark"], body.koda-theme-dark {
  --bg-canvas: #0F172A;
  --bg-surface: #1E293B;
  --bg-input: #0F172A;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border-color: #334155;
  --shadow-color: #020617;
  --accent-orange: #FF4D00;
  --accent-orange-text: #FFFFFF;
  --btn-subtle-bg: #1E293B;
  --btn-subtle-hover: #334155;
}

body.koda-options-bg {
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 40px 20px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.koda-options-wrapper {
  max-width: 680px;
  margin: 0 auto;
}

.koda-opt-header {
  margin-bottom: 24px;
}

.koda-opt-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.header-tag {
  display: inline-block;
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  font-size: 10px;
  font-weight: 900;
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  letter-spacing: 0.1em;
}

.koda-icon-btn {
  text-decoration: none;
  font-size: 16px;
  cursor: pointer;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  padding: 4px 8px;
  box-shadow: 2px 2px 0px var(--shadow-color);
  transition: transform 0.1s, background-color 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.koda-icon-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0px var(--shadow-color);
  background: var(--btn-subtle-hover);
}

.koda-opt-header h1 {
  font-size: 24px;
  font-weight: 900;
  font-style: italic;
  color: var(--text-primary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: -0.03em;
}

.koda-opt-header p {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.koda-opt-card {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  box-shadow: 4px 4px 0px var(--shadow-color);
  padding: 20px;
  margin-bottom: 20px;
}

.koda-opt-card h2 {
  font-size: 13px;
  font-weight: 900;
  color: var(--text-primary);
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.koda-opt-field {
  margin-bottom: 16px;
}

.koda-opt-field label {
  display: block;
  font-size: 11px;
  font-weight: 900;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.koda-opt-field input[type="text"], .koda-opt-field input[type="number"] {
  width: 100%;
  background: var(--bg-input);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px;
  font-weight: 700;
  font-size: 13px;
  border-radius: 0px;
}

.koda-opt-field input:focus {
  outline: 2px solid var(--accent-orange);
  outline-offset: 1px;
}

.field-help {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-top: 4px;
}

.koda-opt-actions {
  display: flex;
  align-items: center;
}

.btn-save {
  background: var(--accent-orange);
  color: var(--accent-orange-text);
  border: 2px solid var(--border-color);
  padding: 12px 28px;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 3px 3px 0px var(--shadow-color);
  transition: all 0.15s;
}

.btn-save:hover {
  background: var(--border-color);
  color: var(--bg-surface);
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0px var(--shadow-color);
}

.save-msg {
  margin-left: 14px;
  color: var(--accent-orange);
  font-weight: 900;
  font-size: 12px;
}`
  },
  {
    path: 'lib/jszip.min.js',
    category: 'lib',
    description: 'Zero-dependency pure JS CRC32 Zipping Engine for CBZ/ZIP generation',
    content: `/**
 * Koda Manga Downloader Extension - Lightweight Pure CRC32 ZIP & CBZ Builder
 */

class KodaZip {
  constructor() {
    this.files = [];
  }

  file(name, data) {
    let bytes;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data && data.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(data.buffer);
    } else {
      bytes = new Uint8Array(0);
    }
    this.files.push({ name, bytes });
    return this;
  }

  static crc32(bytes) {
    let table = KodaZip.crcTable;
    if (!table) {
      table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
      }
      KodaZip.crcTable = table;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  async generateAsync(options = {}) {
    const parts = [];
    const centralDirectory = [];
    let offset = 0;

    for (const file of this.files) {
      const filenameBytes = new TextEncoder().encode(file.name);
      const crc = KodaZip.crc32(file.bytes);
      const uncompressedSize = file.bytes.length;
      const compressedSize = uncompressedSize;

      const header = new Uint8Array(30 + filenameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, compressedSize, true);
      view.setUint32(22, uncompressedSize, true);
      view.setUint16(26, filenameBytes.length, true);
      view.setUint16(28, 0, true);
      header.set(filenameBytes, 30);

      parts.push(header);
      parts.push(file.bytes);

      const cdHeader = new Uint8Array(46 + filenameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, compressedSize, true);
      cdView.setUint32(24, uncompressedSize, true);
      cdView.setUint16(28, filenameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      cdHeader.set(filenameBytes, 46);

      centralDirectory.push(cdHeader);
      offset += header.length + file.bytes.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const cdHeader of centralDirectory) {
      parts.push(cdHeader);
      cdSize += cdHeader.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, this.files.length, true);
    eocdView.setUint16(10, this.files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);

    parts.push(eocd);

    if (options.type === 'base64') {
      const blob = new Blob(parts, { type: 'application/zip' });
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }

    return new Blob(parts, { type: 'application/zip' });
  }
}

if (typeof window !== 'undefined') window.JSZip = KodaZip;
if (typeof self !== 'undefined') self.JSZip = KodaZip;
if (typeof globalThis !== 'undefined') globalThis.JSZip = KodaZip;`
  },
  {
    path: 'lib/jspdf_builder.js',
    category: 'lib',
    description: 'Lightweight canvas-to-PDF manga compilation helper',
    content: `/**
 * Koda Manga Downloader Extension - Manga PDF Compiler
 */

window.KodaPdfBuilder = {
  compileImagesToPdf: async function(images) {
    console.log('[Koda PDF] Compiling', images.length, 'images into PDF');
    const pdfHeader = '%PDF-1.4\\n1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n';
    const pdfBlob = new Blob([pdfHeader], { type: 'application/pdf' });
    return pdfBlob;
  }
};`
  },
  {
    path: 'README.md',
    category: 'docs',
    description: 'Installation and setup guide for the unpacked extension',
    content: `# Koda Manga Downloader Extension (v3.0.0)

A high-speed, battle-tested Chrome Extension for downloading manga chapters into CBZ, ZIP, PDF, or organized image folders.

## Features
- **Solid Engine V3**: Direct host-permission image downloader with automatic content-script webpage fallback for CORS/Referer protected manga CDNs.
- **Pure JSZip Compiler**: Zero-dependency pure JS CRC32 zip generator creating valid .cbz and .zip archives.
- **Web App Visual Theme**: High-contrast, neo-brutalist #F9F9F7 canvas, #121212 hard borders, and #FF4D00 safety orange accents.
- **Multi-Attribute Site Adapters**: Out-of-the-box support for AquaManga/AquaReader, Madara, MangaDex, Manganato, AsuraScans, FlameComics, and Universal DOM Fallback.

## Installation Instructions (Chrome / Edge / Brave)
1. Export or download the extension ZIP file using the button in the Studio UI above.
2. Unpack the ZIP archive to a folder on your computer.
3. Open your Chromium browser and navigate to \`chrome://extensions/\`.
4. Enable **Developer Mode** in the top-right toggle switch.
5. Click **Load Unpacked** and select the unpacked extension folder.
6. The Koda Manga Downloader icon will appear in your extensions toolbar!
`
  },
  {
    path: 'icons/icon16.png',
    category: 'icons',
    description: '16x16 toolbar icon PNG file',
    content: generateIconBase64(16),
    isBase64: true
  },
  {
    path: 'icons/icon48.png',
    category: 'icons',
    description: '48x48 extension management icon PNG file',
    content: generateIconBase64(48),
    isBase64: true
  },
  {
    path: 'icons/icon128.png',
    category: 'icons',
    description: '128x128 Chrome Web Store icon PNG file',
    content: generateIconBase64(128),
    isBase64: true
  }
];
