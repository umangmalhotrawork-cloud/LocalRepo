"use client";

import React, { useState, useEffect } from "react";
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
  Code2,
  Check,
  RotateCcw,
  Edit3,
  X,
  Play,
  Lock,
} from "lucide-react";

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
  metadata?: any;
}

interface ChangeConflictResolverProps {
  conflicts: ConflictItem[];
  workspacePath?: string;
  onResolveHunk?: (conflictId: string, hunkId: string, resolution: "KEEP_PARENT" | "KEEP_INCOMING" | "KEEP_BOTH" | "EDIT_RESULT", customContent?: string) => Promise<void> | void;
  onApplyResolved?: () => Promise<void> | void;
  onCancel?: () => void;
  isOpen: boolean;
}

export default function ChangeConflictResolver({
  conflicts = [],
  workspacePath,
  onResolveHunk,
  onApplyResolved,
  onCancel,
  isOpen,
}: ChangeConflictResolverProps) {
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [customEdits, setCustomEdits] = useState<Record<string, string>>({});
  const [editingHunkId, setEditingHunkId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[selectedConflictIndex] || conflicts[0];

  const allConflictsResolved = conflicts.every(
    (c) => c.status === "RESOLVED" || c.status === "AUTO_RESOLVED"
  );

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono text-xs">
      <div className="w-full max-w-5xl h-[88vh] bg-[#09090f] border border-[#202030] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        {/* 1. Header */}
        <div className="p-3.5 bg-[#0e0e18] border-b border-[#1c1c2c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">
                  Interactive 3-Way ChangeSet Resolver
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-bold">
                  Parent Mutation Authority
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Resolve conflicting child ChangeSets before authoritative parent safety evaluation & apply.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              title="Close Conflict Resolver"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. File Tabs Bar */}
        {conflicts.length > 1 && (
          <div className="px-3 py-1.5 bg-[#07070b] border-b border-[#161622] flex items-center gap-1.5 overflow-x-auto shrink-0">
            <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1">Conflicts ({conflicts.length}):</span>
            {conflicts.map((c, idx) => {
              const isSelected = idx === selectedConflictIndex;
              const isResolved = c.status === "RESOLVED" || c.status === "AUTO_RESOLVED";
              return (
                <button
                  key={c.conflictId}
                  onClick={() => setSelectedConflictIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[10.5px] cursor-pointer transition-all ${
                    isSelected
                      ? "bg-amber-950/70 text-amber-300 font-bold border border-amber-500/40"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121c] border border-transparent"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="truncate max-w-[160px]">{c.filePath}</span>
                  {isResolved ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Active Conflict Meta Banner */}
        <div className="p-3 bg-[#0d0d16] border-b border-[#1a1a28] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-400 font-bold">File:</span>
            <code className="text-cyan-300 font-bold text-[11.5px] truncate">{currentConflict.filePath}</code>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
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
          </div>

          <div className="text-[10px] text-zinc-500 truncate">
            ChangeSets: <span className="text-zinc-400">{currentConflict.sourceChangeSets?.join(", ") || "Sibling tasks"}</span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="px-3 py-2 bg-rose-950/60 border-b border-rose-500/40 text-rose-200 text-[11px] flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* 4. 3-Way Diff & Hunks Workspace */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#050508]">
          {/* BASE Content Accordion */}
          {currentConflict.baseContent && (
            <div className="rounded-xl border border-[#181826] bg-[#08080f] overflow-hidden">
              <div className="px-3 py-1.5 bg-[#0c0c14] border-b border-[#161622] flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span>BASE (Common Baseline known when work began)</span>
                </div>
              </div>
              <pre className="p-3 text-[10px] text-zinc-400 overflow-x-auto max-h-[100px] leading-relaxed">
                {currentConflict.baseContent}
              </pre>
            </div>
          )}

          {/* AST Structural Analysis Banner */}
          {currentConflict.astAnalysis && currentConflict.astAnalysis.success && (
            <div className="rounded-xl border border-indigo-500/30 bg-[#090918] p-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AST Structural Difference</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    currentConflict.astAnalysis.riskLevel === 'HIGH'
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      : currentConflict.astAnalysis.riskLevel === 'MEDIUM'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {currentConflict.astAnalysis.conflictHint || 'STRUCTURAL'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400">
                  Recommendation: <strong className="text-zinc-200">{currentConflict.astAnalysis.recommendation}</strong>
                </span>
              </div>

              {currentConflict.astAnalysis.overlappingFunctions && currentConflict.astAnalysis.overlappingFunctions.length > 0 && (
                <div className="text-[10px] text-amber-300/90 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Overlapping functions modified by both sides: <strong>{currentConflict.astAnalysis.overlappingFunctions.join(', ')}</strong></span>
                </div>
              )}

              {currentConflict.astAnalysis.sameSignaturesDiverging && currentConflict.astAnalysis.sameSignaturesDiverging.length > 0 && (
                <div className="text-[10px] text-rose-300/90 space-y-1 bg-[#100d20] p-2 rounded border border-rose-500/20">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Diverging Signatures Detected:</span>
                  </div>
                  {currentConflict.astAnalysis.sameSignaturesDiverging.map((sig: any, sIdx: number) => (
                    <div key={sIdx} className="font-mono text-[9.5px] pl-4 space-y-0.5">
                      <div className="text-cyan-300">PARENT: {sig.parentSignature}</div>
                      <div className="text-purple-300">INCOMING: {sig.incomingSignature}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hunks List */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Diff Hunks ({currentConflict.hunks.length})</span>
              <span className="text-zinc-600">Select resolution action for each conflicting hunk</span>
            </div>

            {currentConflict.hunks.map((hunk, hIdx) => {
              const isConflict = hunk.status === "CONFLICT";
              const isResolved = Boolean(hunk.resolvedContent !== null && hunk.resolvedContent !== undefined);
              const isEditing = editingHunkId === hunk.hunkId;

              return (
                <div
                  key={hunk.hunkId || hIdx}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isConflict && !isResolved
                      ? "border-amber-500/40 bg-[#0b0a12] shadow-lg shadow-amber-950/20"
                      : "border-[#1c1c2c] bg-[#090910]"
                  }`}
                >
                  {/* Hunk Header */}
                  <div className="px-3 py-1.5 bg-[#0f0f18] border-b border-[#1a1a28] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300">Hunk #{hIdx + 1}</span>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold ${
                          hunk.status === "CONFLICT"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                            : hunk.status === "AUTO_MERGED"
                            ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {hunk.status}
                      </span>
                    </div>

                    {/* Hunk Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleHunkAction(hunk.hunkId, "KEEP_PARENT")}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${
                          hunk.resolution === "KEEP_PARENT"
                            ? "bg-cyan-950 text-cyan-300 border border-cyan-500/50"
                            : "bg-[#141420] text-zinc-400 hover:text-white border border-[#202030]"
                        }`}
                      >
                        Keep Parent
                      </button>

                      <button
                        onClick={() => handleHunkAction(hunk.hunkId, "KEEP_INCOMING")}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${
                          hunk.resolution === "KEEP_INCOMING"
                            ? "bg-purple-950 text-purple-300 border border-purple-500/50"
                            : "bg-[#141420] text-zinc-400 hover:text-white border border-[#202030]"
                        }`}
                      >
                        Keep Incoming
                      </button>

                      <button
                        onClick={() => handleHunkAction(hunk.hunkId, "KEEP_BOTH")}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${
                          hunk.resolution === "KEEP_BOTH"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                            : "bg-[#141420] text-zinc-400 hover:text-white border border-[#202030]"
                        }`}
                      >
                        Keep Both
                      </button>

                      <button
                        onClick={() => setEditingHunkId(isEditing ? null : hunk.hunkId)}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          isEditing || hunk.resolution === "EDIT_RESULT"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/50"
                            : "bg-[#141420] text-zinc-400 hover:text-white border border-[#202030]"
                        }`}
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit Result</span>
                      </button>
                    </div>
                  </div>

                  {/* Split Column Comparison: PARENT vs INCOMING */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#181828]">
                    {/* Left: Parent Content */}
                    <div className="p-2.5 space-y-1 bg-[#07070d]">
                      <div className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                        <span>Current Parent Content</span>
                      </div>
                      <pre className="text-[10px] text-cyan-100 bg-[#0b0c16] p-2 rounded-lg border border-cyan-500/20 overflow-x-auto max-h-[140px] leading-relaxed">
                        {hunk.parent || "<empty>"}
                      </pre>
                    </div>

                    {/* Right: Incoming Child Content */}
                    <div className="p-2.5 space-y-1 bg-[#09070e]">
                      <div className="text-[9.5px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <span>Incoming Child Change</span>
                      </div>
                      <pre className="text-[10px] text-purple-100 bg-[#120b1c] p-2 rounded-lg border border-purple-500/20 overflow-x-auto max-h-[140px] leading-relaxed">
                        {hunk.incoming || "<empty>"}
                      </pre>
                    </div>
                  </div>

                  {/* Custom Edit Box (if activated) */}
                  {isEditing && (
                    <div className="p-2.5 bg-[#0e0c14] border-t border-[#1e1a2c] space-y-2">
                      <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
                        <span>Custom Merged Content:</span>
                      </div>
                      <textarea
                        value={customEdits[hunk.hunkId] ?? (hunk.resolvedContent || hunk.parent)}
                        onChange={(e) =>
                          setCustomEdits((prev) => ({ ...prev, [hunk.hunkId]: e.target.value }))
                        }
                        className="w-full h-24 p-2 rounded-lg bg-[#06060a] border border-amber-500/30 text-amber-100 text-[10.5px] font-mono focus:outline-none focus:border-amber-400"
                        placeholder="Write custom merged content..."
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingHunkId(null)}
                          className="px-2 py-1 rounded bg-[#161622] text-zinc-400 hover:text-white text-[10px]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            const val = customEdits[hunk.hunkId] ?? (hunk.resolvedContent || hunk.parent);
                            await handleHunkAction(hunk.hunkId, "EDIT_RESULT", val);
                            setEditingHunkId(null);
                          }}
                          className="px-3 py-1 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold cursor-pointer"
                        >
                          Save Hunk
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Resolution Preview Bar */}
                  {isResolved && !isEditing && (
                    <div className="px-3 py-1.5 bg-[#0a100d] border-t border-emerald-500/20 flex items-center justify-between text-[9.5px]">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Resolved as: {hunk.resolution || "AUTO_MERGED"}</span>
                      </div>
                      <div className="text-zinc-500 truncate max-w-[280px]">
                        Preview: {hunk.resolvedContent?.slice(0, 40) || "<empty>"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Footer & Authoritative Apply */}
        <div className="p-3.5 bg-[#0e0e18] border-t border-[#1c1c2c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              {allConflictsResolved
                ? "All conflicts resolved. Ready to run parent safety firewall & apply."
                : "Resolve all conflicting hunks to unlock parent ChangeSet application."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-zinc-300 border border-[#242436] cursor-pointer transition-colors text-[11px]"
            >
              Cancel
            </button>

            <button
              onClick={handleApplyClick}
              disabled={!allConflictsResolved || isApplying}
              className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md ${
                allConflictsResolved
                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed opacity-50"
              }`}
            >
              {isApplying ? (
                <span>Evaluating Safety & Applying...</span>
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
