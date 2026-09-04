/**
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

  // Store active mode locally for reference
  window.kodaThemeMode = savedTheme;
  applyTheme(savedTheme);

  // Listen for system theme changes if in auto mode
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
      toggleBtn.title = `Theme: Auto System [${systemStateText}] (Click for Light)`;
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

      scrapedData = response; scrapedData.url = tab.url;
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
      pages: scrapedData.images,
      pageUrl: scrapedData.url
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
        ${task.error ? `<div style="color:#ff5555; font-size:10px; margin-top:4px; font-weight:bold;">ERROR: ${task.error}</div>` : ''}
      </div>
    `;
  }).join('');
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.logs) {
    renderLogs(changes.logs.newValue);
  }
});
async function initLogs() {
  const res = await chrome.storage.local.get(['logs']);
  renderLogs(res.logs || []);
}
function renderLogs(logs) {
  const container = document.getElementById('log-list-container');
  if (!container) return;
  if (logs.length === 0) {
    container.innerHTML = '<li>[SYSTEM] No logs available.</li>';
    return;
  }
  container.innerHTML = logs.map(l => {
    let color = '#ccc';
    if (l.type === 'error') color = '#ff5555';
    if (l.type === 'success') color = '#55ff55';
    if (l.type === 'warning') color = '#ffff55';
    return `<li style="color: ${color}; border-bottom: 1px solid #333; padding: 4px 0;">[${new Date(l.time).toLocaleTimeString()}] ${l.message}</li>`;
  }).join('');
}
document.addEventListener('DOMContentLoaded', () => {
  const btnClearLogs = document.getElementById('btn-clear-logs');
  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      chrome.storage.local.set({ logs: [] });
    });
  }
  initLogs();
});
