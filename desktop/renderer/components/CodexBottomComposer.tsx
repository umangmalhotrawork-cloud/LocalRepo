"use client";

import React, { useState } from "react";
import { 
  FolderOpen, GitBranch, Layers, Plus, ShieldCheck, Cpu, 
  Send, ArrowRight, Zap, ChevronDown, Check, Key
} from "lucide-react";

interface CodexBottomComposerProps {
  workspaceName?: string;
  gitBranch?: string;
  activeProvider?: string;
  activeModel?: string;
  onSelectModel: (providerId: string, modelId?: string) => void;
  onSubmitTask: (prompt: string, approvalMode: "auto" | "strict") => void;
  onOpenContinuum: () => void;
  onOpenFolder: () => void;
  disabled?: boolean;
}

export default function CodexBottomComposer({
  workspaceName = "Echo Nullity",
  gitBranch = "main",
  activeProvider = "gemini",
  activeModel = "gemini-1.5-flash",
  onSelectModel,
  onSubmitTask,
  onOpenContinuum,
  onOpenFolder,
  disabled = false,
}: CodexBottomComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [approvalMode, setApprovalMode] = useState<"auto" | "strict">("auto");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || disabled) return;
    onSubmitTask(prompt.trim(), approvalMode);
    setPrompt("");
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-2 select-none font-mono">
      {/* 1. Context Row: Workspace -> Local -> Branch -> CONTINUUM (Immediately right of branch!) */}
      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
        {/* Workspace Pill */}
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0e16] hover:bg-[#141420] border border-[#1e1e2c] text-zinc-300 transition-colors cursor-pointer text-[11px]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-bold truncate max-w-[140px]">{workspaceName}</span>
        </button>

        {/* Environment Pill */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0e0e16] border border-[#1e1e2c] text-zinc-400 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Local</span>
        </div>

        {/* Branch Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0e16] border border-[#1e1e2c] text-purple-300 text-[11px]">
          <GitBranch className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="font-bold truncate max-w-[150px]">{gitBranch}</span>
        </div>

        {/* CONTINUUM Pill — IMMEDIATELY TO THE RIGHT OF THE BRANCH! */}
        <button
          onClick={onOpenContinuum}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold transition-all cursor-pointer text-[11px] shadow-sm shadow-cyan-950/50"
          title="Open Continuum Session Memory & Lineage"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
          <span>Continuum</span>
        </button>
      </div>

      {/* 2. Codex Agent Composer Container */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="bg-[#0b0b12] border border-[#222234] focus-within:border-cyan-500/60 rounded-2xl p-3.5 shadow-2xl transition-all relative space-y-2">
          {/* Prompt Textarea */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            placeholder="Ask Echo Nullity to investigate or change code... (⌘Enter to send)"
            disabled={disabled}
            className="w-full h-20 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-mono"
          />

          {/* Bottom Control Row */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1a1a28] text-xs">
            <div className="flex items-center gap-2 relative">
              {/* Attachment / Action Button */}
              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-[#141420] hover:bg-[#1a1a2a] border border-[#242436] flex items-center justify-center text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Attach Context or File"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Approval Mode Control */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApprovalDropdown((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-[#141420] hover:bg-[#1a1a2a] border border-[#242436] text-zinc-300 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${approvalMode === "auto" ? "text-emerald-400" : "text-amber-400"}`} />
                  <span>{approvalMode === "auto" ? "Auto-Approve Safe" : "Require Approval"}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {showApprovalDropdown && (
                  <div className="absolute left-0 bottom-9 w-48 bg-[#0c0c14] border border-[#242436] rounded-xl shadow-2xl z-50 p-1 space-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalMode("auto");
                        setShowApprovalDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#141420] text-emerald-300 cursor-pointer"
                    >
                      <span>Auto-Approve Safe</span>
                      {approvalMode === "auto" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalMode("strict");
                        setShowApprovalDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#141420] text-amber-300 cursor-pointer"
                    >
                      <span>Require Approval</span>
                      {approvalMode === "strict" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Model Selector Button & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelDropdown((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-[#141420] hover:bg-[#1a1a2a] border border-[#242436] text-cyan-300 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gemini 1.5 Flash</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {showModelDropdown && (
                  <div className="absolute left-0 bottom-9 w-52 bg-[#0c0c14] border border-[#242436] rounded-xl shadow-2xl z-50 p-1 space-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModel("gemini", "gemini-1.5-flash");
                        setShowModelDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#141420] text-cyan-300 cursor-pointer font-bold"
                    >
                      <span>✓ Gemini 1.5 Flash</span>
                      <span className="text-[9px] text-emerald-400">Connected</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModel("claude");
                        setShowModelDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#141420] text-zinc-400 cursor-pointer opacity-70"
                    >
                      <span>Claude</span>
                      <span className="text-[9px] text-zinc-500">Fallback</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModel("grok");
                        setShowModelDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#141420] text-zinc-400 cursor-pointer opacity-70"
                    >
                      <span>Grok</span>
                      <span className="text-[9px] text-zinc-500">Fallback</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || disabled}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/50 cursor-pointer"
            >
              <span>Start Task</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
