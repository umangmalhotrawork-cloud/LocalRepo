"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileCode,
  Check,
  AlertCircle,
  Clock,
  GitPullRequest,
  CheckCheck,
  Sparkles,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { GitFileItem, LastCommitInfo } from "../hooks/useGit";

interface SourceControlPanelProps {
  isRepo: boolean;
  currentBranch: string;
  branches: string[];
  staged: GitFileItem[];
  unstaged: GitFileItem[];
  untracked: GitFileItem[];
  lastCommit: LastCommitInfo | null;
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onRefresh: () => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (message: string) => Promise<boolean>;
  onCommitAndPush?: (message: string) => Promise<boolean>;
  onPush?: (remote?: string, branch?: string) => Promise<boolean>;
  onSuggestMessage?: () => Promise<string | null>;
  onCheckoutBranch: (branch: string) => void;
  onCreateBranch: (branch: string) => void;
  onDiscardFile: (path: string) => void;
  onOpenFileDiff: (path: string, staged: boolean) => void;
}

export default function SourceControlPanel({
  isRepo,
  currentBranch,
  branches,
  staged,
  unstaged,
  untracked,
  lastCommit,
  loading,
  statusMessage,
  errorMessage,
  onRefresh,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onCommit,
  onCommitAndPush,
  onPush,
  onSuggestMessage,
  onCheckoutBranch,
  onCreateBranch,
  onDiscardFile,
  onOpenFileDiff,
}: SourceControlPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isUnstagedOpen, setIsUnstagedOpen] = useState(true);
  const [isUntrackedOpen, setIsUntrackedOpen] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [fileToDiscard, setFileToDiscard] = useState<string | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associatedRepo, setAssociatedRepo] = useState<{ fullName: string; owner: string; name: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== "undefined" && (window as any).electronAPI?.github?.getSelectedRepo) {
      (window as any).electronAPI.github.getSelectedRepo("").then((res: any) => {
        if (isMounted && res && res.repo) {
          setAssociatedRepo(res.repo);
        }
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const totalChanges = staged.length + unstaged.length + untracked.length;
  const lastChangesCountRef = useRef(0);

  // Automatic suggestion when meaningful file changes are detected
  const handleAutoSuggest = useCallback(async (force = false) => {
    if (!onSuggestMessage) return;
    if (!force && commitMessage.trim()) return; // Don't overwrite user's custom typed message
    if (totalChanges === 0) return;

    setIsGeneratingSuggestion(true);
    try {
      const suggested = await onSuggestMessage();
      if (suggested) {
        setCommitMessage(suggested);
      }
    } catch (e) {
      console.warn("[SOURCE-CONTROL] Suggest message error:", e);
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }, [onSuggestMessage, commitMessage, totalChanges]);

  // Trigger initial auto-suggest when changes appear if message is blank
  useEffect(() => {
    if (totalChanges > 0 && lastChangesCountRef.current === 0 && !commitMessage.trim()) {
      handleAutoSuggest(false);
    }
    lastChangesCountRef.current = totalChanges;
  }, [totalChanges, handleAutoSuggest, commitMessage]);

  const handleCommitSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim() || staged.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const success = await onCommit(commitMessage);
      if (success) {
        setCommitMessage("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitAndPushSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim() || totalChanges === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onCommitAndPush) {
        const success = await onCommitAndPush(commitMessage);
        if (success) {
          setCommitMessage("");
        }
      } else {
        // Fallback: stage all, commit
        await onStageAll();
        const success = await onCommit(commitMessage);
        if (success) {
          setCommitMessage("");
          if (onPush) await onPush();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePushOnly = async () => {
    if (!onPush || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPush();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBadge = (status: string) => {
    const s = status.toUpperCase().trim();
    if (s === "M") {
      return <span className="text-[10px] font-bold text-amber-400 font-mono">M</span>;
    }
    if (s === "A") {
      return <span className="text-[10px] font-bold text-emerald-400 font-mono">A</span>;
    }
    if (s === "D") {
      return <span className="text-[10px] font-bold text-rose-400 font-mono">D</span>;
    }
    if (s === "R") {
      return <span className="text-[10px] font-bold text-purple-400 font-mono">R</span>;
    }
    return <span className="text-[10px] font-bold text-cyan-400 font-mono">??</span>;
  };

  if (!isRepo) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 font-mono text-xs select-none">
        <GitBranch className="w-8 h-8 text-zinc-600 mb-3" />
        <div className="font-bold text-zinc-300 mb-1">No Git Repository Found</div>
        <p className="text-zinc-500 text-[11px] leading-relaxed max-w-xs">
          The current folder is not a Git repository or Git is not initialized.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--theme-surface-panel, #050507)",
        borderColor: "var(--theme-border, #1f1f1f)",
        color: "var(--theme-text, #f4f4f5)",
      }}
      className="h-full flex flex-col border-r font-mono text-xs select-none overflow-hidden"
    >
      {/* Top Header */}
      <div
        style={{
          backgroundColor: "var(--theme-surface, #0a0a0d)",
          borderColor: "var(--theme-border, #1f1f1f)",
        }}
        className="h-10 border-b px-3 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wide text-[11px]">
            Source Control
          </span>
          {totalChanges > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
              {totalChanges}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onSuggestMessage && totalChanges > 0 && (
            <button
              onClick={() => handleAutoSuggest(true)}
              disabled={isGeneratingSuggestion || loading}
              className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
              title="AI suggest concise commit message"
            >
              {isGeneratingSuggestion ? (
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              ) : (
                <Sparkles className="w-3 h-3 text-cyan-400" />
              )}
              <span>Suggest</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded bg-[#141414] hover:bg-[#202020] text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-40"
            title="Refresh Git Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Toast Messages */}
      {statusMessage && (
        <div className="px-3 py-1.5 bg-cyan-950/80 border-b border-cyan-500/30 text-cyan-300 text-[11px] flex items-center gap-1.5 animate-fadeIn">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="px-3 py-1.5 bg-rose-950/80 border-b border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* Branch & Last Commit Summary */}
      <div
        style={{
          backgroundColor: "var(--theme-surface, #08080a)",
          borderColor: "var(--theme-border, #1f1f1f)",
        }}
        className="p-3 border-b space-y-2 shrink-0"
      >
        {/* Branch selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={currentBranch}
              onChange={(e) => onCheckoutBranch(e.target.value)}
              style={{
                backgroundColor: "var(--theme-surface-raised, #121215)",
                borderColor: "var(--theme-border-card, #27272a)",
                color: "var(--theme-accent, #22d3ee)",
              }}
              className="border rounded px-2 py-0.5 text-xs font-bold outline-none cursor-pointer hover:border-cyan-500/40"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowBranchModal(true)}
            style={{
              backgroundColor: "var(--theme-surface-raised, #18181b)",
              borderColor: "var(--theme-border-card, #27272a)",
            }}
            className="px-2 py-0.5 rounded border text-zinc-300 text-[10.5px] flex items-center gap-1 cursor-pointer transition-all hover:brightness-125"
            title="Create New Branch"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            <span>New Branch</span>
          </button>
        </div>

        {/* Connected GitHub Repository Info */}
        {associatedRepo && (
          <div className="flex items-center justify-between px-2 py-1 rounded bg-cyan-950/40 border border-cyan-500/30 text-[10px] text-zinc-300">
            <span className="truncate font-bold text-cyan-300">
              GitHub: @{associatedRepo.fullName}
            </span>
            <span className="text-emerald-400 font-bold text-[9.5px]">✓ Connected</span>
          </div>
        )}

        {/* Last commit summary */}
        {lastCommit && (
          <div
            style={{
              backgroundColor: "var(--theme-surface-raised, #0d0d10)",
              borderColor: "var(--theme-border, #1f1f1f)",
            }}
            className="p-2 rounded border text-[10.5px] text-zinc-400 space-y-0.5"
          >
            <div className="flex items-center justify-between text-zinc-500 text-[10px]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last Commit:</span>
              </span>
              <span className="text-cyan-400 font-mono">{lastCommit.hash}</span>
            </div>
            <div className="text-zinc-200 font-medium truncate" title={lastCommit.message}>
              {lastCommit.message}
            </div>
          </div>
        )}
      </div>

      {/* Commit Input Area & One-Click Commit & Push Controls */}
      <div
        style={{
          backgroundColor: "var(--theme-surface-panel, #050507)",
          borderColor: "var(--theme-border, #1f1f1f)",
        }}
        className="p-3 border-b shrink-0 space-y-2"
      >
        <form onSubmit={handleCommitAndPushSubmit} className="space-y-2">
          {/* Message Header with Suggest Chip */}
          <div className="flex items-center justify-between text-[10.5px] text-zinc-400">
            <span>Commit Message:</span>
            {onSuggestMessage && totalChanges > 0 && !commitMessage.trim() && (
              <button
                type="button"
                onClick={() => handleAutoSuggest(true)}
                disabled={isGeneratingSuggestion}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer text-[10px]"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isGeneratingSuggestion ? "Generating..." : "Auto-fill with AI"}</span>
              </button>
            )}
          </div>

          <textarea
            rows={2}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={totalChanges > 0 ? "Commit message (Enter to Commit & Push, Shift+Enter for newline)..." : "No changes to commit"}
            style={{
              backgroundColor: "var(--theme-surface-input, #0a0a0d)",
              borderColor: "var(--theme-border-card, #27272a)",
              color: "var(--theme-text, #f4f4f5)",
            }}
            className="w-full border focus:border-cyan-500/50 rounded p-2 placeholder:text-zinc-600 outline-none text-xs resize-none font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleCommitAndPushSubmit(e);
              }
            }}
          />

          {/* Primary One-Click [Commit & Push] */}
          <button
            type="submit"
            disabled={!commitMessage.trim() || totalChanges === 0 || loading || isSubmitting}
            className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-950/40 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Stage all changes, commit, and push to remote (Enter)"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>
              {isSubmitting
                ? associatedRepo
                  ? `Pushing to @${associatedRepo.fullName}...`
                  : "Pushing to remote..."
                : `Commit & Push (${totalChanges} changed)`}
            </span>
          </button>

          {/* Secondary Actions: Commit Staged only, Push only */}
          {(staged.length > 0 || onPush) && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {staged.length > 0 && (
                <button
                  type="button"
                  onClick={handleCommitSubmit}
                  disabled={!commitMessage.trim() || staged.length === 0 || loading || isSubmitting}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-[#14141c] hover:bg-[#1c1c28] border border-[#262638] text-zinc-300 text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-30 cursor-pointer"
                  title="Commit only staged files"
                >
                  <GitCommit className="w-3 h-3 text-cyan-400" />
                  <span>Commit Staged ({staged.length})</span>
                </button>
              )}

              {onPush && (
                <button
                  type="button"
                  onClick={handlePushOnly}
                  disabled={loading || isSubmitting}
                  className="py-1.5 px-2.5 rounded-lg bg-[#14141c] hover:bg-[#1c1c28] border border-[#262638] text-zinc-300 text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-30 cursor-pointer"
                  title="Push local commits to remote"
                >
                  <UploadCloud className="w-3 h-3 text-emerald-400" />
                  <span>Push</span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Changed Files Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* 1. Staged Changes Section */}
        <div>
          <div className="flex items-center justify-between text-zinc-400 px-1 py-1 hover:bg-[#0e0e12] rounded cursor-pointer group">
            <div
              className="flex items-center gap-1 flex-1"
              onClick={() => setIsStagedOpen((prev) => !prev)}
            >
              {isStagedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-200">
                Staged Changes
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 text-[10px] font-bold">
                {staged.length}
              </span>
            </div>

            {staged.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnstageAll();
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-opacity"
                title="Unstage All"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isStagedOpen && staged.length > 0 && (
            <div className="mt-1 space-y-0.5 pl-2">
              {staged.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121216] cursor-pointer group transition-colors"
                  onClick={() => onOpenFileDiff(f.path, true)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-zinc-300 truncate text-[11px]" title={f.path}>
                      {f.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderBadge(f.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnstageFile(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
                      title="Unstage file"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Changes / Unstaged Section */}
        <div>
          <div className="flex items-center justify-between text-zinc-400 px-1 py-1 hover:bg-[#0e0e12] rounded cursor-pointer group">
            <div
              className="flex items-center gap-1 flex-1"
              onClick={() => setIsUnstagedOpen((prev) => !prev)}
            >
              {isUnstagedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-200">
                Changes
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                {unstaged.length}
              </span>
            </div>

            {unstaged.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStageAll();
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-opacity"
                title="Stage All"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isUnstagedOpen && unstaged.length > 0 && (
            <div className="mt-1 space-y-0.5 pl-2">
              {unstaged.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121216] cursor-pointer group transition-colors"
                  onClick={() => onOpenFileDiff(f.path, false)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-zinc-300 truncate text-[11px]" title={f.path}>
                      {f.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderBadge(f.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToDiscard(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-opacity"
                      title="Discard changes"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageFile(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
                      title="Stage file"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Untracked Files Section */}
        <div>
          <div className="flex items-center justify-between text-zinc-400 px-1 py-1 hover:bg-[#0e0e12] rounded cursor-pointer group">
            <div
              className="flex items-center gap-1 flex-1"
              onClick={() => setIsUntrackedOpen((prev) => !prev)}
            >
              {isUntrackedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-200">
                Untracked Files
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                {untracked.length}
              </span>
            </div>
          </div>

          {isUntrackedOpen && untracked.length > 0 && (
            <div className="mt-1 space-y-0.5 pl-2">
              {untracked.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121216] cursor-pointer group transition-colors"
                  onClick={() => onOpenFileDiff(f.path, false)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-zinc-300 truncate text-[11px]" title={f.path}>
                      {f.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderBadge(f.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToDiscard(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-opacity"
                      title="Delete untracked file"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStageFile(f.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
                      title="Track & Stage file"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && (
          <div className="py-8 text-center text-zinc-600 text-xs">
            <CheckCheck className="w-6 h-6 mx-auto mb-1 text-emerald-500/60" />
            <div>Working tree clean</div>
          </div>
        )}
      </div>

      {/* Create Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-[#27272a] rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
              <GitPullRequest className="w-4 h-4" />
              <span>Create New Branch</span>
            </div>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="e.g. feature/auth-v2"
              className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-zinc-200 text-xs outline-none focus:border-cyan-500 font-mono"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setNewBranchName("");
                }}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newBranchName.trim()) {
                    onCreateBranch(newBranchName.trim());
                    setShowBranchModal(false);
                    setNewBranchName("");
                  }
                }}
                disabled={!newBranchName.trim()}
                className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {fileToDiscard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-rose-500/30 rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
              <AlertCircle className="w-4 h-4" />
              <span>Discard Changes?</span>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Are you sure you want to discard all changes in <strong className="text-zinc-200">{fileToDiscard}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFileToDiscard(null)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDiscardFile(fileToDiscard);
                  setFileToDiscard(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
