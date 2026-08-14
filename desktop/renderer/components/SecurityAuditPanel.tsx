"use client";

import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  RotateCcw,
  Download,
  Search,
  ExternalLink,
  Lock,
  Zap,
  CheckCircle2,
  Bug,
  Key,
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  useSecurityAudit,
  SecurityFinding,
  SecuritySeverity,
} from "../hooks/useSecurityAudit";

interface SecurityAuditPanelProps {
  auditHook: ReturnType<typeof useSecurityAudit>;
  onOpenFile: (filePath: string, line?: number) => void;
}

export default function SecurityAuditPanel({
  auditHook,
  onOpenFile,
}: SecurityAuditPanelProps) {
  const {
    summary,
    filteredFindings,
    loading,
    selectedFinding,
    setSelectedFinding,
    filterSeverity,
    setFilterSeverity,
    filterQuery,
    setFilterQuery,
    runScan,
    exportJson,
    exportMarkdown,
  } = auditHook;

  const renderSeverityBadge = (severity: SecuritySeverity) => {
    switch (severity) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-950/80 text-red-300 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
            Critical
          </span>
        );
      case "high":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950/80 text-rose-300 border border-rose-500/50">
            High
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-500/50">
            Medium
          </span>
        );
      case "low":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-950/80 text-blue-300 border border-blue-500/50">
            Low
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
            Info
          </span>
        );
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case "secret":
        return <Key className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "pattern":
        return <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "dependency":
        return <Bug className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      default:
        return <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#050508] border-r border-[#1f1f24] overflow-hidden">
      {/* Top Header */}
      <div className="h-11 bg-[#09090d] border-b border-[#1f1f24] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            Security & Dependency Audit
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => runScan()}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold text-[10.5px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Rescan Workspace"
          >
            <RotateCcw className={`w-3 h-3 ${loading ? "animate-spin text-red-400" : ""}`} />
            <span>{loading ? "Auditing..." : "Rescan"}</span>
          </button>

          <button
            onClick={exportJson}
            className="px-2 py-1 rounded-lg bg-[#14141c] hover:bg-[#1f1f28] border border-[#272730] text-zinc-300 hover:text-white text-[10.5px] font-bold transition-all cursor-pointer"
            title="Export JSON Report"
          >
            JSON
          </button>

          <button
            onClick={exportMarkdown}
            className="px-2 py-1 rounded-lg bg-[#14141c] hover:bg-[#1f1f28] border border-[#272730] text-zinc-300 hover:text-white text-[10.5px] font-bold transition-all cursor-pointer"
            title="Export Markdown Report"
          >
            Markdown
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="p-3 grid grid-cols-5 gap-2 border-b border-[#1f1f24] bg-[#07070b] shrink-0">
        <div
          onClick={() => setFilterSeverity(filterSeverity === "critical" ? null : "critical")}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            filterSeverity === "critical"
              ? "bg-red-950/60 border-red-500/80 ring-1 ring-red-500"
              : "bg-[#0d0d14] border-[#1f1f28] hover:border-red-500/40"
          }`}
        >
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Critical</div>
          <div className="text-sm font-bold text-red-400 font-mono mt-0.5">
            {summary.critical}
          </div>
        </div>

        <div
          onClick={() => setFilterSeverity(filterSeverity === "high" ? null : "high")}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            filterSeverity === "high"
              ? "bg-rose-950/60 border-rose-500/80 ring-1 ring-rose-500"
              : "bg-[#0d0d14] border-[#1f1f28] hover:border-rose-500/40"
          }`}
        >
          <div className="text-[10px] text-zinc-500 font-bold uppercase">High</div>
          <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">
            {summary.high}
          </div>
        </div>

        <div
          onClick={() => setFilterSeverity(filterSeverity === "medium" ? null : "medium")}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            filterSeverity === "medium"
              ? "bg-amber-950/60 border-amber-500/80 ring-1 ring-amber-500"
              : "bg-[#0d0d14] border-[#1f1f28] hover:border-amber-500/40"
          }`}
        >
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Medium</div>
          <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
            {summary.medium}
          </div>
        </div>

        <div
          onClick={() => setFilterSeverity(filterSeverity === "low" ? null : "low")}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            filterSeverity === "low"
              ? "bg-blue-950/60 border-blue-500/80 ring-1 ring-blue-500"
              : "bg-[#0d0d14] border-[#1f1f28] hover:border-blue-500/40"
          }`}
        >
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Low</div>
          <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
            {summary.low}
          </div>
        </div>

        <div
          onClick={() => setFilterSeverity(null)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            filterSeverity === null
              ? "bg-[#14141e] border-cyan-500/60 ring-1 ring-cyan-500/40"
              : "bg-[#0d0d14] border-[#1f1f28] hover:border-zinc-500"
          }`}
        >
          <div className="text-[10px] text-zinc-500 font-bold uppercase">Total</div>
          <div className="text-sm font-bold text-zinc-100 font-mono mt-0.5">
            {summary.total}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-2 bg-[#0a0a0e] border-b border-[#1f1f24] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter security findings by title, file, or pattern..."
            className="w-full bg-[#121218] border border-[#272730] focus:border-red-500/60 rounded-xl px-2 py-1.5 pl-8 text-zinc-100 placeholder:text-zinc-600 outline-none text-[11px] font-mono"
          />
        </div>
      </div>

      {/* Split Findings View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Findings List */}
        <div className="w-1/2 border-r border-[#1f1f24] overflow-y-auto p-2 space-y-1.5">
          {filteredFindings.map((finding) => {
            const isSelected = selectedFinding?.id === finding.id;
            const fileName = finding.file.split("/").pop() || finding.file;

            return (
              <div
                key={finding.id}
                onClick={() => setSelectedFinding(finding)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? "bg-[#12121c] border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                    : "bg-[#09090e] border-[#1a1a24] hover:bg-[#0f0f16] hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    {renderTypeIcon(finding.type)}
                    <span className="font-bold text-zinc-200 text-[11px] truncate">
                      {finding.title}
                    </span>
                  </div>
                  {renderSeverityBadge(finding.severity)}
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="truncate">{fileName}:{finding.line}</span>
                  <span className="capitalize text-zinc-400">{finding.type}</span>
                </div>
              </div>
            );
          })}

          {filteredFindings.length === 0 && !loading && (
            <div className="py-16 text-center text-zinc-600 space-y-2">
              <ShieldCheck className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <p className="text-xs">No vulnerabilities or security issues detected.</p>
            </div>
          )}
        </div>

        {/* Right Finding Details Pane */}
        <div className="w-1/2 overflow-y-auto p-3.5 space-y-3.5 bg-[#07070a]">
          {selectedFinding ? (
            <>
              {/* Finding Title Header */}
              <div className="space-y-1.5 pb-2 border-b border-[#1f1f24]">
                <div className="flex items-center justify-between">
                  {renderSeverityBadge(selectedFinding.severity)}
                  <button
                    onClick={() => onOpenFile(selectedFinding.file, selectedFinding.line)}
                    className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>Open in Editor</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="text-xs font-bold text-zinc-100 leading-snug">
                  {selectedFinding.title}
                </h3>
              </div>

              {/* Location Card */}
              <div className="p-2.5 rounded-xl bg-[#0b0b10] border border-[#1f1f26] space-y-1 text-[11px]">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Location</div>
                <div className="text-zinc-300 font-mono text-[10.5px] break-all">
                  {selectedFinding.file}:{selectedFinding.line}
                </div>
              </div>

              {/* Excerpt Snippet */}
              {selectedFinding.excerpt && (
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Code Excerpt</div>
                  <div className="p-2.5 rounded-xl bg-[#09090d] border border-[#1f1f26] text-rose-300 font-mono text-[10.5px] overflow-x-auto whitespace-pre-wrap">
                    {selectedFinding.excerpt}
                  </div>
                </div>
              )}

              {/* Recommendation Box */}
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10.5px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Remediation Recommendation</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed text-[10.5px]">
                  {selectedFinding.recommendation}
                </p>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-zinc-600 text-xs">
              Select a finding from the list to inspect details and remediation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
