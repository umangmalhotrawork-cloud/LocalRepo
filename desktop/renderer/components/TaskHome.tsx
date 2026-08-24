"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Play, ShieldAlert, Clock, ArrowRight, 
  FileCode, CheckCircle2, Zap, GitBranch, FolderOpen, RefreshCw, Trash2,
  Layers, Plus, Cpu, Send, ShieldCheck, Bot, User, Loader2,
  AlertTriangle, RotateCcw, Upload
} from "lucide-react";
import CodexBottomComposer from "./CodexBottomComposer";
import CapsuleDropZone from "./CapsuleDropZone";
import CapsuleImportBanner from "./CapsuleImportBanner";
import CapsuleImportModal from "./CapsuleImportModal";
import { generateContinuationPrompt } from "../utils/capsulePrompt";

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
  promptValue?: string;
  onPromptChange?: (prompt: string) => void;
  isSplitOpen?: boolean;
  isExecuting?: boolean;
  onStartTask: (prompt: string, providerId?: string, modelId?: string, attachedCapsule?: any) => void;
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
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "good night",
    "how are you", "how are you doing", "how's it going", "how is it going", "how do you do",
    "what is up", "what's up", "yo", "sup", "howdy", "test", "ping",
    "who are you", "what are you", "tell me about yourself", "what is your name",
    "thank you", "thanks", "thank you so much", "thx", "ty",
    "cool", "nice", "awesome", "great", "okay", "ok", "yes", "no", "yep", "nope",
    "what can you do", "what do you do", "how can you help", "how do you work",
    "tell me about nexus", "what is nexus", "hi there", "hello there", "hey there",
    "sounds good", "that sounds good", "looks good", "that looks good", "sure", "alright",
    "i agree", "makes sense", "got it", "understood", "perfect"
  ];

  const cleanT = t.replace(/^[^\w\s]+|[^\w\s]+$/g, "").trim();
  const isDirectCasual = casualPhrases.some((phrase) => {
    return t === phrase || cleanT === phrase || t.startsWith(phrase + " ") || t.startsWith(phrase + "?") || t.startsWith(phrase + "!") || t.startsWith(phrase + ",");
  });

  const conversationalActivities = [
    "i'm working on", "i am working on", "i'm testing", "i am testing",
    "i'm trying to", "i am trying to", "i'm thinking about", "i am thinking about",
    "i'm looking at", "i am looking at", "i'm exploring", "i am exploring",
    "we are working on", "we're working on", "we are testing", "we're testing"
  ];
  const isConversationalActivity = conversationalActivities.some((pat) => t.includes(pat));

  const conversationalDiscussions = [
    "i want to discuss", "we should discuss", "let us discuss", "let's discuss",
    "i think we should", "i think we could", "we could consider", "we should consider",
    "what do you think about", "how do you feel about", "tell me more about the idea",
    "tell me more about this approach", "tell me more", "can you explain this approach",
    "can you explain the approach", "explain this approach", "what are your thoughts on",
    "lets talk about", "let's talk about", "i have an idea", "an idea for"
  ];
  const isConversationalDiscussion = conversationalDiscussions.some((pat) => t.includes(pat));

  const conceptualPrefixes = [
    "what is", "what are", "explain", "tell me about", "how does", "why is",
    "who is", "who are", "define", "how to use", "what does", "help me understand",
    "can you explain", "could you explain", "can you tell me about"
  ];
  const isConceptualQuery = conceptualPrefixes.some((prefix) => t.startsWith(prefix + " ") || t.startsWith(prefix + "?"));

  const fileExts = [".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".yaml", ".yml", ".sql", ".go", ".rs", ".java", ".cpp", ".c", ".h", ".md"];
  const hasFileExt = fileExts.some((ext) => t.includes(ext));

  const diagnosticKeywords = [
    "analyze the repository", "analyze this repository", "analyze architecture", "audit security", "audit dependencies",
    "find all typescript errors", "find all errors", "find bugs", "find bug", "inspect dependencies",
    "security audit", "vulnerability scan", "find redundant code", "find dead code", "run tests", "run the tests",
    "npm test", "pytest"
  ];
  const hasDiagnosticKeyword = diagnosticKeywords.some((kw) => t.includes(kw));

  const mutationKeywords = [
    "fix", "refactor", "modify", "patch", "repair", "rewrite", "replace", "upgrade"
  ];
  const hasMutationKeyword = mutationKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(t);
  });

  const hasActionableMutationPattern = (
    /\badd\s+(auth|authentication|jwt|endpoint|feature|middleware|test|tests|validation|method|function|class|route)\b/i.test(t) ||
    /\bimplement\s+(auth|authentication|jwt|endpoint|feature|middleware|validation|logic|caching|rule|behavior)\b/i.test(t) ||
    /\bchange\s+(this\s+behavior|the\s+behavior|the\s+logic|the\s+return|the\s+implementation)\b/i.test(t) ||
    /\bmodify\s+(the\s+function|the\s+method|the\s+class|the\s+file|this\s+function|this\s+code|this\s+file)\b/i.test(t) ||
    /\b(generate|write)\s+(unit\s+tests|tests|test\s+suite)\b/i.test(t)
  );

  if (isDirectCasual && !hasMutationKeyword && !hasActionableMutationPattern && !hasFileExt) {
    return false;
  }

  const conversationalProjectPatterns = [
    "explain what this project does", "what does this project do", "explain this project",
    "what is this project", "what is this repo", "tell me about this project",
    "tell me about this codebase", "help me understand this project", "how does authentication work"
  ];
  if (conversationalProjectPatterns.some((pat) => t.includes(pat)) && !hasMutationKeyword && !hasActionableMutationPattern && !hasFileExt) {
    return false;
  }

  if ((isConversationalActivity || isConversationalDiscussion) && !hasFileExt && !hasActionableMutationPattern) {
    return false;
  }

  if (isConceptualQuery && !hasFileExt && !hasDiagnosticKeyword && !hasMutationKeyword && !hasActionableMutationPattern) {
    return false;
  }

  if (hasFileExt || hasDiagnosticKeyword || hasMutationKeyword || hasActionableMutationPattern) {
    return true;
  }

  return false;
}

export default function TaskHome({
  workspacePath,
  activeThreadId,
  promptValue,
  onPromptChange,
  isSplitOpen = false,
  isExecuting = false,
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
  const [importedCapsule, setImportedCapsule] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatMessages([]);
    setImportedCapsule(null);
  }, [resetSignal]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, chatLoading]);

  const handleCapsuleDropped = (capsule: any) => {
    if (capsule) {
      setImportedCapsule(capsule);
      const prompt = generateContinuationPrompt(capsule);
      if (prompt && onPromptChange) {
        onPromptChange(prompt);
      }
    }
  };

  const handleOpenCapsuleDialog = () => {
    setIsImportModalOpen(true);
  };

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
    if (onPromptChange) {
      onPromptChange(presetPrompt);
    }
    onStartTask(presetPrompt, activeProvider, activeModel, importedCapsule);
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
    onStartTask(promptText.trim(), activeProvider, activeModel, importedCapsule);
  };

  const workspaceName = workspacePath ? workspacePath.split("/").pop() || "NEXUS" : "NEXUS";

  return (
    <CapsuleDropZone
      onCapsuleDropped={handleCapsuleDropped}
      className={`flex-1 w-full h-full flex flex-col items-center justify-between ${isSplitOpen ? "p-4" : "p-6"} overflow-y-auto font-sans select-none relative`}
      style={{
        backgroundColor: "var(--theme-background, #050505)",
        color: "var(--theme-text, #f4f4f5)",
      }}
    >
      
      {/* Background Aura */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] blur-[140px] rounded-full pointer-events-none opacity-20" 
        style={{ backgroundColor: "var(--theme-accent, #22d3ee)" }}
      />

      {/* Attached Imported Context Capsule Banner (if present on new chat) */}
      {importedCapsule && (
        <div className={`w-full ${isSplitOpen ? "max-w-lg" : "max-w-3xl"} z-20 pt-2`}>
          <CapsuleImportBanner
            capsule={importedCapsule}
            onDetach={() => setImportedCapsule(null)}
          />
        </div>
      )}

      {/* Main Empty State Prompt Section (Always visible on Task Home) */}
      <div className={`w-full ${isSplitOpen ? "max-w-lg" : "max-w-3xl"} my-auto flex flex-col items-center z-10 space-y-4 pt-4`}>
        <div className="text-center space-y-2.5">
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

          <h1 className={`${isSplitOpen ? "text-2xl" : "text-4xl"} font-heading font-extrabold tracking-tight transition-all`} style={{ color: "var(--theme-text, #ffffff)" }}>
            What should we build in NEXUS?
          </h1>

          <p className={`${isSplitOpen ? "text-xs max-w-sm" : "text-sm max-w-lg"} mx-auto font-mono text-[12px] transition-all`} style={{ color: "var(--theme-text-muted, #a1a1aa)" }}>
            Describe a goal, bug, or refactoring. NEXUS will inspect dependencies, plan execution, and verify behavior safely.
          </p>
        </div>

        {/* Quick Task Presets */}
        <div className={`w-full ${isSplitOpen ? "max-w-lg" : "max-w-xl"} space-y-2`}>
          <div className={`grid ${isSplitOpen ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2"} gap-2 font-mono text-xs`}>
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

            {/* Quick Import Context Capsule Action */}
            <button
              onClick={handleOpenCapsuleDialog}
              style={{
                backgroundColor: "var(--theme-surface-panel, #0b0b12)",
                borderColor: "var(--theme-border, #1e1e2a)",
                color: "var(--theme-text, #f4f4f5)",
              }}
              className={`p-2.5 rounded-xl border hover:border-cyan-500/40 text-left transition-all flex items-center gap-2.5 group cursor-pointer hover:brightness-110 ${
                isSplitOpen ? "col-span-1" : "col-span-2"
              }`}
            >
              <Upload className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Import Context Capsule</div>
                <div className="text-[10px] text-zinc-500 truncate">Attach saved session context to this new conversation</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Floating Codex Agent Composer */}
      <div className="w-full z-20 pt-4">
        <CodexBottomComposer
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          activeProvider={activeProvider}
          activeModel={activeModel}
          promptValue={promptValue}
          onPromptChange={onPromptChange}
          onSelectModel={handleSelectModel}
          onSubmitTask={handleComposerSubmit}
          onImportCapsule={handleOpenCapsuleDialog}
          onOpenContinuum={() => {
            if (recentSessions.length > 0) {
              onContinueSession(recentSessions[0].id, recentSessions[0].user_intent_summary);
            }
          }}
          onOpenFolder={onOpenFolder}
          attachedCapsule={importedCapsule}
          disabled={isExecuting}
        />
      </div>

      {/* NEXUS Context Capsule Reference Import Modal */}
      <CapsuleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleCapsuleDropped}
      />
    </CapsuleDropZone>
  );
}
