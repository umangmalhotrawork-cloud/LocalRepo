"use client";

import Link from "next/link";
import { Download, BookOpen, Github, Sparkles, Terminal, Activity } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="rounded-xl bg-[#0a0a0d] border border-[#1f1f24] p-8 sm:p-12 text-center space-y-6">
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>READY FOR PRODUCTION</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
              Purify, Debug, and Secure Your Codebase Today.
            </h2>

            <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
              Experience local-first AI development with Monaco editing, Time Travel Debugging, automated test discovery, and verified AST surgery.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="#downloads"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Download Beta (Free MIT)</span>
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
              <span>Star on GitHub</span>
            </a>
          </div>

        </div>

      </div>
    </section>
  );
}
