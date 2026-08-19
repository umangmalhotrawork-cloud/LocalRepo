"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, ShieldCheck, ChevronDown, Bot, Key, X, Loader2, Layers } from "lucide-react";

interface StatusBarProps {
  gitBranch?: string;
  activeLanguage?: string;
  activeFilePath?: string;
  sessionTitle?: string;
  errorCount?: number;
  verificationActive?: boolean;
  onOpenAiConfig?: () => void;
  activeTask?: string;
  onSelectVerificationTab?: () => void;
  onSelectAgentPanel?: () => void;
}

export default function StatusBar({
  gitBranch = "main",
  activeLanguage = "python",
  activeFilePath,
  sessionTitle,
  errorCount = 0,
  verificationActive = true,
  onOpenAiConfig,
  activeTask,
  onSelectVerificationTab,
  onSelectAgentPanel,
}: StatusBarProps) {
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyValidationMsg, setKeyValidationMsg] = useState("");
  const [validatingKey, setValidatingKey] = useState(false);

  const fetchAiConfig = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        setAiConfig(config);
      } catch (e) {
        console.error("[STATUS-BAR] Failed to fetch AI config:", e);
      }
    }
  };

  useEffect(() => {
    fetchAiConfig();
  }, []);

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      try {
        await (window as any).electronAPI.ai.setConfig(providerId, modelId);
        fetchAiConfig();
      } catch (e) {
        console.error("[STATUS-BAR] Failed to set model config:", e);
      }
    }
    setShowModelDropdown(false);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setValidatingKey(true);
    setKeyValidationMsg("");
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setApiKey) {
        const res = await (window as any).electronAPI.ai.setApiKey("gemini", apiKeyInput.trim());
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

  const handleRemoveApiKey = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.removeApiKey) {
        await (window as any).electronAPI.ai.removeApiKey("gemini");
        setApiKeyInput("");
        setKeyValidationMsg("API key removed");
        fetchAiConfig();
      }
    } catch (e) {
      console.error("[STATUS-BAR] Remove key failed:", e);
    }
  };

  const activeProvider = aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeProvider);
  const displayModelName = activeProvider ? `${activeProvider.name} Flash` : "Gemini Flash";

  return (
    <footer className="h-6 bg-[#060609] border-t border-[#161620] px-3 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none shrink-0 z-40 relative">
      {/* Left Items */}
      <div className="flex items-center gap-2.5">
        {/* Git Branch */}
        <div className="flex items-center gap-1 text-zinc-300 font-medium">
          <GitBranch className="w-3 h-3 text-cyan-400" />
          <span>{gitBranch}</span>
        </div>

        {/* CONTINUUM IMMEDIATELY TO THE RIGHT OF THE BRANCH */}
        <button
          onClick={onSelectVerificationTab}
          className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-bold cursor-pointer transition-colors px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px]"
          title="Open Continuum Session Memory & Lineage"
        >
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>Continuum</span>
        </button>

        <span className="text-[#1a1a24]">|</span>

        {/* Active Language */}
        <div className="capitalize text-zinc-400">
          {activeLanguage}
        </div>

        <span className="text-[#1a1a24]">|</span>

        {/* Diagnostics Errors Count */}
        <div className={errorCount > 0 ? "text-amber-400 font-medium" : "text-zinc-500"}>
          {errorCount} errors
        </div>

        <span className="text-[#1a1a24]">|</span>

        {/* Verification Status */}
        {verificationActive && (
          <button
            onClick={onSelectVerificationTab}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition-colors"
            title="Open Verified Engineering Trail (⌘6)"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Verification ✓</span>
          </button>
        )}

        {activeTask && (
          <>
            <span className="text-[#1a1a24]">|</span>
            <button
              onClick={onSelectAgentPanel}
              className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer transition-colors max-w-[200px] truncate"
              title={`Active Task: ${activeTask}`}
            >
              <Bot className="w-3 h-3 text-cyan-400" />
              <span className="truncate">{activeTask}</span>
            </button>
          </>
        )}

        {sessionTitle && !activeTask && (
          <>
            <span className="text-[#1a1a24]">|</span>
            <div className="text-zinc-400 truncate max-w-[220px]">
              session: <span className="text-cyan-300 font-medium">{sessionTitle}</span>
            </div>
          </>
        )}
      </div>

      {/* Right Items */}
      <div className="flex items-center gap-2.5 relative">
        {/* Global AI Model Selector */}
        <div className="relative">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0f0f16] hover:bg-cyan-950/60 border border-[#20202e] hover:border-cyan-500/40 text-cyan-300 transition-colors cursor-pointer font-bold text-[10.5px]"
            title="Global AI Model Selector"
          >
            <Bot className="w-3 h-3 text-cyan-400" />
            <span>AI: {displayModelName}</span>
            <ChevronDown className="w-3 h-3 text-cyan-400" />
          </button>

          {/* Model Selector Dropdown */}
          {showModelDropdown && (
            <div className="absolute right-0 bottom-7 w-64 bg-[#0c0c14] border border-[#262636] rounded-xl shadow-2xl z-50 p-2 space-y-2 text-xs font-mono text-zinc-200">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 border-b border-[#1c1c2a] pb-1 flex items-center justify-between">
                <span>Select AI Provider</span>
                <button onClick={() => setShowModelDropdown(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(aiConfig?.providers || [
                  { id: "gemini", name: "Gemini", status: "CONNECTED", isConfigured: true },
                  { id: "claude", name: "Claude", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "grok", name: "Grok", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "deepseek", name: "DeepSeek", status: "NOT_CONFIGURED", isConfigured: false },
                ]).map((provider: any) => {
                  const isSelected = (aiConfig?.activeProvider || "gemini") === provider.id;
                  const isConnected = provider.isConfigured;

                  return (
                    <div
                      key={provider.id}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-[#121826] border-cyan-500/50"
                          : "bg-[#08080d] border-[#181824] hover:bg-[#101018]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSelectModel(provider.id)}
                          className="flex items-center gap-1.5 font-bold text-[11px] hover:text-cyan-300 cursor-pointer flex-1 text-left"
                        >
                          <span className={isSelected ? "text-cyan-400 font-bold" : "text-zinc-300"}>
                            {isSelected ? "✓ " : "  "}{provider.name}
                          </span>
                        </button>

                        <div className="flex items-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                          <span className={`text-[9.5px] ${isConnected ? "text-emerald-400 font-bold" : "text-zinc-500"}`}>
                            {isConnected ? "Connected" : "Not configured"}
                          </span>
                        </div>
                      </div>

                      {provider.id === "gemini" && (
                        <div className="mt-1.5 pt-1 border-t border-[#181824] flex items-center justify-between">
                          <span className="text-[9.5px] text-zinc-400">Gemini Flash</span>
                          <button
                            onClick={() => {
                              setShowModelDropdown(false);
                              setShowKeyModal(true);
                            }}
                            className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Key className="w-2.5 h-2.5" />
                            <span>API Key</span>
                          </button>
                        </div>
                      )}

                      {provider.id !== "gemini" && (
                        <div className="mt-1 text-[9.5px] text-zinc-500 italic">Coming soon</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span className="text-[#1a1a24]">|</span>

        {/* Local-First Indicator */}
        <div className="text-[10px] text-zinc-500 font-semibold">
          local-first
        </div>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed bottom-8 right-3 w-80 p-3 bg-[#0c0c14] border border-cyan-500/40 rounded-xl space-y-2 text-xs font-mono shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-[#1f1f2a] pb-1.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gemini API Key Configuration</span>
            </div>
            <button onClick={() => setShowKeyModal(false)} className="text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] text-zinc-400">
              Active Key: <span className="text-cyan-300 font-bold select-all">{aiConfig?.providers?.find((p: any) => p.id === 'gemini')?.maskedKey || "Not set (Session fallback active)"}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[9.5px] text-zinc-500 font-bold uppercase">API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#141418] border border-[#27272a] focus:border-cyan-500/60 rounded-lg px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-600 outline-none text-[11px] font-mono"
              />
            </div>

            {keyValidationMsg && (
              <div className={`text-[10px] font-bold ${keyValidationMsg.includes("Connected") ? "text-emerald-400" : "text-rose-400"}`}>
                {keyValidationMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleRemoveApiKey}
                className="px-2 py-1 rounded bg-rose-950/80 border border-rose-500/30 text-rose-300 hover:bg-rose-900 text-[10px] font-bold cursor-pointer"
              >
                Remove / Disconnect
              </button>

              <button
                onClick={handleSaveApiKey}
                disabled={validatingKey || !apiKeyInput.trim()}
                className="px-3 py-1 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {validatingKey ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <span>Save / Connect</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
