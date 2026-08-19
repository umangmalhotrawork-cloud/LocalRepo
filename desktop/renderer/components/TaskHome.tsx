"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Play, ShieldAlert, Clock, ArrowRight, 
  FileCode, CheckCircle2, Zap, GitBranch, FolderOpen, RefreshCw, Trash2,
  Layers, Plus, Cpu, Send, ShieldCheck
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

interface TaskHomeProps {
  workspacePath: string;
  onStartTask: (prompt: string) => void;
  onContinueSession: (sessionId: string, userGoal?: string) => void;
  onOpenFolder: () => void;
  gitBranch?: string;
  fileCount?: number;
}

export default function TaskHome({
  workspacePath,
  onStartTask,
  onContinueSession,
  onOpenFolder,
  gitBranch = "main",
  fileCount = 12,
}: TaskHomeProps) {
  const [recentSessions, setRecentSessions] = useState<ContinuumSnapshot[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [activeModel, setActiveModel] = useState("gemini-1.5-flash");

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
  }, [workspacePath]);

  const handlePresetClick = (presetPrompt: string) => {
    onStartTask(presetPrompt);
  };

  const handleSelectModel = (providerId: string, modelId?: string) => {
    setActiveProvider(providerId);
    if (modelId) setActiveModel(modelId);
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      (window as any).electronAPI.ai.setConfig(providerId, modelId);
    }
  };

  const formatTimeAgo = (timestamp?: number, createdAt?: string) => {
    const time = timestamp || (createdAt ? new Date(createdAt).getTime() : Date.now());
    const diffHours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const workspaceName = workspacePath ? workspacePath.split("/").pop() || "Echo Nullity" : "Echo Nullity";

  return (
    <div className="flex-1 w-full h-full bg-[#07070a] text-zinc-100 flex flex-col items-center justify-between p-6 overflow-y-auto font-sans select-none relative">
      
      {/* Background Aura */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-500/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Main Empty State Prompt Section */}
      <div className="w-full max-w-3xl my-auto flex flex-col items-center z-10 space-y-6 pt-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Echo Nullity Coding Agent Engine</span>
          </div>

          <h1 className="text-4xl font-heading font-extrabold tracking-tight text-white">
            What should we build in Echo Nullity?
          </h1>

          <p className="text-sm text-zinc-400 max-w-lg mx-auto font-mono text-[12.5px]">
            Describe a goal, bug, or refactoring. Echo Nullity will inspect dependencies, plan execution, and verify behavior safely.
          </p>
        </div>

        {/* Quick Task Presets */}
        <div className="w-full max-w-xl space-y-2">
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <button
              onClick={() => handlePresetClick("Find redundant code in this project and safely remove it.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Find Redundant Code</div>
                <div className="text-[10px] text-zinc-500 truncate">Detect & remove unused code</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Explain the workspace architecture and core dependency flow.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Analyze Architecture</div>
                <div className="text-[10px] text-zinc-500 truncate">Explain BDG graph & flow</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Audit security vulnerabilities and hardcoded credentials.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Security Audit</div>
                <div className="text-[10px] text-zinc-500 truncate">Scan credentials & risks</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Fix all syntax, missing imports, and type errors.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2.5 group cursor-pointer"
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

      {/* Bottom Floating Codex Agent Composer */}
      <div className="w-full z-20 pt-4">
        <CodexBottomComposer
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          activeProvider={activeProvider}
          activeModel={activeModel}
          onSelectModel={handleSelectModel}
          onSubmitTask={(promptText) => onStartTask(promptText)}
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
