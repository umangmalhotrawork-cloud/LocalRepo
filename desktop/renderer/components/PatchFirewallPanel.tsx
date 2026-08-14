"use client";

import React, { useState } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  RefreshCw, X, ChevronRight, ChevronDown, Download, Cpu, Sparkles, Activity, FileCode
} from "lucide-react";

export interface HunkResult {
  hunk_index: number;
  start_line: number;
  end_line: number;
  original_code: string;
  edited_code: string;
  counterfactual: {
    equivalence_score: number;
    safe_to_remove: boolean;
    confidence: number;
    changed_observations?: number;
    total_observations?: number;
    trace_diff?: any[];
  };
  blast_radius?: {
    blast_radius_score: number;
    root_changed_functions?: any[];
    impacted_functions?: any[];
  };
}

export interface PatchFileResult {
  file_path: string;
  hunks: HunkResult[];
}

export interface PatchFirewallReport {
  schema_version: number;
  files: PatchFileResult[];
  risk_score: number;
  risk_level: "AUTO_APPROVE" | "SAFE_REMOVE" | "REVIEW_REQUIRED" | "HIGH_RISK";
  safe_to_auto_apply: boolean;
  confidence?: number;
  summary: {
    changed_hunks: number;
    safe_removals: number;
    behavior_changes: number;
    impacted_functions: number;
    max_blast_radius_score?: number;
  };
  error?: string;
}

export interface PatchFirewallPanelProps {
  report: PatchFirewallReport | null;
  loading: boolean;
  onRunAnalysis: (patchText: string) => void;
  onClose?: () => void;
  currentFile?: string | null;
}

const DEFAULT_SAMPLE_DIFF = `--- a/src/cart_calculator.py
+++ b/src/cart_calculator.py
@@ -9,4 +9,0 @@
-    subtotal = subtotal * 1
-    subtotal = subtotal + 0
-    subtotal = subtotal - 0
-    subtotal = subtotal / 1
`;

export default function PatchFirewallPanel({
  report,
  loading,
  onRunAnalysis,
  onClose,
  currentFile,
}: PatchFirewallPanelProps) {
  const [patchText, setPatchText] = useState<string>(DEFAULT_SAMPLE_DIFF);
  const [expandedHunks, setExpandedHunks] = useState<Record<string, boolean>>({});

  const toggleHunk = (key: string) => {
    setExpandedHunks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo_nullity_patch_firewall_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskLevelConfig = {
    AUTO_APPROVE: { label: "AUTO APPROVE", bg: "bg-emerald-950/80", text: "text-emerald-300", border: "border-emerald-500/40", icon: ShieldCheck },
    SAFE_REMOVE: { label: "SAFE REMOVE", bg: "bg-emerald-950/90", text: "text-emerald-300", border: "border-emerald-500/50", icon: CheckCircle2 },
    REVIEW_REQUIRED: { label: "REVIEW REQUIRED", bg: "bg-amber-950/80", text: "text-amber-300", border: "border-amber-500/40", icon: AlertTriangle },
    HIGH_RISK: { label: "HIGH RISK", bg: "bg-red-950/90", text: "text-red-300", border: "border-red-500/50", icon: ShieldAlert },
  };

  const currentConfig = report?.risk_level ? riskLevelConfig[report.risk_level] : riskLevelConfig.REVIEW_REQUIRED;
  const BadgeIcon = currentConfig.icon;

  return (
    <div className="h-full flex flex-col bg-[#050507] text-zinc-200 font-sans overflow-hidden">
      {/* Header Bar */}
      <div className="h-12 bg-[#09090c] border-b border-[#18181c] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-red-400" />
          <h2 className="text-sm font-bold tracking-wide text-white">AI Patch Safety Firewall</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/30 uppercase">
            Milestone 23 Flagship
          </span>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <button
              onClick={handleExportJSON}
              className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#18181c] border border-[#222226] text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          )}

          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-[#1f1f24] text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Diff Input Section */}
        <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Proposed Unified Diff / AI Code Edit Buffer</span>
            </label>
            <button
              onClick={() => setPatchText(DEFAULT_SAMPLE_DIFF)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Load Sample Vacuous Removal Patch (Lines 9–12)
            </button>
          </div>

          <textarea
            rows={5}
            value={patchText}
            onChange={(e) => setPatchText(e.target.value)}
            placeholder="Paste unified git diff or proposed source buffer here..."
            className="w-full bg-[#040406] border border-[#1f1f24] rounded-lg p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-red-500/50 resize-y"
          />

          <button
            onClick={() => onRunAnalysis(patchText)}
            disabled={loading || !patchText.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 transition-all disabled:opacity-50"
          >
            <Shield className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Evaluating Counterfactual & Blast Radius Engines..." : "Analyze AI Patch Safety"}</span>
          </button>
        </div>

        {/* Firewall Report Display */}
        {report && (
          <div className="space-y-4">
            {/* Risk Badge & Executive Dashboard */}
            <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-bold text-xs ${currentConfig.bg} ${currentConfig.text} ${currentConfig.border}`}>
                    <BadgeIcon className="w-4 h-4" />
                    <span>{currentConfig.label}</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    Auto-apply status:{" "}
                    <strong className={report.safe_to_auto_apply ? "text-emerald-400" : "text-red-400"}>
                      {report.safe_to_auto_apply ? "SAFE TO APPLY" : "BLOCKED FOR REVIEW"}
                    </strong>
                  </span>
                </div>

                {report.confidence && (
                  <div className="text-xs font-mono text-zinc-400">
                    Engine Confidence: <strong className="text-cyan-400">{Math.round(report.confidence * 100)}%</strong>
                  </div>
                )}
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-[#040406] border border-[#1a1a1f] rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Risk Score</p>
                  <p className={`text-xl font-bold font-mono mt-0.5 ${report.risk_score === 0 ? "text-emerald-400" : report.risk_score < 50 ? "text-amber-400" : "text-red-400"}`}>
                    {report.risk_score} / 100
                  </p>
                </div>
                <div className="bg-[#040406] border border-[#1a1a1f] rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Changed Hunks</p>
                  <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
                    {report.summary?.changed_hunks || 0}
                  </p>
                </div>
                <div className="bg-[#040406] border border-[#1a1a1f] rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Safe Removals</p>
                  <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                    {report.summary?.safe_removals || 0}
                  </p>
                </div>
                <div className="bg-[#040406] border border-[#1a1a1f] rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Behavior Diffs</p>
                  <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                    {report.summary?.behavior_changes || 0}
                  </p>
                </div>
                <div className="bg-[#040406] border border-[#1a1a1f] rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Impacted Callers</p>
                  <p className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                    {report.summary?.impacted_functions || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Evaluated Files & Hunks */}
            {report.files && report.files.map((fileRes, fileIdx) => (
              <div key={fileIdx} className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-[#1a1a1e] pb-2 text-xs font-bold text-white font-mono">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>{fileRes.file_path}</span>
                </div>

                <div className="space-y-3">
                  {fileRes.hunks.map((hunk, hunkIdx) => {
                    const hunkKey = `${fileIdx}-${hunkIdx}`;
                    const isExp = expandedHunks[hunkKey];
                    const isSafe = hunk.counterfactual?.safe_to_remove;

                    return (
                      <div key={hunkIdx} className="border border-[#1a1a1f] rounded-xl bg-[#040406] overflow-hidden">
                        <div
                          onClick={() => toggleHunk(hunkKey)}
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#0d0d12] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            {isExp ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                            <span className="font-mono text-xs font-bold text-zinc-300">
                              Hunk #{hunk.hunk_index} (Lines {hunk.start_line}–{hunk.end_line})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isSafe
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-500/30"
                                  : "bg-red-950 text-red-300 border-red-500/30"
                              }`}
                            >
                              {isSafe ? "SAFE REMOVE" : "BEHAVIORAL CHANGE"}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-cyan-400">
                              Equivalence: {Math.round((hunk.counterfactual?.equivalence_score || 0) * 100)}%
                            </span>
                            <span className="text-zinc-500">
                              Confidence: {Math.round((hunk.counterfactual?.confidence || 0) * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Hunk Trace Details & Code Diffs */}
                        {isExp && (
                          <div className="p-3 border-t border-[#1a1a1f] bg-[#07070a] space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                              <div className="bg-[#030305] p-2.5 rounded border border-[#16161a]">
                                <p className="text-red-400 font-bold mb-1">- Original Code (Hunk Target):</p>
                                <pre className="text-[11px] text-zinc-300 whitespace-pre-wrap">{hunk.original_code || "(Empty)"}</pre>
                              </div>
                              <div className="bg-[#030305] p-2.5 rounded border border-[#16161a]">
                                <p className="text-emerald-400 font-bold mb-1">+ Counterfactual Code:</p>
                                <pre className="text-[11px] text-emerald-300 whitespace-pre-wrap">{hunk.edited_code || "(Removed)"}</pre>
                              </div>
                            </div>

                            {/* Downstream Impacted Functions */}
                            {hunk.blast_radius && hunk.blast_radius.impacted_functions && hunk.blast_radius.impacted_functions.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-[11px] font-bold text-amber-400 uppercase">Downstream Blast Radius Callers</h5>
                                <div className="border border-[#1a1a1f] rounded-lg bg-[#040406] divide-y divide-[#121216]">
                                  {hunk.blast_radius.impacted_functions.map((fn, i) => (
                                    <div key={i} className="p-2 flex items-center justify-between text-[11px] font-mono">
                                      <span className="text-white font-bold">{fn.name}</span>
                                      <span className="text-amber-300">+{fn.distance} hop ({fn.classification})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
