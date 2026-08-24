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
  Clock,
  GitBranch,
  Box,
  Upload,
} from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";
import SwarmActivityPanel from "./SwarmActivityPanel";
import ChangeConflictResolver, { ConflictItem } from "./ChangeConflictResolver";
import CapsuleDropZone from "./CapsuleDropZone";
import CapsuleImportBanner from "./CapsuleImportBanner";
import CapsuleImportModal from "./CapsuleImportModal";
import { generateContinuationPrompt } from "../utils/capsulePrompt";
import { useSwarmActivity } from "../hooks/useSwarmActivity";
import { TerminalDiagnostic } from "../utils/diagnosticParser";

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
  status?: "THINKING" | "PLAN_READY" | "APPLIED" | "VERIFIED" | "UNKNOWN" | "ERROR" | "STREAMING";
  execution?: {
    providerId: string;
    modelId: string;
    isFallback?: boolean;
  };
  steps?: AgentStep[];
  proposedEdits?: ProposedEdit[];
  isRateLimit?: boolean;
  rateInfo?: {
    providerId?: string;
    modelId?: string;
    message?: string;
    retryAfter?: string;
    retryAfterMs?: number;
  };
};

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  activeFilePath?: string;
  activeSessionId?: string | null;
  activeSessionTitle?: string;
  activeContinuumSnapshot?: any;
  activeProvider?: string;
  activeModel?: string;
  selectionInfo?: {
    text: string;
    startLineNumber: number;
    endLineNumber: number;
    startColumn?: number;
    endColumn?: number;
  } | null;
  cursorPos?: { line: number; col: number } | null;
  gitBranch?: string;
  diagnostic?: TerminalDiagnostic | null;
  initialTask?: string;
  initialImportedCapsule?: any;
  externalTaskInput?: string;
  taskToExecute?: { prompt: string; id: string | number; providerId?: string; modelId?: string } | null;
  onTaskExecuted?: () => void;
  onExecutingChange?: (isExecuting: boolean) => void;
  onPreviewDiff?: (edit: ProposedEdit) => void;
  onApplyStep?: (step: AgentStep) => Promise<boolean>;
  onApplyAllApproved?: (steps: AgentStep[], createCommit: boolean, verifyCmd: string) => Promise<void>;
  runningCommandOutput?: string;
  isDocked?: boolean;
  className?: string;
  onSelectVerificationTab?: () => void;
  onRequireApiKey?: (pendingAction?: () => void) => void;
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
  activeProvider,
  activeModel,
  selectionInfo,
  cursorPos,
  gitBranch,
  diagnostic,
  initialTask,
  initialImportedCapsule,
  externalTaskInput,
  taskToExecute,
  onTaskExecuted,
  onExecutingChange,
  onPreviewDiff,
  onApplyStep,
  onApplyAllApproved,
  runningCommandOutput,
  isDocked = false,
  className,
  onSelectVerificationTab,
  onRequireApiKey,
}: AgentPanelProps) {
  const [taskInput, setTaskInput] = useState(externalTaskInput || "");
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
  const agentModelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const agentModelDropdownRef = useOutsideClick<HTMLDivElement>({
    isOpen: showModelDropdown,
    onClose: () => setShowModelDropdown(false),
    triggerRef: agentModelTriggerRef,
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyValidationMsg, setKeyValidationMsg] = useState("");
  const [validatingKey, setValidatingKey] = useState(false);
  const [conflictResolverOpen, setConflictResolverOpen] = useState(false);
  const [activeConflicts, setActiveConflicts] = useState<ConflictItem[]>([]);
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
  const [harnessThreadId, setHarnessThreadId] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    callId: string;
    toolName: string;
    policyDecision?: any;
    error?: string;
    changeSet?: any;
    turnId?: string | null;
  } | null>(null);

  const [continuumActive, setContinuumActive] = useState<boolean>(false);
  const [isActivatingContinuum, setIsActivatingContinuum] = useState<boolean>(false);

  const swarmActivity = useSwarmActivity({
    threadId: harnessThreadId || activeSessionId || null,
  });

  // Sync harnessThreadId with activeSessionId and clean up on new task / chat reset
  useEffect(() => {
    setHarnessThreadId(activeSessionId || null);
    if (!activeSessionId) {
      setMessages([]);
      setResult(null);
      setSteps([]);
      setPendingApproval(null);
      setLocalSnapshot(null);
      setContinuumActive(false);
      setActiveContinuumContextText("");
      setImportedCapsule(null);
      setCapsuleWarning(null);
      setContextMetrics(null);
      setSuppressedLevel(null);
    }
  }, [activeSessionId]);

  // Subscribe to push events from the new Codex Harness Event Stream
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.onEvent) {
      const unsubscribe = (window as any).electronAPI.harness.onEvent((event: any) => {
        if (!event) return;
        const { type, payload, turnId, threadId } = event;

        if (threadId) {
          setHarnessThreadId((prev) => prev || threadId);
        }

        if (type && type.startsWith("SWARM_")) {
          setAutonomousState((prev) => ({
            ...prev,
            stage: type.replace("SWARM_", "SWARM "),
            activeRole: "Swarm Orchestrator",
          }));
        }

        if (type === "TURN_STARTED") {
          setLoading(true);
          setActiveTurnId(turnId);
          setAutonomousState((prev) => ({ ...prev, stage: "PLANNING" }));
        } else if (type === "TURN_UPDATED") {
          const st = payload?.status || payload?.turn?.status;
          if (st === "WAITING_FOR_APPROVAL") {
            setAutonomousState((prev) => ({ ...prev, stage: "WAITING_FOR_APPROVAL" }));
          } else if (st === "RUNNING") {
            setAutonomousState((prev) => ({ ...prev, stage: "RUNNING" }));
          }
        } else if (type === "ITEM_STARTED" || type === "ITEM_UPDATED" || type === "ITEM_COMPLETED") {
          const item = payload?.item || {};
          if (item.type === "TOOL_CALL") {
            const tc = item.payload || {};
            const stepTitle = tc.toolName ? `Execute ${tc.toolName}` : "Running Tool";
            const stepReason = tc.arguments ? (typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments)) : "";
            setSteps((prev) => {
              const exists = prev.find((s) => s.id === item.itemId || s.id === tc.callId);
              if (exists) return prev;
              return [
                ...prev,
                {
                  id: item.itemId || tc.callId || `step_${Date.now()}`,
                  title: stepTitle,
                  reasoning: stepReason,
                  filesRead: tc.arguments?.path ? [tc.arguments.path] : [],
                  proposedEdits: [],
                  status: "pending",
                },
              ];
            });
            setExpandedSteps((prev) => ({ ...prev, [item.itemId || tc.callId]: true }));
            setAutonomousState((prev) => ({ ...prev, stage: "CODE", activeRole: tc.toolName }));
          } else if (item.type === "TOOL_RESULT") {
            const tr = item.payload || {};
            setSteps((prev) =>
              prev.map((s) => {
                if (s.id === item.itemId || (tr.callId && s.id.includes(tr.callId))) {
                  return { ...s, status: tr.success ? "applied" : "error" };
                }
                return s;
              })
            );
          } else if (item.type === "CHANGE_SET") {
            const cs = item.payload || {};
            if (Array.isArray(cs.files) && cs.files.length > 0) {
              const newSteps: AgentStep[] = cs.files.map((f: any, fIdx: number) => {
                const stepId = `${item.itemId || cs.changeSetId || 'cs'}_file_${fIdx}`;
                const edit: ProposedEdit = {
                  filePath: f.filePath,
                  original: f.original || f.originalContent || "",
                  replacement: f.replacement || f.content || "",
                };
                return {
                  id: stepId,
                  title: `Stage ChangeSet: ${f.filePath}`,
                  reasoning: `Staged in ChangeSet ${cs.changeSetId || ''} (${f.changeType || 'MODIFY'}) — Pending approval before applying to disk.`,
                  filesRead: [f.filePath],
                  proposedEdits: [edit],
                  firewallResult: f.firewallResult || cs.risk || { risk_level: 'AUTO_APPROVE', risk_score: 0, safe_to_auto_apply: true },
                  status: cs.status === 'applied' ? ('applied' as const) : ('pending' as const),
                };
              });
              setSteps((prev) => {
                const filtered = prev.filter((s) => !s.id.startsWith(item.itemId || cs.changeSetId || 'cs'));
                return [...filtered, ...newSteps];
              });
              const expUpdates: Record<string, boolean> = {};
              newSteps.forEach((s: AgentStep) => (expUpdates[s.id] = true));
              setExpandedSteps((prev) => ({ ...prev, ...expUpdates }));
            }
          } else if (item.type === "FILE_CHANGE") {
            const fc = item.payload || {};
            if (fc.filePath) {
              const newEdit: ProposedEdit = {
                filePath: fc.filePath,
                original: fc.original || "",
                replacement: fc.replacement || "",
              };
              setSteps((prev) => {
                const matched = prev.find((s) => s.proposedEdits?.some((e) => e.filePath === fc.filePath));
                if (matched) {
                  return prev.map((s) => (s.id === matched.id ? { ...s, status: 'applied' as const, firewallResult: fc.firewall || s.firewallResult } : s));
                }
                return [
                  ...prev,
                  {
                    id: item.itemId || `change_${Date.now()}`,
                    title: `Apply Patch on ${fc.filePath}`,
                    reasoning: "Transactional code modification applied",
                    filesRead: [fc.filePath],
                    proposedEdits: [newEdit],
                    firewallResult: fc.firewall,
                    status: "applied" as const,
                  },
                ];
              });
            }
          } else if (item.type === "APPROVAL_REQUEST") {
            const ar = item.payload || {};
            setPendingApproval({
              callId: ar.callId,
              toolName: ar.toolName,
              policyDecision: ar.policyDecision,
              error: ar.error,
              changeSet: ar.changeSet,
              turnId: turnId || activeTurnId,
            });
            setAutonomousState((prev) => ({ ...prev, stage: "WAITING_FOR_APPROVAL" }));
            if (ar.changeSet?.files && Array.isArray(ar.changeSet.files) && ar.changeSet.files.length > 0) {
              const newSteps: AgentStep[] = ar.changeSet.files.map((f: any, fIdx: number) => {
                const stepId = `approval_cs_file_${fIdx}`;
                const edit: ProposedEdit = {
                  filePath: f.filePath,
                  original: f.original || f.originalContent || "",
                  replacement: f.replacement || f.content || "",
                };
                return {
                  id: stepId,
                  title: `Proposed Change: ${f.filePath}`,
                  reasoning: `ChangeSet ${ar.changeSet.changeSetId || ''} staged — Authorization required to apply.`,
                  filesRead: [f.filePath],
                  proposedEdits: [edit],
                  firewallResult: f.firewallResult || ar.policyDecision || { risk_level: 'MANUAL_APPROVAL_REQUIRED', risk_score: 50 },
                  status: 'pending' as const,
                };
              });
              setSteps((prev) => {
                const hasEdits = prev.some((s) => s.proposedEdits?.length > 0);
                if (hasEdits) return prev;
                return [...prev, ...newSteps];
              });
              const expUpdates: Record<string, boolean> = {};
              newSteps.forEach((s: AgentStep) => (expUpdates[s.id] = true));
              setExpandedSteps((prev) => ({ ...prev, ...expUpdates }));
            }
          } else if (item.type === "AGENT_MESSAGE") {
            const am = item.payload || {};
            const textContent = am.text || am.summary || payload?.text || "";
            const currentTurnId = turnId || activeTurnId;

            setMessages((prev) => {
              const matchIdx = prev.findIndex(
                (m) => m.id === item.itemId || (currentTurnId && m.turnId === currentTurnId && m.role === "agent")
              );

              const msgObj: AgentMessage = {
                id: item.itemId || (currentTurnId ? `agent_${currentTurnId}` : `agent_${Date.now()}`),
                role: "agent",
                content: textContent,
                timestamp: matchIdx >= 0 ? prev[matchIdx].timestamp : Date.now(),
                turnId: currentTurnId || undefined,
                status: type === "ITEM_COMPLETED" ? "VERIFIED" : "STREAMING",
                execution: {
                  providerId: aiConfig?.activeProvider || "groq",
                  modelId: aiConfig?.activeModel || "llama-3.3-70b-versatile",
                },
                steps: matchIdx >= 0 ? prev[matchIdx].steps : undefined,
              };

              if (matchIdx >= 0) {
                const updated = [...prev];
                updated[matchIdx] = { ...updated[matchIdx], ...msgObj };
                return updated;
              }

              return [...prev, msgObj];
            });

            if (type === "ITEM_COMPLETED") {
              setAutonomousState((prev) => ({ ...prev, stage: "VERIFICATION" }));
            }
          }
        } else if (type === "TURN_COMPLETED") {
          setLoading(false);
          setPendingApproval(null);
          setActiveTurnId(null);
          setAutonomousState((prev) => ({ ...prev, stage: "COMPLETED" }));
        } else if (type === "TURN_FAILED" || type === "HARNESS_ERROR") {
          setLoading(false);
          setPendingApproval(null);
          setAutonomousState((prev) => ({ ...prev, stage: "FAILED" }));
        }
      });

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, [aiConfig]);

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
    if (activeTurnId && typeof window !== "undefined" && (window as any).electronAPI?.harness?.cancelTurn) {
      try {
        await (window as any).electronAPI.harness.cancelTurn({ turnId: activeTurnId });
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to cancel harness turn:", e);
      }
    }
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
  const executedTaskRef = useRef<string | number | null>(null);
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
        if (config) setAiConfig(config);
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to fetch AI config:", e);
      }
    }
  };

  useEffect(() => {
    fetchAiConfig();

    let unsubscribeIpc: (() => void) | null = null;
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.onConfigChange) {
      unsubscribeIpc = (window as any).electronAPI.ai.onConfigChange((cfg: any) => {
        if (cfg) setAiConfig(cfg);
      });
    }

    const handleDomConfigChange = () => {
      fetchAiConfig();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("nexus:ai-config-changed", handleDomConfigChange);
    }

    return () => {
      if (typeof unsubscribeIpc === "function") unsubscribeIpc();
      if (typeof window !== "undefined") {
        window.removeEventListener("nexus:ai-config-changed", handleDomConfigChange);
      }
    };
  }, []);

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      try {
        await (window as any).electronAPI.ai.setConfig(providerId, modelId);
        fetchAiConfig();
      } catch (e) {
        console.error("[AGENT-PANEL] Failed to set model config:", e);
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexus:ai-config-changed", { detail: { providerId, modelId } }));
    }
    setShowModelDropdown(false);
  };

  const handleSaveApiKey = async (providerId?: string) => {
    if (!apiKeyInput.trim()) return;
    const targetProviderId = providerId || aiConfig?.activeProvider || "gemini";
    setValidatingKey(true);
    setKeyValidationMsg("");
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setApiKey) {
        const res = await (window as any).electronAPI.ai.setApiKey(targetProviderId, apiKeyInput.trim());
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

  const handleRemoveApiKey = async (providerId?: string) => {
    const targetProviderId = providerId || aiConfig?.activeProvider || "gemini";
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.removeApiKey) {
        await (window as any).electronAPI.ai.removeApiKey(targetProviderId);
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

  const handleToggleContinuum = async () => {
    if (continuumActive) {
      setContinuumActive(false);
      setActiveContinuumContextText("");
      setLocalSnapshot(null);
      return;
    }

    setIsActivatingContinuum(true);
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.generateHandoff) {
        const res = await (window as any).electronAPI.continuum.generateHandoff({ workspacePath });
        if (res && res.success) {
          setContinuumActive(true);
          setActiveContinuumContextText(res.handoffText || res.contextText || "");
          if (res.snapshot) {
            setLocalSnapshot(res.snapshot);
          } else if ((window as any).electronAPI?.continuum?.getLatest) {
            const latest = await (window as any).electronAPI.continuum.getLatest(workspacePath);
            if (latest) setLocalSnapshot(latest);
          }
        } else if ((window as any).electronAPI?.continuum?.getLatest) {
          const latest = await (window as any).electronAPI.continuum.getLatest(workspacePath);
          if (latest) {
            setLocalSnapshot(latest);
            setContinuumActive(true);
            if ((window as any).electronAPI?.continuum?.buildContext) {
              const built = await (window as any).electronAPI.continuum.buildContext(latest);
              if (built?.success) setActiveContinuumContextText(built.handoffText || built.contextText || "");
            }
          }
        }
      }
    } catch (err) {
      console.error("[AGENT-PANEL] Failed to activate Continuum Lineage:", err);
    } finally {
      setIsActivatingContinuum(false);
    }
  };

  // Context Capsule State & Handler (Phase 3 - Strictly Independent)
  type CapsuleCreationStatus = "IDLE" | "PROCESSING" | "SUCCESS" | "FAILED";
  const [capsuleCreationStatus, setCapsuleCreationStatus] = useState<CapsuleCreationStatus>("IDLE");
  const [isCreatingCapsule, setIsCreatingCapsule] = useState<boolean>(false);
  const [capsuleFeedback, setCapsuleFeedback] = useState<{
    type: "success" | "error";
    title?: string;
    capsuleId?: string;
    capsuleRef?: string;
    retainedExchangesCount?: number;
    message?: string;
    createdAt?: number;
    capsule?: any;
  } | null>(null);
  const [showCapsuleDetail, setShowCapsuleDetail] = useState<boolean>(false);
  const [isCopiedRef, setIsCopiedRef] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const capsuleFeedbackRef = useRef<HTMLDivElement>(null);

  const handleCopyReference = (refText?: string) => {
    if (!refText) return;
    navigator.clipboard.writeText(refText);
    setIsCopiedRef(true);
    setTimeout(() => setIsCopiedRef(false), 2000);
  };

  // Authoritative active chat derivation: Enabled when active thread/session exists or conversation messages are visible
  const hasActiveChat = Boolean(
    harnessThreadId ||
    activeSessionId ||
    (messages && messages.length > 0) ||
    result ||
    (taskToExecute && taskToExecute.prompt)
  );
  const isCapsuleCreateDisabled = isCreatingCapsule || capsuleCreationStatus === "PROCESSING" || !hasActiveChat;

  useEffect(() => {
    if (capsuleFeedback && (capsuleCreationStatus === "SUCCESS" || capsuleCreationStatus === "FAILED")) {
      capsuleFeedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [capsuleFeedback, capsuleCreationStatus]);

  const handleCreateCapsule = async () => {
    if (isCreatingCapsule || capsuleCreationStatus === "PROCESSING") {
      return;
    }

    setCapsuleCreationStatus("PROCESSING");
    setIsCreatingCapsule(true);
    setCapsuleFeedback(null);
    setShowCapsuleDetail(false);
    setIsCopiedRef(false);

    let threadIdToUse = harnessThreadId || activeSessionId;

    // Fallback: Check if messages contain a turnId to resolve active threadId if not yet in state
    if (!threadIdToUse && typeof window !== "undefined") {
      const msgWithTurn = messages.find((m) => m.turnId);
      if (msgWithTurn?.turnId && (window as any).electronAPI?.harness?.getTurn) {
        try {
          const turnData = await (window as any).electronAPI.harness.getTurn(msgWithTurn.turnId);
          if (turnData?.threadId) {
            threadIdToUse = turnData.threadId;
            setHarnessThreadId(turnData.threadId || null);
          }
        } catch (e) {}
      }

      // If still not resolved but visible conversation exists, create/sync thread in harness
      if (!threadIdToUse && (window as any).electronAPI?.harness?.createThread && messages.length > 0) {
        try {
          const firstUserMsg = messages.find((m) => m.role === "user");
          const promptText = firstUserMsg?.content || activeSessionTitle || initialTask || "Active Task Session";
          const newThread = await (window as any).electronAPI.harness.createThread({
            userInput: promptText,
            workspacePath,
            metadata: {
              workspacePath,
              activeFilePath,
              title: promptText,
              providerId: activeProvider || aiConfig?.activeProvider || "nexus1",
              modelId: activeModel || aiConfig?.activeModel || "gemini-2.5-flash",
            },
          });
          if (newThread?.threadId) {
            threadIdToUse = newThread.threadId;
            setHarnessThreadId(newThread.threadId || null);
          }
        } catch (e) {}
      }
    }

    if (!threadIdToUse) {
      setCapsuleCreationStatus("FAILED");
      setCapsuleFeedback({
        type: "error",
        message: "A chat thread must exist first before creating a Context Capsule.",
      });
      setIsCreatingCapsule(false);
      return;
    }

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.capsule?.createCapsule) {
        const res = await (window as any).electronAPI.capsule.createCapsule(threadIdToUse, { workspacePath });
        if (res && res.success === true && res.capsuleId) {
          setSuppressedLevel(null);
          setCapsuleCreationStatus("SUCCESS");
          const refString = res.capsuleRef || res.capsule?.capsule_ref || `#CC${res.capsuleId?.slice(-6).toUpperCase()}` || "#CC7F3A2B";
          setCapsuleFeedback({
            type: "success",
            title: res.title || "Context Capsule",
            capsuleId: res.capsuleId,
            capsuleRef: refString,
            retainedExchangesCount: res.retainedExchangesCount ?? 0,
            createdAt: res.createdAt,
            capsule: res.capsule,
          });
        } else {
          setCapsuleCreationStatus("FAILED");
          setCapsuleFeedback({
            type: "error",
            message: res?.error || "Failed to create Context Capsule",
          });
        }
      } else {
        setCapsuleCreationStatus("FAILED");
        setCapsuleFeedback({
          type: "error",
          message: "Capsule IPC bridge is unavailable in this environment.",
        });
      }
    } catch (err: any) {
      setCapsuleCreationStatus("FAILED");
      setCapsuleFeedback({
        type: "error",
        message: err?.message || "Failed to create Context Capsule",
      });
    } finally {
      setIsCreatingCapsule(false);
    }
  };

  // Context Capsule Import State & Handlers (Phase 4 - Continuation Context)
  const [importedCapsule, setImportedCapsule] = useState<any | null>(initialImportedCapsule || null);
  const [capsuleWarning, setCapsuleWarning] = useState<string | null>(null);

  useEffect(() => {
    if (initialImportedCapsule) {
      setImportedCapsule(initialImportedCapsule);
      const prompt = generateContinuationPrompt(initialImportedCapsule);
      if (prompt && !taskInput.trim()) {
        setTaskInput(prompt);
      }
    }
  }, [initialImportedCapsule]);

  const handleCapsuleDropped = (capsule: any, fileName?: string) => {
    if (messages.length > 0) {
      setCapsuleWarning("Attaching Context Capsule to an ongoing conversation. The model will receive this capsule as continuation context alongside current chat history.");
    } else {
      setCapsuleWarning(null);
    }
    setImportedCapsule(capsule);
    const prompt = generateContinuationPrompt(capsule);
    if (prompt) {
      setTaskInput(prompt);
    }
    setCapsuleFeedback({
      type: "success",
      title: capsule.source_chat?.title || fileName || "Imported Context Capsule",
      capsuleId: capsule.capsule_id,
      capsuleRef: capsule.capsule_ref || (capsule.capsule_id ? `#CC${capsule.capsule_id.slice(-6).toUpperCase()}` : "#CC"),
      retainedExchangesCount: capsule.conversation_context?.last_exchanges?.length || 0,
      capsule,
    });
  };

  const handleOpenCapsuleDialog = () => {
    setIsImportModalOpen(true);
  };

  // Context Budget Awareness State (Phase 5 - Independent Context Monitoring)
  const [contextMetrics, setContextMetrics] = useState<{
    totalEstimatedTokens: number;
    budgetLimitTokens: number;
    percentage: number;
    level: "NORMAL" | "APPROACHING" | "CRITICAL";
  } | null>(null);
  const [suppressedLevel, setSuppressedLevel] = useState<"APPROACHING" | "CRITICAL" | null>(null);

  // Compute effective display metrics
  const estimatedTokenCount = contextMetrics?.totalEstimatedTokens ?? (
    messages.reduce((acc, m) => acc + (m.content ? Math.ceil(m.content.length / 4) : 0), 0) +
    (importedCapsule ? 400 : 0) + 600
  );
  const effectiveLimit = contextMetrics?.budgetLimitTokens || 6000;
  const displayPercentage = contextMetrics?.percentage ?? Math.min(100, Math.round((estimatedTokenCount / effectiveLimit) * 100));
  const displayLevel = contextMetrics?.level ?? (displayPercentage >= 90 ? "CRITICAL" : displayPercentage >= 75 ? "APPROACHING" : "NORMAL");



  // Hydrate visible conversation ONLY when explicitly resuming an existing session thread with activeSessionId
  useEffect(() => {
    if (activeSessionId && currentSnapshot?.conversation?.recentTurns) {
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
                modelId: turn.modelId || currentSnapshot?.aiState?.modelName || "gemini-2.5-flash",
                isFallback: false,
              },
            });
          }
        });

        setMessages(hydratedMessages);
      }
    }
  }, [currentSnapshot, activeSessionId]);

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
    if (externalTaskInput !== undefined && externalTaskInput !== taskInput) {
      setTaskInput(externalTaskInput);
    }
  }, [externalTaskInput]);

  useEffect(() => {
    if (taskToExecute && taskToExecute.prompt && taskToExecute.prompt.trim()) {
      const taskKey = `${taskToExecute.id}_${taskToExecute.prompt.trim()}`;
      if (executedTaskRef.current !== taskKey) {
        executedTaskRef.current = taskKey;
        handleRunAgent(taskToExecute.prompt.trim(), taskToExecute.providerId, taskToExecute.modelId);
        if (onTaskExecuted) onTaskExecuted();
      }
    } else if (initialTask && initialTask.trim() && !taskToExecute) {
      if (executedTaskRef.current !== initialTask) {
        executedTaskRef.current = initialTask;
        handleRunAgent(initialTask, activeProvider, activeModel);
      }
    }
  }, [taskToExecute, initialTask]);

  useEffect(() => {
    if (onExecutingChange) {
      onExecutingChange(loading);
    }
  }, [loading]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunAgent = async (taskToRun?: string, providerIdOverride?: string, modelIdOverride?: string) => {
    if (loading) return; // Prevent concurrent duplicate task triggers
    const activeTask = taskToRun || taskInput;
    if (!activeTask || !activeTask.trim()) return;

    const effectiveProvider = providerIdOverride || activeProvider || aiConfig?.activeProvider || "nexus1";
    const effectiveModel = modelIdOverride || activeModel || aiConfig?.activeModel || "gemini-2.5-flash";

    // Check if active provider API key is configured
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        const activeProv = effectiveProvider || config?.activeProvider || "nexus1";
        const providerConfig = config?.providers?.find((p: any) => p.id === activeProv);
        const isConfigured = Boolean(providerConfig?.isConfigured && providerConfig?.status === "CONNECTED");

        if (!isConfigured) {
          if (onRequireApiKey) {
            onRequireApiKey(() => handleRunAgent(activeTask, effectiveProvider, effectiveModel));
            return;
          }
        }
      } catch (e) {}
    }

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
      let harnessRes: any = null;
      if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.handleRequest) {
        let threadIdToUse = harnessThreadId || activeSessionId;
        harnessRes = await (window as any).electronAPI.harness.handleRequest({
          userInput: activeTask,
          workspacePath,
          activeFilePath,
          selectionText: selectionInfo?.text,
          selectionStartLine: selectionInfo?.startLineNumber,
          selectionStartColumn: selectionInfo?.startColumn,
          selectionEndLine: selectionInfo?.endLineNumber,
          selectionEndColumn: selectionInfo?.endColumn,
          cursorLine: cursorPos?.line,
          cursorColumn: cursorPos?.col,
          gitBranch: gitBranch,
          diagnostic: diagnostic || null,
          providerId: effectiveProvider,
          modelId: effectiveModel,
          threadId: threadIdToUse || undefined,
          continuumSnapshot: continuumActive ? currentSnapshot : null,
          continuumContextText: continuumActive ? activeContinuumContextText : undefined,
          continuumActive: continuumActive,
          importedCapsule: importedCapsule || null,
        });

        if (harnessRes?.threadId && !harnessThreadId) {
          setHarnessThreadId(harnessRes.threadId);
        }

        if (harnessRes?.contextMetrics) {
          const m = harnessRes.contextMetrics;
          setContextMetrics({
            totalEstimatedTokens: m.totalEstimatedTokens || 0,
            budgetLimitTokens: m.budgetLimitTokens || 6000,
            percentage: m.percentage ?? Math.round(((m.totalEstimatedTokens || 0) / (m.budgetLimitTokens || 6000)) * 100),
            level: m.level || (m.percentage >= 90 ? "CRITICAL" : m.percentage >= 75 ? "APPROACHING" : "NORMAL"),
          });
        }

        if (harnessRes && harnessRes.success) {
          res = {
            success: true,
            task: activeTask,
            summary: harnessRes.finalResponse || harnessRes.response || harnessRes.summary || "Task completed successfully via Codex Harness.",
            steps: harnessRes.steps || [],
            execution: {
              providerId: harnessRes?.execution?.providerId || harnessRes?.providerId || effectiveProvider,
              modelId: harnessRes?.execution?.modelId || harnessRes?.modelId || effectiveModel,
            },
          };
          setResult(res);
        } else {
          const is429 = Boolean(
            harnessRes?.isRateLimit ||
            harnessRes?.statusCode === 429 ||
            /429|rate\s*limit/i.test(harnessRes?.error || '')
          );
          const actualProvider = harnessRes?.rateInfo?.providerId || harnessRes?.providerId || harnessRes?.execution?.providerId || effectiveProvider;
          const actualModel = harnessRes?.rateInfo?.modelId || harnessRes?.modelId || harnessRes?.execution?.modelId || effectiveModel;
          const rateInfo = harnessRes?.rateInfo ? {
            ...harnessRes.rateInfo,
            providerId: harnessRes.rateInfo.providerId || actualProvider,
            modelId: harnessRes.rateInfo.modelId || actualModel,
          } : (is429 ? {
            providerId: actualProvider,
            modelId: actualModel,
            message: harnessRes?.error || `Rate limit reached on ${actualProvider}. Please wait before trying again.`,
            retryAfter: harnessRes?.retryAfter || "5s",
          } : undefined);

          const errorMsg: AgentMessage = {
            id: agentMsgId,
            role: "agent",
            content: harnessRes?.error || "Failed to execute agent task",
            timestamp: Date.now(),
            status: "ERROR",
            isRateLimit: is429,
            rateInfo,
            turnId: harnessRes?.turnId,
            execution: {
              providerId: actualProvider,
              modelId: actualModel,
            },
          };

          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== agentMsgId);
            return [...filtered, errorMsg];
          });
          setLoading(false);
          return;
        }
      } else if (typeof window !== "undefined" && (window as any).electronAPI?.agent?.run) {
        res = await (window as any).electronAPI.agent.run({
          task: activeTask,
          workspacePath,
          activeFilePath,
          isExplicitEditorTarget: Boolean(selectionInfo?.text),
          maxSteps: 5,
          continuumSnapshot: continuumActive ? currentSnapshot : null,
          continuumContextText: continuumActive ? activeContinuumContextText : undefined,
          continuumActive: continuumActive,
          providerId: effectiveProvider,
          modelId: effectiveModel,
          selectionText: selectionInfo?.text,
          selectionLineRange: selectionInfo ? `${selectionInfo.startLineNumber}-${selectionInfo.endLineNumber}` : undefined,
        });
        setResult(res);
        setSteps(res.steps || []);
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
            providerId: effectiveProvider,
            modelId: effectiveModel,
            isFallback: false,
          },
        };
      }

      setResult(res);
      setSteps(res.steps || []);

      const expMap: Record<string, boolean> = {};
      (res.steps || []).forEach((s) => (expMap[s.id] = true));
      setExpandedSteps(expMap);

      setMessages((prev) => {
        const existingIdx = prev.findIndex((m) => {
          if (m.role !== "agent") return false;
          if (harnessRes?.turnId && m.turnId === harnessRes.turnId) return true;
          if (m.id === agentMsgId) return true;
          return false;
        });

        const targetId = existingIdx >= 0 ? prev[existingIdx].id : (harnessRes?.turnId ? `agent_${harnessRes.turnId}` : agentMsgId);

        const agentMsg: AgentMessage = {
          id: targetId,
          role: "agent",
          content: res.summary || `Constructed plan with ${res.steps?.length || 0} steps.`,
          timestamp: existingIdx >= 0 ? prev[existingIdx].timestamp : Date.now(),
          status: res.steps && res.steps.length > 0 ? "PLAN_READY" : "VERIFIED",
          execution: res.execution,
          steps: res.steps && res.steps.length > 0 ? res.steps : undefined,
          turnId: harnessRes?.turnId || activeTurnId || undefined,
        };

        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = agentMsg;
          return updated;
        }

        const lastIdx = prev.length - 1;
        if (lastIdx >= 0 && prev[lastIdx].role === "agent" && (!prev[lastIdx].steps || prev[lastIdx].steps.length === 0)) {
          const updated = [...prev];
          updated[lastIdx] = { ...agentMsg, id: prev[lastIdx].id };
          return updated;
        }

        return [...prev, agentMsg];
      });
    } catch (err: any) {
      console.error("[AGENT-PANEL] Task execution failed:", err);
      setMessages((prev) => {
        const lastAgentIdx = prev.map((m) => m.role).lastIndexOf("agent");
        const errorMsg: AgentMessage = {
          id: lastAgentIdx >= 0 ? prev[lastAgentIdx].id : agentMsgId,
          role: "agent",
          content: `Error: ${err.message || "Failed to execute agent task"}`,
          timestamp: Date.now(),
          status: "ERROR",
        };
        if (lastAgentIdx >= 0) {
          const copy = [...prev];
          copy[lastAgentIdx] = errorMsg;
          return copy;
        }
        return [...prev, errorMsg];
      });
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
      style={{
        backgroundColor: "var(--theme-surface, #08080c)",
        borderColor: "var(--theme-border, #161620)",
        color: "var(--theme-text, #f4f4f5)",
      }}
      className={
        className
          ? className
          : isDocked
          ? "w-[440px] max-w-full h-full border-l shadow-xl z-20 flex flex-col font-mono text-xs select-none shrink-0 overflow-hidden"
          : "fixed inset-y-0 right-0 w-[480px] max-w-full border-l shadow-2xl z-50 flex flex-col font-mono text-xs select-none"
      }
    >
      {/* 3A. Session Header Region */}
      <div 
        style={{
          backgroundColor: "var(--theme-surface-panel, #0b0b10)",
          borderColor: "var(--theme-border, #161620)",
        }}
        className="border-b p-2.5 space-y-1.5 shrink-0"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="tracking-wide">NEXUS AGENT</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Continuum Lineage Toggle Button */}
            <button
              onClick={handleToggleContinuum}
              disabled={isActivatingContinuum}
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                continuumActive
                  ? "bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                  : "bg-[#12121a] border-[#222234] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
              }`}
              title={continuumActive ? "Continuum Lineage Active: Inherited synthesized context from previous chat" : "Activate Continuum Lineage to synthesize and inject previous chat context"}
            >
              {isActivatingContinuum ? (
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              ) : (
                <GitBranch className={`w-3 h-3 ${continuumActive ? "text-cyan-400" : "text-zinc-500"}`} />
              )}
              <span>Continuum</span>
              <span className={`text-[8.5px] px-1 py-0.1 rounded font-mono ${
                continuumActive ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-800 text-zinc-500"
              }`}>
                {continuumActive ? "ON" : "OFF"}
              </span>
            </button>

            {/* Create Context Capsule Button (Phase 3) */}
            <button
              onClick={handleCreateCapsule}
              disabled={isCapsuleCreateDisabled}
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                isCapsuleCreateDisabled
                  ? "bg-[#0d0d14] border-[#181824] text-zinc-600 cursor-not-allowed"
                  : isCreatingCapsule
                  ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                  : "bg-[#12121a] border-[#222234] text-zinc-300 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-[#161622]"
              }`}
              title={
                !hasActiveChat
                  ? "Create Context Capsule (Requires an active chat session)"
                  : "Create Context Capsule: Package recent chat exchanges and task state"
              }
            >
              {isCreatingCapsule ? (
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              ) : (
                <Box className="w-3 h-3 text-cyan-400" />
              )}
              <span>{isCreatingCapsule ? "Creating Capsule..." : "Create Context Capsule"}</span>
            </button>

            {/* Import Context Capsule Button (Phase 4) */}
            <button
              onClick={handleOpenCapsuleDialog}
              className="px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm bg-[#12121a] border-[#222234] text-zinc-300 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-[#161622]"
              title="Import Context Capsule (.json file) to continue previous conversation context"
            >
              <Upload className="w-3 h-3 text-cyan-400" />
              <span>Import Capsule</span>
            </button>

            {/* Model Selector Dropdown Button */}
            <div className="relative">
              <button
                ref={agentModelTriggerRef}
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="px-2 py-0.5 rounded-md bg-[#12121a] border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 hover:bg-cyan-950/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors max-w-[170px]"
                title="Select Active AI Model"
              >
                <span className="truncate">
                  {aiConfig?.providers?.find((p: any) => p.id === aiConfig?.activeProvider)?.name || activeProviderName} ({aiConfig?.activeModel ? aiConfig.activeModel.split('/').pop().replace(/^models\//, '') : "Default"})
                </span>
                <ChevronDown className="w-3 h-3 text-cyan-400 shrink-0" />
              </button>

              {/* Model Dropdown Menu */}
              {showModelDropdown && (
                <div 
                  ref={agentModelDropdownRef}
                  className="absolute right-0 top-7 w-72 bg-[#0c0c14] border border-[#242436] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 text-xs font-mono text-zinc-200"
                >
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 border-b border-[#1c1c28] pb-1 flex items-center justify-between">
                    <span>AI Execution Provider & Model</span>
                    <button onClick={() => setShowModelDropdown(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {(aiConfig?.providers || [
                      { id: "gemini", name: "Gemini", status: "CONNECTED", isConfigured: true },
                      { id: "groq", name: "Groq", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "openai", name: "OpenAI", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "claude", name: "Claude", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "deepseek", name: "DeepSeek", status: "NOT_CONFIGURED", isConfigured: false },
                      { id: "grok", name: "Grok", status: "NOT_CONFIGURED", isConfigured: false },
                    ]).map((provider: any) => {
                      const isSelected = (aiConfig?.activeProvider || "gemini") === provider.id;
                      const isConnected = provider.isConfigured;

                      return (
                        <div
                          key={provider.id}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-[#111827] border-cyan-500/50 text-cyan-300"
                              : "bg-[#09090e] border-[#181824] hover:bg-[#12121c] text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => handleSelectModel(provider.id)}
                              className="flex items-center gap-1.5 font-bold text-[10.5px] hover:text-cyan-200 cursor-pointer flex-1 text-left"
                            >
                              <span>{isSelected ? "✓" : "○"}</span>
                              <span>{provider.name}</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <span className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${isConnected ? "text-emerald-400 bg-emerald-950/60" : "text-zinc-500 bg-zinc-900"}`}>
                                {isConnected ? "Ready" : "No Key"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowModelDropdown(false);
                                  if (onRequireApiKey) {
                                    onRequireApiKey();
                                  } else {
                                    setShowKeyModal(true);
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[8.5px] font-bold cursor-pointer"
                              >
                                Key
                              </button>
                            </div>
                          </div>

                          {/* Sub-models list when provider is selected */}
                          {isSelected && Array.isArray(provider.models) && provider.models.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-[#181824] space-y-0.5 max-h-40 overflow-y-auto pr-0.5">
                              {provider.models.map((m: any) => {
                                const isMSelected = aiConfig?.activeModel === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => handleSelectModel(provider.id, m.id)}
                                    className={`w-full px-1.5 py-0.5 rounded text-[9.5px] text-left flex items-center justify-between cursor-pointer ${
                                      isMSelected ? "bg-cyan-950/60 text-cyan-200 font-bold" : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                  >
                                    <span className="truncate">{m.name || m.id}</span>
                                    {isMSelected && <Check className="w-2.5 h-2.5 text-cyan-400" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
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
          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
            <span className="text-zinc-500 font-bold uppercase text-[9px]">Session:</span>
            <span className="text-zinc-200 font-bold truncate">{activeSessionTitle || "Default Workspace Session"}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Phase 5 Context Budget Indicator */}
            <div
              className={`flex items-center gap-1.5 font-mono text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                displayLevel === "CRITICAL"
                  ? "bg-rose-950/50 border-rose-500/50 text-rose-300"
                  : displayLevel === "APPROACHING"
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-[#101018] border-[#1e1e2c] text-zinc-400"
              }`}
              title={`Context Usage: ${displayPercentage}% of ${effectiveLimit} token budget limit`}
            >
              <span>Context {displayPercentage}%</span>
              <div className="w-8 h-1 bg-[#1c1c28] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    displayLevel === "CRITICAL"
                      ? "bg-rose-500"
                      : displayLevel === "APPROACHING"
                      ? "bg-amber-500"
                      : "bg-cyan-500"
                  }`}
                  style={{ width: `${Math.min(100, displayPercentage)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 text-cyan-400 font-mono text-[9.5px]">
              <FileCode className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{activeFileName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3B & 3C. Conversation Stream & Composer wrapped in CapsuleDropZone (Phase 4) */}
      <CapsuleDropZone
        onCapsuleDropped={handleCapsuleDropped}
        onError={(errMsg) => setCapsuleFeedback({ type: "error", message: errMsg })}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {/* Conversation Stream Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#060609]">
          {/* Continuum Lineage Active Banner */}
          {continuumActive && (
            <div className="p-2.5 rounded-xl bg-[#08121e] border border-cyan-500/40 text-cyan-200 text-[10.5px] space-y-1 shadow-sm">
              <div className="flex items-center justify-between font-bold text-[10px] text-cyan-400">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CONTINUUM LINEAGE ACTIVE</span>
                </div>
                <button
                  onClick={() => { setContinuumActive(false); setActiveContinuumContextText(""); }}
                  className="text-zinc-500 hover:text-zinc-300 text-[9px] cursor-pointer"
                >
                  Disable
                </button>
              </div>
              <p className="text-zinc-300 text-[10px] leading-relaxed">
                Synthesized handoff from previous chat injected into model context. Prompts will inherit project facts, architecture decisions, and current state.
              </p>
            </div>
          )}

          {/* Attached Imported Context Capsule Banner (Phase 4) */}
          {importedCapsule && (
            <CapsuleImportBanner
              capsule={importedCapsule}
              onDetach={() => {
                setImportedCapsule(null);
                setCapsuleWarning(null);
              }}
            />
          )}

          {/* Context Capsule Warning for Ongoing Chat (Phase 4) */}
          {capsuleWarning && (
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-[10px] flex items-start gap-1.5 animate-fadeIn">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Chat Continuation: </span>
                <span>{capsuleWarning}</span>
              </div>
              <button onClick={() => setCapsuleWarning(null)} className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Phase 5: Approaching Threshold Recommendation (75% - 89%) */}
          {displayLevel === "APPROACHING" && suppressedLevel !== "APPROACHING" && suppressedLevel !== "CRITICAL" && (
            <div className="p-2.5 rounded-xl bg-[#1c140a] border border-amber-500/50 text-amber-200 text-[10px] space-y-1.5 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-[10px] text-amber-300">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Context getting large ({displayPercentage}%)</span>
                </div>
                <button
                  onClick={() => setSuppressedLevel("APPROACHING")}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                  title="Dismiss recommendation"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-zinc-300 text-[9.5px] leading-relaxed">
                Memory usage is approaching recommended limits. Create a Context Capsule to preserve active decisions, state, and recent exchanges for a fresh continuation session.
              </p>
              <div className="pt-0.5">
                <button
                  onClick={handleCreateCapsule}
                  disabled={isCapsuleCreateDisabled}
                  className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 font-bold text-[9.5px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isCreatingCapsule || capsuleCreationStatus === "PROCESSING" ? (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  ) : (
                    <Box className="w-3 h-3 text-amber-400" />
                  )}
                  <span>{isCreatingCapsule || capsuleCreationStatus === "PROCESSING" ? "Creating Capsule..." : "Create Context Capsule"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase 5: Critical Threshold Warning (>= 90%) */}
          {displayLevel === "CRITICAL" && suppressedLevel !== "CRITICAL" && (
            <div className="p-2.5 rounded-xl bg-[#20080c] border border-rose-500/60 text-rose-200 text-[10.5px] space-y-1.5 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-[10px] text-rose-300">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>This conversation is approaching its context limit ({displayPercentage}%).</span>
                </div>
              </div>
              <p className="text-zinc-300 text-[9.5px] leading-relaxed">
                Earlier messages and tool results may be summarized or compacted. You can package your current task state into an independent Context Capsule and continue in a new chat.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleCreateCapsule}
                  disabled={isCapsuleCreateDisabled}
                  className="px-2.5 py-1 rounded-md bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  {isCreatingCapsule || capsuleCreationStatus === "PROCESSING" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Box className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{isCreatingCapsule || capsuleCreationStatus === "PROCESSING" ? "Creating Capsule..." : "Create Context Capsule"}</span>
                </button>
                <button
                  onClick={() => setSuppressedLevel("CRITICAL")}
                  className="px-2.5 py-1 rounded-md bg-[#161622] hover:bg-[#202030] border border-[#2e2e42] text-zinc-300 text-[10px] cursor-pointer transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}

        {/* Context Capsule Confirmation Card (Phase 3) */}
        {capsuleFeedback && capsuleFeedback.type === "success" && (
          <div
            ref={capsuleFeedbackRef}
            className="p-3 rounded-xl bg-[#09131d] border border-cyan-500/50 text-cyan-200 text-[10.5px] space-y-2 shadow-lg animate-fadeIn sticky top-2 z-20 backdrop-blur-md"
          >
            <div className="flex items-center justify-between font-bold text-[11px] text-cyan-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="tracking-wide">✓ CONTEXT CAPSULE CREATED</span>
              </div>
              <button
                onClick={() => {
                  setCapsuleFeedback(null);
                  setCapsuleCreationStatus("IDLE");
                }}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer rounded hover:bg-zinc-800/40"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Prominent Reference & Copy Card */}
            <div className="bg-[#03070e] p-2.5 rounded-lg border border-cyan-500/40 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Capsule Reference</div>
                <div className="font-mono text-sm font-extrabold text-cyan-300 tracking-wider">
                  {capsuleFeedback.capsuleRef || capsuleFeedback.capsule?.capsule_ref || `#CC${capsuleFeedback.capsuleId?.slice(-6).toUpperCase()}`}
                </div>
              </div>

              <button
                onClick={() => handleCopyReference(capsuleFeedback.capsuleRef || capsuleFeedback.capsule?.capsule_ref || `#CC${capsuleFeedback.capsuleId?.slice(-6).toUpperCase()}`)}
                className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold text-[10px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Copy Capsule Reference to clipboard"
              >
                {isCopiedRef ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span>Copy Reference</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-1.5 text-zinc-300 text-[10px] bg-[#050b12] p-2.5 rounded-lg border border-[#142336]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Title:</span>
                <span className="font-semibold text-zinc-200 truncate max-w-[220px]">
                  {capsuleFeedback.title || "Context Capsule"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Preserved exchanges:</span>
                <span className="font-mono text-zinc-200 font-bold">
                  {capsuleFeedback.retainedExchangesCount ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#101b2a]">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Saved independently
                </span>
                {capsuleFeedback.createdAt && (
                  <span className="text-zinc-500 text-[9px] font-mono">
                    {new Date(capsuleFeedback.createdAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons: [ Copy Reference ] [ View Capsule ] [ Dismiss ] */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setShowCapsuleDetail(!showCapsuleDetail)}
                className="px-2.5 py-1 rounded bg-[#102030] hover:bg-[#162c44] border border-cyan-500/40 text-cyan-300 hover:text-cyan-100 font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${showCapsuleDetail ? "rotate-90" : ""}`} />
                <span>{showCapsuleDetail ? "Hide Capsule" : "View Capsule"}</span>
              </button>

              <button
                onClick={() => {
                  setCapsuleFeedback(null);
                  setCapsuleCreationStatus("IDLE");
                }}
                className="px-2.5 py-1 rounded bg-[#161622] hover:bg-[#202030] border border-[#2e2e42] text-zinc-300 hover:text-zinc-100 text-[10px] cursor-pointer transition-colors"
              >
                Dismiss
              </button>
            </div>

            {/* Toggled Capsule Summary Details */}
            {showCapsuleDetail && capsuleFeedback.capsule && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#04080e] border border-[#142336] text-[9.5px] text-zinc-300 space-y-1.5 font-mono animate-fadeIn">
                <div>
                  <span className="text-zinc-500 font-bold">Goal: </span>
                  <span className="text-zinc-200">{capsuleFeedback.capsule.task_state?.primary_goal || "None"}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-bold">Status: </span>
                  <span className="text-zinc-200">{capsuleFeedback.capsule.task_state?.current_status || "ACTIVE"}</span>
                </div>
                {Array.isArray(capsuleFeedback.capsule.task_state?.important_decisions) &&
                  capsuleFeedback.capsule.task_state.important_decisions.length > 0 && (
                    <div>
                      <span className="text-zinc-500 font-bold">Decisions: </span>
                      <span className="text-zinc-300">
                        {capsuleFeedback.capsule.task_state.important_decisions.join(", ")}
                      </span>
                    </div>
                  )}
                {Array.isArray(capsuleFeedback.capsule.task_state?.relevant_files) &&
                  capsuleFeedback.capsule.task_state.relevant_files.length > 0 && (
                    <div>
                      <span className="text-zinc-500 font-bold">Files: </span>
                      <span className="text-cyan-400">
                        {capsuleFeedback.capsule.task_state.relevant_files.join(", ")}
                      </span>
                    </div>
                  )}
                <div>
                  <span className="text-zinc-500 font-bold">Preserved Exchanges: </span>
                  <span className="text-zinc-300">
                    {capsuleFeedback.capsule.conversation_context?.last_exchanges?.length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {capsuleFeedback && capsuleFeedback.type === "error" && (
          <div
            ref={capsuleFeedbackRef}
            className="p-3 rounded-xl bg-[#200a0a] border border-rose-500/50 text-rose-200 text-[10.5px] space-y-2 shadow-lg animate-fadeIn sticky top-2 z-20 backdrop-blur-md"
          >
            <div className="flex items-center justify-between font-bold text-[11px] text-rose-300">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="tracking-wide">✕ CONTEXT CAPSULE CREATION FAILED</span>
              </div>
              <button
                onClick={() => {
                  setCapsuleFeedback(null);
                  setCapsuleCreationStatus("IDLE");
                }}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer rounded hover:bg-zinc-800/40"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-zinc-300 text-[10px] bg-[#120606] p-2 rounded border border-rose-900/40 leading-relaxed font-mono">
              {capsuleFeedback.message || "Failed to create Context Capsule"}
            </p>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={handleCreateCapsule}
                disabled={isCapsuleCreateDisabled}
                className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              >
                <RotateCcw className="w-3 h-3 text-rose-400" />
                <span>Try Again</span>
              </button>

              <button
                onClick={() => {
                  setCapsuleFeedback(null);
                  setCapsuleCreationStatus("IDLE");
                }}
                className="px-2.5 py-1 rounded bg-[#161622] hover:bg-[#202030] border border-[#2e2e42] text-zinc-300 hover:text-zinc-100 text-[10px] cursor-pointer transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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
                <button
                  onClick={handleOpenCapsuleDialog}
                  className="p-2 rounded-lg bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-500/40 text-left text-cyan-200 hover:text-cyan-100 transition-all cursor-pointer space-y-1 col-span-2 shadow-sm"
                >
                  <div className="font-bold text-[10.5px] flex items-center justify-between text-cyan-300">
                    <div className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Import Context Capsule</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-cyan-400 opacity-60" />
                  </div>
                  <p className="text-[9.5px] text-zinc-400 font-mono">
                    Load a saved conversation capsule (.json) to continue previous context
                  </p>
                </button>
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

        {/* Swarm Multi-Agent Visualizer (Milestone 11B) */}
        {(swarmActivity.swarm || swarmActivity.tasks.length > 0) && (
          <div className="mb-3 animate-fadeIn">
            <SwarmActivityPanel
              swarm={swarmActivity.swarm}
              tasks={swarmActivity.tasks}
              selectedTaskId={swarmActivity.selectedTaskId}
              conflicts={swarmActivity.conflicts}
              changeSets={swarmActivity.changeSets}
              onSelectTask={swarmActivity.selectTask}
              onCancelSwarm={swarmActivity.cancelSwarm}
              onPreviewDiff={onPreviewDiff}
              onResolveConflicts={() => setConflictResolverOpen(true)}
            />
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
                {msg.isRateLimit ? (
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rate Limit Reached (HTTP 429)</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[9.5px] font-mono">
                        {msg.rateInfo?.providerId || msg.execution?.providerId || "groq"} • {msg.rateInfo?.modelId || msg.execution?.modelId || "model"}
                      </span>
                    </div>

                    <p className="text-amber-200/90 text-[11px] leading-relaxed">
                      {msg.rateInfo?.message || msg.content}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <div className="text-zinc-400 font-mono flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Retry after: <strong className="text-amber-300">{msg.rateInfo?.retryAfter || "5s"}</strong></span>
                      </div>

                      <button
                        onClick={() => {
                          const lastUserPrompt = messages.slice().reverse().find((m) => m.role === "user")?.content || initialTask || taskInput;
                          if (lastUserPrompt) handleRunAgent(lastUserPrompt);
                        }}
                        disabled={loading}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10.5px] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Task</span>
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="p-3 rounded-xl bg-[#0a0a10] border border-[#181826] space-y-2.5 shadow-sm">
                  {/* Agent Header Badge */}
                  <div className="flex items-center justify-between border-b border-[#141420] pb-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{msg.steps && msg.steps.length > 0 ? "Execution Plan" : "NEXUS Assistant"}</span>
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
                )}
              </div>
            )}
          </div>
        ))}

        {/* Interactive Authorization / Approval Request Banner */}
        {pendingApproval && (
          <div className="p-3 rounded-xl bg-[#1c1408] border border-amber-500/50 space-y-2 text-amber-200 font-mono text-[11px] shadow-lg animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Authorization Required: {pendingApproval.toolName}</span>
            </div>
            <p className="text-[10.5px] text-amber-100/80 leading-relaxed">
              {pendingApproval.error || pendingApproval.policyDecision?.reason || "This operation requires explicit user authorization under current safety policy."}
            </p>

            {/* Staged ChangeSet Diff / Proposed Changes in Banner */}
            {steps.filter((s) => s.proposedEdits && s.proposedEdits.length > 0).length > 0 && (
              <div className="p-2 rounded bg-[#0d0d12] border border-amber-500/30 space-y-2 my-1">
                <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold">
                  <span>Staged ChangeSet ({steps.reduce((acc, s) => acc + (s.proposedEdits?.length || 0), 0)} file edits)</span>
                  <span className="text-emerald-400">Risk: {pendingApproval.policyDecision?.risk_level || "AUTO_APPROVE"}</span>
                </div>
                {steps.map((st) => (
                  <div key={st.id} className="space-y-1">
                    {st.proposedEdits.map((pe, peIdx) => (
                      <div key={peIdx} className="flex items-center justify-between text-[10px] bg-[#07070a] p-1.5 rounded border border-zinc-800">
                        <span className="text-cyan-300 font-mono">{pe.filePath}</span>
                        <button
                          onClick={() => onPreviewDiff && onPreviewDiff(pe)}
                          className="px-2 py-0.5 rounded bg-[#101422] hover:bg-[#182034] border border-cyan-500/40 text-cyan-300 font-bold text-[9.5px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <FileCode className="w-3 h-3" />
                          <span>Review Diff</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.approveAction) {
                    await (window as any).electronAPI.harness.approveAction({ turnId: pendingApproval.turnId || activeTurnId, callId: pendingApproval.callId });
                    setPendingApproval(null);
                  }
                }}
                className="px-3 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] cursor-pointer transition-colors"
              >
                Authorize & Continue
              </button>
              <button
                onClick={async () => {
                  if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.rejectAction) {
                    await (window as any).electronAPI.harness.rejectAction({ turnId: pendingApproval.turnId || activeTurnId, callId: pendingApproval.callId, reason: "Rejected by user" });
                    setPendingApproval(null);
                  }
                }}
                className="px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] cursor-pointer transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        )}

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

        {/* Subtle Capsule Attachment Badge */}
        {importedCapsule && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Box className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="px-1.5 py-0.5 rounded bg-cyan-900/80 border border-cyan-400/40 text-cyan-200 font-bold tracking-wider shrink-0">
                {`Context Capsule ${importedCapsule.capsule_ref || (importedCapsule.capsule_id ? `#CC${importedCapsule.capsule_id.slice(-6).toUpperCase()}` : "#CC")}`}
              </span>
              <span className="font-bold text-zinc-200 truncate">Continuation context prepared</span>
            </div>
            <span className="text-[9.5px] text-emerald-400 flex items-center gap-1 font-bold shrink-0 ml-1">
              <Check className="w-3 h-3 text-emerald-400" />
              Ready to continue
            </span>
          </div>
        )}

        {/* Command Input Box */}
        <div className="relative flex items-end bg-[#12121a] border border-[#222232] focus-within:border-cyan-500/60 rounded-xl p-1.5 transition-all">
          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  handleRunAgent();
                } else if (!e.shiftKey && !importedCapsule && !taskInput.includes("\n")) {
                  e.preventDefault();
                  handleRunAgent();
                }
              }
            }}
            placeholder="Ask NEXUS about this file... (Enter to send, Shift+Enter for newline)"
            rows={importedCapsule || taskInput.includes("\n") ? 6 : 2}
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
      </CapsuleDropZone>

      {/* 3-Way ChangeSet Conflict Resolver (Milestone 16) */}
      <ChangeConflictResolver
        isOpen={conflictResolverOpen}
        conflicts={
          activeConflicts.length > 0
            ? activeConflicts
            : (swarmActivity.conflicts?.conflicts?.map((c: any, idx: number) => ({
                conflictId: `conf_${idx}`,
                filePath: c.filePath || c.file || "conflicted_file",
                baseContent: c.baseContent || "",
                parentContent: c.parentContent || c.original || "",
                incomingContent: c.incomingContent || c.replacement || "",
                conflictType: c.category || "FILE_CONFLICT",
                status: "MANUAL_REQUIRED" as const,
                hunks: [
                  {
                    hunkId: "hunk_0",
                    startLine: 1,
                    endLine: 10,
                    base: c.baseContent || "",
                    parent: c.parentContent || c.original || "",
                    incoming: c.incomingContent || c.replacement || "",
                    status: "CONFLICT" as const,
                  },
                ],
              })) || [])
        }
        workspacePath={workspacePath}
        onResolveHunk={async (conflictId, hunkId, resolution, customContent) => {
          const harness = (window as any).electronAPI?.harness;
          if (harness?.resolveConflictHunk) {
            await harness.resolveConflictHunk({
              conflictId,
              hunkId,
              resolution,
              customContent,
              context: { threadId: activeSessionId },
            });
            if (harness.listChangeConflicts) {
              const updated = await harness.listChangeConflicts();
              if (Array.isArray(updated)) setActiveConflicts(updated);
            }
          }
        }}
        onResolveFile={async (conflictId, resolution, customContent) => {
          const harness = (window as any).electronAPI?.harness;
          if (harness?.resolveFileConflict) {
            await harness.resolveFileConflict({
              conflictId,
              resolution,
              customContent,
              context: { threadId: activeSessionId },
            });
            if (harness.listChangeConflicts) {
              const updated = await harness.listChangeConflicts();
              if (Array.isArray(updated)) setActiveConflicts(updated);
            }
          }
        }}
        onApplyResolved={async () => {
          const harness = (window as any).electronAPI?.harness;
          if (harness?.applyResolvedConflicts) {
            await harness.applyResolvedConflicts({
              workspacePath,
              threadId: activeSessionId,
              autoApprove: true,
            });
            setConflictResolverOpen(false);
          }
        }}
        onCancel={() => {
          setConflictResolverOpen(false);
          const harness = (window as any).electronAPI?.harness;
          if (harness?.cancelConflictResolution) {
            harness.cancelConflictResolution({ threadId: activeSessionId });
          }
        }}
      />

      {/* NEXUS Context Capsule Reference Import Modal */}
      <CapsuleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(cap) => handleCapsuleDropped(cap, cap.source_chat?.title || "Imported Capsule")}
      />
    </div>
  );
}
