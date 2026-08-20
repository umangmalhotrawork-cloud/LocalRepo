"use client";

import React, { useState, useEffect } from "react";
import { 
  FolderTree, Search, GitBranch, FlaskConical, Bug, Terminal, Plug,
  X, ChevronRight, Maximize2, Minimize2
} from "lucide-react";

export type ToolTab = "explorer" | "search" | "git" | "tests" | "debugger" | "terminal" | "capabilities";

interface ContextualToolsDrawerProps {
  isOpen: boolean;
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
  onClose: () => void;
  // Tool content views passed from parent
  explorerContent: React.ReactNode;
  searchContent: React.ReactNode;
  gitContent: React.ReactNode;
  testsContent: React.ReactNode;
  debuggerContent: React.ReactNode;
  terminalContent: React.ReactNode;
  capabilitiesContent?: React.ReactNode;
}

export default function ContextualToolsDrawer({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  explorerContent,
  searchContent,
  gitContent,
  testsContent,
  debuggerContent,
  terminalContent,
  capabilitiesContent,
}: ContextualToolsDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        backgroundColor: "var(--theme-surface-panel, #09090d)",
        borderColor: "var(--theme-border, #1f1f24)",
        color: "var(--theme-text, #f4f4f5)",
      }}
      className={`fixed inset-y-0 left-0 ${isExpanded ? "w-[650px]" : "w-[380px]"} max-w-[90vw] z-50 shadow-2xl border-r flex flex-col font-sans select-none animate-slideInLeft transition-all duration-200`}
    >
      {/* Header with Navigation Tabs */}
      <div 
        style={{
          backgroundColor: "var(--theme-surface, #060609)",
          borderColor: "var(--theme-border, #1f1f24)",
        }}
        className="h-10 px-3 border-b flex items-center justify-between font-mono text-xs shrink-0"
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onTabChange("explorer")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "explorer" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="File Explorer (⌘B)"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Files</span>
          </button>

          <button
            onClick={() => onTabChange("search")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "search" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Search & Replace (⌘⇧F)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => onTabChange("git")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "git" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Source Control (⌘⇧G)"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Git</span>
          </button>

          <button
            onClick={() => onTabChange("tests")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "tests" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Test Explorer (⌘⇧T)"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Tests</span>
          </button>

          <button
            onClick={() => onTabChange("debugger")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "debugger" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Debugger (F10)"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Debug</span>
          </button>

          <button
            onClick={() => onTabChange("terminal")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "terminal" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Terminal (⌘`)"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => onTabChange("capabilities")}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
              activeTab === "capabilities" ? "bg-purple-950 text-purple-300 font-bold border border-purple-500/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Capabilities & MCP (⌘⇧C)"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>MCP & Skills</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-zinc-500">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:text-zinc-200 rounded cursor-pointer"
            title={isExpanded ? "Collapse width" : "Expand width"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-zinc-200 rounded cursor-pointer"
            title="Close Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body View Container */}
      <div className="flex-1 w-full h-full overflow-hidden bg-[#06060a] relative">
        {activeTab === "explorer" && <div className="w-full h-full overflow-y-auto">{explorerContent}</div>}
        {activeTab === "search" && <div className="w-full h-full overflow-y-auto">{searchContent}</div>}
        {activeTab === "git" && <div className="w-full h-full overflow-y-auto">{gitContent}</div>}
        {activeTab === "tests" && <div className="w-full h-full overflow-y-auto">{testsContent}</div>}
        {activeTab === "debugger" && <div className="w-full h-full overflow-y-auto">{debuggerContent}</div>}
        {activeTab === "terminal" && <div className="w-full h-full overflow-y-auto p-2">{terminalContent}</div>}
        {activeTab === "capabilities" && <div className="w-full h-full overflow-hidden">{capabilitiesContent}</div>}
      </div>
    </div>
  );
}
