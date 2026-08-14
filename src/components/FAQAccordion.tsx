"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Is Echo Nullity a VS Code extension or a standalone desktop IDE?",
    answer: "Echo Nullity is a standalone, full-featured desktop IDE built on Electron, Next.js, and Monaco Editor. It includes its own file explorer, multi-tab buffer manager, native terminal subsystem, Git source control, Time Travel Debugger, performance profiler, and autonomous AI agent.",
  },
  {
    question: "Does Echo Nullity transmit source code to external servers?",
    answer: "No. Echo Nullity is strictly 100% local-first. All parsing, graph traversal, mutation sandboxing, test execution, and performance profiling run exclusively on your local CPU. Telemetry is local-only and opt-in.",
  },
  {
    question: "Which programming languages are supported?",
    answer: "Full Causal Code Tomography, AST surgery, and Monaco syntax highlighting support Python, TypeScript, JavaScript, C++, and Rust. The test runner supports pytest, unittest, Jest, and Vitest.",
  },
  {
    question: "How is Causal Luminance different from dead-code elimination?",
    answer: "Dead-code elimination only removes unreachable statements (such as code after a return). Causal Luminance identifies executable statements that actually run and pass tests, but exert zero causal necessity over the program's observable return state.",
  },
  {
    question: "How do Workspace Snapshots and Rollback work?",
    answer: "Snapshots are atomic local JSON records capturing all workspace file buffers, tabs, and cursor positions. You can compare snapshots with side-by-side diffs and rollback single files or entire repositories in under 0.4 seconds, with automatic pre-restore safety backups.",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-14 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-2 mb-8 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Technical &amp; Architectural FAQs.
          </h2>
          <p className="text-zinc-400 text-xs font-sans leading-relaxed">
            Everything you need to know about the local-first desktop IDE, privacy guarantees, and causal tomography.
          </p>
        </div>

        {/* Accordion list */}
        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#0a0a0d] border border-[#1f1f24] hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-bold text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  <span className="hover:text-cyan-300 transition-colors">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-cyan-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 text-[11.5px] text-zinc-400 font-sans leading-relaxed border-t border-[#181820] pt-3"
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
