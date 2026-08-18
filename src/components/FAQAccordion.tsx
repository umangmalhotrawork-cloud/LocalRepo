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
    question: "Is NEXUS a cloud IDE or a local-first desktop application?",
    answer: "NEXUS is strictly a local-first desktop software engineering environment built on Electron, Next.js, and Monaco Editor. Your local workspace is authoritative. Code remains local on your machine, and cloud infrastructure connections are purely optional.",
  },
  {
    question: "What is Continuum session memory and how does context handoff work?",
    answer: "Continuum preserves curated project state, important files, key engineering decisions, pending tasks, and verification evidence across long engineering sessions. Through portable Nexus Capsules (.capsule) validated with SHA-256 integrity checks, fresh AI sessions can resume work without context window degradation.",
  },
  {
    question: "Does NEXUS require cloud AI servers to operate?",
    answer: "No. NEXUS includes a deterministic offline agent fallback that provides AI engineering assistance without mandatory cloud dependence. When external cloud models are enabled, the local workspace remains authoritative.",
  },
  {
    question: "How does the AI Patch Firewall protect my codebase?",
    answer: "The AI Patch Firewall evaluates proposed AST modifications against structural invariant rules and behavioral constraints before code is applied to disk. It ensures changes are verified against behavioral equivalence tests and prevents unconstrained side-effects.",
  },
  {
    question: "What is the roadmap for multi-model AI, multi-chat, and database connections?",
    answer: "Our future roadmap includes an expanding model layer for Gemini, GPT, Claude, Grok, and DeepSeek, persistent multi-chat session threads, optional database integrations (Supabase, MongoDB, PostgreSQL), and deployment connections (Vercel, Render, Netlify).",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-16 bg-[#050508] border-b border-[#1f1f24] font-mono text-xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="space-y-3 mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-zinc-100 tracking-tight">
            Product &amp; Technical Architecture FAQs
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
            Everything you need to know about NEXUS, local-first execution, Continuum, and our roadmap.
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
