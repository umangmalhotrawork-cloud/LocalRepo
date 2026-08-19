"use client";

import React from "react";
import { 
  Bot, Cpu, ShieldCheck, Zap, Layers, Wrench, CheckCircle2, 
  Settings, Key, X, ChevronRight, Activity, Database
} from "lucide-react";

interface CodexAIControlPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: string;
  activeModel: string;
  onSelectModel: (providerId: string, modelId?: string) => void;
  onOpenApiKeyModal: () => void;
  agentStatus?: string;
  continuumSynced?: boolean;
}

export default function CodexAIControlPopover({
  isOpen,
  onClose,
  activeProvider = "gemini",
  activeModel = "gemini-1.5-flash",
  onSelectModel,
  onOpenApiKeyModal,
  agentStatus = "Idle",
  continuumSynced = true,
}: CodexAIControlPopoverProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-11 right-3 w-80 bg-[#0a0a0f] border border-[#1f1f2e] rounded-2xl shadow-2xl z-50 p-3 space-y-3 font-mono text-xs text-zinc-200 animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1c1c28] pb-2">
        <div className="flex items-center gap-2 font-bold text-cyan-300 text-xs">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>AI & Agent Control</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-0.5 rounded hover:bg-[#161622]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Active Model & Provider Selector */}
      <div className="space-y-1.5 bg-[#0e0e16] p-2 rounded-xl border border-[#1a1a26]">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Active Provider & Model</span>
          <span className="text-cyan-400 text-[9px] font-bold">LIVE</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-zinc-200">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="capitalize">{activeProvider} ({activeModel.replace("gemini-1.5-", "")})</span>
          </div>
          <button
            onClick={onOpenApiKeyModal}
            className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Key className="w-2.5 h-2.5" />
            <span>Key</span>
          </button>
        </div>
      </div>

      {/* 2. Agent Execution Mode & Approval Safety */}
      <div className="space-y-1.5 bg-[#0e0e16] p-2 rounded-xl border border-[#1a1a26]">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Capabilities & Safety Modes
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
          <div className="p-1.5 rounded-lg bg-[#08080d] border border-[#181822]">
            <div className="text-[9px] text-zinc-500 font-bold uppercase">Agent Mode</div>
            <div className="text-cyan-300 font-bold flex items-center gap-1 mt-0.5">
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Autonomous</span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[#08080d] border border-[#181822]">
            <div className="text-[9px] text-zinc-500 font-bold uppercase">Approval</div>
            <div className="text-emerald-300 font-bold flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Firewall Safe</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Intelligence Tools & Context */}
      <div className="space-y-1.5 bg-[#0e0e16] p-2 rounded-xl border border-[#1a1a26]">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>Active Intelligence Tools</span>
          <span className="text-zinc-500 text-[9px]">4 Enabled</span>
        </div>
        <div className="space-y-1 text-[10px] text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-zinc-400"><Wrench className="w-3 h-3 text-cyan-400" /> AST Analyzer & Surgery</span>
            <span className="text-emerald-400 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-zinc-400"><Activity className="w-3 h-3 text-purple-400" /> BDG Dependency Graph</span>
            <span className="text-emerald-400 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-zinc-400"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Patch Safety Firewall</span>
            <span className="text-emerald-400 font-bold">✓ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-zinc-400"><Database className="w-3 h-3 text-cyan-400" /> Continuum Lineage</span>
            <span className={continuumSynced ? "text-emerald-400 font-bold" : "text-amber-400"}>
              {continuumSynced ? "✓ Synced" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-[#181824]">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Status: <strong className="text-zinc-300">{agentStatus}</strong></span>
        </div>
        <span className="text-cyan-400 font-bold">Local-First Sandbox</span>
      </div>
    </div>
  );
}
