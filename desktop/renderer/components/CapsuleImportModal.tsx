"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, X, ArrowRight, Loader2, XCircle, Upload, Hash, ArrowDown } from "lucide-react";

interface CapsuleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (capsule: any) => void;
}

export default function CapsuleImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: CapsuleImportModalProps) {
  const [referenceInput, setReferenceInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReferenceInput("");
      setErrorMessage(null);
      setIsLoading(false);
      setIsDragging(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = referenceInput.trim();
    if (!raw || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    // Normalize reference (e.g. CC594B8F -> #CC594B8F)
    const upper = raw.toUpperCase();
    const normalized = upper.startsWith("#") ? upper : `#${upper}`;

    try {
      if (typeof window !== "undefined" && (window as any).electronAPI?.capsule?.resolveReference) {
        const res = await (window as any).electronAPI.capsule.resolveReference(raw);
        if (res && res.success && res.capsule) {
          onImportSuccess(res.capsule);
          onClose();
          return;
        } else {
          setErrorMessage(res?.error || `No Context Capsule exists for ${normalized}.`);
        }
      } else {
        setErrorMessage("Capsule bridge is not available in this environment.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || `Failed to resolve capsule reference "${raw}"`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropCapsuleAction = () => {
    if (referenceInput.trim()) {
      handleResolve();
    } else {
      inputRef.current?.focus();
      setErrorMessage("Please enter a capsule reference (e.g. #CC594B8F) to drop context into composer.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        let capsule: any = null;
        if (typeof window !== "undefined" && (window as any).electronAPI?.capsule?.parseCapsule) {
          const res = await (window as any).electronAPI.capsule.parseCapsule(content);
          if (res && res.success && res.capsule) {
            capsule = res.capsule;
          } else {
            setErrorMessage(res?.error || "Invalid Context Capsule file structure.");
            return;
          }
        } else {
          capsule = JSON.parse(content);
        }

        if (capsule && (capsule.nexus_capsule_version === "1.0.0" || capsule.capsule_id)) {
          onImportSuccess(capsule);
          onClose();
        } else {
          setErrorMessage("Dropped file is not a valid NEXUS Context Capsule.");
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to parse dropped capsule file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none font-mono">
      <div 
        className={`w-full max-w-md bg-[#090d16] border rounded-2xl p-5 shadow-2xl space-y-4 text-zinc-200 relative overflow-hidden transition-colors ${
          isDragging ? "border-cyan-400 bg-[#0d1624]" : "border-cyan-500/40"
        }`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-cyan-400 blur-sm rounded-full" />

        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
              <Box className="w-4 h-4 text-cyan-400" />
              <span className="tracking-wide">IMPORT CONTEXT CAPSULE</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Continue a previous NEXUS conversation
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800/40 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleResolve} className="space-y-3 pt-1">
          <div className="relative">
            <Hash className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={referenceInput}
              onChange={(e) => {
                setReferenceInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="#CC594B8F"
              className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#040810] border border-[#1e2a3c] focus:border-cyan-400 text-cyan-200 placeholder-zinc-600 font-mono text-sm tracking-wider focus:outline-none transition-colors"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={!referenceInput.trim() || isLoading}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                !referenceInput.trim() || isLoading
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/40"
                  : "bg-cyan-600 hover:bg-cyan-500 text-black border border-cyan-400 hover:brightness-110"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resolving...</span>
                </>
              ) : (
                <>
                  <span>Import</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[10.5px] flex items-start gap-2 animate-fadeIn">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold text-[10.5px]">✕ CAPSULE NOT FOUND</div>
                <div className="text-zinc-300 font-mono text-[10px] break-all">{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Instructions / Hint */}
          <div className="text-[10px] text-zinc-500 space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <span>Paste a capsule reference such as: <strong className="text-cyan-400 font-mono">#CC594B8F</strong></span>
            </div>
          </div>
        </form>

        {/* Footer actions / Drop context action */}
        <div className="pt-2 border-t border-[#121c2a] flex items-center justify-between text-[10.5px]">
          <button
            type="button"
            onClick={handleDropCapsuleAction}
            className="text-zinc-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-cyan-950/40 border border-transparent hover:border-cyan-800/40"
            title="Drop resolved capsule context into composer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
            <span>Drop capsule here</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
