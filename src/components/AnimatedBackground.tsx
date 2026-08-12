"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Radial Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-radial-gradient opacity-80" />

      {/* Pulsing Cyan Ambient Orb */}
      <motion.div
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-cyan-500/10 blur-[120px]"
      />

      {/* Pulsing Violet Ambient Orb */}
      <motion.div
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 50, -30, 0],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[140px]"
      />

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
