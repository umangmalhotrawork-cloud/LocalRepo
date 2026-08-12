"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Check, Zap, AlertCircle, ShieldCheck, ArrowRight, FileCode2 } from "lucide-react";

export default function CodeDemo() {
  const [removed, setRemoved] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSafeRemove = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setRemoved(true);
    }, 600);
  };

  const handleReset = () => {
    setRemoved(false);
  };

  return (
    <section className="py-20 bg-[#000000] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Tomography Demo</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            See Ghost Code in Action
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            This function runs without errors and passes tests, but lines 2 & 3 have zero causal effect on the program’s return output state.
          </p>
        </div>

        {/* Two-Column Interactive Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Code Window */}
          <div className="lg:col-span-7 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 overflow-hidden flex flex-col justify-between shadow-2xl">
            
            {/* Header tab */}
            <div className="px-5 py-3.5 bg-[#0d0d0d] border-b border-[#1f1f1f] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                <span className="text-zinc-200 font-medium">cart_service.py</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-500">AST Node Tomography</span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] text-zinc-400 hover:text-white transition-all text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo</span>
              </button>
            </div>

            {/* Editor Code Area */}
            <div className="p-6 font-mono text-sm leading-relaxed space-y-2 bg-[#050505] min-h-[220px]">
              {/* Line 1 */}
              <div className="flex items-center gap-4">
                <span className="text-zinc-600 select-none w-5 text-right text-xs">1</span>
                <div>
                  <span className="text-purple-400 font-semibold">def</span>{" "}
                  <span className="text-blue-400 font-semibold">calculate</span>(
                  <span className="text-orange-300">price</span>):
                </div>
              </div>

              {/* Dynamic Lines 2 & 3 */}
              <AnimatePresence mode="wait">
                {!removed ? (
                  <motion.div
                    key="ghost-lines"
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-2"
                  >
                    {/* Line 2 */}
                    <div className="flex items-center gap-4 bg-cyan-950/20 -mx-6 px-6 py-1.5 border-l-2 border-cyan-400/80 transition-opacity">
                      <span className="text-cyan-500 select-none w-5 text-right text-xs">2</span>
                      <span className="text-zinc-300 opacity-20 transition-opacity duration-300 hover:opacity-100">
                        temp = price * 1
                      </span>
                      <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40 font-mono">
                        Causal Impact: 0.00%
                      </span>
                    </div>

                    {/* Line 3 */}
                    <div className="flex items-center gap-4 bg-cyan-950/20 -mx-6 px-6 py-1.5 border-l-2 border-cyan-400/80 transition-opacity">
                      <span className="text-cyan-500 select-none w-5 text-right text-xs">3</span>
                      <span className="text-zinc-300 opacity-20 transition-opacity duration-300 hover:opacity-100">
                        temp = temp + 0
                      </span>
                      <span className="ml-auto text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/40 font-mono">
                        Identity Arithmetic
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="diff-pruned"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 my-2 text-xs font-mono text-emerald-300 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>AST Surgery Applied: 2 Ghost Lines Removed Safely</span>
                    </div>
                    <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                      0.0% Behavioral Shift
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Line 4 / Final Return */}
              <div className="flex items-center gap-4">
                <span className="text-zinc-600 select-none w-5 text-right text-xs">
                  {removed ? "2" : "4"}
                </span>
                <div>
                  <span className="text-purple-400 font-semibold">return</span>{" "}
                  <span className="text-orange-300">price</span>
                </div>
              </div>
            </div>

            {/* Bottom Status bar */}
            <div className="px-5 py-3 bg-[#0d0d0d] border-t border-[#1f1f1f] flex items-center justify-between text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Tree-sitter AST Graph: Verified</span>
              </div>
              <span className="text-zinc-500">Differential Sandbox Isolation</span>
            </div>
          </div>

          {/* Right Column: Tomography Analysis Panel */}
          <div className="lg:col-span-5 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-6 flex flex-col justify-between shadow-2xl relative">
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1f1f1f]">
                <div>
                  <h3 className="text-base font-semibold text-white">Tomography Side Panel</h3>
                  <p className="text-xs text-zinc-400">Causal Provenance Analysis</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 rounded-full">
                  Luminance: 0.00
                </span>
              </div>

              {/* Analysis Metrics */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#111111] rounded-xl border border-[#222222] flex items-center justify-between">
                  <span className="text-zinc-400">Causal Impact:</span>
                  <span className="text-cyan-400 font-bold text-sm">0.00%</span>
                </div>

                <div className="p-3 bg-[#111111] rounded-xl border border-[#222222] flex items-center justify-between">
                  <span className="text-zinc-400">Reason:</span>
                  <span className="text-zinc-200">Identity arithmetic chain</span>
                </div>

                <div className="p-3 bg-[#111111] rounded-xl border border-[#222222] flex items-center justify-between">
                  <span className="text-zinc-400">Safe Remove Status:</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified</span>
                  </span>
                </div>

                <div className="p-3 bg-[#111111] rounded-xl border border-[#222222] flex items-center justify-between">
                  <span className="text-zinc-400">Rollback Snapshot:</span>
                  <span className="text-purple-400">en_20260812_104512</span>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Why is this line ghosted?</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The expression <code className="text-purple-300">price * 1</code> followed by <code className="text-purple-300">+ 0</code> leaves the state variable identical to <code className="text-purple-300">price</code>. Removing both lines preserves 100% of input/output contracts.
                </p>
              </div>

            </div>

            {/* Safe Remove Button */}
            <div className="pt-6">
              {!removed ? (
                <button
                  onClick={handleSafeRemove}
                  disabled={verifying}
                  className="w-full py-3.5 px-4 rounded-24 bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-400 hover:from-cyan-300 hover:to-teal-300 text-black font-semibold text-sm flex items-center justify-center gap-2 shadow-cyan-glow transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {verifying ? (
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Running Differential Sandbox Verification...</span>
                    </div>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-black" />
                      <span>Apply Safe Remove Surgery</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full py-3 px-4 rounded-24 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Patch Applied & Verification Green</span>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-zinc-400 hover:text-white underline"
                  >
                    Restore
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
