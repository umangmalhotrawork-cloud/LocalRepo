"use client";

import { AlertTriangle } from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface ConfirmDialogProps {
  isOpen: boolean;
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose: onCancel,
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        ref={dialogRef}
        className="w-full max-w-md bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl shadow-2xl p-6 space-y-4 font-sans"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white">Save changes?</h3>
            <p className="text-xs text-zinc-400 font-mono">
              Do you want to save the changes to <span className="text-cyan-300 font-bold">{fileName}</span>?
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Your changes will be lost if you don't save them.
        </p>

        <div className="flex items-center justify-end gap-2 font-mono text-xs pt-2 border-t border-[#1f1f1f]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#262626] text-zinc-300 hover:bg-[#141414] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold transition-all"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-cyan-glow transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
