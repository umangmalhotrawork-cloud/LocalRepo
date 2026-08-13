"use client";

import React from "react";
import { RotateCcw, X, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { HistoryEntry } from "../IDEApp";

interface RestoreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: HistoryEntry | null;
  onConfirmRestore: (id: string) => void;
  isRestoring?: boolean;
}

export default function RestoreConfirmModal({
  isOpen,
  onClose,
  entry,
  onConfirmRestore,
  isRestoring = false,
}: RestoreConfirmModalProps) {
  if (!isOpen || !entry) return null;

  const fileName = entry.file_path ? entry.file_path.split("/").pop() : "unknown.py";
  const beforeLines = (entry.before_source || "").split("\n");
  const afterLines = (entry.after_source || "").split("\n");

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-amber-500/50 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl font-mono text-xs animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <span>Confirm Time-Travel Checkpoint Restore</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning / Summary Info */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-xs font-sans space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Restoring Pre-Surgery State for {fileName}</span>
          </div>
          <p className="text-zinc-300 text-[11px] leading-relaxed">
            This operation will revert <span className="font-mono text-amber-300">{fileName}</span> back to its state prior to checkpoint <span className="font-mono text-cyan-300">{entry.id}</span>. AST analysis, luminance metrics, clones, and graph will automatically re-index upon completion.
          </p>
        </div>

        {/* File Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-[11px] bg-[#0d0d0d] p-3 rounded-xl border border-[#1f1f1f]">
          <div>
            <span className="text-zinc-500 block">File Path:</span>
            <span className="text-zinc-200 font-bold truncate block" title={entry.file_path}>{entry.file_path}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Checkpoint ID:</span>
            <span className="text-cyan-300 font-bold font-mono">{entry.id}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Original Timestamp:</span>
            <span className="text-zinc-300">{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Target Operation:</span>
            <span className="text-amber-300 font-bold">{entry.operation_type}</span>
          </div>
        </div>

        {/* Code Diff Preview Box */}
        <div className="space-y-1.5">
          <span className="text-zinc-400 font-bold text-[11px] flex items-center justify-between">
            <span>Restored Source Snapshot Preview</span>
            <span className="text-zinc-500 text-[10px]">{beforeLines.length} Lines</span>
          </span>
          <div className="bg-[#050505] border border-[#1f1f1f] rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300 space-y-0.5">
            {beforeLines.slice(0, 15).map((line, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-600 select-none text-[10px]">{idx + 1}</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
            {beforeLines.length > 15 && (
              <div className="text-zinc-500 italic text-[10px] pt-1 text-center">... and {beforeLines.length - 15} more lines</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all"
            disabled={isRestoring}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmRestore(entry.id)}
            disabled={isRestoring}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-amber-glow flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-black" />
            <span>{isRestoring ? "Restoring Checkpoint..." : "Confirm Restore Checkpoint"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
