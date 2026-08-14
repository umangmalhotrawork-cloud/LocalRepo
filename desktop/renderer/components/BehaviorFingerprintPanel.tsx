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
  root_function: {
    name: string;
    file: string;
    severity: string;
    differences_count: number;
    differences: any[];
  };
  summary: {
    total_impacted_nodes: number;
    observed_changes_count: number;
    static_impacts_count: number;
    unverified_count: number;
    max_depth_reached: number;
    blast_radius_score: number;
    global_severity: string;
  };
  impacted_nodes: ImpactRadiusNode[];
  error?: string;
}

export interface PropagationEvent {
  function: string;
  file: string;
  line: number;
  distance: number;
  relationship: string;
  first_changed_commit: {
    hash: string;
    short_hash: string;
    author: string;
    timestamp: string;
    message: string;
  };
  delay_commits: number;
  classification: "ROOT_CHANGE" | "OBSERVED_CHANGE" | "STATIC_IMPACT" | "UNVERIFIED";
  severity: "HIGH" | "MEDIUM" | "LOW" | "NO_CHANGE";
  description: string;
  differences?: any[];
}

export interface PropagationTimelineResult {
  schema_version: number;
  repository: string;
  target_file: string;
  target_function: string;
  commits_analyzed: number;
  working_tree_preserved: boolean;
  root_change?: {
    hash: string;
    short_hash: string;
    author: string;
    timestamp: string;
    message: string;
  } | null;
  propagation_events: PropagationEvent[];
  unaffected_predicted_callers: string[];
  timeline_summary: {
    total_nodes_in_graph: number;
    observed_propagation_count: number;
    unaffected_callers_count: number;
    max_propagation_delay_commits: number;
  };
  error?: string;
}

export interface BlastRadiusFunction {
  name: string;
  file: string;
  line?: number;
  distance: number;
  classification: "ROOT_CHANGE" | "OBSERVED_CHANGE" | "STATIC_IMPACT";
  severity: "HIGH" | "MEDIUM" | "LOW" | "NO_CHANGE";
  diff_type?: string;
  description: string;
  changed_observations?: number;
}

export interface BlastRadiusResult {
  schema_version: number;
  language: string;
  original_path: string;
  root_changed_functions: BlastRadiusFunction[];
  impacted_functions: BlastRadiusFunction[];
  blast_radius_score: number;
  summary: {
    changed_functions: number;
    impacted_functions: number;
    changed_observations: number;
  };
  error?: string;
}

export interface CounterfactualResult {
  schema_version: number;
  original_path: string;
  candidate_line?: string | number | null;
  equivalence_score: number;
  safe_to_remove: boolean;
  changed_observations: number;
  total_observations: number;
  confidence: number;
  severity: string;
  trace_diff: any[];
  original_world?: {
    file_path: string;
    raw_execution: { exit_code: number; stdout: string; stderr: string; duration_ms: number; timed_out: boolean };
    functions_count: number;
  };
  counterfactual_world?: {
    file_path: string;
    raw_execution: { exit_code: number; stdout: string; stderr: string; duration_ms: number; timed_out: boolean };
    functions_count: number;
  };
  summary?: { exit_code_match: boolean; stdout_match: boolean; stderr_match: boolean; diff_functions_count: number };
  error?: string;
}

export interface BehaviorFingerprintPanelProps {
  filePath: string | null;
  report: BehavioralFingerprintReport | null;
  loading: boolean;
  onGenerate: (filePath: string) => void;
  onClose?: () => void;
  workspaceGraph?: any;
  onImpactRadiusComputed?: (result: ImpactRadiusResult | null) => void;
  onSelectImpactNode?: (file: string, line: number) => void;
  onRunBlastRadius?: (editedSource: string) => Promise<BlastRadiusResult | null>;
  blastRadiusResult?: BlastRadiusResult | null;
  currentFileContent?: string;
  onRunCounterfactual?: (candidateLine: string) => Promise<CounterfactualResult | null>;
  counterfactualResult?: CounterfactualResult | null;
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
  onRunBlastRadius,
  blastRadiusResult: initialBlastResult,
  currentFileContent = "",
  onRunCounterfactual,
  counterfactualResult: initialCfResult,
}: BehaviorFingerprintPanelProps) {
  const [viewMode, setViewMode] = useState<"single" | "compare" | "temporal" | "impact" | "propagation" | "blast" | "counterfactual">("single");
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

  // Temporal Impact Propagation State (Milestone 20)
  const [propagationRootFn, setPropagationRootFn] = useState<string>("");
  const [propagationMaxCommits, setPropagationMaxCommits] = useState<number>(20);
  const [propagationMaxDepth, setPropagationMaxDepth] = useState<number>(3);
  const [propagationResult, setPropagationResult] = useState<PropagationTimelineResult | null>(null);
  const [analyzingPropagation, setAnalyzingPropagation] = useState<boolean>(false);

  // Behavioral Blast Radius State (Milestone 21 Flagship)
  const [editedSourceText, setEditedSourceText] = useState<string>(currentFileContent || "");
  const [blastResultState, setBlastResultState] = useState<BlastRadiusResult | null>(initialBlastResult || null);
  const [analyzingBlast, setAnalyzingBlast] = useState<boolean>(false);

  const handleRunBlastAnalysis = async () => {
    if (!filePath) return;
    setAnalyzingBlast(true);
    try {
      if (onRunBlastRadius) {
        const res = await onRunBlastRadius(editedSourceText);
        setBlastResultState(res);
      } else if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).calculateBlastRadius) {
        const res = await (window.electronAPI as any).calculateBlastRadius({
          original_path: filePath,
          edited_source: editedSourceText,
          workspace_graph: workspaceGraph || { nodes: [], edges: [] },
          max_depth: 3,
        });
        setBlastResultState(res);
      }
    } catch (err: any) {
      console.error("Blast radius analysis error:", err);
    }
    setAnalyzingBlast(false);
  };

  // Counterfactual Execution State (Milestone 22 Flagship)
  const [candidateLineText, setCandidateLineText] = useState<string>("9-12");
  const [cfResultState, setCfResultState] = useState<CounterfactualResult | null>(initialCfResult || null);
  const [analyzingCf, setAnalyzingCf] = useState<boolean>(false);

  const handleRunCounterfactualAnalysis = async () => {
    if (!filePath) return;
    setAnalyzingCf(true);
    try {
      if (onRunCounterfactual) {
        const res = await onRunCounterfactual(candidateLineText);
        setCfResultState(res);
      } else if (typeof window !== "undefined" && window.electronAPI && (window.electronAPI as any).runCounterfactualAnalysis) {
        const res = await (window.electronAPI as any).runCounterfactualAnalysis({
          original_path: filePath,
          candidate_line: candidateLineText,
          workspace_graph: workspaceGraph || { nodes: [], edges: [] },
        });
        setCfResultState(res);
      }
    } catch (err: any) {
      console.error("Counterfactual analysis error:", err);
    }
    setAnalyzingCf(false);
  };

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

  const handleRunPropagationAnalysis = async () => {
    if (!filePath) return;
    setAnalyzingPropagation(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const rootFn = propagationRootFn || report?.functions[0]?.name || "target_function";
        const targetRel = filePath.includes("demo-workspaces/ai_cart_project/")
          ? filePath.split("demo-workspaces/ai_cart_project/")[1]
          : filePath.split("/").slice(-2).join("/");

        const res = await (window.electronAPI as any).calculatePropagationTimeline({
          repositoryPath: process.cwd(),
          targetFile: targetRel,
          targetFunction: rootFn,
          maxCommits: propagationMaxCommits,
          maxDepth: propagationMaxDepth,
          workspaceGraph: workspaceGraph || { nodes: [], edges: [] },
        });
        setPropagationResult(res);
      }
    } catch (err: any) {
      console.error("Propagation analysis error:", err);
    }
    setAnalyzingPropagation(false);
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
            <button
              onClick={() => setViewMode("propagation")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "propagation"
                  ? "bg-amber-950 text-amber-300 border border-amber-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <GitBranch className="w-3 h-3 text-amber-400" />
              <span>Propagation Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("blast")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "blast"
                  ? "bg-red-950 text-red-300 border border-red-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3 text-red-400 animate-pulse" />
              <span>Blast Radius</span>
            </button>
            <button
              onClick={() => setViewMode("counterfactual")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "counterfactual"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span>Counterfactual</span>
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
      ) : viewMode === "propagation" ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#050505] p-4 overflow-y-auto space-y-4">
          {/* Propagation Analysis Setup Panel */}
          <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Temporal Impact Propagation Engine (Milestone 20)</h3>
              </div>
              <span className="text-[10px] text-amber-400 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                Chronological Behavioral Forensics
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Traces how behavioral changes in a root function propagate downstream through the workspace call graph across Git history.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-zinc-400 font-bold block mb-1">Target Function</label>
                <select
                  value={propagationRootFn || (report?.functions[0]?.name || "")}
                  onChange={(e) => setPropagationRootFn(e.target.value)}
                  className="w-full bg-[#121216] border border-[#26262e] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {report?.functions.map((fn) => (
                    <option key={fn.name} value={fn.name}>
                      {fn.name}
                    </option>
                  ))}
                  {(!report || report.functions.length === 0) && <option value="calculate_total">calculate_total</option>}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-bold block mb-1">Max Commits</label>
                <select
                  value={propagationMaxCommits}
                  onChange={(e) => setPropagationMaxCommits(Number(e.target.value))}
                  className="w-full bg-[#121216] border border-[#26262e] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={10}>10 Commits</option>
                  <option value={20}>20 Commits</option>
                  <option value={50}>50 Commits</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-bold block mb-1">Graph Hop Depth</label>
                <select
                  value={propagationMaxDepth}
                  onChange={(e) => setPropagationMaxDepth(Number(e.target.value))}
                  className="w-full bg-[#121216] border border-[#26262e] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={1}>1 Hop (Direct Callers)</option>
                  <option value={2}>2 Hops</option>
                  <option value={3}>3 Hops (Default)</option>
                  <option value={5}>5 Hops (Deep Graph)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunPropagationAnalysis}
                  disabled={analyzingPropagation || !filePath}
                  className="w-full py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-500/40 text-amber-300 font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyzingPropagation ? "animate-spin" : ""}`} />
                  <span>{analyzingPropagation ? "Tracing..." : "Analyze Propagation"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Area */}
          {propagationResult && (
            <div className="space-y-4">
              {/* Executive KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Commits Analyzed</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {propagationResult.commits_analyzed} <span className="text-xs text-zinc-600">revisions</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Observed Propagations</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {propagationResult.timeline_summary?.observed_propagation_count || 0} <span className="text-xs text-zinc-600">callers</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Unaffected Callers</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {propagationResult.timeline_summary?.unaffected_callers_count || 0} <span className="text-xs text-zinc-600">callers</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Max Commit Delay</span>
                  <div className="text-xl font-bold text-cyan-400 mt-1">
                    {propagationResult.timeline_summary?.max_propagation_delay_commits || 0} <span className="text-xs text-zinc-600">commits</span>
                  </div>
                </div>
              </div>

              {/* Root Change Commit Card */}
              {propagationResult.root_change && (
                <div className="p-4 rounded-xl bg-[#0e0c0a] border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                      <GitCommit className="w-3.5 h-3.5" /> Root Behavioral Divergence Commit
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                      {propagationResult.root_change.short_hash}
                    </span>
                  </div>
                  <p className="text-xs text-white font-bold">{propagationResult.root_change.message}</p>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1">
                    <span>Author: {propagationResult.root_change.author}</span>
                    <span>Date: {propagationResult.root_change.timestamp ? new Date(propagationResult.root_change.timestamp).toLocaleString() : "Unknown"}</span>
                  </div>
                </div>
              )}

              {/* Chronological Propagation Sequence */}
              <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Downstream Propagation Sequence</span>
                  <span className="text-zinc-500 font-normal">({propagationResult.propagation_events?.length || 0} callers impacted)</span>
                </h4>

                {propagationResult.propagation_events?.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3 italic">
                    No downstream behavioral changes were observed across the analyzed Git history. Downstream callers remained behaviorally equivalent.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {propagationResult.propagation_events.map((event, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectImpactNode && onSelectImpactNode(event.file, event.line)}
                        className="p-3 rounded-lg bg-[#111114] hover:bg-[#18181c] border border-[#1f1f24] hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-950 text-amber-300 border-amber-500/40">
                            OBSERVED_CHANGE
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{event.function}</span>
                              <span className="text-[10px] text-zinc-500">
                                ({event.file}:L{event.line})
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{event.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 font-bold">
                            + {event.delay_commits} commit delay
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c1c22] text-zinc-400 border border-[#2a2a32]">
                            d = {event.distance} ({event.relationship})
                          </span>
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unaffected Predicted Callers */}
              {propagationResult.unaffected_predicted_callers?.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f1f] space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Unaffected Callers in Static Graph ({propagationResult.unaffected_predicted_callers.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {propagationResult.unaffected_predicted_callers.map((fn, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-[#121216] border border-[#222228] text-[11px] text-emerald-300 font-mono">
                        {fn} (behavior equivalent)
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
          ) : viewMode === "blast" ? (
            <div className="space-y-4">
              {/* Header & Controls */}
              <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                    <Sparkles className="w-4 h-4 text-red-400 animate-pulse" />
                    <span>Behavioral Blast Radius Estimator</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/30 uppercase">
                    Flagship Engine
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400">Original Target File</label>
                  <input
                    type="text"
                    readOnly
                    value={filePath || "No active file selected"}
                    className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-zinc-400">Edited Source Code</label>
                    <button
                      onClick={() => setEditedSourceText(currentFileContent || "")}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      Reset to Active Buffer
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={editedSourceText}
                    onChange={(e) => setEditedSourceText(e.target.value)}
                    placeholder="Paste or type edited source code here..."
                    className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-red-500/50 resize-y"
                  />
                </div>

                <button
                  onClick={handleRunBlastAnalysis}
                  disabled={analyzingBlast || !filePath}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${analyzingBlast ? "animate-spin" : ""}`} />
                  <span>{analyzingBlast ? "Calculating Downstream Impact..." : "Analyze AI Edit"}</span>
                </button>
              </div>

              {/* Blast Results */}
              {blastResultState && (
                <div className="space-y-4">
                  {/* Executive KPI Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Root Changed</p>
                      <p className="text-xl font-bold text-red-400 font-mono mt-0.5">
                        {blastResultState.summary?.changed_functions || 0}
                      </p>
                    </div>
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Impacted Callers</p>
                      <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                        {blastResultState.summary?.impacted_functions || 0}
                      </p>
                    </div>
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Diff Observations</p>
                      <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                        {blastResultState.summary?.changed_observations || 0}
                      </p>
                    </div>
                    <div className="bg-[#0b0b0e] border border-red-500/40 rounded-xl p-3 text-center shadow-lg shadow-red-950/30">
                      <p className="text-[10px] font-bold text-red-400 uppercase">Blast Radius</p>
                      <p className="text-xl font-bold text-red-400 font-mono mt-0.5">
                        {blastResultState.blast_radius_score}
                      </p>
                    </div>
                  </div>

                  {/* Root Changed Functions */}
                  {blastResultState.root_changed_functions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Root Changed Functions</h4>
                      <div className="border border-red-500/30 rounded-xl bg-[#0b0b0e] divide-y divide-[#1f1f24]">
                        {blastResultState.root_changed_functions.map((fn, i) => (
                          <div key={i} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white font-mono">{fn.name}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-500/30 font-bold">
                                  {fn.diff_type}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-1">{fn.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-mono border border-zinc-800">
                                {fn.changed_observations || 0} diffs
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Downstream Impacted Functions */}
                  {blastResultState.impacted_functions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Downstream Impact Propagation</h4>
                      <div className="border border-[#1f1f24] rounded-xl bg-[#0b0b0e] divide-y divide-[#17171a]">
                        {blastResultState.impacted_functions.map((fn, i) => {
                          const isObserved = fn.classification === "OBSERVED_CHANGE";
                          return (
                            <div
                              key={i}
                              onClick={() => onSelectImpactNode && onSelectImpactNode(fn.file, fn.line || 1)}
                              className="p-3 hover:bg-[#121216] transition-colors cursor-pointer flex items-center justify-between group"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-white font-mono group-hover:text-cyan-300 transition-colors">
                                    {fn.name}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      isObserved
                                        ? "bg-amber-950 text-amber-300 border-amber-500/40"
                                        : "bg-yellow-950/70 text-yellow-300 border-yellow-500/30"
                                    }`}
                                  >
                                    {fn.classification}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    +{fn.distance} {fn.distance === 1 ? "hop" : "hops"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1">{fn.description}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === "counterfactual" ? (
            <div className="space-y-4">
              {/* Header & Controls */}
              <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>Counterfactual Execution Engine (Alternate World Sandbox)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 uppercase">
                    Milestone 22
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400">Original Target File</label>
                  <input
                    type="text"
                    readOnly
                    value={filePath || "No active file selected"}
                    className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400">Candidate Ghost Statement Line / Range to Remove</label>
                  <input
                    type="text"
                    value={candidateLineText}
                    onChange={(e) => setCandidateLineText(e.target.value)}
                    placeholder="e.g. 9 or 9-12"
                    className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <button
                  onClick={handleRunCounterfactualAnalysis}
                  disabled={analyzingCf || !filePath}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  <Cpu className={`w-4 h-4 ${analyzingCf ? "animate-spin" : ""}`} />
                  <span>{analyzingCf ? "Executing Alternate World Sandbox..." : "Run Alternate World"}</span>
                </button>
              </div>

              {/* Counterfactual Results */}
              {cfResultState && (
                <div className="space-y-4">
                  {/* Executive KPI Dashboard & Confidence Meter */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Equivalence Score</p>
                      <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                        {Math.round((cfResultState.equivalence_score || 0) * 100)}%
                      </p>
                    </div>
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Removability</p>
                      <p
                        className={`text-sm font-bold font-mono mt-1 px-2 py-0.5 rounded ${
                          cfResultState.safe_to_remove
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-950 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {cfResultState.safe_to_remove ? "SAFE REMOVABLE" : "BEHAVIORAL CHANGE"}
                      </p>
                    </div>
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Diff Observations</p>
                      <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                        {cfResultState.changed_observations || 0} / {cfResultState.total_observations || 0}
                      </p>
                    </div>
                    <div
                      className={`bg-[#0b0b0e] border rounded-xl p-3 text-center shadow-lg ${
                        cfResultState.safe_to_remove
                          ? "border-emerald-500/40 shadow-emerald-950/30"
                          : "border-red-500/40 shadow-red-950/30"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase text-zinc-400">Confidence Meter</p>
                      <p
                        className={`text-xl font-bold font-mono mt-0.5 ${
                          cfResultState.safe_to_remove ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {Math.round((cfResultState.confidence || 0) * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Side-by-Side Execution Traces */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Original World */}
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-[#1f1f24] pb-2">
                        <span className="text-xs font-bold text-cyan-400">Original World Execution</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Exit: {cfResultState.original_world?.raw_execution?.exit_code ?? 0}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono space-y-1">
                        <p>Duration: {cfResultState.original_world?.raw_execution?.duration_ms ?? 0}ms</p>
                        <p>Functions evaluated: {cfResultState.original_world?.functions_count ?? 0}</p>
                        {cfResultState.original_world?.raw_execution?.stdout && (
                          <div className="bg-[#050505] p-2 rounded border border-[#1a1a1e] text-[10px] text-zinc-300 max-h-24 overflow-y-auto">
                            <span className="text-zinc-500">stdout:</span>
                            <pre className="whitespace-pre-wrap">{cfResultState.original_world.raw_execution.stdout}</pre>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Counterfactual World */}
                    <div className="bg-[#0b0b0e] border border-[#1f1f24] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-[#1f1f24] pb-2">
                        <span className="text-xs font-bold text-emerald-400">Counterfactual World Execution</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Exit: {cfResultState.counterfactual_world?.raw_execution?.exit_code ?? 0}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono space-y-1">
                        <p>Duration: {cfResultState.counterfactual_world?.raw_execution?.duration_ms ?? 0}ms</p>
                        <p>Functions evaluated: {cfResultState.counterfactual_world?.functions_count ?? 0}</p>
                        {cfResultState.counterfactual_world?.raw_execution?.stdout && (
                          <div className="bg-[#050505] p-2 rounded border border-[#1a1a1e] text-[10px] text-emerald-300 max-h-24 overflow-y-auto">
                            <span className="text-zinc-500">stdout:</span>
                            <pre className="whitespace-pre-wrap">{cfResultState.counterfactual_world.raw_execution.stdout}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trace Diff Logs */}
                  {cfResultState.trace_diff && cfResultState.trace_diff.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Execution Trace Differences</h4>
                      <div className="border border-[#1f1f24] rounded-xl bg-[#0b0b0e] divide-y divide-[#17171a]">
                        {cfResultState.trace_diff.map((td, i) => (
                          <div key={i} className="p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white font-mono">{td.name || td.type}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/30 font-bold">
                                {td.severity || "DIFF"}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400">{td.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
