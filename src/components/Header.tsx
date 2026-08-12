import React from 'react';
import { Download, Layers, ShieldCheck, PlayCircle, Code2, Sparkles } from 'lucide-react';
import { exportExtensionAsZip } from '../utils/zipExporter';

interface HeaderProps {
  activeTab: 'explorer' | 'audit' | 'simulator' | 'output';
  setActiveTab: (tab: 'explorer' | 'audit' | 'simulator' | 'output') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-[#F9F9F7] border-b-2 border-[#121212] sticky top-0 z-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-baseline md:justify-between gap-6">
        {/* Brand */}
        <div className="flex flex-col">
          <div className="flex items-baseline space-x-3">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none italic uppercase text-[#121212]">
              Koda
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-[#FF4D00] text-white border border-[#121212]">
              Engine V3
            </span>
          </div>
          <p className="text-xs font-bold tracking-widest uppercase ml-1 opacity-70 mt-1 text-[#121212]">
            Manga Downloader Extension & Audit Studio
          </p>
        </div>

        {/* View Nav Tabs */}
        <nav className="flex flex-wrap gap-4 md:gap-8 text-xs md:text-sm font-bold uppercase tracking-widest items-center">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`pb-1 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'explorer'
                ? 'border-b-4 border-[#FF4D00] text-[#121212]'
                : 'text-[#121212]/60 hover:text-[#121212] border-b-4 border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dashboard / Files</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-1 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'border-b-4 border-[#FF4D00] text-[#121212]'
                : 'text-[#121212]/60 hover:text-[#121212] border-b-4 border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Report</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-1 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-b-4 border-[#FF4D00] text-[#121212]'
                : 'text-[#121212]/60 hover:text-[#121212] border-b-4 border-transparent'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('output')}
            className={`pb-1 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'output'
                ? 'border-b-4 border-[#FF4D00] text-[#121212]'
                : 'text-[#121212]/60 hover:text-[#121212] border-b-4 border-transparent'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Full Output</span>
          </button>
        </nav>

        {/* Download Action Button */}
        <div>
          <button
            onClick={exportExtensionAsZip}
            className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 bg-[#FF4D00] text-white font-black uppercase tracking-widest text-xs border-2 border-[#121212] hover:bg-[#121212] hover:text-white transition-all cursor-pointer shadow-[3px_3px_0px_0px_#121212]"
          >
            <Download className="w-4 h-4" />
            <span>Export Extension (.zip)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
