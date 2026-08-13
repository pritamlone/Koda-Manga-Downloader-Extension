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

    let isDragging = false;
    let isDragIntent = false;
    let startX = 0, startY = 0;
    let initialRect = null;

    badge.addEventListener('mousedown', (e) => {
      isDragging = false;
      isDragIntent = true;
      startX = e.clientX;
      startY = e.clientY;
      initialRect = badge.getBoundingClientRect();
      
      // Remove right/bottom constraints to allow left/top positioning
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.style.left = initialRect.left + 'px';
      badge.style.top = initialRect.top + 'px';
      badge.classList.add('is-dragging');
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault(); // Prevent text selection during drag
    });

    function onMouseMove(e) {
      if (!isDragIntent) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // Threshold to consider it a drag vs click
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDragging = true;
      }

      if (isDragging) {
        badge.style.left = (initialRect.left + dx) + 'px';
        badge.style.top = (initialRect.top + dy) + 'px';
      }
    }

    function onMouseUp(e) {
      isDragIntent = false;
      badge.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    let popupIframe = null;

    badge.addEventListener('click', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      const popupWidth = 380;
      const popupHeight = 455;

      const positionPopup = () => {
        const rect = badge.getBoundingClientRect();
        let top, left;

        // Vertical positioning (Prefer Above)
        if (rect.top >= popupHeight + 10) {
          top = rect.top - popupHeight - 10;
        } else if (window.innerHeight - rect.bottom >= popupHeight + 10) {
          top = rect.bottom + 10;
        } else {
          top = 10; // Fallback
        }

        // Horizontal positioning (Prefer aligning with badge's edge depending on side of screen)
        if (rect.left > window.innerWidth / 2) {
          // Badge on right half -> align right edges
          if (rect.right >= popupWidth + 10) {
            left = rect.right - popupWidth;
          } else {
            left = window.innerWidth - popupWidth - 10;
          }
        } else {
          // Badge on left half -> align left edges
          if (window.innerWidth - rect.left >= popupWidth + 10) {
            left = rect.left;
          } else {
            left = 10;
          }
        }

        popupIframe.style.top = top + 'px';
        popupIframe.style.left = left + 'px';
      };

      if (popupIframe) {
        // Toggle visibility if it already exists
        const isHidden = popupIframe.style.display === 'none';
        popupIframe.style.display = isHidden ? 'block' : 'none';
        
        // Reposition based on current badge position
        if (isHidden) {
          positionPopup();
        }
      } else {
        // Create iframe popup
        popupIframe = document.createElement('iframe');
        popupIframe.src = chrome.runtime.getURL('popup/popup.html');
        popupIframe.id = 'koda-extension-iframe';
        
        // Style it to float near the badge
        popupIframe.style.position = 'fixed';
        popupIframe.style.width = popupWidth + 'px';
        popupIframe.style.height = popupHeight + 'px';
        popupIframe.style.border = '1px solid #333';
        popupIframe.style.borderRadius = '8px';
        popupIframe.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        popupIframe.style.zIndex = '9999999999';
        popupIframe.style.backgroundColor = '#121212';
        
        positionPopup();
        
        document.body.appendChild(popupIframe);
      }
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

  let lastScannedCount = 0;
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

    if (count > lastScannedCount) {
      const badge = document.getElementById('koda-floating-badge');
      if (badge) {
        badge.classList.remove('koda-glow');
        // trigger reflow to restart animation
        void badge.offsetWidth;
        badge.classList.add('koda-glow');
        
        // Remove class after animation finishes (1500ms)
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
