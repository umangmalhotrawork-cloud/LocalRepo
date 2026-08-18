"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Play, ShieldAlert, Clock, ArrowRight, 
  FileCode, CheckCircle2, Zap, GitBranch, FolderOpen, RefreshCw, Trash2
} from "lucide-react";

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
  const [prompt, setPrompt] = useState("");
  const [recentSessions, setRecentSessions] = useState<ContinuumSnapshot[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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

  useEffect(() => {
    fetchRecentSessions();
  }, [workspacePath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onStartTask(prompt.trim());
  };

  const handlePresetClick = (presetPrompt: string) => {
    onStartTask(presetPrompt);
  };

  const formatTimeAgo = (timestamp?: number, createdAt?: string) => {
    const time = timestamp || (createdAt ? new Date(createdAt).getTime() : Date.now());
    const diffHours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex-1 w-full h-full bg-[#050508] text-zinc-100 flex flex-col items-center justify-between p-8 overflow-y-auto font-sans select-none relative">
      
      {/* Background Subtle Gradient Aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Workspace Context Info */}
      <div className="w-full max-w-3xl flex items-center justify-between text-xs font-mono text-zinc-500 z-10">
        <div className="flex items-center gap-2 bg-[#0c0c12] px-3 py-1.5 rounded-lg border border-[#1e1e28]">
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-300 font-bold max-w-[240px] truncate">{workspacePath.split("/").pop() || "Workspace"}</span>
          <button 
            onClick={onOpenFolder} 
            className="ml-2 text-[10px] text-cyan-400 hover:underline cursor-pointer"
          >
            Change
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-zinc-400">{gitBranch}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400">{fileCount} files</span>
          </div>
        </div>
      </div>

      {/* Main Task Input Section */}
      <div className="w-full max-w-2xl my-auto flex flex-col items-center z-10 space-y-6 pt-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Native Research Engine Ready</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold tracking-tight text-white">
            What are you working on?
          </h1>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Describe a goal, bug, or refactoring. Echo Nullity will inspect dependencies, plan execution, and verify behavior safely.
          </p>
        </div>

        {/* Task Input Box */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="bg-[#0b0b10] border border-cyan-500/30 focus-within:border-cyan-400 rounded-2xl p-3 shadow-2xl transition-all relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
              placeholder="Ask Echo Nullity to investigate or change code... (⌘Enter to send)"
              className="w-full h-24 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-mono"
            />
            <div className="flex items-center justify-between pt-2 border-t border-[#1a1a24]">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Behavior Verification & Patch Firewall Active</span>
              </div>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/50 cursor-pointer"
              >
                <span>Start Task</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Quick Task Presets */}
        <div className="w-full space-y-2">
          <div className="text-xs font-mono text-zinc-500 text-center">Suggested Tasks</div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <button
              onClick={() => handlePresetClick("Find redundant code in this project and safely remove it.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Find Redundant Code</div>
                <div className="text-[10px] text-zinc-500 truncate">Detect & remove unused code</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Explain the workspace architecture and core dependency flow.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Analyze Architecture</div>
                <div className="text-[10px] text-zinc-500 truncate">Explain BDG graph & flow</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Audit security vulnerabilities and hardcoded credentials.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px]">Security Audit</div>
                <div className="text-[10px] text-zinc-500 truncate">Scan credentials & risks</div>
              </div>
            </button>

            <button
              onClick={() => handlePresetClick("Fix all syntax, missing imports, and type errors.")}
              className="p-2.5 rounded-xl bg-[#0b0b12] hover:bg-[#12121e] border border-[#1e1e2a] hover:border-cyan-500/40 text-left text-zinc-300 hover:text-white transition-all flex items-center gap-2 group cursor-pointer"
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

      {/* Bottom Section: Recent Work (Continuum Sessions) */}
      <div className="w-full max-w-2xl z-10 pt-4 border-t border-[#15151c]">
        <div className="flex items-center justify-between mb-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400 font-bold">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Recent Work</span>
          </div>
          <button 
            onClick={fetchRecentSessions} 
            className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingSessions ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div className="text-center py-4 bg-[#0a0a0f] rounded-xl border border-[#181822] text-xs font-mono text-zinc-600">
            No recent work sessions found. Start a task to record progress.
          </div>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="p-2.5 rounded-xl bg-[#0a0a0f] hover:bg-[#101018] border border-[#181822] hover:border-cyan-500/30 flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-zinc-200 font-medium truncate group-hover:text-cyan-300">
                      {session.user_intent_summary || session.userGoal || "AI Agent Work Session"}
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                      <span>{formatTimeAgo(session.timestamp, session.created_at || session.createdAt)}</span>
                      {session.project_state?.active_target && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400 font-mono">{session.project_state.active_target.split("::").pop()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onContinueSession(session.id, session.user_intent_summary || session.userGoal)}
                  className="px-3 py-1 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-cyan-300" />
                  <span>Continue</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
