"use client";

import React from "react";
import { CheckCircle2, XCircle, Play, Layers, FileCode, Check, BarChart2 } from "lucide-react";

export default function TestExplorerSection() {
  const testFeatures = [
    {
      title: "Multi-Framework Auto-Discovery",
      desc: "Instantly scans your workspace to discover tests across Python pytest, unittest, and JS/TS Jest, Vitest.",
      badge: "4 Frameworks",
    },
    {
      title: "Line-Level Coverage Gutters",
      desc: "Live green and red gutter markers directly in Monaco showing executed versus missed branches.",
      badge: "Live Heatmap",
    },
    {
      title: "Inline Assertion Diagnostics",
      desc: "Extracts assertion errors and diff snippets directly into editor tooltips and failure summaries.",
      badge: "Instant Diagnostics",
    },
    {
      title: "Single-Click Test & Suite Execution",
      desc: "Run individual test methods, test files, or the entire repository test suite with instant status updates.",
      badge: "Sub-Second Runs",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>TEST EXPLORER &amp; COVERAGE DASHBOARD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Automated Test Discovery and Line-Level Coverage.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Discover, execute, and visualize test results and code coverage across Python and TypeScript in a unified test tree.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {testFeatures.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                    {item.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Test Explorer Panel Mockup */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">Test Explorer &amp; Coverage</span>
              </div>
              <span className="px-2 py-0.2 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-[9.5px] font-bold">
                14/14 Tests Passed (100%)
              </span>
            </div>

            <div className="p-4 space-y-2.5 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-200 font-bold">tests/test_cart_calculator.py</span>
                </div>
                <span className="text-zinc-400">8 tests (18ms)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-200 font-bold">tests/test_coupon_service.py</span>
                </div>
                <span className="text-zinc-400">6 tests (12ms)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-zinc-300 font-bold">Workspace Coverage</span>
                  <span className="text-emerald-400 font-bold">92.4% Covered</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#151520] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full w-[92%]" />
                </div>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Framework: <strong className="text-zinc-200">pytest (Python 3.11)</strong></span>
              <span>Total Duration: <strong className="text-cyan-400">30ms</strong></span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
