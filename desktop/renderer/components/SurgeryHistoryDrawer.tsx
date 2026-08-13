"use client";

import React, { useState } from "react";
import { Clock, X, RotateCcw, Eye, ShieldCheck, AlertTriangle, RefreshCw, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import { HistoryEntry } from "../IDEApp";

interface SurgeryHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onRefresh: () => void;
  onRestore: (entry: HistoryEntry) => void;
  onPreviewDiff: (entry: HistoryEntry) => void;
}

export default function SurgeryHistoryDrawer({
  isOpen,
  onClose,
  entries,
  onRefresh,
  onRestore,
  onPreviewDiff,
}: SurgeryHistoryDrawerProps) {
  const [filter, setFilter] = useState<string>("ALL");

  if (!isOpen) return null;

  const filteredEntries = entries.filter((e) => {
    if (filter === "APPLY") return e.operation_type === "APPLY_SURGERY";
    if (filter === "RESTORE") return e.operation_type === "RESTORE_CHECKPOINT" || e.operation_type === "UNDO_SURGERY";
    return true;
  });

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-[#0a0a0a] border-l border-[#1f1f1f] shadow-2xl z-50 flex flex-col font-mono text-xs animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Surgery History</h2>
            <p className="text-[10px] text-zinc-400">Time-Travel Checkpoints & Event Log</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 transition-all"
            title="Refresh History"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Summary */}
      <div className="px-4 py-2 bg-[#080808] border-b border-[#1f1f1f] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              filter === "ALL" ? "bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({entries.length})
          </button>
          <button
            onClick={() => setFilter("APPLY")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              filter === "APPLY" ? "bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Surgeries
          </button>
          <button
            onClick={() => setFilter("RESTORE")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              filter === "RESTORE" ? "bg-purple-950/80 border border-purple-500/50 text-purple-300 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Restores
          </button>
        </div>
        <span className="text-[10px] text-zinc-500">Persistent Ledger</span>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#262626] rounded-2xl bg-[#080808]">
            <Clock className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
            <p className="text-zinc-300 font-bold text-xs">No Surgery Events Recorded</p>
            <p className="text-zinc-500 text-[11px] mt-1">Apply or undo a vacuous statement surgery to build your time-travel ledger.</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const fileName = entry.file_path ? entry.file_path.split("/").pop() : "unknown.py";
            const isApply = entry.operation_type === "APPLY_SURGERY";
            const isRestore = entry.operation_type === "RESTORE_CHECKPOINT";
            const lumDelta = (entry.luminance_after - entry.luminance_before).toFixed(2);
            const deltaSign = Number(lumDelta) >= 0 ? `+${lumDelta}` : lumDelta;

            return (
              <div
                key={entry.id}
                className="bg-[#0f0f0f] border border-[#222222] hover:border-amber-500/40 rounded-xl p-3.5 space-y-2.5 transition-all shadow-md group"
              >
                {/* Event Top Bar */}
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${
                      isApply
                        ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300"
                        : isRestore
                        ? "bg-purple-950 border border-purple-500/40 text-purple-300"
                        : "bg-amber-950 border border-amber-500/40 text-amber-300"
                    }`}
                  >
                    {entry.operation_type}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>

                {/* File info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-200 font-bold text-xs truncate">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate" title={entry.file_path}>
                      {fileName}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {entry.removed_lines?.length > 0 ? `${entry.removed_lines.length} lines removed` : "0 lines removed"}
                  </span>
                </div>

                {/* Metrics & Badges */}
                <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a] text-[10px]">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <span>Luminance:</span>
                    <span className="text-zinc-200 font-bold">
                      {entry.luminance_before.toFixed(2)} ➔ {entry.luminance_after.toFixed(2)}
                    </span>
                    <span className={`font-bold ${Number(lumDelta) >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      ({deltaSign})
                    </span>
                  </div>

                  {entry.behavior_preserved ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Preserved</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 font-bold bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded-full text-[9px]">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Diverged</span>
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
                  <button
                    onClick={() => onPreviewDiff(entry)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-300 hover:text-white transition-all text-[11px]"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preview Diff</span>
                  </button>
                  <button
                    onClick={() => onRestore(entry)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 font-bold transition-all text-[11px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Restore Checkpoint</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
