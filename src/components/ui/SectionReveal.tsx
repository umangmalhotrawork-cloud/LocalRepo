"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionRevealProps {
  children: ReactNode;
  id?: string;
  className?: string;
  label?: string;
}

export default function SectionReveal({
  children,
  id,
  className = "",
  label,
}: SectionRevealProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0.4, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${className}`}
    >
      {label && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0a0a0a] border border-[#1f1f1f] text-[10px] font-mono text-zinc-500">
            <span className="text-cyan-400 font-bold">&gt;</span>
            <span>{label}</span>
          </div>
        </div>
      )}
      {children}
    </motion.section>
  );
}
