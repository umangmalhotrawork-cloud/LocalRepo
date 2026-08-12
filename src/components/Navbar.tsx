"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Github, Sparkles, Command, Menu, X } from "lucide-react";
import CommandPaletteModal from "@/components/ui/CommandPaletteModal";

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
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
    { name: "Home", path: "/" },
    { name: "Research", path: "/research" },
    { name: "Architecture", path: "/architecture" },
    { name: "Docs", path: "/docs" },
    { name: "Interactive Demo", path: "/demo" },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-2xl bg-black/85 border-b border-[#1f1f1f] shadow-2xl"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/40 flex items-center justify-center group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all">
              <Activity className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-bold text-xl text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                Echo Nullity
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono tracking-wider text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 rounded-full">
                V2 ENGINE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#0a0a0a]/90 p-1.5 rounded-full border border-[#1f1f1f]">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? "text-white font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Command Palette (⌘K) + GitHub + CTA */}
          <div className="flex items-center gap-3">
            {/* Command Palette Button */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-zinc-400 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl transition-all"
            >
              <Command className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[#161616] border border-[#262626] rounded text-zinc-300">
                ⌘K
              </kbd>
            </button>

            {/* GitHub Badge */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-zinc-300 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1f1f1f] hover:border-zinc-700 rounded-xl transition-all"
            >
              <Github className="w-4 h-4 text-zinc-400" />
              <span>GitHub</span>
              <span className="text-cyan-400 font-semibold bg-cyan-950/60 px-1.5 py-0.5 rounded text-[10px] border border-cyan-500/20">
                1.4k ★
              </span>
            </a>

            {/* CTA Button */}
            <Link
              href="/demo"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-cyan-glow transition-all hover:scale-105 active:scale-95 font-sans"
            >
              <Sparkles className="w-3.5 h-3.5 fill-black" />
              <span>Run Tomography</span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
              className="md:hidden bg-[#0a0a0a] border-b border-[#1f1f1f] px-4 py-4 space-y-2 font-mono text-xs"
            >
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl transition-colors ${
                    pathname === item.path
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                      : "text-zinc-400 hover:text-white hover:bg-[#141414]"
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
                className="w-full text-left px-4 py-2.5 rounded-xl bg-[#141414] border border-[#242424] text-cyan-400 flex items-center justify-between"
              >
                <span>Search Documentation (⌘K)</span>
                <Command className="w-4 h-4" />
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
