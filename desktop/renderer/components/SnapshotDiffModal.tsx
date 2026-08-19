"use client";

import React, { useState } from "react";
import { X, Copy, Check, RotateCcw, FileCode, ArrowLeftRight } from "lucide-react";
import { SnapshotDiffItem } from "../hooks/useSnapshots";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface SnapshotDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffItem: SnapshotDiffItem | null;
  snapshotName: string;
  onRestoreFile: (relativePath: string) => void;
}

export default function SnapshotDiffModal({
  isOpen,
  onClose,
  diffItem,
  snapshotName,
  onRestoreFile,
}: SnapshotDiffModalProps) {
  const [copied, setCopied] = useState(false);
  const modalRef = useOutsideClick<HTMLDivElement>({
    isOpen: isOpen && !!diffItem,
    onClose,
  });

  if (!isOpen || !diffItem) return null;

  const handleCopyPatch = () => {
    const patch = diffItem.unifiedDiff || "";
    navigator.clipboard.writeText(patch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const oldLines = (diffItem.oldContent || "").split("\n");
  const newLines = (diffItem.newContent || "").split("\n");

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-4xl max-h-[85vh] bg-[#09090e] border border-[#272732] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs"
      >
        {/* Modal Header */}
        <div className="h-12 px-4 bg-[#0d0d14] border-b border-[#1f1f28] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate">
            <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-bold text-zinc-100 truncate text-[12px]">
              {diffItem.relativePath}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9.5px] uppercase font-bold bg-[#171722] text-cyan-300 border border-cyan-500/30">
              {diffItem.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPatch}
              className="px-2.5 py-1 rounded-lg bg-[#151520] hover:bg-[#1f1f2d] border border-[#2a2a38] text-zinc-300 hover:text-white text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Patch"}</span>
            </button>

            <button
              onClick={() => {
                onRestoreFile(diffItem.relativePath);
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore This File</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diff Columns Header */}
        <div className="grid grid-cols-2 bg-[#0b0b10] border-b border-[#1c1c24] text-[10px] text-zinc-400 font-bold uppercase tracking-wider py-1.5 px-4">
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400">Snapshot:</span> {snapshotName}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">Current Workspace (Disk)</span>
          </div>
        </div>

        {/* Diff Content View */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 divide-x divide-[#1c1c24] p-2 bg-[#050508] text-[11px]">
          {/* Left: Snapshot Version */}
          <div className="p-2 space-y-0.5 overflow-x-auto">
            {oldLines.map((line, idx) => (
              <div key={idx} className="flex font-mono leading-5 hover:bg-zinc-900/40">
                <span className="w-8 text-right text-zinc-600 select-none pr-2 shrink-0">{idx + 1}</span>
                <span className="text-zinc-300 whitespace-pre">{line || " "}</span>
              </div>
            ))}
            {oldLines.length === 0 && <div className="text-zinc-600 italic">File did not exist in snapshot.</div>}
          </div>

          {/* Right: Current Disk Version */}
          <div className="p-2 space-y-0.5 overflow-x-auto">
            {newLines.map((line, idx) => (
              <div key={idx} className="flex font-mono leading-5 hover:bg-zinc-900/40">
                <span className="w-8 text-right text-zinc-600 select-none pr-2 shrink-0">{idx + 1}</span>
                <span className="text-zinc-200 whitespace-pre">{line || " "}</span>
              </div>
            ))}
            {newLines.length === 0 && <div className="text-zinc-600 italic">File deleted in current workspace.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
