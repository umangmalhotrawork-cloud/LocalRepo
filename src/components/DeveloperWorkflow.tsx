"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Code, CheckCircle2 } from "lucide-react";

export default function DeveloperWorkflow() {
  const columns = [
    {
      title: "Local First",
      subtitle: "Zero Cloud Dependencies",
      desc: "Source code never leaves your developer machine. All Tree-sitter parsing, CFG construction, and differential verification execute locally in compiled Rust.",
      icon: ShieldCheck,
      badge: "100% Private",
    },
    {
      title: "IDE Native",
      subtitle: "VS Code Integration",
      desc: "Renders smooth ghost-text opacity highlights, Causal Luminance color gradients, and side provenance replay panels directly inside your active editor window.",
      icon: Code,
      badge: "VS Code & CLI",
    },
    {
      title: "Verified Changes",
      subtitle: "Reversible Surgery",
      desc: "Safe Remove executes your test suite inside an isolated mutation sandbox. If any behavioral shift is detected, the operation aborts and creates a instant rollback snapshot.",
      icon: CheckCircle2,
      badge: "<1s Rollback",
    },
  ];

  return (
    <section className="py-20 bg-[#000000] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <span>DEVELOPER WORKFLOW</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for Real Engineering Teams
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Seamlessly integrating into daily developer environments without sacrificing privacy or stability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {columns.map((col, idx) => {
            const Icon = col.icon;
            return (
              <motion.div
                key={col.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 rounded-24 p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#141414] border border-[#262626] text-cyan-300">
                      {col.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{col.title}</h3>
                    <p className="text-xs font-mono text-cyan-400">{col.subtitle}</p>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {col.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
