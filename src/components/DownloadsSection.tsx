"use client";

import React from "react";
import { Terminal, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DownloadsSection() {
  const platforms = [
    {
      os: "macOS",
      badge: "Universal App",
      version: "Apple Silicon & Intel",
      arch: "M1/M2/M3/M4 & x86_64",
      command: "npm run package:mac",
    },
    {
      os: "Windows",
      badge: "NSIS / Portable",
      version: "Windows 10 / 11",
      arch: "x64 & ARM64",
      command: "npm run package:win",
    },
    {
      os: "Linux",
      badge: "AppImage & Tar",
      version: "Ubuntu, Fedora, Arch",
      arch: "x86_64",
      command: "npm run package:linux",
    },
  ];

  return (
    <section id="downloads" className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>CROSS-PLATFORM DESKTOP IDE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Native Desktop Environment
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
            Run NEXUS locally on macOS, Windows, and Linux with full Monaco editor support, native terminal execution, and local context persistence.
          </p>
        </div>

        {/* 3 Platforms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map((p, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-100 text-base">{p.os}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    {p.badge}
                  </span>
                </div>

                <div className="space-y-1 text-zinc-400 text-[11px] font-sans">
                  <p>Compatible with {p.version}</p>
                  <p className="text-zinc-500 text-[10px] font-mono">{p.arch}</p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#181820]">
                <Link
                  href="/desktop"
                  className="w-full py-2.5 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Explore the Desktop IDE</span>
                </Link>
                <div className="text-center text-[10px] text-zinc-500 font-mono">
                  Build locally: <code className="text-zinc-400">{p.command}</code>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
