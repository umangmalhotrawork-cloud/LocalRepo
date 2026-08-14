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
              <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
                Echo Nullity
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              The local-first AI desktop IDE combining Monaco editing, autonomous AI agent execution, Time Travel Debugging, and verified AST surgery.
            </p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Local-First • 0% Telemetry • MIT</span>
            </div>
          </div>

          {/* Col 2: IDE Capabilities */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-3">
              IDE Capabilities
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Autonomous AI Agent Mode
                </Link>
              </li>
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Time Travel Debugger v2
                </Link>
              </li>
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Test Explorer &amp; Coverage
                </Link>
              </li>
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Performance Profiler
                </Link>
              </li>
              <li>
                <Link href="/desktop" className="hover:text-cyan-300 transition-colors">
                  Security &amp; Vulnerability Audit
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Navigation */}
          <div>
            <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-3">
              Documentation &amp; Source
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
                  Formal Research &amp; Papers
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-cyan-300 transition-colors">
                  Interactive Web Demo
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
                Tree-sitter
              </span>
              <span className="px-2 py-0.5 bg-[#0a0a0d] border border-[#1f1f24] rounded text-zinc-300">
                petgraph
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3 font-sans leading-relaxed">
              Engineered natively for macOS, Windows, and Linux.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#181820] flex flex-col sm:flex-row items-center justify-between gap-3 text-[10.5px] text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} Echo Nullity Project. Distributed under the MIT License.
          </div>
          <div className="flex items-center gap-4">
            <span>47/47 Tests Passed</span>
            <span>100k-File Scalability</span>
            <span>Quiescent 0% CPU</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
