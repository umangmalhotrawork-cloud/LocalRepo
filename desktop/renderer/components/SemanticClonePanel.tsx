"use client";

import React, { useState } from "react";
import {
  Sparkles,
  GitCompare,
  Code2,
  ExternalLink,
  Filter,
  CheckCircle2,
  RefreshCw,
  X,
  Layers,
  Search,
  Activity,
  Boxes,
  Cpu,
} from "lucide-react";

export interface SemanticCloneInstance {
  id: string;
  file: string;
  absolute_path?: string;
  start_line: number;
  end_line: number;
  code: string;
  semantic_role: string;
  pattern_name: string;
  implementation_style: string;
  features?: {
    agg_type?: string;
    has_loop?: boolean;
    has_call?: boolean;
    data_flow?: string;
    ops?: string[];
  };
}

export interface SemanticCloneGroup {
  group_id: string;
  semantic_pattern: string;
  semantic_role: string;
  similarity: number;
  similarity_label: string;
  files_count: number;
  files: string[];
  instances_count: number;
  fingerprint: {
    role: string;
    target_aggregation?: string;
    data_flow?: string;
  };
  instances: SemanticCloneInstance[];
}

export interface SemanticCloneReport {
  workspace: string;
  threshold: number;
  total_files: number;
  total_groups: number;
  total_clones: number;
  groups: SemanticCloneGroup[];
  error?: string;
}

interface SemanticClonePanelProps {
  report: SemanticCloneReport | null;
  loading: boolean;
  onRunScan: () => void;
  onSelectInstance: (instance: SemanticCloneInstance) => void;
  onClose: () => void;
}

export default function SemanticClonePanel({
  report,
  loading,
  onRunScan,
  onSelectInstance,
  onClose,
}: SemanticClonePanelProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [showFingerprint, setShowFingerprint] = useState(false);

  const groups = report?.groups || [];
  const filteredGroups = groups.filter((g) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      g.semantic_pattern.toLowerCase().includes(q) ||
      g.semantic_role.toLowerCase().includes(q) ||
      g.group_id.toLowerCase().includes(q) ||
      g.files.some((f) => f.toLowerCase().includes(q)) ||
      g.instances.some((i) => i.code.toLowerCase().includes(q) || i.implementation_style.toLowerCase().includes(q))
    );
  });

  const activeGroup =
    groups.find((g) => g.group_id === selectedGroupId) || filteredGroups[0] || groups[0] || null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-white font-sans overflow-hidden select-none">
      {/* Top Banner / Header */}
      <div className="h-12 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-mono text-xs font-bold text-white tracking-wide flex items-center gap-2">
              <span>Semantic Clone Detection</span>
              <span className="px-2 py-0.5 text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-500/30 rounded-full font-bold">
                BEHAVIORAL AST INTENT
              </span>
            </h2>
          </div>

          {report && (
            <div className="flex items-center gap-2 ml-4 font-mono text-[11px] text-zinc-400">
              <span className="px-2 py-0.5 rounded-md bg-[#141414] border border-[#262626] text-cyan-300 font-bold">
                {report.total_groups} semantic groups
              </span>
              <span className="text-zinc-600">•</span>
              <span className="px-2 py-0.5 rounded-md bg-[#141414] border border-[#262626] text-purple-300 font-bold">
                {report.total_clones} isomorphic blocks
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500">{report.total_files} files scanned</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500">threshold: {report.threshold || 0.82}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter semantic clones..."
              className="pl-8 pr-3 py-1 text-xs bg-[#141414] border border-[#262626] rounded-xl text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 w-52 font-mono"
            />
          </div>

          <button
            onClick={() => setShowFingerprint(!showFingerprint)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono transition-all ${
              showFingerprint
                ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 font-bold shadow-cyan-glow"
                : "bg-[#141414] hover:bg-[#1f1f1f] border-[#262626] text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle Feature Fingerprint Details"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Fingerprint</span>
          </button>

          <button
            onClick={onRunScan}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-950/80 to-purple-950/80 hover:from-cyan-900 hover:to-purple-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span>{loading ? "Analyzing..." : "Run Semantic Scan"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors ml-1"
            title="Close Semantic Clone Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List of Clone Groups */}
        <div className="w-80 border-r border-[#1f1f1f] bg-[#0a0a0a] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between text-[11px] font-mono font-bold text-zinc-400">
            <span>SEMANTIC GROUPS ({filteredGroups.length})</span>
            <span className="text-[10px] text-zinc-500 uppercase">SIMILARITY</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#141414]">
            {loading && groups.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
                <Activity className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Extracting behavioral feature vectors...</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 font-mono text-xs">
                {filterQuery ? "No semantic clones match query." : "No semantic clone groups detected."}
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSelected = activeGroup?.group_id === g.group_id;
                return (
                  <div
                    key={g.group_id}
                    onClick={() => setSelectedGroupId(g.group_id)}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-cyan-950/40 border-l-2 border-l-cyan-400 text-white"
                        : "hover:bg-zinc-900/50 text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          {g.semantic_pattern}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        {g.similarity_label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mt-2">
                      <span>
                        {g.instances_count} blocks in {g.files_count} file{g.files_count > 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] text-purple-400/80">
                        {g.fingerprint.target_aggregation}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {g.files.slice(0, 2).map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded bg-[#141414] border border-[#262626] font-mono text-[9px] text-zinc-400 truncate max-w-[200px]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Details Pane */}
        <div className="flex-1 bg-[#050505] flex flex-col overflow-y-auto p-6">
          {activeGroup ? (
            <div className="space-y-6 max-w-5xl">
              {/* Group Header Card */}
              <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] shadow-lg">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-base font-bold text-white tracking-tight">
                      {activeGroup.semantic_pattern}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold shadow-cyan-glow">
                      {activeGroup.similarity_label}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>Group ID:</span>
                    <span className="text-purple-400 font-bold">{activeGroup.group_id}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 font-mono">
                  Syntactically divergent blocks sharing equivalent semantic behavior and reduction targets across{" "}
                  <span className="text-cyan-300 font-bold">{activeGroup.files_count} file(s)</span>.
                </p>

                {/* Fingerprint metadata view */}
                {showFingerprint && (
                  <div className="mt-4 p-3.5 rounded-xl bg-[#141414] border border-cyan-500/30 font-mono text-xs text-zinc-300 space-y-1.5">
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">
                      Behavioral Fingerprint Vector
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-zinc-500">Semantic Role: </span>
                        <span className="text-white font-bold">{activeGroup.fingerprint.role}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Target Aggregation: </span>
                        <span className="text-cyan-300 font-bold">{activeGroup.fingerprint.target_aggregation}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Data Flow: </span>
                        <span className="text-purple-300 font-bold">{activeGroup.fingerprint.data_flow}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Isomorphic Implementations / Instances Comparison */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Behaviorally Equivalent Implementations ({activeGroup.instances.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeGroup.instances.map((instance, idx) => (
                    <div
                      key={`${instance.file}-${instance.start_line}-${idx}`}
                      className="rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-all flex flex-col overflow-hidden shadow-sm"
                    >
                      {/* Instance Header */}
                      <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-[#1f1f1f] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Code2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-mono text-xs font-bold text-zinc-200 truncate">
                            {instance.file}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            Lines {instance.start_line}–{instance.end_line}
                          </span>
                        </div>

                        <button
                          onClick={() => onSelectInstance(instance)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] font-bold transition-all shadow-sm shrink-0"
                          title="Open file and jump to code in Monaco editor"
                        >
                          <span>Jump to Code</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Implementation Style Badge */}
                      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#262626] text-purple-300 font-bold">
                          {instance.implementation_style}
                        </span>
                        {instance.features?.ops && (
                          <span className="text-zinc-500">
                            ops: {instance.features.ops.join(", ")}
                          </span>
                        )}
                      </div>

                      {/* Code Snippet Box */}
                      <div className="p-4 flex-1">
                        <pre className="p-3 rounded-lg bg-[#050505] border border-[#1a1a1a] text-cyan-300/90 font-mono text-xs leading-relaxed overflow-x-auto">
                          <code>{instance.code}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-zinc-500 font-mono">
              <Boxes className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400 font-bold mb-1">No Semantic Clone Group Selected</p>
              <p className="text-xs text-zinc-600 max-w-sm">
                Select a semantic clone group on the left or click "Run Semantic Scan" to analyze AST behavior across your project.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
