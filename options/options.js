/**
 * Koda Manga Downloader Extension - Options Controller
 */

document.addEventListener('DOMContentLoaded', () => {
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
      delayBetweenRequestsMs: parseInt(document.getElementById('opt-delay').value, 10) || 300,
      autoRetryAttempts: parseInt(document.getElementById('opt-retries').value, 10) || 3,
      filenameTemplate: document.getElementById('opt-template').value,
      defaultFormat: 'cbz'
    };

    chrome.storage.local.set({ settings: newSettings }, () => {
      const msg = document.getElementById('save-msg');
      msg.textContent = 'Settings saved successfully!';
      setTimeout(() => { msg.textContent = ''; }, 3000);
    });
  });
});
