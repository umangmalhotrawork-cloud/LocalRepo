"use client";

import React from "react";
import { Terminal, GitBranch, Search, FileCode, Command, Layout, Check, Sparkles, Activity } from "lucide-react";

export default function IDECoreSection() {
  const coreFeatures = [
    {
      icon: FileCode,
      title: "Monaco Multi-Tab Editor",
      badge: "Core Workspace",
      desc: "Full-featured Monaco code editor supporting Python, TypeScript, JavaScript, C++, and Rust with syntax highlighting, multi-cursors, and line diagnostics.",
      bullets: ["Split tab restoration & dirty buffer tracking", "Monaco line & gutter heatmaps", "Sub-millisecond cursor tracking"],
    },
    {
      icon: Terminal,
      title: "Integrated PTY Terminal",
      badge: "Shell Subsystem",
      desc: "Embedded native terminal running real PTY shells (zsh, bash, powershell) with full ANSI colors, multi-instance tabs, and panel resizing.",
      bullets: ["node-pty backend integration", "Multi-terminal tab switcher", "Integrated command execution"],
    },
    {
      icon: GitBranch,
      title: "Visual Git Source Control",
      badge: "Version Control",
      desc: "Inspect working tree modifications, stage/unstage files, commit changes, and view side-by-side Monaco diff modals without leaving the editor.",
      bullets: ["Branch detection & status badges", "Side-by-side diff modal inspector", "Safe staging & commit logging"],
    },
    {
      icon: Search,
      title: "Ripgrep Fast Search",
      badge: "Sub-350ms Indexing",
      desc: "Instant text, regex, and symbol search across massive codebases. Search through 100,000 files in 340 milliseconds with include/exclude glob filters.",
      bullets: ["Case-sensitive & Regex pattern support", "Include/Exclude glob filtering (*.py, !dist)", "Instant line navigation & match preview"],
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Layout className="w-3 h-3 text-cyan-400" />
            <span>CORE DEVELOPER WORKSPACE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            The Speed of Monaco. The Power of a Native Desktop IDE.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            A cohesive, high-performance developer workspace uniting editors, terminals, git version control, and global search into a single native application.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {coreFeatures.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[#141418] border border-[#24242e] flex items-center justify-center text-cyan-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-[#151520] border border-[#262626] text-cyan-300">
                      {item.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-zinc-100 text-sm">{item.title}</h3>
                    <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed mt-1.5">{item.desc}</p>
                  </div>
                </div>

                <ul className="space-y-1.5 pt-3 border-t border-[#181820] text-[10.5px] text-zinc-300">
                  {item.bullets.map((b, bIdx) => (
                    <li key={bIdx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
