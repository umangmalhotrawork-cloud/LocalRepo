import Link from "next/link";
import { Activity, ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#050505] border-t border-[#1f1f1f] pt-16 pb-12 relative z-10 text-zinc-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Col 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="font-heading font-bold text-white text-lg tracking-tight">
                Echo Nullity
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-body">
              A local-first causal code tomography engine that detects semantically vacuous code in AI-generated software systems.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Local-First • Zero Telemetry • MIT License</span>
            </div>
          </div>

          {/* Col 2: Research Concepts */}
          <div>
            <h4 className="font-mono text-xs font-semibold text-white uppercase tracking-wider mb-4">
              Research Concepts
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/research" className="hover:text-cyan-400 transition-colors">
                  Causal Luminance Metric
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-cyan-400 transition-colors">
                  Ghost Code Visualization
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-cyan-400 transition-colors">
                  Semantic Tension Mapping
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="hover:text-cyan-400 transition-colors">
                  Differential Mutation Verification
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="hover:text-cyan-400 transition-colors">
                  Causal Provenance Replay
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Navigation */}
          <div>
            <h4 className="font-mono text-xs font-semibold text-white uppercase tracking-wider mb-4">
              Documentation & Tooling
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/docs" className="hover:text-cyan-400 transition-colors">
                  VS Code Extension Setup
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-cyan-400 transition-colors">
                  CLI Reference (<code className="text-cyan-300">echo-nullity</code>)
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="hover:text-cyan-400 transition-colors">
                  Safe Remove Surgery Protocol
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-cyan-400 transition-colors">
                  NullBench Benchmark Dataset
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-cyan-400 transition-colors">
                  Interactive Tomography Workbench
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Engine Tech Stack */}
          <div>
            <h4 className="font-mono text-xs font-semibold text-white uppercase tracking-wider mb-4">
              Engine Tech Stack
            </h4>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                Rust 1.80+
              </span>
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                Tree-sitter
              </span>
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                petgraph
              </span>
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                D3.js
              </span>
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                TypeScript
              </span>
              <span className="px-2.5 py-1 bg-[#141414] border border-[#262626] rounded-md text-zinc-300">
                MessagePack
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed font-body">
              Designed for YC demo, PLDI/ICSE research, GitHub open-source, and major software engineering portfolios.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            © {new Date().getFullYear()} Echo Nullity Project. Released under the MIT License.
          </div>
          <div className="flex items-center gap-6">
            <span>Scan Time: &lt;5s</span>
            <span>Incremental: &lt;300ms</span>
            <span>Rollback: &lt;1s</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
