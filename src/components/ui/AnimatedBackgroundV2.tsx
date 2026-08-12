"use client";

import { motion } from "framer-motion";

export default function AnimatedBackgroundV2() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Base Layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* SVG Noise Texture Filter */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Drifting Grid */}
      <div className="absolute inset-0 bg-grid-pattern-v2 opacity-30 animate-grid-drift" />

      {/* Scanline Overlay */}
      <div className="absolute inset-0 scanline opacity-20" />

      {/* Viewport Center Cyan Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-radial-gradient-v2 opacity-90" />

      {/* Pulsing Cyan Ambient Orb */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -30, 20, 0],
          opacity: [0.12, 0.25, 0.12],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[130px]"
      />

      {/* Pulsing Violet Ambient Orb */}
      <motion.div
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 40, -25, 0],
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-1/4 w-[520px] h-[520px] rounded-full bg-purple-600/10 blur-[150px]"
      />

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
    </div>
  );
}
