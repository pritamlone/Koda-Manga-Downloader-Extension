/**
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
    document.getElementById('opt-floating-banner').checked = s.enableFloatingBanner !== false;
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const newSettings = {
      maxConcurrentDownloads: parseInt(document.getElementById('opt-concurrency').value, 10) || 3,
      delayBetweenRequestsMs: parseInt(document.getElementById('opt-delay').value, 10) || 300,
      autoRetryAttempts: parseInt(document.getElementById('opt-retries').value, 10) || 3,
      filenameTemplate: document.getElementById('opt-template').value,
      enableFloatingBanner: document.getElementById('opt-floating-banner').checked,
      defaultFormat: 'cbz'
    };

    chrome.storage.local.set({ settings: newSettings }, () => {
      const msg = document.getElementById('save-msg');
      msg.textContent = 'Settings saved successfully!';
      setTimeout(() => { msg.textContent = ''; }, 3000);
    });
  });
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
      toggleBtn.title = `Theme: Auto System [${systemStateText}] (Click for Light)`;
    }
  }
}
