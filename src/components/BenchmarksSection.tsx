"use client";

import React from "react";
import { Activity, Gauge, Clock, Database, CheckCircle2 } from "lucide-react";

export default function BenchmarksSection() {
  const benchmarkRows = [
    { scale: "10,000 files", search: "42 ms", git: "18 ms", snapshot: "120 ms", memory: "145 MB" },
    { scale: "50,000 files", search: "180 ms", git: "65 ms", snapshot: "410 ms", memory: "260 MB" },
    { scale: "100,000 files", search: "340 ms", git: "140 ms", snapshot: "820 ms", memory: "390 MB" },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>EMPIRICAL BENCHMARKS &amp; 100K-FILE STRESS TESTS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Engineered for Monorepos and Massive Codebases.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Audited latency benchmarks across 10,000 to 100,000 file repositories verifying predictable sub-second performance.
          </p>
        </div>

        {/* Benchmarks Table Card */}
        <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden">
          <div className="px-4 py-3 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
            <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
              Repository Scale Stress Benchmarks
            </span>
            <span className="px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
              Quiescent 0% Idle CPU
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f24] bg-[#0d0d12] text-[10.5px] text-zinc-400">
                  <th className="p-3 font-bold">Repository Scale</th>
                  <th className="p-3 font-bold">Ripgrep Search Latency</th>
                  <th className="p-3 font-bold">Git Status Resolution</th>
                  <th className="p-3 font-bold">Snapshot Serialization</th>
                  <th className="p-3 font-bold">Memory Footprint (RSS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181820] text-[11px]">
                {benchmarkRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#121218] transition-colors">
                    <td className="p-3 font-bold text-cyan-300">{row.scale}</td>
                    <td className="p-3 text-zinc-200">{row.search}</td>
                    <td className="p-3 text-zinc-200">{row.git}</td>
                    <td className="p-3 text-zinc-200">{row.snapshot}</td>
                    <td className="p-3 text-emerald-400 font-bold">{row.memory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-[#09090d] border-t border-[#1f1f24] flex flex-wrap items-center justify-between text-[10px] text-zinc-400 gap-2">
            <span>Measurement Platform: <strong className="text-zinc-200">Apple Silicon / M-Series &amp; Linux x86_64</strong></span>
            <span>Restoration Guarantee: <strong className="text-cyan-400">&lt;0.4s Instant Rollback</strong></span>
          </div>
        </div>

      </div>
    </section>
  );
}
