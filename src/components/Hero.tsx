"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Download, CheckCircle2, ShieldCheck, 
  Bot, Bug, Flame, ShieldAlert, History, FileCode 
} from "lucide-react";

export default function Hero() {
  const concepts = [
    "Autonomous AI Agent Execution",
    "Time Travel Debugger v2 Replay",
    "Real-Time CPU & Memory Profiler",
    "Zero-Trust Security & CVE Audit",
    "Workspace Snapshots & Safe Rollback",
    "Causal Code Tomography Engine",
  ];

  const [conceptIndex, setConceptIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setConceptIndex((prev) => (prev + 1) % concepts.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [concepts.length]);

  return (
    <section className="relative pt-8 pb-14 md:pt-12 md:pb-20 overflow-hidden border-b border-[#1f1f24] bg-[#050508]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Headline & Controls */}
          <div className="lg:col-span-6 space-y-5 text-left font-mono">
            
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={conceptIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold tracking-wider uppercase text-[10.5px]"
                >
                  {concepts[conceptIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight text-white leading-[1.15]">
              The Local-First AI Desktop IDE Built to{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent underline decoration-cyan-500/40 decoration-2">
                Purify, Debug, & Secure
              </span>{" "}
              Your Codebase.
            </h1>

            {/* Subheadline */}
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans max-w-xl">
              Echo Nullity combines high-performance Monaco editing with autonomous AI agent execution, time-travel debugging, real-time CPU/memory profiling, security vulnerability auditing, and verified AST surgery — 100% private, offline, and native on macOS, Windows, and Linux.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="#downloads"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download Beta (Universal)</span>
              </Link>

              <Link
                href="/demo"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141418] hover:bg-[#1f1f24] border border-[#26262e] text-zinc-300 hover:text-white font-medium text-xs transition-all"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Launch Interactive Demo</span>
              </Link>
            </div>

            {/* Trust Metric Chips */}
            <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#181820] max-w-xl text-[10.5px]">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] text-cyan-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Local-First: 0% Telemetry</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>47/47 Tests Passing</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] text-purple-400 font-bold">
                <History className="w-3.5 h-3.5" />
                <span>Rollback: &lt;0.4s</span>
              </div>
            </div>

          </div>

          {/* Right Column: Framed Desktop IDE Workspace Preview */}
          <div className="lg:col-span-6 relative">
            <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] shadow-2xl overflow-hidden font-mono text-xs">
              
              {/* Window Titlebar */}
              <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-zinc-400 text-[10px] pl-2">ai_cart_project — cart_calculator.py</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9.5px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 font-bold">
                  <span>TOMOGRAPHY ACTIVE</span>
                </div>
              </div>

              {/* IDE Secondary Toolbar Tabs */}
              <div className="h-8 bg-[#0a0a0d] border-b border-[#1f1f24] flex items-center px-2 gap-1 overflow-x-auto">
                <span className="px-2.5 py-1 rounded bg-[#151520] text-cyan-300 border border-cyan-500/40 text-[10.5px] font-bold flex items-center gap-1">
                  <FileCode className="w-3 h-3 text-cyan-400" />
                  <span>cart_calculator.py</span>
                </span>
                <span className="px-2 py-1 rounded text-zinc-400 text-[10.5px] hover:text-zinc-200 flex items-center gap-1">
                  <Bot className="w-3 h-3 text-purple-400" />
                  <span>Agent</span>
                </span>
                <span className="px-2 py-1 rounded text-zinc-400 text-[10.5px] hover:text-zinc-200 flex items-center gap-1">
                  <Bug className="w-3 h-3 text-emerald-400" />
                  <span>Debugger</span>
                </span>
                <span className="px-2 py-1 rounded text-zinc-400 text-[10.5px] hover:text-zinc-200 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Profiler</span>
                </span>
                <span className="px-2 py-1 rounded text-zinc-400 text-[10.5px] hover:text-zinc-200 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span>Security</span>
                </span>
              </div>

              {/* Editor Workspace Content with Monaco-style Line Numbers & Highlights */}
              <div className="p-4 space-y-1.5 text-zinc-300 leading-relaxed bg-[#050508] min-h-[200px]">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 select-none w-4 text-right">1</span>
                  <span><span className="text-purple-400 font-semibold">def</span> <span className="text-blue-400 font-semibold">calculate_total</span>(cart, user_tier):</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 select-none w-4 text-right">2</span>
                  <span>&nbsp;&nbsp;&nbsp;&nbsp;base_price = sum(item.price <span className="text-purple-400">for</span> item <span className="text-purple-400">in</span> cart)</span>
                </div>
                {/* Ghost line */}
                <div className="flex items-center gap-3 bg-cyan-950/40 -mx-4 px-4 py-0.5 border-l-2 border-cyan-400">
                  <span className="text-cyan-400 select-none w-4 text-right">3</span>
                  <span className="opacity-40 line-through text-zinc-200 decoration-cyan-400">&nbsp;&nbsp;&nbsp;&nbsp;temp_calc = base_price * 1.0</span>
                  <span className="ml-auto text-[9.5px] text-cyan-300 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-500/40 font-bold">
                    Luminance: 0.00
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 select-none w-4 text-right">4</span>
                  <span>&nbsp;&nbsp;&nbsp;&nbsp;discount = 0.15 <span className="text-purple-400">if</span> user_tier == <span className="text-amber-300">&quot;VIP&quot;</span> <span className="text-purple-400">else</span> 0.0</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 select-none w-4 text-right">5</span>
                  <span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400 font-semibold">return</span> base_price * (1 - discount)</span>
                </div>
              </div>

              {/* Status Bar */}
              <div className="h-6 bg-[#09090d] border-t border-[#1f1f24] px-3 flex items-center justify-between text-[10px] text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-cyan-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>main</span>
                  </span>
                  <span>UTF-8</span>
                  <span>Python 3.11</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">0 errors</span>
                  <span>Idle Quiescent: 0% CPU</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
