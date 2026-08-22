"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Play, ShieldAlert, Clock, ArrowRight, 
  FileCode, CheckCircle2, Zap, GitBranch, FolderOpen, RefreshCw, Trash2,
  Layers, Plus, Cpu, Send, ShieldCheck, Bot, User, Loader2,
  AlertTriangle, RotateCcw
} from "lucide-react";
import CodexBottomComposer from "./CodexBottomComposer";

interface ContinuumSnapshot {
  id: string;
  user_intent_summary?: string;
  userGoal?: string;
  project_state?: {
    active_target?: string;
  };
  activeTargetNodeId?: string;
  timestamp?: number;
  created_at?: string;
  createdAt?: string;
  sequence_number?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isRateLimit?: boolean;
  rateInfo?: {
    providerId?: string;
    modelId?: string;
    message?: string;
    retryAfter?: string;
    retryAfterMs?: number;
  };
  execution?: {
    providerId: string;
    modelId: string;
    isFallback?: boolean;
  };
}

interface TaskHomeProps {
  workspacePath: string;
  activeThreadId?: string | null;
  onStartTask: (prompt: string, providerId?: string, modelId?: string) => void;
  onContinueSession: (sessionId: string, userGoal?: string, providerId?: string) => void;
  onOpenFolder: () => void;
  gitBranch?: string;
  fileCount?: number;
  resetSignal?: number;
}

function isCodeTask(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim().toLowerCase();

  const casualPhrases = [
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
    "how are you", "how are you doing", "how's it going", "how is it going", "how do you do",
    "what is up", "what's up", "yo", "sup", "howdy", "test", "ping",
    "who are you", "what are you", "tell me about yourself", "what is your name",
    "thank you", "thanks", "thank you so much", "cool", "nice", "awesome", "great",
    "what can you do", "what do you do", "how can you help", "how do you work",
    "tell me about nexus", "what is nexus"
  ];

  const isDirectCasual = casualPhrases.some((phrase) => {
    return t === phrase || t.startsWith(phrase + " ") || t.startsWith(phrase + "?") || t.startsWith(phrase + "!") || t.startsWith(phrase + ",");
  });

  const fileExts = [".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".yaml", ".yml", ".sql", ".go", ".rs", ".java", ".cpp", ".c", ".h", ".md"];
  const hasFileExt = fileExts.some((ext) => t.includes(ext));

  const codeConstructKeywords = [
    "function", "method", "class", "variable", "import", "export", "endpoint",
    "component", "interface", "type", "decorator", "module", "package",
    "syntax error", "type error", "lint error", "bug", "stack trace", "exception",
    "unit test", "test suite", "test case", "assertion"
  ];
  const hasCodeConstruct = codeConstructKeywords.some((kw) => t.includes(kw));

  const mutationKeywords = [
    "fix", "refactor", "remove", "delete", "change", "modify",
    "apply", "implement", "rewrite", "replace", "add", "upgrade", "patch",
    "create", "build", "write", "update", "clean", "cleanup", "format", "repair",
    "integrate", "scaffold", "restructure", "optimize", "resolve", "solve"
  ];
  const hasMutationKeyword = mutationKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(t);
  });

  const diagnosticKeywords = [
    "analyze the repository", "analyze architecture", "audit security", "audit dependencies",
    "find all typescript errors", "find all errors", "find bugs", "find bug", "inspect dependencies",
    "security audit", "vulnerability scan"
  ];
  const hasDiagnosticKeyword = diagnosticKeywords.some((kw) => t.includes(kw));

  if (isDirectCasual && !hasMutationKeyword && !hasFileExt) {
    return false;
  }

  const conversationalProjectPatterns = [
    "explain what this project does", "what does this project do", "explain this project",
    "what is this project", "what is this repo", "tell me about this project",
    "tell me about this codebase", "help me understand this project", "how does authentication work"
  ];
  if (conversationalProjectPatterns.some((pat) => t.includes(pat)) && !hasMutationKeyword) {
    return false;
  }

  if (hasDiagnosticKeyword && !hasMutationKeyword) {
    return true; // Enters workbench for diagnostic analysis
  }

  if (hasMutationKeyword || hasFileExt || hasCodeConstruct) {
    return true;
  }

  return false;
}

export default function TaskHome({
  workspacePath,
  activeThreadId,
  onStartTask,
  onContinueSession,
  onOpenFolder,
  gitBranch = "main",
  fileCount = 12,
  resetSignal = 0,
}: TaskHomeProps) {
  const [recentSessions, setRecentSessions] = useState<ContinuumSnapshot[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeProvider, setActiveProvider] = useState("nexus1");
  const [activeModel, setActiveModel] = useState("gemini-2.5-flash");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatMessages([]);
  }, [resetSignal]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, chatLoading]);

  const fetchRecentSessions = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.continuum?.list) {
      setLoadingSessions(true);
      try {
        const list = await (window as any).electronAPI.continuum.list(workspacePath);
        if (Array.isArray(list)) {
          const uniqueMap = new Map<string, ContinuumSnapshot>();
          for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            const key = raw.id || raw.snapshotId || raw.sessionId || `snap_${i}_${Date.now()}`;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, {
                id: key,
                user_intent_summary: raw.user_intent_summary || raw.userGoal || "AI Agent Work Session",
                userGoal: raw.userGoal || raw.user_intent_summary,
                project_state: raw.project_state || (raw.activeTargetNodeId ? { active_target: raw.activeTargetNodeId } : undefined),
                timestamp: raw.timestamp || (raw.createdAt ? new Date(raw.createdAt).getTime() : undefined),
                created_at: raw.created_at || raw.createdAt,
                sequence_number: raw.sequence_number || raw.sequenceNumber,
              });
            }
          }
          setRecentSessions(Array.from(uniqueMap.values()).slice(0, 5));
        }
      } catch (e) {
        console.error("[TASK-HOME] Failed to load continuum list:", e);
      } finally {
        setLoadingSessions(false);
      }
    }
  };

  const fetchAiConfig = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        if (config) {
          if (config.activeProvider) setActiveProvider(config.activeProvider);
          if (config.activeModel) setActiveModel(config.activeModel);
        }
      } catch (e) {
        console.error("[TASK-HOME] Failed to load AI config:", e);
      }
    }
  };

  useEffect(() => {
    fetchRecentSessions();
    fetchAiConfig();

    let unsubscribeIpc: (() => void) | null = null;
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.onConfigChange) {
      unsubscribeIpc = (window as any).electronAPI.ai.onConfigChange((cfg: any) => {
        if (cfg?.activeProvider) setActiveProvider(cfg.activeProvider);
        if (cfg?.activeModel) setActiveModel(cfg.activeModel);
      });
    }

    const handleDomConfigChange = (e: any) => {
      if (e?.detail?.providerId) setActiveProvider(e.detail.providerId);
      if (e?.detail?.modelId) setActiveModel(e.detail.modelId);
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
  }, [workspacePath]);

  const handlePresetClick = (presetPrompt: string) => {
    handleComposerSubmit(presetPrompt);
  };

  const handleSelectModel = (providerId: string, modelId?: string) => {
    setActiveProvider(providerId);
    if (modelId) setActiveModel(modelId);
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      (window as any).electronAPI.ai.setConfig(providerId, modelId);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexus:ai-config-changed", { detail: { providerId, modelId } }));
    }
  };

  const handleComposerSubmit = async (promptText: string) => {
    if (!promptText || !promptText.trim()) return;

    // 1. Authoritative Request Classification via Codex Harness
    let isCoding = isCodeTask(promptText);
    if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.routeRequest) {
      try {
        const routeResult = await (window as any).electronAPI.harness.routeRequest({
          userInput: promptText,
          context: { workspacePath },
        });
        if (routeResult && routeResult.mode) {
          isCoding = routeResult.mode === "CODING_TASK";
        }
      } catch (e) {}
    }

    if (isCoding) {
      onStartTask(promptText, activeProvider, activeModel);
      return;
    }

    // 2. Handle CONVERSATION in-place with progressive delta streaming
    const now = Date.now();
    const userMsg: ChatMessage = {
      id: `user_${now}`,
      role: "user",
      content: promptText.trim(),
      timestamp: now,
    };

    const agentMsgId = `agent_${now + 1}`;
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    let unsubscribeHarness: (() => void) | null = null;

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.handleRequest) {
        if ((window as any).electronAPI?.harness?.onEvent) {
          unsubscribeHarness = (window as any).electronAPI.harness.onEvent((event: any) => {
            if (!event) return;
            const { type, payload } = event;
            const item = payload?.item || {};

            if (item.type === "AGENT_MESSAGE" || type.startsWith("ITEM_")) {
              const textContent = item.payload?.text || payload?.text || item.payload?.summary || "";
              if (type === "ITEM_STARTED" || type === "ITEM_UPDATED") {
                setChatMessages((prev) => {
                  const exists = prev.some((m) => m.id === agentMsgId);
                  if (!exists) {
                    return [
                      ...prev,
                      {
                        id: agentMsgId,
                        role: "agent",
                        content: textContent,
                        timestamp: Date.now(),
                        isStreaming: true,
                        execution: {
                          providerId: activeProvider,
                          modelId: activeModel,
                        },
                      },
                    ];
                  }
                  return prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, content: textContent || m.content, isStreaming: true }
                      : m
                  );
                });
              } else if (type === "ITEM_COMPLETED") {
                setChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, content: textContent || m.content, isStreaming: false }
                      : m
                  )
                );
              }
            }
          });
        }

        const res = await (window as any).electronAPI.harness.handleRequest({
          threadId: activeThreadId || undefined,
          userInput: promptText.trim(),
          workspacePath,
          activeFilePath: null,
          providerId: activeProvider,
          modelId: activeModel,
        });

        const is429 = Boolean(
          res?.isRateLimit ||
          res?.statusCode === 429 ||
          /429|rate\s*limit/i.test(res?.error || "")
        );
        const actualProvider = res?.rateInfo?.providerId || res?.execution?.providerId || res?.providerId || activeProvider;
        const actualModel = res?.rateInfo?.modelId || res?.execution?.modelId || res?.modelId || activeModel;
        const rateInfo = res?.rateInfo ? {
          ...res.rateInfo,
          providerId: res.rateInfo.providerId || actualProvider,
          modelId: res.rateInfo.modelId || actualModel,
        } : (is429 ? {
          providerId: actualProvider,
          modelId: actualModel,
          message: res?.error || `Rate limit reached on ${actualProvider}. Please wait before trying again.`,
          retryAfter: res?.retryAfter || "5s",
        } : undefined);

        const finalContent = res?.response || res?.summary || (res?.error ? `Error: ${res.error}` : (res?.success === false ? "AI provider request failed." : "No response generated."));
        setChatMessages((prev) => {
          const exists = prev.some((m) => m.id === agentMsgId);
          const msgPayload: ChatMessage = {
            id: agentMsgId,
            role: "agent",
            content: finalContent,
            timestamp: Date.now(),
            isStreaming: false,
            isRateLimit: is429,
            rateInfo,
            execution: {
              providerId: actualProvider,
              modelId: actualModel,
            },
          };
          if (exists) {
            return prev.map((m) =>
              m.id === agentMsgId ? msgPayload : m
            );
          }
          return [...prev, msgPayload];
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nexus:threads-changed", { detail: { threadId: res?.threadId } }));
        }
      } else if (typeof window !== "undefined" && (window as any).electronAPI?.agent?.run) {
        const res = await (window as any).electronAPI.agent.run({
          task: promptText.trim(),
          workspacePath,
          activeFilePath: null,
          isExplicitEditorTarget: false,
          providerId: activeProvider,
          modelId: activeModel,
        });

        const agentMsg: ChatMessage = {
          id: agentMsgId,
          role: "agent",
          content: res?.summary || res?.response || (res?.error ? `Error: ${res.error}` : "Task completed."),
          timestamp: Date.now(),
          isStreaming: false,
          execution: res?.execution,
        };
        setChatMessages((prev) => [...prev, agentMsg]);
      } else {
        const agentMsg: ChatMessage = {
          id: agentMsgId,
          role: "agent",
          content: "Hello! I am NEXUS AI Assistant. Ask me anything about this repository or describe a coding task to get started.",
          timestamp: Date.now(),
          isStreaming: false,
        };
        setChatMessages((prev) => [...prev, agentMsg]);
      }
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `agent_${Date.now()}`,
        role: "agent",
        content: `Error: ${e.message || "Failed to process request"}`,
        timestamp: Date.now(),
        isStreaming: false,
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      if (unsubscribeHarness) {
        try {
          unsubscribeHarness();
        } catch (e) {}
      }
      setChatLoading(false);
    }
  };

  const workspaceName = workspacePath ? workspacePath.split("/").pop() || "NEXUS" : "NEXUS";

  return (
    <div 
      style={{
        backgroundColor: "var(--theme-background, #050505)",
        color: "var(--theme-text, #f4f4f5)",
      }}
      className="flex-1 w-full h-full flex flex-col items-center justify-between p-6 overflow-y-auto font-sans select-none relative"
    >
      
      {/* Background Aura */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] blur-[140px] rounded-full pointer-events-none opacity-20" 
        style={{ backgroundColor: "var(--theme-accent, #22d3ee)" }}
      />

      {chatMessages.length === 0 ? (
        /* Main Empty State Prompt Section */
        <div className="w-full max-w-3xl my-auto flex flex-col items-center z-10 space-y-6 pt-6">
          <div className="text-center space-y-3">
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border"
              style={{
                backgroundColor: "var(--theme-accent-dim, rgba(34,211,238,0.15))",
                borderColor: "var(--theme-border-card, rgba(34,211,238,0.3))",
                color: "var(--theme-accent, #22d3ee)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--theme-accent, #22d3ee)" }} />
              <span>NEXUS Coding Agent Engine</span>
            </div>

            <h1 className="text-4xl font-heading font-extrabold tracking-tight" style={{ color: "var(--theme-text, #ffffff)" }}>
              What should we build in NEXUS?
            </h1>

            <p className="text-sm max-w-lg mx-auto font-mono text-[12.5px]" style={{ color: "var(--theme-text-muted, #a1a1aa)" }}>
              Describe a goal, bug, or refactoring. NEXUS will inspect dependencies, plan execution, and verify behavior safely.
            </p>
          </div>

          {/* Quick Task Presets */}
          <div className="w-full max-w-xl space-y-2">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                onClick={() => handlePresetClick("Find redundant code in this project and safely remove it.")}
                style={{
                  backgroundColor: "var(--theme-surface-panel, #0b0b12)",
                  borderColor: "var(--theme-border, #1e1e2a)",
                  color: "var(--theme-text, #f4f4f5)",
                }}
                className="p-2.5 rounded-xl border hover:border-cyan-500/40 text-left transition-all flex items-center gap-2.5 group cursor-pointer hover:brightness-110"
              >
                <Trash2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px]">Find Redundant Code</div>
                  <div className="text-[10px] text-zinc-500 truncate">Detect & remove unused code</div>
                </div>
              </button>

              <button
                onClick={() => handlePresetClick("Explain the workspace architecture and core dependency flow.")}
                style={{
                  backgroundColor: "var(--theme-surface-panel, #0b0b12)",
                  borderColor: "var(--theme-border, #1e1e2a)",
                  color: "var(--theme-text, #f4f4f5)",
                }}
                className="p-2.5 rounded-xl border hover:border-cyan-500/40 text-left transition-all flex items-center gap-2.5 group cursor-pointer hover:brightness-110"
              >
                <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px]">Analyze Architecture</div>
                  <div className="text-[10px] text-zinc-500 truncate">Explain BDG graph & flow</div>
                </div>
              </button>

              <button
                onClick={() => handlePresetClick("Audit security vulnerabilities and hardcoded credentials.")}
                style={{
                  backgroundColor: "var(--theme-surface-panel, #0b0b12)",
                  borderColor: "var(--theme-border, #1e1e2a)",
                  color: "var(--theme-text, #f4f4f5)",
                }}
                className="p-2.5 rounded-xl border hover:border-cyan-500/40 text-left transition-all flex items-center gap-2.5 group cursor-pointer hover:brightness-110"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px]">Security Audit</div>
                  <div className="text-[10px] text-zinc-500 truncate">Scan credentials & risks</div>
                </div>
              </button>

              <button
                onClick={() => handlePresetClick("Fix all syntax, missing imports, and type errors.")}
                style={{
                  backgroundColor: "var(--theme-surface-panel, #0b0b12)",
                  borderColor: "var(--theme-border, #1e1e2a)",
                  color: "var(--theme-text, #f4f4f5)",
                }}
                className="p-2.5 rounded-xl border hover:border-cyan-500/40 text-left transition-all flex items-center gap-2.5 group cursor-pointer hover:brightness-110"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px]">Fix Type Errors</div>
                  <div className="text-[10px] text-zinc-500 truncate">Check & resolve lints</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* In-Place Conversational Stream */
        <div className="w-full max-w-3xl flex-1 overflow-y-auto z-10 space-y-4 py-4 pr-1">
          {chatMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] p-3 rounded-2xl bg-[#121b2b] border border-cyan-500/30 text-cyan-100 font-sans text-[13px] shadow-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  {msg.isRateLimit ? (
                    <div className="max-w-[90%] p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 text-zinc-200 font-sans text-[13px] shadow-md space-y-3 leading-relaxed">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 text-[11px]">
                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Rate Limit Exceeded (HTTP 429)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                          {msg.rateInfo?.providerId || msg.execution?.providerId || activeProvider} • {msg.rateInfo?.modelId || msg.execution?.modelId || activeModel}
                        </span>
                      </div>

                      <p className="text-amber-200/90 text-xs">
                        {msg.rateInfo?.message || msg.content}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Retry recommended after: <strong className="text-amber-300">{msg.rateInfo?.retryAfter || "5s"}</strong></span>
                        </div>

                        <button
                          onClick={() => {
                            const lastUserPrompt = chatMessages.slice().reverse().find((m) => m.role === "user")?.content;
                            if (lastUserPrompt) handleComposerSubmit(lastUserPrompt);
                          }}
                          disabled={chatLoading}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Task</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="max-w-[90%] p-4 rounded-2xl bg-[#0a0a12] border border-[#1e1e2e] text-zinc-200 font-sans text-[13px] shadow-md space-y-2 leading-relaxed">
                    <div className="flex items-center justify-between border-b border-[#181826] pb-2 text-[11px]">
                      <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <Bot className="w-4 h-4 text-cyan-400" />
                        <span>NEXUS Assistant</span>
                      </div>
                      {msg.execution && (
                        <span className="px-2 py-0.5 rounded-full bg-[#121828] text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
                          {msg.execution.providerId} ({msg.execution.modelId})
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-300 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {chatLoading && (
            <div className="flex justify-start">
              <div className="p-3.5 rounded-2xl bg-[#0a0a12] border border-[#1e1e2e] text-cyan-400 text-xs flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="font-mono">NEXUS is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Bottom Floating Codex Agent Composer */}
      <div className="w-full z-20 pt-4">
        <CodexBottomComposer
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          activeProvider={activeProvider}
          activeModel={activeModel}
          onSelectModel={handleSelectModel}
          onSubmitTask={handleComposerSubmit}
          onOpenContinuum={() => {
            if (recentSessions.length > 0) {
              onContinueSession(recentSessions[0].id, recentSessions[0].user_intent_summary);
            }
          }}
          onOpenFolder={onOpenFolder}
        />
      </div>

    </div>
  );
}
