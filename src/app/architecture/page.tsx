"use client";

import { useState } from "react";
import { Cpu, Terminal, GitBranch, ShieldCheck, FolderTree, Play, Check, Copy, ChevronRight, ChevronDown } from "lucide-react";

export default function ArchitecturePage() {
  const [cliCommand, setCliCommand] = useState("echo-nullity scan ./project");
  const [cliOutput, setCliOutput] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [repoExpanded, setRepoExpanded] = useState(true);

  const runCliSim = (cmd: string) => {
    setCliCommand(cmd);
    if (cmd.includes("scan")) {
      setCliOutput(
        `[ECHO NULLITY SCANNER v1.0.0]\nScanning ./project (42 files, 12,450 LOC)...\nParsing ASTs via Tree-sitter... [DONE]\nConstructing CFG/DFG petgraph... [DONE]\nEvaluating Causal Luminance... [DONE]\n\nFINDINGS:\n- Ghost Code Ratio: 14.2%\n- Removable Null Lines: 312\n- Redundant Clusters: 9 (Tension > 0.85)\n\nRun 'echo-nullity safe-remove --preview <file:lines>' to inspect surgical patch.`
      );
    } else if (cmd.includes("safe-remove --preview")) {
      setCliOutput(
        `[SAFE REMOVE PREVIEW]\nTarget: src/cart.py:12-18\nCandidate AST Nodes: Ident Arithmetic Chain\n\n--- a/cart.py\n+++ b/cart.py\n@@ -12,4 +12,2 @@\n-    temp = price * 1\n-    temp = temp + 0\n     return price\n\nSanity Audit: Pure Computation (No Side Effects)\nRun 'echo-nullity safe-remove --verify src/cart.py:12-18' to initiate sandbox.`
      );
    } else if (cmd.includes("rollback")) {
      setCliOutput(
        `[ROLLBACK RESTORATION]\nSnapshot Target: en_20260812_104512\nRestoring git stash / local compressed state...\nRestoring AST decorations... [DONE]\nRepository returned to exact state before surgery (<0.3s).`
      );
    } else {
      setCliOutput(
        `[DIFFERENTIAL MUTATION SANDBOX]\nExecuting test suite in isolated runner...\nTest Suite Status: PASSED (14/14 tests green)\nObservable State Shift: 0.000%\nPatch Verified. Ready for auto-apply.`
      );
    }
  };

  const copyCmd = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="py-12 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      
      {/* Header */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATION</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-heading font-extrabold text-white tracking-tight">
          Engine Architecture & Data Flow
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-body">
          A multi-layered Rust engine driving local-first causal code tomography and AST surgery.
        </p>
      </div>

      {/* Component Breakdown Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          System Component Breakdown
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-cyan-400 font-bold">1. Parser (Tree-sitter)</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Concrete Syntax Tree parsing supporting Python, C++, and Rust with fast incremental updates.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-cyan-400 font-bold">2. CFG/DFG Builder</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Built on Rust petgraph to model intra-procedural control flows and value propagation.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-purple-400 font-bold">3. Luminance Engine</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Estimates path condition collapse and computes line-by-line necessity scores (0.0 to 1.0).
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-purple-400 font-bold">4. Tension Engine</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Normalizes ASTs (strips literals/identifiers) to compute Zhang-Shasha Tree Edit Distance.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-emerald-400 font-bold">5. Differential Verifier</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Runs mutation execution sandboxes to verify program output stability prior to patch application.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-emerald-400 font-bold">6. Provenance Engine</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Generates human-readable explanation chains for why ghost lines have zero causal impact.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-amber-400 font-bold">7. VS Code Layer</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Renders inline opacity highlights, hover tooltips, side panels, and Safe Remove actions.
            </p>
          </div>

          <div className="p-5 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] hover:border-cyan-500/40 transition-colors space-y-2">
            <h3 className="text-amber-400 font-bold">8. GitHub Action</h3>
            <p className="text-zinc-400 font-sans text-xs">
              Headless CI/CD check enforcing Ghost Code ratio limits on pull requests automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Technology Stack Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-heading font-bold text-white tracking-tight">Technology Stack Specification</h2>
        
        <div className="rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden font-mono text-xs shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111111] border-b border-[#1f1f1f] text-cyan-400">
                <th className="p-4">Subsystem</th>
                <th className="p-4">Technology</th>
                <th className="p-4">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181818] text-zinc-300">
              <tr>
                <td className="p-4 font-semibold text-white">Core Engine</td>
                <td className="p-4 text-cyan-400">Rust 1.80+</td>
                <td className="p-4 text-zinc-400">High performance, memory safety, multithreaded AST graph traversal.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Parsing Layer</td>
                <td className="p-4 text-cyan-400">Tree-sitter C/Rust bindings</td>
                <td className="p-4 text-zinc-400">Incremental parsing for Python, C++, and Rust.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Graph Modeling</td>
                <td className="p-4 text-cyan-400">petgraph crate</td>
                <td className="p-4 text-zinc-400">Control Flow Graph (CFG) and Data Flow Graph (DFG) data structures.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">IDE Integration</td>
                <td className="p-4 text-cyan-400">TypeScript + VS Code API</td>
                <td className="p-4 text-zinc-400">Inline text decorations, provenance sideview, diff editor.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Serialization</td>
                <td className="p-4 text-cyan-400">MessagePack (rmp-serde)</td>
                <td className="p-4 text-zinc-400">Zero-copy IPC serialization between Rust binary and Extension Host.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Repository Tree Explorer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-cyan-400" />
            Recommended Repository Directory Layout
          </h2>

          <button
            onClick={() => setRepoExpanded(!repoExpanded)}
            className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
          >
            {repoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>{repoExpanded ? "Collapse Tree" : "Expand Tree"}</span>
          </button>
        </div>

        {repoExpanded && (
          <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] font-mono text-xs text-cyan-300 space-y-1.5 overflow-x-auto shadow-2xl">
            <div className="text-white font-bold">echo-nullity/</div>
            <div className="pl-4 text-cyan-400">├── core/</div>
            <div className="pl-8 text-zinc-400">│   ├── parser/      # Tree-sitter parsers for Python, C++, Rust</div>
            <div className="pl-8 text-zinc-400">│   ├── cfg/         # Control Flow Graph builder (petgraph)</div>
            <div className="pl-8 text-zinc-400">│   ├── dfg/         # Data Flow Graph value propagation</div>
            <div className="pl-8 text-zinc-400">│   ├── luminance/   # Causal Luminance path-condition collapse engine</div>
            <div className="pl-8 text-zinc-400">│   ├── tension/     # AST canonicalization & Tree Edit Distance</div>
            <div className="pl-8 text-zinc-400">│   ├── provenance/  # Replay explanation generator</div>
            <div className="pl-8 text-zinc-400">│   ├── verifier/    # Subprocess differential mutation sandbox</div>
            <div className="pl-8 text-zinc-400">│   └── patterns/    # Identity operation taxonomy</div>
            <div className="pl-4 text-cyan-400">├── frontend/</div>
            <div className="pl-8 text-zinc-400">│   └── vscode/      # TypeScript VS Code extension layer</div>
            <div className="pl-4 text-cyan-400">├── integrations/</div>
            <div className="pl-8 text-zinc-400">│   ├── github-action/ # Headless CI/CD runner</div>
            <div className="pl-8 text-zinc-400">│   └── pre-commit/    # Local git pre-commit hook</div>
            <div className="pl-4 text-cyan-400">├── benchmarks/</div>
            <div className="pl-8 text-zinc-400">│   └── nullbench/   # 200 annotated benchmark functions</div>
            <div className="pl-4 text-cyan-400">├── docs/</div>
            <div className="pl-4 text-cyan-400">└── tests/</div>
          </div>
        )}
      </div>

      {/* Interactive CLI Runner Simulator with Copy Buttons */}
      <div className="space-y-4">
        <h2 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
          <Terminal className="w-5 h-5 text-purple-400" />
          Interactive CLI Simulator (<code className="text-cyan-400">echo-nullity</code>)
        </h2>

        <div className="p-6 rounded-24 bg-[#0a0a0a] border border-[#1f1f1f] space-y-4 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <button
                onClick={() => runCliSim("echo-nullity scan ./project")}
                className="px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-cyan-300"
              >
                echo-nullity scan ./project
              </button>
              <button
                onClick={() => runCliSim("echo-nullity safe-remove --preview src/cart.py:12-18")}
                className="px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-purple-300"
              >
                echo-nullity safe-remove --preview ...
              </button>
              <button
                onClick={() => runCliSim("echo-nullity safe-remove --verify src/cart.py:12-18")}
                className="px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-emerald-300"
              >
                echo-nullity safe-remove --verify ...
              </button>
              <button
                onClick={() => runCliSim("echo-nullity rollback en_20260812_104512")}
                className="px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-amber-300"
              >
                echo-nullity rollback ...
              </button>
            </div>

            <button
              onClick={copyCmd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-[#202020] border border-[#262626] text-zinc-300 font-mono text-xs"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedCmd ? "Copied" : "Copy Command"}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] font-mono text-xs text-zinc-300 min-h-[160px] whitespace-pre-wrap leading-relaxed">
            {cliOutput || "Click a CLI command button above to execute simulated tomography command..."}
          </div>
        </div>
      </div>

    </div>
  );
}
