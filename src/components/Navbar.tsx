"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Github, Sparkles, Command, Menu, X, Download, Terminal, ShieldCheck } from "lucide-react";
import CommandPaletteModal from "@/components/ui/CommandPaletteModal";

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleToggleCmdK = () => setCmdOpen((prev) => !prev);
    window.addEventListener("toggle-cmd-k", handleToggleCmdK);
    return () => window.removeEventListener("toggle-cmd-k", handleToggleCmdK);
  }, []);

  const navItems = [
    { name: "Overview", path: "/" },
    { name: "Desktop IDE", path: "/desktop" },
    { name: "Architecture", path: "/architecture" },
    { name: "Documentation", path: "/docs" },
    { name: "Interactive Demo", path: "/demo" },
    { name: "Research", path: "/research" },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full font-mono text-xs transition-all duration-200 ${
          scrolled
            ? "bg-[#09090d]/95 backdrop-blur-md border-b border-[#1f1f24] shadow-lg"
            : "bg-[#050508] border-b border-[#1f1f24]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition-colors">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs group-hover:text-cyan-300 transition-colors">
                Echo Nullity
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#151520] border border-[#262626] text-zinc-400 text-[9.5px]">
                v1.0.0-beta
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#09090d] p-1 rounded-xl border border-[#1f1f24]">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-1 rounded-lg transition-all text-xs ${
                    isActive
                      ? "bg-[#151520] text-cyan-300 border border-cyan-500/40 font-bold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121216]"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Command Palette Button */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-zinc-400 bg-[#0a0a0d] hover:bg-[#141418] border border-[#1f1f24] hover:border-cyan-500/40 transition-all cursor-pointer"
            >
              <Command className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search</span>
              <kbd className="px-1 py-0.2 text-[9px] bg-[#151520] border border-[#262626] rounded text-zinc-300">
                ⌘K
              </kbd>
            </button>

            {/* GitHub Badge */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-zinc-300 bg-[#0a0a0d] hover:bg-[#141418] border border-[#1f1f24] hover:border-zinc-700 transition-all"
            >
              <Github className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1 py-0.2 rounded text-[9.5px] border border-cyan-500/20">
                1.4k ★
              </span>
            </a>

            {/* Primary Action Button */}
            <Link
              href="#downloads"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 font-bold text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download Beta</span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg bg-[#0a0a0d] border border-[#1f1f24]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#09090d] border-b border-[#1f1f24] px-4 py-3 space-y-1.5 font-mono text-xs"
            >
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg transition-colors ${
                    pathname === item.path
                      ? "bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/40"
                      : "text-zinc-400 hover:text-white hover:bg-[#121216]"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCmdOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-[#121216] border border-[#24242e] text-cyan-400 flex items-center justify-between"
              >
                <span>Search Documentation (⌘K)</span>
                <Command className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Command Palette Overlay */}
      <CommandPaletteModal isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
