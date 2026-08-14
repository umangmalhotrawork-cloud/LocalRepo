"use client";

import React, { useState } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  RefreshCw, X, ChevronRight, ChevronDown, Download, Cpu, Sparkles,
  GitPullRequest, FileCode, Layers, ArrowRight, Ban, Check
} from "lucide-react";

export interface TopRiskyHunk {
  file_path: string;
  abs_file_path: string;
  hunk_index: number;
  start_line: number;
  end_line: number;
  risk_level: string;
  risk_score: number;
  equivalence_score: number;
  safe_to_remove: boolean;
  confidence: number;
  blast_radius_score: number;
  impacted_functions_count: number;
  original_code?: string;
  edited_code?: string;
}

export interface AffectedFile {
  file_path: string;
  abs_file_path: string;
  hunks_count: number;
  safe_hunks_count: number;
  risky_hunks_count: number;
  max_blast_score: number;
  hunks: TopRiskyHunk[];
}

export interface RepositoryPatchFirewallReport {
  schema_version: number;
  repository_path: string;
  files_analyzed: number;
  hunks_analyzed: number;
  risky_hunks: number;
  safe_hunks: number;
  affected_files: AffectedFile[];
  top_risky_hunks: TopRiskyHunk[];
  max_blast_radius_score: number;
  risk_score: number;
  risk_level: string;
  merge_recommendation: "ALLOW" | "REVIEW" | "BLOCK";
  safe_to_auto_apply: boolean;
  error?: string;
}

export interface RepositoryPatchFirewallPanelProps {
  report: RepositoryPatchFirewallReport | null;
  loading: boolean;
  onRunAnalysis: (patchText: string) => void;
  onClose?: () => void;
}

const DEFAULT_REPO_DIFF = `--- a/src/cart_calculator.py
+++ b/src/cart_calculator.py
@@ -9,4 +9,0 @@
-    subtotal = subtotal * 1
-    subtotal = subtotal + 0
-    subtotal = subtotal - 0
-    subtotal = subtotal / 1
--- a/src/cart_calculator.py
+++ b/src/cart_calculator.py
@@ -6,1 +6,1 @@
-    subtotal = sum(item["price"] * item["quantity"] for item in items)
+    subtotal = sum(item["price"] * item["quantity"] for item in items) * 1.0
`;

export default function RepositoryPatchFirewallPanel({
  report,
  loading,
  onRunAnalysis,
  onClose,
}: RepositoryPatchFirewallPanelProps) {
  const [patchText, setPatchText] = useState<string>(DEFAULT_REPO_DIFF);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo_nullity_repo_firewall_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recConfig = {
    ALLOW: {
      label: "ALLOW MERGE",
      subtext: "Safe to merge automatically. Zero behavioral regressions or high-risk impact.",
      bg: "bg-emerald-950/90",
      text: "text-emerald-300",
      border: "border-emerald-500/50",
      icon: CheckCircle2,
    },
    REVIEW: {
      label: "MANUAL REVIEW REQUIRED",
      subtext: "Behavioral changes detected. Manual code review recommended before merge.",
      bg: "bg-amber-950/90",
      text: "text-amber-300",
      border: "border-amber-500/50",
      icon: AlertTriangle,
    },
    BLOCK: {
      label: "BLOCK MERGE",
      subtext: "High risk behavioral divergence or exception transitions detected. Merge blocked.",
      bg: "bg-red-950/90",
      text: "text-red-300",
      border: "border-red-500/50",
      icon: Ban,
    },
  };

  const currentRec = report?.merge_recommendation ? recConfig[report.merge_recommendation] : recConfig.REVIEW;
  const RecIcon = currentRec.icon;

  return (
    <div className="h-full flex flex-col bg-[#050507] text-zinc-200 font-sans overflow-hidden">
      {/* Header Bar */}
      <div className="h-12 bg-[#09090c] border-b border-[#18181c] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <GitPullRequest className="w-5 h-5 text-rose-400" />
          <h2 className="text-sm font-bold tracking-wide text-white">Repository-Scale Patch Firewall</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30 uppercase">
            Milestone 24 PR Defense
          </span>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <button
              onClick={handleExportJSON}
              className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#18181c] border border-[#222226] text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PR Report</span>
            </button>
          )}

          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-[#1f1f24] text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Input Box */}
        <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Full Repository Unified Git Diff / Pull Request Payload</span>
            </label>
            <button
              onClick={() => setPatchText(DEFAULT_REPO_DIFF)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Load Multi-Hunk PR Sample Diff
            </button>
          </div>

          <textarea
            rows={5}
            value={patchText}
            onChange={(e) => setPatchText(e.target.value)}
            placeholder="Paste multi-file repository unified diff or git patch..."
            className="w-full bg-[#040406] border border-[#1f1f24] rounded-lg p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-rose-500/50 resize-y"
          />

          <button
            onClick={() => onRunAnalysis(patchText)}
            disabled={loading || !patchText.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all disabled:opacity-50"
          >
            <GitPullRequest className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Evaluating Full Pull Request Across Engine Suite..." : "Analyze Repository Patch Safety"}</span>
          </button>
        </div>

        {/* Results Banner & Dashboard */}
        {report && (
          <div className="space-y-4">
            {/* Recommendation Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${currentRec.bg} ${currentRec.border}`}>
              <div className="flex items-center gap-3">
                <RecIcon className={`w-6 h-6 ${currentRec.text}`} />
                <div>
                  <h3 className={`text-sm font-bold tracking-wide ${currentRec.text}`}>{currentRec.label}</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">{currentRec.subtext}</p>
                </div>
              </div>

              <div className="text-right font-mono text-xs text-zinc-400">
                <span>Auto-Apply: </span>
                <strong className={report.safe_to_auto_apply ? "text-emerald-400" : "text-red-400"}>
                  {report.safe_to_auto_apply ? "PASSED" : "BLOCKED"}
                </strong>
              </div>
            </div>

            {/* Executive KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Files Analyzed</p>
                <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">{report.files_analyzed}</p>
              </div>
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Hunks Evaluated</p>
                <p className="text-xl font-bold text-zinc-300 font-mono mt-0.5">
                  {report.hunks_analyzed} ({report.safe_hunks} Safe / {report.risky_hunks} Risky)
                </p>
              </div>
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Max Blast Radius</p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{report.max_blast_radius_score}</p>
              </div>
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Global Risk Score</p>
                <p className={`text-xl font-bold font-mono mt-0.5 ${report.risk_score === 0 ? "text-emerald-400" : report.risk_score < 60 ? "text-amber-400" : "text-red-400"}`}>
                  {report.risk_score} / 100
                </p>
              </div>
            </div>

            {/* Top Risky Hunks Ranked Table */}
            {report.top_risky_hunks && report.top_risky_hunks.length > 0 && (
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Top Risky Hunks Ranked by Impact</span>
                </h4>

                <div className="border border-[#18181c] rounded-lg overflow-hidden divide-y divide-[#18181c] bg-[#040406]">
                  {report.top_risky_hunks.map((hunk, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2.5">
                        <span className="text-zinc-500 font-bold">#{idx + 1}</span>
                        <span className="text-white font-bold">{hunk.file_path}</span>
                        <span className="text-zinc-400 text-[11px]">Lines {hunk.start_line}–{hunk.end_line}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            hunk.safe_to_remove
                              ? "bg-emerald-950 text-emerald-300 border-emerald-500/30"
                              : "bg-red-950 text-red-300 border-red-500/30"
                          }`}
                        >
                          {hunk.risk_level}
                        </span>
                        <span className="text-cyan-400">Equivalence: {Math.round((hunk.equivalence_score || 0) * 100)}%</span>
                        <span className="text-amber-400">Blast: {hunk.blast_radius_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-File Expandable Results */}
            {report.affected_files && report.affected_files.map((fileObj, fileIdx) => {
              const isExp = expandedFiles[fileObj.file_path] !== false; // expanded by default

              return (
                <div key={fileIdx} className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
                  <div
                    onClick={() => toggleFile(fileObj.file_path)}
                    className="flex items-center justify-between cursor-pointer border-b border-[#18181c] pb-2"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
                      {isExp ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                      <FileCode className="w-4 h-4 text-cyan-400" />
                      <span>{fileObj.file_path}</span>
                    </div>

                    <span className="text-xs font-mono text-zinc-400">
                      {fileObj.hunks_count} Hunks ({fileObj.safe_hunks_count} Safe / {fileObj.risky_hunks_count} Risky)
                    </span>
                  </div>

                  {isExp && (
                    <div className="space-y-2 pt-1">
                      {fileObj.hunks.map((hunk, hIdx) => (
                        <div key={hIdx} className="p-3 bg-[#040406] border border-[#18181c] rounded-lg text-xs space-y-2">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-zinc-300">Hunk #{hunk.hunk_index} (Lines {hunk.start_line}–{hunk.end_line})</span>
                            <span className={hunk.safe_to_remove ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                              {hunk.safe_to_remove ? "SAFE REMOVE" : "BEHAVIOR DIFF"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div className="bg-[#020204] p-2 rounded border border-[#151518]">
                              <p className="text-red-400 font-bold mb-0.5">- Removed Original:</p>
                              <pre className="whitespace-pre-wrap text-zinc-300">{hunk.original_code || "(None)"}</pre>
                            </div>
                            <div className="bg-[#020204] p-2 rounded border border-[#151518]">
                              <p className="text-emerald-400 font-bold mb-0.5">+ Added Edited:</p>
                              <pre className="whitespace-pre-wrap text-emerald-300">{hunk.edited_code || "(Removed)"}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
