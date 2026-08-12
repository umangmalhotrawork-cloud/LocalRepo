"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Terminal, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import TiltCard from "@/components/ui/TiltCard";

export default function Hero() {
  const concepts = [
    "Causal Code Tomography Engine",
    "Ghost Code Detection System",
    "Semantic Tension Mapping",
    "Safe Remove AST Surgery Protocol",
  ];

  const [conceptIndex, setConceptIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setConceptIndex((prev) => (prev + 1) % concepts.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [concepts.length]);

  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Headline & Controls */}
          <div className="lg:col-span-7 space-y-8 text-left">
            
            {/* Animated Rotating Concept Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={conceptIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {concepts[conceptIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-heading font-extrabold tracking-[-0.04em] text-white leading-[1.05]">
              Find code that runs, passes tests, and{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent underline decoration-cyan-500/40 decoration-wavy decoration-2">
                still means nothing.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-zinc-400 leading-8 max-w-2xl font-body">
              <strong className="text-zinc-200 font-semibold">Echo Nullity</strong> detects semantically vacuous code in AI-generated software, visualizes ghost logic, and safely removes redundant behavior without changing program output.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/demo"
                className="group relative inline-flex items-center gap-2.5 px-7 py-4 text-sm font-semibold text-black bg-cyan-400 hover:bg-cyan-300 rounded-full shadow-cyan-glow transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              >
                <Sparkles className="w-4 h-4 fill-black group-hover:rotate-12 transition-transform" />
                <span>View Interactive Demo</span>
              </Link>

              <Link
                href="/research"
                className="inline-flex items-center gap-2.5 px-7 py-4 text-sm font-medium text-zinc-300 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1f1f1f] hover:border-cyan-500/40 rounded-full transition-all duration-200 hover:text-white"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Read the Research</span>
              </Link>
            </div>

            {/* Floating Metric Chips */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#181818] max-w-xl font-mono text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Luminance: 0.00</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Ghost Lines: 2</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Rollback: Verified</span>
              </div>
            </div>

          </div>

          {/* Right Column: Floating 3D Tilt VS Code Mockup */}
          <div className="lg:col-span-5 relative">
            <TiltCard>
              {/* Glow backdrop */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-purple-600/30 rounded-3xl blur-2xl opacity-70 animate-pulse-slow pointer-events-none" />

              {/* VS Code Window Container */}
              <div className="relative rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] shadow-2xl overflow-hidden font-mono text-xs">
                {/* Titlebar */}
                <div className="px-4 py-3 bg-[#0d0d0d] border-b border-[#1f1f1f] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-zinc-400 text-[11px]">cart_engine.py — VS Code</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                    <span>TOMOGRAPHY ACTIVE</span>
                  </div>
                </div>

                {/* Editor Workspace Content */}
                <div className="p-5 space-y-2 text-zinc-300 leading-relaxed bg-[#050505] min-h-[200px]">
                  {/* Code line 1 */}
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-600 select-none w-4 text-right">1</span>
                    <span>
                      <span className="text-purple-400 font-semibold">def</span>{" "}
                      <span className="text-blue-400 font-semibold">calculate</span>(
                      <span className="text-orange-300">price</span>):
                    </span>
                  </div>

                  {/* Ghost line 2 */}
                  <div className="flex items-center gap-4 bg-cyan-950/30 -mx-5 px-5 py-1 border-l-2 border-cyan-400/80 group relative">
                    <span className="text-cyan-500 select-none w-4 text-right">2</span>
                    <span className="opacity-25 text-zinc-300 line-through decoration-cyan-400/60 group-hover:opacity-90 transition-opacity">
                      temp = price * 1
                    </span>
                    <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      Luminance: 0.00
                    </span>
                  </div>

                  {/* Ghost line 3 */}
                  <div className="flex items-center gap-4 bg-cyan-950/30 -mx-5 px-5 py-1 border-l-2 border-cyan-400/80 group relative">
                    <span className="text-cyan-500 select-none w-4 text-right">3</span>
                    <span className="opacity-25 text-zinc-300 line-through decoration-cyan-400/60 group-hover:opacity-90 transition-opacity">
                      temp = temp + 0
                    </span>
                    <span className="ml-auto text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/40">
                      Ghost Code
                    </span>
                  </div>

                  {/* Code line 4 with blinking cursor */}
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-600 select-none w-4 text-right">4</span>
                    <span className="flex items-center">
                      <span className="text-purple-400 font-semibold">return</span>{" "}
                      <span className="text-orange-300 ml-1">price</span>
                      <span className="w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
                    </span>
                  </div>
                </div>

                {/* Provenance Card Overlay */}
                <div className="p-4 bg-[#0d0d0d] border-t border-[#1f1f1f] flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white font-sans text-xs font-semibold">Vacuous Identity Chain</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Lines 2–3 exert zero causal leverage over return state space.
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/40 font-mono">
                    SAFE REMOVE READY
                  </span>
                </div>
              </div>
            </TiltCard>
          </div>

        </div>
      </div>
    </section>
  );
}
