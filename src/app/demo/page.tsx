"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldCheck, Play, RotateCcw, AlertTriangle, Eye, Layers, Sparkles, Check, ChevronRight, Sliders } from "lucide-react";

export default function DemoPage() {
  const [intensity, setIntensity] = useState(0.8);
  const [activeTab, setActiveTab] = useState<"code" | "diff" | "tension">("code");
  const [surgeryApplied, setSurgeryApplied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [terminalStage, setTerminalStage] = useState<number>(0);

  const applySurgery = () => {
    setVerifying(true);
    setTerminalStage(1);

    setTimeout(() => setTerminalStage(2), 300);
    setTimeout(() => setTerminalStage(3), 600);
    setTimeout(() => {
      setVerifying(false);
      setSurgeryApplied(true);
      setTerminalStage(4);
    }, 900);
  };

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Workbench Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-5 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h1 className="text-xl font-heading font-bold text-white tracking-tight">
              Echo Nullity Tomography Workbench V2
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Interactive full-screen IDE simulator • Tree-sitter & petgraph Engine Active
          </p>
        </div>

        {/* Intensity Slider & Reset Controls */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <div className="flex items-center gap-2 bg-[#141414] px-3 py-1.5 rounded-xl border border-[#262626]">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-400">Intensity:</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
            <span className="text-cyan-400 font-bold w-8">{intensity.toFixed(1)}</span>
          </div>

          <button
            onClick={() => {
              setSurgeryApplied(false);
              setVerifying(false);
              setTerminalStage(0);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset State</span>
          </button>
        </div>
      </div>

      {/* Main Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Editor Tabs & Viewer */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* View Tabs */}
          <div className="flex items-center gap-2 bg-[#0a0a0a] p-1.5 rounded-24 border border-[#1f1f1f] font-mono text-xs">
            <button
              onClick={() => setActiveTab("code")}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === "code"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Ghost Code Heatmap
            </button>
            <button
              onClick={() => setActiveTab("diff")}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === "diff"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Safe Remove AST Diff
            </button>
            <button
              onClick={() => setActiveTab("tension")}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === "tension"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Cluster Tension View
            </button>
          </div>

          {/* Tab 1: Code Heatmap Editor */}
          {activeTab === "code" && (
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 overflow-hidden font-mono text-xs shadow-2xl">
              <div className="px-4 py-3 bg-[#0d0d0d] border-b border-[#1f1f1f] flex items-center justify-between text-zinc-400">
                <span className="text-cyan-400 font-bold">src/cart_calculator.py</span>
                <span>Python AST • Heatmap Overlay Active</span>
              </div>

              <div className="p-6 space-y-2.5 bg-[#050505] leading-relaxed text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-zinc-600 select-none w-6 text-right text-xs">1</span>
                  <span><span className="text-purple-400 font-semibold">def</span> <span className="text-blue-400 font-semibold">process_cart_total</span>(<span className="text-orange-300">items</span>, <span className="text-orange-300">discount</span>):</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-zinc-600 select-none w-6 text-right text-xs">2</span>
                  <span className="pl-4">subtotal = <span className="text-blue-400">sum</span>(item.price <span className="text-purple-400">for</span> item <span className="text-purple-400">in</span> items)</span>
                </div>

                {/* Ghost line A */}
                {!surgeryApplied ? (
                  <div
                    style={{ opacity: Math.max(0.1, 1 - intensity * 0.8) }}
                    className="flex items-center gap-4 bg-cyan-950/40 -mx-6 px-6 py-1.5 border-l-4 border-cyan-400 transition-opacity"
                  >
                    <span className="text-cyan-500 select-none w-6 text-right text-xs">3</span>
                    <span className="pl-4 text-zinc-300 line-through decoration-cyan-400">
                      subtotal = subtotal * 1.0  <span className="text-zinc-600"># Identity scaling</span>
                    </span>
                    <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                      Luminance: 0.00
                    </span>
                  </div>
                ) : null}

                {/* Ghost line B */}
                {!surgeryApplied ? (
                  <div
                    style={{ opacity: Math.max(0.1, 1 - intensity * 0.8) }}
                    className="flex items-center gap-4 bg-cyan-950/40 -mx-6 px-6 py-1.5 border-l-4 border-cyan-400 transition-opacity"
                  >
                    <span className="text-cyan-500 select-none w-6 text-right text-xs">4</span>
                    <span className="pl-4 text-zinc-300 line-through decoration-cyan-400">
                      subtotal = subtotal + 0.00  <span className="text-zinc-600"># Vacuous float add</span>
                    </span>
                    <span className="ml-auto text-[10px] text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-500/40">
                      Ghost Code
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center gap-4">
                  <span className="text-zinc-600 select-none w-6 text-right text-xs">{surgeryApplied ? "3" : "5"}</span>
                  <span className="pl-4">final_total = subtotal - discount</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-zinc-600 select-none w-6 text-right text-xs">{surgeryApplied ? "4" : "6"}</span>
                  <span className="pl-4"><span className="text-purple-400">return</span> <span className="text-blue-400">max</span>(0, final_total)</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Diff Preview with Green/Red Highlights */}
          {activeTab === "diff" && (
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-6 font-mono text-xs space-y-4 shadow-2xl">
              <div className="text-purple-300 font-bold text-sm">Unified AST Surgery Diff Preview</div>
              <pre className="p-4 rounded-xl bg-[#050505] text-zinc-300 overflow-x-auto border border-[#181818] leading-relaxed">
<span className="text-zinc-500">--- a/src/cart_calculator.py</span>{`
`}<span className="text-zinc-500">+++ b/src/cart_calculator.py</span>{`
`}<span className="text-purple-400">@@ -3,2 +3,0 @@</span>{`
`}<span className="text-red-400 bg-red-950/40 px-1 font-bold">-    subtotal = subtotal * 1.0</span>{`
`}<span className="text-red-400 bg-red-950/40 px-1 font-bold">-    subtotal = subtotal + 0.00</span>{`
`}
              </pre>
              <p className="text-zinc-400 text-xs font-sans">
                AST Node transformations preserve comments, line endings, and indentation.
              </p>
            </div>
          )}

          {/* Tab 3: Tension Cluster */}
          {activeTab === "tension" && (
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-6 font-mono text-xs space-y-4 shadow-2xl">
              <div className="text-amber-300 font-bold text-sm">Semantic Tension Cluster Analysis</div>
              <div className="p-4 bg-[#050505] rounded-xl border border-[#181818] space-y-2">
                <div className="flex items-center justify-between text-amber-400 font-bold">
                  <span>Cluster #104 (5 Files Matching)</span>
                  <span>Tension Score: 0.94</span>
                </div>
                <p className="text-zinc-400 text-xs font-sans">
                  The AI code generator introduced the exact same identity arithmetic scaling pattern in <code className="text-cyan-300">cart_calculator.py</code>, <code className="text-cyan-300">invoice.py</code>, and <code className="text-cyan-300">checkout.py</code>.
                </p>
              </div>
            </div>
          )}

          {/* Staged Terminal Sandbox Console Output */}
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-5 font-mono text-xs space-y-2 shadow-2xl">
            <div className="flex items-center justify-between text-zinc-500 pb-2 border-b border-[#1f1f1f]">
              <span className="text-cyan-400 font-bold">DIFFERENTIAL MUTATION SANDBOX CONSOLE</span>
              <span>Subprocess Runner</span>
            </div>

            <div className="p-3 bg-[#050505] rounded-xl text-zinc-300 space-y-1 min-h-[90px]">
              {terminalStage === 0 && <span className="text-zinc-500">Ready. Click &quot;Run Safe Remove Surgery&quot; to execute mutation sandbox.</span>}
              {terminalStage >= 1 && <div className="text-cyan-400">&gt; Spawning subprocess sandbox runner... [OK]</div>}
              {terminalStage >= 2 && <div className="text-purple-400">&gt; Bypassing AST nodes lines 3-4... [OK]</div>}
              {terminalStage >= 3 && <div className="text-teal-400">&gt; Rerunning 14 unit test assertions... [14/14 PASSED]</div>}
              {terminalStage >= 4 && <div className="text-emerald-400 font-bold">&gt; 0.00% behavioral deviation verified. Patch applied successfully!</div>}
            </div>
          </div>

        </div>

        {/* Right Column: Tomography Provenance Side Panel */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-6 space-y-6 shadow-2xl">
          <div className="pb-4 border-b border-[#1f1f1f] space-y-1">
            <h3 className="text-base font-heading font-bold text-white">Provenance Replay Panel</h3>
            <p className="text-xs text-zinc-400 font-mono">Causal Explanation Timeline</p>
          </div>

          {/* Provenance Steps */}
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
              <span className="text-cyan-400 font-bold">Step 1: AST Extraction</span>
              <p className="text-zinc-400 text-[11px]">Tree-sitter identified 14 AST expression statements.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
              <span className="text-purple-400 font-bold">Step 2: Path Condition Collapse</span>
              <p className="text-zinc-400 text-[11px]">Identity operation <code className="text-purple-300">x * 1.0</code> proved mathematically invariant.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
              <span className="text-emerald-400 font-bold">Step 3: Sandbox Verification</span>
              <p className="text-zinc-400 text-[11px]">100% unit test suite execution match achieved.</p>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-2">
            {!surgeryApplied ? (
              <button
                onClick={applySurgery}
                disabled={verifying}
                className="w-full py-3.5 px-4 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-cyan-glow transition-all disabled:opacity-50"
              >
                {verifying ? (
                  <span>Executing Differential Sandbox Tests...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-black" />
                    <span>Run Safe Remove Surgery</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-4 rounded-24 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Surgery Verified & Applied</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Snapshot <code className="text-cyan-300">en_20260812_104512</code> saved for 1-click rollback.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
