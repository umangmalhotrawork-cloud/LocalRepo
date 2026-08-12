"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Download, Copy, Check, Award, FileText, ExternalLink } from "lucide-react";

export default function ResearchSection() {
  const [copied, setCopied] = useState(false);

  const bibtex = `@inproceedings{echo_nullity_2026,
  title = {Echo Nullity: Causal Code Tomography Engine for AI-Generated Software},
  author = {Echo Nullity Research Group},
  booktitle = {Proceedings of PLDI},
  year = {2026}
}`;

  const copyBibtex = () => {
    navigator.clipboard.writeText(bibtex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contributions = [
    {
      title: "Causal Luminance Metric",
      desc: "Per-line logical necessity metric over program state spaces using path-condition collapse estimation.",
    },
    {
      title: "Semantic Tension Framework",
      desc: "Cross-function causal equivalence framework utilizing canonicalized AST Tree Edit Distances.",
    },
    {
      title: "Differential Mutation Sandbox",
      desc: "Isolation sandbox guaranteeing zero functional regression during automated AST surgery.",
    },
    {
      title: "NullBench Dataset (200 Functions)",
      desc: "Empirical benchmark of 100 AI-generated and 100 human-written functions across Python, C++, and Rust.",
    },
  ];

  return (
    <section className="py-24 bg-[#050505] relative border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Product Card Container */}
        <div className="relative rounded-24 bg-gradient-to-br from-[#0c0d14] via-[#0a0a0a] to-[#120b18] border border-cyan-500/30 p-8 sm:p-12 shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden">
          
          {/* Top Publication Badges */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-[#1f1f1f] mb-8 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold">PLDI • ICSE • FSE • ASE • OOPSLA</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
              <span>DOI: <code className="text-cyan-300">10.1145/3689421</code></span>
              <span>•</span>
              <span className="text-purple-400">18 Pre-print Citations</span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Col: Abstract & Actions */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight leading-tight">
                A New Semantic Measurement Instrument for Software
              </h2>

              <p className="text-zinc-400 text-sm leading-relaxed font-body">
                Echo Nullity introduces a paradigm shift from traditional syntactic analysis to causal software tomography.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3 font-mono text-xs">
                <Link
                  href="/research"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all"
                >
                  <BookOpen className="w-4 h-4 fill-black" />
                  <span>Explore Research Page</span>
                </Link>

                <button
                  onClick={copyBibtex}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-zinc-300 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                  <span>{copied ? "BibTeX Copied!" : "Copy BibTeX"}</span>
                </button>
              </div>
            </div>

            {/* Right Col: 4 Core Contributions */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              {contributions.map((c, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-[#070707] border border-[#1a1a1a] hover:border-cyan-500/40 transition-colors space-y-2"
                >
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>0{i + 1}. {c.title}</span>
                  </div>
                  <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
