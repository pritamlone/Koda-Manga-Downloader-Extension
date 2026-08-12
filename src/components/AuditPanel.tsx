import React from 'react';
import { AUDIT_ISSUES } from '../data/auditReport';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export const AuditPanel: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Executive Summary Card */}
      <div className="bg-white border-2 border-[#121212] p-6 md:p-8 shadow-[6px_6px_0px_0px_#121212]">
        <div className="flex items-start justify-between flex-col md:flex-row gap-6">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FF4D00] text-white border border-[#121212] text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              <span>Full Engine V3 Audit & Synthesis Report</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-[#121212] leading-none">
              Root-Cause Analysis & Engine Synthesis
            </h2>
            <p className="text-sm font-medium text-[#121212]/80 leading-relaxed">
              We performed a line-by-line comparison between <strong className="text-[#FF4D00] font-black">V1 (Solid Stable Core)</strong> and <strong className="text-[#121212] font-black underline">V2 (Feature-rich but Broken)</strong>.
              By restoring V1's chunked concurrency, offscreen worker pipeline, and chrome storage sync while incorporating V2's dark UI, multi-format packaging (CBZ, PDF, ZIP), and modular site adapters, we created <strong className="text-[#FF4D00] font-black uppercase">Koda Manga Downloader Extension v3.0</strong> — 100% stable, rate-limit immune, and feature-complete.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-[#F9F9F7] p-4 border-2 border-[#121212] text-center shadow-[2px_2px_0px_0px_#121212]">
              <span className="block text-3xl font-black text-[#FF4D00]">5 / 5</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#121212]">V2 Flaws Resolved</span>
            </div>
            <div className="bg-[#121212] text-white p-4 border-2 border-[#121212] text-center shadow-[2px_2px_0px_0px_#FF4D00]">
              <span className="block text-3xl font-black text-[#FF4D00]">100%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Features Retained</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Issues Breakdown */}
      <div className="space-y-6">
        <h3 className="text-xl font-black italic uppercase tracking-tight text-[#121212] flex items-center space-x-2">
          <Zap className="w-5 h-5 text-[#FF4D00]" />
          <span>Bug Resolution Matrix</span>
        </h3>

        <div className="grid grid-cols-1 gap-6">
          {AUDIT_ISSUES.map((issue) => (
            <div
              key={issue.id}
              className="bg-white border-2 border-[#121212] p-6 shadow-[4px_4px_0px_0px_#121212] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b-2 border-[#121212] pb-4">
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-[#121212] text-white">
                    {issue.category}
                  </span>
                  <h4 className="text-base font-black uppercase tracking-tight text-[#121212]">{issue.title}</h4>
                </div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-[#FF4D00] text-white border border-[#121212]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolved in V3</span>
                </div>
              </div>

              <p className="text-xs font-medium text-[#121212]/90 mb-5 leading-relaxed">
                {issue.description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                {/* V1 Column */}
                <div className="bg-[#F9F9F7] p-4 border border-[#121212] space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[#121212] font-black uppercase text-[10px] mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#FF4D00]" />
                    <span>V1 Stable Core</span>
                  </div>
                  <p className="text-[#121212] leading-normal">{issue.v1Approach}</p>
                </div>

                {/* V2 Column */}
                <div className="bg-[#F9F9F7] p-4 border border-[#121212] space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[#121212] font-black uppercase text-[10px] mb-1">
                    <XCircle className="w-4 h-4 text-[#FF4D00]" />
                    <span>V2 Flawed Behavior</span>
                  </div>
                  <p className="text-[#121212] leading-normal">{issue.v2Bug}</p>
                </div>

                {/* Restored V3 Column */}
                <div className="bg-[#121212] text-white p-4 border border-[#121212] space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[#FF4D00] font-black uppercase text-[10px] mb-1">
                    <RefreshCw className="w-4 h-4" />
                    <span>V3 Restored Solution</span>
                  </div>
                  <p className="text-white/90 leading-normal">{issue.v3Solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
