"use client";

import React from "react";
import { Activity, Gauge, Clock, Database, CheckCircle2, ShieldCheck } from "lucide-react";

export default function BenchmarksSection() {
  const qualitativeMetrics = [
    {
      capability: "Repository Text Search",
      scope: "Large Monorepos",
      performance: "Sub-Second Ripgrep Indexing",
      guarantee: "Instant Line Navigation",
    },
    {
      capability: "Git Status Resolution",
      scope: "100k-File Workspaces",
      performance: "Real-Time Diff Parsing",
      guarantee: "Zero Editor Lag",
    },
    {
      capability: "Workspace Snapshotting",
      scope: "Multi-File Buffers",
      performance: "Atomic Serialization",
      guarantee: "Instant Rollback & Pre-Restore Backup",
    },
    {
      capability: "Memory Efficiency",
      scope: "Idle Quiescence",
      performance: "Low Memory Footprint (RSS)",
      guarantee: "0% Idle CPU Usage",
    },
  ];

  return (
    <section className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>ENGINEERING PERFORMANCE &amp; STRESS METRICS</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Engineered for Massive Codebases and Monorepos
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-3xl leading-relaxed">
            NEXUS is built with native process isolation and optimized data structures to ensure low latency and predictable performance on large repositories.
          </p>
        </div>

        {/* Benchmarks Table Card */}
        <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden">
          <div className="px-4 py-3 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
            <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
              Subsystem Performance Characteristics
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
              Quiescent 0% Idle CPU
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f24] bg-[#0d0d12] text-[10.5px] text-zinc-400">
                  <th className="p-3.5 font-bold">Subsystem Capability</th>
                  <th className="p-3.5 font-bold">Tested Scope</th>
                  <th className="p-3.5 font-bold">Performance Metric</th>
                  <th className="p-3.5 font-bold">Engineering Guarantee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181820] text-[11px]">
                {qualitativeMetrics.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#121218] transition-colors">
                    <td className="p-3.5 font-bold text-cyan-300">{row.capability}</td>
                    <td className="p-3.5 text-zinc-300">{row.scope}</td>
                    <td className="p-3.5 text-zinc-200">{row.performance}</td>
                    <td className="p-3.5 text-emerald-400 font-bold">{row.guarantee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-[#09090d] border-t border-[#1f1f24] flex flex-wrap items-center justify-between text-[10px] text-zinc-400 gap-2">
            <span>Platform Support: <strong className="text-zinc-200">Native macOS (Apple Silicon / Intel), Windows, and Linux</strong></span>
            <span>Safety Guarantee: <strong className="text-cyan-400">Instant Rollback &amp; Atomic Checkpoints</strong></span>
          </div>
        </div>

      </div>
    </section>
  );
}
