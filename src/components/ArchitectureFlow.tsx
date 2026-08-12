"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Cpu, GitBranch, ShieldCheck, Share2, Eye, ChevronRight, Activity } from "lucide-react";

export default function ArchitectureFlow() {
  const [activeStep, setActiveStep] = useState(1);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    setLatency(0);
    const interval = setInterval(() => {
      setLatency((prev) => {
        if (prev >= 48) {
          clearInterval(interval);
          return 48;
        }
        return prev + 6;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [activeStep]);

  const pipelineSteps = [
    {
      id: 1,
      title: "VS Code Extension",
      tag: "TypeScript + LSP",
      description: "Interprets active files, renders ghost opacities inline, and exposes action buttons for Safe Remove.",
      icon: Terminal,
    },
    {
      id: 2,
      title: "Rust Analysis Engine",
      tag: "Tree-sitter Parser",
      description: "High-performance parser constructing multi-language ASTs and managing incremental cache buffers.",
      icon: Cpu,
    },
    {
      id: 3,
      title: "CFG / DFG Builder",
      tag: "petgraph Causal Graph",
      description: "Derives Control Flow and Data Flow Graphs to evaluate state dependency and reachability.",
      icon: GitBranch,
    },
    {
      id: 4,
      title: "Verification Sandbox",
      tag: "Differential Mutator",
      description: "Executes isolated mutation tests to guarantee 0.0% behavioral change before applying patches.",
      icon: ShieldCheck,
    },
    {
      id: 5,
      title: "Semantic Graph",
      tag: "Tension Engine",
      description: "Computes Tree Edit Distances to detect cross-repository duplicate semantic logic clusters.",
      icon: Share2,
    },
    {
      id: 6,
      title: "Visualization",
      tag: "D3 Heatmap & Replay",
      description: "Renders force-directed tension graphs, heatmaps, and step-by-step provenance replay logs.",
      icon: Eye,
    },
  ];

  return (
    <section className="py-24 bg-[#000000] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>PIPELINE ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight">
            High-Throughput Analysis Pipeline
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            From raw source code to verified AST surgery, operating completely locally in under 5 seconds.
          </p>
        </div>

        {/* Animated Horizontal Progress Bar Container */}
        <div className="relative mb-8">
          {/* Background Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-[#1f1f1f] -translate-y-1/2 z-0" />
          
          {/* Active Glowing Line Progress */}
          <motion.div
            className="hidden lg:block absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 -translate-y-1/2 z-0 shadow-cyan-glow"
            animate={{ width: `${(activeStep / 6) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          {/* Animated Data Packets */}
          <motion.div
            className="hidden lg:block absolute top-1/2 w-3 h-3 rounded-full bg-cyan-400 -translate-y-1/2 z-10 shadow-[0_0_12px_rgba(34,211,238,0.9)]"
            animate={{ x: [`${((activeStep - 1) / 6) * 100}%`, `${(activeStep / 6) * 100}%`] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Pipeline Steps Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
            {pipelineSteps.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;

              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  onMouseEnter={() => setActiveStep(step.id)}
                  className={`w-full p-4 rounded-24 text-left transition-all duration-300 flex flex-col justify-between h-full border ${
                    isActive
                      ? "bg-[#111111] border-cyan-400 shadow-cyan-glow scale-[1.03]"
                      : "bg-[#0a0a0a] border-[#1f1f1f] hover:border-zinc-700"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-cyan-400">
                        0{step.id}
                      </span>
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? "text-cyan-400" : "text-zinc-500"
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-heading font-bold text-white leading-tight">
                        {step.title}
                      </h4>
                      <p className="text-[10px] font-mono text-zinc-400 mt-1">
                        {step.tag}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Morphing Stage Details Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl"
          >
            <div className="space-y-1">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
                Stage 0{activeStep} Active Detail: {pipelineSteps[activeStep - 1].title}
              </span>
              <p className="text-sm text-zinc-300 leading-relaxed font-body">
                {pipelineSteps[activeStep - 1].description}
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs text-zinc-400 shrink-0 bg-[#141414] px-4 py-2.5 rounded-xl border border-[#262626]">
              <span>Stage Latency: <strong className="text-cyan-400">{latency}ms</strong></span>
              <span>•</span>
              <span className="text-emerald-400">Zero IPC Overhead</span>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
