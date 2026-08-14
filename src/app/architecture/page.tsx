"use client";

import React, { useState } from "react";
import { Cpu, Terminal, GitBranch, ShieldCheck, Layers, FileCode, Check, Copy, Bot, Bug, Flame, ShieldAlert, History } from "lucide-react";
import Link from "next/link";

export default function ArchitecturePage() {
  const [activeTab, setActiveTab] = useState<"desktop" | "pipeline" | "managers">("desktop");

  const coreLayers = [
    {
      title: "1. Electron Main Process",
      desc: "Controls window lifecycle, native PTY terminal spawning, atomic snapshot serialization, file watcher events, and OS crash diagnostics.",
      file: "desktop/electron/main.js",
      badge: "Main Process",
    },
    {
      title: "2. Preload Security Bridge",
      desc: "Exposes safe contextBridge IPC channels to the renderer without disabling Node integration or leaking direct filesystem access.",
      file: "desktop/electron/preload.js",
      badge: "contextBridge",
    },
    {
      title: "3. React / Next.js Renderer",
      desc: "Embeds Microsoft Monaco Editor with multi-tabs, line highlights, test status trees, flame-charts, and split terminal drawers.",
      file: "desktop/renderer/IDEApp.tsx",
      badge: "Monaco UI",
    },
    {
      title: "4. Runtime Execution Layer",
      desc: "Drives native Python 3 time-travel execution, cProfile CPU sampling, tracemalloc tracing, and Pyodide fallback sandboxes.",
      file: "desktop/runtime/pythonDebugger.ts",
      badge: "Runtime Engine",
    },
  ];

  const subsystemManagers = [
    {
      name: "Test Manager",
      file: "desktop/electron/testManager.js",
      desc: "Auto-discovers and runs pytest, unittest, Jest, and Vitest with line-level coverage calculations.",
      icon: Check,
      color: "text-cyan-400",
    },
    {
      name: "Profiler Manager",
      file: "desktop/electron/profilerManager.js",
      desc: "Executes Python cProfile and tracemalloc, JS timing, and React render loop diagnostics.",
      icon: Flame,
      color: "text-amber-400",
    },
    {
      name: "Security Audit Manager",
      file: "desktop/electron/securityAuditManager.js",
      desc: "Scans lockfiles for known CVEs, detects leaked API credentials, and flags risky AST patterns.",
      icon: ShieldAlert,
      color: "text-red-400",
    },
    {
      name: "Snapshot & Rollback Manager",
      file: "desktop/electron/snapshotManager.js",
      desc: "Maintains atomic JSON workspace snapshots with instant <0.4s rollback and safety backups.",
      icon: History,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="py-8 bg-[#050508] min-h-screen font-mono text-xs text-zinc-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.2 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>TECHNICAL ARCHITECTURE SPECIFICATION</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Echo Nullity System Architecture</h1>
          <p className="text-zinc-400 text-xs font-sans">
            Detailed engineering breakdown of the standalone desktop application and analysis engines.
          </p>
        </div>

        {/* 4 Core Layers */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Multi-Tier Desktop Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {coreLayers.map((layer, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    {layer.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{layer.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{layer.desc}</p>
                </div>
                <div className="pt-2 border-t border-[#181820] text-[10px] text-zinc-500 font-mono">
                  <code>{layer.file}</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subsystem Managers */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Subsystem Managers (Backend Engines)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {subsystemManagers.map((sub, idx) => {
              const Icon = sub.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${sub.color}`} />
                      <h3 className="font-bold text-zinc-100 text-xs">{sub.name}</h3>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{sub.desc}</p>
                  </div>
                  <div className="pt-2 border-t border-[#181820] text-[10px] text-zinc-500 font-mono">
                    <code>{sub.file}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-zinc-100 text-xs">Ready to explore the codebase?</h3>
            <p className="text-[11px] text-zinc-400 font-sans">Inspect the open-source MIT repository or run the desktop IDE locally.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/desktop"
              className="px-3 py-1.5 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Launch Desktop IDE</span>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-[#141418] hover:bg-[#1f1f24] border border-[#26262e] text-zinc-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all"
            >
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
