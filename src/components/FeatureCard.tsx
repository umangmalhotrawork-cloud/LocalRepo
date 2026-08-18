"use client";

import React from "react";
import { Network, ShieldCheck, CheckCircle2, Scissors, Layers, ArrowRight, Activity, Lock } from "lucide-react";
import Link from "next/link";

interface FeatureProps {
  id: string;
  title: string;
  badge: string;
  statusChip: string;
  description: string;
  details: string[];
  icon: "bdg" | "firewall" | "verification" | "saferemove" | "truth";
  accent: "cyan" | "purple" | "emerald" | "amber";
}

const features: FeatureProps[] = [
  {
    id: "bdg",
    title: "Behavioral Dependency Graph (BDG)",
    badge: "Structural Intelligence",
    statusChip: "AST & CFG Graph",
    description: "Builds a structural map of functions, classes, and variable flows across the repository to understand logical relationships before modifying code.",
    details: [
      "Cross-module call graph resolution",
      "Control & data dependency tracking",
      "Structural relationship mapping",
    ],
    icon: "bdg",
    accent: "cyan",
  },
  {
    id: "firewall",
    title: "AI Patch Firewall",
    badge: "Safety Control",
    statusChip: "Pre-Apply Filter",
    description: "Evaluates proposed code changes against AST behavioral rules before application, preventing unconstrained side-effects and hallucinations.",
    details: [
      "AST invariant enforcement",
      "Taint & side-effect bounds checking",
      "Evidence persistence for applied patches",
    ],
    icon: "firewall",
    accent: "purple",
  },
  {
    id: "verification",
    title: "Behavior Verification",
    badge: "Behavioral Equivalence",
    statusChip: "Differential Engine",
    description: "Checks code modifications against behavioral fingerprints and differential test execution to ensure original behavior remains preserved.",
    details: [
      "Behavioral fingerprint generation",
      "Differential test runner verification",
      "Zero silent regression guarantee",
    ],
    icon: "verification",
    accent: "emerald",
  },
  {
    id: "saferemove",
    title: "Safe Remove Surgery",
    badge: "Controlled Cleanups",
    statusChip: "Reversible AST",
    description: "Performs verified code removal following a controlled 5-stage workflow: Analyze → Preview → Verify → Apply → Undo.",
    details: [
      "Redundant code isolation",
      "Full side-by-side diff preview",
      "Instant 1-click rollback snapshots",
    ],
    icon: "saferemove",
    accent: "amber",
  },
  {
    id: "truth",
    title: "Truth Boundary Enforcement",
    badge: "Evidence Tracking",
    statusChip: "Status Verifier",
    description: "Categorizes project claims strictly by empirical verification evidence, maintaining clear boundaries across engineering states.",
    details: [
      "States: IMPLEMENTED, VERIFIED",
      "States: PLANNED, BLOCKED, UNKNOWN",
      "Prevents false claims in AI plans",
    ],
    icon: "truth",
    accent: "cyan",
  },
];

export default function FeatureSection() {
  return (
    <section id="intelligence" className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>CORE ENGINEERING INTELLIGENCE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Structural Understanding &amp; Controlled Execution
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-3xl leading-relaxed">
            NEXUS combines AST analysis, Behavioral Dependency Graphs, pre-patch firewalls, and behavioral verification to perform safe, controlled software changes.
          </p>
        </div>

        {/* 5 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon =
              feature.icon === "bdg"
                ? Network
                : feature.icon === "firewall"
                ? ShieldCheck
                : feature.icon === "verification"
                ? CheckCircle2
                : feature.icon === "saferemove"
                ? Scissors
                : Lock;

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
                          : feature.accent === "emerald"
                          ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                          : "bg-amber-950/80 border border-amber-500/40 text-amber-400"
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

                <ul className="space-y-1.5 pt-3 border-t border-[#181820] text-[10.5px] text-zinc-300 font-sans">
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
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline"
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
