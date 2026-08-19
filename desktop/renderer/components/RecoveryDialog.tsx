"use client";

import React from "react";
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  X,
  FileCode,
  Clock,
  ShieldAlert,
  Check,
} from "lucide-react";
import { RecoverySnapshot } from "../hooks/useWorkspaceState";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface RecoveryDialogProps {
  isOpen: boolean;
  snapshot: RecoverySnapshot | null;
  wasCrash?: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  onLater: () => void;
}

export default function RecoveryDialog({
  isOpen,
  snapshot,
  wasCrash = false,
  onRestore,
  onDiscard,
  onLater,
}: RecoveryDialogProps) {
  const modalRef = useOutsideClick<HTMLDivElement>({
    isOpen: isOpen && !!snapshot,
    onClose: onLater,
  });

  if (!isOpen || !snapshot) return null;

  const dirtyTabs = (snapshot.openTabs || []).filter((t) => t.isDirty);
  const formattedDate = snapshot.savedAt
    ? new Date(snapshot.savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        month: "short",
        day: "numeric",
      })
    : "Recent snapshot";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onLater();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-[#0d0d12] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1f1f24] bg-[#09090c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {wasCrash ? (
              <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <RotateCcw className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-xs font-bold text-zinc-100">
                {wasCrash ? "NEXUS may have closed unexpectedly." : "Restore Previous Session"}
              </h2>
              <p className="text-[10.5px] text-zinc-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                <span>Autosaved on {formattedDate}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onLater}
            className="p-1 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
            title="Dismiss for now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3 text-xs text-zinc-300">
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Unsaved modifications were captured before your previous session ended. Would you like to restore them?
          </p>

          {/* Recoverable Files List */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Unsaved Files ({dirtyTabs.length})</span>
              <span>Lines</span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-[#070709] border border-[#1a1a20] rounded-xl p-2">
              {dirtyTabs.map((tab, idx) => {
                const lineCount = (tab.content || "").split("\n").length;
                const fileName = tab.path.split("/").pop() || tab.path;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-[#0e0e14] border border-[#1a1a24] text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-zinc-200 font-bold truncate">{fileName}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                    </div>
                    <span className="text-zinc-500 text-[10px] shrink-0 font-mono">
                      {lineCount} lines
                    </span>
                  </div>
                );
              })}

              {dirtyTabs.length === 0 && (
                <div className="py-4 text-center text-zinc-600 text-xs">
                  No dirty files in snapshot.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 bg-[#08080b] border-t border-[#1a1a20] flex items-center justify-between gap-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Discard</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onLater}
              className="px-3 py-1.5 rounded-xl hover:bg-[#1a1a22] text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={onRestore}
              className="px-4 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span>Restore Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
