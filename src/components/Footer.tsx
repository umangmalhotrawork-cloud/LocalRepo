"use client";

import Link from "next/link";
import { Activity, ShieldCheck, Download, BookOpen, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#050508] border-t border-[#1f1f24] pt-12 pb-8 relative z-10 text-zinc-400 font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Col 1: Brand */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-zinc-100 uppercase tracking-widest text-xs">
                NEXUS
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              A local-first AI software engineering environment that understands your codebase, plans engineering work, performs controlled code changes, and preserves context across sessions.
            </p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Local-First • Authoritative Workspace • MIT</span>
            </div>
          </div>

          {/* Col 2: Capabilities */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-3">
              Capabilities &amp; Features
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Autonomous Agent &amp; Planning
                </Link>
              </li>
              <li>
                <Link href="/#continuum" className="hover:text-cyan-300 transition-colors">
                  Continuum Session Memory
                </Link>
              </li>
              <li>
                <Link href="/#intelligence" className="hover:text-cyan-300 transition-colors">
                  Behavioral Dependency Graph
                </Link>
              </li>
              <li>
                <Link href="/#intelligence" className="hover:text-cyan-300 transition-colors">
                  AI Patch Firewall &amp; Verification
                </Link>
              </li>
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Monaco IDE &amp; Native PTY Terminal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Navigation */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-3">
              Documentation &amp; Specs
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link href="/docs" className="hover:text-cyan-300 transition-colors">
                  Getting Started &amp; Setup
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="hover:text-cyan-300 transition-colors">
                  System Architecture
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-cyan-300 transition-colors">
                  Formal Research &amp; Specifications
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-cyan-300 transition-colors">
                  Interactive Demo Playground
                </Link>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-cyan-300 transition-colors">
                  GitHub Repository (MIT)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform Stack */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-3">
              Technology Stack
            </h4>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                Electron 33
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                Monaco Editor
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                Next.js 15
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                Node.js PTY
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                Python AST
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                React 19
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3 font-sans leading-relaxed">
              Native desktop environment for macOS, Windows, and Linux.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#181820] flex flex-col sm:flex-row items-center justify-between gap-3 text-[10.5px] text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} NEXUS Project. Distributed under the MIT License.
          </div>
          <div className="flex items-center gap-4">
            <span>Local-First Workspace</span>
            <span>Continuum Memory</span>
            <span>AI Patch Firewall</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
