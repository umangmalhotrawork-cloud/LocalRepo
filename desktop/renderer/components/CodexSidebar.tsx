"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  FolderTree, Search, GitBranch, Layers, ShieldCheck, Settings, 
  Plus, MessageSquare, GitPullRequest, Plug, ChevronDown, ChevronRight,
  Folder, Pin, PinOff, MoreVertical, Edit2, Trash2, X, Check, Clock, Bot, Sparkles
} from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

export interface SidebarThread {
  threadId: string;
  id?: string;
  title: string;
  timestamp?: number;
  createdAt?: number;
  updatedAt?: number;
  pinned?: boolean;
  status?: string;
  workspacePath?: string;
  workspaceName?: string;
  providerId?: string;
  modelId?: string;
  sequenceNumber?: number;
}

interface CodexSidebarProps {
  currentProjectName: string;
  workspacePath?: string;
  activeThreadId?: string | null;
  threads?: SidebarThread[];
  recentSessions?: any[];
  onNewTask: () => void;
  onSelectSession?: (sessionId: string, userGoal?: string) => void;
  onSelectThread?: (threadId: string, title?: string) => void;
  onPinThread?: (threadId: string, pinned: boolean) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onOpenFolder: () => void;
  activeItem: string | null;
  onSelectItem: (item: any) => void;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CodexSidebar({
  currentProjectName = "NEXUS",
  workspacePath = "",
  activeThreadId,
  threads = [],
  recentSessions = [],
  onNewTask,
  onSelectSession,
  onSelectThread,
  onPinThread,
  onRenameThread,
  onDeleteThread,
  onOpenFolder,
  activeItem,
  onSelectItem,
}: CodexSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuThreadId, setActiveMenuThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuThreadId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus edit input when renaming
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingThreadId]);

  const toggleProject = (name: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSelect = (threadId: string, title?: string) => {
    if (editingThreadId) return;
    if (onSelectThread) {
      onSelectThread(threadId, title);
    } else if (onSelectSession) {
      onSelectSession(threadId, title);
    }
  };

  const handleStartRename = (thread: SidebarThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuThreadId(null);
    setEditingThreadId(thread.threadId);
    setEditTitleInput(thread.title || "Untitled Task");
  };

  const handleSaveRename = (threadId: string) => {
    if (editTitleInput.trim() && onRenameThread) {
      onRenameThread(threadId, editTitleInput.trim());
    }
    setEditingThreadId(null);
  };

  const handleCancelRename = () => {
    setEditingThreadId(null);
  };

  const handleTogglePin = (thread: SidebarThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuThreadId(null);
    if (onPinThread) {
      onPinThread(thread.threadId, !thread.pinned);
    }
  };

  const handleDelete = (thread: SidebarThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuThreadId(null);
    if (onDeleteThread) {
      onDeleteThread(thread.threadId);
    }
  };

  // Harmonize unified thread list from threads prop and recentSessions fallback
  const allThreads: SidebarThread[] = React.useMemo(() => {
    const list: SidebarThread[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(threads) && threads.length > 0) {
      for (const t of threads) {
        const id = t.threadId || t.id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          list.push({
            ...t,
            threadId: id,
            timestamp: t.updatedAt || t.createdAt || t.timestamp,
          });
        }
      }
    }

    if (Array.isArray(recentSessions) && recentSessions.length > 0) {
      for (const s of recentSessions) {
        const id = s.threadId || s.id || s.snapshotId || s.sessionId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          list.push({
            threadId: id,
            title: s.title || s.user_intent_summary || s.userGoal || s.goal || "AI Agent Session",
            timestamp: s.updatedAt || s.timestamp || (s.created_at ? new Date(s.created_at).getTime() : undefined),
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            pinned: Boolean(s.pinned),
            status: s.status || "ACTIVE",
            workspaceName: s.workspaceName || currentProjectName,
            workspacePath: s.workspacePath || workspacePath,
            providerId: s.providerId,
            modelId: s.modelId,
            sequenceNumber: s.sequence_number || s.sequenceNumber,
          });
        }
      }
    }

    // Sort newest first
    list.sort((a, b) => ((b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0)));
    return list;
  }, [threads, recentSessions, currentProjectName, workspacePath]);

  // Filter threads by search query
  const filteredThreads = React.useMemo(() => {
    if (!searchQuery.trim()) return allThreads;
    const q = searchQuery.toLowerCase().trim();
    return allThreads.filter((t) => {
      const title = (t.title || "").toLowerCase();
      const ws = (t.workspaceName || "").toLowerCase();
      return title.includes(q) || ws.includes(q);
    });
  }, [allThreads, searchQuery]);

  // Separate pinned and non-pinned threads
  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const recentThreads = filteredThreads.filter((t) => !t.pinned);

  // Group threads by project
  const projectGroups = React.useMemo(() => {
    const map = new Map<string, SidebarThread[]>();
    for (const t of filteredThreads) {
      const projectName = t.workspaceName || currentProjectName || "NEXUS";
      if (!map.has(projectName)) {
        map.set(projectName, []);
      }
      map.get(projectName)!.push(t);
    }
    return Array.from(map.entries()).map(([name, groupThreads]) => ({
      name,
      isCurrent: name === (currentProjectName || "NEXUS"),
      threads: groupThreads,
    }));
  }, [filteredThreads, currentProjectName]);

  return (
    <aside 
      style={{
        backgroundColor: "var(--theme-surface, #08080c)",
        borderColor: "var(--theme-border, #161620)",
        color: "var(--theme-text, #f4f4f5)",
      }}
      className="w-64 border-r flex flex-col h-full shrink-0 select-none font-mono text-xs"
    >
      {/* Top Branding & New Chat & Search */}
      <div 
        style={{
          backgroundColor: "var(--theme-surface-panel, #0a0a0f)",
          borderColor: "var(--theme-border, #161620)",
        }}
        className="p-3 border-b space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: "var(--theme-accent, #22d3ee)" }} />
            <span className="font-bold text-sm tracking-tight" style={{ color: "var(--theme-text, #ffffff)" }}>NEXUS</span>
          </div>
          <span 
            className="text-[9.5px] px-1.5 py-0.5 rounded font-mono border"
            style={{
              backgroundColor: "var(--theme-surface-raised, #161622)",
              borderColor: "var(--theme-border-card, #222234)",
              color: "var(--theme-accent, #22d3ee)",
            }}
          >
            IDE v1.0
          </span>
        </div>

        {/* New Task / Chat Button */}
        <button
          onClick={onNewTask}
          style={{
            backgroundColor: "var(--theme-accent-dim, rgba(34,211,238,0.15))",
            borderColor: "var(--theme-border-focus, rgba(34,211,238,0.4))",
            color: "var(--theme-accent, #22d3ee)",
          }}
          className="w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:brightness-125"
        >
          <Plus className="w-4 h-4" style={{ color: "var(--theme-accent, #22d3ee)" }} />
          <span>New Task / Chat</span>
        </button>

        {/* Search Chats Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats & tasks..."
            style={{
              backgroundColor: "var(--theme-surface-raised, #101018)",
              borderColor: "var(--theme-border-card, #20202e)",
              color: "var(--theme-text, #f4f4f5)",
            }}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-[11px] placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 font-mono transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Sidebar Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Navigation Section */}
        <div className="space-y-0.5">
          <div className="px-2 text-[9.5px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--theme-text-subtle, #71717a)" }}>
            Navigation
          </div>

          <button
            onClick={() => onSelectItem("explorer")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "explorer"
                ? "bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
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

          <button
            onClick={() => onSelectItem("capabilities")}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeItem === "capabilities"
                ? "bg-[#161224] text-purple-300 font-bold border border-purple-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#101016]"
            }`}
          >
            <Plug className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">MCP & Skills Center</span>
          </button>
        </div>

        {/* PINNED CHATS SECTION */}
        {pinnedThreads.length > 0 && (
          <div className="space-y-1">
            <div className="px-2 flex items-center gap-1.5 text-[9.5px] font-bold text-amber-400/90 uppercase tracking-wider">
              <Pin className="w-3 h-3 text-amber-400 rotate-45 shrink-0" />
              <span>Pinned Chats</span>
              <span className="ml-auto text-[9px] font-mono px-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">{pinnedThreads.length}</span>
            </div>

            <div className="space-y-0.5">
              {pinnedThreads.map((thread) => renderThreadItem(thread, true))}
            </div>
          </div>
        )}

        {/* PROJECTS SECTION */}
        <div className="space-y-2">
          <div className="px-2 flex items-center justify-between text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Projects & Workspaces</span>
            <button onClick={onOpenFolder} className="text-cyan-400 hover:underline cursor-pointer">Open</button>
          </div>

          <div className="space-y-1">
            {projectGroups.map((proj) => {
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
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400">{proj.threads.length}</span>
                      {proj.isCurrent && (
                        <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">Active</span>
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="pl-3 space-y-0.5 border-l border-[#181824] ml-2.5">
                      {proj.threads.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 italic px-2 py-1">No active threads</div>
                      ) : (
                        proj.threads.map((t) => renderThreadItem(t))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENTS SECTION */}
        {recentThreads.length > 0 && (
          <div className="space-y-1">
            <div className="px-2 flex items-center gap-1.5 text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider">
              <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>Recent Chats</span>
              <span className="ml-auto text-[9px] font-mono text-zinc-600">{recentThreads.length}</span>
            </div>

            <div className="space-y-0.5">
              {recentThreads.map((thread) => renderThreadItem(thread))}
            </div>
          </div>
        )}

        {filteredThreads.length === 0 && (
          <div className="px-3 py-6 text-center text-zinc-600 text-xs">
            {searchQuery ? "No matching chats found." : "No conversation history yet."}
          </div>
        )}
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

  function renderThreadItem(thread: SidebarThread, isPinnedSection = false) {
    const isActive = activeThreadId === thread.threadId;
    const isEditing = editingThreadId === thread.threadId;
    const isMenuOpen = activeMenuThreadId === thread.threadId;

    if (isEditing) {
      return (
        <div
          key={thread.threadId}
          className="px-2 py-1 rounded-lg bg-[#141422] border border-cyan-500/50 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={editInputRef}
            type="text"
            value={editTitleInput}
            onChange={(e) => setEditTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveRename(thread.threadId);
              if (e.key === "Escape") handleCancelRename();
            }}
            className="flex-1 bg-transparent text-[11px] text-cyan-200 focus:outline-none font-mono"
          />
          <button
            onClick={() => handleSaveRename(thread.threadId)}
            className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
            title="Save title"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={handleCancelRename}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={thread.threadId}
        className={`group relative w-full text-left px-2 py-1.5 rounded-lg text-[10.5px] transition-all flex items-center justify-between cursor-pointer ${
          isActive
            ? "bg-cyan-950/60 text-cyan-200 font-bold border border-cyan-500/40 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121e]"
        }`}
        onClick={() => handleSelect(thread.threadId, thread.title)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          {thread.pinned ? (
            <Pin className="w-3 h-3 text-amber-400 rotate-45 shrink-0" />
          ) : (
            <MessageSquare className={`w-3 h-3 shrink-0 ${isActive ? "text-cyan-400" : "text-zinc-600 group-hover:text-zinc-400"}`} />
          )}
          <span className="truncate flex-1">{thread.title || "Untitled Task"}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8.5px] text-zinc-600 group-hover:hidden font-mono">
            {formatTimeAgo(thread.timestamp)}
          </span>

          {/* Contextual Action Button ("...") */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuThreadId(isMenuOpen ? null : thread.threadId);
            }}
            className={`p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-opacity ${
              isMenuOpen ? "opacity-100 text-cyan-300" : "opacity-0 group-hover:opacity-100"
            }`}
            title="Chat actions"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--theme-surface-card, #0c0c16)",
              borderColor: "var(--theme-border-card, #222236)",
            }}
            className="absolute right-1 top-8 w-36 border rounded-xl shadow-2xl z-50 p-1 space-y-0.5 text-xs font-mono animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onClick={(e) => handleTogglePin(thread, e)}
              className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-white/5 text-zinc-300 hover:text-amber-300 cursor-pointer text-[11px]"
            >
              {thread.pinned ? (
                <>
                  <PinOff className="w-3 h-3 text-amber-400" />
                  <span>Unpin chat</span>
                </>
              ) : (
                <>
                  <Pin className="w-3 h-3 text-amber-400 rotate-45" />
                  <span>Pin chat</span>
                </>
              )}
            </button>

            <button
              onClick={(e) => handleStartRename(thread, e)}
              className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-white/5 text-zinc-300 hover:text-cyan-300 cursor-pointer text-[11px]"
            >
              <Edit2 className="w-3 h-3 text-cyan-400" />
              <span>Rename</span>
            </button>

            <div className="h-px bg-[#1e1e2e] my-0.5" />

            <button
              onClick={(e) => handleDelete(thread, e)}
              className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 cursor-pointer text-[11px]"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    );
  }
}
