"use client";

import React from "react";
import { GitCommit, Layers, ArrowDown, Activity, Sparkles, CornerDownRight, CheckCircle2, AlertCircle } from "lucide-react";

export interface ProvenanceStep {
  type: "definition" | "ghost_operation" | "use" | "return_sink";
  line: number;
  code: string;
}

export interface Finding {
  line: number;
  code: string;
  title: string;
  reason: string;
  luminance: number;
  status: string;
  category?: string;
  provenance?: string[];
  provenance_chain?: ProvenanceStep[];
  causal_path_length?: number;
  return_sink_line?: number | null;
}

interface ProvenanceReplayPanelProps {
  finding: Finding | null;
  onStepClick: (line: number, code: string) => void;
}

export default function ProvenanceReplayPanel({
  finding,
  onStepClick,
}: ProvenanceReplayPanelProps) {
  if (!finding) {
    return (
      <div className="p-4 bg-[#050505] rounded-xl border border-[#1f1f1f] text-center text-zinc-500 text-xs font-mono">
        <Activity className="w-4 h-4 mx-auto mb-2 text-zinc-600 animate-pulse" />
        Select a detected ghost line above to inspect its causal data-flow provenance replay chain.
      </div>
    );
  }

  const chain = finding.provenance_chain || [];
  const pathLength = finding.causal_path_length ?? chain.length;
  const returnSinkLine = finding.return_sink_line;

  const getStepStyle = (type: ProvenanceStep["type"]) => {
    switch (type) {
      case "definition":
        return {
          badge: "DEF",
          badgeClass: "bg-cyan-950/80 border-cyan-500/40 text-cyan-300",
          dotClass: "bg-cyan-400 ring-cyan-400/30",
          cardClass: "hover:border-cyan-500/50 hover:bg-cyan-950/20",
          textClass: "text-cyan-400",
          title: "Initial Variable Definition",
        };
      case "ghost_operation":
        return {
          badge: "GHOST",
          badgeClass: "bg-amber-950/80 border-amber-500/40 text-amber-300",
          dotClass: "bg-amber-400 ring-amber-400/30",
          cardClass: "hover:border-amber-500/50 hover:bg-amber-950/20 border-amber-500/30 bg-amber-950/10",
          textClass: "text-amber-400",
          title: "Vacuous Identity Operation",
        };
      case "use":
        return {
          badge: "USE",
          badgeClass: "bg-purple-950/80 border-purple-500/40 text-purple-300",
          dotClass: "bg-purple-400 ring-purple-400/30",
          cardClass: "hover:border-purple-500/50 hover:bg-purple-950/20",
          textClass: "text-purple-400",
          title: "Downstream Value Propagation",
        };
      case "return_sink":
        return {
          badge: "SINK",
          badgeClass: "bg-emerald-950/80 border-emerald-500/40 text-emerald-300",
          dotClass: "bg-emerald-400 ring-emerald-400/30",
          cardClass: "hover:border-emerald-500/50 hover:bg-emerald-950/20",
          textClass: "text-emerald-400",
          title: "Terminal Return Sink",
        };
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-1 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-1.5 text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
          <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
          <span>Provenance Replay</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            Path: <strong className="text-cyan-300">{pathLength}</strong>
          </span>
          {returnSinkLine && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
              Sink: L{returnSinkLine}
            </span>
          )}
        </div>
      </div>

      {/* Target Focus Indicator */}
      <div className="px-2.5 py-1.5 rounded-lg bg-[#0d0d0d] border border-[#222] flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">Inspecting:</span>
        <span className="text-amber-300 font-bold">Line {finding.line}</span>
      </div>

      {/* Timeline Stream */}
      {chain.length > 0 ? (
        <div className="relative pl-4 space-y-2 border-l border-zinc-800 ml-2">
          {chain.map((step, idx) => {
            const style = getStepStyle(step.type);
            return (
              <button
                key={idx}
                onClick={() => onStepClick(step.line, step.code)}
                className={`relative w-full text-left p-2.5 rounded-xl bg-[#050505] border border-[#1a1a1a] transition-all group ${style.cardClass}`}
              >
                {/* Timeline Node Dot */}
                <span
                  className={`absolute -left-[21px] top-3.5 w-2 h-2 rounded-full ring-4 ${style.dotClass}`}
                />

                {/* Step Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${style.badgeClass}`}
                    >
                      {style.badge}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-sans group-hover:text-zinc-200 truncate">
                      {style.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold ${style.textClass}`}>
                    L{step.line}
                  </span>
                </div>

                {/* Code Snippet */}
                <div className="bg-[#101010] p-1.5 rounded text-[11px] text-zinc-300 truncate border border-[#1c1c1c] group-hover:border-zinc-700">
                  <code>{step.code}</code>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-3 bg-[#050505] rounded-xl border border-[#1f1f1f] text-zinc-500 text-center text-[11px]">
          No intermediate provenance steps recorded.
        </div>
      )}
    </div>
  );
}
