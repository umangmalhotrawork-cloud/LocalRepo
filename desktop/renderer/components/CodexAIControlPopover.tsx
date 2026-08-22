"use client";

import React, { useState, useEffect } from "react";
import { 
  Bot, Cpu, ShieldCheck, Zap, Wrench, Key, X, Activity, Database, Check, ChevronDown
} from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface CodexAIControlPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  activeProvider: string;
  activeModel: string;
  onSelectModel: (providerId: string, modelId?: string) => void;
  onOpenApiKeyModal: (providerId?: string) => void;
  agentStatus?: string;
  continuumSynced?: boolean;
}

export default function CodexAIControlPopover({
  isOpen,
  onClose,
  triggerRef,
  activeProvider = "gemini",
  activeModel = "gemini-2.5-flash",
  onSelectModel,
  onOpenApiKeyModal,
  agentStatus = "Idle",
  continuumSynced = true,
}: CodexAIControlPopoverProps) {
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [selectedProviderTab, setSelectedProviderTab] = useState<string>(activeProvider);

  const popoverRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
    triggerRef,
  });

  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const fetchDiagnostics = async (pId: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getDiagnostics) {
      setLoadingDiag(true);
      try {
        const diag = await (window as any).electronAPI.ai.getDiagnostics(pId);
        setDiagnostics(diag);
      } catch (e) {
        console.error("[CODEX-AI-POPOVER] Diagnostics error:", e);
      } finally {
        setLoadingDiag(false);
      }
    }
  };

  const fetchConfig = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        if (config) {
          setAiConfig(config);
          if (config.activeProvider) {
            setSelectedProviderTab(config.activeProvider);
            fetchDiagnostics(config.activeProvider);
          }
        }
      } catch (e) {
        console.error("[CODEX-AI-POPOVER] Error fetching config:", e);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setSelectedProviderTab(activeProvider);
      fetchDiagnostics(activeProvider);
    }
  }, [isOpen, activeProvider]);

  if (!isOpen) return null;

  const providers = aiConfig?.providers || [
    ...[1, 2, 3, 4, 5, 6].map((slot) => ({ id: `nexus${slot}`, name: `NEXUS ${slot}`, secondaryName: "Gemini", models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }], isConfigured: slot === 1 })),
  ];

  const currentProvider = providers.find((p: any) => p.id === selectedProviderTab) || providers[0];
  const isCurrentActive = activeProvider === currentProvider?.id;
  const availableModelList = (diagnostics?.models && diagnostics.models.length > 0) ? diagnostics.models : (currentProvider.models || []);

  return (
    <div ref={popoverRef} className="absolute top-11 right-3 w-96 bg-[#0a0a0f] border border-[#1f1f2e] rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 font-mono text-xs text-zinc-200 animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1c1c28] pb-2">
        <div className="flex items-center gap-2 font-bold text-cyan-300 text-xs">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>AI & Multi-Model Engine</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-0.5 rounded hover:bg-[#161622]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Provider Tabs */}
      <div className="space-y-1.5 bg-[#0e0e16] p-2.5 rounded-xl border border-[#1a1a26]">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>AI Providers</span>
          <span className="text-cyan-400 text-[9.5px] font-bold">
            Active: <strong className="text-white capitalize">{activeProvider}</strong>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 pt-1">
          {providers.map((p: any) => {
            const isTab = selectedProviderTab === p.id;
            const isLive = activeProvider === p.id;
            const isConn = p.isConfigured;

            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProviderTab(p.id);
                  fetchDiagnostics(p.id);
                }}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between border transition-all cursor-pointer ${
                  isTab
                    ? "bg-[#181826] border-cyan-500/60 text-white shadow-sm"
                    : "bg-[#0a0a10] border-[#181822] text-zinc-400 hover:text-zinc-200 hover:bg-[#12121c]"
                }`}
              >
                <div className="flex items-center gap-1 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConn ? "bg-emerald-400" : "bg-zinc-600"}`} />
                  <span className="truncate">{p.name}</span>
                </div>
                {isLive && <span className="text-[8.5px] text-cyan-400 font-bold ml-0.5">●</span>}
              </button>
            );
          })}
        </div>

        {/* Selected Provider Details & Model Picker */}
        {currentProvider && (
          <div className="mt-2 pt-2 border-t border-[#181824] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold text-white text-[11px]">{currentProvider.name}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  currentProvider.isConfigured 
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}>
                  {currentProvider.isConfigured ? "Connected" : "Key Required"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchDiagnostics(currentProvider.id)}
                  disabled={loadingDiag}
                  className="px-2 py-0.5 rounded bg-[#161622] hover:bg-[#202030] border border-zinc-700 text-zinc-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Activity className="w-2.5 h-2.5 text-purple-400" />
                  <span>{loadingDiag ? "Checking..." : "Diagnose"}</span>
                </button>
                <button
                  onClick={() => onOpenApiKeyModal(currentProvider.id)}
                  className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>{currentProvider.isConfigured ? "Update Key" : "Configure Key"}</span>
                </button>
              </div>
            </div>

            {/* Unconfigured Slot Callout */}
            {!currentProvider.isConfigured && (
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
                <span className="text-[10px] text-cyan-300">No API key set for {currentProvider.name}</span>
                <button
                  onClick={() => onOpenApiKeyModal(currentProvider.id)}
                  className="px-2 py-0.5 rounded bg-cyan-900 hover:bg-cyan-800 text-white text-[9.5px] font-bold cursor-pointer"
                >
                  Configure API Key
                </button>
              </div>
            )}

            {/* Diagnostics Summary Card */}
            {diagnostics && (
              <div className="p-2 rounded-lg bg-[#07070c] border border-[#161622] space-y-1 text-[9.5px]">
                <div className="flex items-center justify-between text-zinc-400 font-bold">
                  <span>API Reachable: <strong className={diagnostics.reachable ? "text-emerald-400" : "text-rose-400"}>{diagnostics.reachable ? "Yes" : "No"}</strong></span>
                  <span>Auth: <strong className={diagnostics.authenticated ? "text-emerald-400" : "text-rose-400"}>{diagnostics.authenticated ? "Valid" : "Invalid/Missing"}</strong></span>
                  <span>Models: <strong className="text-cyan-400">{diagnostics.models?.length || 0}</strong></span>
                </div>
                {diagnostics.error && (
                  <div className="text-rose-400 text-[9px] truncate">{diagnostics.error}</div>
                )}
              </div>
            )}

            {/* Model Selector for current provider */}
            <div className="space-y-1">
              <div className="text-[9.5px] text-zinc-400 font-semibold flex items-center justify-between">
                <span>Select Model:</span>
                {diagnostics?.totalModels && (
                  <span className="text-zinc-500 text-[9px]">{diagnostics.totalModels} available from provider</span>
                )}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {availableModelList.map((m: any) => {
                  const isCurrentModel = isCurrentActive && activeModel === m.id;
                  const isAvailable = m.active !== false;

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(currentProvider.id, m.id);
                        setSelectedProviderTab(currentProvider.id);
                      }}
                      className={`w-full px-2 py-1 rounded-lg text-left text-[10px] flex items-center justify-between border transition-all cursor-pointer ${
                        isCurrentModel
                          ? "bg-cyan-950/50 border-cyan-500/50 text-cyan-200 font-bold"
                          : "bg-[#08080d] border-[#181822] text-zinc-300 hover:bg-[#12121a]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <span className="truncate">{m.name || m.id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-zinc-500">{isAvailable ? "Available" : "Restricted"}</span>
                        {isCurrentModel && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Agent Execution Mode & Approval Safety */}
      <div className="space-y-1.5 bg-[#0e0e16] p-2.5 rounded-xl border border-[#1a1a26]">
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
      <div className="space-y-1.5 bg-[#0e0e16] p-2.5 rounded-xl border border-[#1a1a26]">
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
