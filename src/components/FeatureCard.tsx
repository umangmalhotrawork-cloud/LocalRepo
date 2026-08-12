"use client";

import { motion } from "framer-motion";
import { Sun, Network, Scissors, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface FeatureProps {
  id: string;
  title: string;
  badge: string;
  statusChip: string;
  rotation: string;
  description: string;
  details: string[];
  icon: "luminance" | "tension" | "saferemove";
  accent: "cyan" | "purple" | "emerald";
}

const features: FeatureProps[] = [
  {
    id: "luminance",
    title: "Causal Luminance",
    badge: "Per-Line Metric",
    statusChip: "Live Metric",
    rotation: "rotate-[0.5deg]",
    description: "Per-line measure of logical necessity. Computes path conditions for each basic block and evaluates state constraints under input mutations.",
    details: [
      "Path-condition collapse estimation",
      "Luminance gradient decoration (0.0 to 1.0)",
      "Zero state influence detection",
    ],
    icon: "luminance",
    accent: "cyan",
  },
  {
    id: "tension",
    title: "Semantic Tension Mapping",
    badge: "Repository Scale",
    statusChip: "Rust Engine",
    rotation: "-rotate-[0.5deg]",
    description: "Cross-function causal equivalence detection. Identifies structurally divergent but behaviorally redundant AI-generated patterns across files.",
    details: [
      "AST identifier & literal canonicalization",
      "Tree Edit Distance computation",
      "Force-directed equivalence clustering",
    ],
    icon: "tension",
    accent: "purple",
  },
  {
    id: "saferemove",
    title: "Safe Remove Surgery",
    badge: "Verified & Reversible",
    statusChip: "Verified Sandbox",
    rotation: "rotate-[0.5deg]",
    description: "Performs verified, reversible semantic surgery on a live codebase. Runs differential execution in isolated sandboxes before applying patches.",
    details: [
      "AST node transformations (preserves formatting)",
      "Automatic rollback snapshots (<1s restoration)",
      "Side-effect audit & dependency check",
    ],
    icon: "saferemove",
    accent: "emerald",
  },
];

export default function FeatureSection() {
  return (
    <section className="py-24 bg-[#050505] relative border-t border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <span>CORE INSTRUMENTATION</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight">
            Designed for Semantic Precision
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Moving beyond syntactic rules and coverage counters to measure causal leverage over program state.
          </p>
        </div>

        {/* 3 Staggered Animated Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {features.map((feature, idx) => {
            const Icon =
              feature.icon === "luminance"
                ? Sun
                : feature.icon === "tension"
                ? Network
                : Scissors;

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className={`group relative bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/50 rounded-24 p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-2 shadow-2xl hover:shadow-cyan-glow ${feature.rotation}`}
              >
                {/* Top Status Chips */}
                <div className="flex items-center justify-between mb-6">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      feature.accent === "cyan"
                        ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 group-hover:bg-cyan-500/20"
                        : feature.accent === "purple"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 group-hover:bg-purple-500/20"
                        : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-cyan-300">
                    {feature.statusChip}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="space-y-3">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block">
                    {feature.badge}
                  </span>
                  <h3 className="text-2xl font-heading font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-body">
                    {feature.description}
                  </p>
                </div>

                {/* Feature Details List */}
                <ul className="space-y-2.5 pt-6 my-6 border-t border-[#181818] font-mono text-xs text-zinc-300">
                  {feature.details.map((detail, dIdx) => (
                    <li key={dIdx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>

                {/* Link */}
                <div className="pt-2">
                  <Link
                    href="/architecture"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 group-hover:underline"
                  >
                    <span>Explore Algorithm Specs</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
