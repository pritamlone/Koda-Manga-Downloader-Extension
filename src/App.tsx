import React, { useState } from 'react';
import { Header } from './components/Header';
import { CodeExplorer } from './components/CodeExplorer';
import { AuditPanel } from './components/AuditPanel';
import { ExtensionSimulator } from './components/ExtensionSimulator';
import { FullOutputView } from './components/FullOutputView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'audit' | 'simulator' | 'output'>('explorer');

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#121212] flex flex-col font-sans selection:bg-[#FF4D00] selection:text-white border-8 border-[#121212]">
      {/* Header Bar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'explorer' && <CodeExplorer />}
        {activeTab === 'audit' && <AuditPanel />}
        {activeTab === 'simulator' && <ExtensionSimulator />}
        {activeTab === 'output' && <FullOutputView />}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#121212] bg-[#121212] text-white py-6 px-8 flex flex-col sm:flex-row justify-between items-center text-xs font-bold uppercase tracking-widest">
        <p>Koda Manga Downloader Extension Studio • Manifest V3 Restored Engine</p>
        <span className="opacity-60 text-[10px] mt-2 sm:mt-0">© 2026 Koda Manga Downloader Project</span>
      </footer>
    </div>
  );
}
