"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, Lock, AlertTriangle, Key, Flame, Bug, Check, FileDown } from "lucide-react";

export default function SecurityAuditSection() {
  const securityFeatures = [
    {
      title: "Lockfile CVE Advisory Audits",
      desc: "Audits package-lock.json, requirements.txt, and poetry.lock against known CVE databases with severity classifications.",
      badge: "Supply Chain",
    },
    {
      title: "High-Entropy Secret Scanner",
      desc: "Detects leaked API tokens, OpenAI keys, AWS credentials, JWTs, and private RSA keys before commits.",
      badge: "Secret Shield",
    },
    {
      title: "AST Risky Pattern Detection",
      desc: "Flags dangerous execution sinks including eval(), execSync(), and shell=True with actionable safe alternatives.",
      badge: "Pattern Scanner",
    },
    {
      title: "Monaco Red/Amber Security Gutters",
      desc: "Visual gutter icons, inline tooltips, and one-click JSON/Markdown security audit report exports.",
      badge: "Inline Markers",
    },
  ];

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span>SECURITY &amp; DEPENDENCY AUDIT (⌘⇧S)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Lockfile CVE Audits, Secret Detection, and Risky Pattern Scans.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Audit dependencies, intercept leaked credentials, and eliminate dangerous execution sinks directly inside your active workspace.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* Left Cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {securityFeatures.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-red-500/40 transition-all flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-red-950/60 border border-red-500/30 text-red-300">
                    {item.badge}
                  </span>
                  <h3 className="font-bold text-zinc-100 text-xs pt-1">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Security Panel Mockup */}
          <div className="lg:col-span-6 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] overflow-hidden flex flex-col justify-between">
            <div className="px-3 py-2 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span className="font-bold text-zinc-100 text-[11px] uppercase tracking-wider">Security &amp; Vulnerability Audit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.2 rounded-full bg-red-950/80 text-red-300 border border-red-500/50 text-[9.5px] font-bold">
                  3 Critical
                </span>
                <span className="px-2 py-0.2 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50 text-[9.5px] font-bold">
                  5 High
                </span>
              </div>
            </div>

            <div className="p-4 space-y-2.5 bg-[#050508] flex-1">
              <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/40 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-red-300 font-bold flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-red-400" />
                    <span>Hardcoded OpenAI API Key</span>
                  </span>
                  <span className="text-[9.5px] uppercase font-bold text-red-400">Critical</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Detected secret token in src/config.py:14. Migrate to environment variable.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Dangerous subprocess.call(shell=True)</span>
                  </span>
                  <span className="text-[9.5px] uppercase font-bold text-amber-400">High</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-sans">Command injection risk in src/runner.py:32. Pass argument list without shell=True.</p>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#09090d] border-t border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400">
              <span>Scanned: <strong className="text-zinc-200">package.json + requirements.txt</strong></span>
              <span className="text-cyan-400 font-bold">Export Markdown / JSON Report</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
