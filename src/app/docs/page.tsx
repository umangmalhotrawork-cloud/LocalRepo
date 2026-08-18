"use client";

import { useState } from "react";
import { BookOpen, Terminal, ShieldCheck, Settings, Check, Github, Bot, Bug, Flame, ShieldAlert, History, Download, Layers } from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("setup");

  const sections = [
    { id: "setup", name: "1. Setup & Requirements" },
    { id: "quickstart", name: "2. Desktop IDE Quickstart" },
    { id: "agent", name: "3. Autonomous AI Agent Mode" },
    { id: "debugger", name: "4. Time Travel Debugger v2" },
    { id: "testing", name: "5. Test Explorer & Coverage" },
    { id: "profiler", name: "6. Performance Profiler" },
    { id: "security", name: "7. Security & CVE Audit" },
    { id: "snapshots", name: "8. Workspace Snapshots & Rollback" },
    { id: "packaging", name: "9. Packaging & Distribution" },
  ];

  return (
    <div className="py-8 bg-[#050508] min-h-screen font-mono text-xs text-zinc-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.2 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase">
            <BookOpen className="w-3 h-3 text-cyan-400" />
            <span>DOCUMENTATION &amp; SPECIFICATIONS</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">NEXUS Developer Guide</h1>
          <p className="text-zinc-400 text-xs font-sans">
            Technical reference manual for the local-first AI Desktop IDE.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Sidebar */}
          <div className="lg:col-span-3 sticky top-16 space-y-1.5 bg-[#0a0a0d] border border-[#1f1f24] rounded-xl p-3">
            <div className="px-2 py-1 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              Table of Contents
            </div>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-all text-xs cursor-pointer ${
                  activeSection === sec.id
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-bold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121216]"
                }`}
              >
                {sec.name}
              </button>
            ))}

            <div className="pt-3 border-t border-[#181820] space-y-1.5">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#121216] border border-[#24242e] text-zinc-400 hover:text-white transition-colors"
              >
                <span>GitHub Repository</span>
                <Github className="w-3.5 h-3.5 text-cyan-400" />
              </a>
              <Link
                href="/desktop"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 transition-colors font-bold"
              >
                <span>Launch Desktop IDE</span>
                <Terminal className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Main Content Pane */}
          <div className="lg:col-span-9 space-y-6 bg-[#0a0a0d] border border-[#1f1f24] rounded-xl p-6 sm:p-8">
            
            {/* Setup */}
            {activeSection === "setup" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>1. Setup &amp; Prerequisites</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Echo Nullity is an offline, local-first Electron + Next.js desktop application. It requires zero cloud infrastructure.
                </p>

                <div className="space-y-2">
                  <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wider">System Prerequisites</h3>
                  <ul className="space-y-1.5 text-zinc-300">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /><span>Node.js 20+ &amp; npm / pnpm</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /><span>Git 2.40+ (for source control &amp; rollback)</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /><span>Python 3.10+ (for native cProfile / tracemalloc profiling)</span></li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wider">Clone &amp; Install Dependencies</h3>
                  <pre className="p-3 rounded-lg bg-[#050508] border border-[#181820] text-cyan-300">git clone https://github.com/echo-nullity/echo-nullity.git&#10;cd echo-nullity&#10;npm install</pre>
                </div>
              </div>
            )}

            {/* Quickstart */}
            {activeSection === "quickstart" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>2. Desktop IDE Quickstart</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Launch the local development environment or production desktop binary.
                </p>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-[#050508] border border-[#181820] space-y-1">
                    <div className="text-cyan-400 font-bold">Start Local Desktop Dev Environment</div>
                    <pre className="text-zinc-300">npm run electron:dev</pre>
                  </div>
                  <div className="p-3 rounded-lg bg-[#050508] border border-[#181820] space-y-1">
                    <div className="text-emerald-400 font-bold">Build Optimized Production Bundle</div>
                    <pre className="text-zinc-300">npm run build</pre>
                  </div>
                </div>
              </div>
            )}

            {/* Agent */}
            {activeSection === "agent" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span>3. Autonomous AI Agent Mode (⌘⇧I)</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  The AI Agent formulates multi-step plans, executes AST modifications across files, and runs terminal commands within a mathematical Patch Firewall.
                </p>
                <ul className="space-y-1.5 text-zinc-300">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /><span>Press <kbd className="px-1 py-0.2 bg-[#151520] rounded border border-[#262626]">⌘⇧I</kbd> to open the Agent Panel</span></li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /><span>Enter prompt to generate ordered milestones</span></li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /><span>Preview individual diffs before applying</span></li>
                </ul>
              </div>
            )}

            {/* Debugger */}
            {activeSection === "debugger" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-emerald-400" />
                  <span>4. Time Travel Debugger v2</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Record full execution traces and step backward or forward through variable state without restarting.
                </p>
                <div className="p-3 rounded-lg bg-[#050508] border border-[#181820] space-y-1.5">
                  <div><kbd className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-cyan-300">F5</kbd> — Launch debugger on active file</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-cyan-300">F10</kbd> — Step forward to next instruction</div>
                  <div><kbd className="px-1.5 py-0.5 rounded bg-[#151520] border border-[#262626] text-cyan-300">Shift+F10</kbd> — Step backward to previous frame</div>
                </div>
              </div>
            )}

            {/* Testing */}
            {activeSection === "testing" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400" />
                  <span>5. Test Explorer &amp; Coverage</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Auto-discovers tests for pytest, unittest, Jest, and Vitest. Visualizes branch coverage directly in Monaco gutters.
                </p>
                <div className="p-3 rounded-lg bg-[#050508] border border-[#181820] text-zinc-300">
                  Execute single test methods, files, or entire repositories with assertion failure extraction.
                </div>
              </div>
            )}

            {/* Profiler */}
            {activeSection === "profiler" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>6. Performance Profiler</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Profile Python CPU execution (<code className="text-amber-300">cProfile</code>), memory allocations (<code className="text-amber-300">tracemalloc</code>), and React render counts.
                </p>
                <div className="p-3 rounded-lg bg-[#050508] border border-[#181820] text-zinc-300">
                  Slow execution lines are highlighted in Monaco with amber gutter decorations.
                </div>
              </div>
            )}

            {/* Security */}
            {activeSection === "security" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>7. Security &amp; CVE Audit (⌘⇧S)</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Scans lockfiles for known CVE advisories and flags leaked API secrets and dangerous AST execution sinks.
                </p>
              </div>
            )}

            {/* Snapshots */}
            {activeSection === "snapshots" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span>8. Workspace Snapshots &amp; Rollback (⌘⇧B)</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Create named checkpoints, compare diffs, and restore single files or full repositories in under 0.4s.
                </p>
              </div>
            )}

            {/* Packaging */}
            {activeSection === "packaging" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>9. Packaging &amp; Distribution</span>
                </h2>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                  Package self-contained installers for macOS, Windows, and Linux.
                </p>
                <div className="space-y-1.5 text-zinc-300">
                  <pre className="p-2.5 rounded-lg bg-[#050508] border border-[#181820]">npm run package:mac    # macOS .dmg / .app&#10;npm run package:win    # Windows NSIS / .zip&#10;npm run package:linux  # Linux .AppImage / tar.gz</pre>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
