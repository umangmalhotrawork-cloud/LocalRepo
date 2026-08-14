"use client";

import React from "react";
import { FolderOpen, Sparkles, Clock, ArrowRight, X, Layers, FileCode } from "lucide-react";

interface StartupModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentWorkspaces: string[];
  onOpenRecent: (path: string) => void;
  onOpenFolder: () => void;
  onOpenDemo: () => void;
}

export default function StartupModal({
  isOpen,
  onClose,
  recentWorkspaces,
  onOpenRecent,
  onOpenFolder,
  onOpenDemo,
}: StartupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono select-none animate-fade-in">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-cyan-500/40 rounded-24 shadow-cyan-glow/20 p-6 space-y-5 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="font-heading text-lg font-bold text-white tracking-tight">
              Echo Nullity IDE
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
              v0.2.0
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            Autonomous Causal Code Tomography &amp; Ghost-Line Elimination
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onOpenFolder();
              onClose();
            }}
            className="p-4 rounded-xl bg-[#121212] hover:bg-[#1a1a1a] border border-cyan-500/30 hover:border-cyan-400 text-left space-y-2 group transition-all"
          >
            <FolderOpen className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="font-bold text-xs text-white group-hover:text-cyan-300">Open Project Folder</div>
              <div className="text-[11px] text-zinc-500 font-sans">Analyze local repository</div>
            </div>
          </button>

          <button
            onClick={() => {
              onOpenDemo();
              onClose();
            }}
            className="p-4 rounded-xl bg-[#121212] hover:bg-[#1a1a1a] border border-purple-500/30 hover:border-purple-400 text-left space-y-2 group transition-all"
          >
            <Sparkles className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="font-bold text-xs text-white group-hover:text-purple-300">Demo Workspace</div>
              <div className="text-[11px] text-zinc-500 font-sans">ai_cart_project sample</div>
            </div>
          </button>
        </div>

        {/* Recent Workspaces List */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Recent Workspaces</span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {Array.isArray(recentWorkspaces) && recentWorkspaces.length > 0 ? (
              recentWorkspaces.map((folder, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onOpenRecent(folder);
                    onClose();
                  }}
                  className="w-full text-left py-2 px-3 rounded-lg bg-[#050505] hover:bg-[#141414] border border-zinc-800/80 hover:border-cyan-500/40 text-xs text-zinc-300 flex items-center justify-between group transition-all"
                >
                  <span className="truncate max-w-[340px]">{folder}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))
            ) : (
              <div className="p-3 bg-[#050505] rounded-lg border border-zinc-800 text-center text-zinc-500 text-xs">
                No recent workspaces saved.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#1a1a1a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-zinc-300 text-xs transition-colors"
          >
            Continue to Editor
          </button>
        </div>

      </div>
    </div>
  );
}
