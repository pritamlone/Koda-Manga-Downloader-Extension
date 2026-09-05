/**
 * Koda Manga Downloader Extension - Background Service Worker
 * Solid Engine V3: Direct Host-Permission Image Fetcher + Webpage Content Script Fallback +
 * Pure JSZip CBZ/ZIP Packaging + Chrome Download API Integration.
 */

importScripts('../lib/jszip.min.js');

let isProcessingQueue = false;

// Side Panel Setup
chrome.runtime.onInstalled.addListener(() => {
  // Prevent side panel from opening globally automatically
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error) => console.error(error));
  }

  // Create context menu to open side panel
  chrome.contextMenus.create({
    id: 'koda-open-side-panel',
    title: 'Open Koda Manga Downloader in Side Panel',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'koda-open-side-panel') {
    // This will open the side panel on the current tab
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  }
});


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
  if (message.action === 'START_LV2_TASKS') {
    startLv2Processor(message.tasks, message.mangaTitle, message.format);
    sendResponse({ status: 'started' });
    return true;
  }
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
    pageUrl: taskData.pageUrl,
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
    await addLog('error', `Task failed: ${err.message}`);
    await updateTaskStatus(nextTask.id, 'failed', err.message);
  } finally {
    isProcessingQueue = false;
    processNextQueueItem(); // Check for next item in queue
  }
}

async function executeDownloadTask(task, settings) {
  await setupRefererRule(task.pageUrl);
  console.log(`[Koda Engine] Executing Task: ${task.mangaTitle} - ${task.chapterTitle} (${task.totalPages} pages)`);
  await addLog('info', `Executing: ${task.chapterTitle}`);

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
    await clearRefererRule();
    throw new Error('Failed to download any images for this chapter.');
  }

  // Sort images in page index order
  downloadedImages.sort((a, b) => a.index - b.index);

  // Set status to packaging
  await clearRefererRule();
  await updateTaskStatus(task.id, 'packaging');

  // Generate target filename and clean manga folder path (no chapter numbers in folder name)
  const cleanManga = sanitizePathSegment(cleanMangaTitle(task.mangaTitle));
  const cleanChap = sanitizePathSegment(task.chapterTitle || 'Chapter_1');
  const ext = task.format === 'cbz' ? 'cbz' : (task.format === 'zip' ? 'zip' : 'pdf');

  if (task.format === 'cbz' || task.format === 'zip') {
    const zip = new JSZip();
    downloadedImages.forEach((img, idx) => {
      const pageNum = String(idx + 1).padStart(3, '0');
      const filename = `page_${pageNum}.${img.extension}`;
      zip.file(filename, img.bytes);
    });

    const dataUrl = await zip.generateAsync({ type: 'base64' });
    const mimeType = task.format === 'cbz' ? 'application/x-cbz' : 'application/zip';
    const fullDataUrl = `data:${mimeType};base64,${dataUrl}`;
    const targetPath = `Koda_Manga/${cleanManga}/${cleanChap}.${ext}`;

    await triggerChromeDownload({
      url: fullDataUrl,
      filename: targetPath
    });
  } else if (task.format === 'pdf') {
    // Basic image-to-pdf container
    const zip = new JSZip();
    downloadedImages.forEach((img, idx) => {
      const pageNum = String(idx + 1).padStart(3, '0');
      zip.file(`page_${pageNum}.${img.extension}`, img.bytes);
    });
    const dataUrl = await zip.generateAsync({ type: 'base64' });
    const fullDataUrl = `data:application/zip;base64,${dataUrl}`;
    const targetPath = `Koda_Manga/${cleanManga}/${cleanChap}.pdf.zip`;

    await triggerChromeDownload({
      url: fullDataUrl,
      filename: targetPath
    });
  } else {
    // Individual page image downloads - saved directly into the manga folder
    for (const img of downloadedImages) {
      const pageNum = String(img.index).padStart(3, '0');
      const targetPath = `Koda_Manga/${cleanManga}/${cleanChap}_page_${pageNum}.${img.extension}`;
      
      const blob = new Blob([img.bytes]);
      const arrayBuffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let k = 0; k < bytes.length; k++) {
        binary += String.fromCharCode(bytes[k]);
      }
      const dataUrl = `data:image/${img.extension};base64,${btoa(binary)}`;

      await triggerChromeDownload({
        url: dataUrl,
        filename: targetPath
      });
    }
  }

  await markTaskCompleted(task.id);
  console.log(`[Koda Engine] Task completed successfully: ${task.mangaTitle} - ${task.chapterTitle}`);
  await addLog('success', `Completed: ${task.chapterTitle}`);
}

async function fetchPageImageWithRetries(page, maxRetries, delayMs) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      // 1. Service Worker Direct Fetch (using host_permissions, bypassing CORS)
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
      // Direct fetch failed, proceed to fallback
    }

    // 2. Fallback: Request active tab content script to fetch from page context
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
    } catch (e) {
      // Ignore content script fallback error
    }

    attempt++;
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
    }
  }

  console.warn(`[Koda Engine] Image download skipped after ${maxRetries} attempts:`, page.url);
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
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
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
}

async function startLv2Processor(links, mangaTitle, format) {
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    console.log(`[LV2] Processing chapter ${i+1}/${links.length}: ${link.url}`);
    
    // We create a hidden offscreen document or execute script on the page to fetch the images of the link
    // However, since we can't easily navigate a tab without disrupting the user, 
    // we'll fetch the HTML of the link, parse it, and extract the images.
    
    try {
      const response = await fetch(link.url);
      const text = await response.text();
      
      // Parse the HTML
      // Since background workers don't have DOMParser, we'll use regex or send it to an offscreen document
      // Let's send it to the offscreen document to parse using a temporary div
      await ensureOffscreenDocument();
      const scrapeResult = await chrome.runtime.sendMessage({
         action: 'OFFSCREEN_LV2_PARSE_HTML',
         html: text,
         url: link.url
      });
      
      if(scrapeResult && scrapeResult.images && scrapeResult.images.length > 0) {
        await enqueueTask({
          mangaTitle: mangaTitle,
          chapterTitle: link.title || `Chapter ${i+1}`,
          chapterNum: i + 1,
          format: format,
          pages: scrapeResult.images
        });
      }
    } catch (e) {
      console.error("[LV2] Failed to process link:", link.url, e);
    }
    
    // Sleep to avoid getting IP banned
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['BLOBS', 'DOM_PARSER'],
    justification: 'To fetch images natively with fetch API escaping CORS restrictions and to parse HTML.'
  });
}

async function addLog(type, message) {
  const res = await chrome.storage.local.get(['logs']);
  const logs = res.logs || [];
  logs.unshift({ type, message, time: Date.now() });
  if (logs.length > 50) logs.pop();
  await chrome.storage.local.set({ logs });
}


async function setupRefererRule(pageUrl) {
  if (!pageUrl) return;
  const origin = new URL(pageUrl).origin + '/';
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "referer", operation: "set", value: origin },
          { header: "origin", operation: "set", value: origin.slice(0, -1) }
        ]
      },
      condition: {
        resourceTypes: ["xmlhttprequest", "image", "media", "other"]
      }
    }]
  });
}

async function clearRefererRule() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1]
  });
}
