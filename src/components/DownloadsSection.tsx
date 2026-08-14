"use client";

import React from "react";
import { Download, Terminal, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export default function DownloadsSection() {
  const platforms = [
    {
      os: "macOS",
      badge: "Universal DMG",
      version: "Apple Silicon & Intel",
      arch: "M1/M2/M3/M4 & x86_64",
      filename: "Echo-Nullity-1.0.0-mac.dmg",
      command: "npm run package:mac",
    },
    {
      os: "Windows",
      badge: "NSIS / Portable ZIP",
      version: "Windows 10 / 11",
      arch: "x64 & ARM64",
      filename: "Echo-Nullity-Setup-1.0.0.exe",
      command: "npm run package:win",
    },
    {
      os: "Linux",
      badge: "AppImage & tar.gz",
      version: "Ubuntu, Fedora, Arch",
      arch: "x86_64",
      filename: "Echo-Nullity-1.0.0.AppImage",
      command: "npm run package:linux",
    },
  ];

  return (
    <section id="downloads" className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Download className="w-3 h-3 text-cyan-400" />
            <span>CROSS-PLATFORM DESKTOP PACKAGES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Native, Self-Contained Desktop Packages.
          </h2>
          <p className="text-zinc-400 text-xs font-sans leading-relaxed">
            Free, open-source MIT-licensed binaries built with zero cloud dependencies for instant local execution.
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
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    {p.badge}
                  </span>
                </div>

                <div className="space-y-1 text-zinc-400 text-[11px] font-sans">
                  <p>Compatible with {p.version}</p>
                  <p className="text-zinc-500 text-[10px] font-mono">{p.arch}</p>
                </div>

                <div className="p-2.5 rounded-lg bg-[#050508] border border-[#181820] text-[10.5px]">
                  <span className="text-zinc-400">Package:</span> <strong className="text-cyan-300 ml-1">{p.filename}</strong>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#181820]">
                <a
                  href="/desktop"
                  className="w-full py-2 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download for {p.os}</span>
                </a>
                <div className="text-center text-[10px] text-zinc-500">
                  Build: <code className="text-zinc-400">{p.command}</code>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
