"use client";

import { useState, useEffect } from "react";
import { BookOpen, Terminal, ShieldCheck, Settings, HelpCircle, Code, Check, ExternalLink, Github } from "lucide-react";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("install");
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sections = [
    { id: "install", name: "Installation & Requirements" },
    { id: "quickstart", name: "Quick Start Guide" },
    { id: "vscode", name: "VS Code Extension Usage" },
    { id: "cli", name: "CLI Command Reference" },
    { id: "saferemove", name: "Safe Remove Surgery Protocol" },
    { id: "config", name: "Configuration (nullity.toml)" },
    { id: "troubleshooting", name: "Troubleshooting & FAQ" },
  ];

  return (
    <div className="relative">
      {/* Top Reading Progress Bar */}
      <div className="fixed top-[64px] left-0 right-0 h-1 bg-[#1f1f1f] z-30">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-150 shadow-cyan-glow"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Sticky Sidebar Navigation */}
          <div className="lg:col-span-3 sticky top-24 space-y-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-4 font-mono text-xs shadow-2xl">
            <div className="px-3 py-2 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              Documentation Sitemap
            </div>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                  activeSection === sec.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                {sec.name}
              </button>
            ))}

            <div className="pt-4 border-t border-[#1a1a1a]">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#141414] border border-[#242424] text-zinc-400 hover:text-white transition-colors"
              >
                <span>Edit on GitHub</span>
                <Github className="w-3.5 h-3.5 text-cyan-400" />
              </a>
            </div>
          </div>

          {/* Main Content Pane Max Width 760px */}
          <div className="lg:col-span-9 max-w-[760px] space-y-12 bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 p-8 sm:p-12 text-sm shadow-2xl">
            
            {/* Installation */}
            {activeSection === "install" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">Installation & System Requirements</h1>
                <p className="text-zinc-400 leading-relaxed font-body">
                  Echo Nullity is designed as a local-first static analysis engine compiled natively in Rust with TypeScript editor integrations.
                </p>

                <div className="space-y-3 font-mono text-xs">
                  <h3 className="text-white font-bold text-sm">System Prerequisites</h3>
                  <ul className="space-y-2 text-zinc-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Rust 1.80+ (with <code className="text-cyan-300">cargo</code> toolchain)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Node.js 20+ & npm / pnpm</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>VS Code 1.90+ (for extension)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Git 2.40+ (for automatic rollback snapshot management)</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <h3 className="text-white font-bold text-sm">Installing the CLI Tool</h3>
                  <pre className="p-4 rounded-xl bg-[#050505] text-cyan-300 border border-[#181818]">
                    cargo install echo-nullity-cli
                  </pre>
                </div>
              </div>
            )}

            {/* Quickstart */}
            {activeSection === "quickstart" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">Quick Start Guide</h1>
                <p className="text-zinc-400 leading-relaxed font-body">
                  Analyze a codebase in three simple steps using the local CLI binary:
                </p>

                <div className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-2">
                    <div className="text-cyan-400 font-bold">Step 1: Scan Directory</div>
                    <pre className="text-zinc-300">echo-nullity scan ./my-project</pre>
                  </div>

                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-2">
                    <div className="text-purple-400 font-bold">Step 2: Preview Safe Remove</div>
                    <pre className="text-zinc-300">echo-nullity safe-remove --preview src/cart.py:12-18</pre>
                  </div>

                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-2">
                    <div className="text-emerald-400 font-bold">Step 3: Execute Verified Patch</div>
                    <pre className="text-zinc-300">echo-nullity safe-remove --apply src/cart.py:12-18</pre>
                  </div>
                </div>
              </div>
            )}

            {/* VS Code */}
            {activeSection === "vscode" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">VS Code Extension Usage</h1>
                <p className="text-zinc-400 leading-relaxed font-body">
                  The Echo Nullity extension provides real-time Causal Tomography while you code inside VS Code:
                </p>
                <ul className="space-y-3 text-zinc-300 font-mono text-xs">
                  <li>• <strong>Ghost Opacity:</strong> Lines with 0.00 Causal Luminance fade to 20% opacity automatically.</li>
                  <li>• <strong>Provenance Hover:</strong> Hover over any ghosted line to inspect its mathematical necessity proof.</li>
                  <li>• <strong>Safe Remove Lens:</strong> Click the CodeLens action button directly above ghosted functions to execute AST surgery.</li>
                </ul>
              </div>
            )}

            {/* CLI */}
            {activeSection === "cli" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">CLI Command Reference</h1>
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
                    <span className="text-cyan-400 font-bold">echo-nullity scan &lt;path&gt;</span>
                    <p className="text-zinc-400">Scans specified repository path for Ghost Code and Semantic Tension clusters.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
                    <span className="text-purple-400 font-bold">echo-nullity safe-remove --preview &lt;file:lines&gt;</span>
                    <p className="text-zinc-400">Outputs unified AST diff preview without modifying files.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
                    <span className="text-emerald-400 font-bold">echo-nullity safe-remove --apply &lt;file:lines&gt;</span>
                    <p className="text-zinc-400">Runs differential mutation sandbox tests and applies AST patch if green.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#050505] border border-[#181818] space-y-1">
                    <span className="text-amber-400 font-bold">echo-nullity rollback &lt;snapshot-id&gt;</span>
                    <p className="text-zinc-400">Instantly restores state from local compressed snapshot (&lt;1s).</p>
                  </div>
                </div>
              </div>
            )}

            {/* Safe Remove Protocol */}
            {activeSection === "saferemove" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">Safe Remove Surgery Protocol</h1>
                <p className="text-zinc-400 leading-relaxed font-body">
                  Safe Remove performs verified, reversible semantic surgery on a live codebase across 6 isolation steps:
                </p>
                <ol className="space-y-2 font-mono text-xs text-zinc-300 list-decimal pl-5">
                  <li>Preview candidate removal as unified AST diff.</li>
                  <li>Run static dependency graph audit.</li>
                  <li>Run side-effect taxonomy check (Pure vs. IO vs. Logging).</li>
                  <li>Execute differential mutation run inside isolated sandbox.</li>
                  <li>Apply patch only after 100% verification passes.</li>
                  <li>Store local compressed rollback snapshot automatically.</li>
                </ol>
              </div>
            )}

            {/* Configuration */}
            {activeSection === "config" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">Configuration (nullity.toml)</h1>
                <pre className="p-4 rounded-xl bg-[#050505] text-cyan-300 font-mono text-xs border border-[#181818] overflow-x-auto leading-relaxed">
{`[engine]
min_luminance_threshold = 0.05
tension_cluster_threshold = 0.85
languages = ["python", "cpp", "rust"]

[sandbox]
isolation = "subprocess"
timeout_ms = 5000
allow_logging_side_effects = false

[rollback]
max_snapshots = 50
auto_stash = true`}
                </pre>
              </div>
            )}

            {/* Troubleshooting */}
            {activeSection === "troubleshooting" && (
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">Troubleshooting & FAQ</h1>
                <p className="text-zinc-400 leading-relaxed font-body">
                  For complete troubleshooting details, refer to the FAQ on the home page or open an issue on the GitHub repository.
                </p>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
