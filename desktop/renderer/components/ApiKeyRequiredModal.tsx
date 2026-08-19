"use client";

import React, { useState, useEffect } from "react";
import { Key, Shield, AlertCircle, Loader2, X, Lock } from "lucide-react";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface ApiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerName?: string;
  providerId?: string;
}

export default function ApiKeyRequiredModal({
  isOpen,
  onClose,
  onSuccess,
  providerName = "Gemini",
  providerId = "gemini",
}: ApiKeyRequiredModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setApiKey("");
      setErrorMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        const res = await (window as any).electronAPI.ai.setApiKey(providerId, trimmed);
        if (res && res.success && res.status === "CONNECTED") {
          setLoading(false);
          setApiKey("");
          onSuccess();
          return;
        } else {
          setErrorMessage(res?.error || "Invalid API key or Gemini connection failed.");
        }
      } else {
        // Fallback for mock/test environments
        setLoading(false);
        onSuccess();
        return;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid API key or Gemini connection failed.");
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
              <h2 className="font-bold text-sm text-white tracking-tight">{providerName} API Key Required</h2>
              <p className="text-[10.5px] text-zinc-400">Enter your {providerName} API key to continue.</p>
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
        <form onSubmit={handleContinue} className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>API Key</span>
              <span className="text-zinc-500 text-[9.5px]">AIzaSy...</span>
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
                placeholder="Enter Gemini API key (AIzaSy...)"
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
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 pt-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Your key is stored securely on this device.</span>
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
                  <span>Validating...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
