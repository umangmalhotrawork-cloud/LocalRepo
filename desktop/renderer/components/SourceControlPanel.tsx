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
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  X,
  ShieldAlert,
  Tag,
  GitMerge,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  Split,
  FolderGit2,
} from "lucide-react";
import { GitFileItem, LastCommitInfo, GitBranchInfo, GitStashItem, GitHistoryGraph, GitCommitItem } from "../hooks/useGit";

interface SourceControlPanelProps {
  isRepo: boolean;
  currentBranch: string;
  isDetached?: boolean;
  tracking?: string | null;
  ahead?: number;
  behind?: number;
  isClean?: boolean;
  hasLocalChanges?: boolean;
  branches: string[];
  branchDetails?: GitBranchInfo[];
  stashes?: GitStashItem[];
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
  onCheckoutBranch: (branch: string, force?: boolean) => Promise<boolean> | void;
  onCreateBranch: (branch: string, checkout?: boolean) => Promise<boolean> | void;
  onValidateBranchName?: (name: string) => Promise<{ valid: boolean; error?: string }>;
  onStashSave?: (options?: { message?: string; includeUntracked?: boolean } | string) => Promise<boolean>;
  onStashApply?: (stashId?: string) => Promise<boolean>;
  onStashPop?: (stashId?: string) => Promise<boolean>;
  onStashDrop?: (stashId?: string) => Promise<boolean>;
  onStashClear?: () => Promise<boolean>;
  onDiscardFile: (path: string) => void;
  onOpenFileDiff: (path: string, staged: boolean) => void;
  // Milestone 28: Git Visual History Props
  historyGraph?: GitHistoryGraph | null;
  selectedCommit?: GitCommitItem | null;
  selectedCommitDiff?: any;
  historyBranch?: string;
  setHistoryBranch?: (b: string) => void;
  historyLoading?: boolean;
  onFetchHistory?: (options?: any) => Promise<any>;
  onFetchCommitDetails?: (hash: string) => Promise<any>;
  onFetchCommitDiff?: (hash: string, file?: string, parentIndex?: number) => Promise<any>;
  onFetchFileHistory?: (filePath: string) => Promise<any>;
  onSelectCommit?: (commit: GitCommitItem | null) => void;
  // Conflict Resolver Integration (Milestone 30)
  onOpenConflictResolver?: () => void;
  conflictsCount?: number;
}

export default function SourceControlPanel({
  isRepo,
  currentBranch,
  isDetached = false,
  tracking = null,
  ahead = 0,
  behind = 0,
  isClean = true,
  hasLocalChanges = false,
  branches = [],
  branchDetails = [],
  stashes = [],
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
  onValidateBranchName,
  onStashSave,
  onStashApply,
  onStashPop,
  onStashDrop,
  onStashClear,
  onDiscardFile,
  onOpenFileDiff,
  historyGraph,
  selectedCommit,
  selectedCommitDiff,
  historyBranch = "ALL",
  setHistoryBranch,
  historyLoading = false,
  onFetchHistory,
  onFetchCommitDetails,
  onFetchCommitDiff,
  onFetchFileHistory,
  onSelectCommit,
  onOpenConflictResolver,
  conflictsCount = 0,
}: SourceControlPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isUnstagedOpen, setIsUnstagedOpen] = useState(true);
  const [isUntrackedOpen, setIsUntrackedOpen] = useState(true);
  const [isStashesOpen, setIsStashesOpen] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchCheckout, setNewBranchCheckout] = useState(true);
  const [branchValidationError, setBranchValidationError] = useState<string | null>(null);
  const [targetBranchToSwitch, setTargetBranchToSwitch] = useState<string | null>(null);
  const [showDirtySwitchModal, setShowDirtySwitchModal] = useState(false);
  const [fileToDiscard, setFileToDiscard] = useState<string | null>(null);
  const [stashToDrop, setStashToDrop] = useState<GitStashItem | null>(null);
  const [showStashSaveModal, setShowStashSaveModal] = useState(false);
  const [customStashMessage, setCustomStashMessage] = useState("");
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associatedRepo, setAssociatedRepo] = useState<{ fullName: string; owner: string; name: string } | null>(null);

  // Milestone 28: Visual History & Inspection State
  const [activeSection, setActiveSection] = useState<"changes" | "history" | "stashes">("changes");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [inspectingCommit, setInspectingCommit] = useState<GitCommitItem | null>(null);
  const [inspectingCommitDetails, setInspectingCommitDetails] = useState<GitCommitItem | null>(null);
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null);
  const [activeDiffData, setActiveDiffData] = useState<any>(null);
  const [activeDiffParentIndex, setActiveDiffParentIndex] = useState<number>(0);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const LANE_COLORS = [
    "#22d3ee", // cyan-400
    "#34d399", // emerald-400
    "#a78bfa", // purple-400
    "#fbbf24", // amber-400
    "#f43f5e", // rose-500
    "#60a5fa", // blue-400
    "#f97316", // orange-500
    "#ec4899", // pink-500
  ];
  const getLaneColor = (lane = 0) => LANE_COLORS[Math.abs(lane) % LANE_COLORS.length];

  const handleSelectCommit = async (commit: GitCommitItem) => {
    setInspectingCommit(commit);
    setInspectingCommitDetails(commit);
    if (onSelectCommit) onSelectCommit(commit);
    if (onFetchCommitDetails) {
      try {
        const details = await onFetchCommitDetails(commit.hash);
        if (details) {
          setInspectingCommitDetails(details);
        }
      } catch (e) {}
    }
  };

  const handleInspectFileDiff = async (file: string, commitHash: string, parentIndex = 0) => {
    setActiveDiffFile(file);
    setActiveDiffParentIndex(parentIndex);
    setIsDiffLoading(true);
    if (onFetchCommitDiff) {
      try {
        const diffData = await onFetchCommitDiff(commitHash, file, parentIndex);
        setActiveDiffData(diffData);
      } catch (e) {
        setActiveDiffData(null);
      }
    }
    setIsDiffLoading(false);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

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

  useEffect(() => {
    if (activeSection === "history" && !historyGraph && onFetchHistory) {
      onFetchHistory();
    }
  }, [activeSection, historyGraph, onFetchHistory]);

  const totalChanges = staged.length + unstaged.length + untracked.length;
  const lastChangesCountRef = useRef(0);

  const validateBranchInput = (name: string): string | null => {
    if (!name || !name.trim()) return "Branch name cannot be empty.";
    const trimmed = name.trim();
    if (/\s/.test(trimmed)) return "Branch name cannot contain spaces.";
    if (trimmed.startsWith("/") || trimmed.endsWith("/")) return "Cannot start or end with a slash.";
    if (trimmed.startsWith(".") || trimmed.endsWith(".")) return "Cannot start or end with a dot.";
    if (trimmed.startsWith("-")) return "Cannot start with a hyphen.";
    if (trimmed.includes("..")) return "Cannot contain consecutive dots (..).";
    if (/[~^:?*\[\\@{]/.test(trimmed)) return "Contains invalid characters (~, ^, :, ?, *, [, \\, @{).";
    if (trimmed.toUpperCase() === "HEAD") return "Cannot be named 'HEAD'.";
    if (branches.includes(trimmed)) return `Branch "${trimmed}" already exists.`;
    return null;
  };

  const handleSelectBranch = (branchName: string) => {
    if (!branchName || branchName === currentBranch) {
      setShowBranchDropdown(false);
      return;
    }
    if (hasLocalChanges || totalChanges > 0) {
      setTargetBranchToSwitch(branchName);
      setShowDirtySwitchModal(true);
      setShowBranchDropdown(false);
      return;
    }
    onCheckoutBranch(branchName);
    setShowBranchDropdown(false);
  };

  const handleDirtySwitchStash = async () => {
    if (!targetBranchToSwitch) return;
    if (onStashSave) {
      try {
        await onStashSave(`WIP before checkout ${targetBranchToSwitch}`);
      } catch (e) {
        console.error("Stash before checkout failed:", e);
      }
    }
    await onCheckoutBranch(targetBranchToSwitch);
    setShowDirtySwitchModal(false);
    setTargetBranchToSwitch(null);
  };

  const handleDirtySwitchForce = async () => {
    if (!targetBranchToSwitch) return;
    await onCheckoutBranch(targetBranchToSwitch, true);
    setShowDirtySwitchModal(false);
    setTargetBranchToSwitch(null);
  };

  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase().trim())
  );

  // Automatic suggestion when meaningful file changes are detected
  const handleAutoSuggest = useCallback(async (force = false) => {
    if (!onSuggestMessage) return;
    if (!force && commitMessage.trim()) return;
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

      {/* Sub-navigation Tabs: Changes | History | Stashes */}
      <div className="flex border-b border-[#1f1f1f] bg-[#08080c] shrink-0 text-[11px] font-semibold">
        <button
          onClick={() => setActiveSection("changes")}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSection === "changes"
              ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Changes</span>
          {totalChanges > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 text-[9.5px] border border-cyan-500/30">
              {totalChanges}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveSection("history");
            if (!historyGraph && onFetchHistory) onFetchHistory();
          }}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSection === "history"
              ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>History</span>
          {historyGraph && historyGraph.totalCommits > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[9.5px]">
              {historyGraph.totalCommits}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection("stashes")}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeSection === "stashes"
              ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Stashes</span>
          {stashes.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 text-[9.5px] border border-amber-500/30">
              {stashes.length}
            </span>
          )}
        </button>
      </div>

      {/* SECTION 1: CHANGES VIEW */}
      {activeSection === "changes" && (
        <>
          {/* Milestone 30: Unresolved Conflicts Alert */}
          {conflictsCount > 0 && (
            <div className="p-2.5 bg-amber-950/50 border-b border-amber-500/40 flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px] text-amber-300">
                    {conflictsCount} Merge Conflict{conflictsCount > 1 ? "s" : ""}
                  </div>
                  <div className="text-[9.5px] text-amber-200/70 truncate">
                    Requires 3-way conflict resolution
                  </div>
                </div>
              </div>
              {onOpenConflictResolver && (
                <button
                  onClick={onOpenConflictResolver}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-sm shrink-0"
                >
                  <GitMerge className="w-3 h-3" />
                  <span>Resolve</span>
                </button>
              )}
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
            {/* Interactive Branch selector */}
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowBranchDropdown((prev) => !prev)}
                  style={{
                    backgroundColor: "var(--theme-surface-raised, #121215)",
                    borderColor: "var(--theme-border-card, #27272a)",
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold text-cyan-400 hover:border-cyan-500/50 transition-all cursor-pointer truncate max-w-[200px]"
                  title={`Active branch: ${currentBranch}${tracking ? ` (tracking ${tracking})` : ""}`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{currentBranch || "HEAD"}</span>
                  {isDetached && (
                    <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                      Detached
                    </span>
                  )}
                  {tracking && (ahead > 0 || behind > 0) && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {ahead > 0 ? `↑${ahead}` : ""}
                      {behind > 0 ? `↓${behind}` : ""}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0 ml-auto" />
                </button>

                <button
                  onClick={() => {
                    setShowBranchModal(true);
                    setBranchValidationError(null);
                  }}
                  style={{
                    backgroundColor: "var(--theme-surface-raised, #18181b)",
                    borderColor: "var(--theme-border-card, #27272a)",
                  }}
                  className="px-2 py-1 rounded border text-zinc-300 hover:text-white text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition-all hover:border-cyan-500/40 shrink-0"
                  title="Create New Branch"
                >
                  <Plus className="w-3 h-3 text-cyan-400" />
                  <span>New Branch</span>
                </button>
              </div>

              {/* Branch Switcher Popover */}
              {showBranchDropdown && (
                <div
                  style={{
                    backgroundColor: "var(--theme-surface-overlay, #0c0c12)",
                    borderColor: "var(--theme-border, #27272a)",
                  }}
                  className="absolute left-0 top-9 w-64 border rounded-xl shadow-2xl z-40 p-2 space-y-2 text-xs font-mono animate-fadeIn"
                >
                  <div className="relative">
                    <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="Filter branches..."
                      className="w-full bg-[#16161f] border border-[#272736] rounded pl-7 pr-2 py-1 text-zinc-200 text-xs outline-none focus:border-cyan-500/50"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                    {filteredBranches.length === 0 ? (
                      <div className="p-2 text-zinc-500 text-[11px] text-center italic">
                        No matching branches
                      </div>
                    ) : (
                      filteredBranches.map((b) => {
                        const isCurrent = b === currentBranch;
                        const isRemote = b.startsWith("remotes/") || b.startsWith("origin/");
                        const details = branchDetails.find((d) => d.name === b);

                        return (
                          <button
                            key={b}
                            onClick={() => handleSelectBranch(b)}
                            className={`w-full px-2 py-1 rounded text-left flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                              isCurrent
                                ? "bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/30"
                                : "text-zinc-300 hover:bg-[#181822] hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <GitBranch className={`w-3 h-3 ${isCurrent ? "text-cyan-400" : isRemote ? "text-purple-400" : "text-zinc-500"}`} />
                              <span className="truncate">{b}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[10px]">
                              {details && (details.ahead || 0) > 0 && <span className="text-emerald-400 font-mono">↑{details.ahead}</span>}
                              {details && (details.behind || 0) > 0 && <span className="text-rose-400 font-mono">↓{details.behind}</span>}
                              {isCurrent && <Check className="w-3 h-3 text-cyan-400" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-[#1c1c28] pt-1.5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setShowBranchDropdown(false);
                        setShowBranchModal(true);
                        setBranchValidationError(null);
                      }}
                      className="w-full py-1 text-center text-cyan-400 hover:text-cyan-300 hover:bg-[#14141e] rounded text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create Branch...</span>
                    </button>
                  </div>
                </div>
              )}
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

          {/* Commit Input Area */}
          <div
            style={{
              backgroundColor: "var(--theme-surface-panel, #050507)",
              borderColor: "var(--theme-border, #1f1f1f)",
            }}
            className="p-3 border-b shrink-0 space-y-2"
          >
            <form onSubmit={handleCommitAndPushSubmit} className="space-y-2">
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

              {/* Secondary Actions */}
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
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-300 transition-opacity"
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
          </div>
        </>
      )}

      {/* SECTION 2: VISUAL HISTORY GRAPH VIEW (Milestone 28) */}
      {activeSection === "history" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* History Controls Bar */}
          <div className="p-2.5 border-b border-[#1f1f1f] bg-[#09090d] space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Branch Selector */}
              <div className="relative flex-1">
                <select
                  value={historyBranch || "ALL"}
                  onChange={(e) => {
                    const newBranch = e.target.value;
                    if (setHistoryBranch) setHistoryBranch(newBranch);
                    if (onFetchHistory) onFetchHistory({ branch: newBranch });
                  }}
                  className="w-full bg-[#121218] border border-[#272736] rounded px-2 py-1 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="ALL">🌐 All Branches & Tags</option>
                  <option value={currentBranch || "HEAD"}>📍 Current: {currentBranch || "HEAD"}</option>
                  {branches
                    .filter((b) => b !== currentBranch)
                    .map((b) => (
                      <option key={b} value={b}>
                        {b.startsWith("origin/") || b.startsWith("remotes/") ? "☁️ " : "🌿 "}
                        {b}
                      </option>
                    ))}
                </select>
              </div>

              <button
                onClick={() => onFetchHistory && onFetchHistory()}
                disabled={historyLoading}
                className="p-1 rounded bg-[#14141c] hover:bg-[#20202c] border border-[#272736] text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-40"
                title="Refresh Git History"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </div>

            {/* Commit Search Filter */}
            <div className="relative">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search history by message, author, hash..."
                className="w-full bg-[#121218] border border-[#272736] rounded pl-7 pr-2 py-1 text-zinc-200 text-[11px] outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
              />
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery("")}
                  className="absolute right-2 top-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Commit Timeline Graph */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {historyLoading && (!historyGraph || historyGraph.commits.length === 0) ? (
              <div className="flex flex-col items-center justify-center p-8 text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="text-[11px]">Loading commit topology...</span>
              </div>
            ) : !historyGraph || historyGraph.commits.length === 0 ? (
              <div className="text-center p-8 text-zinc-500 text-[11px] space-y-1">
                <FolderGit2 className="w-6 h-6 mx-auto text-zinc-600" />
                <div className="font-bold text-zinc-400">No commits found</div>
                <p className="text-zinc-600 text-[10px]">
                  {historyBranch && historyBranch !== "ALL"
                    ? `No commits found on branch ${historyBranch}`
                    : "Repository has no commit history yet."}
                </p>
              </div>
            ) : (
              (() => {
                const query = historySearchQuery.toLowerCase().trim();
                const filtered = historyGraph.commits.filter(
                  (c) =>
                    !query ||
                    c.message.toLowerCase().includes(query) ||
                    c.author.toLowerCase().includes(query) ||
                    c.shortHash.toLowerCase().includes(query) ||
                    c.hash.toLowerCase().includes(query)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center p-6 text-zinc-500 text-[11px]">
                      No commits matching &quot;{historySearchQuery}&quot;
                    </div>
                  );
                }

                return filtered.map((commit, idx) => {
                  const isSelected = inspectingCommit?.hash === commit.hash;
                  const lane = commit.lane || 0;
                  const laneColor = getLaneColor(lane);

                  return (
                    <div
                      key={commit.hash}
                      onClick={() => handleSelectCommit(commit)}
                      className={`relative flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer group ${
                        isSelected
                          ? "bg-cyan-950/40 border-cyan-500/50 shadow-sm"
                          : "bg-[#0c0c10] hover:bg-[#121218] border-[#1f1f28] hover:border-[#2d2d3d]"
                      }`}
                    >
                      {/* Left Graph Lane Visual */}
                      <div className="flex flex-col items-center shrink-0 w-4 pt-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full border-2 shadow-sm"
                          style={{
                            borderColor: laneColor,
                            backgroundColor: commit.isHead ? laneColor : "#09090d",
                          }}
                          title={`Lane ${lane}${commit.isHead ? " (HEAD)" : ""}`}
                        />
                        {idx < filtered.length - 1 && (
                          <div
                            className="w-0.5 flex-1 min-h-[24px] mt-1 opacity-40"
                            style={{ backgroundColor: laneColor }}
                          />
                        )}
                      </div>

                      {/* Right Commit Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Header: Short Hash + Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyHash(commit.hash);
                            }}
                            className="px-1.5 py-0.2 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/20 cursor-copy"
                            title={`Copy full hash: ${commit.hash}`}
                          >
                            {copiedHash === commit.hash ? "Copied!" : commit.shortHash}
                          </span>

                          {commit.isHead && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[9.5px] font-bold border border-cyan-500/40">
                              HEAD
                            </span>
                          )}

                          {commit.branchRefs?.map((b) => (
                            <span
                              key={b}
                              className="px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 text-[9.5px] font-bold border border-emerald-500/30 flex items-center gap-1"
                            >
                              <GitBranch className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{b}</span>
                            </span>
                          ))}

                          {commit.tags?.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 text-[9.5px] font-bold border border-purple-500/30 flex items-center gap-1"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              <span>{t}</span>
                            </span>
                          ))}

                          {commit.isMerge && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 text-[9.5px] font-bold border border-amber-500/30 flex items-center gap-1">
                              <GitMerge className="w-2.5 h-2.5" />
                              <span>Merge</span>
                            </span>
                          )}
                        </div>

                        {/* Commit Message */}
                        <div className="text-zinc-200 text-xs font-medium leading-snug break-words">
                          {commit.message}
                        </div>

                        {/* Author & Timestamp Footer */}
                        <div className="flex items-center justify-between text-zinc-500 text-[10px] pt-0.5">
                          <span className="truncate text-zinc-400 font-medium">{commit.author}</span>
                          <span className="shrink-0">{new Date(commit.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: STASHES VIEW (Milestone 26) */}
      {activeSection === "stashes" && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-200">
              Stash Stack ({stashes.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowStashSaveModal(true)}
                disabled={totalChanges === 0}
                className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Save Stash</span>
              </button>

              {stashes.length > 0 && onStashClear && (
                <button
                  onClick={() => {
                    if (window.confirm("Clear all stashes? This cannot be undone.")) {
                      onStashClear();
                    }
                  }}
                  className="px-2 py-1 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-zinc-800 text-[10.5px] transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {stashes.length === 0 ? (
            <div className="text-center p-8 text-zinc-500 text-xs">
              No saved stashes in this workspace.
            </div>
          ) : (
            <div className="space-y-2">
              {stashes.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg bg-[#0d0d12] border border-[#1e1e28] hover:border-cyan-500/30 transition-all space-y-2 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Archive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-bold text-cyan-300 text-xs">{s.id}</span>
                      {s.branch && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 text-[9.5px] font-bold border border-purple-500/30">
                          {s.branch}
                        </span>
                      )}
                    </div>
                    {s.date && <span className="text-[10px] text-zinc-500 shrink-0">{s.date}</span>}
                  </div>

                  <div className="text-zinc-300 text-xs leading-relaxed" title={s.message}>
                    {s.message || "WIP changes"}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#181822]">
                    {onStashApply && (
                      <button
                        onClick={() => onStashApply(s.id)}
                        className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Apply</span>
                      </button>
                    )}
                    {onStashPop && (
                      <button
                        onClick={() => onStashPop(s.id)}
                        className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Pop</span>
                      </button>
                    )}
                    {onStashDrop && (
                      <button
                        onClick={() => setStashToDrop(s)}
                        className="p-1 rounded hover:bg-rose-950 text-zinc-500 hover:text-rose-400 cursor-pointer"
                        title="Drop stash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMMIT INSPECTOR MODAL / DRAWER (Milestone 28) */}
      {inspectingCommit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono">
          <div className="bg-[#0c0c12] border border-[#27273a] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1f1f2e] bg-[#101018] flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-zinc-100 text-sm">Commit Inspector</span>
                  <span
                    onClick={() => handleCopyHash(inspectingCommit.hash)}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-400 font-mono text-xs font-bold border border-cyan-500/30 cursor-copy flex items-center gap-1"
                    title="Click to copy full hash"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedHash === inspectingCommit.hash ? "Copied!" : inspectingCommit.shortHash}</span>
                  </span>
                  {inspectingCommit.isMerge && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      Merge Commit
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  Author: <strong className="text-zinc-200">{inspectingCommit.author}</strong> &lt;{inspectingCommit.email}&gt;
                </div>
                <div className="text-[11px] text-zinc-500">
                  Date: {new Date(inspectingCommit.timestamp).toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => setInspectingCommit(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              {/* Commit Message */}
              <div className="p-3 rounded-xl bg-[#07070a] border border-[#1b1b24] space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Commit Message:</span>
                <div className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {inspectingCommitDetails?.body || inspectingCommit.message}
                </div>
              </div>

              {/* Parents Navigation & Comparison */}
              {inspectingCommit.parents && inspectingCommit.parents.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                    Parent Commits ({inspectingCommit.parents.length}):
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {inspectingCommit.parents.map((parentHash, pIdx) => (
                      <button
                        key={parentHash}
                        onClick={async () => {
                          const parentCommit = historyGraph?.commits.find((c) => c.hash === parentHash || c.shortHash === parentHash.slice(0, 7));
                          if (parentCommit) {
                            handleSelectCommit(parentCommit);
                          } else if (onFetchCommitDetails) {
                            const details = await onFetchCommitDetails(parentHash);
                            if (details) handleSelectCommit(details);
                          }
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                          activeDiffParentIndex === pIdx && inspectingCommit.isMerge
                            ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 font-bold"
                            : "bg-[#12121a] hover:bg-[#1c1c28] text-zinc-300 border-[#262638]"
                        }`}
                        title="Navigate to parent commit"
                      >
                        <GitCommit className="w-3 h-3 text-cyan-400" />
                        <span>Parent {pIdx + 1}: {parentHash.slice(0, 7)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Changed Files Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                    Files Changed ({inspectingCommitDetails?.filesChanged?.length || inspectingCommit.filesChanged?.length || 0}):
                  </span>
                  {((inspectingCommitDetails?.insertions || inspectingCommit.insertions || 0) > 0 ||
                    (inspectingCommitDetails?.deletions || inspectingCommit.deletions || 0) > 0) && (
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold">
                        +{inspectingCommitDetails?.insertions ?? inspectingCommit.insertions ?? 0}
                      </span>
                      <span className="text-rose-400 font-bold">
                        -{inspectingCommitDetails?.deletions ?? inspectingCommit.deletions ?? 0}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {(inspectingCommitDetails?.filesChanged || inspectingCommit.filesChanged || []).map((fileChange) => (
                    <div
                      key={fileChange.file}
                      onClick={() => handleInspectFileDiff(fileChange.file, inspectingCommit.hash, activeDiffParentIndex)}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#111118] hover:bg-[#181824] border border-[#222232] hover:border-cyan-500/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileCode className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                        <span className="text-zinc-200 truncate text-[11px]" title={fileChange.file}>
                          {fileChange.file}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10.5px] font-mono shrink-0">
                        {fileChange.insertions > 0 && (
                          <span className="text-emerald-400">+{fileChange.insertions}</span>
                        )}
                        {fileChange.deletions > 0 && (
                          <span className="text-rose-400">-{fileChange.deletions}</span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold group-hover:bg-cyan-500 group-hover:text-black transition-all">
                          Diff
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#1f1f2e] bg-[#101018] flex items-center justify-end">
              <button
                onClick={() => setInspectingCommit(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMIT FILE DIFF MODAL (Milestone 28) */}
      {activeDiffFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono">
          <div className="bg-[#0a0a0f] border border-[#27273a] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-3 border-b border-[#1f1f2e] bg-[#101018] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-bold text-zinc-100 text-xs truncate">{activeDiffFile}</span>
                {inspectingCommit && (
                  <span className="text-zinc-500 text-[11px]">
                    @ {inspectingCommit.shortHash}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {inspectingCommit?.isMerge && inspectingCommit.parents?.length > 1 && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-zinc-500">Compare vs:</span>
                    {inspectingCommit.parents.map((p, idx) => (
                      <button
                        key={p}
                        onClick={() => handleInspectFileDiff(activeDiffFile, inspectingCommit.hash, idx)}
                        className={`px-1.5 py-0.5 rounded border text-[9.5px] cursor-pointer ${
                          activeDiffParentIndex === idx
                            ? "bg-cyan-950 text-cyan-300 border-cyan-500/50 font-bold"
                            : "bg-[#14141c] text-zinc-400 border-zinc-800"
                        }`}
                      >
                        Parent {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setActiveDiffFile(null);
                    setActiveDiffData(null);
                  }}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Diff Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#050508] text-xs font-mono">
              {isDiffLoading ? (
                <div className="flex items-center justify-center p-12 text-zinc-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Computing commit diff...</span>
                </div>
              ) : activeDiffData?.diff ? (
                <div className="space-y-0.5">
                  {activeDiffData.diff.split("\n").map((line: string, lIdx: number) => {
                    const isAdded = line.startsWith("+") && !line.startsWith("+++");
                    const isRemoved = line.startsWith("-") && !line.startsWith("---");
                    const isHunkHeader = line.startsWith("@@");

                    return (
                      <div
                        key={lIdx}
                        className={`px-2 py-0.5 rounded text-[11px] whitespace-pre-wrap leading-relaxed ${
                          isAdded
                            ? "bg-emerald-950/40 text-emerald-300 font-medium"
                            : isRemoved
                            ? "bg-rose-950/40 text-rose-300 font-medium"
                            : isHunkHeader
                            ? "bg-cyan-950/40 text-cyan-400 font-bold my-1"
                            : "text-zinc-400"
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-12 text-zinc-500 text-xs">
                  No differences found for this file at selected commit.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#1f1f2e] bg-[#101018] flex items-center justify-end">
              <button
                onClick={() => {
                  setActiveDiffFile(null);
                  setActiveDiffData(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BRANCH MODAL */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-[#272736] rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs uppercase">
                <GitBranch className="w-4 h-4" />
                <span>Create New Branch</span>
              </div>
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setNewBranchName("");
                  setBranchValidationError(null);
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-zinc-400">Branch Name:</label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => {
                  setNewBranchName(e.target.value);
                  setBranchValidationError(validateBranchInput(e.target.value));
                }}
                placeholder="e.g. feature/auth-flow or fix/typo"
                className="w-full bg-[#16161f] border border-[#272736] rounded p-2 text-zinc-200 text-xs outline-none focus:border-cyan-500/50"
                autoFocus
              />
              {branchValidationError && (
                <div className="text-[10.5px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{branchValidationError}</span>
                </div>
              )}

              <label className="flex items-center gap-2 text-[11px] text-zinc-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBranchCheckout}
                  onChange={(e) => setNewBranchCheckout(e.target.checked)}
                  className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500/40"
                />
                <span>Checkout new branch immediately</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setNewBranchName("");
                  setBranchValidationError(null);
                }}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const error = validateBranchInput(newBranchName);
                  if (error) {
                    setBranchValidationError(error);
                    return;
                  }
                  if (onValidateBranchName) {
                    const serverVal = await onValidateBranchName(newBranchName);
                    if (!serverVal.valid) {
                      setBranchValidationError(serverVal.error || "Invalid branch name.");
                      return;
                    }
                  }
                  await onCreateBranch(newBranchName.trim(), newBranchCheckout);
                  setShowBranchModal(false);
                  setNewBranchName("");
                  setBranchValidationError(null);
                }}
                disabled={!newBranchName.trim() || Boolean(branchValidationError)}
                className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRTY SWITCH MODAL */}
      {showDirtySwitchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-amber-500/30 rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
              <ShieldAlert className="w-4 h-4" />
              <span>Uncommitted Changes</span>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              You have local changes in <strong className="text-zinc-200">{totalChanges} file(s)</strong> that may be overwritten by switching to <strong className="text-cyan-400">{targetBranchToSwitch}</strong>.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleDirtySwitchStash}
                className="w-full py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer"
              >
                Stash Changes & Switch
              </button>
              <button
                onClick={handleDirtySwitchForce}
                className="w-full py-1.5 px-3 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs cursor-pointer"
              >
                Force Switch (Overwrite Local)
              </button>
              <button
                onClick={() => {
                  setShowDirtySwitchModal(false);
                  setTargetBranchToSwitch(null);
                }}
                className="w-full py-1.5 px-3 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE STASH MODAL */}
      {showStashSaveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-[#272736] rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs uppercase">
                <Archive className="w-4 h-4" />
                <span>Save Changes to Stash</span>
              </div>
              <button
                onClick={() => {
                  setShowStashSaveModal(false);
                  setCustomStashMessage("");
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400">Stash Description (Optional):</label>
              <input
                type="text"
                value={customStashMessage}
                onChange={(e) => setCustomStashMessage(e.target.value)}
                placeholder="e.g. WIP navbar styles"
                className="w-full bg-[#16161f] border border-[#272736] rounded p-2 text-zinc-200 text-xs outline-none focus:border-cyan-500/50"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowStashSaveModal(false);
                  setCustomStashMessage("");
                }}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onStashSave) {
                    await onStashSave(customStashMessage.trim() || undefined);
                  }
                  setShowStashSaveModal(false);
                  setCustomStashMessage("");
                }}
                className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer"
              >
                Save Stash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DROP STASH MODAL */}
      {stashToDrop && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e0e12] border border-rose-500/30 rounded-xl p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
              <AlertCircle className="w-4 h-4" />
              <span>Drop Stash?</span>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Are you sure you want to permanently drop <strong className="text-zinc-200">{stashToDrop.id}</strong> ({stashToDrop.message})? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setStashToDrop(null)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onStashDrop) {
                    await onStashDrop(stashToDrop.id);
                  }
                  setStashToDrop(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
              >
                Drop Stash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCARD MODAL */}
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
