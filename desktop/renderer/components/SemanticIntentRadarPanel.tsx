"use client";

import React, { useState } from "react";
import {
  Sparkles, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, X,
  Download, FileCode, Layers, ArrowRight, Compass, Activity, Check
} from "lucide-react";

export interface IntentChange {
  type: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface SemanticIntentDriftReport {
  schema_version: number;
  function_name: string;
  drift_score: number;
  drift_level: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  intent_changes: IntentChange[];
  confidence: number;
  summary: string;
  error?: string;
}

export interface SemanticIntentRadarPanelProps {
  report: SemanticIntentDriftReport | null;
  loading: boolean;
  onRunAnalysis: (origCode: string, editCode: string) => void;
  onClose?: () => void;
}

const SAMPLE_ORIG_CODE = `def calculate_cart_total(items, discount_code=None, tax_rate=0.08):
    # Rule 1: Calculate subtotal
    subtotal = sum(item["price"] * item["quantity"] for item in items)
    
    # Rule 2: Apply discount before tax
    discount = subtotal * 0.10 if discount_code else 0.0
    taxable = max(0.0, subtotal - discount)
    
    # Rule 3: Calculate tax
    tax = taxable * tax_rate
    return round(taxable + tax, 2)
`;

const SAMPLE_EDIT_CODE = `def calculate_cart_total(items, discount_code=None, tax_rate=0.08):
    # Rule 1: Calculate subtotal
    subtotal = sum(item["price"] * item["quantity"] for item in items)
    
    # Reordered Rule: Calculate tax BEFORE discount
    tax = subtotal * tax_rate
    discount = (subtotal + tax) * 0.10 if discount_code else 0.0
    
    return round(subtotal + tax - discount, 2)
`;

export default function SemanticIntentRadarPanel({
  report,
  loading,
  onRunAnalysis,
  onClose,
}: SemanticIntentRadarPanelProps) {
  const [origCode, setOrigCode] = useState<string>(SAMPLE_ORIG_CODE);
  const [editCode, setEditCode] = useState<string>(SAMPLE_EDIT_CODE);

  const levelConfig = {
    NONE: { label: "NO DRIFT", bg: "bg-emerald-950/90", text: "text-emerald-300", border: "border-emerald-500/50", icon: CheckCircle2 },
    LOW: { label: "LOW DRIFT", bg: "bg-cyan-950/90", text: "text-cyan-300", border: "border-cyan-500/50", icon: Sparkles },
    MEDIUM: { label: "MODERATE DRIFT", bg: "bg-amber-950/90", text: "text-amber-300", border: "border-amber-500/50", icon: AlertTriangle },
    HIGH: { label: "HIGH SEMANTIC DRIFT", bg: "bg-red-950/90", text: "text-red-300", border: "border-red-500/50", icon: ShieldAlert },
  };

  const currentLevel = report?.drift_level ? levelConfig[report.drift_level] : levelConfig.NONE;
  const LevelIcon = currentLevel.icon;

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo_nullity_intent_drift_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#050507] text-zinc-200 font-sans overflow-hidden">
      {/* Header Bar */}
      <div className="h-12 bg-[#09090c] border-b border-[#18181c] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5 text-amber-400 animate-spin-slow" />
          <h2 className="text-sm font-bold tracking-wide text-white">Semantic Intent Drift Radar</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 uppercase">
            Milestone 25 Flagship
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Code Input Comparison textareas */}
        <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Original vs AI-Edited Function Code Comparison</span>
            </span>
            <button
              onClick={() => {
                setOrigCode(SAMPLE_ORIG_CODE);
                setEditCode(SAMPLE_EDIT_CODE);
              }}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Load Sample Reordered Business Rule Patch
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 font-mono">Original Function Source</label>
              <textarea
                rows={6}
                value={origCode}
                onChange={(e) => setOrigCode(e.target.value)}
                placeholder="Original source code..."
                className="w-full bg-[#040406] border border-[#1f1f24] rounded-lg p-3 text-xs text-cyan-300 font-mono focus:outline-none focus:border-amber-500/50 resize-y"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 font-mono">AI-Edited Function Source</label>
              <textarea
                rows={6}
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Edited source code..."
                className="w-full bg-[#040406] border border-[#1f1f24] rounded-lg p-3 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500/50 resize-y"
              />
            </div>
          </div>

          <button
            onClick={() => onRunAnalysis(origCode, editCode)}
            disabled={loading || !origCode.trim() || !editCode.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
          >
            <Compass className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Analyzing Business Logic & Rule Order..." : "Run Intent Drift Radar Scan"}</span>
          </button>
        </div>

        {/* Drift Report Output */}
        {report && (
          <div className="space-y-4">
            {/* Drift Level Banner & Dashboard */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${currentLevel.bg} ${currentLevel.border}`}>
              <div className="flex items-center gap-3">
                <LevelIcon className={`w-6 h-6 ${currentLevel.text}`} />
                <div>
                  <h3 className={`text-sm font-bold tracking-wide ${currentLevel.text}`}>{currentLevel.label}</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">{report.summary}</p>
                </div>
              </div>

              <div className="text-right font-mono text-xs text-zinc-400">
                <span>Confidence: </span>
                <strong className="text-cyan-400">{Math.round((report.confidence || 0.94) * 100)}%</strong>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Drift Score</p>
                <p className={`text-xl font-bold font-mono mt-0.5 ${report.drift_score === 0 ? "text-emerald-400" : report.drift_score < 0.5 ? "text-amber-400" : "text-red-400"}`}>
                  {report.drift_score.toFixed(2)} / 1.00
                </p>
              </div>
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Drift Level</p>
                <p className={`text-sm font-bold font-mono mt-1 px-2 py-0.5 rounded ${currentLevel.bg} ${currentLevel.text}`}>
                  {report.drift_level}
                </p>
              </div>
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Intent Changes</p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                  {report.intent_changes?.length || 0}
                </p>
              </div>
            </div>

            {/* Intent Change Cards List */}
            {report.intent_changes && report.intent_changes.length > 0 && (
              <div className="bg-[#09090c] border border-[#18181c] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Detected Semantic Intent Changes</span>
                </h4>

                <div className="space-y-2.5">
                  {report.intent_changes.map((ic, idx) => (
                    <div key={idx} className="p-3 bg-[#040406] border border-[#18181c] rounded-xl text-xs space-y-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white uppercase">{ic.type}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ic.severity === "HIGH"
                              ? "bg-red-950 text-red-300 border-red-500/40"
                              : ic.severity === "MEDIUM"
                              ? "bg-amber-950 text-amber-300 border-amber-500/40"
                              : "bg-cyan-950 text-cyan-300 border-cyan-500/40"
                          }`}
                        >
                          {ic.severity} SEVERITY
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-sans">{ic.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
