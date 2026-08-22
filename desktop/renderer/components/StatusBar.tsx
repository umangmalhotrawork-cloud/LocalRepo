"use client";

import React, { useState, useEffect, useRef } from "react";
import { GitBranch, ShieldCheck, ChevronDown, Bot, Key, X, Loader2, Layers, Cpu, Check } from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

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
  onSelectSourceControl?: () => void;
  activeProvider?: string;
  activeModel?: string;
  onSelectModel?: (providerId: string, modelId?: string) => void;
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
  onSelectSourceControl,
  activeProvider,
  activeModel,
  onSelectModel,
}: StatusBarProps) {
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedKeyProviderId, setSelectedKeyProviderId] = useState("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyValidationMsg, setKeyValidationMsg] = useState("");
  const [validatingKey, setValidatingKey] = useState(false);

  const statusModelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const statusModelDropdownRef = useOutsideClick<HTMLDivElement>({
    isOpen: showModelDropdown,
    onClose: () => setShowModelDropdown(false),
    triggerRef: statusModelTriggerRef,
  });

  const statusKeyModalRef = useOutsideClick<HTMLDivElement>({
    isOpen: showKeyModal,
    onClose: () => setShowKeyModal(false),
  });

  const fetchAiConfig = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.getConfig) {
      try {
        const config = await (window as any).electronAPI.ai.getConfig();
        if (config) setAiConfig(config);
      } catch (e) {
        console.error("[STATUS-BAR] Failed to fetch AI config:", e);
      }
    }
  };

  useEffect(() => {
    fetchAiConfig();

    let unsubscribeIpc: (() => void) | null = null;
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.onConfigChange) {
      unsubscribeIpc = (window as any).electronAPI.ai.onConfigChange((cfg: any) => {
        if (cfg) setAiConfig(cfg);
      });
    }

    const handleDomConfigChange = () => {
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
  }, []);

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    if (onSelectModel) {
      onSelectModel(providerId, modelId);
    }
    if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setConfig) {
      try {
        await (window as any).electronAPI.ai.setConfig(providerId, modelId);
        fetchAiConfig();
      } catch (e) {
        console.error("[STATUS-BAR] Failed to set model config:", e);
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexus:ai-config-changed", { detail: { providerId, modelId } }));
    }
    setShowModelDropdown(false);
  };

  const handleOpenKeyModal = (providerId: string) => {
    setSelectedKeyProviderId(providerId);
    setApiKeyInput("");
    setKeyValidationMsg("");
    setShowModelDropdown(false);
    setShowKeyModal(true);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setValidatingKey(true);
    setKeyValidationMsg("");
    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setApiKey) {
        const res = await (window as any).electronAPI.ai.setApiKey(selectedKeyProviderId, apiKeyInput.trim());
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
        await (window as any).electronAPI.ai.removeApiKey(selectedKeyProviderId);
        setApiKeyInput("");
        setKeyValidationMsg("API key removed");
        fetchAiConfig();
      }
    } catch (e) {
      console.error("[STATUS-BAR] Remove key failed:", e);
    }
  };

  const currentProviderId = activeProvider || aiConfig?.activeProvider || "groq";
  const currentModelId = activeModel || aiConfig?.activeModel || "openai/gpt-oss-120b";
  const activeProviderObj = aiConfig?.providers?.find((p: any) => p.id === currentProviderId);
  const displayModelName = activeProviderObj 
    ? `${activeProviderObj.name} (${currentModelId.split('/').pop()?.replace(/^models\//, '') || currentModelId})` 
    : `Groq (${currentModelId.split('/').pop()?.replace(/^models\//, '') || currentModelId})`;

  const targetKeyProvider = aiConfig?.providers?.find((p: any) => p.id === selectedKeyProviderId) || {
    id: selectedKeyProviderId,
    name: selectedKeyProviderId,
    keyPlaceholder: "Enter key...",
  };

  return (
    <footer 
      style={{
        backgroundColor: "var(--theme-surface, #060609)",
        borderColor: "var(--theme-border, #161620)",
        color: "var(--theme-text-muted, #a1a1aa)",
      }}
      className="h-6 border-t px-3 flex items-center justify-between text-[11px] font-mono select-none shrink-0 z-40 relative"
    >
      {/* Left Items */}
      <div className="flex items-center gap-2.5">
        {/* Git Branch */}
        <button
          onClick={onSelectSourceControl}
          className="flex items-center gap-1 text-zinc-300 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
          title={`Active Branch: ${gitBranch} (Click to open Source Control)`}
        >
          <GitBranch className="w-3 h-3 text-cyan-400" />
          <span>{gitBranch}</span>
        </button>

        <span className="text-[#1a1a24]">|</span>

        {/* Verification Status */}
        <button
          onClick={onSelectVerificationTab}
          className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Open Verification Panel"
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${verificationActive ? "text-emerald-400" : "text-amber-400"}`} />
          <span className="text-zinc-300">
            {verificationActive ? "AST Verified" : "Verification Pending"}
          </span>
        </button>

        {/* Error / Diagnostics Count */}
        {errorCount > 0 && (
          <>
            <span className="text-[#1a1a24]">|</span>
            <div className="flex items-center gap-1 text-rose-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>{errorCount} {errorCount === 1 ? "Error" : "Errors"}</span>
            </div>
          </>
        )}

        {/* Active Task / Agent Status */}
        {activeTask && (
          <>
            <span className="text-[#1a1a24]">|</span>
            <button
              onClick={onSelectAgentPanel}
              className="flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 transition-colors truncate max-w-xs cursor-pointer"
              title={`Active Task: ${activeTask}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="truncate">{activeTask}</span>
            </button>
          </>
        )}
      </div>

      {/* Right Items */}
      <div className="flex items-center gap-2.5">
        {/* Active File Language */}
        {activeLanguage && (
          <div className="text-zinc-400 uppercase font-semibold text-[10px]">
            {activeLanguage}
          </div>
        )}

        <span className="text-[#1a1a24]">|</span>

        {/* Encoding */}
        <div className="text-zinc-500">
          UTF-8
        </div>

        <span className="text-[#1a1a24]">|</span>

        {/* Global Multi-Model AI Selector */}
        <div className="relative">
          <button
            ref={statusModelTriggerRef}
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0f0f16] hover:bg-cyan-950/60 border border-[#20202e] hover:border-cyan-500/40 text-cyan-300 transition-colors cursor-pointer font-bold text-[10.5px]"
            title="Global AI Model & Provider Selector"
          >
            <Bot className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[140px]">AI: {displayModelName}</span>
            <ChevronDown className="w-3 h-3 text-cyan-400 shrink-0" />
          </button>

          {/* Model Selector Dropdown */}
          {showModelDropdown && (
            <div 
              ref={statusModelDropdownRef}
              className="absolute right-0 bottom-7 w-80 bg-[#0c0c14] border border-[#262636] rounded-xl shadow-2xl z-50 p-2.5 space-y-2 text-xs font-mono text-zinc-200"
            >
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 border-b border-[#1c1c2a] pb-1.5 flex items-center justify-between">
                <span>Select AI Provider & Model</span>
                <button onClick={() => setShowModelDropdown(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {(aiConfig?.providers || [
                  { id: "gemini", name: "Gemini", status: "CONNECTED", isConfigured: true },
                  { id: "groq", name: "Groq", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "openai", name: "OpenAI", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "claude", name: "Claude", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "deepseek", name: "DeepSeek", status: "NOT_CONFIGURED", isConfigured: false },
                  { id: "grok", name: "Grok", status: "NOT_CONFIGURED", isConfigured: false },
                ]).map((provider: any) => {
                  const isSelected = (aiConfig?.activeProvider || "gemini") === provider.id;
                  const isConnected = provider.isConfigured;

                  return (
                    <div
                      key={provider.id}
                      className={`p-2 rounded-lg border transition-all ${
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

                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                          <span className={`text-[9.5px] ${isConnected ? "text-emerald-400 font-bold" : "text-zinc-500"}`}>
                            {isConnected ? "Connected" : "No Key"}
                          </span>
                          <button
                            onClick={() => handleOpenKeyModal(provider.id)}
                            className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Key className="w-2.5 h-2.5" />
                            <span>Key</span>
                          </button>
                        </div>
                      </div>

                      {/* Provider Models */}
                      {Array.isArray(provider.models) && provider.models.length > 0 && isSelected && (
                        <div className="mt-1.5 pt-1.5 border-t border-[#181824] space-y-1">
                          <div className="text-[9px] text-zinc-500 font-bold uppercase">Active Model:</div>
                          <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-0.5">
                            {provider.models.map((m: any) => {
                              const isMSelected = aiConfig?.activeModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => handleSelectModel(provider.id, m.id)}
                                  className={`px-2 py-1 rounded text-[10px] text-left flex items-center justify-between border cursor-pointer ${
                                    isMSelected
                                      ? "bg-cyan-950/70 border-cyan-500/60 text-cyan-200 font-bold"
                                      : "bg-[#0c0c14] border-[#1a1a28] text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  <span className="truncate">{m.name || m.id}</span>
                                  {isMSelected && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
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
        <div 
          ref={statusKeyModalRef}
          className="fixed bottom-8 right-3 w-84 p-3.5 bg-[#0c0c14] border border-cyan-500/40 rounded-xl space-y-2.5 text-xs font-mono shadow-2xl z-50"
        >
          <div className="flex items-center justify-between border-b border-[#1f1f2a] pb-1.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>{targetKeyProvider.name} Key Configuration</span>
            </div>
            <button onClick={() => setShowKeyModal(false)} className="text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] text-zinc-400">
              Active Key: <span className="text-cyan-300 font-bold select-all">{targetKeyProvider.maskedKey || "Not set (Session fallback active)"}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[9.5px] text-zinc-500 font-bold uppercase">{targetKeyProvider.name} API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={targetKeyProvider.keyPlaceholder || "Enter API key..."}
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
                Remove
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
                  <span>Save & Connect</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
