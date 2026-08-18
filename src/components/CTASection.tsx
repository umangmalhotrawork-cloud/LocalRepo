"use client";

import Link from "next/link";
import { BookOpen, Github, Terminal, Activity } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] p-8 sm:p-12 text-center space-y-6">
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI-NATIVE ENGINEERING ENVIRONMENT</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
              Understand, Plan, Execute, and Remember Your Codebase
            </h2>

            <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
              Experience local-first software engineering with Monaco editing, Behavioral Dependency Graphs, AI Patch Firewalls, and Continuum session context.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/desktop"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Explore the Desktop IDE</span>
            </Link>

            <Link
              href="/docs"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141418] hover:bg-[#1f1f24] border border-[#26262e] text-zinc-300 hover:text-white font-medium text-xs transition-all"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Read Documentation</span>
            </Link>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141418] hover:bg-[#1f1f24] border border-[#26262e] text-zinc-300 hover:text-white font-medium text-xs transition-all"
            >
              <Github className="w-4 h-4 text-zinc-400" />
              <span>View GitHub Repository</span>
            </a>
          </div>

        </div>

      </div>
    </section>
  );
}
