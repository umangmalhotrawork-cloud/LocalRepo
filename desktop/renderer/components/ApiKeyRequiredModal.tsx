"use client";

import React, { useState, useEffect } from "react";
import { Key, Shield, AlertCircle, Loader2, X, Lock, ChevronDown, Check } from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface ApiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (providerId?: string) => void;
  providerName?: string;
  providerId?: string;
}

const PROVIDER_METAS: Record<string, { name: string; placeholder: string; helpUrl: string }> = {
  gemini: { name: "Google Gemini", placeholder: "AIzaSy...", helpUrl: "https://aistudio.google.com/app/apikey" },
  groq: { name: "Groq", placeholder: "gsk_...", helpUrl: "https://console.groq.com/keys" },
  openai: { name: "OpenAI", placeholder: "sk-...", helpUrl: "https://platform.openai.com/api-keys" },
  claude: { name: "Anthropic Claude", placeholder: "sk-ant-...", helpUrl: "https://console.anthropic.com/settings/keys" },
  deepseek: { name: "DeepSeek", placeholder: "sk-...", helpUrl: "https://platform.deepseek.com/api_keys" },
  grok: { name: "xAI Grok", placeholder: "xai-...", helpUrl: "https://console.x.ai/" },
};

export default function ApiKeyRequiredModal({
  isOpen,
  onClose,
  onSuccess,
  providerName,
  providerId = "gemini",
}: ApiKeyRequiredModalProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providerId);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  const modalRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedProviderId(providerId || "gemini");
      setApiKey("");
      setErrorMessage(null);
      setLoading(false);
      setShowProviderDropdown(false);
    }
  }, [isOpen, providerId]);

  if (!isOpen) return null;

  const currentMeta = PROVIDER_METAS[selectedProviderId] || {
    name: providerName || selectedProviderId,
    placeholder: "Enter API key...",
    helpUrl: "",
  };

  const handleContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = apiKey.trim();

    if (!trimmed) {
      setErrorMessage("API key cannot be empty.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.ai?.setApiKey) {
        const res = await (window as any).electronAPI.ai.setApiKey(selectedProviderId, trimmed);
        if (res && res.success && res.status === "CONNECTED") {
          setLoading(false);
          setApiKey("");
          onSuccess(selectedProviderId);
          return;
        } else {
          setErrorMessage(res?.error || `Invalid API key or ${currentMeta.name} connection failed.`);
        }
      } else {
        setLoading(false);
        onSuccess(selectedProviderId);
        return;
      }
    } catch (err: any) {
      setErrorMessage(err.message || `Invalid API key or ${currentMeta.name} connection failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none font-mono"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-[#0c0c14] border border-[#262636] rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs text-zinc-200"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-[#1c1c2a] flex items-center justify-between bg-[#08080d]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-tight">{currentMeta.name} API Key Configuration</h2>
              <p className="text-[10.5px] text-zinc-400">Enter your {currentMeta.name} API key to enable AI features.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-[#161622] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleContinue} className="p-4 space-y-3.5">
          {/* Provider Switcher */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Target Provider
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                disabled={loading}
                className="w-full bg-[#12121c] border border-[#252536] hover:border-[#3a3a50] rounded-xl px-3 py-2 text-zinc-100 flex items-center justify-between font-mono text-xs cursor-pointer"
              >
                <span className="font-bold text-cyan-300">{currentMeta.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {showProviderDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0c0c16] border border-[#262638] rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                  {Object.entries(PROVIDER_METAS).map(([pId, meta]) => {
                    const isSelected = selectedProviderId === pId;
                    return (
                      <button
                        key={pId}
                        type="button"
                        onClick={() => {
                          setSelectedProviderId(pId);
                          setShowProviderDropdown(false);
                          setErrorMessage(null);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? "bg-cyan-950/60 text-cyan-300 font-bold" : "text-zinc-300 hover:bg-[#151522]"
                        }`}
                      >
                        <span>{meta.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>{currentMeta.name} API Key</span>
              <span className="text-zinc-500 text-[9.5px]">Format: {currentMeta.placeholder}</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
                placeholder={`Enter ${currentMeta.name} API key (${currentMeta.placeholder})`}
                disabled={loading}
                className="w-full bg-[#12121c] border border-[#252536] focus:border-cyan-500/70 rounded-xl px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none text-xs font-mono transition-colors"
              />
              <Lock className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Security Note */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Stored securely in encrypted OS vault.</span>
            </div>
            {currentMeta.helpUrl && (
              <span className="text-cyan-400/80">Never shared between providers</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c1c2a]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1c1c2a] border border-[#252536] text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                  <span>Validating Key...</span>
                </>
              ) : (
                <span>Save & Connect</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
