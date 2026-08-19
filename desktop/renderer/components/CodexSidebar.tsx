"use client";

import React, { useState } from "react";
import { 
  FolderTree, Search, GitBranch, Layers, ShieldCheck, Settings, 
  Plus, MessageSquare, GitPullRequest, Calendar, Plug, ChevronDown, ChevronRight,
  Folder, Play, Download, Sparkles, CheckCircle2, Clock
} from "lucide-react";

export interface ProjectThread {
  id: string;
  title: string;
  timestamp?: number;
  sequenceNumber?: number;
}

export interface CodexProjectItem {
  name: string;
  isCurrent?: boolean;
  threads: ProjectThread[];
}

interface CodexSidebarProps {
  currentProjectName: string;
  recentSessions: any[];
  onNewTask: () => void;
  onSelectSession: (sessionId: string, userGoal?: string) => void;
  onOpenFolder: () => void;
  activeItem: string | null;
  onSelectItem: (item: any) => void;
}

export default function CodexSidebar({
  currentProjectName = "NEXUS",
  recentSessions = [],
  onNewTask,
  onSelectSession,
  onOpenFolder,
  activeItem,
  onSelectItem,
}: CodexSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleProject = (name: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const projectList: CodexProjectItem[] = [
    {
      name: currentProjectName || "NEXUS",
      isCurrent: true,
      threads: recentSessions.map((s) => ({
        id: s.id || s.snapshotId || s.sessionId,
        title: s.user_intent_summary || s.userGoal || "AI Agent Session",
        timestamp: s.timestamp,
        sequenceNumber: s.sequence_number,
      })),
    },
    {
      name: "Spectra",
      isCurrent: false,
      threads: [
        { id: "spectra_1", title: "Spectral Decomposition Analysis" },
      ],
    },
    {
      name: "Cognitive Performance",
      isCurrent: false,
      threads: [
        { id: "cog_1", title: "Tomography Execution Telemetry" },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#08080c] border-r border-[#161620] flex flex-col h-full shrink-0 select-none font-mono text-xs text-zinc-300">
      {/* Top Branding & New Chat */}
      <div className="p-3 border-b border-[#161620] space-y-2.5 bg-[#0a0a0f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span className="font-bold text-sm text-white tracking-tight">NEXUS</span>
          </div>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#161622] text-cyan-300 border border-[#222234] font-mono">v1.0.0</span>
        </div>

        <button
          onClick={onNewTask}
          className="w-full py-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>New Task / Chat</span>
        </button>
      </div>

      {/* Navigation & Project Threads Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Navigation Section */}
        <div className="space-y-0.5">
          <div className="px-2 text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
            Navigation
          </div>

          <button
            onClick={() => onSelectItem("explorer")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "explorer"
                ? "bg-[#121624] text-cyan-300 font-bold border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101016]"
            }`}
          >
            <FolderTree className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">Files & Workspace</span>
          </button>

          <button
            onClick={() => onSelectItem("git")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "git"
                ? "bg-[#121624] text-cyan-300 font-bold border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101016]"
            }`}
          >
            <GitPullRequest className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">Pull Requests & Git</span>
          </button>

          <button
            onClick={() => onSelectItem("sessions")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "sessions"
                ? "bg-[#121624] text-cyan-300 font-bold border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101016]"
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Continuum Lineage</span>
          </button>

          <button
            onClick={() => onSelectItem("verification")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "verification"
                ? "bg-[#121624] text-emerald-400 font-bold border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101016]"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Patch Safety Firewall</span>
          </button>
        </div>

        {/* Projects & Task History Section */}
        <div className="space-y-2">
          <div className="px-2 flex items-center justify-between text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Projects & Threads</span>
            <button onClick={onOpenFolder} className="text-cyan-400 hover:underline cursor-pointer">Open</button>
          </div>

          <div className="space-y-1">
            {projectList.map((proj) => {
              const isCollapsed = collapsedProjects[proj.name];
              return (
                <div key={proj.name} className="space-y-1">
                  <button
                    onClick={() => toggleProject(proj.name)}
                    className="w-full text-left px-2 py-1 rounded-lg hover:bg-[#101018] flex items-center justify-between text-zinc-300 font-bold text-[11px] cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    {proj.isCurrent && (
                      <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">Active</span>
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 border-l border-[#181824] ml-2.5">
                      {proj.threads.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 italic px-2 py-1">No active threads</div>
                      ) : (
                        proj.threads.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => onSelectSession(t.id, t.title)}
                            className="w-full text-left px-2 py-1 rounded-md text-[10.5px] text-zinc-400 hover:text-cyan-300 hover:bg-[#12121c] transition-colors truncate flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MessageSquare className="w-3 h-3 text-zinc-600 group-hover:text-cyan-400 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </div>
                            {t.sequenceNumber && (
                              <span className="text-[8.5px] text-zinc-600 font-mono">#{t.sequenceNumber}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Profile / Local Status */}
      <div className="p-2.5 border-t border-[#161620] bg-[#0a0a0f] flex items-center justify-between text-[10px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-zinc-400">Local Sandbox</span>
        </div>
        <button
          onClick={() => onSelectItem("settings")}
          className="text-zinc-500 hover:text-white cursor-pointer"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
