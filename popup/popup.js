/**
 * Koda Manga Downloader Extension - Popup Controller
 */

let scrapedData = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadCurrentPageData();
  bindEvents();
  startQueuePolling();
});

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
      document.getElementById('badge-page-count').textContent = `${response.images.length} PAGES DETECTED`;
      statusLine.textContent = `READY: ${response.images.length} PAGES EXTRACTED`;
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
      // Switch to Active Downloads Tab
      document.querySelector('[data-tab="tab-active"]').click();
    });
  });

  // Batch Range Queue
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
        chapterTitle: `Chapter ${c}`,
        chapterNum: c,
        format: format,
        pages: scrapedData.images // In single-page mode, queues chapter pages
      };

      chrome.runtime.sendMessage({
        action: 'START_DOWNLOAD_TASK',
        task: taskPayload
      });
    }

    document.getElementById('status-line').textContent = `QUEUED ${end - start + 1} CHAPTERS!`;
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
    return `
      <div class="koda-task-item ${task.status}">
        <div class="koda-task-header">
          <span class="koda-task-name">${task.mangaTitle} - ${task.chapterTitle}</span>
          <span class="koda-format-tag">${task.format.toUpperCase()}</span>
        </div>
        <div class="koda-progress-bar-bg">
          <div class="koda-progress-bar-fill" style="width: ${percent}%"></div>
        </div>
        <div class="koda-task-footer">
          <span>${task.completedPages} / ${task.totalPages} PAGES (${percent}%)</span>
          <span class="koda-task-status">${task.status.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');
}
