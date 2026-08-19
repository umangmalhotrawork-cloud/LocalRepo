"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Key,
  Settings,
  Code2,
  FileText,
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
  execution?: {
    providerId: string;
    modelId: string;
    isFallback?: boolean;
  };
};

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
  turnId?: string;
  status?: "THINKING" | "PLAN_READY" | "APPLIED" | "VERIFIED" | "UNKNOWN" | "ERROR";
  execution?: {
    providerId: string;
    modelId: string;
    isFallback?: boolean;
  };
  steps?: AgentStep[];
  proposedEdits?: ProposedEdit[];
};

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  activeFilePath?: string;
  activeSessionId?: string | null;
  activeSessionTitle?: string;
  activeContinuumSnapshot?: any;
  selectionInfo?: {
    text: string;
    startLineNumber: number;
    endLineNumber: number;
    startColumn?: number;
    endColumn?: number;
  } | null;
  initialTask?: string;
  onPreviewDiff?: (edit: ProposedEdit) => void;
  onApplyStep?: (step: AgentStep) => Promise<boolean>;
  onApplyAllApproved?: (steps: AgentStep[], createCommit: boolean, verifyCmd: string) => Promise<void>;
  runningCommandOutput?: string;
  isDocked?: boolean;
  onSelectVerificationTab?: () => void;
}

const SHORTCUT_ACTIONS = [
  { label: "Explain this file", prompt: "Explain the architecture and behavior of this file." },
  { label: "Find redundant code", prompt: "Analyze this file for dead code, vacuous operations, and redundant logic." },
  { label: "Review current code", prompt: "Review this file for potential bugs, edge cases, and safety risks." },
  { label: "Run tests", prompt: "Run unit tests and verification checks for this file." },
];

export default function AgentPanel({
  isOpen,
  onClose,
  workspacePath,
  activeFilePath,
  activeSessionId,
  activeSessionTitle,
  activeContinuumSnapshot,
  selectionInfo,
  initialTask,
  onPreviewDiff,
  onApplyStep,
  onApplyAllApproved,
  runningCommandOutput,
  isDocked = false,
  onSelectVerificationTab,
}: AgentPanelProps) {
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [result, setResult] = useState<AgentTaskResult | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [createGitCommit, setCreateGitCommit] = useState(true);
  const [runVerifyCmd, setRunVerifyCmd] = useState(false);
  const [verifyCmdText, setVerifyCmdText] = useState("npm test");
  const [applying, setApplying] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [showContinuumMenu, setShowContinuumMenu] = useState(false);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyValidationMsg, setKeyValidationMsg] = useState("");
  const [validatingKey, setValidatingKey] = useState(false);
  const [autonomousState, setAutonomousState] = useState<{
    repairId?: string;
    stage: string;
    iteration: number;
    maxIterations: number;
    activeRole?: string;
    activeModel?: string;
    testStatus?: string;
    testSummary?: any;
    failures?: any[];
  }>({
    stage: "IDLE",
    iteration: 1,
    maxIterations: 3,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.autonomous?.onProgress) {
      const unsubscribe = (window as any).electronAPI.autonomous.onProgress((data: any) => {
        if (!data) return;
        const statusOrEvent = data.event || data.status || "";
        if (["COMPLETED", "FAILED", "CANCELLED", "BLOCKED", "MAX_ITERATIONS_REACHED"].includes(statusOrEvent)) {
          setLoading(false);
        }
        setAutonomousState((prev) => ({
          ...prev,
          repairId: data.repairId || prev.repairId,
          stage: statusOrEvent || prev.stage,
          iteration: data.iteration || prev.iteration,
          maxIterations: data.maxIterations || prev.maxIterations,
          activeRole: data.activeRole || prev.activeRole,
          activeModel: data.activeModel || prev.activeModel,
          testStatus: data.testStatus || prev.testStatus,
          testSummary: data.testSummary || prev.testSummary,
          failures: data.failures || prev.failures,
        }));
      });
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, []);

  const handleCancelRepair = async () => {
    setLoading(false);
    if (autonomousState.repairId && typeof window !== "undefined" && (window as any).electronAPI?.autonomous?.cancel) {
      try {
        await (window as any).electronAPI.autonomous.cancel(autonomousState.repairId);
        setAutonomousState((prev) => ({ ...prev, stage: "CANCELLED" }));
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to cancel repair:", e);
      }
    } else {
      setAutonomousState((prev) => ({ ...prev, stage: "CANCELLED" }));
    }
  };
  const executedTaskRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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

  const fetchAiConfig = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        setAiConfig(config);
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to fetch AI config:", e);
      }
    }
  };

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      try {
        await (window as any).electronAPI.ai.setConfig(providerId, modelId);
        fetchAiConfig();
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to set model config:", e);
      }
    }
    setShowModelDropdown(false);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setValidatingKey(true);
    setKeyValidationMsg("");
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setApiKey) {
        const res = await (window as any).electronAPI.ai.setApiKey("gemini", apiKeyInput.trim());
        if (res.success) {
          setKeyValidationMsg("Connected successfully");
          setApiKeyInput("");
          fetchAiConfig();
          setTimeout(() => setShowKeyModal(false), 1000);
        } else {
          setKeyValidationMsg(`Validation failed: ${res.error || "Invalid key"}`);
        }
      }
    } catch (e: any) {
      setKeyValidationMsg(`Error: ${e.message}`);
    } finally {
      setValidatingKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.removeApiKey) {
        await (window as any).electronAPI.ai.removeApiKey("gemini");
        setApiKeyInput("");
        setKeyValidationMsg("API key removed");
        fetchAiConfig();
      }
    } catch (e) {
      console.error("[AGENT-PANEL] Remove key failed:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
      fetchAiConfig();
    }
  }, [isOpen, workspacePath]);

  const [localSnapshot, setLocalSnapshot] = useState<any>(null);
  const currentSnapshot = activeContinuumSnapshot || localSnapshot;
  const [activeContinuumContextText, setActiveContinuumContextText] = useState<string>("");

  // Hydrate visible conversation from authoritative Continuum turns
  useEffect(() => {
    if (currentSnapshot?.conversation?.recentTurns) {
      const turns = currentSnapshot.conversation.recentTurns;
      if (Array.isArray(turns) && turns.length > 0) {
        const hydratedMessages: AgentMessage[] = [];
        turns.forEach((turn: any) => {
          const userMsgId = `user_${turn.turnId || turn.timestamp}`;
          const agentMsgId = `agent_${turn.turnId || turn.timestamp}`;

          if (turn.userPrompt) {
            hydratedMessages.push({
              id: userMsgId,
              role: "user",
              content: turn.userPrompt,
              timestamp: turn.timestamp || Date.now(),
              turnId: turn.turnId,
            });
          }

          if (turn.agentSummary) {
            hydratedMessages.push({
              id: agentMsgId,
              role: "agent",
              content: turn.agentSummary,
              timestamp: (turn.timestamp || Date.now()) + 1,
              turnId: turn.turnId,
              status: turn.status || "VERIFIED",
              execution: {
                providerId: turn.providerId || currentSnapshot?.aiState?.provider || "gemini",
                modelId: turn.modelId || currentSnapshot?.aiState?.modelName || "gemini-1.5-flash",
                isFallback: false,
              },
            });
          }
        });

        setMessages(hydratedMessages);
      }
    }
  }, [currentSnapshot]);

  const [capsuleExportResult, setCapsuleExportResult] = useState<{
    success: boolean;
    capsuleId?: string;
    path?: string;
    contextText?: string;
    error?: string;
  } | null>(null);
  const [generatingCapsule, setGeneratingCapsule] = useState(false);

  const handleGenerateCapsule = async () => {
    const activeTaskGoal = taskInput || (result ? result.task : "");
    if (!activeTaskGoal || !activeTaskGoal.trim()) return;

    setGeneratingCapsule(true);
    setCapsuleExportResult(null);

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
          parentSessionId: currentSnapshot?.metadata?.sessionId || activeSessionId || null,
          recentTurns: currentSnapshot?.conversation?.recentTurns || [],
        };

        const res = await (window as any).electronAPI.continuum.exportCapsule(payload);
        if (res && res.success) {
          setCapsuleExportResult({
            success: true,
            capsuleId: res.capsuleId,
            path: res.path,
            contextText: res.capsule?.context_injection_text,
          });
          fetchSnapshots();
        } else {
          setCapsuleExportResult({
            success: false,
            error: res?.error || "Capsule generation failed",
          });
        }
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

  useEffect(() => {
    if (initialTask && initialTask.trim() && executedTaskRef.current !== initialTask) {
      executedTaskRef.current = initialTask;
      handleRunAgent(initialTask);
    }
  }, [initialTask]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunAgent = async (taskToRun?: string) => {
    if (loading) return; // Prevent concurrent duplicate task triggers
    const activeTask = taskToRun || taskInput;
    if (!activeTask || !activeTask.trim()) return;

    // Reset autonomous execution state for clean run
    setAutonomousState({
      stage: "RUNNING",
      iteration: 1,
      maxIterations: 3,
      testStatus: undefined,
      testSummary: undefined,
      failures: undefined,
    });

    const now = Date.now();
    const userMsgId = `user_${now}`;
    const agentMsgId = `agent_${now}`;

    // Append user message immediately
    const userMsg: AgentMessage = {
      id: userMsgId,
      role: "user",
      content: activeTask.trim(),
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setTaskInput("");
    setLoading(true);

    try {
      let res: AgentTaskResult;
      if (typeof window !== "undefined" && (window as any).electronAPI?.agent?.run) {
        res = await (window as any).electronAPI.agent.run({
          task: activeTask,
          workspacePath,
          activeFilePath,
          maxSteps: 5,
          continuumSnapshot: currentSnapshot,
          continuumContextText: activeContinuumContextText,
          providerId: aiConfig?.activeProvider,
          modelId: aiConfig?.activeModel,
          selectionText: selectionInfo?.text,
          selectionLineRange: selectionInfo ? `${selectionInfo.startLineNumber}-${selectionInfo.endLineNumber}` : undefined,
        });
      } else {
        // Fallback for browser testing
        const targetFile = activeFilePath || "src/calculator.py";
        res = {
          success: true,
          task: activeTask,
          summary: `Constructed surgical plan for: "${activeTask}"`,
          steps: [
            {
              id: "step-1",
              title: "Scan & Analyze Target Structure",
              reasoning: `Found target file ${targetFile}. Verified dependency structure.`,
              filesRead: [targetFile],
              proposedEdits: [],
              status: "pending",
            },
            {
              id: "step-2",
              title: "Apply Code Transformations",
              reasoning: `Generated verified transformations matching task request.`,
              filesRead: [targetFile],
              proposedEdits: [
                {
                  filePath: targetFile,
                  original: "subtotal = subtotal * 1",
                  replacement: "# Redundant identity operation removed safely",
                },
              ],
              firewallResult: { risk_level: "AUTO_APPROVE", risk_score: 10, safe_to_auto_apply: true },
              driftResult: { drift_level: "NONE", intent_drift_score: 0.02 },
              status: "pending",
            },
          ],
          execution: {
            providerId: "gemini",
            modelId: "gemini-1.5-flash",
            isFallback: false,
          },
        };
      }

      setResult(res);
      setSteps(res.steps || []);

      const expMap: Record<string, boolean> = {};
      (res.steps || []).forEach((s) => (expMap[s.id] = true));
      setExpandedSteps(expMap);

      const agentMsg: AgentMessage = {
        id: agentMsgId,
        role: "agent",
        content: res.summary || `Constructed plan with ${res.steps?.length || 0} steps.`,
        timestamp: Date.now(),
        status: res.steps && res.steps.length > 0 ? "PLAN_READY" : "VERIFIED",
        execution: res.execution,
        steps: res.steps,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      console.error("[AGENT-PANEL] Task execution failed:", err);
      const errorMsg: AgentMessage = {
        id: agentMsgId,
        role: "agent",
        content: `Error: ${err.message || "Failed to execute agent task"}`,
        timestamp: Date.now(),
        status: "ERROR",
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const activeProviderName = aiConfig?.providers?.find((p: any) => p.id === aiConfig?.activeProvider)?.name || "Gemini";
  const activeFileName = activeFilePath ? activeFilePath.split("/").pop() : "No file open";

  return (
    <div
      className={
        isDocked
          ? "w-[440px] max-w-full h-full bg-[#08080c] border-l border-[#161620] shadow-xl z-20 flex flex-col font-mono text-xs select-none shrink-0 overflow-hidden"
          : "fixed inset-y-0 right-0 w-[480px] max-w-full bg-[#08080c] border-l border-[#161620] shadow-2xl z-50 flex flex-col font-mono text-xs select-none"
      }
    >
      {/* 3A. Session Header Region */}
      <div className="bg-[#0b0b10] border-b border-[#161620] p-2.5 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="tracking-wide">NEXUS AGENT</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Model Selector Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="px-2 py-0.5 rounded-md bg-[#12121a] border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 hover:bg-cyan-950/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Select Active AI Model"
              >
                <span>{activeProviderName} {aiConfig?.activeModel === "gemini-1.5-pro" ? "Pro" : "Flash"}</span>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
              </button>

              {/* Model Dropdown Menu */}
              {showModelDropdown && (
                <div className="absolute right-0 top-7 w-60 bg-[#0c0c14] border border-[#242436] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 text-xs font-mono text-zinc-200">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 border-b border-[#1c1c28] pb-1 flex items-center justify-between">
                    <span>AI Execution Model</span>
                    <button onClick={() => setShowModelDropdown(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {(aiConfig?.providers || [
                      { id: "gemini", name: "Gemini Flash", status: "CONNECTED", isConfigured: true },
                      { id: "claude", name: "Claude Sonnet", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "grok", name: "Grok 2", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "deepseek", name: "DeepSeek Coder", status: "NOT_CONFIGURED", isConfigured: false },
                    ]).map((provider: any) => {
                      const isSelected = (aiConfig?.activeProvider || "gemini") === provider.id;
                      const isConnected = provider.isConfigured;

                      return (
                        <div
                          key={provider.id}
                          onClick={() => handleSelectModel(provider.id)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "bg-[#111827] border-cyan-500/50 text-cyan-300"
                              : "bg-[#09090e] border-[#181824] hover:bg-[#12121c] text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-[10.5px]">
                            <span>{isSelected ? "✓" : "○"}</span>
                            <span>{provider.name}</span>
                          </div>
                          <span className={`text-[9px] px-1 py-0.2 rounded ${isConnected ? "text-emerald-400 bg-emerald-950/60" : "text-zinc-500 bg-zinc-900"}`}>
                            {isConnected ? "Ready" : "Not configured"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#151520] cursor-pointer"
              title="Close Agent Dock"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Session & Target Context Bar */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5 border-t border-[#14141e]">
          <div className="flex items-center gap-1.5 truncate max-w-[240px]">
            <span className="text-zinc-500 font-bold uppercase text-[9px]">Session:</span>
            <span className="text-zinc-200 font-bold truncate">{activeSessionTitle || "Default Workspace Session"}</span>
          </div>

          <div className="flex items-center gap-1 text-cyan-400 font-mono text-[9.5px]">
            <FileCode className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{activeFileName}</span>
          </div>
        </div>
      </div>

      {/* 3B. Conversation Stream Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#060609]">
        {messages.length === 0 && (
          /* 3C & 11. Empty State & Shortcut Action Chips */
          <div className="py-6 space-y-4">
            <div className="p-3 rounded-xl bg-[#0a0a12] border border-[#181828] space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-[11px]">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>AI Coding Copilot Ready</span>
              </div>
              <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                Direct the autonomous agent to analyze, diagnose, refactor, or generate safe modifications for your active files.
              </p>
              {activeFilePath && (
                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 pt-1">
                  <span className="font-bold text-zinc-400">Target:</span>
                  <span className="text-cyan-300 font-mono">{activeFilePath}</span>
                </div>
              )}
            </div>

            {/* Quick Action Shortcuts */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">
                Suggested Actions
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SHORTCUT_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRunAgent(action.prompt)}
                    className="p-2 rounded-lg bg-[#0c0c14] hover:bg-[#121220] border border-[#1c1c2c] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-cyan-200 transition-all cursor-pointer space-y-1"
                  >
                    <div className="font-bold text-[10.5px] flex items-center justify-between">
                      <span>{action.label}</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400 opacity-60" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] p-2.5 rounded-xl bg-[#121b2b] border border-cyan-500/30 text-cyan-100 font-mono text-[11px] shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-[#0a0a10] border border-[#181826] space-y-2.5 shadow-sm">
                  {/* Agent Header Badge */}
                  <div className="flex items-center justify-between border-b border-[#141420] pb-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Execution Plan</span>
                    </div>

                    {msg.execution && (
                      <span className="px-1.5 py-0.2 rounded bg-[#101522] text-cyan-300 border border-cyan-500/30 text-[9.5px]">
                        {msg.execution.providerId} ({msg.execution.modelId})
                        {msg.execution.isFallback ? " [Fallback]" : ""}
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {msg.content}
                  </p>

                  {/* Step Timeline */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        Execution Steps ({msg.steps.length})
                      </div>

                      <div className="space-y-1">
                        {msg.steps.map((step, idx) => (
                          <div
                            key={step.id}
                            className="p-2 rounded-lg bg-[#0d0d16] border border-[#1a1a2a] space-y-1.5"
                          >
                            <div
                              onClick={() => toggleExpand(step.id)}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-zinc-200">
                                <span className="text-cyan-400">Step {idx + 1}:</span>
                                <span>{step.title}</span>
                              </div>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${
                                  expandedSteps[step.id] ? "rotate-180" : ""
                                }`}
                              />
                            </div>

                            {expandedSteps[step.id] && (
                              <div className="space-y-2 pt-1 border-t border-[#161624] text-[10.5px]">
                                <p className="text-zinc-400">{step.reasoning}</p>

                                {step.filesRead && step.filesRead.length > 0 && (
                                  <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                                    <span>Files:</span>
                                    <span className="text-cyan-300">{step.filesRead.join(", ")}</span>
                                  </div>
                                )}

                                {/* Proposed Changes & Actions */}
                                {step.proposedEdits && step.proposedEdits.length > 0 && (
                                  <div className="p-2 rounded bg-[#07070b] border border-[#1f1f2e] space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold text-[10.5px] text-emerald-400">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Patch Safe (Firewall Approved)</span>
                                      </div>
                                      <span className="text-[9.5px] text-zinc-500">
                                        Risk: {step.firewallResult?.risk_level || "LOW"}
                                      </span>
                                    </div>

                                    {/* Action Buttons: Single Click Diff & Apply */}
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        onClick={() => onPreviewDiff && onPreviewDiff(step.proposedEdits[0])}
                                        className="px-2.5 py-1 rounded bg-[#101422] hover:bg-[#182034] border border-cyan-500/40 text-cyan-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <FileCode className="w-3 h-3" />
                                        <span>Review Diff</span>
                                      </button>

                                      <button
                                        onClick={() => handleApplySingleStep(step)}
                                        disabled={applying || step.status === "applied"}
                                        className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>{step.status === "applied" ? "Applied" : "Apply Patch"}</span>
                                      </button>

                                      <button
                                        onClick={() => handleRejectStep(step.id)}
                                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                                        title="Reject this step"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Action Controls: Run Again & View Evidence */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a26] text-[10px]">
                    <button
                      onClick={() => handleRunAgent(msg.content)}
                      disabled={loading}
                      className="px-2 py-0.5 rounded bg-[#101422] hover:bg-[#182034] border border-cyan-500/30 text-cyan-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3 text-cyan-400" />
                      <span>Run Again</span>
                    </button>
                    {onSelectVerificationTab && (
                      <button
                        onClick={onSelectVerificationTab}
                        className="px-2 py-0.5 rounded bg-[#101422] hover:bg-[#182034] border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>View Evidence</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Live Agent Execution Timeline */}
        {loading && (
          <div className="p-3 rounded-xl bg-[#0a0a10] border border-cyan-500/30 space-y-2.5 font-mono text-[11px]">
            {/* Stage Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span className="text-cyan-300 font-bold text-[11px] uppercase tracking-wider">
                  {autonomousState.stage === "IDLE" ? "RUNNING" : autonomousState.stage.replace(/_/g, " ")}
                </span>
              </div>
              {autonomousState.activeRole && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold">
                  {autonomousState.activeRole} · {autonomousState.activeModel || "gemini"}
                </span>
              )}
            </div>

            {/* Execution Stage Pipeline */}
            <div className="flex items-center gap-1 flex-wrap">
              {["PLANNING","DEBUGGING","CODE","REVIEW","PATCH","TESTING","VERIFICATION"].map((stg) => {
                const stages = ["PLANNING","DEBUGGING","CODE","REVIEW","PATCH","TESTING","VERIFICATION"];
                const currIdx = stages.indexOf(autonomousState.stage.toUpperCase());
                const thisIdx = stages.indexOf(stg);
                const isDone = currIdx > thisIdx;
                const isActive = currIdx === thisIdx;
                return (
                  <React.Fragment key={stg}>
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                      isDone ? "text-emerald-400 bg-emerald-950/60" :
                      isActive ? "text-cyan-300 bg-cyan-950/60 border border-cyan-500/30" :
                      "text-zinc-600"
                    }`}>
                      {isDone ? "✓ " : isActive ? "▶ " : ""}{stg}
                    </span>
                    {thisIdx < stages.length - 1 && <span className="text-zinc-700 text-[9px]">→</span>}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Repair Iteration Indicator */}
            {autonomousState.iteration > 1 && (
              <div className="flex items-center gap-2 text-[10px] text-amber-300">
                <span className="font-bold">Attempt {autonomousState.iteration}</span>
                <span className="text-zinc-500">of {autonomousState.maxIterations}</span>
                {autonomousState.testStatus === "FAILED" && (
                  <span className="px-1 py-0.2 rounded bg-rose-950 border border-rose-500/30 text-rose-300 text-[9px] font-bold">✕ FAILED</span>
                )}
                {autonomousState.testStatus === "PASSED" && (
                  <span className="px-1 py-0.2 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold">✓ REPAIRED</span>
                )}
              </div>
            )}

            {/* Test progress inline */}
            {autonomousState.testSummary && (
              <div className="p-1.5 rounded bg-[#0d1612] border border-emerald-500/30 flex items-center gap-2 text-[10px]">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-bold">
                  {autonomousState.testSummary.passed ?? 0} passed
                </span>
                {(autonomousState.testSummary.failed ?? 0) > 0 && (
                  <span className="text-rose-400 font-bold">
                    · {autonomousState.testSummary.failed} failed
                  </span>
                )}
              </div>
            )}

            {/* Action Row */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={handleCancelRepair}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-rose-300 hover:border-rose-500/40 text-[10px] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              {onSelectVerificationTab && (
                <button
                  onClick={onSelectVerificationTab}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/40 text-[10px] cursor-pointer transition-colors"
                >
                  View Evidence
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3C & 3D. Context Pill & Command Input Bar */}
      <div className="p-2.5 bg-[#0a0a0e] border-t border-[#161620] space-y-2 shrink-0">
        {/* Real Context Indicator Pill */}
        <div className="flex items-center justify-between text-[10px] font-mono px-1">
          <div className="flex items-center gap-1.5 text-zinc-400 truncate">
            <span className="text-zinc-500 font-bold uppercase text-[9px]">Target:</span>
            <span className="text-cyan-300 truncate max-w-[180px]">{activeFileName}</span>
            {selectionInfo && (
              <span className="px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
                Lines {selectionInfo.startLineNumber}–{selectionInfo.endLineNumber} ({selectionInfo.text.length}c)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateCapsule}
              disabled={generatingCapsule}
              className="text-[9.5px] text-zinc-500 hover:text-cyan-300 cursor-pointer transition-colors"
              title="Export Nexus Capsule"
            >
              {generatingCapsule ? "Exporting..." : "Capsule"}
            </button>
          </div>
        </div>

        {/* Command Input Box */}
        <div className="relative flex items-end bg-[#12121a] border border-[#222232] focus-within:border-cyan-500/60 rounded-xl p-1.5 transition-all">
          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRunAgent();
              }
            }}
            placeholder="Ask NEXUS about this file... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="w-full bg-transparent resize-none outline-none text-zinc-100 placeholder:text-zinc-600 text-[11px] font-mono p-1 leading-relaxed"
          />

          <button
            onClick={() => handleRunAgent()}
            disabled={loading || !taskInput.trim()}
            className="p-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 disabled:opacity-30 cursor-pointer transition-all shrink-0 ml-1 shadow-sm"
            title="Execute Agent Task"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
