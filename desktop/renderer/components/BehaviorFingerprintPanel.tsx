"use client";

import React, { useState } from "react";
import { Cpu, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, ChevronRight, ChevronDown, Clock, FileCode, GitCompare, ArrowRight, XCircle, History, GitCommit, GitBranch, Activity, Sparkles } from "lucide-react";

export interface ObservationItem {
  input: Array<{ type: string; value: any }>;
  status: "success" | "exception" | "timeout";
  output?: { type: string; value: any };
  exception_type?: string;
  message?: string;
  duration_ms?: number;
}

export interface FunctionFingerprint {
  name: string;
  line: number;
  end_line: number;
  parameters: string[];
  param_count: number;
  source_hash: string;
  observations_count: number;
  success_count: number;
  exception_count: number;
  timeout_count: number;
  observations: ObservationItem[];
  fingerprint_hash: string;
}

export interface BehavioralFingerprintReport {
  schema_version: number;
  file_path: string;
  file_name?: string;
  language?: string;
  source_hash: string;
  functions_count: number;
  functions: FunctionFingerprint[];
  generated_at?: string;
  error?: string;
}

export interface BehavioralComparisonResult {
  schema_version: number;
  compatible: boolean;
  reason?: string;
  language?: string;
  severity?: "NO_CHANGE" | "LOW" | "MEDIUM" | "HIGH";
  version_a?: { file_name: string; file_path: string; source_hash: string; functions_count: number };
  version_b?: { file_name: string; file_path: string; source_hash: string; functions_count: number };
  summary?: {
    total_functions_a: number;
    total_functions_b: number;
    added_functions_count: number;
    removed_functions_count: number;
    changed_functions_count: number;
    unchanged_functions_count: number;
    total_observations: number;
    changed_observations: number;
    unchanged_observations: number;
  };
  added_functions?: Array<{ name: string; param_count: number; observations_count: number; description: string }>;
  removed_functions?: Array<{ name: string; param_count: number; observations_count: number; description: string }>;
  changed_functions?: Array<{
    name: string;
    differences_count: number;
    coverage_change?: { type: string; observations_a: number; observations_b: number; description: string };
    differences: Array<{
      type: string;
      input: Array<{ type: string; value: any }>;
      status_a?: string;
      status_b?: string;
      output_a?: any;
      output_b?: any;
      exception_a?: string;
      exception_b?: string;
      description: string;
    }>;
  }>;
  unchanged_functions?: Array<{ name: string; param_count: number; observations_count: number }>;
  error?: string;
}

export interface TemporalCommitPoint {
  commit: { hash: string; short_hash: string; author: string; timestamp: string; message: string };
  status: "baseline" | "unchanged" | "changed" | "file_added" | "file_removed";
  severity?: "NO_CHANGE" | "LOW" | "MEDIUM" | "HIGH";
  exists: boolean;
  functions_count: number;
  changes_count: number;
  differences?: Array<{ function?: string; type: string; description: string; status_a?: string; status_b?: string }>;
}

export interface TemporalDivergence {
  commit: { hash: string; short_hash: string; author: string; timestamp: string; message: string };
  file: string;
  function: string;
  input: Array<{ type: string; value: any }>;
  transition_type: string;
  status_before: string;
  status_after: string;
  output_before?: any;
  output_after?: any;
  exception_before?: string;
  exception_after?: string;
  severity: "NO_CHANGE" | "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export interface TemporalBehaviorResult {
  schema_version: number;
  repository?: string;
  target_file?: string;
  commits_analyzed?: number;
  total_divergences?: number;
  first_divergence?: TemporalDivergence | null;
  timeline?: TemporalCommitPoint[];
  working_tree_preserved?: boolean;
  error?: string;
}

export interface ImpactRadiusNode {
  id: string;
  symbol: string;
  file: string;
  line: number;
  kind?: string;
  distance: number;
  relationship: "direct-caller" | "indirect-caller";
  classification: "ROOT_CHANGE" | "OBSERVED_CHANGE" | "STATIC_IMPACT" | "UNVERIFIED";
  severity: "NO_CHANGE" | "LOW" | "MEDIUM" | "HIGH";
  description: string;
  differences?: any[];
}

export interface ImpactRadiusResult {
  schema_version: number;
  root_function?: {
    name: string;
    file: string;
    severity: string;
    differences_count: number;
    differences: any[];
  };
  summary?: {
    total_impacted_nodes: number;
    observed_changes_count: number;
    static_impacts_count: number;
    unverified_count: number;
    max_depth_reached: number;
    blast_radius_score: number;
    global_severity: "NO_CHANGE" | "LOW" | "MEDIUM" | "HIGH";
  };
  impacted_nodes?: ImpactRadiusNode[];
  error?: string;
}

interface BehaviorFingerprintPanelProps {
  filePath?: string;
  report: BehavioralFingerprintReport | null;
  loading: boolean;
  onGenerate: (filePath: string) => void;
  onClose?: () => void;
  workspaceGraph?: any;
  onImpactRadiusComputed?: (result: ImpactRadiusResult | null) => void;
  onSelectImpactNode?: (file: string, line: number) => void;
}

export default function BehaviorFingerprintPanel({
  filePath,
  report,
  loading,
  onGenerate,
  onClose,
  workspaceGraph,
  onImpactRadiusComputed,
  onSelectImpactNode,
}: BehaviorFingerprintPanelProps) {
  const [viewMode, setViewMode] = useState<"single" | "compare" | "temporal" | "impact">("single");
  const [selectedFn, setSelectedFn] = useState<string | null>(null);
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  
  // Comparison State
  const [compareFileB, setCompareFileB] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<BehavioralComparisonResult | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  // Temporal Regression State (Phase 3B)
  const [maxCommits, setMaxCommits] = useState<number>(20);
  const [temporalResult, setTemporalResult] = useState<TemporalBehaviorResult | null>(null);
  const [analyzingTemporal, setAnalyzingTemporal] = useState<boolean>(false);

  // Impact Radius State (Milestone 19)
  const [impactRootFn, setImpactRootFn] = useState<string>("");
  const [impactMaxDepth, setImpactMaxDepth] = useState<number>(3);
  const [impactResult, setImpactResult] = useState<ImpactRadiusResult | null>(null);
  const [analyzingImpact, setAnalyzingImpact] = useState<boolean>(false);

  const activeFn = report?.functions.find((f) => f.name === selectedFn) || report?.functions[0] || null;

  const toggleObs = (key: string) => {
    setExpandedObs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunImpactAnalysis = async () => {
    if (!filePath) return;
    setAnalyzingImpact(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const rootName = impactRootFn || activeFn?.name || report?.functions[0]?.name || "";
        const fpA = report || (await (window.electronAPI as any).generateFingerprint(filePath));

        const payload = {
          root_function: rootName,
          root_file: filePath,
          workspace_graph: workspaceGraph || { nodes: [], edges: [] },
          fingerprint_a: fpA,
          fingerprint_b: fpA,
          max_depth: impactMaxDepth,
        };

        const res = await (window.electronAPI as any).calculateImpactRadius(payload);
        setImpactResult(res);
        if (onImpactRadiusComputed) {
          onImpactRadiusComputed(res);
        }
      }
    } catch (err: any) {
      console.error("Impact radius calculation error:", err);
    }
    setAnalyzingImpact(false);
  };

  const handleRunComparison = async () => {
    if (!filePath || !compareFileB) return;
    setComparing(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const fpA = await (window.electronAPI as any).generateFingerprint(filePath);
        const fpB = await (window.electronAPI as any).generateFingerprint(compareFileB);

        if (fpA && fpB) {
          const comp = await (window.electronAPI as any).compareFingerprints(fpA, fpB);
          setComparisonResult(comp);
        }
      }
    } catch (err: any) {
      console.error("Comparison error:", err);
    }
    setComparing(false);
  };

  const handleRunTemporalAnalysis = async () => {
    if (!filePath) return;
    setAnalyzingTemporal(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const targetRel = filePath.includes("demo-workspaces/ai_cart_project/")
          ? filePath.split("demo-workspaces/ai_cart_project/")[1]
          : filePath.split("/").slice(-2).join("/");

        const res = await (window.electronAPI as any).analyzeBehaviorHistory({
          workspacePath: process.cwd(),
          targetFile: targetRel,
          maxCommits,
        });
        setTemporalResult(res);
      }
    } catch (err: any) {
      console.error("Temporal history error:", err);
    }
    setAnalyzingTemporal(false);
  };

  const renderValue = (valObj: { type: string; value: any } | undefined) => {
    if (!valObj) return <span className="text-zinc-600">void</span>;
    if (valObj.type === "none" || valObj.type === "null") return <span className="text-purple-400 font-bold">{valObj.type === "none" ? "None" : "null"}</span>;
    if (valObj.type === "undefined") return <span className="text-zinc-500 font-bold">undefined</span>;
    if (valObj.type === "bool" || valObj.type === "boolean") return <span className="text-amber-400 font-bold">{String(valObj.value)}</span>;
    if (valObj.type === "str" || valObj.type === "string") return <span className="text-emerald-300">"{valObj.value}"</span>;
    if (valObj.type === "int" || valObj.type === "float" || valObj.type === "number") return <span className="text-cyan-300 font-bold">{valObj.value}</span>;
    return <span className="text-zinc-300">{JSON.stringify(valObj.value)}</span>;
  };

  const langDisplay = report?.language ? report.language.toUpperCase() : filePath?.match(/\.(js|jsx|ts|tsx)$/i) ? (filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'TYPESCRIPT' : 'JAVASCRIPT') : 'PYTHON';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#050505] text-zinc-300 font-mono text-xs overflow-hidden border-l border-[#1f1f1f]">
      {/* Top Header */}
      <div className="p-4 border-b border-[#1f1f1f] bg-[#09090b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">Behavioral Fingerprint Engine</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/90 text-cyan-300 border border-cyan-500/30 font-bold">
                {langDisplay} Subprocess
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate max-w-md">
              {filePath || "No active source file selected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-[#121215] border border-[#222226]">
            <button
              onClick={() => setViewMode("single")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "single"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Fingerprint
            </button>
            <button
              onClick={() => setViewMode("compare")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "compare"
                  ? "bg-purple-950 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <GitCompare className="w-3 h-3" />
              <span>Cross-Version</span>
            </button>
            <button
              onClick={() => setViewMode("temporal")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "temporal"
                  ? "bg-pink-950 text-pink-300 border border-pink-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <History className="w-3 h-3" />
              <span>Git Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("impact")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "impact"
                  ? "bg-rose-950 text-rose-300 border border-rose-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Activity className="w-3 h-3 text-rose-400" />
              <span>Impact Radius</span>
            </button>
          </div>

          {viewMode === "single" && filePath && (
            <button
              onClick={() => onGenerate(filePath)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Generating..." : "Generate Fingerprint"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {viewMode === "temporal" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#050505] p-4 overflow-y-auto space-y-4">
          {/* Temporal Setup Panel */}
          <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white">Temporal Git Regression Localization (Phase 3B)</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-500/30 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Isolated Worktree (Zero Mutation)
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Target Source File
                </label>
                <input
                  type="text"
                  readOnly
                  value={filePath || ""}
                  className="w-full bg-[#121215] border border-[#222226] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none"
                />
              </div>

              <div className="w-36">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Commit Window
                </label>
                <select
                  value={maxCommits}
                  onChange={(e) => setMaxCommits(Number(e.target.value))}
                  className="w-full bg-[#121215] border border-[#222226] rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none"
                >
                  <option value={10}>10 Commits</option>
                  <option value={20}>20 Commits</option>
                  <option value={50}>50 Commits</option>
                </select>
              </div>

              <div className="flex items-end pt-5">
                <button
                  onClick={handleRunTemporalAnalysis}
                  disabled={analyzingTemporal || !filePath}
                  className="px-4 py-1.5 rounded-lg bg-pink-950 hover:bg-pink-900 border border-pink-500/40 text-pink-200 font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyzingTemporal ? "animate-spin" : ""}`} />
                  <span>{analyzingTemporal ? "Localizing..." : "Analyze Git History"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Temporal Analysis Results */}
          {analyzingTemporal ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-pink-400 animate-spin mx-auto mb-3" />
              <h4 className="text-xs font-bold text-zinc-300">Localizing First Behavioral Divergence</h4>
              <p className="text-[11px] text-zinc-600 mt-1">Materializing isolated commit worktrees and evaluating historical candidate matrices...</p>
            </div>
          ) : temporalResult ? (
            temporalResult.error ? (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 flex items-center gap-3">
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs">Temporal Analysis Error</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{temporalResult.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* First Divergence Highlight Card */}
                {temporalResult.first_divergence ? (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 to-amber-950/30 border border-rose-500/40 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">First Observable Behavioral Divergence Localized</h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-500/50 font-bold">
                        SEVERITY: {temporalResult.first_divergence.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#09090c]/80 p-3 rounded-lg border border-[#1f1f1f]">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Culprit Commit</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <GitCommit className="w-3.5 h-3.5 text-pink-400" />
                          <span className="font-bold text-white font-mono">{temporalResult.first_divergence.commit.short_hash}</span>
                          <span className="text-zinc-400 truncate max-w-xs">"{temporalResult.first_divergence.commit.message}"</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-1">Author: {temporalResult.first_divergence.commit.author}</span>
                      </div>

                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold block">Divergence Target</span>
                        <div className="font-bold text-cyan-300 mt-0.5">
                          {temporalResult.first_divergence.function}() <span className="text-zinc-500 font-normal">in {temporalResult.first_divergence.file}</span>
                        </div>
                        <p className="text-[11px] text-amber-300 mt-1">{temporalResult.first_divergence.description}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No behavioral divergence localized across the analyzed {temporalResult.commits_analyzed} Git commits. Function behavior remained 100% stable.</span>
                  </div>
                )}

                {/* Timeline History Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Analyzed Commit History Timeline</span>
                    <span>{temporalResult.commits_analyzed} Revisions Evaluated</span>
                  </div>

                  <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#070709] divide-y divide-[#171719]">
                    {temporalResult.timeline?.map((pt, idx) => {
                      const isDivergence = pt.status === "changed" || pt.status === "file_added" || pt.status === "file_removed";
                      return (
                        <div key={pt.commit.hash} className={`p-3 transition-colors flex items-center justify-between ${isDivergence ? "bg-amber-950/20" : "hover:bg-[#0c0c0e]"}`}>
                          <div className="flex items-center gap-3">
                            <GitCommit className={`w-3.5 h-3.5 ${isDivergence ? "text-amber-400" : "text-zinc-600"}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white font-mono">{pt.commit.short_hash}</span>
                                <span className="text-zinc-300 font-sans text-xs">{pt.commit.message}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">{pt.commit.author} | {pt.commit.timestamp}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {pt.status === "baseline" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-500/30 font-bold">
                                BASELINE
                              </span>
                            ) : pt.status === "unchanged" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                UNCHANGED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                {pt.changes_count} DIFF(S)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-zinc-600 text-xs">
              Click "Analyze Git History" above to localize the first observable behavioral divergence across the repository's commit timeline.
            </div>
          )}
        </div>
      ) : viewMode === "impact" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#050505] p-4 overflow-y-auto space-y-4">
          {/* Impact Setup Panel */}
          <div className="p-4 rounded-xl bg-[#0d0a0b] border border-rose-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Behavioral Impact Radius & Blast-Radius Engine (Milestone 19)</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-rose-400" />
                Call-Graph + Runtime Fingerprints
              </span>
            </div>

            <div className="grid grid-cols-12 gap-3 pt-1">
              <div className="col-span-6">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Root Function
                </label>
                <select
                  value={impactRootFn}
                  onChange={(e) => setImpactRootFn(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#141416] border border-[#27272a] text-xs text-zinc-200 outline-none"
                >
                  <option value="">Auto-Detect ({report?.functions[0]?.name || "First Function"})</option>
                  {report?.functions.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} (L{f.line})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Max Depth
                </label>
                <select
                  value={impactMaxDepth}
                  onChange={(e) => setImpactMaxDepth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#141416] border border-[#27272a] text-xs text-zinc-200 outline-none"
                >
                  <option value={1}>1 Hop (Direct Callers)</option>
                  <option value={2}>2 Hops</option>
                  <option value={3}>3 Hops (Default)</option>
                  <option value={5}>5 Hops (Deep Trace)</option>
                </select>
              </div>

              <div className="col-span-3 flex items-end">
                <button
                  onClick={handleRunImpactAnalysis}
                  disabled={analyzingImpact || !filePath}
                  className="w-full py-1.5 px-3 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 text-rose-400 ${analyzingImpact ? "animate-spin" : ""}`} />
                  <span>{analyzingImpact ? "Analyzing..." : "Analyze Impact"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Impact Results Executive KPI Header */}
          {impactResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-rose-400 font-bold tracking-wider">Blast-Radius Score</span>
                  <div className="text-2xl font-black text-rose-300 mt-1">
                    {impactResult.summary?.blast_radius_score || 0} <span className="text-xs text-rose-500 font-normal">/ 10.0</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Global Severity</span>
                  <div className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                      impactResult.summary?.global_severity === "HIGH"
                        ? "bg-rose-950 text-rose-300 border-rose-500/40"
                        : impactResult.summary?.global_severity === "MEDIUM"
                        ? "bg-amber-950 text-amber-300 border-amber-500/40"
                        : "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                    }`}>
                      {impactResult.summary?.global_severity || "NO_CHANGE"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Observed Changes</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {impactResult.summary?.observed_changes_count || 0} <span className="text-xs text-zinc-600">/ {impactResult.summary?.total_impacted_nodes || 0} nodes</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Static Dependencies</span>
                  <div className="text-xl font-bold text-cyan-400 mt-1">
                    {impactResult.summary?.static_impacts_count || 0} <span className="text-xs text-zinc-600">nodes</span>
                  </div>
                </div>
              </div>

              {/* Impacted Callers List */}
              <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Downstream Callers & Affected Surface ({impactResult.impacted_nodes?.length || 0})</span>
                  <span className="text-[10px] text-zinc-500 lowercase font-normal">Click node to jump to source / graph</span>
                </h4>

                {impactResult.impacted_nodes?.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-xs">
                    No downstream callers found for target root function in call graph.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {impactResult.impacted_nodes?.map((node, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectImpactNode && onSelectImpactNode(node.file, node.line)}
                        className="p-3 rounded-lg bg-[#111114] hover:bg-[#18181c] border border-[#1f1f24] hover:border-rose-500/40 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            node.classification === "OBSERVED_CHANGE"
                              ? "bg-rose-950 text-rose-300 border-rose-500/40"
                              : node.classification === "STATIC_IMPACT"
                              ? "bg-cyan-950 text-cyan-300 border-cyan-500/40"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700"
                          }`}>
                            {node.classification}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{node.symbol}</span>
                              <span className="text-[10px] text-zinc-500">
                                ({node.file}:L{node.line})
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{node.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c1c22] text-zinc-400 border border-[#2a2a32]">
                            d = {node.distance} ({node.relationship})
                          </span>
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "compare" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#050505] p-4 overflow-y-auto space-y-4">
          {/* Comparison Setup Panel */}
          <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Cross-Version Behavioral Comparison (Phase 3A)</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-bold">
                Level 1–6 Analysis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Version A (Baseline)
                </label>
                <input
                  type="text"
                  readOnly
                  value={filePath || ""}
                  className="w-full bg-[#121215] border border-[#222226] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Version B (Target for Comparison)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter file path for Version B..."
                    value={compareFileB}
                    onChange={(e) => setCompareFileB(e.target.value)}
                    className="flex-1 bg-[#121215] border border-[#222226] rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={handleRunComparison}
                    disabled={comparing || !compareFileB}
                    className="px-3 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${comparing ? "animate-spin" : ""}`} />
                    <span>{comparing ? "Comparing..." : "Run Diff"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Results */}
          {comparing ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <h4 className="text-xs font-bold text-zinc-300">Evaluating Cross-Version Observations</h4>
              <p className="text-[11px] text-zinc-600 mt-1">Comparing candidate matrix behaviors across Version A and B...</p>
            </div>
          ) : comparisonResult ? (
            !comparisonResult.compatible ? (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 flex items-center gap-3">
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs">Incompatible Fingerprints</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{comparisonResult.reason}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Header */}
                <div className="p-3.5 rounded-xl bg-[#08080a] border border-[#1f1f1f] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg font-bold text-xs border ${
                      comparisonResult.severity === "NO_CHANGE"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                        : comparisonResult.severity === "LOW"
                        ? "bg-cyan-950 text-cyan-300 border-cyan-500/40"
                        : comparisonResult.severity === "MEDIUM"
                        ? "bg-amber-950 text-amber-300 border-amber-500/40"
                        : "bg-rose-950 text-rose-300 border-rose-500/40"
                    }`}>
                      SEVERITY: {comparisonResult.severity}
                    </div>

                    <div className="text-xs text-zinc-400">
                      Functions: <span className="text-white font-bold">{comparisonResult.summary?.total_functions_a}</span> ➔ <span className="text-white font-bold">{comparisonResult.summary?.total_functions_b}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                      {comparisonResult.summary?.unchanged_functions_count} Unchanged
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/20">
                      {comparisonResult.summary?.changed_functions_count} Changed
                    </span>
                    {comparisonResult.summary?.added_functions_count! > 0 && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/20">
                        +{comparisonResult.summary?.added_functions_count} Added
                      </span>
                    )}
                    {comparisonResult.summary?.removed_functions_count! > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-500/20">
                        -{comparisonResult.summary?.removed_functions_count} Removed
                      </span>
                    )}
                  </div>
                </div>

                {/* Added Functions */}
                {comparisonResult.added_functions && comparisonResult.added_functions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Added Functions</h4>
                    <div className="space-y-1.5">
                      {comparisonResult.added_functions.map((fn) => (
                        <div key={fn.name} className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-cyan-200">{fn.name}</span>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{fn.description}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold text-[10px]">ADDED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Functions */}
                {comparisonResult.removed_functions && comparisonResult.removed_functions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Removed Functions</h4>
                    <div className="space-y-1.5">
                      {comparisonResult.removed_functions.map((fn) => (
                        <div key={fn.name} className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-rose-200">{fn.name}</span>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{fn.description}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 font-bold text-[10px]">REMOVED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changed Functions */}
                {comparisonResult.changed_functions && comparisonResult.changed_functions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Behavioral Differences</h4>
                    <div className="space-y-2">
                      {comparisonResult.changed_functions.map((fn) => (
                        <div key={fn.name} className="p-3.5 rounded-xl bg-[#09090c] border border-amber-500/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white">{fn.name}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              {fn.differences_count} Behavior Diff(s)
                            </span>
                          </div>

                          <div className="space-y-2 divide-y divide-[#17171a]">
                            {fn.differences.map((diff, idx) => (
                              <div key={idx} className="pt-2 text-xs space-y-1">
                                <div className="flex items-center gap-2 text-amber-300 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>{diff.description}</span>
                                </div>

                                <div className="pl-5 text-[11px] text-zinc-400 flex items-center gap-3">
                                  <span>Before: <span className="text-rose-400 font-bold">{diff.status_a || "N/A"}</span></span>
                                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                                  <span>After: <span className="text-emerald-400 font-bold">{diff.status_b || "N/A"}</span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unchanged Functions */}
                {comparisonResult.unchanged_functions && comparisonResult.unchanged_functions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Unchanged Functions ({comparisonResult.unchanged_functions.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {comparisonResult.unchanged_functions.map((fn) => (
                        <div key={fn.name} className="p-2.5 rounded-lg bg-[#070709] border border-[#1f1f1f] flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-300">{fn.name}</span>
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Equivalent
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="p-8 text-center text-zinc-600 text-xs">
              Enter file path for Version B above and click "Run Diff" to evaluate cross-version behavioral changes.
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
          <h3 className="text-sm font-bold text-white">Generating Behavioral Fingerprint</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Discovering functions and executing deterministic candidate matrix in isolated subprocesses...
          </p>
        </div>
      ) : !report || report.functions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <FileCode className="w-10 h-10 text-zinc-700 mb-3" />
          <h3 className="text-sm font-bold text-zinc-400">No Behavioral Fingerprint Data</h3>
          <p className="text-xs text-zinc-600 mt-1 max-w-sm">
            Select a Python, JS, or TS source file containing function definitions and click "Generate Fingerprint".
          </p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel: Functions List */}
          <div className="w-64 border-r border-[#1f1f1f] bg-[#070709] p-3 flex flex-col shrink-0 overflow-y-auto space-y-2">
            <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Discovered Functions</span>
              <span className="text-cyan-400">{report.functions_count}</span>
            </div>

            {report.functions.map((fn) => {
              const isSelected = activeFn?.name === fn.name;
              return (
                <button
                  key={fn.name}
                  onClick={() => setSelectedFn(fn.name)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all space-y-1.5 ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-500/50 text-cyan-200"
                      : "bg-[#0c0c0e] border-[#1f1f1f] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold truncate text-white">{fn.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">L{fn.line}-{fn.end_line}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Params: {fn.param_count}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      {fn.observations_count} obs
                    </span>
                  </div>

                  <div className="text-[9px] text-zinc-600 font-mono truncate">
                    hash: {fn.fingerprint_hash}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Panel: Observations Matrix */}
          {activeFn ? (
            <div className="flex-1 flex flex-col min-h-0 bg-[#050505] p-4 overflow-y-auto space-y-4">
              {/* Function Summary Card */}
              <div className="p-3.5 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{activeFn.name}({activeFn.parameters.join(", ")})</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">
                      SHA: {activeFn.fingerprint_hash}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Lines {activeFn.line}–{activeFn.end_line} | Source Hash: {activeFn.source_hash}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{activeFn.success_count} Success</span>
                  </div>
                  {activeFn.exception_count > 0 && (
                    <div className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{activeFn.exception_count} Exception</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Observations Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Observation Candidate Matrix</span>
                  <span>{activeFn.observations.length} Evaluated Cases</span>
                </div>

                <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#070709] divide-y divide-[#171719]">
                  {activeFn.observations.map((obs, idx) => {
                    const obsKey = `${activeFn.name}-${idx}`;
                    const isExp = expandedObs[obsKey];
                    const isSuccess = obs.status === "success";

                    return (
                      <div key={idx} className="p-3 hover:bg-[#0c0c0e] transition-colors">
                        <div
                          onClick={() => toggleObs(obsKey)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            {isExp ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
                            
                            {/* Input Parameters */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-500 text-[11px] font-bold">fn(</span>
                              {obs.input.map((inp, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span className="text-zinc-600">,</span>}
                                  {renderValue(inp)}
                                </React.Fragment>
                              ))}
                              <span className="text-zinc-500 text-[11px] font-bold">)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Status Badge */}
                            {isSuccess ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500">➔</span>
                                {renderValue(obs.output)}
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold">
                                  SUCCESS
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-400 border border-amber-500/30 font-bold">
                                  {obs.exception_type || "EXCEPTION"}
                                </span>
                              </div>
                            )}

                            {obs.duration_ms && (
                              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-600" />
                                {obs.duration_ms}ms
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Exception Details */}
                        {isExp && !isSuccess && (
                          <div className="mt-2.5 pt-2.5 border-t border-[#1a1a1e] text-[11px] text-amber-300 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                            <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{obs.exception_type}:</span>
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-[10.5px] text-zinc-300">
                              {obs.message}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
