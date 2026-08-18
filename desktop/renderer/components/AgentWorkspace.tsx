"use client";

import React, { useState } from "react";
import { Sparkles, ArrowLeft, Square, Play, CheckCircle2, FileText, ChevronRight, ShieldCheck, Terminal } from "lucide-react";
import AgentPanel, { AgentStep, ProposedEdit } from "./AgentPanel";

interface AgentWorkspaceProps {
  workspacePath: string;
  activeFilePath?: string;
  activeTaskPrompt: string;
  onBackToHome: () => void;
  onPreviewDiff?: (edit: ProposedEdit) => void;
  onApplyStep?: (step: AgentStep) => Promise<boolean>;
  onApplyAllApproved?: (steps: AgentStep[], createCommit: boolean, verifyCmd: string) => Promise<void>;
  runningCommandOutput?: string;
  // Right-side Editor content renderer passed from parent
  editorCanvas: React.ReactNode;
}

export default function AgentWorkspace({
  workspacePath,
  activeFilePath,
  activeTaskPrompt,
  onBackToHome,
  onPreviewDiff,
  onApplyStep,
  onApplyAllApproved,
  runningCommandOutput,
  editorCanvas,
}: AgentWorkspaceProps) {
  return (
    <div className="flex-1 w-full h-full bg-[#050508] flex flex-col overflow-hidden font-sans select-none relative">
      {/* Task Header Navigation */}
      <header className="h-10 bg-[#09090d] border-b border-[#1f1f24] flex items-center justify-between px-3 text-xs font-mono shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToHome}
            className="px-2 py-1 rounded bg-[#13131a] hover:bg-[#1a1a24] text-zinc-300 hover:text-white border border-[#242430] flex items-center gap-1 text-[11px] cursor-pointer transition-all"
            title="Return to Task Home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <div className="flex items-center gap-2 min-w-0 border-l border-[#1f1f24] pl-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-zinc-500 font-bold uppercase text-[10px] shrink-0">Active Task:</span>
            <span className="text-zinc-200 font-bold truncate max-w-[400px]">
              {activeTaskPrompt || "AI Autonomous Agent Task"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Behavior Verified Safety Engine Active</span>
          </div>
        </div>
      </header>

      {/* Main Split Peer Workspace */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Left Peer: Agent Control & Interactive Reasoning (45% width) */}
        <div className="w-[45%] min-w-[380px] max-w-[600px] h-full border-r border-[#1a1a22] bg-[#08080c] flex flex-col relative z-10">
          <div className="flex-1 w-full relative [&>div]:!static [&>div]:!w-full [&>div]:!h-full [&>div]:!max-w-none [&>div]:!border-none [&>div]:!shadow-none [&>div]:!animate-none">
            <AgentPanel
              isOpen={true}
              onClose={() => {}}
              workspacePath={workspacePath}
              activeFilePath={activeFilePath}
              initialTask={activeTaskPrompt}
              onPreviewDiff={onPreviewDiff}
              onApplyStep={onApplyStep}
              onApplyAllApproved={onApplyAllApproved}
              runningCommandOutput={runningCommandOutput}
            />
          </div>
        </div>

        {/* Right Peer: Contextual Editor Canvas (55% width) */}
        <div className="flex-1 h-full bg-[#050508] relative flex flex-col overflow-hidden">
          {editorCanvas}
        </div>
      </div>
    </div>
  );
}
