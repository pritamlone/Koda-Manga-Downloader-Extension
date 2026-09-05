import fs from 'fs';
let code = fs.readFileSync('content/content_script.js', 'utf8');

code = code.replace(
  /if \(document.readyState === 'loading'\) \{\s*document.addEventListener\('DOMContentLoaded', injectKodaFloatingBadge\);\s*\} else \{\s*injectKodaFloatingBadge\(\);\s*\}/,
  `function checkAndInjectBadge() {
    try {
      chrome.storage.local.get(['settings'], (res) => {
        const s = res.settings || {};
        if (s.enableFloatingBanner !== false) {
          injectKodaFloatingBadge();
        }
      });
    } catch (e) {
      injectKodaFloatingBadge();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInjectBadge);
  } else {
    checkAndInjectBadge();
  }`
);

fs.writeFileSync('content/content_script.js', code);
