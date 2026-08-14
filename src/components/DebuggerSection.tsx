"use client";

import React from "react";
import { Bug, Play, RotateCcw, ArrowRight, ArrowLeft, Activity, Layers, FileCode } from "lucide-react";

export default function DebuggerSection() {
  const debugFeatures = [
    {
      title: "Step Backward Replay (Shift+F10)",
      desc: "Never restart a debug session because you stepped past a bug. Step backward seamlessly through past instructions and variable states.",
      badge: "Reversible Replay",
    },
    {
      title: "Variable Mutation Timeline",
      desc: "Inspect localized variable histories across loop iterations and recursive invocations without setting ad-hoc loggers.",
      badge: "Local State Snapshots",
    },
    {
      title: "Interactive Call Graph",
      desc: "Visual node graph mapping intra-procedural flow, function invocations, branches, and return sinks in real time.",
      badge: "petgraph Powered",
    },
    {
      title: "Zero-Latency Local Execution",
      desc: "Fast in-memory trace capture on Python 3 and Pyodide runtimes with instant state lookups.",
      badge: "Native Tracing",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
            <Bug className="w-3 h-3 text-emerald-400" />
            <span>TIME TRAVEL DEBUGGER V2</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Step Forward, Step Backward, and Replay Execution History.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Record full execution traces and navigate through program state in both directions without restarting the application.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Feature Cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {debugFeatures.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                    {item.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Debugger Window Mockup */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">Debugger Trace Replay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.2 rounded bg-[#151520] text-zinc-300 text-[10px] font-bold">Step 4 / 8</span>
                <span className="px-2 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                  PAUSED
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-2">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Local Variables (Frame #2)</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-[#121216] border border-[#1c1c24]">
                    <span className="text-zinc-400">cart_items:</span> <span className="text-cyan-300 font-bold">3 objects</span>
                  </div>
                  <div className="p-2 rounded bg-[#121216] border border-[#1c1c24]">
                    <span className="text-zinc-400">base_price:</span> <span className="text-emerald-300 font-bold">149.50</span>
                  </div>
                  <div className="p-2 rounded bg-[#121216] border border-[#1c1c24]">
                    <span className="text-zinc-400">user_tier:</span> <span className="text-amber-300 font-bold">&quot;VIP&quot;</span>
                  </div>
                  <div className="p-2 rounded bg-[#121216] border border-[#1c1c24]">
                    <span className="text-zinc-400">discount:</span> <span className="text-purple-300 font-bold">0.15</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] text-[10.5px]">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Controls:</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-zinc-300">Shift+F10 Back</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-zinc-300">F10 Step</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-zinc-300">F5 Resume</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Call Stack: <strong className="text-zinc-200">calculate_total() &rarr; cart_calculator.py:24</strong></span>
              <span className="text-emerald-400 font-bold">Trace Sync: 100%</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
