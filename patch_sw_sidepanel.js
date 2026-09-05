import fs from 'fs';
let code = fs.readFileSync('background/service-worker.js', 'utf8');

const sidepanelCode = `
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
`;

code = code.replace(
  /let isProcessingQueue = false;/,
  "let isProcessingQueue = false;\n" + sidepanelCode
);

fs.writeFileSync('background/service-worker.js', code);
