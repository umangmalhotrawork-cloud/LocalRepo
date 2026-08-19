"use client";

import React from "react";
import {
  FolderTree,
  Search,
  GitBranch,
  Bot,
  Layers,
  ShieldCheck,
  Terminal,
  Settings,
} from "lucide-react";

export type ActivityRailItem = "explorer" | "search" | "git" | "agent" | "sessions" | "verification" | "terminal";

interface ActivityRailProps {
  activeItem: ActivityRailItem | null;
  onSelectItem: (item: ActivityRailItem) => void;
  agentPanelOpen: boolean;
  onToggleAgentPanel: () => void;
  bottomPanelOpen: boolean;
  onToggleBottomPanel: () => void;
  onOpenSettings?: () => void;
}

export default function ActivityRail({
  activeItem,
  onSelectItem,
  agentPanelOpen,
  onToggleAgentPanel,
  bottomPanelOpen,
  onToggleBottomPanel,
  onOpenSettings,
}: ActivityRailProps) {
  return (
    <aside className="w-11 bg-[#08080c] border-r border-[#161620] flex flex-col items-center py-2 shrink-0 select-none z-30 justify-between font-mono">
      {/* Top Tool Group */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Explorer */}
        <button
          onClick={() => onSelectItem("explorer")}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            activeItem === "explorer"
              ? "bg-[#121624] text-cyan-400 border border-cyan-500/30"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-[#101016]"
          }`}
          title="Explorer (⌘1)"
        >
          <FolderTree className="w-4 h-4" />
          {activeItem === "explorer" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* Search */}
        <button
          onClick={() => onSelectItem("search")}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            activeItem === "search"
              ? "bg-[#121624] text-cyan-400 border border-cyan-500/30"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-[#101016]"
          }`}
          title="Search Workspace (⌘2)"
        >
          <Search className="w-4 h-4" />
          {activeItem === "search" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* Source Control */}
        <button
          onClick={() => onSelectItem("git")}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            activeItem === "git"
              ? "bg-[#121624] text-cyan-400 border border-cyan-500/30"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-[#101016]"
          }`}
          title="Source Control (⌘3)"
        >
          <GitBranch className="w-4 h-4" />
          {activeItem === "git" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* Agent Panel Toggle */}
        <button
          onClick={onToggleAgentPanel}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer relative group ${
            agentPanelOpen
              ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
              : "text-zinc-500 hover:text-cyan-300 hover:bg-[#101016]"
          }`}
          title="AI Agent Dock (⌘I)"
        >
          <Bot className="w-4 h-4" />
          {agentPanelOpen && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* Sessions / Snapshots */}
        <button
          onClick={() => onSelectItem("sessions")}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            activeItem === "sessions"
              ? "bg-[#121624] text-cyan-400 border border-cyan-500/30"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-[#101016]"
          }`}
          title="Continuum Sessions (⌘5)"
        >
          <Layers className="w-4 h-4" />
          {activeItem === "sessions" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* Verification / Safety */}
        <button
          onClick={() => onSelectItem("verification")}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            activeItem === "verification"
              ? "bg-[#121624] text-emerald-400 border border-emerald-500/30"
              : "text-zinc-500 hover:text-emerald-300 hover:bg-[#101016]"
          }`}
          title="Patch Firewall & Verification (⌘6)"
        >
          <ShieldCheck className="w-4 h-4" />
          {activeItem === "verification" && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-400 rounded-r" />
          )}
        </button>
      </div>

      {/* Bottom Tool Group */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Terminal Toggle */}
        <button
          onClick={onToggleBottomPanel}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer relative group ${
            bottomPanelOpen
              ? "bg-[#121624] text-cyan-400 border border-cyan-500/30"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-[#101016]"
          }`}
          title="Terminal & Bottom Panel (⌘` / Ctrl+\)"
        >
          <Terminal className="w-4 h-4" />
          {bottomPanelOpen && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>

        {/* AI Settings */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-cyan-300 hover:bg-[#101016] transition-colors cursor-pointer"
            title="AI Model & Credentials Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
