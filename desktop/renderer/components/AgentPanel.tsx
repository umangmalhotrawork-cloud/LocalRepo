"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  GitCommit,
  Terminal,
  RotateCcw,
  Layers,
  X,
  ArrowRight,
  Send,
  Loader2,
  Check,
} from "lucide-react";

export type ProposedEdit = {
  filePath: string;
  original: string;
  replacement: string;
};

export type AgentStep = {
  id: string;
  title: string;
  reasoning: string;
  filesRead: string[];
  proposedEdits: ProposedEdit[];
  firewallResult?: {
    risk_score?: number;
    risk_level?: string;
    safe_to_auto_apply?: boolean;
  };
  driftResult?: {
    intent_drift_score?: number;
    drift_level?: string;
    confidence?: number;
  };
  status: "pending" | "approved" | "applied" | "rejected" | "error";
};

export type AgentTaskResult = {
  success: boolean;
  task: string;
  steps: AgentStep[];
  summary: string;
};

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onPreviewDiff?: (edit: ProposedEdit) => void;
  onApplyStep?: (step: AgentStep) => Promise<boolean>;
  onApplyAllApproved?: (steps: AgentStep[], createCommit: boolean, verifyCmd: string) => Promise<void>;
  runningCommandOutput?: string;
}

const PRESET_TASKS = [
  "Fix all TypeScript errors",
  "Add JWT authentication",
  "Refactor duplicate code",
  "Generate unit tests",
  "Upgrade dependencies safely",
];

function formatTimeAgo(ts?: number): string {
  if (!ts) return "Recently";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}


export default function AgentPanel({
  isOpen,
  onClose,
  workspacePath,
  onPreviewDiff,
  onApplyStep,
  onApplyAllApproved,
  runningCommandOutput,
}: AgentPanelProps) {
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTaskResult | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [createGitCommit, setCreateGitCommit] = useState(true);
  const [runVerifyCmd, setRunVerifyCmd] = useState(false);
  const [verifyCmdText, setVerifyCmdText] = useState("npm test");
  const [applying, setApplying] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [showContinuumMenu, setShowContinuumMenu] = useState(false);

  const fetchSnapshots = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.list) {
      try {
        const list = await (window as any).electronAPI.continuum.list(workspacePath);
        setSnapshots(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to fetch Continuum snapshots:", e);
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen, workspacePath]);

  const handleCreateContinuum = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.createCurrent) {
      try {
        const payload = {
          userGoal: taskInput || (result ? result.task : "Agent Task Session"),
          completedSteps: steps.filter((s) => s.status === "applied").map((s) => s.title),
          pendingSteps: steps.filter((s) => s.status === "pending").map((s) => s.title),
          summary: result?.summary || "",
        };
        await (window as any).electronAPI.continuum.createCurrent(payload, workspacePath);
        fetchSnapshots();
      } catch (e) {
        console.error("[AGENT-PANEL] Create Continuum failed:", e);
      }
    }
  };

  const handleResumeSnapshot = async (snapshotId: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.resumeSession) {
      setLoading(true);
      setShowContinuumMenu(false);
      try {
        const res = await (window as any).electronAPI.continuum.resumeSession(snapshotId, workspacePath);
        if (res && res.success) {
          // Reset current session state
          setSteps([]);
          setResult(null);

          if (res.agentResult) {
            setResult(res.agentResult);
            setSteps(res.agentResult.steps || []);
            setTaskInput(res.agentResult.task || "");
          }
          fetchSnapshots();
        }
      } catch (e) {
        console.error("[AGENT-PANEL] Resume snapshot failed:", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.delete) {
      try {
        await (window as any).electronAPI.continuum.delete(snapshotId, workspacePath);
        fetchSnapshots();
      } catch (e) {
        console.error("[AGENT-PANEL] Delete snapshot failed:", e);
      }
    }
  };

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunAgent = async (taskToRun?: string) => {
    const activeTask = taskToRun || taskInput;
    if (!activeTask || !activeTask.trim()) return;

    setLoading(true);
    try {
      let res: AgentTaskResult;
      if (typeof window !== "undefined" && (window as any).electronAPI?.agent?.run) {
        res = await (window as any).electronAPI.agent.run({
          task: activeTask,
          workspacePath,
          maxSteps: 5,
        });
      } else {
        // Fallback for browser tests
        res = {
          success: true,
          task: activeTask,
          summary: `Plan generated for "${activeTask}"`,
          steps: [
            {
              id: "step-1",
              title: "Scan & Analyze Workspace",
              reasoning: `Found relevant files for "${activeTask}". Verified dependency integrity.`,
              filesRead: ["src/calculator.py"],
              proposedEdits: [],
              status: "pending",
            },
            {
              id: "step-2",
              title: "Apply Code Modifications",
              reasoning: `Generate surgical transformations matching "${activeTask}".`,
              filesRead: ["src/calculator.py"],
              proposedEdits: [
                {
                  filePath: "src/calculator.py",
                  original: "def calculate(a, b): return a + b",
                  replacement: "def calculate(a, b):\n    # Verified patch\n    return a + b",
                },
              ],
              firewallResult: { risk_level: "AUTO_APPROVE", risk_score: 10, safe_to_auto_apply: true },
              driftResult: { drift_level: "NONE", intent_drift_score: 0.02 },
              status: "pending",
            },
          ],
        };
      }

      setResult(res);
      setSteps(res.steps || []);
      // Auto-expand all steps
      const expMap: Record<string, boolean> = {};
      (res.steps || []).forEach((s) => (expMap[s.id] = true));
      setExpandedSteps(expMap);
    } catch (err: any) {
      console.error("[AGENT-PANEL] Task execution failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveStep = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "approved" } : s))
    );
  };

  const handleRejectStep = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" } : s))
    );
  };

  const handleApplySingleStep = async (step: AgentStep) => {
    if (onApplyStep) {
      setApplying(true);
      try {
        const ok = await onApplyStep(step);
        if (ok) {
          setSteps((prev) =>
            prev.map((s) => (s.id === step.id ? { ...s, status: "applied" } : s))
          );
        }
      } finally {
        setApplying(false);
      }
    }
  };

  const handleApplyAllApprovedSteps = async () => {
    const approved = steps.filter((s) => s.status === "approved");
    if (approved.length === 0) return;

    setApplying(true);
    try {
      if (onApplyAllApproved) {
        await onApplyAllApproved(
          approved,
          createGitCommit,
          runVerifyCmd ? verifyCmdText : ""
        );
      }
      setSteps((prev) =>
        prev.map((s) => (s.status === "approved" ? { ...s, status: "applied" } : s))
      );
    } finally {
      setApplying(false);
    }
  };

  const approvedCount = steps.filter((s) => s.status === "approved").length;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] max-w-full bg-[#09090c] border-l border-[#1f1f1f] shadow-2xl z-50 flex flex-col font-mono text-xs select-none">
      {/* Header */}
      <div className="h-10 bg-[#0d0d12] border-b border-[#1f1f1f] px-3 flex items-center justify-between shrink-0 relative">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>AI</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowContinuumMenu(!showContinuumMenu)}
            className="px-2 py-0.5 rounded bg-[#13131c] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            title="Recent Work History"
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Recent Work ({snapshots.length})</span>
            <ChevronDown className="w-3 h-3 text-cyan-400" />
          </button>
          <button
            onClick={handleCreateContinuum}
            className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 text-[10px] font-bold cursor-pointer"
            title="Save Current Checkpoint"
          >
            + Checkpoint
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recent Work Dropdown Menu */}
        {showContinuumMenu && (
          <div className="absolute right-3 top-10 w-96 bg-[#0d0d14] border border-[#2a2a38] rounded-xl shadow-2xl z-50 p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-[#1f1f2a] pb-2">
              <span className="font-bold text-cyan-400 text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Recent Work
              </span>
              <span className="text-[10px] text-zinc-400">{snapshots.length} saved</span>
            </div>

            {snapshots.length === 0 ? (
              <div className="py-4 text-center text-zinc-500 text-[11px]">
                No recent work saved for this workspace yet.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {snapshots.map((snap) => {
                  const goal = snap.userGoal || snap.task?.userGoal || "Engineering Task";
                  const target = snap.activeTargetNodeId || snap.codeState?.activeTargetNodeId;
                  const timeAgo = formatTimeAgo(snap.createdAt || snap.metadata?.createdAt);

                  return (
                    <div
                      key={snap.snapshotId || snap.sessionId}
                      className="p-2.5 bg-[#07070a] border border-[#1f1f28] rounded-lg space-y-1.5 hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-bold text-cyan-300 truncate max-w-[220px]" title={goal}>
                          {goal}
                        </span>
                        <span className="text-zinc-500 text-[9.5px]">{timeAgo}</span>
                      </div>

                      {target && (
                        <div className="text-[10px] text-zinc-400 truncate" title={target}>
                          Target: {target}
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#15151f]">
                        <button
                          onClick={() => handleResumeSnapshot(snap.snapshotId || snap.sessionId)}
                          className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 text-cyan-400" /> Continue
                        </button>
                        <button
                          onClick={() => handleDeleteSnapshot(snap.snapshotId || snap.sessionId)}
                          className="px-2 py-1 rounded bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 text-[10px] font-bold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Input Section */}
      <div className="p-3 border-b border-[#1f1f1f] bg-[#0c0c10] space-y-2 shrink-0">
        <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
          <span>Ask AI</span>
          <span className="text-[10px] text-zinc-500">Press ⌘+Enter to run</span>
        </div>

        <div className="relative">
          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleRunAgent();
              }
            }}
            placeholder="What would you like to do? e.g. Fix all TypeScript errors, Refactor duplicate code..."
            className="w-full h-16 bg-[#141418] border border-[#27272a] focus:border-cyan-500/60 rounded-xl p-2.5 text-zinc-100 placeholder:text-zinc-600 outline-none text-[11px] font-mono resize-none"
          />
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap gap-1">
          {PRESET_TASKS.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setTaskInput(preset);
                handleRunAgent(preset);
              }}
              className="px-2 py-0.5 rounded-md bg-[#181820] hover:bg-cyan-950/60 border border-[#27272a] hover:border-cyan-500/40 text-zinc-400 hover:text-cyan-300 text-[10px] transition-all cursor-pointer truncate max-w-[200px]"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Run Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Behavior verification active</span>
          </div>
          <button
            onClick={() => handleRunAgent()}
            disabled={loading || !taskInput.trim()}
            className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Steps Timeline & Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {result && (
          <div className="p-2.5 rounded-xl bg-[#0e0e14] border border-cyan-500/20 space-y-1">
            <div className="text-cyan-300 font-bold text-[11px] flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Execution Summary</span>
            </div>
            <p className="text-zinc-300 text-[10.5px] leading-relaxed">{result.summary}</p>
          </div>
        )}

        {steps.map((step, idx) => {
          const isExpanded = expandedSteps[step.id] ?? true;
          const hasEdits = step.proposedEdits && step.proposedEdits.length > 0;
          const isApproved = step.status === "approved";
          const isApplied = step.status === "applied";
          const isRejected = step.status === "rejected";

          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isApplied
                  ? "bg-[#0b1410] border-emerald-500/40"
                  : isApproved
                  ? "bg-[#081820] border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : isRejected
                  ? "bg-[#180d0d] border-rose-500/30 opacity-60"
                  : "bg-[#0d0d12] border-[#222228]"
              }`}
            >
              {/* Step Header */}
              <div
                onClick={() => toggleExpand(step.id)}
                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#181820] border border-[#27272a] flex items-center justify-center font-bold text-[10px] text-cyan-400">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-zinc-200 text-[11px]">{step.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                      isApplied
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : isApproved
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                        : isRejected
                        ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {step.status}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </div>
              </div>

              {/* Step Expanded Content */}
              {isExpanded && (
                <div className="p-2.5 pt-0 border-t border-[#1a1a20] space-y-2 text-[10.5px]">
                  {/* Reasoning */}
                  <div className="text-zinc-400 leading-relaxed">{step.reasoning}</div>

                  {/* Files Read Chips */}
                  {step.filesRead && step.filesRead.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-zinc-600 text-[10px]">Files:</span>
                      {step.filesRead.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded bg-[#16161e] border border-[#272730] text-zinc-300 text-[10px] flex items-center gap-1"
                        >
                          <FileCode className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{f.split("/").pop()}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Safety Badges */}
                  {hasEdits && (
                    <div className="flex items-center gap-2 pt-1">
                      {step.firewallResult?.risk_level === "HIGH" || step.driftResult?.drift_level === "HIGH" ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[9.5px]">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>⚠ Behavioral Warning Detected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[9.5px]">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Behavior verified safe ✓</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions per step */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#1a1a20]">
                    {hasEdits && onPreviewDiff ? (
                      <button
                        onClick={() => onPreviewDiff(step.proposedEdits[0])}
                        className="px-2 py-1 rounded bg-[#181822] hover:bg-[#22222e] text-cyan-300 text-[10px] flex items-center gap-1 border border-cyan-500/30 cursor-pointer"
                      >
                        <Layers className="w-3 h-3 text-cyan-400" />
                        <span>Preview Diff</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-1.5">
                      {!isApplied && (
                        <>
                          <button
                            onClick={() => handleRejectStep(step.id)}
                            className="p-1 rounded hover:bg-rose-950 text-zinc-500 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Reject Step"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproveStep(step.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                              isApproved
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/50"
                                : "bg-[#1c1c24] hover:bg-[#262632] text-zinc-300 hover:text-white border border-[#2c2c36]"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{isApproved ? "Approved" : "Approve"}</span>
                          </button>
                          {hasEdits && (
                            <button
                              disabled={applying}
                              onClick={() => handleApplySingleStep(step)}
                              className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-emerald-400" />
                              <span>Apply</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {steps.length === 0 && !loading && (
          <div className="h-48 flex flex-col items-center justify-center text-zinc-600 space-y-2">
            <Bot className="w-8 h-8 text-zinc-700" />
            <p className="text-xs">No active agent task. Enter a directive above.</p>
          </div>
        )}

        {/* Live Command Stream Output */}
        {runningCommandOutput && (
          <div className="p-2.5 rounded-xl bg-[#050507] border border-[#1f1f26] space-y-1">
            <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-emerald-400" />
              <span>Verification Output</span>
            </div>
            <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {runningCommandOutput}
            </pre>
          </div>
        )}
      </div>

      {/* Footer / Batch Apply Controls */}
      {steps.length > 0 && (
        <div className="p-3 border-t border-[#1f1f1f] bg-[#0c0c10] space-y-2 shrink-0">
          {/* Options */}
          <div className="space-y-1.5 text-[10px] text-zinc-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createGitCommit}
                onChange={(e) => setCreateGitCommit(e.target.checked)}
                className="accent-cyan-400 cursor-pointer"
              />
              <span>Create Git commit after apply (`agent: &lt;task summary&gt;`)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={runVerifyCmd}
                onChange={(e) => setRunVerifyCmd(e.target.checked)}
                className="accent-cyan-400 cursor-pointer"
              />
              <span>Run verification command</span>
            </label>

            {runVerifyCmd && (
              <input
                type="text"
                value={verifyCmdText}
                onChange={(e) => setVerifyCmdText(e.target.value)}
                placeholder="e.g. npm run build, pytest"
                className="w-full bg-[#141418] border border-[#27272a] rounded px-2 py-1 text-zinc-100 text-[10.5px] font-mono outline-none"
              />
            )}
          </div>

          {/* Apply Approved Steps Button */}
          <button
            onClick={handleApplyAllApprovedSteps}
            disabled={approvedCount === 0 || applying}
            className="w-full py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40"
          >
            {applying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Applying Changes...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                <span>Apply {approvedCount} Approved Step{approvedCount === 1 ? "" : "s"}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
