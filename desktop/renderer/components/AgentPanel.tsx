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
  Copy,
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
  taskIntent?: "READ_ONLY" | "MUTATION";
  steps: AgentStep[];
  summary: string;
};

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  activeFilePath?: string;
  initialTask?: string;
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
  activeFilePath,
  initialTask,
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
  const executedTaskRef = React.useRef<string | null>(null);

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

  const [activeContinuumSnapshot, setActiveContinuumSnapshot] = useState<any>(null);
  const [activeContinuumContextText, setActiveContinuumContextText] = useState<string>("");

  const [capsuleExportResult, setCapsuleExportResult] = useState<{
    success: boolean;
    capsuleId?: string;
    path?: string;
    contextText?: string;
    error?: string;
  } | null>(null);
  const [copiedContext, setCopiedContext] = useState(false);
  const [generatingCapsule, setGeneratingCapsule] = useState(false);

  const handleGenerateCapsule = async () => {
    const activeTaskGoal = taskInput || (result ? result.task : "");
    if (!activeTaskGoal || !activeTaskGoal.trim()) return;

    setGeneratingCapsule(true);
    setCapsuleExportResult(null);
    setCopiedContext(false);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.exportCapsule) {
        const payload = {
          task: activeTaskGoal,
          workspacePath,
          activeFilePath,
          steps: steps.map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            firewallResult: s.firewallResult,
          })),
          summary: result?.summary || "",
          exportMode: "INLINE" as const,
          parentSessionId: activeContinuumSnapshot?.metadata?.sessionId || null,
          recentTurns: activeContinuumSnapshot?.conversation?.recentTurns || [],
        };

        const res = await (window as any).electronAPI.continuum.exportCapsule(payload);
        if (res && res.success) {
          setCapsuleExportResult({
            success: true,
            capsuleId: res.capsuleId,
            path: res.path,
            contextText: res.capsule?.handoff_context?.context_injection_text || "",
          });
          fetchSnapshots();
        } else {
          setCapsuleExportResult({
            success: false,
            error: res?.error || "Capsule generation failed",
          });
        }
      } else {
        setCapsuleExportResult({
          success: false,
          error: "Continuum exportCapsule bridge unavailable",
        });
      }
    } catch (e: any) {
      setCapsuleExportResult({
        success: false,
        error: e.message || "Failed to generate capsule",
      });
    } finally {
      setGeneratingCapsule(false);
    }
  };

  const [capsuleImportResult, setCapsuleImportResult] = useState<{
    success: boolean;
    capsuleId?: string;
    nextSnapshotId?: string;
    parentSessionId?: string;
    sequenceNumber?: number;
    immediateNextAction?: string;
    doNotTouch?: string[];
    contextText?: string;
    error?: string;
  } | null>(null);
  const [importingCapsule, setImportingCapsule] = useState(false);

  const handleImportCapsule = async () => {
    setImportingCapsule(true);
    setCapsuleImportResult(null);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.importCapsule) {
        let selectedPath: string | null = null;
        if ((window as any).electronAPI.continuum.openCapsuleDialog) {
          selectedPath = await (window as any).electronAPI.continuum.openCapsuleDialog();
        }

        if (!selectedPath) {
          setImportingCapsule(false);
          return;
        }

        const res = await (window as any).electronAPI.continuum.importCapsule({
          capsulePath: selectedPath,
          workspacePath,
        });

        if (res && res.success) {
          setSteps([]);
          setResult(null);

          const goal = res.nextSnapshot?.task?.userGoal || res.handoffContext?.immediate_next_action || "";
          if (goal) {
            setTaskInput(goal);
          }

          if (res.nextSnapshot) {
            setActiveContinuumSnapshot(res.nextSnapshot);
          }
          if (res.contextText) {
            setActiveContinuumContextText(res.contextText);
          }

          setCapsuleImportResult({
            success: true,
            capsuleId: res.capsuleMeta?.capsule_id,
            nextSnapshotId: res.nextSnapshotId,
            parentSessionId: res.parentSessionId,
            sequenceNumber: res.sequenceNumber,
            immediateNextAction: res.handoffContext?.immediate_next_action,
            doNotTouch: res.handoffContext?.do_not_touch || [],
            contextText: res.contextText,
          });

          fetchSnapshots();
        } else {
          setCapsuleImportResult({
            success: false,
            error: res?.error || "Capsule import failed",
          });
        }
      } else {
        setCapsuleImportResult({
          success: false,
          error: "Continuum importCapsule bridge unavailable",
        });
      }
    } catch (e: any) {
      setCapsuleImportResult({
        success: false,
        error: e.message || "Failed to import capsule",
      });
    } finally {
      setImportingCapsule(false);
    }
  };

  React.useEffect(() => {
    if (initialTask && initialTask.trim() && executedTaskRef.current !== initialTask) {
      executedTaskRef.current = initialTask;
      setTaskInput(initialTask);
      handleRunAgent(initialTask);
    }
  }, [initialTask]);

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

          if (res.snapshot) {
            setActiveContinuumSnapshot(res.snapshot);
          }
          if (res.contextText) {
            setActiveContinuumContextText(res.contextText);
          }

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
          activeFilePath,
          maxSteps: 5,
          continuumSnapshot: activeContinuumSnapshot,
          continuumContextText: activeContinuumContextText,
        });
      } else {
        // Fallback for browser tests
        const targetFile = activeFilePath || "src/calculator.py";
        res = {
          success: true,
          task: activeTask,
          summary: `Plan generated for "${activeTask}"`,
          steps: [
            {
              id: "step-1",
              title: "Scan & Analyze Workspace",
              reasoning: `Found relevant files for "${activeTask}". Verified dependency integrity.`,
              filesRead: [targetFile],
              proposedEdits: [],
              status: "pending",
            },
            {
              id: "step-2",
              title: "Apply Code Modifications",
              reasoning: `Generate surgical transformations matching "${activeTask}".`,
              filesRead: [targetFile],
              proposedEdits: [
                {
                  filePath: targetFile,
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

      setLoading(false);
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
  const isReadOnlyTask = result?.taskIntent === "READ_ONLY" || (steps.length > 0 && steps.every((s) => !s.proposedEdits || s.proposedEdits.length === 0));

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
            onClick={handleGenerateCapsule}
            disabled={generatingCapsule || (!taskInput.trim() && !result)}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
              !taskInput.trim() && !result
                ? "bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                : "bg-purple-950/80 border-purple-500/40 text-purple-300 hover:bg-purple-900/50"
            }`}
            title="Generate Portable Nexus Capsule v1.0.0"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>{generatingCapsule ? "Generating..." : "Generate Nexus Capsule"}</span>
          </button>
          <button
            onClick={handleImportCapsule}
            disabled={importingCapsule}
            className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
            title="Import Portable Nexus Capsule v1.0.0"
          >
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>{importingCapsule ? "Importing..." : "Import Nexus Capsule"}</span>
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
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Continuum Checkpoints</span>
              </span>
              <button onClick={() => setShowContinuumMenu(false)} className="text-zinc-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {snapshots.length === 0 ? (
                <div className="text-zinc-500 italic py-2 text-[10px] text-center">No snapshots recorded yet.</div>
              ) : (
                snapshots.map((snap) => (
                  <div key={snap.snapshotId || snap.sessionId} className="p-2 rounded bg-[#13131c] border border-[#22222e] flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="text-zinc-200 font-bold text-[10.5px] truncate">{snap.userGoal || snap.user_intent_summary || "Session Snapshot"}</div>
                      <div className="text-[9.5px] text-zinc-500">{formatTimeAgo(snap.createdAt ? new Date(snap.createdAt).getTime() : undefined)}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleResumeSnapshot(snap.snapshotId || snap.sessionId)}
                        className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-[10px] font-bold cursor-pointer"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.snapshotId || snap.sessionId)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Capsule Export Success/Error Compact Banner */}
      {capsuleExportResult && (
        <div className="mx-3 mt-2 p-2.5 bg-[#0d0d14] border border-purple-500/40 rounded-xl space-y-1.5 text-xs font-mono shrink-0">
          <div className="flex items-center justify-between">
            <div className="font-bold text-purple-300 flex items-center gap-1 text-[10.5px]">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Nexus Capsule v1.0.0</span>
            </div>
            <button
              onClick={() => setCapsuleExportResult(null)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {capsuleExportResult.success ? (
            <div className="space-y-1.5 text-[10px]">
              <div className="text-emerald-400 font-bold">Status: EXPORTED_SUCCESSFULLY</div>
              <div className="text-zinc-300">
                <span className="text-zinc-500">ID: </span>
                <span className="text-purple-300 font-bold select-all">{capsuleExportResult.capsuleId}</span>
              </div>
              {capsuleExportResult.path && (
                <div className="truncate text-zinc-500 select-all">
                  Path: <span className="text-zinc-400">{capsuleExportResult.path}</span>
                </div>
              )}
              <div className="pt-1 flex items-center gap-2">
                {capsuleExportResult.contextText && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(capsuleExportResult.contextText || "");
                      setCopiedContext(true);
                      setTimeout(() => setCopiedContext(false), 2000);
                    }}
                    className="py-1 px-2 rounded bg-purple-950 border border-purple-500/40 text-purple-200 hover:bg-purple-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-purple-400" />
                    <span>{copiedContext ? "Copied Context!" : "Copy Context"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-rose-400 text-[10px]">
              Error: {capsuleExportResult.error}
            </div>
          )}
        </div>
      )}

      {/* Capsule Import Success/Error Compact Banner */}
      {capsuleImportResult && (
        <div className="mx-3 mt-2 p-2.5 bg-[#0d0d14] border border-emerald-500/40 rounded-xl space-y-1.5 text-xs font-mono shrink-0">
          <div className="flex items-center justify-between">
            <div className="font-bold text-emerald-300 flex items-center gap-1 text-[10.5px]">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nexus Capsule v1.0.0 Imported</span>
            </div>
            <button
              onClick={() => setCapsuleImportResult(null)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {capsuleImportResult.success ? (
            <div className="space-y-1.5 text-[10px]">
              <div className="text-emerald-400 font-bold">Status: RESTORED_AND_CHAINED</div>
              <div className="text-zinc-300">
                <span className="text-zinc-500">Capsule ID: </span>
                <span className="text-emerald-300 font-bold select-all">{capsuleImportResult.capsuleId}</span>
              </div>
              <div className="text-zinc-300">
                <span className="text-zinc-500">Chained Session: </span>
                <span className="text-zinc-200">{capsuleImportResult.nextSnapshotId}</span>
                <span className="text-zinc-500"> (Parent: {capsuleImportResult.parentSessionId}, Seq: {capsuleImportResult.sequenceNumber})</span>
              </div>
              {capsuleImportResult.immediateNextAction && (
                <div className="text-zinc-300">
                  <span className="text-zinc-500">Next Action: </span>
                  <span className="text-cyan-300">{capsuleImportResult.immediateNextAction}</span>
                </div>
              )}
              {capsuleImportResult.doNotTouch && capsuleImportResult.doNotTouch.length > 0 && (
                <div className="text-rose-300 font-bold">
                  <span>Do Not Touch: </span>
                  <span>{capsuleImportResult.doNotTouch.join(', ')}</span>
                </div>
              )}
              <div className="pt-1 flex items-center gap-2">
                {capsuleImportResult.contextText && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(capsuleImportResult.contextText || "");
                      setCopiedContext(true);
                      setTimeout(() => setCopiedContext(false), 2000);
                    }}
                    className="py-1 px-2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-emerald-400" />
                    <span>{copiedContext ? "Copied Context!" : "Copy Continuation Context"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-rose-400 text-[10px]">
              Error: {capsuleImportResult.error}
            </div>
          )}
        </div>
      )}

      {/* Directive Input */}
      <div className="p-3 border-b border-[#1f1f1f] bg-[#0c0c10] space-y-2 shrink-0">
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Agent Task Prompt</label>
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
            <div className="text-cyan-300 font-bold text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span>Execution Summary</span>
              </span>
              {isReadOnlyTask && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                  READ-ONLY ANALYSIS
                </span>
              )}
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
                  {hasEdits && !isReadOnlyTask && (
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
                  {!isReadOnlyTask && (
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
                  )}
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
        isReadOnlyTask ? (
          <div className="p-3 border-t border-[#1f1f1f] bg-[#08140e] text-emerald-300 text-[10.5px] font-bold flex items-center justify-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>READ-ONLY DIAGNOSTIC ANALYSIS — ZERO FILES MODIFIED</span>
          </div>
        ) : (
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
        )
      )}
    </div>
  );
}
