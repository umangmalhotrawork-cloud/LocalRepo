"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Terminal, BookOpen, Cpu, ShieldCheck, Sparkles, X, ArrowRight } from "lucide-react";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const router = RouterHook();

  function RouterHook() {
    return useRouter();
  }

  const items = [
    { name: "Home Landing Page", path: "/", icon: Sparkles, cat: "Navigation" },
    { name: "Research Microsite & Academic Spec", path: "/research", icon: BookOpen, cat: "Research" },
    { name: "Architecture & Data Flow Pipeline", path: "/architecture", icon: Cpu, cat: "System" },
    { name: "Interactive Tomography Workbench", path: "/demo", icon: Terminal, cat: "Demo" },
    { name: "Developer Documentation & CLI Ref", path: "/docs", icon: ShieldCheck, cat: "Docs" },
  ];

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(query.toLowerCase()) ||
      i.cat.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via document event or parent handler
          window.dispatchEvent(new CustomEvent("toggle-cmd-k"));
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-xl bg-[#0a0a0a] border border-[#1f1f1f] rounded-24 shadow-2xl overflow-hidden font-sans"
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-[#1f1f1f] flex items-center gap-3 bg-[#0d0d0d]">
              <Search className="w-5 h-5 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search documentation..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
                autoFocus
              />
              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-white rounded-lg bg-[#161616] border border-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="p-3 max-h-80 overflow-y-auto space-y-1 font-mono text-xs">
              <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Command Navigation
              </div>

              {filtered.length > 0 ? (
                filtered.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleSelect(item.path)}
                      className="w-full p-3 rounded-xl flex items-center justify-between text-left hover:bg-[#141414] hover:border hover:border-cyan-500/30 text-zinc-300 hover:text-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <div>
                          <span className="font-semibold text-sm block">{item.name}</span>
                          <span className="text-[10px] text-zinc-500">{item.cat}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                    </button>
                  );
                })
              ) : (
                <div className="p-6 text-center text-zinc-500">
                  No matching commands found.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0d0d0d] border-t border-[#1f1f1f] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#242424] text-zinc-300">↵</span>
                <span>to select</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#242424] text-zinc-300">esc</span>
                <span>to close</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
