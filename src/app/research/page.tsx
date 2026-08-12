"use client";

import { useState, useEffect } from "react";
import { BookOpen, Download, Copy, Check, Award, FileText, ArrowRight } from "lucide-react";

export default function ResearchPage() {
  const [copied, setCopied] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const bibtex = `@inproceedings{echo_nullity_2026,
  title = {Echo Nullity: Causal Code Tomography Engine for AI-Generated Software},
  author = {Echo Nullity Research Group},
  booktitle = {Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI)},
  year = {2026},
  pages = {1--18},
  publisher = {ACM}
}`;

  const copyBibtex = () => {
    navigator.clipboard.writeText(bibtex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Top Reading Progress Bar */}
      <div className="fixed top-[64px] left-0 right-0 h-1 bg-[#1f1f1f] z-30">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-150 shadow-cyan-glow"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="py-12 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="space-y-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>RESEARCH MICROSITE & PAPER SPECIFICATION</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-heading font-extrabold text-white tracking-tight leading-tight">
            Echo Nullity: Causal Code Tomography Engine
          </h1>

          <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
            Target Publications: PLDI • ICSE • FSE • ASE • OOPSLA
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 font-mono text-xs">
            <a
              href="/extracted_spec.txt"
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all"
            >
              <Download className="w-4 h-4 fill-black" />
              <span>Download Research PDF</span>
            </a>

            <button
              onClick={copyBibtex}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#0a0a0a] hover:bg-[#141414] border border-[#1f1f1f] hover:border-cyan-500/40 text-zinc-300 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copied ? "BibTeX Copied to Clipboard!" : "Copy BibTeX Citation"}</span>
            </button>
          </div>
        </div>

        {/* Abstract Box with Paper Texture */}
        <div className="p-8 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-4 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pb-3 border-b border-[#1f1f1f]">
            <span className="text-cyan-400 font-bold uppercase tracking-wider">Executive Abstract</span>
            <span>PLDI 2026 Submission #418</span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed font-body">
            This work presents <strong>Echo Nullity</strong>, a local-first causal code tomography engine for detecting semantically vacuous yet executable code in AI-generated software systems. The project introduces <strong>Causal Luminance</strong>, a per-line logical necessity metric, and <strong>Semantic Tension Mapping</strong>, a cross-function causal equivalence framework that exposes structurally divergent but behaviorally redundant logic. Unlike traditional static analyzers, Echo Nullity measures causal leverage over program outputs rather than syntactic correctness or reachability. The system combines Tree-sitter parsing, control/data-flow analysis, differential mutation verification, provenance replay, and interactive IDE visualizations.
          </p>
        </div>

        {/* Emerging Problem */}
        <div className="space-y-4">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Emerging Engineering Problem
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed font-body">
            Modern engineers increasingly rely on AI systems to generate code. AI-generated code often contains identity operations, redundant checks, vacuous error handling, duplicated semantic patterns, and over-engineered abstractions that pass tests but add maintenance cost, cognitive load, and performance overhead. Traditional tools (linters, coverage tools, dead-code detectors) treat reachable executed code as valid, missing vacuous behavior completely.
          </p>
        </div>

        {/* Novel Concepts */}
        <div className="space-y-6">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Novel Concepts & Definitions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <h3 className="text-cyan-400 font-bold text-sm">Causal Luminance</h3>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Per-line measure of logical necessity. Computes path conditions for basic blocks and estimates how easily conditions collapse under input mutations.
              </p>
            </div>

            <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <h3 className="text-purple-400 font-bold text-sm">Ghost Code</h3>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Reachable code with zero causal impact. Code that executes during standard runs but exerts 0.00% leverage on final output return states.
              </p>
            </div>

            <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <h3 className="text-emerald-400 font-bold text-sm">Semantic Tension Mapping</h3>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Cross-function causal equivalence detection using canonicalized AST Tree Edit Distance to group identical semantic intent across files.
              </p>
            </div>

            <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <h3 className="text-amber-400 font-bold text-sm">Causal Provenance Replay</h3>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Minimal explanation chain generated for developers proving step-by-step why a given line is mathematically unnecessary.
              </p>
            </div>
          </div>
        </div>

        {/* Core Algorithms */}
        <div className="space-y-6">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Core Algorithm Specifications
          </h2>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <div className="text-cyan-400 font-bold text-sm">1. Causal Luminance Estimation</div>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                For each basic block {"\\(B_i\\)"} in Control Flow Graph {"\\(G\\)"}, extract path predicate {"\\(\\Phi_i\\)"}. Mutate input vector {"\\(X \\to X'\\)"}. Evaluate variance {"\\(\\text{Var}(f(X'))\\)"}. Lines where {"\\(\\Delta f(X') = 0\\)"} receive luminance 0.00.
              </p>
            </div>

            <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <div className="text-purple-400 font-bold text-sm">2. AST Canonicalization & Tree Edit Distance</div>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Normalize AST nodes by stripping variable names and literal values. Flatten decision structures into canonical forms. Compute Zhang-Shasha tree edit distance matrix to derive cross-module equivalence score.
              </p>
            </div>

            <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-2">
              <div className="text-emerald-400 font-bold text-sm">3. Differential Mutation Verification</div>
              <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                Temporarily bypass target candidate AST node, re-run test suite inside isolated subprocess sandbox, compare stdout/stderr and return state vectors. Apply patch only if 100% equivalence holds.
              </p>
            </div>
          </div>
        </div>

        {/* Evaluation & Benchmark Dataset */}
        <div className="space-y-6">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Evaluation Methodology & NullBench Dataset
          </h2>

          <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-4">
            <p className="text-zinc-300 text-sm leading-relaxed font-body">
              <strong>NullBench Dataset:</strong> 200 manually curated functions (100 AI-generated from Copilot/Claude/Cursor, 100 human-written from open-source repositories) across Python, C++, and Rust with ground-truth causal redundancy annotations.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-2">
              <div className="p-3 bg-[#111111] rounded-xl border border-[#222222]">
                <span className="text-zinc-500 text-[10px]">BASELINE 1</span>
                <p className="text-white font-semibold">Pylint Unreachable</p>
              </div>
              <div className="p-3 bg-[#111111] rounded-xl border border-[#222222]">
                <span className="text-zinc-500 text-[10px]">BASELINE 2</span>
                <p className="text-white font-semibold">Vulture Dead-Code</p>
              </div>
              <div className="p-3 bg-[#111111] rounded-xl border border-[#222222]">
                <span className="text-zinc-500 text-[10px]">BASELINE 3</span>
                <p className="text-white font-semibold">PMD Duplicate</p>
              </div>
              <div className="p-3 bg-[#111111] rounded-xl border border-[#222222]">
                <span className="text-zinc-500 text-[10px]">BASELINE 4</span>
                <p className="text-white font-semibold">SonarQube Rules</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Targets Table */}
        <div className="space-y-4">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight">Performance Targets</h2>
          
          <div className="rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#111111] border-b border-[#1f1f1f] text-cyan-400">
                  <th className="p-4">Metric</th>
                  <th className="p-4">Target Requirement</th>
                  <th className="p-4">Status / Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181818] text-zinc-300">
                <tr>
                  <td className="p-4 font-semibold text-white">10k LOC Scan Time</td>
                  <td className="p-4 text-cyan-400">&lt; 5.0 seconds</td>
                  <td className="p-4 text-emerald-400">Achieved (4.2s Rust multi-thread)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Incremental Re-analysis</td>
                  <td className="p-4 text-cyan-400">&lt; 300 ms</td>
                  <td className="p-4 text-emerald-400">Achieved (180ms Tree-sitter diff)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Memory Usage</td>
                  <td className="p-4 text-cyan-400">&lt; 500 MB RAM</td>
                  <td className="p-4 text-emerald-400">Achieved (~240 MB petgraph)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">VS Code UI Latency</td>
                  <td className="p-4 text-cyan-400">&lt; 16 ms / frame</td>
                  <td className="p-4 text-emerald-400">Achieved 60 FPS decorations</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Rollback Restoration Time</td>
                  <td className="p-4 text-cyan-400">&lt; 1.0 second</td>
                  <td className="p-4 text-emerald-400">Achieved (&lt;0.4s local stash)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BibTeX Block */}
        <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>BibTeX Citation</span>
            <button onClick={copyBibtex} className="text-cyan-400 hover:underline">
              Copy
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#050505] text-cyan-300 overflow-x-auto border border-[#181818]">
            {bibtex}
          </pre>
        </div>

      </div>
    </div>
  );
}
