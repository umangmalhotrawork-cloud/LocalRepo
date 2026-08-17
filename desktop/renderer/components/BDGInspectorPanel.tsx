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
  MultiFileImpactReport,
  RuntimeEvidenceReport,
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
  const [impactReport, setImpactReport] = useState<MultiFileImpactReport | null>(null);
  const [runtimeTelemetry, setRuntimeTelemetry] = useState<BDGNodeRuntimeTelemetry | null>(null);
  const [callChainComparison, setCallChainComparison] = useState<RuntimeCallChainComparison | null>(null);
  const [evidenceReport, setEvidenceReport] = useState<RuntimeEvidenceReport | null>(null);
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
    setImpactReport(null);
    setEvidenceReport(null);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const relPath = activeFilePath
          ? activeFilePath.split("/").slice(-2).join("/")
          : undefined;
        const sym = symbolToQuery !== undefined && symbolToQuery !== "" ? symbolToQuery : (searchSymbol || selectedSymbol || "");

        const [res, sessionList, diff] = await Promise.all([
          (window as any).electronAPI.queryBDGSymbolDependencies(sym, relPath, cursorLine, workspacePath),
          (window as any).electronAPI.getRuntimeSessions?.() || Promise.resolve([]),
          (window as any).electronAPI.getBDGBehavioralDiff?.(workspacePath) || Promise.resolve(null),
        ]);

        setQueryResult(res);
        setSessions(sessionList || []);
        setDiffReport(diff || null);

        const targetNode = res?.node;
        const targetSymbol = targetNode?.symbol || sym;
        const targetFile = targetNode?.file || relPath;
        const targetLine = targetNode?.location?.line || cursorLine;
        const targetNodeId = targetNode?.id;

        if (targetSymbol) {
          setUserGoal((prev) => (prev && !prev.includes(targetSymbol) ? `Optimize ${targetSymbol} execution & error safety` : prev));
        }

        if (targetNodeId) {
          const [blast, tel, comp, whatif, impact, evidence] = await Promise.all([
            (window as any).electronAPI.calculateBDGBlastRadius(targetSymbol, targetFile, targetLine, workspacePath, targetNodeId),
            (window as any).electronAPI.getRuntimeTelemetry?.(targetNodeId),
            (window as any).electronAPI.getRuntimeCallChainComparison?.(targetNodeId),
            (window as any).electronAPI.simulateBDGWhatIf?.(targetSymbol, targetFile, targetLine, selectedWhatIfOp, undefined, targetNodeId),
            (window as any).electronAPI.analyzeMultiFileImpact?.(targetSymbol, targetFile, targetLine, workspacePath, targetNodeId),
            (window as any).electronAPI.correlateRuntimeEvidence?.(targetSymbol, targetFile, targetLine, workspacePath, targetNodeId),
          ]);
          setBlastResult(blast || null);
          setRuntimeTelemetry(tel || null);
          setCallChainComparison(comp || null);
          setWhatIfResult(whatif || null);
          setImpactReport(impact || null);
          setEvidenceReport(evidence || null);
        } else {
          setBlastResult(null);
          setRuntimeTelemetry(null);
          setCallChainComparison(null);
          setWhatIfResult(null);
          setImpactReport(null);
          setEvidenceReport(null);
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
      const targetNode = queryResult?.node;
      const targetSymbol = targetNode?.symbol || searchSymbol || selectedSymbol || "";
      const targetFile = targetNode?.file || (activeFilePath ? activeFilePath.split("/").slice(-2).join("/") : undefined);
      const targetLine = targetNode?.location?.line || cursorLine;
      const goal = userGoal || `Optimize ${targetSymbol} execution & error safety`;
      const proposal = await (window as any).electronAPI.generateAIReasoningProposal?.(targetSymbol, targetFile, targetLine, goal, targetNode?.id);
      setAiProposal(proposal || null);
    }
  };

  const handleWhatIfOpChange = async (op: WhatIfOperationType) => {
    setSelectedWhatIfOp(op);
    if (typeof window !== "undefined" && (window as any).electronAPI && queryResult?.node) {
      const targetNode = queryResult.node;
      const whatif = await (window as any).electronAPI.simulateBDGWhatIf?.(
        targetNode.symbol,
        targetNode.file,
        targetNode.location.line,
        op,
        undefined,
        targetNode.id
      );
      setWhatIfResult(whatif || null);
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
    <div className="flex flex-col h-full bg-[#0a0a0d] text-white font-sans text-xs select-none p-3 space-y-3 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1f1f24] w-full min-w-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Network className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-heading font-bold text-sm text-white truncate">Behavioral Dependency Graph</span>
        </div>
        <button
          onClick={() => fetchBDGDependencies()}
          className="p-1 rounded bg-[#141418] hover:bg-[#1f1f24] text-zinc-400 hover:text-white transition-colors shrink-0"
          title="Refresh Graph & Reasoning Query"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
        </button>
      </div>

      {/* Query Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            placeholder="Search symbol (e.g. process_checkout)..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#050505] border border-[#1f1f24] rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 min-w-0"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono font-bold rounded-lg text-xs transition-colors shrink-0"
        >
          Query
        </button>
      </form>

      {/* Target Node Overview & Metrics */}
      {queryResult?.node ? (
        <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2 w-full min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 truncate">
              {renderNodeBadge(queryResult.node)}
              <span className="font-mono font-bold text-sm text-white truncate">{queryResult.node.symbol}</span>
            </div>
            {blastResult && <div className="shrink-0">{renderRiskBadge(blastResult.riskSummary.riskLevel)}</div>}
          </div>

          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{queryResult.node.file}</span>
            </div>
            <span className="text-zinc-500 text-[10px] shrink-0">L{queryResult.node.location.line}</span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-1 pt-2 border-t border-[#1f1f24] text-center font-mono text-[10px] w-full min-w-0">
            <div className="bg-[#050505] p-1 rounded-lg border border-[#1a1a20] min-w-0">
              <span className="text-zinc-500 block truncate text-[9px]">Callers</span>
              <span className="text-cyan-400 font-bold text-xs block truncate">{queryResult.callers.length}</span>
            </div>
            <div className="bg-[#050505] p-1 rounded-lg border border-[#1a1a20] min-w-0">
              <span className="text-zinc-500 block truncate text-[9px]">Callees</span>
              <span className="text-purple-400 font-bold text-xs block truncate">{queryResult.callees.length}</span>
            </div>
            <div className="bg-[#050505] p-1 rounded-lg border border-[#1a1a20] min-w-0">
              <span className="text-zinc-500 block truncate text-[9px]">Executions</span>
              <span className="text-emerald-400 font-bold text-xs block truncate">{runtimeTelemetry?.executionCount || 0}</span>
            </div>
            <div className="bg-[#050505] p-1 rounded-lg border border-[#1a1a20] min-w-0">
              <span className="text-zinc-500 block truncate text-[9px]">Errors</span>
              <span className="text-rose-400 font-bold text-xs block truncate">{runtimeTelemetry?.errorCount || 0}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-[#0d0d12] rounded-xl border border-[#1f1f24] text-center font-mono text-zinc-500 text-xs w-full min-w-0">
          Select a symbol or place cursor on code to inspect dependencies, run What-If simulations, and execute AI reasoning & mutation pipelines.
        </div>
      )}

      {/* Sub Tabs */}
      {queryResult?.node && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#050505] rounded-xl border border-[#1f1f1f] text-[10px] font-mono w-full min-w-0">
            <button
              onClick={() => setActiveTab("aireason")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "aireason" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Bot className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">AI Reason</span>
            </button>
            <button
              onClick={() => setActiveTab("impact")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "impact" ? "bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <GitCompare className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate">Impact</span>
            </button>
            <button
              onClick={() => setActiveTab("whatif")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "whatif" ? "bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate">WhatIf</span>
            </button>
            <button
              onClick={() => setActiveTab("runtime")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "runtime" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Runtime</span>
            </button>
            <button
              onClick={() => setActiveTab("blast")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "blast" ? "bg-rose-950 text-rose-300 border border-rose-500/40 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">Blast</span>
            </button>
            <button
              onClick={() => setActiveTab("callers")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "callers" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Code2 className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">Callers</span>
            </button>
            <button
              onClick={() => setActiveTab("callees")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "callees" ? "bg-purple-950 text-purple-300 border border-purple-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ArrowRight className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate">Callees</span>
            </button>
            <button
              onClick={() => setActiveTab("dataflow")}
              className={`py-1.5 px-1 rounded-lg text-center font-bold transition-all flex items-center justify-center gap-1 min-w-0 truncate ${
                activeTab === "dataflow" ? "bg-amber-950 text-amber-300 border border-amber-500/40" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Database className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">Data</span>
            </button>
          </div>

          {/* Tab Content List */}
          <div className="flex-1 space-y-2 overflow-y-auto font-mono text-[11px] w-full min-w-0">
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

            {/* BEHAVIORAL DIFF / MULTI-FILE IMPACT REVIEW TAB */}
            {activeTab === "impact" && (
              <div className="space-y-3 font-mono">
                {impactReport && (
                  <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-cyan-300 flex items-center gap-1.5 truncate">
                        <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate">MULTI-FILE IMPACT: <span className="text-white font-mono">{impactReport.targetSymbol}</span></span>
                      </span>
                      {renderRiskBadge(impactReport.riskLevel)}
                    </div>
                    <div className="text-[10px] text-zinc-400 border-t border-[#1f1f24] pt-2">
                      <span className="text-zinc-500 font-bold block">RISK EXPLANATION:</span>
                      <span className="text-cyan-200">{impactReport.riskExplanation}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1">
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Affected Files</span>
                        <span className="text-cyan-400 font-bold">{impactReport.affectedFiles.length}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Affected Symbols</span>
                        <span className="text-purple-400 font-bold">{impactReport.affectedSymbols.length}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Edges Traversed</span>
                        <span className="text-amber-400 font-bold">{impactReport.dependencyEdgeCount}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1 border-t border-[#1f1f24]">
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Callers (Direct/Indirect)</span>
                        <span className="text-white font-bold">{impactReport.callers.direct.length} / {impactReport.callers.indirect.length}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Callees (Direct/Indirect)</span>
                        <span className="text-white font-bold">{impactReport.callees.direct.length} / {impactReport.callees.indirect.length}</span>
                      </div>
                    </div>
                  </div>
                )}

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

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] text-zinc-400 block font-bold">Hypothetical Operation:</label>
                    <select
                      value={selectedWhatIfOp}
                      onChange={(e) => handleWhatIfOpChange(e.target.value as WhatIfOperationType)}
                      className="w-full bg-[#050505] border border-[#1f1f24] rounded-lg px-2.5 py-1.5 text-[11px] text-purple-200 focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="remove-node">Remove Node / Function ({queryResult.node.symbol})</option>
                      <option value="remove-call">Remove Call Relationship</option>
                      <option value="remove-write">Remove Variable / State Mutate</option>
                      <option value="disable-external-api">Disable External API Effect</option>
                      <option value="disable-database-op">Disable Database Effect</option>
                    </select>
                  </div>
                </div>

                {whatIfResult && (
                  <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-bold">RISK PREDICTION:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[10px]">Baseline: {whatIfResult.originalRiskLevel}</span>
                        <span className="text-purple-400 font-bold text-xs">→ Hypothetical: {whatIfResult.hypotheticalRiskLevel}</span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-[#1f1f24]">
                      <span className="text-zinc-400 text-[10px] font-bold block">PREDICTED CONSEQUENCES:</span>
                      {whatIfResult.predictedRisks.map((risk, idx) => (
                        <div key={`risk-${idx}`} className="text-[11px] text-purple-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>

                    {whatIfResult.newlyDisconnectedNodes.length > 0 && (
                      <div className="pt-2 border-t border-[#1f1f24] space-y-1">
                        <span className="text-zinc-400 text-[10px] font-bold block">NEWLY DISCONNECTED NODES:</span>
                        {whatIfResult.newlyDisconnectedNodes.map((n) => (
                          <div key={n.id} className="text-[10px] text-amber-300 flex items-center justify-between bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                            <span>{n.symbol}</span>
                            <span className="text-zinc-500">{n.file}:L{n.location.line}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                      runtimeTelemetry?.observed ? "bg-emerald-950 text-emerald-300 border-emerald-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {runtimeTelemetry?.observed ? "OBSERVED AT RUNTIME" : "NO RUNTIME EVIDENCE"}
                    </span>
                  </div>

                  {runtimeTelemetry?.observed ? (
                    <div className="space-y-2 text-[11px]">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#050505] p-2 rounded-lg border border-[#1a1a20]">
                          <span className="text-zinc-500 block text-[10px]">Executions</span>
                          <span className="text-emerald-400 font-bold text-sm">{runtimeTelemetry.executionCount}</span>
                        </div>
                        <div className="bg-[#050505] p-2 rounded-lg border border-[#1a1a20]">
                          <span className="text-zinc-500 block text-[10px]">Error Count</span>
                          <span className="text-rose-400 font-bold text-sm">{runtimeTelemetry.errorCount}</span>
                        </div>
                      </div>

                      {runtimeTelemetry.observedCallers.length > 0 && (
                        <div className="pt-2 border-t border-[#1f1f24] space-y-1">
                          <span className="text-zinc-400 text-[10px] font-bold block">OBSERVED RUNTIME CALLERS:</span>
                          {runtimeTelemetry.observedCallers.map((caller, idx) => (
                            <div key={`caller-${idx}`} className="text-[10px] text-emerald-300 bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{caller}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-[#050505] rounded-lg border border-[#1f1f24] text-zinc-400 text-[11px]">
                      Symbol <span className="text-white font-bold">{queryResult.node.symbol}</span> has not been observed in active runtime execution sessions.
                      <span className="block text-[10px] text-zinc-500 mt-1">(Not declared dead code merely because unobserved).</span>
                    </div>
                  )}
                </div>

                {/* RUNTIME EVIDENCE CORRELATION */}
                {evidenceReport && evidenceReport.correlatedDependencies.length > 0 && (
                  <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-emerald-300 flex items-center gap-1.5 truncate">
                        <Network className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">EVIDENCE CORRELATION: <span className="text-white font-mono">{evidenceReport.targetSymbol}</span></span>
                      </span>
                      {renderRiskBadge(evidenceReport.riskLevel)}
                    </div>

                    <div className="text-[10px] text-zinc-400 border-t border-[#1f1f24] pt-2">
                      <span className="text-zinc-500 font-bold block">CORRELATION SUMMARY:</span>
                      <span className="text-cyan-200">{evidenceReport.riskExplanation}</span>
                    </div>

                    {/* Summary Metrics */}
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1">
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Total</span>
                        <span className="text-white font-bold">{evidenceReport.summary.totalDependencies}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Confirmed</span>
                        <span className="text-emerald-400 font-bold">{evidenceReport.summary.confirmedCount}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Static Only</span>
                        <span className="text-amber-400 font-bold">{evidenceReport.summary.staticOnlyCount}</span>
                      </div>
                      <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                        <span className="text-zinc-500 block">Runtime Only</span>
                        <span className="text-rose-400 font-bold">{evidenceReport.summary.runtimeOnlyCount}</span>
                      </div>
                    </div>

                    {/* Overall Confidence */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[#1f1f24]">
                      <span className="text-[10px] text-zinc-500 font-bold">CONFIDENCE:</span>
                      <div className="flex-1 bg-[#050505] rounded-full h-2 border border-[#1a1a20] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            evidenceReport.summary.overallConfidence >= 0.8 ? "bg-emerald-500" :
                            evidenceReport.summary.overallConfidence >= 0.5 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.round(evidenceReport.summary.overallConfidence * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${
                        evidenceReport.summary.overallConfidence >= 0.8 ? "text-emerald-400" :
                        evidenceReport.summary.overallConfidence >= 0.5 ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {Math.round(evidenceReport.summary.overallConfidence * 100)}%
                      </span>
                    </div>

                    {/* CONFIRMED Dependencies */}
                    {evidenceReport.correlatedDependencies.filter(d => d.classification === "CONFIRMED").length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#1f1f24]">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                          CONFIRMED ({evidenceReport.correlatedDependencies.filter(d => d.classification === "CONFIRMED").length})
                        </span>
                        {evidenceReport.correlatedDependencies.filter(d => d.classification === "CONFIRMED").map((dep, idx) => (
                          <div key={`ev-confirmed-${dep.node?.id || "item"}-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-emerald-300 truncate">{dep.node?.symbol}</span>
                              <span className="text-zinc-600 shrink-0">·</span>
                              <span className="text-zinc-500 shrink-0">{dep.relationship}</span>
                            </div>
                            <span className="text-emerald-400 font-bold shrink-0">{dep.confidenceScore.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* STATIC_ONLY Dependencies */}
                    {evidenceReport.correlatedDependencies.filter(d => d.classification === "STATIC_ONLY").length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#1f1f24]">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                          STATIC ONLY ({evidenceReport.correlatedDependencies.filter(d => d.classification === "STATIC_ONLY").length})
                        </span>
                        {evidenceReport.correlatedDependencies.filter(d => d.classification === "STATIC_ONLY").map((dep, idx) => (
                          <div key={`ev-static-${dep.node?.id || "item"}-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-amber-300 truncate">{dep.node?.symbol}</span>
                              <span className="text-zinc-600 shrink-0">·</span>
                              <span className="text-zinc-500 shrink-0">{dep.relationship}</span>
                            </div>
                            <span className="text-amber-400 font-bold shrink-0">{dep.confidenceScore.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* RUNTIME_ONLY Dependencies */}
                    {evidenceReport.correlatedDependencies.filter(d => d.classification === "RUNTIME_ONLY").length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#1f1f24]">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">
                          RUNTIME ONLY ({evidenceReport.correlatedDependencies.filter(d => d.classification === "RUNTIME_ONLY").length})
                        </span>
                        {evidenceReport.correlatedDependencies.filter(d => d.classification === "RUNTIME_ONLY").map((dep, idx) => (
                          <div key={`ev-runtime-${dep.node?.id || "item"}-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <Zap className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="text-rose-300 truncate">{dep.node?.symbol}</span>
                              <span className="text-zinc-600 shrink-0">·</span>
                              <span className="text-zinc-500 shrink-0">{dep.relationship}</span>
                            </div>
                            <span className="text-rose-400 font-bold shrink-0">{dep.confidenceScore.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Caller Correlation */}
                    {(evidenceReport.callerCorrelation.confirmedCallers.length > 0 ||
                      evidenceReport.callerCorrelation.unobservedCallers.length > 0 ||
                      evidenceReport.callerCorrelation.unexpectedCallers.length > 0) && (
                      <div className="space-y-1 pt-1 border-t border-[#1f1f24]">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">CALLER CORRELATION</span>
                        {evidenceReport.callerCorrelation.confirmedCallers.map((caller, idx) => (
                          <div key={`cc-confirmed-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="text-emerald-300">{caller}</span>
                            <span className="text-zinc-600 text-[9px]">confirmed</span>
                          </div>
                        ))}
                        {evidenceReport.callerCorrelation.unobservedCallers.map((caller, idx) => (
                          <div key={`cc-unobserved-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="text-amber-300">{caller.symbol}</span>
                            <span className="text-zinc-600 text-[9px]">unobserved</span>
                          </div>
                        ))}
                        {evidenceReport.callerCorrelation.unexpectedCallers.map((caller, idx) => (
                          <div key={`cc-unexpected-${idx}`} className="text-[10px] bg-[#050505] p-1.5 rounded border border-[#1a1a20] flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-rose-400 shrink-0" />
                            <span className="text-rose-300">{caller}</span>
                            <span className="text-zinc-600 text-[9px]">unexpected</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#1f1f24] text-center text-[10px]">
                    <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                      <span className="text-zinc-500 block">Files</span>
                      <span className="text-rose-400 font-bold">{blastResult.riskSummary.filesAffectedCount}</span>
                    </div>
                    <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                      <span className="text-zinc-500 block">Functions</span>
                      <span className="text-rose-400 font-bold">{blastResult.riskSummary.functionsAffectedCount}</span>
                    </div>
                    <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                      <span className="text-zinc-500 block">External</span>
                      <span className="text-rose-400 font-bold">{blastResult.riskSummary.externalSystemsCount}</span>
                    </div>
                    <div className="bg-[#050505] p-1.5 rounded border border-[#1a1a20]">
                      <span className="text-zinc-500 block">Tests</span>
                      <span className="text-emerald-400 font-bold">{blastResult.riskSummary.testsCount}</span>
                    </div>
                  </div>
                </div>

                {blastResult.certainItems.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">CERTAIN IMPACT ({blastResult.certainItems.length})</span>
                    {blastResult.certainItems.map((item, idx) => (
                      <div key={`certain-${item.node?.id || "item"}-${idx}`} onClick={() => onJumpToSymbol?.(item.node.file, item.node.location.line)} className="p-2 bg-[#08080c] hover:bg-[#121218] border border-rose-500/20 rounded-lg cursor-pointer flex items-center justify-between text-[11px]">
                        <span className="text-white font-bold">{item.node.symbol}</span>
                        <span className="text-zinc-500 text-[10px]">{item.node.file}:L{item.node.location.line}</span>
                      </div>
                    ))}
                  </div>
                )}
                {blastResult.probableItems && blastResult.probableItems.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">PROBABLE IMPACT ({blastResult.probableItems.length})</span>
                    {blastResult.probableItems.map((item, idx) => (
                      <div key={`probable-${item.node?.id || "item"}-${idx}`} onClick={() => onJumpToSymbol?.(item.node.file, item.node.location.line)} className="p-2 bg-[#08080c] hover:bg-[#121218] border border-amber-500/20 rounded-lg cursor-pointer flex items-center justify-between text-[11px]">
                        <span className="text-white font-bold">{item.node.symbol}</span>
                        <span className="text-zinc-500 text-[10px]">{item.node.file}:L{item.node.location.line}</span>
                      </div>
                    ))}
                  </div>
                )}
                {blastResult.inferredItems && blastResult.inferredItems.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">INFERRED IMPACT ({blastResult.inferredItems.length})</span>
                    {blastResult.inferredItems.map((item, idx) => (
                      <div key={`inferred-${item.node?.id || "item"}-${idx}`} onClick={() => onJumpToSymbol?.(item.node.file, item.node.location.line)} className="p-2 bg-[#08080c] hover:bg-[#121218] border border-purple-500/20 rounded-lg cursor-pointer flex items-center justify-between text-[11px]">
                        <span className="text-white font-bold">{item.node.symbol}</span>
                        <span className="text-zinc-500 text-[10px]">{item.node.file}:L{item.node.location.line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "callers" && (
              queryResult.callers.length > 0 ? (
                queryResult.callers.map((node, idx) => (
                  <div
                    key={`caller-${node.id}-${idx}`}
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
              ) : (
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] text-center text-zinc-500 text-xs">No direct callers found for {queryResult.node.symbol}.</div>
              )
            )}

            {activeTab === "callees" && (
              queryResult.callees.length > 0 ? (
                queryResult.callees.map((node, idx) => (
                  <div
                    key={`callee-${node.id}-${idx}`}
                    onClick={() => onJumpToSymbol?.(node.file, node.location.line)}
                    className="p-2 bg-[#08080c] hover:bg-[#121218] border border-[#1a1a20] rounded-lg cursor-pointer transition-colors flex items-center justify-between font-mono text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-white font-bold">{node.symbol}</span>
                    </div>
                    <span className="text-zinc-500 text-[10px]">{node.file}:L{node.location.line}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] text-center text-zinc-500 text-xs">No direct callees found for {queryResult.node.symbol}.</div>
              )
            )}

            {activeTab === "dataflow" && (
              queryResult.reads.length > 0 || queryResult.writes.length > 0 ? (
                <div className="space-y-2">
                  {queryResult.reads.map((node, idx) => (
                    <div key={`read-${node.id}-${idx}`} className="p-2 bg-[#08080c] border border-[#1a1a20] rounded-lg flex items-center justify-between text-[11px]">
                      <span className="text-amber-300 font-bold">READ: {node.symbol}</span>
                      <span className="text-zinc-500 text-[10px]">{node.file}</span>
                    </div>
                  ))}
                  {queryResult.writes.map((node, idx) => (
                    <div key={`write-${node.id}-${idx}`} className="p-2 bg-[#08080c] border border-[#1a1a20] rounded-lg flex items-center justify-between text-[11px]">
                      <span className="text-rose-300 font-bold">WRITE: {node.symbol}</span>
                      <span className="text-zinc-500 text-[10px]">{node.file}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#1f1f24] text-center text-zinc-500 text-xs">No state reads/writes found for {queryResult.node.symbol}.</div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
