import { AuditIssue } from '../types/extension';

export const AUDIT_ISSUES: AuditIssue[] = [
  {
    id: 'issue-1',
    title: 'Unbounded Async Concurrency & Rate Limiting (HTTP 429)',
    v1Status: 'robust',
    v2Status: 'broken',
    restoredV3Status: 'resolved',
    category: 'Queue Management',
    description: 'V2 replaced V1\'s sequential batch queue with `Promise.all(pages.map(fetch))` firing dozens of simultaneous image requests.',
    v1Approach: 'Used a strict FIFO queue with configurable concurrency (default 3) and mandatory inter-request delay (300ms) to bypass CDN rate limits.',
    v2Bug: 'Fired 50-100 parallel HTTP image requests instantly. CDN servers (MangaDex, FlameComics, etc.) blocked requests with HTTP 429 Too Many Requests.',
    v3Solution: 'Restored V1\'s chunked queue manager (`download_queue.js`) with configurable batch concurrency, inter-request throttle delay, and exponential backoff retries.'
  },
  {
    id: 'issue-2',
    title: 'Service Worker Lifetime & Blob Memory Leaks in MV3',
    v1Status: 'robust',
    v2Status: 'broken',
    restoredV3Status: 'resolved',
    category: 'MV3 Service Worker',
    description: 'V2 stored raw binary blobs and `URL.createObjectURL()` references directly in background `service-worker.js` memory.',
    v1Approach: 'Streamed image downloads to Chrome\'s Native `chrome.downloads` API or passedArrayBuffers to an offscreen processing context.',
    v2Bug: 'Chrome terminated the service worker after 30s of background inactivity, garbage-collecting blob memory and abandoning incomplete downloads.',
    v3Solution: 'Implemented MV3 Offscreen Document architecture (`offscreen.html`). Offscreen contexts hold binary JSZip/PDF generators safely without Service Worker state wipeout.'
  },
  {
    id: 'issue-3',
    title: 'DOMParser Absence in Background Service Worker',
    v1Status: 'robust',
    v2Status: 'flawed',
    restoredV3Status: 'resolved',
    category: 'Site Parsing',
    description: 'V2 attempted to parse HTML strings directly inside `background.js` using `new DOMParser()`, which does not exist in Web Workers.',
    v1Approach: 'Performed DOM parsing in `content_script.js` directly within the active tab context where DOM APIs are natively available.',
    v2Bug: 'Background script threw `ReferenceError: DOMParser is not defined`, crashing chapter list extraction on non-API manga sites.',
    v3Solution: 'Combined V1 content script extraction with V2 modular adapter framework (`utils/manga_adapters.js`). Content scripts parse the DOM live in-tab and send structured page list JSON to the background worker.'
  },
  {
    id: 'issue-4',
    title: 'Forbidden OS Filename Characters & Storage Loss',
    v1Status: 'robust',
    v2Status: 'broken',
    restoredV3Status: 'resolved',
    category: 'Naming & Storage',
    description: 'V2\'s customizable filename templates allowed invalid characters (`:`, `?`, `*`, `"`, `<`, `>`, `|`) and reset progress state when closed.',
    v1Approach: 'Sanitized all target paths with strict regex replacing invalid OS filesystem characters with clean dashes, and stored progress in `chrome.storage.local`.',
    v2Bug: 'Chrome `chrome.downloads.download` threw unhandled exceptions on titles containing colons (e.g. "Solo Leveling: Arise"), and popup closed state lost pending tasks.',
    v3Solution: 'Integrated robust path sanitizer engine into settings template formatter, and bound all queue operations to `chrome.storage.local` with background alarm heartbeat.'
  },
  {
    id: 'issue-5',
    title: 'Integration of V2\'s UI & Multi-Format Packaging (CBZ, PDF, ZIP)',
    v1Status: 'missing',
    v2Status: 'new_feature',
    restoredV3Status: 'integrated',
    category: 'Format Export',
    description: 'V2 introduced CBZ, PDF, and ZIP archive creation along with a polished dark theme UI, but it was unusable due to underlying engine crashes.',
    v1Approach: 'V1 only downloaded individual raw image files into subfolders.',
    v2Bug: 'Packaging logic relied on broken background service worker blob memory.',
    v3Solution: 'Combined V2\'s JSZip CBZ packaging & PDF canvas compiler inside the reliable V1-style Offscreen Document pipeline, fully restoring feature richness with 100% stability.'
  }
];
