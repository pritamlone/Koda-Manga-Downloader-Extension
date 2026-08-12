/**
 * Koda Manga Downloader Extension - Modular Site Adapters
 * High-speed multi-attribute scraper supporting AquaManga/AquaReader, Madara,
 * MangaDex, Manganato, AsuraScans, FlameComics, and Universal DOM Fallback.
 */

window.KodaAdapters = {
  // Helper to safely extract full image URL from lazy-loaded elements
  extractImageUrl: (img) => {
    if (!img) return null;
    const candidate = img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy-src') ||
                    img.getAttribute('data-original') ||
                    img.getAttribute('data-cdn') ||
                    img.getAttribute('data-full-url') ||
                    img.getAttribute('src') ||
                    img.src;

    if (!candidate || candidate.startsWith('data:image/svg') || candidate.startsWith('data:image/gif')) {
      return null;
    }

    try {
      // Resolve relative URLs to absolute HTTP(S) URLs
      return new URL(candidate, window.location.href).href;
    } catch (e) {
      return candidate;
    }
  },

  adapters: [
    {
      name: 'AquaManga / AquaReader / Madara Theme',
      domainMatch: /aquareader|aquamanga|madara|manga/i,
      detect: () => {
        return !!(
          document.querySelector('.reading-content') ||
          document.querySelector('.page-break') ||
          document.querySelector('.wp-manga-chapter-img') ||
          document.querySelector('#readerarea') ||
          /aquareader|aquamanga/.test(window.location.hostname)
        );
      },
      getMangaDetails: () => {
        const titleEl = document.querySelector('h1, .post-title, .breadcrumb li:nth-child(2) a') || document.title;
        const text = typeof titleEl === 'string' ? titleEl : (titleEl.textContent || 'Manga');
        return {
          title: text.replace(/\s+/g, ' ').trim(),
          site: 'AquaManga/Madara'
        };
      },
      getChapterImages: () => {
        const selectors = [
          '.reading-content img',
          '.page-break img',
          '.wp-manga-chapter-img',
          '#readerarea img',
          'div[id^="page-"] img',
          '.container-chapter-reader img'
        ];
        
        let elements = Array.from(document.querySelectorAll(selectors.join(',')));
        if (elements.length === 0) {
          elements = Array.from(document.querySelectorAll('img'));
        }

        const urls = elements
          .map(img => window.KodaAdapters.extractImageUrl(img))
          .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

        // Deduplicate while preserving sequence order
        return Array.from(new Set(urls));
      }
    },
    {
      name: 'MangaDex',
      domainMatch: /mangadex\.org/,
      detect: () => window.location.hostname.includes('mangadex.org'),
      getMangaDetails: () => {
        const titleEl = document.querySelector('h1, .title');
        return {
          title: titleEl ? titleEl.textContent.trim() : 'MangaDex',
          site: 'MangaDex'
        };
      },
      getChapterImages: () => {
        const imgs = Array.from(document.querySelectorAll('.md-page img, img[src*="mangadex"], .reader-page img'));
        const urls = imgs.map(img => window.KodaAdapters.extractImageUrl(img)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    },
    {
      name: 'Manganato',
      domainMatch: /manganato|chapmanganato/,
      detect: () => window.location.hostname.includes('manganato'),
      getMangaDetails: () => {
        const breadcrumb = document.querySelectorAll('.panel-breadcrumb a');
        const title = breadcrumb.length > 1 ? breadcrumb[1].textContent.trim() : 'Manganato';
        return { title, site: 'Manganato' };
      },
      getChapterImages: () => {
        const container = document.querySelector('.container-chapter-reader');
        if (!container) return [];
        const imgs = Array.from(container.querySelectorAll('img'));
        const urls = imgs.map(img => window.KodaAdapters.extractImageUrl(img)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    },
    {
      name: 'Generic Universal Scraper',
      domainMatch: /.*/,
      detect: () => true,
      getMangaDetails: () => {
        const metaTitle = document.querySelector('meta[property="og:title"]');
        const rawTitle = metaTitle ? metaTitle.getAttribute('content') : document.title;
        return {
          title: (rawTitle || 'Manga Chapter').replace(/\s+/g, ' ').trim(),
          site: window.location.hostname
        };
      },
      getChapterImages: (customSelector) => {
        let imgs = [];
        if (customSelector) {
          imgs = Array.from(document.querySelectorAll(customSelector));
        } else {
          imgs = Array.from(document.querySelectorAll('.reader img, #reader img, .chapter-content img, article img, img[class*="page"], img[id*="page"], .reading-content img'));
          if (imgs.length === 0) {
            imgs = Array.from(document.querySelectorAll('img')).filter(i => {
              const rect = i.getBoundingClientRect();
              return (rect.width > 200 || rect.height > 200) && !i.src.includes('avatar') && !i.src.includes('logo');
            });
          }
        }
        const urls = imgs.map(i => window.KodaAdapters.extractImageUrl(i)).filter(Boolean);
        return Array.from(new Set(urls));
      }
    }
  ],

  getMatchingAdapter: () => {
    return window.KodaAdapters.adapters.find(a => a.detect()) || window.KodaAdapters.adapters[window.KodaAdapters.adapters.length - 1];
  }
};
