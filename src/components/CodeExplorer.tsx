import React, { useState } from 'react';
import { ExtensionFile } from '../types/extension';
import { EXTENSION_FILES } from '../data/extensionCodebase';
import { FileCode, Folder, Copy, Check, Search, FileText, Settings, Layout, Code2 } from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('manifest.json');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedFile = EXTENSION_FILES.find(f => f.path === selectedFilePath) || EXTENSION_FILES[0];

  const filteredFiles = EXTENSION_FILES.filter(file => {
    const matchesSearch = file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          file.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || file.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'manifest': return <FileText className="w-4 h-4 text-[#FF4D00]" />;
      case 'background': return <Settings className="w-4 h-4 text-[#121212]" />;
      case 'popup': return <Layout className="w-4 h-4 text-[#FF4D00]" />;
      case 'content': return <Code2 className="w-4 h-4 text-[#121212]" />;
      case 'options': return <Settings className="w-4 h-4 text-[#FF4D00]" />;
      default: return <FileCode className="w-4 h-4 text-[#121212]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* Left Sidebar File Tree */}
        <div className="lg:col-span-4 bg-white border-2 border-[#121212] p-5 flex flex-col shadow-[4px_4px_0px_0px_#121212]">
          <h3 className="text-[10px] font-black uppercase tracking-tighter mb-4 text-[#FF4D00]">
            Core Codebase Files
          </h3>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-[#121212] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="SEARCH FILES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F9F9F7] border border-[#121212] text-[#121212] text-xs font-mono font-bold pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#FF4D00] uppercase placeholder:text-[#121212]/40"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {['all', 'manifest', 'background', 'popup', 'content', 'options', 'utils', 'icons'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all border border-[#121212] cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#FF4D00] text-white'
                    : 'bg-[#F9F9F7] text-[#121212] hover:bg-[#121212] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* File Tree List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredFiles.map((file) => {
              const isSelected = file.path === selectedFilePath;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-all text-xs border border-[#121212] cursor-pointer ${
                    isSelected
                      ? 'bg-[#121212] text-white font-bold'
                      : 'bg-[#F9F9F7] hover:bg-[#FF4D00]/10 text-[#121212]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {getCategoryIcon(file.category)}
                    <span className="truncate font-mono">{file.path}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 border border-[#121212] ${
                    isSelected ? 'bg-[#FF4D00] text-white' : 'bg-white text-[#121212]'
                  }`}>
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="lg:col-span-8 bg-white border-2 border-[#121212] flex flex-col overflow-hidden shadow-[4px_4px_0px_0px_#121212]">
          {/* Header */}
          <div className="bg-[#121212] text-white px-6 py-4 border-b-2 border-[#121212] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getCategoryIcon(selectedFile.category)}
              <div>
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  {selectedFile.path}
                </h3>
                <p className="text-xs text-[#F9F9F7]/70 italic mt-0.5">{selectedFile.description}</p>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#FF4D00] hover:bg-white hover:text-[#121212] text-white text-xs font-black uppercase tracking-widest border border-white transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Viewer Body */}
          <div className="flex-1 p-6 overflow-auto bg-[#121212] font-mono text-xs leading-relaxed text-[#F9F9F7] custom-scrollbar">
            {selectedFile.isBase64 ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#FF4D00]/50 bg-black/40 rounded-xl space-y-4 text-center">
                <div className="p-4 bg-[#FF4D00]/10 border border-[#FF4D00] rounded-xl flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${selectedFile.content}`}
                    alt={selectedFile.path}
                    className="w-16 h-16 object-contain image-rendering-pixelated shadow-lg"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-wider font-mono">{selectedFile.path}</p>
                  <p className="text-xs text-[#F9F9F7]/60 mt-1">Binary PNG Image File (Base64 Encoded)</p>
                </div>
                <div className="max-w-md bg-black/60 p-3 rounded border border-white/10 text-[10px] text-gray-400 break-all text-left max-h-32 overflow-y-auto font-mono">
                  data:image/png;base64,{selectedFile.content}
                </div>
              </div>
            ) : (
              <pre>
                <code>{selectedFile.content}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
