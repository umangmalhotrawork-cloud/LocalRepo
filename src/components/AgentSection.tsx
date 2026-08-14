"use client";

import React from "react";
import { Bot, Shield, Compass, Sparkles, Check, ArrowRight, Layers, FileCode } from "lucide-react";

export default function AgentSection() {
  const agentCapabilities = [
    {
      title: "Autonomous Multi-Step Task Planner",
      desc: "Breaks complex refactoring prompts into ordered, executable milestones with live reasoning streams and task status tracking.",
      badge: "Agent Mode (⌘⇧I)",
    },
    {
      title: "Semantic Patch Firewall",
      desc: "Evaluates incoming AI-generated code patches against AST behavioral rules, blocking unconstrained state side-effects.",
      badge: "Taint Analysis",
    },
    {
      title: "Semantic Intent Radar",
      desc: "Quantifies drift between developer natural language intent and generated AST mutations to prevent silent functional divergence.",
      badge: "Drift Metric",
    },
    {
      title: "Granular Step-by-Step Reversibility",
      desc: "Inspect live diff previews for each agent modification before applying, with instantaneous single-step rollback support.",
      badge: "Undo Engine",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            <Bot className="w-3 h-3 text-purple-400" />
            <span>AUTONOMOUS AI AGENT &amp; FIREWALL</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Autonomous Multi-Step Planning With Built-In Safety Firewalls.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Delegate multi-file architectural changes to an autonomous agent wrapped in a mathematical patch firewall to eliminate hallucinations and unwanted side-effects.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Cards Grid */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agentCapabilities.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-purple-950/60 border border-purple-500/30 text-purple-300">
                    {item.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Simulated Agent Panel */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">AI Agent Execution Plan</span>
              </div>
              <span className="px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                Running Step 2/3
              </span>
            </div>

            <div className="p-4 space-y-3 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-zinc-300 font-bold">1. Refactor cart_calculator.py</span>
                  <span className="text-emerald-400 font-bold">PASSED</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Eliminated 2 ghost identity arithmetic statements.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/40 space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-purple-300 font-bold">2. Update test_cart.py assertion suite</span>
                  <span className="text-purple-400 font-bold animate-pulse">EXECUTING...</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Verifying differential equivalence against mutation sandbox.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] opacity-50 space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-zinc-400 font-bold">3. Re-run coverage and profiler check</span>
                  <span className="text-zinc-500">QUEUED</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Patch Firewall: <strong className="text-emerald-400">0 Violations</strong></span>
              <span>Intent Drift: <strong className="text-cyan-400">0.00%</strong></span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
