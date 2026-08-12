"use client";

import React, { useState } from "react";
import { Zap, Sun, Moon, AlertTriangle, Eye, Flame, ShieldAlert, Sparkles, Activity } from "lucide-react";

export interface StatementLuminance {
  line: number;
  end_line?: number;
  code: string;
  luminance: number;
  classification: "dark" | "medium" | "bright";
  type?: string;
  reason?: string;
  factors?: {
    data_flow?: number;
    control_flow?: number;
    mutation?: number;
    side_effect?: number;
    identity_penalty?: number;
  };
}

export interface FileLuminanceReport {
  file: string;
  absolute_path?: string;
  statements_count: number;
  mean_luminance: number;
  statements: StatementLuminance[];
}

export interface WorkspaceLuminanceReport {
  workspace: string;
  total_files: number;
  total_statements: number;
  mean_luminance: number;
  median_luminance: number;
  dark_code_ratio: number;
  bright_code_ratio: number;
  causal_entropy_index: number;
  histogram: Array<{
    range: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  darkest_statements: Array<{
    file: string;
    line: number;
    code: string;
    luminance: number;
    reason: string;
  }>;
  files: FileLuminanceReport[];
  error?: string;
}

interface CodeEditorPanelProps {
  filePath?: string;
  fileLuminance?: FileLuminanceReport | null;
  onJumpToLine?: (line: number) => void;
}

export default function CodeEditorPanel({
  filePath,
  fileLuminance,
  onJumpToLine,
}: CodeEditorPanelProps) {
  const [activeStatement, setActiveStatement] = useState<StatementLuminance | null>(null);

  if (!fileLuminance || fileLuminance.statements.length === 0) {
    return null;
  }

  const getLuminanceBadge = (lum: number) => {
    if (lum < 0.25) {
      return {
        text: "text-rose-400",
        bg: "bg-rose-950/80 border-rose-500/50",
        label: "DARK (0.00)",
        dot: "bg-rose-500",
      };
    }
    if (lum < 0.70) {
      return {
        text: "text-amber-400",
        bg: "bg-amber-950/80 border-amber-500/50",
        label: "MEDIUM",
        dot: "bg-amber-500",
      };
    }
    return {
      text: "text-cyan-400",
      bg: "bg-cyan-950/80 border-cyan-500/50",
      label: "BRIGHT",
      dot: "bg-cyan-400",
    };
  };

  return (
    <div className="bg-[#0a0a0a] border-t border-[#1f1f1f] p-3 font-mono text-xs select-none">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-zinc-200">Causal Heatmap & Gutter Luminance</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
            Mean: {(fileLuminance.mean_luminance * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Dark (&lt;0.25)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Med (0.25–0.70)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Bright (&gt;0.70)
          </span>
        </div>
      </div>

      {/* Quick Statements Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {fileLuminance.statements.map((s) => {
          const badge = getLuminanceBadge(s.luminance);
          const isSelected = activeStatement?.line === s.line;
          return (
            <button
              key={s.line}
              onClick={() => {
                setActiveStatement(s);
                if (onJumpToLine) onJumpToLine(s.line);
              }}
              className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 transition-all ${
                isSelected
                  ? "border-cyan-400 bg-cyan-950/60 text-white font-bold"
                  : `${badge.bg} ${badge.text} hover:border-zinc-500`
              }`}
              title={`Line ${s.line}: ${(s.luminance * 100).toFixed(0)}% Luminance - ${s.reason || ""}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span>L{s.line}</span>
              <span className="text-[10px] opacity-80">{s.luminance.toFixed(2)}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Statement Insight Detail Tooltip */}
      {activeStatement && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-[#141414] border border-[#262626] text-zinc-300 text-[11px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Line {activeStatement.line}:</span>
            <code className="text-cyan-300 font-bold">{activeStatement.code}</code>
            <span className="text-zinc-500">—</span>
            <span className="text-zinc-400">{activeStatement.reason}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-zinc-500">Causal Score:</span>
            <span className="font-bold text-white px-2 py-0.5 rounded bg-[#202020]">
              {(activeStatement.luminance * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
