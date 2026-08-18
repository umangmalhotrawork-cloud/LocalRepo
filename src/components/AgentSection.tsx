"use client";

import React from "react";
import { Bot, Shield, Compass, Sparkles, Check, ArrowRight, Layers, FileCode } from "lucide-react";

export default function AgentSection() {
  const agentCapabilities = [
    {
      title: "Autonomous Task Planning & Execution",
      desc: "Formulates structured engineering plans, breaks complex prompts into executable steps, and performs controlled multi-file code changes.",
      badge: "Agent Mode (⌘⇧I)",
    },
    {
      title: "AI Patch Firewall",
      desc: "Evaluates proposed AI code modifications against AST rules and behavioral constraints before touching disk.",
      badge: "Patch Firewall",
    },
    {
      title: "Truth Boundary Enforcement",
      desc: "Distinguishes evidence-backed status (Implemented, Verified) from unverified steps (Planned, Blocked, Unknown).",
      badge: "Truth Boundary",
    },
    {
      title: "Deterministic Offline Fallback",
      desc: "Ensures AI task execution remains functional via deterministic offline agent fallback when cloud connectivity is unavailable.",
      badge: "Offline Fallback",
    },
  ];

  return (
    <section className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>AUTONOMOUS AGENT &amp; FIREWALL</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Autonomous AI Execution with Built-In Safety Firewalls
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-3xl leading-relaxed">
            Delegate multi-file engineering tasks to an autonomous agent wrapped in an AI Patch Firewall, Monaco editor integration, native PTY terminal, and Truth Boundary enforcement.
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
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">NEXUS Agent Execution Stream</span>
              </div>
              <span className="px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                Step 2/3: VERIFIED
              </span>
            </div>

            <div className="p-4 space-y-3 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-zinc-300 font-bold">1. Understand Codebase &amp; Build BDG</span>
                  <span className="text-emerald-400 font-bold">VERIFIED</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Mapped 24 module dependencies and call boundaries.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/40 space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-purple-300 font-bold">2. Apply Controlled AST Patch</span>
                  <span className="text-purple-400 font-bold animate-pulse">FIREWALL PASS</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">0 Taint violations. Behavioral equivalence check passed.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] opacity-50 space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-zinc-400 font-bold">3. Nexus Capsule Snapshot</span>
                  <span className="text-zinc-500">QUEUED</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Patch Firewall: <strong className="text-emerald-400">0 Violations</strong></span>
              <span>Truth State: <strong className="text-cyan-400">VERIFIED</strong></span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
