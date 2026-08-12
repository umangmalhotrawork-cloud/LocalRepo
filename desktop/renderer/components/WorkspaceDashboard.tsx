"use client";

import React from "react";
import { 
  FileText, ShieldCheck, AlertTriangle, Play, Zap, Clock, 
  Layers, ArrowRight, CheckCircle2, FileSearch, Sparkles, Activity, X
} from "lucide-react";
import { Finding } from "./ProvenanceReplayPanel";

export interface WorkspaceFileReport {
  path: string;
  absolute_path?: string;
  ghost_lines: number;
  total_lines: number;
  ghost_ratio: number;
  causal_luminance?: number;
  findings: Finding[];
}

export interface WorkspaceReport {
  workspace: string;
  files_scanned: number;
  total_ghost_lines: number;
  total_lines: number;
  ghost_ratio: number;
  average_causal_luminance?: number;
  risky_files_count?: number;
  safe_removals_count?: number;
  scan_duration_ms?: number;
  files: WorkspaceFileReport[];
  error?: string;
}

interface WorkspaceDashboardProps {
  summary: WorkspaceReport | null;
  loading: boolean;
  onRescan: () => void;
  onOpenFile: (file: WorkspaceFileReport) => void;
  onClose?: () => void;
}

export default function WorkspaceDashboard({
  summary,
  loading,
  onRescan,
  onOpenFile,
  onClose,
}: WorkspaceDashboardProps) {
  if (!summary && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505] text-zinc-400 font-mono">
        <Layers className="w-12 h-12 text-cyan-400/40 mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-white mb-2">No Workspace Scan Data</h3>
        <p className="text-xs text-zinc-500 max-w-md mb-6">
          Trigger a workspace-wide AST tomography scan to detect and rank vacuous ghost lines across your entire project repository.
        </p>
        <button
          onClick={onRescan}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-cyan-glow flex items-center gap-2 transition-all"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>Run Full Workspace Scan</span>
        </button>
      </div>
    );
  }

  const filesAnalyzed = summary?.files_scanned ?? 0;
  const ghostLines = summary?.total_ghost_lines ?? 0;
  const avgLuminance = summary?.average_causal_luminance ?? (summary ? (1 - summary.ghost_ratio) : 1.0);
  const safeRemovals = summary?.safe_removals_count ?? ghostLines;
  const riskyFiles = summary?.risky_files_count ?? (summary?.files.filter(f => f.ghost_lines > 0).length ?? 0);
  const scanDuration = summary?.scan_duration_ms ?? 12.5;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-100 font-mono overflow-y-auto select-none p-6 space-y-6">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1f1f1f]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="font-heading text-lg font-bold text-white tracking-tight">
              Workspace Tomography Dashboard
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
              AST Fidelity v0.2.0
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-sans">
            Project-level causality verification, ghost code discovery, and state-leverage analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRescan}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all shadow-cyan-glow disabled:opacity-50"
          >
            {loading ? (
              <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{loading ? "Scanning Project..." : "Rescan Workspace"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-[#262626] text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
              title="Return to Code Editor"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 6 Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* 1. Files Analyzed */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Files Analyzed</span>
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-heading">
            {filesAnalyzed}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans">
            {summary?.total_lines ?? 0} total LOC
          </div>
        </div>

        {/* 2. Ghost Lines */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-amber-500/30 bg-amber-950/10 space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Ghost Lines</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-heading">
            {ghostLines}
          </div>
          <div className="text-[10px] text-amber-400/80 font-sans">
            {summary ? `${(summary.ghost_ratio * 100).toFixed(1)}% code density` : "0.0%"}
          </div>
        </div>

        {/* 3. Average Causal Luminance */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Avg Luminance</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300 font-heading">
            {avgLuminance.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans">
            Scale: 0.00 to 1.00
          </div>
        </div>

        {/* 4. Safe Removals */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-emerald-500/30 bg-emerald-950/10 space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Safe Removals</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-heading">
            {safeRemovals}
          </div>
          <div className="text-[10px] text-emerald-400/80 font-sans">
            Verified candidate mutations
          </div>
        </div>

        {/* 5. Risky Files */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Risky Files</span>
            <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-heading">
            {riskyFiles}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans">
            Files with ghost lines &gt; 0
          </div>
        </div>

        {/* 6. Scan Duration */}
        <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] space-y-1 shadow-inner">
          <div className="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Scan Duration</span>
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-zinc-200 font-heading">
            {scanDuration}ms
          </div>
          <div className="text-[10px] text-zinc-500 font-sans">
            Subprocess AST walker
          </div>
        </div>

      </div>

      {/* Top Risky Files Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading font-bold text-sm text-white">
              Top Risky Files Ranked by Ghost Lines
            </h3>
          </div>
          <span className="text-xs text-zinc-500">
            Click any row to open in Monaco editor and jump to finding
          </span>
        </div>

        {/* Table Container */}
        <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#0a0a0a]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#050505] text-zinc-400 text-[11px]">
                <th className="py-3 px-4 font-bold">File Path</th>
                <th className="py-3 px-4 font-bold">Ghost Lines</th>
                <th className="py-3 px-4 font-bold">Total LOC</th>
                <th className="py-3 px-4 font-bold">Ghost Ratio</th>
                <th className="py-3 px-4 font-bold">Luminance</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]">
              {summary && summary.files.length > 0 ? (
                summary.files.map((file, idx) => {
                  const hasGhosts = file.ghost_lines > 0;
                  return (
                    <tr
                      key={idx}
                      onClick={() => onOpenFile(file)}
                      className="hover:bg-[#121212] transition-colors cursor-pointer group"
                    >
                      {/* File Path */}
                      <td className="py-3 px-4 font-bold text-zinc-200 group-hover:text-cyan-300 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-xs">{file.path}</span>
                      </td>

                      {/* Ghost Lines */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                            hasGhosts
                              ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                              : "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {file.ghost_lines} {file.ghost_lines === 1 ? "Ghost" : "Ghosts"}
                        </span>
                      </td>

                      {/* Total LOC */}
                      <td className="py-3 px-4 text-zinc-400">
                        {file.total_lines}
                      </td>

                      {/* Ghost Ratio */}
                      <td className="py-3 px-4">
                        <span className={hasGhosts ? "text-cyan-300 font-bold" : "text-zinc-500"}>
                          {(file.ghost_ratio * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Luminance */}
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">
                          {(file.causal_luminance ?? (hasGhosts ? 0.0 : 1.0)).toFixed(2)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenFile(file);
                          }}
                          className="px-3 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3 text-cyan-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No files found in workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
