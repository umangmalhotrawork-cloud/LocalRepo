"use client";

import React from "react";
import { Search, Compass, Play, ShieldCheck, History, ArrowRight, Activity } from "lucide-react";

export default function DeveloperWorkflow() {
  const steps = [
    {
      stage: "01",
      title: "UNDERSTAND",
      icon: Search,
      badge: "BDG Analysis",
      desc: "Maps dependencies, call graphs, AST structures, and behavioral constraints across local codebase files.",
    },
    {
      stage: "02",
      title: "PLAN",
      icon: Compass,
      badge: "Milestones",
      desc: "Formulates ordered engineering plans with clear milestones and Truth Boundary verification targets.",
    },
    {
      stage: "03",
      title: "EXECUTE",
      icon: Play,
      badge: "Controlled Edits",
      desc: "Applies targeted AST code modifications via Monaco editor integration and native terminal tool invocation.",
    },
    {
      stage: "04",
      title: "VERIFY",
      icon: ShieldCheck,
      badge: "Patch Firewall",
      desc: "Evaluates patch safety against test suites, differential execution, and behavioral equivalence rules.",
    },
    {
      stage: "05",
      title: "REMEMBER",
      icon: History,
      badge: "Continuum",
      desc: "Snapshot engineering decisions, verification status, and pending tasks into portable Nexus Capsules.",
    },
    {
      stage: "06",
      title: "CONTINUE",
      icon: ArrowRight,
      badge: "Context Handoff",
      desc: "Hand off curated project state to fresh AI sessions without context degradation or lost decisions.",
    },
  ];

  return (
    <section className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>AUTONOMOUS ENGINEERING LIFECYCLE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            How NEXUS Executes Engineering Tasks
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-2xl leading-relaxed">
            Rather than making unconstrained code edits, NEXUS follows a structured engineering workflow designed for control, safety, and continuity.
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-xl bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 font-mono">{step.stage}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#151520] border border-[#262626] text-zinc-300">
                      {step.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className="w-6 h-6 rounded-md bg-[#141418] border border-[#24242e] flex items-center justify-center text-cyan-400">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-zinc-100 text-sm">{step.title}</h3>
                  </div>

                  <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed pt-1">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
