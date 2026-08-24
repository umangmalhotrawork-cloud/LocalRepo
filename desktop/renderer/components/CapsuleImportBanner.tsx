"use client";

import React, { useState } from "react";
import { Box, X, ChevronRight, CheckCircle2, FileCode, Layers } from "lucide-react";

interface CapsuleImportBannerProps {
  capsule: any;
  onDetach: () => void;
}

export default function CapsuleImportBanner({
  capsule,
  onDetach,
}: CapsuleImportBannerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!capsule) return null;

  const sourceTitle = capsule.source_chat?.title || "Imported Session";
  const sourceThreadId = capsule.source_chat?.thread_id || "";
  const exchangesCount = Array.isArray(capsule.conversation_context?.last_exchanges)
    ? capsule.conversation_context.last_exchanges.length
    : 0;

  const taskState = capsule.task_state || {};

  return (
    <div className="p-2.5 rounded-xl bg-[#08121e] border border-cyan-500/50 text-cyan-200 text-[10.5px] space-y-1.5 shadow-md animate-fadeIn">
      {/* Header Row */}
      <div className="flex items-center justify-between font-bold text-[10px] text-cyan-300">
        <div className="flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-cyan-400" />
          <span>✓ CONTEXT CAPSULE ATTACHED</span>
        </div>
        <button
          onClick={onDetach}
          className="text-zinc-500 hover:text-zinc-200 p-0.5 rounded hover:bg-[#142030] cursor-pointer transition-colors"
          title="Detach Context Capsule"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Info Card */}
      <div className="space-y-0.5 text-zinc-300 text-[10px]">
        <div className="flex items-center justify-between text-zinc-300">
          <div className="flex items-center gap-2 truncate max-w-[280px]">
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 font-bold tracking-wider shrink-0">
              {capsule.capsule_ref || (capsule.capsule_id ? `#CC${capsule.capsule_id.slice(-6).toUpperCase()}` : "#CC")}
            </span>
            <span className="font-bold text-zinc-100 truncate">{sourceTitle}</span>
          </div>
          <span className="font-mono text-[9px] text-zinc-500">
            {exchangesCount} exchange{exchangesCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9.5px] text-zinc-400 pt-0.5">
          <span>Base context + important context + last 3 exchanges</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Ready to continue
          </span>
        </div>
      </div>

      {/* Expandable Capsule Details */}
      <div className="pt-1 border-t border-[#142438]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[9.5px] text-cyan-400 hover:text-cyan-200 font-semibold cursor-pointer"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          <span>{isExpanded ? "Hide Capsule Details" : "View Capsule Details"}</span>
        </button>

        {isExpanded && (
          <div className="mt-1.5 p-2 rounded-lg bg-[#040810] border border-[#122236] text-[9.5px] text-zinc-300 space-y-1 font-mono">
            {sourceThreadId && (
              <div>
                <span className="text-zinc-500 font-bold">Source Thread: </span>
                <span className="text-zinc-400">{sourceThreadId}</span>
              </div>
            )}
            {capsule.conversation_context?.base_chat?.user && (
              <div>
                <span className="text-zinc-500 font-bold">Base Topic: </span>
                <span className="text-zinc-200">{capsule.conversation_context.base_chat.user}</span>
              </div>
            )}
            {taskState.primary_goal && !capsule.conversation_context?.base_chat?.user && (
              <div>
                <span className="text-zinc-500 font-bold">Original Goal: </span>
                <span className="text-zinc-200">{taskState.primary_goal}</span>
              </div>
            )}
            {taskState.current_status && (
              <div>
                <span className="text-zinc-500 font-bold">Current State: </span>
                <span className="text-zinc-300">{taskState.current_status}</span>
              </div>
            )}
            {Array.isArray(taskState.important_context) && taskState.important_context.length > 0 && (
              <div>
                <span className="text-zinc-500 font-bold">Important Context: </span>
                <span className="text-zinc-300">{taskState.important_context.join("; ")}</span>
              </div>
            )}
            {Array.isArray(taskState.important_decisions) && taskState.important_decisions.length > 0 && (
              <div>
                <span className="text-zinc-500 font-bold">Decisions: </span>
                <span className="text-zinc-300">{taskState.important_decisions.join("; ")}</span>
              </div>
            )}
            {Array.isArray(taskState.pending_work) && taskState.pending_work.length > 0 && (
              <div>
                <span className="text-zinc-500 font-bold">Pending: </span>
                <span className="text-zinc-300">{taskState.pending_work.join("; ")}</span>
              </div>
            )}
            {Array.isArray(taskState.relevant_files) && taskState.relevant_files.length > 0 && (
              <div>
                <span className="text-zinc-500 font-bold">Files: </span>
                <span className="text-cyan-400">{taskState.relevant_files.join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
