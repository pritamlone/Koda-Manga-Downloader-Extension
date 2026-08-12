/**
 * Koda Manga Downloader Extension - Offscreen Document Engine
 * Executes image fetching with rate limiting & backoff retries,
 * creates CBZ (zip) or PDF files, and triggers native chrome download.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OFFSCREEN_PROCESS_TASK') {
    executeTask(message.task, message.settings);
  }
});

async function executeTask(task, settings) {
  console.log('[Koda Offscreen] Processing task:', task.mangaTitle, task.chapterTitle);

  const concurrency = settings.maxConcurrentDownloads || 3;
  const delayMs = settings.delayBetweenRequestsMs || 300;
  const maxRetries = settings.autoRetryAttempts || 3;

  const downloadedImages = [];
  let completed = 0;

  // Process pages in throttled chunks (V1 logic)
  for (let i = 0; i < task.pages.length; i += concurrency) {
    const chunk = task.pages.slice(i, i + concurrency);

    const chunkResults = await Promise.all(
      chunk.map(page => fetchPageWithRetry(page, maxRetries, delayMs))
    );

    chunkResults.forEach((res) => {
      if (res && res.data) {
        downloadedImages.push(res);
        completed++;
      }
    });

    // Update state in chrome.storage.local for popup progress bar
    await updateTaskProgress(task.id, completed, task.totalPages);

    // Throttle delay between chunks
    if (i + concurrency < task.pages.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Sort images in page order
  downloadedImages.sort((a, b) => a.index - b.index);

  // Package into target format
  if (task.format === 'cbz' || task.format === 'zip') {
    await packageZip(task, downloadedImages, settings, task.format === 'cbz' ? 'cbz' : 'zip');
  } else if (task.format === 'pdf') {
    await packagePdf(task, downloadedImages, settings);
  } else {
    // Individual folder downloads
    await packageFolder(task, downloadedImages, settings);
  }
}

async function fetchPageWithRetry(page, maxRetries, delayMs) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(page.url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const ext = getExtensionFromBlob(blob, page.url);
      return {
        index: page.index,
        blob: blob,
        extension: ext,
        data: await blobToArrayBuffer(blob)
      };
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`[Koda Fetch Failed] Page ${page.index}:`, err.message);
        return null;
      }
      // Exponential backoff delay
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
}

async function packageZip(task, images, settings, extension) {
  await updateTaskStatus(task.id, 'packaging');
  const zip = new JSZip();

  images.forEach((img, idx) => {
    const pageNum = String(idx + 1).padStart(3, '0');
    const filename = `page_${pageNum}.${img.extension}`;
    zip.file(filename, img.data);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const objectUrl = URL.createObjectURL(zipBlob);

  const cleanManga = sanitize(task.mangaTitle);
  const cleanChap = sanitize(task.chapterTitle);
  const targetFilename = `Koda_Manga/${cleanManga}/${cleanChap}.${extension}`;

  await chrome.runtime.sendMessage({
    action: 'TRIGGER_NATIVE_DOWNLOAD',
    downloadOptions: {
      url: objectUrl,
      filename: targetFilename
    }
  });

  await markTaskCompleted(task.id);
}

async function packagePdf(task, images, settings) {
  await updateTaskStatus(task.id, 'packaging');
  // Call internal PDF builder
  const pdfBlob = await window.KodaPdfBuilder.compileImagesToPdf(images);
  const objectUrl = URL.createObjectURL(pdfBlob);

  const cleanManga = sanitize(task.mangaTitle);
  const cleanChap = sanitize(task.chapterTitle);
  const targetFilename = `Koda_Manga/${cleanManga}/${cleanChap}.pdf`;

  await chrome.runtime.sendMessage({
    action: 'TRIGGER_NATIVE_DOWNLOAD',
    downloadOptions: {
      url: objectUrl,
      filename: targetFilename
    }
  });

  await markTaskCompleted(task.id);
}

async function packageFolder(task, images, settings) {
  const cleanManga = sanitize(task.mangaTitle);
  const cleanChap = sanitize(task.chapterTitle);

  for (const img of images) {
    const pageNum = String(img.index).padStart(3, '0');
    const objectUrl = URL.createObjectURL(img.blob);
    const targetFilename = `Koda_Manga/${cleanManga}/${cleanChap}/page_${pageNum}.${img.extension}`;

    await chrome.runtime.sendMessage({
      action: 'TRIGGER_NATIVE_DOWNLOAD',
      downloadOptions: {
        url: objectUrl,
        filename: targetFilename
      }
    });
  }

  await markTaskCompleted(task.id);
}

function blobToArrayBuffer(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });
}

function getExtensionFromBlob(blob, url) {
  if (blob.type.includes('png')) return 'png';
  if (blob.type.includes('webp')) return 'webp';
  if (blob.type.includes('gif')) return 'gif';
  if (url.endsWith('.png')) return 'png';
  if (url.endsWith('.webp')) return 'webp';
  return 'jpg';
}

function sanitize(str) {
  return (str || 'Chapter')
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
