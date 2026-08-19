"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bot,
  FileCode,
  GitCommit,
  Terminal,
  Layers,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Eye,
  Info,
} from "lucide-react";

export type EvidenceNode = {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  provenance: string;
  verified: boolean;
  sessionId: string;
  statement: string;
  workspacePath?: string | null;
  filePath?: string | null;
  lineRange?: string | null;
  roleId?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  relatedNodeIds?: string[];
  metadata?: any;
};

export type VerificationSummary = {
  taskStatus: string;
  evidenceCount: number;
  filesInspected: number;
  filesChanged: number;
  firewallStatus: string;
  transactionStatus: string;
  testStatus: string;
  testsPassed: number;
  testsFailed: number;
  verificationLevel: string;
  unresolvedClaims: number;
};

interface EngineeringTimelineProps {
  activeSessionId?: string | null;
  workspacePath?: string;
  onSelectFile?: (filePath: string, lineRange?: string) => void;
  activeTask?: string;
  onSelectAgentPanel?: () => void;
}

export default function EngineeringTimeline({
  activeSessionId = "default_session",
  workspacePath,
  onSelectFile,
  activeTask,
  onSelectAgentPanel,
}: EngineeringTimelineProps) {
  const [nodes, setNodes] = useState<EvidenceNode[]>([]);
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [traversalNodes, setTraversalNodes] = useState<EvidenceNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEvidenceData = async () => {
    if (typeof window === "undefined" || !(window as any).electronAPI?.evidence) {
      return;
    }
    setLoading(true);
    try {
      const graph = await (window as any).electronAPI.evidence.getGraph(activeSessionId);
      const summ = await (window as any).electronAPI.evidence.getSummary(activeSessionId);
      setNodes(Array.isArray(graph) ? graph : []);
      setSummary(summ || null);
    } catch (e) {
      console.error("[EVIDENCE-UI] Error fetching evidence graph:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidenceData();
  }, [activeSessionId]);

  const handleTraverse = async (nodeId: string, direction: "upstream" | "downstream") => {
    if (typeof window === "undefined" || !(window as any).electronAPI?.evidence?.traverse) return;
    try {
      const res = await (window as any).electronAPI.evidence.traverse(nodeId, activeSessionId, direction);
      if (res && Array.isArray(res.nodes)) {
        setTraversalNodes(res.nodes);
      }
    } catch (e) {
      console.error("[EVIDENCE-UI] Error traversing evidence graph:", e);
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const renderProvenanceBadge = (provenance: string, verified: boolean) => {
    switch (provenance) {
      case "TEST_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>TEST VERIFIED</span>
          </span>
        );
      case "FIREWALL_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span>FIREWALL VERIFIED</span>
          </span>
        );
      case "TRANSACTION_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
            <GitCommit className="w-3 h-3 text-indigo-400" />
            <span>TRANSACTION VERIFIED</span>
          </span>
        );
      case "USER_APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40">
            <UserCheck className="w-3 h-3 text-purple-400" />
            <span>USER APPROVED</span>
          </span>
        );
      case "OBSERVED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-950/80 text-sky-300 border border-sky-500/40">
            <Eye className="w-3 h-3 text-sky-400" />
            <span>OBSERVED</span>
          </span>
        );
      case "MODEL_INFERENCE":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-700/50">
            <Bot className="w-3 h-3 text-cyan-400" />
            <span>MODEL INFERENCE</span>
          </span>
        );
    }
  };

  const renderLevelBadge = (level?: string) => {
    switch (level) {
      case "USER_VERIFIED":
      case "TEST_VERIFIED":
        return <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold text-[10px]">✓ VERIFIED</span>;
      case "TRANSACTION_VERIFIED":
      case "SAFETY_VERIFIED":
        return <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/50 font-bold text-[10px]">◐ SAFETY VERIFIED</span>;
      case "OBSERVED":
        return <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/50 font-bold text-[10px]">◐ OBSERVED</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-700/50 font-bold text-[10px]">○ UNVERIFIED</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090d] text-zinc-200 font-mono text-xs overflow-hidden select-none">
      {/* Top Verification Summary Header */}
      <div className="p-3 bg-[#0d0d14] border-b border-[#1b1b28] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-zinc-100 text-[12px]">VERIFIED ENGINEERING TRAIL</span>
          </div>
          <div className="flex items-center gap-2">
            {renderLevelBadge(summary?.verificationLevel)}
            <button
              onClick={fetchEvidenceData}
              className="p-1 text-zinc-400 hover:text-cyan-300 hover:bg-[#161622] rounded transition-colors cursor-pointer"
              title="Refresh Evidence Graph"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        {activeTask && (
          <div className="p-1.5 rounded bg-[#101422] border border-cyan-500/30 flex items-center justify-between text-[10.5px]">
            <span className="text-cyan-300 font-bold truncate max-w-[220px]">
              Task: {activeTask}
            </span>
            {onSelectAgentPanel && (
              <button
                onClick={onSelectAgentPanel}
                className="text-[9.5px] text-cyan-400 hover:text-cyan-200 hover:underline cursor-pointer"
              >
                Open Dock →
              </button>
            )}
          </div>
        )}

        {/* Summary Dashboard Grid */}
        <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
          <div className="p-1.5 rounded bg-[#11111a] border border-[#1e1e2d] flex items-center justify-between">
            <span className="text-zinc-400">Inspected Files:</span>
            <span className="text-cyan-300 font-bold">{summary?.filesInspected || 0}</span>
          </div>
          <div className="p-1.5 rounded bg-[#11111a] border border-[#1e1e2d] flex items-center justify-between">
            <span className="text-zinc-400">Changed Files:</span>
            <span className="text-cyan-300 font-bold">{summary?.filesChanged || 0}</span>
          </div>
          <div className="p-1.5 rounded bg-[#11111a] border border-[#1e1e2d] flex items-center justify-between">
            <span className="text-zinc-400">Patch Firewall:</span>
            <span className={summary?.firewallStatus === "SAFE" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {summary?.firewallStatus || "N/A"}
            </span>
          </div>
          <div className="p-1.5 rounded bg-[#11111a] border border-[#1e1e2d] flex items-center justify-between">
            <span className="text-zinc-400">Transaction:</span>
            <span className={summary?.transactionStatus === "COMMITTED" ? "text-emerald-400 font-bold" : "text-zinc-400 font-bold"}>
              {summary?.transactionStatus || "NONE"}
            </span>
          </div>
        </div>

        {/* Tests Stat Banner */}
        <div className="p-1.5 rounded bg-[#101614] border border-emerald-500/30 flex items-center justify-between text-[10.5px]">
          <span className="text-zinc-300 flex items-center gap-1">
            <Terminal className="w-3 h-3 text-emerald-400" />
            <span>Tests Outcome:</span>
          </span>
          <span className={summary?.testsFailed ? "text-rose-400 font-bold" : "text-emerald-300 font-bold"}>
            {summary?.testStatus === "PASSED" ? `${summary.testsPassed} Passed · 0 Failed` : summary?.testStatus || "Not Executed"}
          </span>
        </div>
      </div>

      {/* Main Content Area: Split View (Timeline + Node Inspector) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Engineering Timeline View */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {nodes.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 space-y-2">
              <ShieldCheck className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No evidence nodes recorded yet for session.</p>
              <p className="text-[10px]">Evidence graph builds automatically when agent tasks, firewall checks, or tests run.</p>
            </div>
          ) : (
            nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id;
              const isTestFail = node.type === "TEST_RESULT" && node.metadata?.status === "FAILED";
              const isTestPass = node.type === "TEST_RESULT" && node.metadata?.status === "PASSED";

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-[#141420] border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                      : isTestFail
                      ? "bg-[#180f12] border-rose-500/40 hover:border-rose-500/60"
                      : isTestPass
                      ? "bg-[#0e1612] border-emerald-500/40 hover:border-emerald-500/60"
                      : "bg-[#0f0f17] border-[#1d1d2b] hover:border-cyan-500/30"
                  }`}
                >
                  {/* Step Connector Indicator */}
                  {index < nodes.length - 1 && (
                    <div className="absolute left-4 bottom-[-10px] w-0.5 h-2.5 bg-[#252536] z-0" />
                  )}

                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[11px] text-zinc-100 uppercase tracking-wider">
                        {node.type}
                      </span>
                      {node.roleId && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[9px] font-semibold border border-cyan-500/30">
                          {node.roleId} · {node.modelId || "gemini"}
                        </span>
                      )}
                    </div>
                    {renderProvenanceBadge(node.provenance, node.verified)}
                  </div>

                  {/* Statement Content */}
                  <p className="text-zinc-300 text-[11px] leading-relaxed font-mono">
                    {node.statement}
                  </p>

                  {/* Target File link if present */}
                  {node.filePath && (
                    <div className="mt-1.5 flex items-center justify-between text-[10px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectFile && node.filePath) {
                            onSelectFile(node.filePath, node.lineRange || undefined);
                          }
                        }}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-200 hover:underline cursor-pointer"
                      >
                        <FileCode className="w-3 h-3" />
                        <span>{node.filePath} {node.lineRange ? `:${node.lineRange}` : ""}</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </button>
                    </div>
                  )}

                  {/* Execution Metadata / Fallback Banner */}
                  {node.metadata?.isFallback && (
                    <div className="mt-1.5 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[9px]">
                      Requested: {node.metadata.requestedProviderId} → Actual: {node.metadata.actualProviderId} (Fallback)
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Node Evidence Inspector Drawer */}
        {selectedNode && (
          <div className="w-72 bg-[#0c0c14] border-l border-[#1b1b28] p-3 flex flex-col justify-between overflow-y-auto shrink-0 custom-scrollbar">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#1c1c2a] pb-2">
                <span className="font-bold text-cyan-300 text-[11px] uppercase tracking-wider">
                  EVIDENCE INSPECTOR
                </span>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Node ID & Provenance */}
              <div className="space-y-1.5 text-[10.5px]">
                <div>
                  <span className="text-zinc-500 block text-[9.5px]">NODE ID</span>
                  <span className="font-mono text-zinc-200">{selectedNode.id}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9.5px]">PROVENANCE CLASS</span>
                  {renderProvenanceBadge(selectedNode.provenance, selectedNode.verified)}
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9.5px]">VERIFICATION STATUS</span>
                  <span className={selectedNode.verified ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {selectedNode.verified ? "VERIFIED FACT" : "UNVERIFIED INFERENCE"}
                  </span>
                </div>
                {selectedNode.roleId && (
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">AI ROLE / MODEL</span>
                    <span className="text-cyan-300 font-medium">
                      {selectedNode.roleId} ({selectedNode.providerId || "gemini"} / {selectedNode.modelId || "gemini-1.5-flash"})
                    </span>
                  </div>
                )}
                {selectedNode.filePath && (
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">TARGET FILE</span>
                    <button
                      onClick={() => onSelectFile && selectedNode.filePath && onSelectFile(selectedNode.filePath, selectedNode.lineRange || undefined)}
                      className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <FileCode className="w-3 h-3" />
                      <span>{selectedNode.filePath}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Statement Text Box */}
              <div className="space-y-1">
                <span className="text-zinc-500 text-[9.5px] block">STATEMENT</span>
                <div className="p-2 rounded bg-[#07070a] border border-[#1e1e2d] text-zinc-300 text-[10.5px] font-mono leading-relaxed max-h-40 overflow-y-auto">
                  {selectedNode.statement}
                </div>
              </div>

              {/* Traversal Controls */}
              <div className="space-y-1 pt-1 border-t border-[#1c1c2a]">
                <span className="text-zinc-500 text-[9.5px] block font-bold">GRAPH TRAVERSAL</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTraverse(selectedNode.id, "upstream")}
                    className="flex-1 py-1 rounded bg-[#141420] hover:bg-cyan-950 border border-[#252538] text-cyan-300 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Upstream</span>
                  </button>
                  <button
                    onClick={() => handleTraverse(selectedNode.id, "downstream")}
                    className="flex-1 py-1 rounded bg-[#141420] hover:bg-cyan-950 border border-[#252538] text-cyan-300 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Downstream</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
