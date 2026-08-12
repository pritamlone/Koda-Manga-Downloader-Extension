import React, { useState } from 'react';
import { EXTENSION_FILES } from '../data/extensionCodebase';
import { Copy, Check, Code2, Download } from 'lucide-react';
import { exportExtensionAsZip } from '../utils/zipExporter';

export const FullOutputView: React.FC = () => {
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const fullTextOutput = EXTENSION_FILES.map(file => {
    if (file.isBase64) {
      return `// File: ${file.path}\n// [Binary PNG Icon File - Included in Export Zip Archive]\n// Data: data:image/png;base64,${file.content}\n`;
    }
    return `// File: ${file.path}\n${file.content}\n`;
  }).join('\n' + '='.repeat(60) + '\n\n');

  const handleCopyAll = () => {
    navigator.clipboard.writeText(fullTextOutput);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tight text-[#121212] flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-[#FF4D00]" />
            <span>Complete Unified Extension Source Code</span>
          </h2>
          <p className="text-xs font-medium text-[#121212]/70 mt-1">
            All files for the ready-to-use unpacked Chrome Manifest V3 Extension formatted with relative file paths.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopyAll}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#121212] hover:bg-[#FF4D00] text-white text-xs font-black uppercase tracking-widest border border-[#121212] transition-colors cursor-pointer"
          >
            {copiedAll ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAll ? 'Copied Entire Codebase!' : 'Copy All Code'}</span>
          </button>

          <button
            onClick={exportExtensionAsZip}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#FF4D00] hover:bg-white hover:text-[#121212] text-white text-xs font-black uppercase tracking-widest border-2 border-[#121212] transition-all cursor-pointer shadow-[2px_2px_0px_0px_#121212]"
          >
            <Download className="w-4 h-4" />
            <span>Export Zip Archive</span>
          </button>
        </div>
      </div>

      {/* Complete Raw Text Block */}
      <div className="bg-[#121212] border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] overflow-x-auto max-h-[750px] font-mono text-xs text-[#F9F9F7] custom-scrollbar">
        <pre className="whitespace-pre-wrap leading-relaxed">
          <code>{fullTextOutput}</code>
        </pre>
      </div>
    </div>
  );
};
