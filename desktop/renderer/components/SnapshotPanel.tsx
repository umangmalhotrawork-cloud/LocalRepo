"use client";

import React, { useState } from "react";
import {
  Camera,
  History,
  Clock,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  GitCompare,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
} from "lucide-react";
import { useSnapshots, WorkspaceSnapshot, SnapshotDiffItem } from "../hooks/useSnapshots";
import SnapshotDiffModal from "./SnapshotDiffModal";

interface SnapshotPanelProps {
  snapshotHook: ReturnType<typeof useSnapshots>;
  onOpenFile: (filePath: string, line?: number) => void;
  openTabs: Array<{ path: string; name: string }>;
  activeTabPath: string;
}

export default function SnapshotPanel({
  snapshotHook,
  onOpenFile,
  openTabs,
  activeTabPath,
}: SnapshotPanelProps) {
  const {
    snapshots,
    loading,
    selectedSnapshot,
    setSelectedSnapshot,
    comparison,
    comparing,
    createSnapshot,
    compareSnapshot,
    restoreFile,
    restoreWorkspace,
    deleteSnapshot,
  } = snapshotHook;

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSnapName, setNewSnapName] = useState("");
  const [newSnapDesc, setNewSnapDesc] = useState("");
  const [activeDiffItem, setActiveDiffItem] = useState<SnapshotDiffItem | null>(null);
  const [confirmRestoreSnap, setConfirmRestoreSnap] = useState<WorkspaceSnapshot | null>(null);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleCreate = async () => {
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

  const filteredSnapshots = snapshots.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#050508] border-r border-[#1f1f24] overflow-hidden">
      {/* Header */}
      <div className="h-11 bg-[#09090d] border-b border-[#1f1f24] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            Workspace Snapshots
          </span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#151520] text-zinc-400 text-[10px]">
            {snapshots.length}
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
          title="Create Snapshot (Cmd+Shift+B)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Snapshot</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 bg-[#0a0a0e] border-b border-[#1f1f24] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search snapshots by name or description..."
            className="w-full bg-[#121218] border border-[#272730] focus:border-cyan-500/60 rounded-xl px-2 py-1.5 pl-8 text-zinc-100 placeholder:text-zinc-600 outline-none text-[11px] font-mono"
          />
        </div>
      </div>

      {/* Split Views: Timeline List (Left) and Comparison / Details (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Snapshot Timeline List */}
        <div className="w-1/2 border-r border-[#1f1f24] overflow-y-auto p-2 space-y-1.5">
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
                  {snap.isAuto ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30">
                      Auto
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                      Manual
                    </span>
                  )}
                </div>

                {snap.description && (
                  <p className="text-[10px] text-zinc-400 line-clamp-1">
                    {snap.description}
                  </p>
                )}

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

          {filteredSnapshots.length === 0 && !loading && (
            <div className="py-16 text-center text-zinc-600 space-y-2">
              <History className="w-10 h-10 text-cyan-500/30 mx-auto" />
              <p className="text-xs">No workspace snapshots found.</p>
            </div>
          )}
        </div>

        {/* Right: Snapshot Details & Diff Comparison */}
        <div className="w-1/2 overflow-y-auto p-3 space-y-3 bg-[#07070a]">
          {selectedSnapshot ? (
            <>
              {/* Snapshot Info Header */}
              <div className="p-3 rounded-xl bg-[#0d0d14] border border-[#1f1f28] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Snapshot Details
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setConfirmRestoreSnap(selectedSnapshot)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Rollback workspace to this snapshot"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore Workspace</span>
                    </button>

                    <button
                      onClick={() => deleteSnapshot(selectedSnapshot.id)}
                      className="p-1 rounded-lg hover:bg-rose-950 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-100">
                  {selectedSnapshot.name}
                </div>

                {selectedSnapshot.description && (
                  <p className="text-[10.5px] text-zinc-400">
                    {selectedSnapshot.description}
                  </p>
                )}

                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                  <span>Created: {new Date(selectedSnapshot.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Diff Summary Badges */}
              {comparison && (
                <div className="p-2.5 rounded-xl bg-[#09090e] border border-[#1a1a24] space-y-2">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-zinc-300 flex items-center gap-1">
                      <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Changes vs Current Disk</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-[9.5px] font-bold">
                      <span className="text-emerald-400">+{comparison.summary.added} Added</span>
                      <span className="text-amber-400">~{comparison.summary.modified} Mod</span>
                      <span className="text-rose-400">-{comparison.summary.deleted} Del</span>
                    </div>
                  </div>

                  {/* Diff Files List */}
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {comparison.diffs
                      .filter((d) => d.status !== "unchanged")
                      .map((diff, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveDiffItem(diff)}
                          className="p-1.5 rounded-lg bg-[#111118] hover:bg-[#191924] border border-[#222230] flex items-center justify-between text-[10.5px] transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate text-zinc-200">{diff.relativePath}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                diff.status === "added"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                  : diff.status === "modified"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                                  : "bg-rose-950 text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              {diff.status}
                            </span>
                            <ArrowRight className="w-3 h-3 text-zinc-600" />
                          </div>
                        </div>
                      ))}

                    {comparison.diffs.filter((d) => d.status !== "unchanged").length === 0 && (
                      <div className="py-6 text-center text-zinc-600 text-[10.5px]">
                        Workspace matches snapshot exactly (0 differences).
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-zinc-600 text-xs">
              Select a snapshot to compare changes or restore files.
            </div>
          )}
        </div>
      </div>

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
          <div className="w-full max-w-md bg-[#09090e] border border-[#272732] rounded-2xl shadow-2xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f1f28]">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-zinc-100 text-sm">Create Workspace Snapshot</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] text-zinc-400 font-bold uppercase">
                Snapshot Name
              </label>
              <input
                type="text"
                value={newSnapName}
                onChange={(e) => setNewSnapName(e.target.value)}
                placeholder="e.g. Before Major Refactor"
                className="w-full bg-[#121218] border border-[#272730] focus:border-cyan-500/60 rounded-xl px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600 outline-none text-xs font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] text-zinc-400 font-bold uppercase">
                Description (Optional)
              </label>
              <textarea
                value={newSnapDesc}
                onChange={(e) => setNewSnapDesc(e.target.value)}
                placeholder="Brief description of current changes..."
                rows={2}
                className="w-full bg-[#121218] border border-[#272730] focus:border-cyan-500/60 rounded-xl px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600 outline-none text-xs font-mono resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newSnapName.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold transition-all shadow-md cursor-pointer disabled:opacity-40"
              >
                Create Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Workspace Modal */}
      {confirmRestoreSnap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
          <div className="w-full max-w-md bg-[#09090e] border border-amber-500/40 rounded-2xl shadow-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Workspace Rollback</span>
            </div>

            <p className="text-zinc-300 leading-relaxed">
              Are you sure you want to restore the entire workspace to{" "}
              <strong className="text-white font-bold">{confirmRestoreSnap.name}</strong>?
            </p>

            <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10.5px] text-amber-200/90 space-y-1">
              <div>• An automatic pre-restore backup snapshot will be saved.</div>
              <div>• Protected folders (.git, node_modules) will not be touched.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRestoreSnap(null)}
                className="px-3 py-1.5 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await restoreWorkspace(confirmRestoreSnap.id);
                  setConfirmRestoreSnap(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold transition-all shadow-md cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Modal */}
      {activeDiffItem && (
        <SnapshotDiffModal
          isOpen={Boolean(activeDiffItem)}
          onClose={() => setActiveDiffItem(null)}
          diffItem={activeDiffItem}
          snapshotName={selectedSnapshot?.name || "Snapshot"}
          onRestoreFile={(relPath) => {
            if (selectedSnapshot) {
              restoreFile(selectedSnapshot.id, relPath);
            }
          }}
        />
      )}
    </div>
  );
}
