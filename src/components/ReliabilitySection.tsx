"use client";

import React from "react";
import { History, RotateCcw, ShieldCheck, Clock, Layers, Camera, Check, FileText, Activity, AlertCircle } from "lucide-react";

export default function ReliabilitySection() {
  const reliabilityFeatures = [
    {
      title: "Named Checkpoints (⌘⇧B)",
      desc: "Create instant atomic snapshots before major code refactors with open tab, dirty buffer, and cursor position restoration.",
      badge: "Atomic Storage",
    },
    {
      title: "Side-by-Side Diff Modal",
      desc: "Compare snapshot buffers against current disk state with unified line additions, single-file restores, and patch copies.",
      badge: "Diff Inspector",
    },
    {
      title: "Safe Rollback & Pre-Restore Backup",
      desc: "Restore single files or roll back entire workspaces with automatic safety backups preventing data loss (<0.4s restoration).",
      badge: "<0.4s Rollback",
    },
    {
      title: "Crash Diagnostics & Rotating Logs",
      desc: "5MB rotating structured logger (5 backups), automatic crash reports with heap dumps, and startup health checks on boot.",
      badge: "Production Hardened",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <History className="w-3 h-3 text-cyan-400" />
            <span>WORKSPACE SNAPSHOTS &amp; CRASH RECOVERY</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Named Checkpoints, Instant Rollback, and Session Persistence.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Protect your working state with atomic workspace snapshots, automatic pre-restore safety backups, rotating structured logs, and crash recovery.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reliabilityFeatures.map((item, idx) => (
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

          {/* Right Snapshots & Recovery Panel Mockup */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">Workspace Snapshots &amp; Diagnostics</span>
              </div>
              <span className="px-2 py-0.2 rounded-full bg-[#151520] text-zinc-300 text-[9.5px]">
                Storage: ~/Library/Application Support/echo-nullity/
              </span>
            </div>

            <div className="p-4 space-y-2 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-cyan-500/40 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-300 font-bold">Manual: Pre-Refactor Checkpoint (en_20260814_152010)</span>
                  <span className="text-zinc-400">2 min ago</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                  <span className="text-emerald-400">+1 Added</span>
                  <span className="text-amber-400">~1 Modified</span>
                  <span className="text-zinc-500">-0 Deleted</span>
                  <span className="text-cyan-400">Diff Modal Ready</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-bold">Auto Checkpoint: Before AI Agent Edit</span>
                  <span className="text-zinc-500">14 min ago</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>~2 Modified • Automatic Pre-Restore Backup Armed</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0a0d] border border-[#1f1f24] space-y-1 text-[10.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>Startup Health Check: All 6 Diagnostics Passed</span>
                  </span>
                  <span className="text-emerald-400 font-bold text-[9.5px]">HEALTHY</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Snapshot Store (OK), Recovery Store (OK), PTY (OK), Git (OK), Python3 (OK), Memory (OK)</p>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Auto-Prune: <strong className="text-zinc-200">Max 20 Retained</strong></span>
              <span className="text-emerald-400 font-bold">5MB Rotating Logger: Active</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
