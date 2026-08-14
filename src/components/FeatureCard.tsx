"use client";

import React from "react";
import { Sun, Network, Scissors, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";

interface FeatureProps {
  id: string;
  title: string;
  badge: string;
  statusChip: string;
  description: string;
  details: string[];
  icon: "luminance" | "tension" | "saferemove";
  accent: "cyan" | "purple" | "emerald";
}

const features: FeatureProps[] = [
  {
    id: "luminance",
    title: "Causal Luminance Engine",
    badge: "Per-Line Metric",
    statusChip: "Live Metric",
    description: "Per-line measure of logical necessity. Computes path conditions for basic blocks and evaluates state constraints under input mutations.",
    details: [
      "Path-condition collapse estimation",
      "Luminance gradient decoration (0.00 to 1.00)",
      "Zero state influence & ghost line isolation",
    ],
    icon: "luminance",
    accent: "cyan",
  },
  {
    id: "tension",
    title: "Semantic Tension Mapping",
    badge: "Repository Scale",
    statusChip: "petgraph Engine",
    description: "Cross-function causal equivalence detection. Identifies structurally divergent but behaviorally redundant AI-generated patterns.",
    details: [
      "AST identifier & literal canonicalization",
      "Zhang-Shasha Tree Edit Distance metric",
      "Force-directed equivalence clustering",
    ],
    icon: "tension",
    accent: "purple",
  },
  {
    id: "saferemove",
    title: "Safe Remove AST Surgery",
    badge: "Verified & Reversible",
    statusChip: "Sandbox Verifier",
    description: "Performs verified, reversible semantic surgery on a live codebase. Runs differential execution in isolated sandboxes before applying patches.",
    details: [
      "AST node transformations (preserves formatting)",
      "Automatic rollback snapshots (<0.4s restoration)",
      "Side-effect audit & dependency check",
    ],
    icon: "saferemove",
    accent: "emerald",
  },
];

export default function FeatureSection() {
  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>CAUSAL TOMOGRAPHY &amp; AST SURGERY</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Designed for Semantic Precision.
          </h2>
          <p className="text-zinc-400 text-xs font-sans max-w-2xl leading-relaxed">
            Moving beyond syntactic linters and line counters to measure causal leverage over program state.
          </p>
        </div>

        {/* 3 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, idx) => {
            const Icon =
              feature.icon === "luminance"
                ? Sun
                : feature.icon === "tension"
                ? Network
                : Scissors;

            return (
              <div
                key={feature.id}
                className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        feature.accent === "cyan"
                          ? "bg-cyan-950/80 border border-cyan-500/40 text-cyan-400"
                          : feature.accent === "purple"
                          ? "bg-purple-950/80 border border-purple-500/40 text-purple-400"
                          : "bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-full bg-[#151520] border border-[#262626] text-zinc-300">
                      {feature.statusChip}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] text-zinc-500 uppercase tracking-wider block">
                      {feature.badge}
                    </span>
                    <h3 className="text-base font-bold text-zinc-100 mt-1">
                      {feature.title}
                    </h3>
                    <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed mt-1.5">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5 pt-3 border-t border-[#181820] text-[10.5px] text-zinc-300">
                  {feature.details.map((detail, dIdx) => (
                    <li key={dIdx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <Link
                    href="/architecture"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    <span>View Architecture Specs</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
