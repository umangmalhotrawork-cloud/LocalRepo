"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Terminal, Play } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-24 bg-[#000000] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Glowing Gradient Container */}
        <div className="relative rounded-24 bg-gradient-to-r from-cyan-950/80 via-black to-purple-950/80 border border-cyan-500/40 p-10 sm:p-16 text-center space-y-8 shadow-[0_0_90px_rgba(34,211,238,0.25)] overflow-hidden">
          
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-500/20 blur-[140px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
              <span>START CAUSAL ANALYSIS TODAY</span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-heading font-extrabold text-white tracking-tight leading-tight">
              Stop maintaining code that <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent">never mattered.</span>
            </h2>

            <p className="text-zinc-300 text-base sm:text-lg leading-relaxed font-body">
              Purify your AI-assisted codebases with verified Safe Remove surgery. Completely open source and local-first.
            </p>
          </div>

          {/* Magnetic CTA Buttons */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 pt-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-sm shadow-cyan-glow transition-all"
              >
                <Terminal className="w-4 h-4 fill-black" />
                <span>Get Started</span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#0a0a0a] hover:bg-[#141414] border border-[#1f1f1f] hover:border-cyan-500/40 text-white font-semibold text-sm transition-all"
              >
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                <span>Watch Demo</span>
              </Link>
            </motion.div>
          </div>

        </div>

      </div>
    </section>
  );
}
