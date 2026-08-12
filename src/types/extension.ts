export interface ExtensionFile {
  path: string;
  category: 'manifest' | 'background' | 'popup' | 'content' | 'options' | 'utils' | 'lib' | 'docs';
  description: string;
  content: string;
}

export interface AuditIssue {
  id: string;
  title: string;
  v1Status: 'robust' | 'missing' | 'basic';
  v2Status: 'broken' | 'new_feature' | 'flawed';
  restoredV3Status: 'resolved' | 'integrated';
  category: 'Queue Management' | 'MV3 Service Worker' | 'Format Export' | 'Site Parsing' | 'Naming & Storage';
  description: string;
  v1Approach: string;
  v2Bug: string;
  v3Solution: string;
}

export interface DownloadTask {
  id: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterNum: number;
  totalPages: number;
  completedPages: number;
  status: 'queued' | 'downloading' | 'packaging' | 'completed' | 'failed' | 'paused';
  format: 'cbz' | 'zip' | 'pdf' | 'folder';
  downloadSpeed?: string;
  errorMessage?: string;
  pages: { index: number; url: string; status: 'pending' | 'success' | 'failed'; sizeKb?: number }[];
}

export interface ExtensionSettings {
  defaultFormat: 'cbz' | 'zip' | 'pdf' | 'folder';
  maxConcurrentDownloads: number;
  delayBetweenRequestsMs: number;
  autoRetryAttempts: number;
  filenameTemplate: string;
  autoClosePopupOnStart: boolean;
  theme: 'dark' | 'light' | 'system';
  customSelectors: Array<{ domain: string; chapterSelector: string; imageSelector: string }>;
}
