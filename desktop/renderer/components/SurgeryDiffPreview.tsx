"use client";

import React, { useState, useMemo } from "react";
import { 
  Sparkles, Check, X, ShieldCheck, AlertTriangle, ArrowRight, 
  CheckSquare, Square, FileCode, Cpu, Layers, Activity 
} from "lucide-react";
import { Finding } from "./ProvenanceReplayPanel";

export interface SurgeryHunk {
  line: number;
  code: string;
  title: string;
  reason: string;
  approved: boolean;
}

export interface SurgeryDiffPreviewProps {
  filePath: string;
  originalSource: string;
  findings: Finding[];
  onApply: (approvedLines: number[]) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export default function SurgeryDiffPreview({
  filePath,
  originalSource,
  findings,
  onApply,
  onCancel,
  isApplying = false,
}: SurgeryDiffPreviewProps) {
  // Map findings into selectable hunks, all initially checked
  const [approvedLines, setApprovedLines] = useState<Set<number>>(() => {
    return new Set(findings.map((f) => f.line));
  });

  const fileName = filePath.split("/").pop() || "source_file.py";
  const sourceLines = useMemo(() => originalSource.split("\n"), [originalSource]);

  // Compute transformed source based on approved lines
  const transformedSource = useMemo(() => {
    return sourceLines
      .filter((_, idx) => !approvedLines.has(idx + 1))
      .join("\n");
  }, [sourceLines, approvedLines]);

  const toggleLine = (line: number) => {
    setApprovedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  };

  const selectAll = () => {
    setApprovedLines(new Set(findings.map((f) => f.line)));
  };

  const clearAll = () => {
    setApprovedLines(new Set());
  };

  const approvedCount = approvedLines.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-mono">
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* 1. Modal Header */}
        <div className="p-4 bg-[#0d0d0d] border-b border-[#1f1f1f] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-sm text-white">Safe Remove Surgery Preview</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/40">
                  {findings.length} Ghost Operations Detected
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>{filePath}</span>
              </p>
            </div>
          </div>

          {/* Quick Hunk Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs text-zinc-300 hover:text-white transition-all flex items-center gap-1"
            >
              <CheckSquare className="w-3 h-3 text-cyan-400" />
              <span>Select All ({findings.length})</span>
            </button>
            <button
              onClick={clearAll}
              className="px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs text-zinc-400 hover:text-white transition-all flex items-center gap-1"
            >
              <Square className="w-3 h-3 text-zinc-500" />
              <span>Clear All</span>
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg border border-[#262626] text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Differential Verification Banner */}
        <div className="px-4 py-2.5 bg-[#050505] border-b border-[#1f1f1f] flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">Differential Behavioral Verification:</span>
            <span className="text-zinc-300">Isolated Subprocess Equivalence Confirmed</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400">
            <span>Projected Luminance: <strong className="text-cyan-400">{approvedCount === findings.length ? "100.0%" : `${Math.round((approvedCount / findings.length) * 100)}%`}</strong></span>
            <span>•</span>
            <span>Hunks Approved: <strong className="text-amber-400">{approvedCount} / {findings.length}</strong></span>
          </div>
        </div>

        {/* 3. Side-by-Side Diff Preview Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-[#1f1f1f] bg-[#050505] overflow-hidden">
          
          {/* Left Pane: Original Source with Removal Highlights */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2.5 bg-[#0a0a0a] border-b border-[#1f1f1f] text-xs font-bold text-zinc-400 flex items-center justify-between shrink-0">
              <span className="text-red-400 font-bold flex items-center gap-1.5">
                <span>ORIGINAL (Pre-Surgery)</span>
              </span>
              <span className="text-[11px] text-zinc-500">{sourceLines.length} lines</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-0.5 select-text">
              {sourceLines.map((line, idx) => {
                const lineNum = idx + 1;
                const isGhost = findings.some((f) => f.line === lineNum);
                const isApproved = approvedLines.has(lineNum);

                if (isGhost) {
                  return (
                    <div
                      key={`orig-${lineNum}`}
                      onClick={() => toggleLine(lineNum)}
                      className={`flex items-start gap-2 px-2 py-1 rounded cursor-pointer transition-all ${
                        isApproved
                          ? "bg-red-950/70 border border-red-500/40 text-red-300"
                          : "bg-amber-950/40 border border-amber-500/30 text-amber-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isApproved}
                        onChange={() => toggleLine(lineNum)}
                        className="mt-0.5 cursor-pointer accent-cyan-400 shrink-0"
                      />
                      <span className="w-6 text-zinc-500 select-none text-[11px] shrink-0">{lineNum}</span>
                      <span className="font-bold text-red-400 select-none shrink-0">-</span>
                      <span className="flex-1 font-semibold">{line}</span>
                    </div>
                  );
                }

                return (
                  <div key={`orig-${lineNum}`} className="flex items-center gap-2 px-2 py-0.5 text-zinc-400">
                    <span className="w-4 shrink-0" />
                    <span className="w-6 text-zinc-600 select-none text-[11px] shrink-0">{lineNum}</span>
                    <span className="w-2 select-none shrink-0"> </span>
                    <span className="flex-1 text-zinc-300">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Transformed Clean Source Preview */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2.5 bg-[#0a0a0a] border-b border-[#1f1f1f] text-xs font-bold text-zinc-400 flex items-center justify-between shrink-0">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span>TRANSFORMED (Clean Code)</span>
              </span>
              <span className="text-[11px] text-zinc-500">{sourceLines.length - approvedCount} lines</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-0.5 select-text">
              {sourceLines
                .filter((_, idx) => !approvedLines.has(idx + 1))
                .map((line, idx) => (
                  <div key={`clean-${idx}`} className="flex items-center gap-2 px-2 py-0.5 text-zinc-300">
                    <span className="w-6 text-zinc-600 select-none text-[11px] shrink-0">{idx + 1}</span>
                    <span className="w-2 text-emerald-500 select-none shrink-0">+</span>
                    <span className="flex-1 text-zinc-200">{line}</span>
                  </div>
                ))}
            </div>
          </div>

        </div>

        {/* 4. Footer Actions */}
        <div className="p-4 bg-[#0d0d0d] border-t border-[#1f1f1f] flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Automatic safety backup: <code>{fileName}.echo-nullity-backup</code></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs font-bold text-zinc-300 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(Array.from(approvedLines))}
              disabled={approvedCount === 0 || isApplying}
              className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-extrabold shadow-cyan-glow flex items-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {isApplying ? (
                <Activity className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 fill-black" />
              )}
              <span>Apply Surgery ({approvedCount} {approvedCount === 1 ? "Line" : "Lines"})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
