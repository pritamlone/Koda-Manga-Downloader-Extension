import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle2, Sliders, Globe, Play, FileArchive, FileText, Folder, Settings, Shield } from 'lucide-react';
import { DownloadTask, ExtensionSettings } from '../types/extension';

export const ExtensionSimulator: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'popup' | 'scraper' | 'options'>('popup');
  const [selectedPresetSite, setSelectedPresetSite] = useState<string>('mangadex');
  const [mangaTitle, setMangaTitle] = useState<string>('Solo Leveling: Arise');
  const [chapterTitle, setChapterTitle] = useState<string>('Chapter 179 - Shadow Monarch');
  const [exportFormat, setExportFormat] = useState<'cbz' | 'zip' | 'pdf' | 'folder'>('cbz');
  const [detectedImages, setDetectedImages] = useState<string[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('light');
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const isDarkActive = themeMode === 'dark' || (themeMode === 'auto' && isSystemDark);
  const [settings, setSettings] = useState<ExtensionSettings>({
    defaultFormat: 'cbz',
    maxConcurrentDownloads: 3,
    delayBetweenRequestsMs: 300,
    autoRetryAttempts: 3,
    filenameTemplate: '{manga_title}/Chapter_{chapter_num}/{page_index}',
    autoClosePopupOnStart: false,
    theme: 'dark',
    customSelectors: []
  });

  // Generate mock images for preset sites
  useEffect(() => {
    generateMockImages(selectedPresetSite);
  }, [selectedPresetSite]);

  const generateMockImages = (site: string) => {
    const pagesCount = site === 'mangadex' ? 24 : site === 'manganato' ? 32 : 18;
    const urls: string[] = [];
    for (let i = 1; i <= pagesCount; i++) {
      urls.push(`https://images.manga-cdn.org/sample_${site}_page_${i}.webp`);
    }
    setDetectedImages(urls);
  };

  const handleTriggerDownload = () => {
    if (detectedImages.length === 0) return;

    const newTask: DownloadTask = {
      id: 'sim_task_' + Date.now(),
      mangaTitle: mangaTitle,
      chapterTitle: chapterTitle,
      chapterNum: 179,
      totalPages: detectedImages.length,
      completedPages: 0,
      status: 'downloading',
      format: exportFormat,
      downloadSpeed: '3.4 MB/s',
      pages: detectedImages.map((url, i) => ({
        index: i + 1,
        url,
        status: 'pending'
      }))
    };

    setTasks(prev => [newTask, ...prev]);

    // Simulate progress using V1 throttled queue behavior
    let currentCompleted = 0;
    const interval = setInterval(() => {
      currentCompleted += 3; // Batch concurrency
      if (currentCompleted >= detectedImages.length) {
        currentCompleted = detectedImages.length;
        clearInterval(interval);
        setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, completedPages: currentCompleted, status: 'completed' } : t));
      } else {
        setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, completedPages: currentCompleted } : t));
      }
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tight text-[#121212] flex items-center space-x-2">
            <Play className="w-5 h-5 text-[#FF4D00]" />
            <span>Interactive Extension Simulator</span>
          </h2>
          <p className="text-xs font-medium text-[#121212]/70 mt-1">
            Test the live Koda extension popup interface, DOM chapter scraper, and rate-limit queue engine.
          </p>
        </div>

        <div className="flex bg-[#121212] p-1 border border-[#121212] text-xs font-bold uppercase tracking-widest text-white">
          <button
            onClick={() => setActiveSubTab('popup')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeSubTab === 'popup' ? 'bg-[#FF4D00] text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Popup UI
          </button>
          <button
            onClick={() => setActiveSubTab('scraper')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeSubTab === 'scraper' ? 'bg-[#FF4D00] text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Content Script
          </button>
          <button
            onClick={() => setActiveSubTab('options')}
            className={`px-3 py-1.5 transition-all cursor-pointer ${
              activeSubTab === 'options' ? 'bg-[#FF4D00] text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            Options
          </button>
        </div>
      </div>

      {/* Simulator Workspace */}
      {activeSubTab === 'popup' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Extension Popup Frame Mockup */}
          <div className="md:col-span-5 flex justify-center">
            <div className={`w-[380px] border-4 p-6 transition-colors duration-200 space-y-5 ${
              isDarkActive 
                ? 'bg-[#0F172A] text-[#F1F5F9] border-[#334155] shadow-[8px_8px_0px_0px_#020617]' 
                : 'bg-[#F9F9F7] text-[#121212] border-[#121212] shadow-[8px_8px_0px_0px_#121212]'
            }`}>
              {/* Header */}
              <div className={`flex items-center justify-between pb-4 border-b-2 ${
                isDarkActive ? 'border-[#334155]' : 'border-[#121212]'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#FF4D00] text-white flex items-center justify-center font-black text-sm border-2 border-current shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                    📖
                  </div>
                  <div>
                    <h3 className={`text-lg font-black italic uppercase tracking-tighter leading-none ${
                      isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                    }`}>Koda Manga</h3>
                    <span className="text-[10px] text-[#FF4D00] font-bold uppercase tracking-widest">Engine V3.0</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setThemeMode(prev => {
                      if (prev === 'light') return 'dark';
                      if (prev === 'dark') return 'auto';
                      return 'light';
                    })}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                      isDarkActive
                        ? 'bg-[#1E293B] text-[#F1F5F9] border-[#334155] hover:bg-[#334155] shadow-[2px_2px_0px_0px_#020617]'
                        : 'bg-white text-[#121212] border-[#121212] hover:bg-[#F9F9F7] shadow-[2px_2px_0px_0px_#121212]'
                    }`}
                    title={
                      themeMode === 'light'
                        ? 'Theme: Light Mode (Click for Dark)'
                        : themeMode === 'dark'
                        ? 'Theme: Dark Mode (Click for Auto System)'
                        : 'Theme: Auto System (Click for Light)'
                    }
                    aria-label="Toggle Theme"
                  >
                    {themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '💻'}
                  </button>
                  <div className={`w-7 h-7 flex items-center justify-center text-xs font-bold border ${
                    isDarkActive
                      ? 'bg-[#1E293B] text-[#F1F5F9] border-[#334155] shadow-[2px_2px_0px_0px_#020617]'
                      : 'bg-white text-[#121212] border-[#121212] shadow-[2px_2px_0px_0px_#121212]'
                  }`}>
                    ⚙
                  </div>
                </div>
              </div>

              {/* Popup Main Form */}
              <div className={`space-y-4 p-4 border-2 ${
                isDarkActive
                  ? 'bg-[#1E293B] border-[#334155] shadow-[3px_3px_0px_0px_#020617]'
                  : 'bg-white border-[#121212] shadow-[3px_3px_0px_0px_#121212]'
              }`}>
                <div>
                  <label className={`text-[10px] font-black uppercase block mb-1 ${
                    isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                  }`}>
                    Manga Title
                  </label>
                  <input
                    type="text"
                    value={mangaTitle}
                    onChange={(e) => setMangaTitle(e.target.value)}
                    className={`w-full border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#FF4D00] ${
                      isDarkActive
                        ? 'bg-[#0F172A] border-[#334155] text-[#F1F5F9]'
                        : 'bg-[#F9F9F7] border-[#121212] text-[#121212]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] font-black uppercase block mb-1 ${
                      isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                    }`}>
                      Chapter
                    </label>
                    <input
                      type="text"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      className={`w-full border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#FF4D00] ${
                        isDarkActive
                          ? 'bg-[#0F172A] border-[#334155] text-[#F1F5F9]'
                          : 'bg-[#F9F9F7] border-[#121212] text-[#121212]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] font-black uppercase block mb-1 ${
                      isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                    }`}>
                      Format
                    </label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className={`w-full border px-2 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#FF4D00] ${
                        isDarkActive
                          ? 'bg-[#0F172A] border-[#334155] text-[#F1F5F9]'
                          : 'bg-[#F9F9F7] border-[#121212] text-[#121212]'
                      }`}
                    >
                      <option value="cbz">CBZ (Comic Zip)</option>
                      <option value="zip">Standard ZIP</option>
                      <option value="pdf">PDF Document</option>
                      <option value="folder">Images Folder</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className={`px-2 py-0.5 bg-[#FF4D00] text-white text-[10px] font-black uppercase tracking-widest border ${
                    isDarkActive ? 'border-[#334155]' : 'border-[#121212]'
                  }`}>
                    {detectedImages.length} Pages Found
                  </span>
                  <button
                    onClick={() => generateMockImages(selectedPresetSite)}
                    className={`text-[10px] font-black uppercase hover:text-[#FF4D00] flex items-center space-x-1 cursor-pointer ${
                      isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rescan</span>
                  </button>
                </div>

                <button
                  onClick={handleTriggerDownload}
                  className={`w-full py-3 bg-[#FF4D00] text-white font-black uppercase tracking-widest text-xs border-2 hover:bg-[#121212] hover:text-white transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    isDarkActive
                      ? 'border-[#334155] shadow-[2px_2px_0px_0px_#020617]'
                      : 'border-[#121212] shadow-[2px_2px_0px_0px_#121212]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Chapter Now</span>
                </button>
              </div>

              {/* Active Queue Display in Popup */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00] block">
                  Active Tasks
                </span>
                {tasks.length === 0 ? (
                  <div className={`p-4 border text-center text-xs font-bold uppercase tracking-widest ${
                    isDarkActive
                      ? 'bg-[#1E293B] border-[#334155] text-[#94A3B8]'
                      : 'bg-white border-[#121212] text-[#121212]/50'
                  }`}>
                    No active tasks in queue.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                    {tasks.map(task => {
                      const percent = Math.round((task.completedPages / task.totalPages) * 100);
                      return (
                        <div key={task.id} className={`p-3 border-2 space-y-2 ${
                          isDarkActive
                            ? 'bg-[#1E293B] border-[#334155] shadow-[2px_2px_0px_0px_#020617]'
                            : 'bg-white border-[#121212] shadow-[2px_2px_0px_0px_#121212]'
                        }`}>
                          <div className={`flex justify-between text-xs font-black uppercase tracking-tight ${
                            isDarkActive ? 'text-[#F1F5F9]' : 'text-[#121212]'
                          }`}>
                            <span className="truncate">{task.mangaTitle}</span>
                            <span className="text-[9px] uppercase text-white font-mono px-1.5 py-0.5 bg-[#FF4D00]">
                              {task.format}
                            </span>
                          </div>

                          <div className={`w-full border-2 h-4 relative ${
                            isDarkActive ? 'border-[#334155] bg-[#0F172A]' : 'border-[#121212] bg-[#F9F9F7]'
                          }`}>
                            <div
                              className="bg-[#FF4D00] h-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className={`flex justify-between text-[10px] font-mono font-bold ${
                            isDarkActive ? 'text-[#94A3B8]' : 'text-[#121212]'
                          }`}>
                            <span>{task.completedPages} / {task.totalPages} ({percent}%)</span>
                            <span className="uppercase font-black text-[#FF4D00]">
                              {task.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Explanation Panel */}
          <div className="md:col-span-7 bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] space-y-6">
            <h3 className="text-xl font-black italic uppercase tracking-tight text-[#121212] flex items-center space-x-2">
              <Shield className="w-5 h-5 text-[#FF4D00]" />
              <span>Throttle & Queue Engine Verification</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F9F9F7] p-4 border-2 border-[#121212]">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#121212]/70 block mb-1">Batch Concurrency Limit</span>
                <span className="text-2xl font-black text-[#FF4D00]">{settings.maxConcurrentDownloads} Pages / Batch</span>
              </div>
              <div className="bg-[#F9F9F7] p-4 border-2 border-[#121212]">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#121212]/70 block mb-1">Throttle Request Delay</span>
                <span className="text-2xl font-black text-[#121212]">{settings.delayBetweenRequestsMs} ms</span>
              </div>
            </div>

            <div className="bg-[#121212] text-white p-6 border-2 border-[#121212] space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#FF4D00]">
                Why Engine V3 Prevents Flaws & Crashes:
              </h4>
              <ul className="text-xs font-medium text-white/90 space-y-3 leading-relaxed">
                <li className="flex items-start space-x-2">
                  <span className="text-[#FF4D00] font-black">■</span>
                  <span><strong className="text-white uppercase font-bold">Zero HTTP 429 Rate Limits:</strong> Images are downloaded in small chunked batches rather than firing 100 parallel requests.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-[#FF4D00] font-black">■</span>
                  <span><strong className="text-white uppercase font-bold">Offscreen Canvas Pipeline:</strong> Binary JSZip and PDF rendering runs safely in offscreen document context, keeping the worker light.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-[#FF4D00] font-black">■</span>
                  <span><strong className="text-white uppercase font-bold">Resilient Chrome Storage Sync:</strong> Progress states are persisted continuously to local chrome storage.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Content Script Inspector */}
      {activeSubTab === 'scraper' && (
        <div className="bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-[#121212] pb-4">
            <div>
              <h3 className="text-xl font-black italic uppercase text-[#121212]">Site Adapter Scraper Test</h3>
              <p className="text-xs font-medium text-[#121212]/70">Simulate chapter page DOM extraction across popular manga reading sites.</p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-[#121212]">Preset Site:</span>
              <select
                value={selectedPresetSite}
                onChange={(e) => setSelectedPresetSite(e.target.value)}
                className="bg-[#F9F9F7] border border-[#121212] text-xs font-bold text-[#121212] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF4D00]"
              >
                <option value="mangadex">MangaDex (.org)</option>
                <option value="manganato">Manganato (.com)</option>
                <option value="asurascans">AsuraScans / FlameComics</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F9F9F7] p-5 border-2 border-[#121212] space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#FF4D00]">Extracted Image URLs ({detectedImages.length})</h4>
              <div className="bg-white p-3 border border-[#121212] max-h-64 overflow-y-auto space-y-1.5 font-mono text-xs text-[#121212] custom-scrollbar">
                {detectedImages.map((url, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-[#121212]/10">
                    <span className="truncate">{url}</span>
                    <span className="text-[9px] font-black uppercase text-white bg-[#FF4D00] px-1.5 py-0.5 border border-[#121212]">OK</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F9F9F7] p-5 border-2 border-[#121212] space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#121212]">Custom CSS Image Selector Fallback</h4>
              <div>
                <label className="text-xs font-bold uppercase text-[#121212] block mb-1">Image Selector Query</label>
                <input
                  type="text"
                  placeholder="#readerarea img, .chapter-content img"
                  className="w-full bg-white border border-[#121212] p-2.5 text-xs text-[#121212] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FF4D00]"
                  defaultValue="#readerarea img"
                />
              </div>
              <p className="text-xs text-[#121212]/80 leading-relaxed font-medium">
                If a manga reader site alters its layout or uses custom lazy loading tags, Koda's content script automatically falls back to standard width/height image heuristics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Options & Settings Panel */}
      {activeSubTab === 'options' && (
        <div className="bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] space-y-6">
          <h3 className="text-xl font-black italic uppercase tracking-tight text-[#121212] flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#FF4D00]" />
            <span>Koda Options & Path Template Engine</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F9F9F7] p-5 border-2 border-[#121212] space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#FF4D00]">Rate Limit & Throttle Configuration</h4>
              
              <div>
                <label className="text-xs font-bold uppercase text-[#121212] block mb-1">Max Concurrent Downloads</label>
                <input
                  type="number"
                  value={settings.maxConcurrentDownloads}
                  onChange={(e) => setSettings({ ...settings, maxConcurrentDownloads: parseInt(e.target.value) || 3 })}
                  className="w-full bg-white border border-[#121212] p-2.5 text-xs font-bold text-[#121212]"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#121212] block mb-1">Inter-Request Throttle Delay (ms)</label>
                <input
                  type="number"
                  value={settings.delayBetweenRequestsMs}
                  onChange={(e) => setSettings({ ...settings, delayBetweenRequestsMs: parseInt(e.target.value) || 300 })}
                  className="w-full bg-white border border-[#121212] p-2.5 text-xs font-bold text-[#121212]"
                />
              </div>
            </div>

            <div className="bg-[#F9F9F7] p-5 border-2 border-[#121212] space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#121212]">Path Sanitizer & Naming Preview</h4>
              
              <div>
                <label className="text-xs font-bold uppercase text-[#121212] block mb-1">Filename Template</label>
                <input
                  type="text"
                  value={settings.filenameTemplate}
                  onChange={(e) => setSettings({ ...settings, filenameTemplate: e.target.value })}
                  className="w-full bg-white border border-[#121212] p-2.5 text-xs font-mono font-bold text-[#121212]"
                />
              </div>

              <div className="p-3 bg-[#121212] text-white border border-[#121212]">
                <span className="text-[9px] uppercase font-black text-[#FF4D00] block mb-1 tracking-widest">Live Download Path Preview</span>
                <span className="text-xs font-mono font-bold text-white">
                  Koda_Manga/Solo_Leveling_Arise/Chapter_179/page_001.webp
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
