"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  FileCode,
  Search,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { CoverageReport, CoverageFile } from "../hooks/useTests";

interface CoveragePanelProps {
  coverage: CoverageReport | null;
  loading: boolean;
  onRefresh: () => void;
  onSelectFile: (filePath: string, line?: number) => void;
}

export default function CoveragePanel({
  coverage,
  loading,
  onRefresh,
  onSelectFile,
}: CoveragePanelProps) {
  const [filterQuery, setFilterQuery] = useState("");

  const files = coverage?.files || [];
  const filteredFiles = files.filter((f) =>
    f.relativeFilePath.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const overallPct = coverage?.overallCoveragePct || 0;

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#070709] overflow-hidden">
      {/* Coverage Summary Header */}
      <div className="p-3 bg-[#0d0d12] border-b border-[#1f1f24] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-zinc-100 text-xs uppercase tracking-wide">
              Coverage Dashboard
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Refresh Coverage"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>

        {/* Big Overall Metric */}
        <div className="p-2.5 rounded-xl bg-[#09090c] border border-[#1f1f26] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Total Workspace Line Coverage</span>
            <span
              className={`font-bold font-mono text-sm ${
                overallPct >= 80
                  ? "text-emerald-400"
                  : overallPct >= 50
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {overallPct}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#181820] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overallPct >= 80
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  : overallPct >= 50
                  ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
            <span>Covered: {coverage?.totalCoveredLines || 0} lines</span>
            <span>Executable: {coverage?.totalExecutableLines || 0} lines</span>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="p-2 bg-[#0a0a0d] border-b border-[#1f1f24]">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter coverage files..."
            className="w-full bg-[#121216] border border-[#27272a] focus:border-cyan-500/60 rounded px-2 py-1 pl-7 text-zinc-100 placeholder:text-zinc-600 outline-none text-[10.5px] font-mono"
          />
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredFiles.map((file) => {
          const pct = file.lineCoveragePct;
          const badgeBg =
            pct >= 80
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
              : pct >= 50
              ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
              : "bg-rose-950/80 text-rose-300 border-rose-500/40";

          return (
            <div
              key={file.filePath}
              onClick={() => onSelectFile(file.filePath, file.uncoveredLines[0] || 1)}
              className="p-2 rounded-xl bg-[#0d0d12] hover:bg-[#14141c] border border-[#1f1f26] hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <div className="truncate">
                  <div className="text-zinc-200 font-bold text-[11px] truncate group-hover:text-cyan-300">
                    {file.name}
                  </div>
                  <div className="text-zinc-500 text-[9.5px] truncate">
                    {file.relativeFilePath}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right text-[10px] text-zinc-500">
                  <span>{file.coveredCount}/{file.totalLines}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}

        {filteredFiles.length === 0 && !loading && (
          <div className="py-8 text-center text-zinc-600 text-xs">
            No coverage files matching filter.
          </div>
        )}
      </div>
    </div>
  );
}
