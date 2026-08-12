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

## How to Load Unpacked Extension in Chrome / Edge

### Option 1: Exporting from the Koda Studio App (Recommended)
1. In the Koda Studio web dashboard, click the orange **Export Extension (.zip)** button (top right header or Full Output tab).
2. Unzip the downloaded file (`koda-manga-downloader-v3.0.0.zip`).
3. Open your browser's extension page:
   - **Microsoft Edge**: Navigate to `edge://extensions`
   - **Google Chrome**: Navigate to `chrome://extensions`
4. Enable **Developer Mode** (toggle on the left sidebar or top right).
5. Click **Load Unpacked** and select the extracted `koda-manga-downloader-v3.0.0` folder.

> ⚠️ **Important Note on "Manifest file is missing" Error**:
> Do NOT select the outer repository folder (`Koda-Manga-Downloader-Extension-main`) directly in "Load Unpacked". That outer folder contains the React Studio web dashboard source code (`package.json`, `src/`, etc.). `manifest.json` is located inside the exported extension zip package or the extension build output!

## Getting Started (Studio Development)

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
