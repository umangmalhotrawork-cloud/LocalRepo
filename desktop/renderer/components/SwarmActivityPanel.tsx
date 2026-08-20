"use client";

import React, { useState } from "react";
import {
  Users,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  GitCommit,
  Terminal,
  Loader2,
  Clock,
  Ban,
  ArrowRight,
  FileText,
  Layers,
  Sparkles,
  Search,
  Code2,
  Check,
  FolderTree,
  Eye,
  CornerDownRight,
  GitMerge,
} from "lucide-react";
import {
  SwarmState,
  SwarmTask,
  SwarmConflictReport,
  SwarmStatus,
  SwarmTaskStatus,
  sanitizeSwarmText,
} from "../hooks/useSwarmActivity";

export interface SwarmActivityPanelProps {
  swarm: SwarmState | null;
  tasks: SwarmTask[];
  selectedTaskId: string | null;
  conflicts: SwarmConflictReport | null;
  changeSets?: any[];
  onSelectTask: (taskId: string | null) => void;
  onCancelSwarm?: (reason?: string) => Promise<void> | void;
  onPreviewDiff?: (edit: { filePath: string; original: string; replacement: string }) => void;
  onResolveConflicts?: () => void;
  className?: string;
  isCompact?: boolean;
}

export default function SwarmActivityPanel({
  swarm,
  tasks = [],
  selectedTaskId,
  conflicts,
  changeSets = [],
  onSelectTask,
  onCancelSwarm,
  onPreviewDiff,
  onResolveConflicts,
  className = "",
  isCompact = false,
}: SwarmActivityPanelProps) {
  const [cancelling, setCancelling] = useState(false);
  const [showConflictsExpanded, setShowConflictsExpanded] = useState(true);
  const [showChangeSetsExpanded, setShowChangeSetsExpanded] = useState(true);

  if (!swarm && tasks.length === 0) {
    return null;
  }

  const activeTask = selectedTaskId
    ? tasks.find((t) => t.taskId === selectedTaskId) || tasks[0]
    : tasks[0];

  const isSwarmActive =
    swarm?.status === "RUNNING" ||
    swarm?.status === "CREATED" ||
    swarm?.status === "AGGREGATING" ||
    tasks.some((t) => t.status === "RUNNING" || t.status === "QUEUED");

  const completedCount =
    swarm?.completedCount ?? tasks.filter((t) => t.status === "COMPLETED").length;
  const totalCount = swarm?.taskCount ?? tasks.length;
  const failedCount =
    swarm?.failedCount ?? tasks.filter((t) => t.status === "FAILED").length;
  const runningCount = tasks.filter((t) => t.status === "RUNNING").length;

  const handleCancelClick = async () => {
    if (!onCancelSwarm || cancelling) return;
    setCancelling(true);
    try {
      await onCancelSwarm("Swarm cancelled by parent operator");
    } finally {
      setCancelling(false);
    }
  };

  const renderStatusBadge = (status?: SwarmStatus | SwarmTaskStatus) => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            <span>RUNNING</span>
          </span>
        );
      case "AGGREGATING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 animate-pulse">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>AGGREGATING</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>COMPLETED</span>
          </span>
        );
      case "PARTIAL_SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
            <CheckCircle2 className="w-3 h-3 text-amber-400" />
            <span>PARTIAL SUCCESS</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>FAILED</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-700">
            <Ban className="w-3 h-3 text-zinc-400" />
            <span>CANCELLED</span>
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-700">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>QUEUED</span>
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
            <CornerDownRight className="w-3 h-3 text-zinc-500" />
            <span>SKIPPED</span>
          </span>
        );
      case "CREATED":
      case "PLANNING":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-500/40">
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>{status || "CREATED"}</span>
          </span>
        );
    }
  };

  const renderRoleBadge = (role: string) => {
    const r = (role || "specialist").toLowerCase();
    switch (r) {
      case "researcher":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-500/30">
            RESEARCHER
          </span>
        );
      case "coder":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-500/30">
            CODER
          </span>
        );
      case "tester":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
            TESTER
          </span>
        );
      case "reviewer":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
            REVIEWER
          </span>
        );
      case "architect":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
            ARCHITECT
          </span>
        );
      case "debugger":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
            DEBUGGER
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-700">
            {r.toUpperCase()}
          </span>
        );
    }
  };

  const renderTaskIcon = (status: SwarmTaskStatus) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "RUNNING":
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />;
      case "FAILED":
        return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "CANCELLED":
        return <Ban className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
      case "SKIPPED":
        return <CornerDownRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
      case "QUEUED":
      case "PENDING":
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
    }
  };

  const renderRiskBadge = (level?: string) => {
    const l = (level || "LOW").toUpperCase();
    if (l === "CRITICAL") {
      return <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[9px] font-bold">CRITICAL RISK</span>;
    }
    if (l === "HIGH") {
      return <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[9px] font-bold">HIGH RISK</span>;
    }
    if (l === "MEDIUM") {
      return <span className="px-1.5 py-0.2 rounded bg-yellow-950 text-yellow-300 border border-yellow-500/40 text-[9px] font-bold">MEDIUM RISK</span>;
    }
    return <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">LOW RISK</span>;
  };

  return (
    <div
      className={`bg-[#09090e] border border-[#1e1e28] rounded-xl overflow-hidden font-mono text-xs select-none shadow-xl flex flex-col ${className}`}
    >
      {/* 1. Header & Swarm Status Banner */}
      <div className="p-3 bg-[#0d0d14] border-b border-[#1c1c28] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[9.5px] tracking-wider">
                Swarm Activity
              </span>
              {renderStatusBadge(swarm?.status)}
            </div>
            <div
              className="text-zinc-100 font-bold truncate max-w-[320px] text-[11.5px]"
              title={swarm?.goal}
            >
              {swarm?.goal || "Autonomous Swarm Execution"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress metric */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#13131d] border border-[#232332] text-[10.5px]">
            <span className="text-emerald-400 font-bold">{completedCount}</span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-300 font-bold">{totalCount}</span>
            <span className="text-zinc-500 text-[9.5px]">done</span>
            {runningCount > 0 && (
              <span className="text-cyan-400 text-[9.5px] ml-1 font-semibold">
                ({runningCount} active)
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-rose-400 text-[9.5px] ml-1 font-semibold">
                ({failedCount} failed)
              </span>
            )}
          </div>

          {/* Cancel button */}
          {isSwarmActive && onCancelSwarm && (
            <button
              onClick={handleCancelClick}
              disabled={cancelling}
              className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-950 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Cancel Swarm Execution"
            >
              <Ban className="w-3 h-3 text-rose-400" />
              <span>{cancelling ? "Cancelling..." : "Cancel Swarm"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Conflict Banner (Phase 7) */}
      {conflicts && conflicts.hasConflicts && (
        <div className="p-3 bg-[#180e08] border-b border-amber-500/40 space-y-2 text-amber-200 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-[11px] text-amber-300">
                CONFLICT DETECTED: {conflicts.category || "FILE_CONFLICT"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {onResolveConflicts && (
                <button
                  onClick={onResolveConflicts}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-md"
                >
                  <GitMerge className="w-3 h-3" />
                  <span>Resolve Conflicts (3-Way)</span>
                </button>
              )}
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/30 text-amber-300 text-[9px] font-bold">
                Requires Parent Resolution
              </span>
            </div>
          </div>

          <p className="text-[10px] text-amber-100/80 leading-relaxed">
            {conflicts.summary ||
              "Multiple child subagents produced conflicting changes on identical files. Automatic merge is withheld to protect parent workspace integrity."}
          </p>

          {conflicts.conflictingFiles && conflicts.conflictingFiles.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">
                Conflicting Files ({conflicts.conflictingFiles.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {conflicts.conflictingFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-[#24160b] border border-amber-500/30 text-amber-200 text-[9.5px]"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          {conflicts.conflicts && conflicts.conflicts.length > 0 && (
            <div className="space-y-1 pt-1">
              {conflicts.conflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded bg-[#221307] border border-amber-500/20 text-[9.5px] flex items-center justify-between"
                >
                  <span className="text-amber-300 font-bold truncate max-w-[240px]">
                    {c.file || "File conflict"}
                  </span>
                  <span className="text-amber-400/80 text-[9px]">
                    {c.reason || "Concurrent modification"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Main Task Grid & Details View */}
      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#1c1c28] overflow-hidden min-h-[220px]">
        {/* Left Column: Structured Task DAG / List */}
        <div className="w-full md:w-[45%] flex flex-col overflow-y-auto max-h-[360px] p-2 space-y-1.5">
          <div className="px-1 pb-1 flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
            <span>Subagent Tasks ({tasks.length})</span>
            {swarm?.maxConcurrency && (
              <span className="text-zinc-500 font-normal">
                Max Concurrency: {swarm.maxConcurrency}
              </span>
            )}
          </div>

          {tasks.map((task) => {
            const isSelected = activeTask?.taskId === task.taskId;
            return (
              <div
                key={task.taskId}
                onClick={() => onSelectTask(task.taskId)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                  isSelected
                    ? "bg-[#141828] border-cyan-500/50 shadow-sm"
                    : "bg-[#0d0d14] hover:bg-[#11111a] border-[#1a1a26] text-zinc-300"
                }`}
              >
                <div className="pt-0.5">{renderTaskIcon(task.status)}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      {renderRoleBadge(task.role)}
                      <span className="text-[10.5px] font-bold text-zinc-200 truncate">
                        {task.taskId}
                      </span>
                    </div>
                    {task.elapsedMs !== undefined && task.elapsedMs > 0 && (
                      <span className="text-[9px] text-zinc-500 shrink-0">
                        {Math.round(task.elapsedMs / 1000)}s
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                    {task.objective}
                  </p>

                  {task.dependencies && task.dependencies.length > 0 && (
                    <div className="flex items-center gap-1 text-[8.5px] text-zinc-500">
                      <span>Prereq:</span>
                      <span className="text-zinc-400 truncate max-w-[120px]">
                        {task.dependencies.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Task Inspector (Phase 5) */}
        <div className="flex-1 flex flex-col p-3 overflow-y-auto max-h-[360px] bg-[#07070b] space-y-3">
          {activeTask ? (
            <>
              {/* Task Header Details */}
              <div className="flex items-start justify-between gap-2 border-b border-[#181824] pb-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {renderRoleBadge(activeTask.role)}
                    <span className="text-[11px] font-bold text-zinc-200">
                      {activeTask.taskId}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 font-semibold leading-relaxed">
                    {activeTask.objective}
                  </p>
                </div>
                <div className="shrink-0">{renderStatusBadge(activeTask.status)}</div>
              </div>

              {/* Task Attributes Metadata */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {activeTask.childThreadId && (
                  <div className="p-1.5 rounded bg-[#0e0e16] border border-[#1a1a28] space-y-0.5">
                    <div className="text-[8.5px] text-zinc-500 uppercase font-bold">
                      Child Thread ID
                    </div>
                    <div className="text-zinc-300 font-mono truncate">
                      {activeTask.childThreadId}
                    </div>
                  </div>
                )}

                {activeTask.workerId && (
                  <div className="p-1.5 rounded bg-[#0e0e16] border border-[#1a1a28] space-y-0.5">
                    <div className="text-[8.5px] text-zinc-500 uppercase font-bold">
                      Worker Process ID
                    </div>
                    <div className="text-zinc-300 font-mono truncate">
                      {activeTask.workerId}
                    </div>
                  </div>
                )}

                {activeTask.workspaceId && (
                  <div className="p-1.5 rounded bg-[#0e0e16] border border-[#1a1a28] space-y-0.5">
                    <div className="text-[8.5px] text-zinc-500 uppercase font-bold">
                      Workspace Isolation
                    </div>
                    <div className="text-zinc-300 font-mono truncate">
                      {activeTask.workspaceId}
                    </div>
                  </div>
                )}

                {activeTask.elapsedMs !== undefined && (
                  <div className="p-1.5 rounded bg-[#0e0e16] border border-[#1a1a28] space-y-0.5">
                    <div className="text-[8.5px] text-zinc-500 uppercase font-bold">
                      Duration
                    </div>
                    <div className="text-zinc-300 font-mono">
                      {(activeTask.elapsedMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                )}
              </div>

              {/* Findings */}
              {activeTask.findings && activeTask.findings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>Findings ({activeTask.findings.length})</span>
                  </div>
                  <div className="space-y-1">
                    {activeTask.findings.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[#0e111a] border border-cyan-500/20 text-cyan-100 text-[10px] leading-relaxed"
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Summary */}
              {activeTask.summary && (
                <div className="space-y-1">
                  <div className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider">
                    Execution Summary
                  </div>
                  <p className="p-2 rounded bg-[#0c0d14] border border-[#1b1c28] text-zinc-300 text-[10px] leading-relaxed">
                    {activeTask.summary}
                  </p>
                </div>
              )}

              {/* Error reason */}
              {activeTask.error && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[10px] space-y-1">
                  <div className="flex items-center gap-1 font-bold text-rose-400 text-[9.5px]">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Error / Failure Reason</span>
                  </div>
                  <p className="leading-relaxed">{activeTask.error}</p>
                </div>
              )}

              {/* Changed Files */}
              {activeTask.changedFiles && activeTask.changedFiles.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9.5px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                    <FileCode className="w-3 h-3" />
                    <span>Proposed File Changes ({activeTask.changedFiles.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeTask.changedFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[9.5px]"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Outcome */}
              {activeTask.verification && (
                <div className="p-2 rounded bg-[#0d1612] border border-emerald-500/30 text-emerald-200 text-[10px] space-y-1">
                  <div className="flex items-center gap-1 font-bold text-emerald-400 text-[9.5px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verification Verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9.5px]">
                    <span>
                      Passed: {activeTask.verification.passed ?? activeTask.verification.testsPassed ?? "Yes"}
                    </span>
                    {activeTask.verification.failed !== undefined && (
                      <span>Failed: {activeTask.verification.failed}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Task ChangeSets (Phase 8) */}
              {activeTask.changeSets && activeTask.changeSets.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <GitCommit className="w-3 h-3" />
                    <span>ChangeSets ({activeTask.changeSets.length})</span>
                  </div>
                  {activeTask.changeSets.map((cs, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#13121a] border border-[#242232] space-y-1.5 text-[10px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-200">
                          {cs.changeSetId || cs.id || `cs_${idx}`}
                        </span>
                        {renderRiskBadge(cs.firewall?.risk_level || cs.riskLevel)}
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        Files: {cs.files?.length || 0} modified
                      </div>
                      {cs.files && cs.files.length > 0 && onPreviewDiff && (
                        <div className="pt-1 flex flex-wrap gap-1">
                          {cs.files.map((f: any, fIdx: number) => (
                            <button
                              key={fIdx}
                              onClick={() =>
                                onPreviewDiff({
                                  filePath: f.filePath,
                                  original: f.original || "",
                                  replacement: f.transformed || f.replacement || "",
                                })
                              }
                              className="px-1.5 py-0.5 rounded bg-[#1c1a28] hover:bg-[#26233a] border border-purple-500/30 text-purple-300 text-[9px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Eye className="w-2.5 h-2.5" />
                              <span>Diff {f.filePath}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-1">
              <Users className="w-6 h-6 text-zinc-600" />
              <span className="text-[10px]">Select a task to inspect details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
