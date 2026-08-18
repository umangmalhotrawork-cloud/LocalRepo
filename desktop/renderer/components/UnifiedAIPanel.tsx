"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import AIPanel, { AIResponsePayload } from "./AIPanel";
import AgentPanel, { AgentStep, ProposedEdit } from "./AgentPanel";

interface UnifiedAIPanelProps {
  isOpen: boolean;
  mode: "agent" | "code-action";
  onClose: () => void;
  // AIPanel props
  aiLoading: boolean;
  aiResponse: AIResponsePayload | null;
  onApplyPatch: (patch: { original: string; replacement: string }) => void;
  onPreviewDiff: (patch: { original: string; replacement: string }) => void;
  // AgentPanel props
  workspacePath: string;
  onAgentPreviewDiff: (edit: ProposedEdit) => void;
  onApplyStep: (step: AgentStep) => Promise<boolean>;
  onApplyAllApproved: (steps: AgentStep[], createCommit: boolean, verifyCmd: string) => Promise<void>;
  runningCommandOutput: string;
}

export default function UnifiedAIPanel({
  isOpen,
  mode,
  onClose,
  aiLoading,
  aiResponse,
  onApplyPatch,
  onPreviewDiff,
  workspacePath,
  onAgentPreviewDiff,
  onApplyStep,
  onApplyAllApproved,
  runningCommandOutput,
}: UnifiedAIPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] max-w-[90vw] z-50 shadow-2xl bg-[#09090c] border-l border-[#1f1f1f] flex flex-col animate-slideInRight text-xs font-mono select-none">
      {/* Title overlay - covers original titles by using absolute positioning over the reserved space */}
      <div className="absolute top-0 left-0 h-10 px-3 flex items-center gap-2 z-10 pointer-events-none">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span className="font-bold text-zinc-100 uppercase tracking-wide text-[11px]">
          AI
        </span>
        {mode === "code-action" && aiResponse?.action && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[9.5px] font-bold">
            Code Action
          </span>
        )}
      </div>

      {/* Content Wrapper - uses CSS to strip fixed positioning, expand fully, remove animations, and hide original titles while preserving controls */}
      <div className="flex-1 w-full relative [&>div]:!static [&>div]:!w-full [&>div]:!h-full [&>div]:!max-w-none [&>div]:!border-none [&>div]:!shadow-none [&>div]:!animate-none [&>div>div:first-child>div:first-child]:!opacity-0">
        {mode === "code-action" ? (
          <AIPanel
            isOpen={true}
            onClose={onClose}
            loading={aiLoading}
            response={aiResponse}
            onApplyPatch={onApplyPatch}
            onPreviewDiff={onPreviewDiff}
          />
        ) : (
          <AgentPanel
            isOpen={true}
            onClose={onClose}
            workspacePath={workspacePath}
            onPreviewDiff={onAgentPreviewDiff}
            onApplyStep={onApplyStep}
            onApplyAllApproved={onApplyAllApproved}
            runningCommandOutput={runningCommandOutput}
          />
        )}
      </div>
    </div>
  );
}
