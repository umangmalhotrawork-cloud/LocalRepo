"use client";

import React, { useState } from "react";
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

  const handleCommitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || staged.length === 0) return;
    const success = await onCommit(commitMessage);
    if (success) {
      setCommitMessage("");
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
    <div className="h-full flex flex-col bg-[#050507] border-r border-[#1f1f1f] font-mono text-xs select-none overflow-hidden">
      {/* Top Header */}
      <div className="h-10 bg-[#0a0a0d] border-b border-[#1f1f1f] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wide text-[11px]">
            Source Control
          </span>
        </div>

        <div className="flex items-center gap-1.5">
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
      <div className="p-3 bg-[#08080a] border-b border-[#1f1f1f] space-y-2 shrink-0">
        {/* Branch selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={currentBranch}
              onChange={(e) => onCheckoutBranch(e.target.value)}
              className="bg-[#121215] border border-[#27272a] text-cyan-300 rounded px-2 py-0.5 text-xs font-bold outline-none cursor-pointer hover:border-cyan-500/40"
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
            className="px-2 py-0.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 text-[10.5px] flex items-center gap-1 cursor-pointer transition-all"
            title="Create New Branch"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            <span>New Branch</span>
          </button>
        </div>

        {/* Last commit summary */}
        {lastCommit && (
          <div className="p-2 rounded bg-[#0d0d10] border border-[#1f1f1f] text-[10.5px] text-zinc-400 space-y-0.5">
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

      {/* Commit Input Area */}
      <div className="p-3 bg-[#050507] border-b border-[#1f1f1f] shrink-0 space-y-2">
        <form onSubmit={handleCommitSubmit} className="space-y-2">
          <textarea
            rows={2}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Message (Cmd+Enter to commit)..."
            className="w-full bg-[#0a0a0d] border border-[#27272a] focus:border-cyan-500/50 rounded p-2 text-zinc-200 placeholder:text-zinc-600 outline-none text-xs resize-none font-mono"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                handleCommitSubmit(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={!commitMessage.trim() || staged.length === 0 || loading}
            className="w-full py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <GitCommit className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Commit ({staged.length} staged)</span>
          </button>
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
