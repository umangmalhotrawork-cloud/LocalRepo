"use client";

import React from "react";
import { History, Layers, ShieldCheck, FileCheck, ArrowRight, Database, Lock, Cpu, Sparkles } from "lucide-react";

export default function ContinuumSection() {
  const continuumCapabilities = [
    {
      title: "Curated Session Snapshots",
      desc: "Stores project state, important files, key engineering decisions, and pending tasks in high-density structured snapshots.",
      badge: "Session Memory",
    },
    {
      title: "Portable Nexus Capsules",
      desc: "Export and import project context as portable capsules (.capsule) to hand off complete engineering context to fresh AI sessions.",
      badge: "Capsule Handoff",
    },
    {
      title: "SHA-256 Integrity Verification",
      desc: "Cryptographic hash validation guarantees capsule contents are uncorrupted and tamper-evident across environment transfers.",
      badge: "SHA-256 Verified",
    },
    {
      title: "Automated Secret Sanitization",
      desc: "Filters API keys, tokens, and private credentials before serializing context handoff payloads.",
      badge: "Sanitized",
    },
    {
      title: "Recent-Turn Continuity",
      desc: "Tracks recent execution turns and decision history so new sessions resume instantly without context degradation.",
      badge: "Turn State",
    },
    {
      title: "Verification State Preservation",
      desc: "Retains evidence-backed status (Implemented, Verified, Blocked) so engineering intent remains clear across sessions.",
      badge: "Truth Boundary",
    },
  ];

  return (
    <section id="continuum" className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>CONTINUUM SESSION MEMORY</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight leading-tight">
            &quot;Your work should not disappear when the context window does.&quot;
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-3xl leading-relaxed">
            NEXUS preserves curated project context across long engineering sessions. Through structured session snapshots and portable Nexus Capsules, your engineering decisions, pending tasks, file states, and verification evidence persist seamlessly — even when starting a fresh AI conversation.
          </p>
        </div>

        {/* Grid of Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {continuumCapabilities.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-950/60 border border-purple-500/30 text-purple-300">
                    {item.badge}
                  </span>
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <h3 className="font-bold text-zinc-100 text-sm pt-1">{item.title}</h3>
                <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Capsule Visualizer Card */}
        <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f1f24]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-zinc-100 text-xs uppercase tracking-wider">
                Nexus Capsule Inspector
              </span>
            </div>
            <span className="text-[10px] text-purple-300 bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-500/40 font-bold">
              Curated Context Handoff Engine
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-[11px] font-sans">
            <div className="p-3.5 rounded-lg bg-[#050508] border border-[#181820] space-y-1.5 font-mono">
              <div className="text-purple-400 font-bold text-xs">1. Curated Context Payload</div>
              <ul className="space-y-1 text-zinc-400 text-[10.5px]">
                <li>• Project Architecture Summary</li>
                <li>• Important Modified Files</li>
                <li>• Key Engineering Decisions</li>
                <li>• Pending Work Milestones</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg bg-[#050508] border border-[#181820] space-y-1.5 font-mono">
              <div className="text-cyan-400 font-bold text-xs">2. Integrity &amp; Sanitization</div>
              <ul className="space-y-1 text-zinc-400 text-[10.5px]">
                <li>• SHA-256 Checksum: <code className="text-zinc-300">e3b0c442...</code></li>
                <li>• Secret Sanitization: Active</li>
                <li>• Handoff Instructions Included</li>
                <li>• Tamper-Evident Verification</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg bg-[#050508] border border-[#181820] space-y-1.5 font-mono">
              <div className="text-emerald-400 font-bold text-xs">3. Fresh Session Resume</div>
              <ul className="space-y-1 text-zinc-400 text-[10.5px]">
                <li>• Zero context window memory loss</li>
                <li>• Immediate continuation</li>
                <li>• Preserved verification states</li>
                <li>• Portable across environments</li>
              </ul>
            </div>
          </div>

          <div className="pt-2 text-[10.5px] text-zinc-500 font-sans italic flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Note: Continuum preserves structured engineering state and handoff instructions. It intentionally avoids storing raw unconstrained LLM transcripts or hidden model chain-of-thought.</span>
          </div>
        </div>

      </div>
    </section>
  );
}
