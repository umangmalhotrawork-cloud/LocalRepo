"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GitMerge,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  Layers,
  ArrowRight,
  Split,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Code2,
  Check,
  RotateCcw,
  Edit3,
  X,
  Play,
  Lock,
  Eye,
  Columns,
  Maximize2,
  FileCheck2,
  Cpu,
  Sparkles,
  Save,
} from "lucide-react";

// Dynamically import Monaco Editor with SSR disabled
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-zinc-500 font-mono text-xs">
      Loading Monaco Editor...
    </div>
  ),
});

export interface HunkItem {
  hunkId: string;
  startLine: number;
  endLine: number;
  base: string;
  parent: string;
  incoming: string;
  status: "UNCHANGED" | "PARENT_ONLY" | "INCOMING_ONLY" | "AUTO_MERGED" | "CONFLICT";
  resolution?: "KEEP_PARENT" | "KEEP_INCOMING" | "KEEP_BOTH" | "EDIT_RESULT" | null;
  resolvedContent?: string | null;
}

export interface ConflictItem {
  conflictId: string;
  changeSetIdA?: string;
  changeSetIdB?: string;
  sourceChangeSets?: string[];
  filePath: string;
  baseContent: string;
  parentContent: string;
  incomingContent: string;
  conflictType: "FILE_CONFLICT" | "BASELINE_CONFLICT" | "DEPENDENCY_CONFLICT" | "POLICY_CONFLICT";
  status: "UNRESOLVED" | "AUTO_RESOLVED" | "MANUAL_REQUIRED" | "RESOLVED" | "REJECTED";
  resolution?: string | null;
  resolvedContent?: string | null;
  hunks: HunkItem[];
  astAnalysis?: any;
  impactAnalysis?: any;
  metadata?: any;
}

interface ChangeConflictResolverProps {
  conflicts: ConflictItem[];
  workspacePath?: string;
  onResolveHunk?: (
    conflictId: string,
    hunkId: string,
    resolution: "KEEP_PARENT" | "KEEP_INCOMING" | "KEEP_BOTH" | "EDIT_RESULT",
    customContent?: string
  ) => Promise<void> | void;
  onResolveFile?: (
    conflictId: string,
    resolution: "KEEP_PARENT" | "KEEP_INCOMING" | "KEEP_BOTH" | "EDIT_RESULT",
    customContent?: string
  ) => Promise<void> | void;
  onApplyResolved?: () => Promise<void> | void;
  onCancel?: () => void;
  isOpen: boolean;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "plaintext";
  }
}

export default function ChangeConflictResolver({
  conflicts = [],
  workspacePath,
  onResolveHunk,
  onResolveFile,
  onApplyResolved,
  onCancel,
  isOpen,
}: ChangeConflictResolverProps) {
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [selectedHunkIndex, setSelectedHunkIndex] = useState(0);
  const [showBasePane, setShowBasePane] = useState(false);
  const [viewLayout, setViewLayout] = useState<"SPLIT_ALL" | "3_PANE" | "RESULT_ONLY">("SPLIT_ALL");
  const [customEdits, setCustomEdits] = useState<Record<string, string>>({});
  const [editingHunkId, setEditingHunkId] = useState<string | null>(null);
  const [editorResultCode, setEditorResultCode] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentConflict: ConflictItem | undefined = conflicts[selectedConflictIndex] || conflicts[0];

  // Update editorResultCode whenever active conflict changes or resolves
  useEffect(() => {
    if (currentConflict) {
      const initialCode =
        currentConflict.resolvedContent ??
        currentConflict.hunks.map((h) => h.resolvedContent ?? h.parent ?? "").join("\n");
      setEditorResultCode(initialCode);
      setSelectedHunkIndex(0);
    }
  }, [currentConflict?.conflictId, currentConflict?.resolvedContent]);

  if (!isOpen || conflicts.length === 0 || !currentConflict) return null;

  const totalConflictsCount = conflicts.length;
  const unresolvedConflictsCount = conflicts.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "AUTO_RESOLVED"
  ).length;

  const allConflictsResolved = unresolvedConflictsCount === 0;

  const currentConflictHunks = currentConflict.hunks || [];
  const conflictingHunks = currentConflictHunks.filter((h) => h.status === "CONFLICT");
  const unresolvedHunksInFile = currentConflictHunks.filter(
    (h) => h.status === "CONFLICT" && (h.resolvedContent === null || h.resolvedContent === undefined)
  );

  const language = getLanguageFromPath(currentConflict.filePath);

  // Navigation Handlers
  const handlePrevFile = () => {
    if (selectedConflictIndex > 0) {
      setSelectedConflictIndex(selectedConflictIndex - 1);
    }
  };

  const handleNextFile = () => {
    if (selectedConflictIndex < conflicts.length - 1) {
      setSelectedConflictIndex(selectedConflictIndex + 1);
    }
  };

  const handlePrevConflictHunk = () => {
    if (currentConflictHunks.length === 0) return;
    const nextIdx = (selectedHunkIndex - 1 + currentConflictHunks.length) % currentConflictHunks.length;
    setSelectedHunkIndex(nextIdx);
  };

  const handleNextConflictHunk = () => {
    if (currentConflictHunks.length === 0) return;
    const nextIdx = (selectedHunkIndex + 1) % currentConflictHunks.length;
    setSelectedHunkIndex(nextIdx);
  };

  // Resolution Handlers
  const handleHunkAction = async (
    hunkId: string,
    action: "KEEP_PARENT" | "KEEP_INCOMING" | "KEEP_BOTH" | "EDIT_RESULT",
    customContent?: string
  ) => {
    if (!onResolveHunk || !currentConflict) return;
    try {
      setErrorMessage(null);
      await onResolveHunk(currentConflict.conflictId, hunkId, action, customContent);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resolve hunk");
    }
  };

  const handleAcceptAllCurrent = async () => {
    if (!currentConflict) return;
    for (const hunk of currentConflict.hunks) {
      await handleHunkAction(hunk.hunkId, "KEEP_PARENT");
    }
  };

  const handleAcceptAllIncoming = async () => {
    if (!currentConflict) return;
    for (const hunk of currentConflict.hunks) {
      await handleHunkAction(hunk.hunkId, "KEEP_INCOMING");
    }
  };

  const handleSaveResultEditor = async () => {
    if (!currentConflict) return;
    try {
      setErrorMessage(null);
      if (onResolveFile) {
        await onResolveFile(currentConflict.conflictId, "EDIT_RESULT", editorResultCode);
      } else if (onResolveHunk && currentConflict.hunks.length > 0) {
        await onResolveHunk(currentConflict.conflictId, currentConflict.hunks[0].hunkId, "EDIT_RESULT", editorResultCode);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save direct edit");
    }
  };

  const handleApplyClick = async () => {
    if (!onApplyResolved || !allConflictsResolved || isApplying) return;
    try {
      setIsApplying(true);
      setErrorMessage(null);
      await onApplyResolved();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to apply resolved ChangeSet");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none font-mono text-xs animate-fadeIn">
      <div className="w-full max-w-7xl h-[92vh] bg-[#08080d] border border-[#222234] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 1. Main Header */}
        <div className="p-3.5 bg-[#0d0d16] border-b border-[#1c1c2c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 shrink-0">
              <GitMerge className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">
                  Interactive 3-Way ChangeSet Merge Editor
                </span>
                <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40 font-bold">
                  Parent Mutation Authority
                </span>
                {unresolvedConflictsCount > 0 ? (
                  <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>{unresolvedConflictsCount} Unresolved</span>
                  </span>
                ) : (
                  <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>All Resolved</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                Interactive 3-way resolution across BASE, CURRENT, and INCOMING branches prior to full parent safety evaluation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Layout Controls */}
            <div className="flex items-center bg-[#141420] border border-[#242436] rounded-lg p-0.5">
              <button
                onClick={() => setViewLayout("SPLIT_ALL")}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  viewLayout === "SPLIT_ALL" ? "bg-purple-900/60 text-purple-200 border border-purple-500/40" : "text-zinc-400 hover:text-white"
                }`}
                title="Split 3-Way & Merged Result"
              >
                Full Split
              </button>
              <button
                onClick={() => setViewLayout("3_PANE")}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  viewLayout === "3_PANE" ? "bg-purple-900/60 text-purple-200 border border-purple-500/40" : "text-zinc-400 hover:text-white"
                }`}
                title="3-Way Diff View Only"
              >
                3-Way Only
              </button>
              <button
                onClick={() => setViewLayout("RESULT_ONLY")}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  viewLayout === "RESULT_ONLY" ? "bg-purple-900/60 text-purple-200 border border-purple-500/40" : "text-zinc-400 hover:text-white"
                }`}
                title="Monaco Merged Result Editor Only"
              >
                Result Editor
              </button>
            </div>

            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              title="Close Conflict Resolver"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Navigation & File Tabs Bar */}
        <div className="px-3 py-2 bg-[#090910] border-b border-[#181826] flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {/* File Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1 shrink-0">Files:</span>
            {conflicts.map((c, idx) => {
              const isSelected = idx === selectedConflictIndex;
              const isResolved = c.status === "RESOLVED" || c.status === "AUTO_RESOLVED";
              return (
                <button
                  key={c.conflictId || idx}
                  onClick={() => setSelectedConflictIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[10.5px] cursor-pointer transition-all shrink-0 ${
                    isSelected
                      ? "bg-amber-950/70 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121c] border border-transparent"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="truncate max-w-[150px]">{c.filePath}</span>
                  {isResolved ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Previous / Next File */}
            <div className="flex items-center gap-1 bg-[#12121c] border border-[#202030] rounded-lg p-0.5">
              <button
                onClick={handlePrevFile}
                disabled={selectedConflictIndex === 0}
                className="px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5"
                title="Previous File"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev File</span>
              </button>
              <span className="text-[9.5px] text-zinc-500 px-1">
                {selectedConflictIndex + 1}/{conflicts.length}
              </span>
              <button
                onClick={handleNextFile}
                disabled={selectedConflictIndex === conflicts.length - 1}
                className="px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5"
                title="Next File"
              >
                <span>Next File</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Previous / Next Conflict Hunk */}
            {currentConflictHunks.length > 0 && (
              <div className="flex items-center gap-1 bg-[#12121c] border border-[#202030] rounded-lg p-0.5">
                <button
                  onClick={handlePrevConflictHunk}
                  className="px-2 py-0.5 rounded text-[10px] text-amber-400 hover:text-amber-200 flex items-center gap-0.5 cursor-pointer"
                  title="Previous Conflict Hunk"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Prev Conflict</span>
                </button>
                <span className="text-[9.5px] text-amber-300 font-bold px-1">
                  Hunk {selectedHunkIndex + 1}/{currentConflictHunks.length}
                </span>
                <button
                  onClick={handleNextConflictHunk}
                  className="px-2 py-0.5 rounded text-[10px] text-amber-400 hover:text-amber-200 flex items-center gap-0.5 cursor-pointer"
                  title="Next Conflict Hunk"
                >
                  <span>Next Conflict</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Metadata & AST / Impact Safety Warning Banner */}
        <div className="p-2.5 bg-[#0b0b14] border-b border-[#181828] flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-500 font-bold uppercase text-[9.5px]">File:</span>
            <code className="text-cyan-300 font-bold text-[11px] truncate">{currentConflict.filePath}</code>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {currentConflict.conflictType}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                currentConflict.status === "RESOLVED" || currentConflict.status === "AUTO_RESOLVED"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-950 text-amber-300 border border-amber-500/30"
              }`}
            >
              {currentConflict.status}
            </span>
            {currentConflict.astAnalysis?.riskLevel && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  currentConflict.astAnalysis.riskLevel === "HIGH" || currentConflict.astAnalysis.riskLevel === "CRITICAL"
                    ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                    : currentConflict.astAnalysis.riskLevel === "MEDIUM"
                    ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {currentConflict.astAnalysis.riskLevel} RISK
              </span>
            )}
          </div>

          {/* Quick Bulk Actions for File */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAcceptAllCurrent}
              className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold cursor-pointer transition-colors"
              title="Accept All Current (Parent) changes in this file"
            >
              Accept All Current
            </button>
            <button
              onClick={handleAcceptAllIncoming}
              className="px-2 py-0.5 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-purple-300 text-[10px] font-bold cursor-pointer transition-colors"
              title="Accept All Incoming (Branch) changes in this file"
            >
              Accept All Incoming
            </button>
            <button
              onClick={() => setShowBasePane(!showBasePane)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                showBasePane
                  ? "bg-zinc-700 text-white border border-zinc-500"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {showBasePane ? "Hide BASE" : "Show BASE"}
            </button>
          </div>
        </div>

        {/* Structural AST & Impact Warning Alert (if present) */}
        {((currentConflict.astAnalysis && currentConflict.astAnalysis.overlappingFunctions?.length > 0) ||
          (currentConflict.impactAnalysis && currentConflict.impactAnalysis.warnings?.length > 0)) && (
          <div className="px-3 py-2 bg-[#120c1a] border-b border-purple-500/30 text-purple-200 text-[10.5px] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="font-bold text-purple-300">AST Structural Warning:</span>
              <span className="truncate text-zinc-300">
                {currentConflict.astAnalysis?.overlappingFunctions?.length > 0
                  ? `Overlapping function changes in ${currentConflict.astAnalysis.overlappingFunctions.join(", ")}`
                  : currentConflict.impactAnalysis?.warnings?.[0]}
              </span>
            </div>
            {currentConflict.impactAnalysis?.callersCount !== undefined && (
              <span className="text-[9.5px] text-zinc-400 shrink-0">
                Impact Blast Radius: <strong>{currentConflict.impactAnalysis.callersCount} callers</strong>
              </span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="px-3 py-2 bg-rose-950/70 border-b border-rose-500/40 text-rose-200 text-[11px] flex items-center gap-2 shrink-0 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* 4. Multi-Pane 3-Way & Merged Result Workspace */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden divide-y divide-[#1c1c28]">
          {/* Top Half: 3-Way Diff Comparison */}
          {(viewLayout === "SPLIT_ALL" || viewLayout === "3_PANE") && (
            <div
              className={`min-h-0 flex ${
                viewLayout === "SPLIT_ALL" ? "h-[50%]" : "flex-1"
              } divide-x divide-[#1c1c28] bg-[#050508] overflow-hidden`}
            >
              {/* Optional BASE Baseline Pane */}
              {showBasePane && (
                <div className="w-1/3 flex flex-col h-full overflow-hidden bg-[#07070c]">
                  <div className="p-2 bg-[#0c0c14] border-b border-[#181824] flex items-center justify-between text-[10px] text-zinc-400 font-bold shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-500" />
                      <span>BASE (Common Ancestor)</span>
                    </div>
                  </div>
                  <pre className="flex-1 p-2.5 text-[10px] text-zinc-400 overflow-auto font-mono leading-relaxed select-text">
                    {currentConflict.baseContent || "<empty>"}
                  </pre>
                </div>
              )}

              {/* CURRENT / PARENT Pane (Left) */}
              <div className={`${showBasePane ? "w-1/3" : "w-1/2"} flex flex-col h-full overflow-hidden bg-[#06080e]`}>
                <div className="p-2 bg-[#0c121e] border-b border-[#182436] flex items-center justify-between text-[10px] text-cyan-300 font-bold shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span>CURRENT / PARENT (Workspace Content)</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    Parent
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 select-text">
                  {currentConflictHunks.map((hunk, hIdx) => {
                    const isSelectedHunk = hIdx === selectedHunkIndex;
                    const isConflict = hunk.status === "CONFLICT";
                    return (
                      <div
                        key={`parent-hunk-${hIdx}`}
                        onClick={() => setSelectedHunkIndex(hIdx)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isSelectedHunk
                            ? "border-cyan-500 bg-[#0d1626] shadow-sm"
                            : isConflict
                            ? "border-cyan-500/30 bg-[#080d16]"
                            : "border-[#182030] bg-[#070b12]"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-cyan-500/20 text-[9.5px]">
                          <span className="font-bold text-cyan-400">Hunk #{hIdx + 1}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHunkAction(hunk.hunkId, "KEEP_PARENT");
                            }}
                            className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            Adopt Parent
                          </button>
                        </div>
                        <pre className="text-[10px] text-cyan-100 font-mono overflow-x-auto max-h-[120px] leading-relaxed">
                          {hunk.parent || "<empty>"}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INCOMING Pane (Right) */}
              <div className={`${showBasePane ? "w-1/3" : "w-1/2"} flex flex-col h-full overflow-hidden bg-[#0a0712]`}>
                <div className="p-2 bg-[#140c22] border-b border-[#26183c] flex items-center justify-between text-[10px] text-purple-300 font-bold shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>INCOMING (Child Subagent / Branch)</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                    Incoming
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 select-text">
                  {currentConflictHunks.map((hunk, hIdx) => {
                    const isSelectedHunk = hIdx === selectedHunkIndex;
                    const isConflict = hunk.status === "CONFLICT";
                    return (
                      <div
                        key={`incoming-hunk-${hIdx}`}
                        onClick={() => setSelectedHunkIndex(hIdx)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isSelectedHunk
                            ? "border-purple-500 bg-[#1a0e2a] shadow-sm"
                            : isConflict
                            ? "border-purple-500/30 bg-[#12081e]"
                            : "border-[#201430] bg-[#0c0616]"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-purple-500/20 text-[9.5px]">
                          <span className="font-bold text-purple-400">Hunk #{hIdx + 1}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHunkAction(hunk.hunkId, "KEEP_INCOMING");
                            }}
                            className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            Adopt Incoming
                          </button>
                        </div>
                        <pre className="text-[10px] text-purple-100 font-mono overflow-x-auto max-h-[120px] leading-relaxed">
                          {hunk.incoming || "<empty>"}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Half: Interactive Merged Result Editor */}
          {(viewLayout === "SPLIT_ALL" || viewLayout === "RESULT_ONLY") && (
            <div
              className={`min-h-0 flex flex-col ${
                viewLayout === "SPLIT_ALL" ? "h-[50%]" : "flex-1"
              } bg-[#06060a] overflow-hidden`}
            >
              {/* Result Editor Header */}
              <div className="p-2 bg-[#0d0d16] border-b border-[#181828] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>MERGED RESULT PREVIEW & DIRECT MONACO EDITOR</span>
                  <span className="text-[9px] text-zinc-500 font-normal">
                    (Edit directly below or choose hunk actions above)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveResultEditor}
                    className="px-3 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Result Content</span>
                  </button>
                </div>
              </div>

              {/* Monaco Code Editor */}
              <div className="flex-1 min-h-0 relative">
                <MonacoEditor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={editorResultCode}
                  onChange={(val) => setEditorResultCode(val || "")}
                  options={{
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    lineNumbers: "on",
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 5. Authoritative Apply & Footer */}
        <div className="p-3.5 bg-[#0d0d16] border-t border-[#1c1c2c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10.5px]">
            {allConflictsResolved ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>All {conflicts.length} conflicting files resolved. Ready to run full parent safety firewall & apply.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {unresolvedConflictsCount} unresolved conflict{unresolvedConflictsCount > 1 ? "s" : ""} remaining. Resolve all hunks to unlock parent ChangeSet application.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-zinc-300 border border-[#242436] cursor-pointer transition-colors text-[11px]"
            >
              Cancel
            </button>

            <button
              onClick={handleApplyClick}
              disabled={!allConflictsResolved || isApplying}
              className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md ${
                allConflictsResolved
                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-50"
              }`}
            >
              {isApplying ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Safety & Applying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Apply Resolved ChangeSet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
