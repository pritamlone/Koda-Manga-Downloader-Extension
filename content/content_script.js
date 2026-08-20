/**
 * Koda Manga Downloader Extension - Content Script
 * Active tab page scanner & page-context image fetcher fallback
 */

(function() {
  console.log('[Koda Extension] Active Content Script on:', window.location.href);

  function injectKodaFloatingBadge() {
    if (document.getElementById('koda-floating-container') || document.getElementById('koda-floating-badge')) return;

    // Create Root Floating Container
    const container = document.createElement('div');
    container.id = 'koda-floating-container';

    // State 1 & 2: Floating Badge (Contracted Icon -> Expand to Bar on Hover)
    const badge = document.createElement('div');
    badge.id = 'koda-floating-badge';
    badge.title = 'Koda Manga Downloader (Click to open, hover to inspect)';
    
    // Check if extension icon is accessible, with SVG fallback
    let iconUrl = '';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        iconUrl = chrome.runtime.getURL('icons/icon48.png');
      }
    } catch (e) {}

    badge.innerHTML = `
      <div class="koda-badge-icon-box" id="koda-badge-icon-anchor">
        ${iconUrl ? `<img src="${iconUrl}" class="koda-badge-icon-img" alt="Koda" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
        <span style="${iconUrl ? 'display:none;' : ''}font-size:15px;line-height:1;"><img class="koda-logo-icon" src="${typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('icons/icon16.png') : 'icons/icon16.png'}" alt="icon" /></span>
        <span class="koda-badge-pip" id="koda-badge-pip"></span>
      </div>
      <div class="koda-badge-bar-content">
        <span class="koda-badge-title">KODA DOWNLOADER</span>
        <span class="koda-badge-count" id="koda-page-count">SCANNING...</span>
        <span class="koda-badge-action-hint">EXPAND ↗</span>
      </div>
    `;

    // State 3: Popup Window (Tab size 380x520)
    const popupWindow = document.createElement('div');
    popupWindow.id = 'koda-popup-window';
    popupWindow.innerHTML = `
      <div class="koda-popup-header">
        <div class="koda-popup-title">
          <span>📖</span>
          <span>KODA MANGA DOWNLOADER</span>
        </div>
        <div class="koda-popup-controls">
          <button type="button" class="koda-popup-btn" id="koda-popup-close-btn" title="Contract to Icon">✕</button>
        </div>
      </div>
      <iframe class="koda-popup-iframe" id="koda-extension-iframe" src="${typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('popup/popup.html') : ''}"></iframe>
    `;

    container.appendChild(popupWindow);
    container.appendChild(badge);
    document.body.appendChild(container);

    let isPopupOpen = false;
    let isDragging = false;
    let isDragIntent = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    // Close / Contract popup
    function closePopup() {
      isPopupOpen = false;
      popupWindow.classList.remove('is-open');
      badge.classList.remove('is-active');
    }

    // Open / Expand popup tab
    function openPopup() {
      isPopupOpen = true;
      popupWindow.classList.add('is-open');
      badge.classList.add('is-active');

      // Intelligently calculate popup placement relative to container & viewport
      const rect = container.getBoundingClientRect();
      const popupWidth = 380;
      const popupHeight = 520;
      
      // If near top half of screen, open downward; if near bottom, open upward
      if (rect.top < popupHeight + 20) {
        popupWindow.style.transformOrigin = 'top right';
        container.style.flexDirection = 'column-reverse';
        popupWindow.style.marginBottom = '0px';
        popupWindow.style.marginTop = '10px';
      } else {
        popupWindow.style.transformOrigin = 'bottom right';
        container.style.flexDirection = 'column';
        popupWindow.style.marginBottom = '10px';
        popupWindow.style.marginTop = '0px';
      }
    }

    function togglePopup() {
      if (isPopupOpen) {
        closePopup();
      } else {
        openPopup();
      }
    }

    // Header close button
    const closeBtn = document.getElementById('koda-popup-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePopup();
      });
    }

    // Dragging Logic
    badge.addEventListener('mousedown', (e) => {
      // Don't drag if clicking inside popup
      if (e.target.closest('#koda-popup-window')) return;

      isDragging = false;
      isDragIntent = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      
      // Convert right/bottom to fixed left/top coords
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = initialLeft + 'px';
      container.style.top = initialTop + 'px';
      badge.classList.add('is-dragging');
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!isDragIntent) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Threshold to distinguish drag vs click
      if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isDragging = true;
      }

      if (isDragging) {
        let newLeft = Math.max(10, Math.min(window.innerWidth - 60, initialLeft + dx));
        let newTop = Math.max(10, Math.min(window.innerHeight - 60, initialTop + dy));
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
      }
    }

    function onMouseUp(e) {
      isDragIntent = false;
      badge.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    // Click handler -> Expand to full popup tab size
    badge.addEventListener('click', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      togglePopup();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isPopupOpen && !container.contains(e.target)) {
        closePopup();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPopupOpen) {
        closePopup();
      }
    });

    updateDetectedPages();
    
    // Periodically update page count if images are lazy loaded on scroll
    let scanCount = 0;
    const interval = setInterval(() => {
      updateDetectedPages();
      scanCount++;
      if (scanCount > 10) clearInterval(interval);
    }, 2000);
  }

  let lastScannedCount = 0;
  function updateDetectedPages() {
    const adapter = window.KodaAdapters ? window.KodaAdapters.getMatchingAdapter() : null;
    let count = 0;
    if (adapter) {
      const imgs = adapter.getChapterImages();
      count = imgs.length;
    }
    const countEl = document.getElementById('koda-page-count');
    const badge = document.getElementById('koda-floating-badge');
    
    if (countEl) {
      countEl.textContent = count > 0 ? `${count} PAGES FOUND` : 'SCAN PAGE';
    }

    if (badge) {
      if (count > 0) {
        badge.classList.add('has-pages');
      } else {
        badge.classList.remove('has-pages');
      }
    }

    if (count > lastScannedCount) {
      if (badge) {
        badge.classList.remove('koda-glow');
        void badge.offsetWidth; // trigger reflow
        badge.classList.add('koda-glow');
        
        setTimeout(() => {
          badge.classList.remove('koda-glow');
        }, 1500);
      }
      lastScannedCount = count;
    }
  }

  // Handle runtime messages from Popup & Service Worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCRAPE_CURRENT_PAGE') {
      const adapter = window.KodaAdapters.getMatchingAdapter();
      const details = adapter.getMangaDetails();
      const images = adapter.getChapterImages(request.customSelector);

      // Automatically parse clean manga title & detect chapter number/title
      const parsed = window.KodaAdapters.parseMangaAndChapterInfo(
        details.title || document.title,
        window.location.href
      );

      sendResponse({
        success: true,
        mangaTitle: parsed.mangaTitle,
        chapterTitle: parsed.chapterTitle,
        chapterNum: parsed.chapterNum,
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
