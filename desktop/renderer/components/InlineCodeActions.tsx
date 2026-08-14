"use client";

import React from "react";
import { Sparkles, Bug, Wrench, RefreshCw, TestTube2, FileText } from "lucide-react";

export interface InlineCodeActionsProps {
  visible: boolean;
  x: number;
  y: number;
  onAction: (action: "explain" | "find_bug" | "fix" | "refactor" | "tests" | "docs") => void;
}

export default function InlineCodeActions({ visible, x, y, onAction }: InlineCodeActionsProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: `${Math.max(10, Math.min(window.innerWidth - 380, x))}px`,
        top: `${Math.max(10, y - 42)}px`,
        zIndex: 100,
      }}
      className="bg-[#0e0e12]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl px-1.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.8)] flex items-center gap-1 font-mono text-[11px] animate-fadeIn select-none"
    >
      <div className="flex items-center gap-1 pr-1.5 border-r border-[#27272a] text-cyan-400 font-bold text-[10px]">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>AI</span>
      </div>

      <button
        onClick={() => onAction("explain")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-cyan-950 text-zinc-300 hover:text-cyan-300 border border-[#27272a] hover:border-cyan-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Explain Selected Code (⌘I)"
      >
        <Sparkles className="w-3 h-3 text-cyan-400" />
        <span>Explain</span>
      </button>

      <button
        onClick={() => onAction("find_bug")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-rose-950 text-zinc-300 hover:text-rose-300 border border-[#27272a] hover:border-rose-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Find Bugs & Security Risks"
      >
        <Bug className="w-3 h-3 text-rose-400" />
        <span>Bug</span>
      </button>

      <button
        onClick={() => onAction("fix")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-emerald-950 text-zinc-300 hover:text-emerald-300 border border-[#27272a] hover:border-emerald-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Fix Issues in Selection (⌘⇧F)"
      >
        <Wrench className="w-3 h-3 text-emerald-400" />
        <span>Fix</span>
      </button>

      <button
        onClick={() => onAction("refactor")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-purple-950 text-zinc-300 hover:text-purple-300 border border-[#27272a] hover:border-purple-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Refactor for Clean Code (⌘⇧R)"
      >
        <RefreshCw className="w-3 h-3 text-purple-400" />
        <span>Refactor</span>
      </button>

      <button
        onClick={() => onAction("tests")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-blue-950 text-zinc-300 hover:text-blue-300 border border-[#27272a] hover:border-blue-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Generate Unit Tests"
      >
        <TestTube2 className="w-3 h-3 text-blue-400" />
        <span>Tests</span>
      </button>

      <button
        onClick={() => onAction("docs")}
        className="px-2 py-1 rounded-lg bg-[#18181b] hover:bg-amber-950 text-zinc-300 hover:text-amber-300 border border-[#27272a] hover:border-amber-500/40 transition-all flex items-center gap-1 cursor-pointer"
        title="Generate Documentation"
      >
        <FileText className="w-3 h-3 text-amber-400" />
        <span>Docs</span>
      </button>
    </div>
  );
}
