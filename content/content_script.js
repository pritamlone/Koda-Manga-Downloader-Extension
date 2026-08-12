/**
 * Koda Manga Downloader Extension - Content Script
 * Active tab page scanner & page-context image fetcher fallback
 */

(function() {
  console.log('[Koda Extension] Active Content Script on:', window.location.href);

  function injectKodaFloatingBadge() {
    if (document.getElementById('koda-floating-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'koda-floating-badge';
    badge.innerHTML = `
      <div class="koda-badge-inner">
        <span class="koda-logo-icon">📖</span>
        <span class="koda-badge-title">KODA DOWNLOADER</span>
        <span class="koda-badge-count" id="koda-page-count">SCANNING...</span>
      </div>
    `;

    badge.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_POPUP_WITH_CURRENT' });
    });

    document.body.appendChild(badge);
    updateDetectedPages();
    
    // Periodically update page count if images are lazy loaded on scroll
    let scanCount = 0;
    const interval = setInterval(() => {
      updateDetectedPages();
      scanCount++;
      if (scanCount > 10) clearInterval(interval);
    }, 2000);
  }

  function updateDetectedPages() {
    const adapter = window.KodaAdapters ? window.KodaAdapters.getMatchingAdapter() : null;
    let count = 0;
    if (adapter) {
      const imgs = adapter.getChapterImages();
      count = imgs.length;
    }
    const countEl = document.getElementById('koda-page-count');
    if (countEl) {
      countEl.textContent = count > 0 ? `${count} PAGES FOUND` : 'SCAN PAGE';
    }
  }

  // Handle runtime messages from Popup & Service Worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCRAPE_CURRENT_PAGE') {
      const adapter = window.KodaAdapters.getMatchingAdapter();
      const details = adapter.getMangaDetails();
      const images = adapter.getChapterImages(request.customSelector);

      // Extract chapter number from URL or document title
      const chapMatch = window.location.href.match(/chapter[-_]?(\d+(\.\d+)?)/i) ||
                        document.title.match(/chapter\s*(\d+(\.\d+)?)/i) ||
                        window.location.href.match(/ch[-_]?(\d+(\.\d+)?)/i);

      const chapterNum = chapMatch ? parseFloat(chapMatch[1]) : 1;

      sendResponse({
        success: true,
        mangaTitle: details.title,
        chapterTitle: `Chapter ${chapterNum}`,
        chapterNum: chapterNum,
        images: images,
        pageUrl: window.location.href
      });
      return true;
    }

    // Fallback image fetcher from webpage context (bypasses CORS/403 Referer blocks)
    if (request.action === 'FETCH_IMAGE_FROM_PAGE') {
      fetchImageFromPageContext(request.url)
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }
  });

  async function fetchImageFromPageContext(imageUrl) {
    // 1. Try standard page fetch
    try {
      const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }
    } catch (e) {
      // Fall through to DOM canvas extraction
    }

    // 2. Fallback: Draw existing DOM image element onto HTML5 Canvas
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
})();
