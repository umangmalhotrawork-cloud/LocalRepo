"use client";

import { motion } from "framer-motion";

interface CodeTransitionProps {
  lines?: string[];
}

const defaultLines = [
  "> parsing AST via Tree-sitter...",
  "> building petgraph CFG/DFG...",
  "> computing Causal Luminance path conditions...",
  "> verifying differential mutation sandbox...",
];

export default function CodeTransition({ lines = defaultLines }: CodeTransitionProps) {
  return (
    <div className="py-8 bg-black/40 border-y border-[#181818] overflow-hidden my-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-mono text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-4">
        {lines.map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.4, delay: index * 0.12 }}
            className="flex items-center gap-2"
          >
            <span className="text-cyan-400 font-bold">&gt;</span>
            <span className="text-zinc-400 hover:text-cyan-300 transition-colors">
              {line.replace(/^>\s*/, "")}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
