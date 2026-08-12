# Koda Manga Downloader Extension

Koda is a Chrome Manifest V3 extension and interactive management studio designed for downloading and archiving manga chapters seamlessly into CBZ, PDF, standard ZIP, or JPEG/WebP image packages.

## Features

- **Manifest V3 Compliant Architecture**: Service worker background pipeline with offscreen document processing.
- **Multi-Format Export**: Convert and package chapter downloads into `.cbz` (Comic Book Zip), `.pdf`, or standard `.zip` formats.
- **Throttled Concurrency & Queue Engine**: Prevents HTTP 429 rate limits by queueing and batch-downloading images with configurable delays.
- **Site Adapters**: Pre-configured scrapers and custom DOM CSS selector fallbacks for manga reading platforms.
- **Chrome Storage Sync**: Retains task queue and download state across sessions.

## Project Structure

```
├── src/
│   ├── components/       # Studio dashboard components (Header, CodeExplorer, AuditPanel, ExtensionSimulator, FullOutputView)
│   ├── data/             # Extension codebase files and audit data
│   ├── utils/            # ZIP exporter and helper utilities
│   ├── types/            # TypeScript interfaces and definitions
│   └── App.tsx           # Main application entry
├── index.html
└── package.json
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## License

MIT
