"use client";

import Link from "next/link";
import { Github, Star, GitFork, ShieldCheck, Terminal, BookOpen, ExternalLink } from "lucide-react";

export default function OpenSourceRepo() {
  return (
    <section className="py-20 bg-[#050505] relative border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* GitHub Repository Card */}
        <div className="max-w-4xl mx-auto bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 rounded-24 p-8 shadow-2xl space-y-6 transition-all">
          
          {/* Top Repo Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <Github className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-mono text-sm">echo-nullity /</span>
                  <h3 className="text-lg font-bold text-white font-mono">echo-nullity-engine</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Local-first Causal Code Tomography Engine written in Rust & TypeScript.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-zinc-300">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>1,420 stars</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-zinc-300">
                <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                <span>184 forks</span>
              </div>
            </div>
          </div>

          {/* Repo Properties Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#070707] border border-[#1a1a1a] space-y-1">
              <span className="text-zinc-500 text-[10px]">LICENSE</span>
              <p className="text-white font-semibold">MIT License</p>
            </div>
            <div className="p-3 rounded-xl bg-[#070707] border border-[#1a1a1a] space-y-1">
              <span className="text-zinc-500 text-[10px]">TELEMETRY</span>
              <p className="text-emerald-400 font-semibold">Zero Telemetry</p>
            </div>
            <div className="p-3 rounded-xl bg-[#070707] border border-[#1a1a1a] space-y-1">
              <span className="text-zinc-500 text-[10px]">ARCHITECTURE</span>
              <p className="text-cyan-400 font-semibold">100% Local First</p>
            </div>
            <div className="p-3 rounded-xl bg-[#070707] border border-[#1a1a1a] space-y-1">
              <span className="text-zinc-500 text-[10px]">CLOUD DEPENDENCY</span>
              <p className="text-purple-400 font-semibold">None (Offline Ready)</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>Rust 84.2%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 ml-2" />
              <span>TypeScript 15.8%</span>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-24 bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md"
              >
                <Github className="w-4 h-4 fill-black" />
                <span>Star on GitHub</span>
              </a>

              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-24 bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-200 font-medium text-xs transition-all"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Read Documentation</span>
              </Link>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
