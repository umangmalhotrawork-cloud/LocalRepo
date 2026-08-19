"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Camera,
  History,
  Clock,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  GitCompare,
  CheckCircle2,
  Layers,
  Sparkles,
  Play,
  Loader2,
} from "lucide-react";
import { useSnapshots, WorkspaceSnapshot, SnapshotDiffItem } from "../hooks/useSnapshots";

export type ContinuumSessionSummary = {
  snapshotId: string;
  sessionId: string;
  parentSessionId: string | null;
  sequenceNumber: number;
  createdAt: number;
  updatedAt: number;
  workspaceName: string;
  userGoal: string;
  activeTargetNodeId: string | null;
};

interface SnapshotPanelProps {
  snapshotHook: ReturnType<typeof useSnapshots>;
  onOpenFile: (filePath: string, line?: number) => void;
  openTabs: Array<{ path: string; name: string }>;
  activeTabPath: string;
  workspacePath?: string;
  activeSessionId?: string | null;
  onResumeSession?: (sessionId: string) => void;
  onCreateSession?: (goal?: string) => void;
}

export default function SnapshotPanel({
  snapshotHook,
  onOpenFile,
  openTabs,
  activeTabPath,
  workspacePath,
  activeSessionId,
  onResumeSession,
  onCreateSession,
}: SnapshotPanelProps) {
  const {
    snapshots,
    loading: snapshotsLoading,
    selectedSnapshot,
    setSelectedSnapshot,
    comparison,
    createSnapshot,
    compareSnapshot,
    deleteSnapshot,
  } = snapshotHook;

  const [activeTab, setActiveTab] = useState<"sessions" | "checkpoints">("sessions");
  const [continuumSessions, setContinuumSessions] = useState<ContinuumSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSnapName, setNewSnapName] = useState("");
  const [newSnapDesc, setNewSnapDesc] = useState("");

  const fetchContinuumSessions = useCallback(async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.list) {
      setSessionsLoading(true);
      try {
        const list = await (window as any).electronAPI.continuum.list(workspacePath || "");
        if (Array.isArray(list)) {
          setContinuumSessions(list);
        }
      } catch (e) {
        console.error("[SNAPSHOT-PANEL] Failed to fetch Continuum sessions:", e);
      } finally {
        setSessionsLoading(false);
      }
    }
  }, [workspacePath]);

  useEffect(() => {
    fetchContinuumSessions();
  }, [fetchContinuumSessions]);

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return "unknown";
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleResume = async (sessionId: string) => {
    setResumingId(sessionId);
    try {
      if (onResumeSession) {
        await onResumeSession(sessionId);
      }
      await fetchContinuumSessions();
    } finally {
      setResumingId(null);
    }
  };

  const handleCreateNewSession = () => {
    const goal = newSnapName.trim() || "New Continuum Session";
    if (onCreateSession) {
      onCreateSession(goal);
    } else if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.createCurrent) {
      (window as any).electronAPI.continuum.createCurrent({ userGoal: goal, activeFilePath: activeTabPath }, workspacePath || "").then(() => {
        fetchContinuumSessions();
      });
    }
    setNewSnapName("");
    setShowCreateModal(false);
  };

  const handleCreateCheckpoint = async () => {
    if (!newSnapName.trim()) return;
    await createSnapshot(
      newSnapName.trim(),
      newSnapDesc.trim(),
      openTabs,
      activeTabPath,
      []
    );
    setNewSnapName("");
    setNewSnapDesc("");
    setShowCreateModal(false);
  };

  const filteredSessions = continuumSessions.filter(
    (s) =>
      s.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.userGoal && s.userGoal.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSnapshots = snapshots.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#07070b] border-r border-[#161620] overflow-hidden">
      {/* Surface Header & Navigation Tabs */}
      <div className="p-2 bg-[#0a0a0f] border-b border-[#161620] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-[#101018] p-0.5 rounded-lg border border-[#1f1f2e]">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "sessions"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sessions ({continuumSessions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("checkpoints")}
            className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "checkpoints"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Checkpoints ({snapshots.length})</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-2 py-1 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
          title={activeTab === "sessions" ? "Start New Continuum Session" : "Create Checkpoint"}
        >
          <Plus className="w-3 h-3" />
          <span>New</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 bg-[#09090d] border-b border-[#161620] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "sessions" ? "Search Continuum sessions..." : "Search checkpoints..."}
            className="w-full bg-[#121218] border border-[#20202d] focus:border-cyan-500/60 rounded-lg px-2 py-1 pl-8 text-zinc-100 placeholder:text-zinc-600 outline-none text-[10.5px] font-mono"
          />
        </div>
      </div>

      {/* Surface Body */}
      {activeTab === "sessions" ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredSessions.map((session) => {
            const isActive = activeSessionId === session.sessionId;

            return (
              <div
                key={session.sessionId}
                className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                  isActive
                    ? "bg-[#0b1420] border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-[#09090e] border-[#181824] hover:bg-[#0f0f16] hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-bold text-zinc-100 text-[11px] truncate">
                      {session.userGoal || session.sessionId}
                    </span>
                  </div>

                  {isActive ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#14141c] text-zinc-400 border border-[#222230]">
                      Seq #{session.sequenceNumber}
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-zinc-400 space-y-0.5 font-mono">
                  <div className="truncate text-zinc-500">
                    ID: <span className="text-cyan-300 font-bold select-all">{session.sessionId}</span>
                  </div>
                  {session.parentSessionId && (
                    <div className="truncate text-zinc-500">
                      Parent: <span className="text-zinc-400">{session.parentSessionId}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#161620]">
                  <div className="flex items-center gap-1 text-[9.5px] text-zinc-500">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>{formatRelativeTime(session.updatedAt || session.createdAt)}</span>
                  </div>

                  <button
                    onClick={() => handleResume(session.sessionId)}
                    disabled={resumingId === session.sessionId}
                    className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {resumingId === session.sessionId ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                        <span>Resuming...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredSessions.length === 0 && !sessionsLoading && (
            <div className="py-12 text-center text-zinc-600 space-y-2 px-3">
              <Layers className="w-8 h-8 text-cyan-500/30 mx-auto" />
              <p className="text-xs font-medium text-zinc-400">No Continuum sessions yet.</p>
              <p className="text-[10px] text-zinc-600">Start an agent task or click + New to create a session.</p>
              <button
                onClick={() => handleCreateNewSession()}
                className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>+ New Session</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Checkpoints / Workspace Diffs View */
        <div className="flex-1 flex overflow-hidden">
          <div className="w-full overflow-y-auto p-2 space-y-1.5">
            {filteredSnapshots.map((snap) => {
              const isSelected = selectedSnapshot?.id === snap.id;

              return (
                <div
                  key={snap.id}
                  onClick={() => {
                    setSelectedSnapshot(snap);
                    compareSnapshot(snap.id);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? "bg-[#10141f] border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      : "bg-[#09090e] border-[#1a1a24] hover:bg-[#0f0f16] hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-bold text-zinc-200 text-[11px] truncate">
                        {snap.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatRelativeTime(snap.timestamp)}</span>
                    </div>
                    <span>{snap.totalFiles} files</span>
                  </div>
                </div>
              );
            })}

            {filteredSnapshots.length === 0 && !snapshotsLoading && (
              <div className="py-12 text-center text-zinc-600 space-y-2">
                <History className="w-8 h-8 text-cyan-500/30 mx-auto" />
                <p className="text-xs">No workspace checkpoints found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Creating Session or Checkpoint */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-96 bg-[#0c0c14] border border-cyan-500/40 rounded-xl p-4 space-y-3 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f1f2e] pb-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{activeTab === "sessions" ? "New Continuum Session" : "New Checkpoint"}</span>
              </span>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase font-bold">
                {activeTab === "sessions" ? "Session Task / Goal" : "Checkpoint Name"}
              </label>
              <input
                type="text"
                value={newSnapName}
                onChange={(e) => setNewSnapName(e.target.value)}
                placeholder={activeTab === "sessions" ? "e.g. Refactor checkout API..." : "e.g. Before refactoring cart..."}
                className="w-full bg-[#14141e] border border-[#262636] rounded-lg p-2 text-zinc-100 outline-none text-[11px]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg bg-[#14141e] border border-[#262636] text-zinc-400 hover:text-white text-[10.5px] font-bold"
              >
                Cancel
              </button>
              <button
                onClick={activeTab === "sessions" ? handleCreateNewSession : handleCreateCheckpoint}
                disabled={!newSnapName.trim()}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold text-[10.5px] disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
