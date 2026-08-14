"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Zap, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export default function TensionGraph() {
  const [selectedNode, setSelectedNode] = useState<string>("node-1");

  const graphNodes = [
    { id: "node-1", name: "cart.py:calculate()", file: "src/cart.py", tension: "0.92", cluster: "Cluster Alpha", ghostLines: 2, status: "Ghost Code" },
    { id: "node-2", name: "checkout.py:compute_total()", file: "src/checkout.py", tension: "0.91", cluster: "Cluster Alpha", ghostLines: 4, status: "Ghost Code" },
    { id: "node-3", name: "invoice.py:get_subtotal()", file: "src/invoice.py", tension: "0.89", cluster: "Cluster Alpha", ghostLines: 2, status: "Ghost Code" },
    { id: "node-4", name: "order.py:apply_fees()", file: "src/order.py", tension: "0.93", cluster: "Cluster Alpha", ghostLines: 3, status: "Ghost Code" },
    { id: "node-5", name: "discount.py:adjust_price()", file: "src/discount.py", tension: "0.90", cluster: "Cluster Alpha", ghostLines: 2, status: "Ghost Code" },
  ];

  const active = graphNodes.find((n) => n.id === selectedNode) || graphNodes[0];

  return (
    <section className="py-24 bg-[#050505] relative border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copy */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-mono">
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Semantic Tension Mapping</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight">
              Cross-File Equivalence Clustering
            </h2>

            <p className="text-zinc-400 text-sm leading-relaxed font-body">
              AI code generators frequently repeat the exact same semantically empty logic patterns across multiple distinct modules, disguised behind minor variable renaming.
            </p>

            <blockquote className="p-4 rounded-xl bg-[#0a0a0a] border-l-4 border-amber-400 text-amber-200 text-xs font-mono italic">
              &quot;The AI wrote the same empty logic in five different files.&quot;
            </blockquote>

            <div className="space-y-3 font-mono text-xs text-zinc-300">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
                <span className="text-zinc-400">Canonicalization Algorithm:</span>
                <span className="text-cyan-400 font-bold">AST Tree Edit Distance</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
                <span className="text-zinc-400">Redundant Cluster Threshold:</span>
                <span className="text-purple-400 font-bold">&gt; 0.85 Tension</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Graph Container */}
          <div className="lg:col-span-7 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-6 shadow-2xl relative">
            
            {/* Top Badge Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#1f1f1f] mb-4 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-zinc-200 font-semibold">TENSION MATRIX ACTIVE</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 font-bold">
                Tension: 0.92
              </div>
            </div>

            {/* Canvas / SVG Force Graph View */}
            <div className="relative w-full h-[340px] bg-[#050505] rounded-2xl border border-[#181818] overflow-hidden flex items-center justify-center">
              
              {/* Connected Pulsing Lines SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line x1="220" y1="170" x2="110" y2="80" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" className="animate-pulse" />
                <line x1="220" y1="170" x2="330" y2="90" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" className="animate-pulse" />
                <line x1="220" y1="170" x2="350" y2="250" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" className="animate-pulse" />
                <line x1="220" y1="170" x2="120" y2="260" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" className="animate-pulse" />
                <circle cx="220" cy="170" r="90" fill="none" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" />
              </svg>

              {/* Orbiting Particle Effect around active node */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute w-44 h-44 rounded-full border border-dashed border-amber-400/30 pointer-events-none"
              />

              {/* Node 1 (Center) */}
              <motion.button
                onClick={() => setSelectedNode("node-1")}
                whileHover={{ scale: 1.15 }}
                className={`absolute left-[220px] top-[170px] -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex flex-col items-center justify-center border transition-all ${
                  selectedNode === "node-1"
                    ? "bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110"
                    : "bg-[#111111] border-zinc-700"
                }`}
              >
                <span className="text-[10px] font-mono text-white font-bold">cart.py</span>
                <span className="text-[8px] font-mono text-amber-300">0.92</span>
              </motion.button>

              {/* Node 2 (Top Left) */}
              <motion.button
                onClick={() => setSelectedNode("node-2")}
                whileHover={{ scale: 1.15 }}
                className={`absolute left-[110px] top-[80px] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex flex-col items-center justify-center border transition-all ${
                  selectedNode === "node-2"
                    ? "bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110"
                    : "bg-[#111111] border-zinc-700"
                }`}
              >
                <span className="text-[9px] font-mono text-white font-bold">checkout</span>
              </motion.button>

              {/* Node 3 (Top Right) */}
              <motion.button
                onClick={() => setSelectedNode("node-3")}
                whileHover={{ scale: 1.15 }}
                className={`absolute left-[330px] top-[90px] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex flex-col items-center justify-center border transition-all ${
                  selectedNode === "node-3"
                    ? "bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110"
                    : "bg-[#111111] border-zinc-700"
                }`}
              >
                <span className="text-[9px] font-mono text-white font-bold">invoice</span>
              </motion.button>

              {/* Node 4 (Bottom Right) */}
              <motion.button
                onClick={() => setSelectedNode("node-4")}
                whileHover={{ scale: 1.15 }}
                className={`absolute left-[350px] top-[250px] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex flex-col items-center justify-center border transition-all ${
                  selectedNode === "node-4"
                    ? "bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110"
                    : "bg-[#111111] border-zinc-700"
                }`}
              >
                <span className="text-[9px] font-mono text-white font-bold">order</span>
              </motion.button>

              {/* Node 5 (Bottom Left) */}
              <motion.button
                onClick={() => setSelectedNode("node-5")}
                whileHover={{ scale: 1.15 }}
                className={`absolute left-[120px] top-[260px] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex flex-col items-center justify-center border transition-all ${
                  selectedNode === "node-5"
                    ? "bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] scale-110"
                    : "bg-[#111111] border-zinc-700"
                }`}
              >
                <span className="text-[9px] font-mono text-white font-bold">discount</span>
              </motion.button>
            </div>

            {/* Selected Node Detailed Metadata Overlay */}
            <div className="mt-4 p-4 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-zinc-400">Selected Node: </span>
                <span className="text-cyan-400 font-bold">{active.name}</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-300">
                <span>Tension Score: <strong className="text-amber-400">{active.tension}</strong></span>
                <span className="text-purple-400 font-semibold">{active.ghostLines} Removable Lines</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
