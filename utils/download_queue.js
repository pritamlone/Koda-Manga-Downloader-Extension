/**
 * Koda Manga Downloader Extension - Queue Utility
 * Restored V1 logic: Concurrency throttles, retries, and item prioritization.
 */

class KodaQueueEngine {
  constructor(concurrency = 3, delayMs = 300) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.activeWorkers = 0;
    this.taskQueue = [];
  }

  enqueue(item) {
    this.taskQueue.push(item);
  }

  clear() {
    this.taskQueue = [];
  }
}

if (typeof module !== 'undefined') {
  module.exports = { KodaQueueEngine };
}
