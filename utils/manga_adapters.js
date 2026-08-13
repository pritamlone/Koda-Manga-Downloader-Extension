/**
 * Koda Manga Downloader Extension - Modular Site Adapters
 * High-speed multi-attribute scraper supporting AquaManga/AquaReader, Madara,
 * MangaDex, Manganato, AsuraScans, FlameComics, and Universal DOM Fallback.
 */

window.KodaAdapters = {
  // Helper to parse clean manga title & automatically detect chapter number/title
  parseMangaAndChapterInfo: (rawTitle, pageUrl) => {
    let title = (rawTitle || '').replace(/\s+/g, ' ').trim();
    let chapterNum = 1;

    // 1. URL Chapter Regex Detection
    const urlMatches = [
      /chapter[-_/\s]*(\d+(\.\d+)?)/i,
      /ch[-_/\s]*(\d+(\.\d+)?)/i,
      /c[-_/\s]*(\d+(\.\d+)?)/i,
      /chap[-_/\s]*(\d+(\.\d+)?)/i,
      /\/(\d+(\.\d+)?)\/?$/
    ];

    let detectedFromUrl = null;
    if (pageUrl) {
      for (const reg of urlMatches) {
        const match = pageUrl.match(reg);
        if (match && match[1]) {
          detectedFromUrl = parseFloat(match[1]);
          break;
        }
      }
    }

    // 2. Title Chapter Regex Detection
    const titleMatches = [
      /chapter\s*(\d+(\.\d+)?)/i,
      /ch\.\s*(\d+(\.\d+)?)/i,
      /ch\s*(\d+(\.\d+)?)/i,
      /chap\.\s*(\d+(\.\d+)?)/i,
      /chap\s*(\d+(\.\d+)?)/i,
      /episode\s*(\d+(\.\d+)?)/i
    ];

    let detectedFromTitle = null;
    for (const reg of titleMatches) {
      const match = title.match(reg);
      if (match && match[1]) {
        detectedFromTitle = parseFloat(match[1]);
        break;
      }
    }

    // 3. DOM Chapter Selectors Detection
    let detectedFromDom = null;
    if (typeof document !== 'undefined') {
      const chapterSelect = document.querySelector('select[name*="chapter"], select#chapter-select, select.single-chapter-select, .chapter-select');
      if (chapterSelect) {
        const selectedOpt = chapterSelect.options[chapterSelect.selectedIndex];
        const textToMatch = selectedOpt ? selectedOpt.text : chapterSelect.value;
        const match = textToMatch ? textToMatch.match(/(\d+(\.\d+)?)/) : null;
        if (match) detectedFromDom = parseFloat(match[1]);
      }

      if (!detectedFromDom) {
        const chapterHeading = document.querySelector('.current-chapter, #chapter-heading, h1.entry-title, .chap-title, .breadcrumb li.active');
        if (chapterHeading) {
          const match = chapterHeading.textContent.match(/chapter\s*(\d+(\.\d+)?)/i) || chapterHeading.textContent.match(/(\d+(\.\d+)?)/);
          if (match) detectedFromDom = parseFloat(match[1]);
        }
      }
    }

    chapterNum = detectedFromTitle || detectedFromUrl || detectedFromDom || 1;
    const chapterTitle = `Chapter ${chapterNum}`;

    // 4. Clean Manga Title: Strip site branding, chapter/episode strings, and repeated titles so all chapters go into the exact same clean folder name
    let cleanedManga = title;

    // Remove site branding
    cleanedManga = cleanedManga.replace(/\s*[\-\|–—>:>]?\s*(Read Online|MangaDex|Manganato|AquaManga|Asura\s*Scans|Flame\s*Comics|Read Manga|All Chapters|WEBTOON|Webtoons|Manga|Free).*$/gi, '');

    // Remove Episode / Chapter / Vol / Season prefixes and all trailing text
    cleanedManga = cleanedManga
      .replace(/\s*[\-\|–—>:>]?\s*(Chapter|Ch\.|Chap\.|Ch|Episode|Ep\.|Ep|Vol\.|Volume|Vol|Season|S\d+|#)\s*\d+.*$/gi, '')
      .replace(/\s*[\-\|–—]?\s*c\d+(\.\d+)?.*$/gi, '')
      .replace(/\s*[\-\|–—]\s*\d+(\.\d+)?\s*$/g, '')
      .trim();

    // Remove duplicated title phrase repeats e.g. "Magic Emperor - Magic Emperor" -> "Magic Emperor"
    const titleParts = cleanedManga.split(/\s*[\-\|–—]\s*/);
    if (titleParts.length > 1 && titleParts[0].toLowerCase().trim() === titleParts[1].toLowerCase().trim()) {
      cleanedManga = titleParts[0].trim();
    }

    // Clean trailing non-word noise characters like trailing dashes or spaces
    cleanedManga = cleanedManga.replace(/[\s\-\|–—_:]+$/, '').trim();

    if (!cleanedManga) {
      cleanedManga = 'Manga';
    }

    return {
      mangaTitle: cleanedManga,
      chapterTitle: chapterTitle,
      chapterNum: chapterNum
    };
  },

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

  // Helper to robustly extract chapter links from a manga index page
  extractChapterLinks: () => {
    const links = Array.from(document.querySelectorAll('a'));
    const knownLinks = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-list a, .listing-chapters_wrap a, .eplister a, #chapterlist a, .clstyle a, a[href*="chapter"], a.chapter, li.chapter a'));
    
    const chapterLinks = links.filter(a => {
      if (!a.href || a.href.startsWith('javascript:')) return false;
      const baseUrl = window.location.href.split('#')[0];
      if (a.href.includes('#') && a.href.split('#')[0] === baseUrl) return false;
      
      if (knownLinks.includes(a)) return true;
      
      const text = a.textContent.toLowerCase();
      const href = a.getAttribute('href') || '';
      
      if (text.includes('chapter') || text.includes('ch.') || text.includes('episode') || text.match(/^ch\s*\d+/i)) {
        return true;
      }
      
      if (href.toLowerCase().includes('chapter') || href.toLowerCase().includes('ch-')) {
         return true;
      }
      
      if (text.trim().match(/^\d+(\.\d+)?$/)) {
         let parent = a.parentElement;
         for (let i=0; i<3 && parent; i++) {
             if (parent.className && typeof parent.className === 'string' && (parent.className.toLowerCase().includes('chapter') || parent.className.toLowerCase().includes('list'))) {
                 return true;
             }
             parent = parent.parentElement;
         }
      }
      return false;
    });
    
    const unique = [];
    const seen = new Set();
    for (const a of chapterLinks) {
        if (!seen.has(a.href)) {
            seen.add(a.href);
            unique.push({
               title: a.textContent.replace(/\s+/g, ' ').trim() || 'Chapter',
               url: a.href
            });
        }
    }
    return unique;
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
      getChapterLinks: () => { return window.KodaAdapters.extractChapterLinks(); },
      _oldgetChapterLinks: () => {
        const links = Array.from(document.querySelectorAll(".wp-manga-chapter a, .chapter-list a, .listing-chapters_wrap a"));
        return links.map(l => ({ title: l.textContent.trim(), url: l.href })).filter(l => l.url);
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
      getChapterLinks: () => { return window.KodaAdapters.extractChapterLinks(); },
      _oldgetChapterLinks: () => {
        const links = Array.from(document.querySelectorAll(".wp-manga-chapter a, .chapter-list a, .listing-chapters_wrap a"));
        return links.map(l => ({ title: l.textContent.trim(), url: l.href })).filter(l => l.url);
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
      getChapterLinks: () => { return window.KodaAdapters.extractChapterLinks(); },
      _oldgetChapterLinks: () => {
        const links = Array.from(document.querySelectorAll(".wp-manga-chapter a, .chapter-list a, .listing-chapters_wrap a"));
        return links.map(l => ({ title: l.textContent.trim(), url: l.href })).filter(l => l.url);
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
      getChapterLinks: () => { return window.KodaAdapters.extractChapterLinks(); },
      _oldgetChapterLinks: () => { return window.KodaAdapters.extractChapterLinks(); },
      _oldgetChapterLinks: () => {
        const links = Array.from(document.querySelectorAll("a[href*=\"chapter\"], a.chapter, li.chapter a"));
        return links.map(l => ({ title: l.textContent.trim(), url: l.href })).filter(l => l.url);
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
