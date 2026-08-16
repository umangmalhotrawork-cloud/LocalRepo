"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  ArrowRight,
  Database,
  Globe,
  FileCode,
  Layers,
  Code2,
  CheckCircle2,
  RefreshCw,
  Search,
  Zap,
  Flame,
  Activity,
  Sparkles,
  HelpCircle,
  Play,
  Check,
  AlertTriangle,
  GitCompare,
  FileDiff,
  ShieldCheck,
  Bot,
  CheckSquare,
  XSquare,
  ShieldAlert,
} from "lucide-react";
import {
  BDGQueryResult,
  BDGNode,
  BlastRadiusResult,
  BDGNodeRuntimeTelemetry,
  RuntimeCallChainComparison,
  WhatIfComparisonResult,
  WhatIfOperationType,
  BehavioralDiffReport,
  AIReasoningProposal,
} from "../../engine/bdg_schema";

interface BDGInspectorPanelProps {
  workspacePath?: string;
  activeFilePath?: string;
  cursorLine?: number;
  selectedSymbol?: string;
  onJumpToSymbol?: (filePath: string, line: number) => void;
}

export default function BDGInspectorPanel({
  workspacePath,
  activeFilePath,
  cursorLine = 1,
  selectedSymbol,
  onJumpToSymbol,
}: BDGInspectorPanelProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<BDGQueryResult | null>(null);
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [runtimeTelemetry, setRuntimeTelemetry] = useState<BDGNodeRuntimeTelemetry | null>(null);
  const [callChainComparison, setCallChainComparison] = useState<RuntimeCallChainComparison | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("session_current");
  const [whatIfResult, setWhatIfResult] = useState<WhatIfComparisonResult | null>(null);
  const [selectedWhatIfOp, setSelectedWhatIfOp] = useState<WhatIfOperationType>("remove-node");
  const [diffReport, setDiffReport] = useState<BehavioralDiffReport | null>(null);
  const [aiProposal, setAiProposal] = useState<AIReasoningProposal | null>(null);
  const [userGoal, setUserGoal] = useState<string>("Add defensive exception handling");
  const [searchSymbol, setSearchSymbol] = useState<string>(selectedSymbol || "");
  const [activeTab, setActiveTab] = useState<"overview" | "aireason" | "impact" | "whatif" | "runtime" | "blast" | "callers" | "callees" | "dataflow" | "effects">("overview");

  const fetchBDGDependencies = async (symbolToQuery?: string) => {
    setLoading(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const relPath = activeFilePath
          ? activeFilePath.split("/").slice(-2).join("/")
          : undefined;
        const sym = symbolToQuery || searchSymbol || selectedSymbol || "";

        const [res, blast, sessionList, diff] = await Promise.all([
          (window as any).electronAPI.queryBDGSymbolDependencies(sym, relPath, cursorLine),
          (window as any).electronAPI.calculateBDGBlastRadius(sym, relPath, cursorLine),
          (window as any).electronAPI.getRuntimeSessions?.() || Promise.resolve([]),
          (window as any).electronAPI.getBDGBehavioralDiff?.(workspacePath) || Promise.resolve(null),
        ]);

        setQueryResult(res);
        setBlastResult(blast);
        setSessions(sessionList || []);
        setDiffReport(diff || null);

        const targetNodeId = res?.node?.id || blast?.targetNode?.id;
        if (targetNodeId) {
          const [tel, comp, whatif] = await Promise.all([
            (window as any).electronAPI.getRuntimeTelemetry?.(targetNodeId),
            (window as any).electronAPI.getRuntimeCallChainComparison?.(targetNodeId),
            (window as any).electronAPI.simulateBDGWhatIf?.(sym, relPath, cursorLine, selectedWhatIfOp),
          ]);
          setRuntimeTelemetry(tel || null);
          setCallChainComparison(comp || null);
          setWhatIfResult(whatif || null);
        } else {
          setRuntimeTelemetry(null);
          setCallChainComparison(null);
          setWhatIfResult(null);
        }
      }
    } catch (e) {
      console.error("[BDG-INSPECTOR] Error querying BDG/AI:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAIReasoningPipeline = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const relPath = activeFilePath ? activeFilePath.split("/").slice(-2).join("/") : undefined;
      const sym = searchSymbol || selectedSymbol || "";
      const proposal = await (window as any).electronAPI.generateAIReasoningProposal?.(sym, relPath, cursorLine, userGoal);
      setAiProposal(proposal || null);
    }
  };

  const handleApplyAIMutation = async (approved: boolean) => {
    if (!aiProposal) return;
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const res = await (window as any).electronAPI.applyAIMutationProposal?.(aiProposal.id, approved);
      if (res && res.proposal) {
        setAiProposal(res.proposal);
      }
      fetchBDGDependencies();
    }
  };

  useEffect(() => {
    if (selectedSymbol) setSearchSymbol(selectedSymbol);
    fetchBDGDependencies(selectedSymbol);
  }, [selectedSymbol, activeFilePath, cursorLine]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBDGDependencies(searchSymbol);
  };

  const renderNodeBadge = (node: BDGNode) => {
    const typeColors: Record<string, string> = {
      function: "bg-cyan-950/80 text-cyan-300 border-cyan-500/40",
      class: "bg-purple-950/80 text-purple-300 border-purple-500/40",
      variable: "bg-amber-950/80 text-amber-300 border-amber-500/40",
      "database-op": "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
      "external-api": "bg-rose-950/80 text-rose-300 border-rose-500/40",
      file: "bg-zinc-800 text-zinc-300 border-zinc-700",
      module: "bg-blue-950/80 text-blue-300 border-blue-500/40",
      test: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
    };
    const style = typeColors[node.type] || "bg-zinc-800 text-zinc-300 border-zinc-700";

    return (
      <span className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold ${style}`}>
        {node.type.toUpperCase()}
      </span>
    );
  };

  const renderRiskBadge = (level: string) => {
    const riskStyles: Record<string, string> = {
      LOW: "bg-emerald-950/90 text-emerald-300 border-emerald-500/40",
      MEDIUM: "bg-amber-950/90 text-amber-300 border-amber-500/40",
      HIGH: "bg-orange-950/90 text-orange-300 border-orange-500/40",
      CRITICAL: "bg-red-950/90 text-red-300 border-red-500/40 animate-pulse",
    };
    const style = riskStyles[level] || "bg-zinc-800 text-zinc-300 border-zinc-700";
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-mono text-[10px] font-bold ${style}`}>
        RISK: {level}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0d] text-white font-sans text-xs select-none p-3 space-y-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f24]">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <span className="font-heading font-bold text-sm text-white">Behavioral Dependency Graph</span>
        </div>
        <button
          onClick={() => fetchBDGDependencies()}
          className="p-1 rounded bg-[#141418] hover:bg-[#1f1f24] text-zinc-400 hover:text-white transition-colors"
          title="Refresh Graph & Reasoning Query"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
        </button>
      </div>

      {/* Query Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            placeholder="Search symbol (e.g. process_checkout)..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#050505] border border-[#1f1f24] rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono font-bold rounded-lg text-xs transition-colors"
        >
          Query
        </button>
      </form>

      {/* Target Node Overview & Metrics */}
      {queryResult?.node ? (
        <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {renderNodeBadge(queryResult.node)}
              <span className="font-mono font-bold text-sm text-white">{queryResult.node.symbol}</span>
            </div>
            {blastResult && renderRiskBadge(blastResult.riskSummary.riskLevel)}
          </div>

          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{queryResult.node.file}</span>
            </div>
            <span className="text-zinc-500 text-[10px]">L{queryResult.node.location.line}</span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#1f1f24] text-center font-mono text-[10px]">
            <div className="bg-[#050505] p-1.5 rounded-lg border border-[#1a1a20]">
              <span className="text-zinc-500 block">Callers</span>
              <span className="text-cyan-400 font-bold text-xs">{queryResult.callers.length}</span>
            </div>
            <div className="bg-[#050505] p-1.5 rounded-lg border border-[#1a1a20]">
              <span className="text-zinc-500 block">Callees</span>
              <span className="text-purple-400 font-bold text-xs">{queryResult.callees.length}</span>
            </div>
            <div className="bg-[#050505] p-1.5 rounded-lg border border-[#1a1a20]">
              <span className="text-zinc-500 block">Executions</span>
              <span className="text-emerald-400 font-bold text-xs">{runtimeTelemetry?.executionCount || 0}</span>
            </div>
            <div className="bg-[#050505] p-1.5 rounded-lg border border-[#1a1a20]">
              <span className="text-zinc-500 block">Errors</span>
              <span className="text-rose-400 font-bold text-xs">{runtimeTelemetry?.errorCount || 0}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-[#0d0d12] rounded-xl border border-[#1f1f24] text-center font-mono text-zinc-500 text-xs">
          Select a symbol or place cursor on code to inspect dependencies, run What-If simulations, and execute AI reasoning & mutation pipelines.
        </div>
      )}

      {/* Sub Tabs */}
      {queryResult?.node && (
        <>
          <div className="grid grid-cols-8 gap-1 p-1 bg-[#050505] rounded-xl border border-[#1f1f1f] text-[10px] font-mono">
            <button
              onClick={() => setActiveTab("aireason")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === "aireason" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Bot className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>AI Reason</span>
            </button>
            <button
              onClick={() => setActiveTab("impact")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === "impact" ? "bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <GitCompare className="w-3 h-3 text-purple-400 shrink-0" />
              <span>Impact</span>
            </button>
            <button
              onClick={() => setActiveTab("whatif")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === "whatif" ? "bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
              <span>WhatIf</span>
            </button>
            <button
              onClick={() => setActiveTab("runtime")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === "runtime" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Runtime</span>
            </button>
            <button
              onClick={() => setActiveTab("blast")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === "blast" ? "bg-rose-950 text-rose-300 border border-rose-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
              <span>Blast</span>
            </button>
            <button
              onClick={() => setActiveTab("callers")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                activeTab === "callers" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              Callers
            </button>
            <button
              onClick={() => setActiveTab("callees")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                activeTab === "callees" ? "bg-purple-950 text-purple-300 border border-purple-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              Callees
            </button>
            <button
              onClick={() => setActiveTab("dataflow")}
              className={`py-1.5 rounded-lg text-center font-bold transition-all ${
                activeTab === "dataflow" ? "bg-amber-950 text-amber-300 border border-amber-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              Data
            </button>
          </div>

          {/* Tab Content List */}
          <div className="flex-1 space-y-2 overflow-y-auto font-mono text-[11px]">
            {/* AI SYSTEM REASONING + MUTATION TAB */}
            {activeTab === "aireason" && (
              <div className="space-y-3 font-mono">
                {/* Reasoning Pipeline Form */}
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-cyan-400" /> AI SYSTEM REASONING PIPELINE
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] text-zinc-400 block font-bold">Optimization Goal:</label>
                    <input
                      type="text"
                      value={userGoal}
                      onChange={(e) => setUserGoal(e.target.value)}
                      placeholder="e.g. Add defensive exception handling..."
                      className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg px-2.5 py-1.5 text-[11px] text-cyan-200 focus:outline-none focus:border-cyan-500/50"
                    />

                    <button
                      onClick={handleRunAIReasoningPipeline}
                      className="w-full mt-2 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Bot className="w-3.5 h-3.5 text-cyan-400" /> Run Pipeline (Understand → Reason → Simulate → Propose)
                    </button>
                  </div>
                </div>

                {/* Proposal Structured Explanation */}
                {aiProposal && (
                  <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-3">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#1f1f24]">
                      <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" /> REASONING EXPLANATION
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                        aiProposal.status === "pending" ? "bg-amber-950 text-amber-300 border-amber-500/40" :
                        aiProposal.status === "applied" ? "bg-emerald-950 text-emerald-300 border-emerald-500/40" :
                        aiProposal.status === "rejected" ? "bg-zinc-800 text-zinc-400 border-zinc-700" :
                        "bg-rose-950 text-rose-300 border-rose-500/40"
                      }`}>
                        STATUS: {aiProposal.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-bold">PROBLEM SUMMARY</span>
                        <span className="text-white">{aiProposal.problemSummary}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-bold">WHY IT MATTERS</span>
                        <span className="text-zinc-300">{aiProposal.whyItMatters}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-bold">EXPECTED BEHAVIORAL IMPACT</span>
                        <span className="text-emerald-300">{aiProposal.expectedBehavioralImpact}</span>
                      </div>

                      {/* Code Diff Preview */}
                      <div className="pt-2 border-t border-[#1f1f24] space-y-1">
                        <span className="text-zinc-400 text-[10px] font-bold block">PROPOSED CODE MUTATION</span>
                        <div className="p-2 bg-[#050505] rounded border border-[#1f1f24] overflow-x-auto text-[10px] text-cyan-200 whitespace-pre">
                          {aiProposal.proposedCode}
                        </div>
                      </div>

                      {/* Approval Actions */}
                      {aiProposal.status === "pending" && (
                        <div className="pt-3 border-t border-[#1f1f24] grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleApplyAIMutation(true)}
                            className="py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> Approve & Apply
                          </button>
                          <button
                            onClick={() => handleApplyAIMutation(false)}
                            className="py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <XSquare className="w-3.5 h-3.5 text-zinc-400" /> Reject
                          </button>
                        </div>
                      )}

                      {/* Verification Report */}
                      {aiProposal.verificationResult && (
                        <div className={`p-2.5 rounded-lg border text-[10px] mt-2 space-y-1 ${
                          aiProposal.verificationResult.success ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300" : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                        }`}>
                          <div className="font-bold flex items-center gap-1.5">
                            {aiProposal.verificationResult.success ? (
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 text-rose-400" />
                            )}
                            <span>VERIFICATION REPORT: {aiProposal.verificationResult.message}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BEHAVIORAL DIFF / IMPACT REVIEW TAB */}
            {activeTab === "impact" && (
              <div className="space-y-3">
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                    <div className="flex items-center gap-1.5">
                      <GitCompare className="w-4 h-4 text-cyan-400" />
                      <span>BEHAVIORAL IMPACT REVIEW</span>
                    </div>
                    {diffReport && renderRiskBadge(diffReport.riskLevel)}
                  </div>
                </div>

                {diffReport && diffReport.structuralChanges.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                      STRUCTURAL CHANGES ({diffReport.structuralChanges.length})
                    </div>
                    {diffReport.structuralChanges.map((item, idx) => (
                      <div
                        key={`struct-${idx}`}
                        onClick={() => onJumpToSymbol?.(item.node.file, item.node.location.line)}
                        className="p-2 bg-[#08080c] hover:bg-[#121218] border border-cyan-500/20 rounded-lg cursor-pointer transition-colors space-y-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {renderNodeBadge(item.node)}
                            <span className="text-white font-bold">{item.node.symbol}</span>
                          </div>
                          <span className="text-zinc-500 text-[10px]">{item.node.file}:L{item.node.location.line}</span>
                        </div>
                        <div className="text-zinc-400 text-[10px]">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WHAT-IF ANALYSIS ENGINE TAB */}
            {activeTab === "whatif" && (
              <div className="space-y-3 font-mono">
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" /> WHAT-IF HYPOTHETICAL SIMULATION
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* RUNTIME EXECUTION INTELLIGENCE TAB */}
            {activeTab === "runtime" && (
              <div className="space-y-3 font-mono">
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-bold flex items-center gap-1.5 text-xs">
                      <Activity className="w-4 h-4 text-emerald-400" /> RUNTIME EVIDENCE
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* BLAST RADIUS TAB */}
            {activeTab === "blast" && blastResult && (
              <div className="space-y-3 font-mono">
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-400" />
                      <span>BLAST RADIUS SUMMARY</span>
                    </div>
                    {renderRiskBadge(blastResult.riskSummary.riskLevel)}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "callers" && (
              queryResult.callers.map((node) => (
                <div
                  key={node.id}
                  onClick={() => onJumpToSymbol?.(node.file, node.location.line)}
                  className="p-2 bg-[#08080c] hover:bg-[#121218] border border-[#1a1a20] rounded-lg cursor-pointer transition-colors flex items-center justify-between font-mono text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-white font-bold">{node.symbol}</span>
                  </div>
                  <span className="text-zinc-500 text-[10px]">{node.file}:L{node.location.line}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
