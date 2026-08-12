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
    question: "Is Echo Nullity free?",
    answer: "Yes. Echo Nullity is an open-source research engine released under the permissive MIT License. You can run the CLI and VS Code extension locally without any subcriptions or paywalls.",
  },
  {
    question: "Does it upload my code?",
    answer: "No. Echo Nullity is strictly local-first. All parsing (Tree-sitter), control-flow graph extraction (petgraph), mutation testing, and AST diff surgeries execute on your local CPU. Zero source code or telemetry is ever transmitted.",
  },
  {
    question: "Which languages are supported?",
    answer: "The core engine currently supports Python, C++, and Rust with full Tree-sitter parsers, Control Flow Graphs (CFG), and Data Flow Graphs (DFG). Additional support for Java, Go, and TypeScript is actively under development.",
  },
  {
    question: "How is this different from dead-code elimination?",
    answer: "Traditional dead-code elimination only removes unreachable code (e.g., statements after a return or inside `if (false)`). Echo Nullity detects executable code that actually runs and passes tests, but exerts zero causal necessity over the program's output state.",
  },
  {
    question: "Can I use it with AI coding tools?",
    answer: "Yes! Echo Nullity is designed specifically for AI-augmented workflows (Copilot, Claude, Cursor, ChatGPT). AI coding tools frequently introduce redundant identity calculations, vacuous error guards, and duplicate abstractions. Echo Nullity continuously purifies generated code as you work.",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-20 bg-[#000000] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-zinc-400 text-sm">
            Everything you need to know about causal tomography, privacy, and IDE integration.
          </p>
        </div>

        {/* Accordion list */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/30 rounded-24 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-white text-base focus:outline-none"
                >
                  <span className="hover:text-cyan-300 transition-colors">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-cyan-400 shrink-0 transition-transform duration-300 ${
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
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-6 text-sm text-zinc-400 leading-relaxed border-t border-[#161616] pt-4"
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
