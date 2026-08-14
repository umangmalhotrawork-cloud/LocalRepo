"use client";

import React from "react";
import { Flame, Cpu, Database, Activity, Layers, Download, Check } from "lucide-react";

export default function ProfilerSection() {
  const profilerFeatures = [
    {
      title: "Python CPU & Memory Tracing",
      desc: "Built-in integration with cProfile and tracemalloc on Native Python 3 with Pyodide WebAssembly fallback.",
      badge: "cProfile / tracemalloc",
    },
    {
      title: "React Component Render Profiler",
      desc: "Measures component render counts and durations to identify unnecessary re-render cascades and layout freezes.",
      badge: "Render Metrics",
    },
    {
      title: "Interactive Timeline Flame-Charts",
      desc: "Visual horizontal execution bars charting function lifetimes and asynchronous delays with microsecond resolution.",
      badge: "Flame-Chart",
    },
    {
      title: "Monaco Amber Slow-Line Markers",
      desc: "Slow instructions and excessive memory allocators are flagged with inline amber highlights and exportable reports (JSON/Markdown).",
      badge: "Editor Decorations",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>PERFORMANCE PROFILER (CPU + MEMORY + REACT)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Identify Hot Paths, Memory Leaks, and Render Bottlenecks.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Execute local profiling for CPU execution, memory allocations, JavaScript timing, and React renders with zero cloud overhead.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profilerFeatures.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-amber-950/60 border border-amber-500/30 text-amber-300">
                    {item.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Profiler Panel Mockup */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">Performance Profiler</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400">Total: <strong className="text-zinc-200">0.128ms</strong></span>
                <span className="text-[10px] text-zinc-400">Peak: <strong className="text-amber-300">512.8 KB</strong></span>
              </div>
            </div>

            <div className="p-4 space-y-2.5 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                  <span>Function</span>
                  <span>Calls</span>
                  <span>Total Time</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#121216]">
                    <span className="text-amber-300 font-bold">calculate_total()</span>
                    <span className="text-zinc-400">120</span>
                    <span className="text-amber-400 font-bold">0.084ms (65%)</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#121216]">
                    <span className="text-zinc-300">apply_discount_tier()</span>
                    <span className="text-zinc-400">120</span>
                    <span className="text-zinc-300">0.028ms (22%)</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#121216]">
                    <span className="text-zinc-400">validate_cart_items()</span>
                    <span className="text-zinc-400">120</span>
                    <span className="text-zinc-400">0.016ms (13%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Runtime: <strong className="text-zinc-200">Native Python 3 + Pyodide Fallback</strong></span>
              <span className="text-emerald-400 font-bold">Export JSON &amp; Markdown Report</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
