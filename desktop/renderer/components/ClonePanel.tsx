"use client";

import React, { useState, useMemo } from "react";
import { 
  Copy, Layers, Sparkles, FileCode, CheckCircle2, ChevronRight, 
  ExternalLink, Search, X, Activity, ArrowUpRight, Hash
} from "lucide-react";

export interface CloneInstance {
  type: string;
  name: string;
  file: string;
  absolute_path: string;
  start_line: number;
  end_line: number;
  code: string;
  signature?: string;
  hash?: string;
}

export interface CloneGroup {
  group_id: string;
  similarity: number;
  similarity_label: string;
  clone_type: string;
  signature: string;
  signature_hash: string;
  files_count: number;
  files: string[];
  instances_count: number;
  instances: CloneInstance[];
}

export interface CloneReport {
  workspace: string;
  total_files: number;
  total_clone_groups: number;
  total_clones: number;
  groups: CloneGroup[];
  error?: string;
}

interface ClonePanelProps {
  report: CloneReport | null;
  loading: boolean;
  onRunScan: () => void;
  onSelectInstance: (instance: CloneInstance) => void;
  onClose?: () => void;
}

export default function ClonePanel({
  report,
  loading,
  onRunScan,
  onSelectInstance,
  onClose,
}: ClonePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNormalizedSig, setShowNormalizedSig] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!report || !report.groups) return [];
    if (!searchQuery.trim()) return report.groups;
    const q = searchQuery.toLowerCase();
    return report.groups.filter((g) => {
      const matchId = g.group_id.toLowerCase().includes(q);
      const matchFile = g.files.some((f) => f.toLowerCase().includes(q));
      const matchCode = g.instances.some((i) => i.code.toLowerCase().includes(q));
      const matchSig = (g.signature || "").toLowerCase().includes(q);
      return matchId || matchFile || matchCode || matchSig;
    });
  }, [report, searchQuery]);

  const activeGroup = useMemo(() => {
    if (!filteredGroups.length) return null;
    if (selectedGroupId) {
      const found = filteredGroups.find((g) => g.group_id === selectedGroupId);
      if (found) return found;
    }
    return filteredGroups[0];
  }, [filteredGroups, selectedGroupId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-100 font-mono select-none overflow-hidden relative">
      
      {/* 1. Header Toolbar */}
      <div className="p-3 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-pink-950/80 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-heading font-bold text-sm text-white">
              Structural Clone Detection
            </h2>
          </div>

          {report && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#141414] rounded-xl border border-[#262626] text-xs text-zinc-400">
              <span className="text-pink-400 font-bold">{report.total_clone_groups} groups</span>
              <span>•</span>
              <span className="text-cyan-400 font-bold">{report.total_clones} clone instances</span>
              <span>•</span>
              <span>{report.total_files} files scanned</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#121212] border border-[#262626] text-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter clones / code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-zinc-200 text-xs w-40 placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowNormalizedSig((p) => !p)}
            className={`px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
              showNormalizedSig
                ? "bg-purple-950/80 border-purple-500/50 text-purple-300"
                : "bg-[#141414] border-[#262626] text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle AST Signature View"
          >
            <Hash className="w-3.5 h-3.5" />
            <span>AST Signature</span>
          </button>

          <button
            onClick={onRunScan}
            disabled={loading}
            className="px-3 py-1 rounded-xl bg-pink-950/80 hover:bg-pink-900 border border-pink-500/40 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(236,72,153,0.25)]"
          >
            {loading ? (
              <Activity className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Run Clone Scan</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[#262626] text-zinc-400 hover:text-white hover:bg-zinc-900"
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content Body */}
      {!report && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0e0e0e] border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-2xl">
            <Layers className="w-8 h-8 opacity-80" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="font-heading font-bold text-base text-white">
              Structural AST Clone Detection
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Scan your workspace to find duplicate logic, copy-pasted blocks, and isomorphic AST subtrees across Python files even when variable names differ.
            </p>
          </div>
          <button
            onClick={onRunScan}
            className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-black text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Detect Structural Clones</span>
          </button>
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
          <Activity className="w-8 h-8 text-pink-400 animate-spin" />
          <span className="text-xs text-zinc-400">Performing AST normalization & structural clone grouping...</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <h3 className="font-heading font-bold text-sm text-white">No Structural Clones Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm font-sans">
            No duplicated or structurally isomorphic AST blocks detected matching current filters.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Clone Groups List */}
          <div className="w-80 border-r border-[#1f1f1f] bg-[#0a0a0a]/50 flex flex-col overflow-y-auto shrink-0">
            <div className="p-2.5 border-b border-[#1f1f1f] text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Clone Groups ({filteredGroups.length})</span>
              <span className="text-pink-400 font-mono">Similarity</span>
            </div>

            <div className="divide-y divide-[#171717] p-1.5 space-y-1">
              {filteredGroups.map((group) => {
                const isSelected = activeGroup?.group_id === group.group_id;
                return (
                  <button
                    key={group.group_id}
                    onClick={() => setSelectedGroupId(group.group_id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-[#141414] border-pink-500/50 shadow-md text-white"
                        : "bg-[#0c0c0c] border-[#1f1f1f] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-pink-400" />
                        <span className="font-bold text-xs text-white uppercase">
                          {group.group_id}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md bg-pink-950/80 border border-pink-500/40 text-pink-300 text-[10px] font-bold">
                        {Math.round(group.similarity * 100)}% Match
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 truncate mb-1">
                      {group.instances_count} instances in {group.files_count} {group.files_count === 1 ? "file" : "files"}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <span className="px-1.5 py-0.2 rounded bg-[#181818] border border-[#262626]">
                        {group.clone_type}
                      </span>
                      <span className="truncate">{group.files.join(", ")}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Group Detail & Instances */}
          {activeGroup && (
            <div className="flex-1 flex flex-col overflow-y-auto bg-[#050505] p-5 space-y-5">
              
              {/* Group Meta Banner */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-base text-white">
                      {activeGroup.group_id}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-pink-950 border border-pink-500/50 text-pink-300 text-xs font-bold">
                      {activeGroup.similarity_label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-sans">
                    Structural clone spanning {activeGroup.instances_count} locations across {activeGroup.files_count} {activeGroup.files_count === 1 ? "file" : "files"}.
                  </p>
                </div>

                <div className="text-right text-xs text-zinc-500">
                  <div>Signature Hash: <code className="text-purple-300">{activeGroup.signature_hash}</code></div>
                </div>
              </div>

              {/* AST Signature Box (if toggled) */}
              {showNormalizedSig && (
                <div className="p-3 rounded-xl bg-[#09090b] border border-purple-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-purple-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Normalized AST Tree Dump
                    </span>
                  </div>
                  <pre className="text-[10px] text-zinc-400 bg-black/50 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-36">
                    {activeGroup.signature}
                  </pre>
                </div>
              )}

              {/* Instances Cards */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Clone Instances ({activeGroup.instances.length})</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {activeGroup.instances.map((inst, iIdx) => (
                    <div
                      key={`${inst.file}-${inst.start_line}-${iIdx}`}
                      className="p-4 rounded-xl bg-[#0c0c0c] border border-[#1f1f1f] hover:border-pink-500/40 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-cyan-400" />
                          <span className="font-bold text-xs text-cyan-300">
                            {inst.file}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#181818] border border-[#282828] text-[11px] text-zinc-400">
                            Lines {inst.start_line}–{inst.end_line}
                          </span>
                        </div>

                        <button
                          onClick={() => onSelectInstance(inst)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1 transition-all group-hover:shadow-cyan-glow"
                        >
                          <span>Jump to Code</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Code Snippet Preview */}
                      <pre className="text-xs text-zinc-200 bg-[#060606] p-3 rounded-lg border border-[#171717] overflow-x-auto whitespace-pre-wrap font-mono">
                        {inst.code}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
