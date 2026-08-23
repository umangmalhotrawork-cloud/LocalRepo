"use client";

import React, { useState, useRef } from "react";
import { 
  FolderOpen, GitBranch, Layers, Plus, ShieldCheck, Cpu, 
  Send, ArrowRight, Zap, ChevronDown, Check, Key
} from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface CodexBottomComposerProps {
  workspaceName?: string;
  gitBranch?: string;
  activeProvider?: string;
  activeModel?: string;
  promptValue?: string;
  onPromptChange?: (prompt: string) => void;
  onSelectModel: (providerId: string, modelId?: string) => void;
  onSubmitTask: (prompt: string, approvalMode: "auto" | "strict") => void;
  onOpenContinuum: () => void;
  onOpenFolder: () => void;
  disabled?: boolean;
}

export default function CodexBottomComposer({
  workspaceName = "NEXUS",
  gitBranch = "main",
  activeProvider = "gemini",
  activeModel = "gemini-2.5-flash",
  promptValue,
  onPromptChange,
  onSelectModel,
  onSubmitTask,
  onOpenContinuum,
  onOpenFolder,
  disabled = false,
}: CodexBottomComposerProps) {
  const [prompt, setPrompt] = useState(promptValue || "");
  const [approvalMode, setApprovalMode] = useState<"auto" | "strict">("auto");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);

  React.useEffect(() => {
    if (promptValue !== undefined && promptValue !== prompt) {
      setPrompt(promptValue);
    }
  }, [promptValue]);

  const approvalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const approvalDropdownRef = useOutsideClick<HTMLDivElement>({
    isOpen: showApprovalDropdown,
    onClose: () => setShowApprovalDropdown(false),
    triggerRef: approvalTriggerRef,
  });

  const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelDropdownRef = useOutsideClick<HTMLDivElement>({
    isOpen: showModelDropdown,
    onClose: () => setShowModelDropdown(false),
    triggerRef: modelTriggerRef,
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentPrompt = promptValue !== undefined ? promptValue : prompt;
    if (!currentPrompt.trim() || disabled) return;
    onSubmitTask(currentPrompt.trim(), approvalMode);
    if (promptValue === undefined) {
      setPrompt("");
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-2 select-none font-mono">
      {/* 1. Context Row: Workspace -> Local -> Branch -> CONTINUUM (Immediately right of branch!) */}
      <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--theme-text-muted, #a1a1aa)" }}>
        {/* Workspace Pill */}
        <button
          onClick={onOpenFolder}
          style={{
            backgroundColor: "var(--theme-surface-raised, #0e0e16)",
            borderColor: "var(--theme-border, #1e1e2c)",
            color: "var(--theme-text, #f4f4f5)",
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer text-[11px]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-bold truncate max-w-[140px]">{workspaceName}</span>
        </button>

        {/* Environment Pill */}
        <div 
          style={{
            backgroundColor: "var(--theme-surface-raised, #0e0e16)",
            borderColor: "var(--theme-border, #1e1e2c)",
            color: "var(--theme-text-muted, #a1a1aa)",
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Local</span>
        </div>

        {/* Branch Pill */}
        <div 
          style={{
            backgroundColor: "var(--theme-surface-raised, #0e0e16)",
            borderColor: "var(--theme-border, #1e1e2c)",
            color: "var(--theme-accent-secondary, #a855f7)",
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px]"
        >
          <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--theme-accent-secondary, #a855f7)" }} />
          <span className="font-bold truncate max-w-[150px]">{gitBranch}</span>
        </div>

        {/* CONTINUUM Pill — IMMEDIATELY TO THE RIGHT OF THE BRANCH! */}
        <button
          onClick={onOpenContinuum}
          style={{
            backgroundColor: "var(--theme-accent-dim, rgba(34,211,238,0.15))",
            borderColor: "var(--theme-border-focus, rgba(34,211,238,0.4))",
            color: "var(--theme-accent, #22d3ee)",
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer text-[11px] shadow-sm hover:brightness-125"
          title="Open Continuum Session Memory & Lineage"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
          <span>Continuum</span>
        </button>
      </div>

      {/* 2. Codex Agent Composer Container */}
      <form onSubmit={handleSubmit} className="w-full">
        <div 
          style={{
            backgroundColor: "var(--theme-surface-panel, #0b0b12)",
            borderColor: "var(--theme-border-card, #222234)",
          }}
          className="border focus-within:border-cyan-500/60 rounded-2xl p-3.5 shadow-2xl transition-all relative space-y-2"
        >
          {/* Prompt Textarea */}
          <textarea
            value={prompt}
            onChange={(e) => {
              const val = e.target.value;
              setPrompt(val);
              onPromptChange?.(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask NEXUS to investigate or change code... (⌘Enter to send)"
            disabled={disabled}
            style={{ color: "var(--theme-text, #f4f4f5)" }}
            className="w-full h-20 bg-transparent text-xs placeholder-zinc-500 focus:outline-none resize-none font-mono"
          />

          {/* Bottom Control Row */}
          <div 
            style={{ borderColor: "var(--theme-border-subtle, #1a1a28)" }}
            className="flex items-center justify-between pt-2 border-t text-xs"
          >
            <div className="flex items-center gap-2 relative">
              {/* Attachment / Action Button */}
              <button
                type="button"
                style={{
                  backgroundColor: "var(--theme-surface-raised, #141420)",
                  borderColor: "var(--theme-border-card, #242436)",
                }}
                className="w-7 h-7 rounded-lg border flex items-center justify-center text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Attach Context or File"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Approval Mode Control */}
              <div className="relative">
                <button
                  ref={approvalTriggerRef}
                  type="button"
                  onClick={() => setShowApprovalDropdown((prev) => !prev)}
                  style={{
                    backgroundColor: "var(--theme-surface-raised, #141420)",
                    borderColor: "var(--theme-border-card, #242436)",
                    color: "var(--theme-text, #f4f4f5)",
                  }}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${approvalMode === "auto" ? "text-emerald-400" : "text-amber-400"}`} />
                  <span>{approvalMode === "auto" ? "Auto-Approve Safe" : "Require Approval"}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {showApprovalDropdown && (
                  <div 
                    ref={approvalDropdownRef}
                    style={{
                      backgroundColor: "var(--theme-surface-card, #0c0c14)",
                      borderColor: "var(--theme-border-card, #242436)",
                    }}
                    className="absolute left-0 bottom-9 w-48 border rounded-xl shadow-2xl z-50 p-1 space-y-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalMode("auto");
                        setShowApprovalDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-white/5 text-emerald-300 cursor-pointer"
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
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-white/5 text-amber-300 cursor-pointer"
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
                  ref={modelTriggerRef}
                  type="button"
                  onClick={() => setShowModelDropdown((prev) => !prev)}
                  style={{
                    backgroundColor: "var(--theme-surface-raised, #141420)",
                    borderColor: "var(--theme-border-card, #242436)",
                    color: "var(--theme-accent, #22d3ee)",
                  }}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 cursor-pointer max-w-[180px]"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate capitalize">
                    {activeProvider.startsWith("nexus") 
                      ? (activeProvider === "nexus6" ? "NEXUS 6 (Groq)" : `NEXUS ${activeProvider.replace("nexus", "")} (Gemini)`) 
                      : `${activeProvider} (${activeModel.split('/').pop()?.replace(/^models\//, '') || activeModel})`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                </button>

                {showModelDropdown && (
                  <div 
                    ref={modelDropdownRef}
                    style={{
                      backgroundColor: "var(--theme-surface-card, #0c0c14)",
                      borderColor: "var(--theme-border-card, #242436)",
                    }}
                    className="absolute left-0 bottom-9 w-64 border rounded-xl shadow-2xl z-50 p-1.5 space-y-1 text-xs max-h-56 overflow-y-auto"
                  >
                    {[
                      { id: "nexus1", name: "NEXUS 1", modelId: "gemini-2.5-flash", label: "NEXUS 1 (Gemini 2.5 Flash)" },
                      { id: "nexus2", name: "NEXUS 2", modelId: "gemini-3.5-flash", label: "NEXUS 2 (Gemini 3.5 Flash)" },
                      { id: "nexus3", name: "NEXUS 3", modelId: "gemini-3.5-flash", label: "NEXUS 3 (Gemini 3.5 Flash)" },
                      { id: "nexus4", name: "NEXUS 4", modelId: "gemini-3.5-flash", label: "NEXUS 4 (Gemini 3.5 Flash)" },
                      { id: "nexus5", name: "NEXUS 5", modelId: "gemini-3.5-flash", label: "NEXUS 5 (Gemini 3.5 Flash)" },
                      { id: "nexus6", name: "NEXUS 6", modelId: "openai/gpt-oss-120b", label: "NEXUS 6 (Groq GPT-OSS 120B)" },
                    ].map((p, idx) => {
                      const isSel = activeProvider === p.id && (activeModel === p.modelId || (!activeModel && idx === 0));
                      return (
                        <button
                          key={`${p.id}-${p.modelId}-${idx}`}
                          type="button"
                          onClick={() => {
                            onSelectModel(p.id, p.modelId);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-white/5 cursor-pointer text-xs ${
                            isSel ? "text-cyan-300 font-bold bg-cyan-950/40" : "text-zinc-400"
                          }`}
                        >
                          <span className="truncate">{isSel ? `✓ ${p.label}` : p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || disabled}
              style={{
                backgroundColor: "var(--theme-accent, #06b6d4)",
                color: "#ffffff",
              }}
              className="px-4 py-1.5 rounded-xl hover:brightness-110 disabled:opacity-40 text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
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
