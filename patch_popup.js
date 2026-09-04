import fs from 'fs';
let code = fs.readFileSync('popup/popup.js', 'utf8');

code = code.replace(
  /scrapedData = response;/g,
  "scrapedData = response; scrapedData.url = tab.url;"
);

code = code.replace(
  /format: format,\s+pages: scrapedData\.images\s+\};/g,
  "format: format,\n      pages: scrapedData.images,\n      pageUrl: scrapedData.url\n    };"
);

code += `
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
    return \`<li style="color: \${color}; border-bottom: 1px solid #333; padding: 4px 0;">[\${new Date(l.time).toLocaleTimeString()}] \${l.message}</li>\`;
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
`;
fs.writeFileSync('popup/popup.js', code);
