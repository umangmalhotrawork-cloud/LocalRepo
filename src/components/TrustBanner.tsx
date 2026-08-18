"use client";

import React from "react";
import { ShieldCheck, Cpu, CheckCircle2, Lock, Terminal, Activity } from "lucide-react";

export default function TrustBanner() {
  const trustItems = [
    {
      icon: ShieldCheck,
      title: "100% Local-First Workspace",
      desc: "Your local workspace is authoritative. Code never leaves your machine without explicit permission.",
      badge: "Authoritative Local",
      badgeColor: "text-cyan-300 bg-cyan-950/80 border-cyan-500/40",
    },
    {
      icon: CheckCircle2,
      title: "Behavior Verification",
      desc: "Code modifications evaluated against behavioral fingerprints and AST rules via AI Patch Firewall.",
      badge: "Verified Execution",
      badgeColor: "text-emerald-300 bg-emerald-950/80 border-emerald-500/40",
    },
    {
      icon: Lock,
      title: "Continuum Memory",
      desc: "Preserves session context, engineering decisions, and pending work via SHA-256 verified capsules.",
      badge: "Context Handoff",
      badgeColor: "text-purple-300 bg-purple-950/80 border-purple-500/40",
    },
    {
      icon: Activity,
      title: "Offline Agent Fallback",
      desc: "AI assistance without mandatory cloud dependence through deterministic offline fallback execution.",
      badge: "Cloud Independent",
      badgeColor: "text-amber-300 bg-amber-950/80 border-amber-500/40",
    },
  ];

  return (
    <section className="py-8 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {trustItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-[#141418] border border-[#24242e] flex items-center justify-center text-cyan-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`px-2 py-0.2 rounded-full text-[9.5px] font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-xs">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed mt-1">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
