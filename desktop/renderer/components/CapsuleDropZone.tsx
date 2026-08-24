"use client";

import React, { useState, useRef } from "react";
import { Box, FileJson, AlertCircle } from "lucide-react";

interface CapsuleDropZoneProps {
  children: React.ReactNode;
  onCapsuleDropped: (capsule: any, fileName?: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function CapsuleDropZone({
  children,
  onCapsuleDropped,
  onError,
  disabled = false,
  className = "",
  style,
}: CapsuleDropZoneProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounter = useRef<number>(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    if (!jsonFile) {
      if (onError) {
        onError("Dropped file must be a .json Context Capsule file.");
      }
      return;
    }

    try {
      const text = await jsonFile.text();
      let capsule: any = null;

      // Validate through IPC if available, otherwise direct parse
      if (typeof window !== "undefined" && (window as any).electronAPI?.capsule?.parseCapsule) {
        const res = await (window as any).electronAPI.capsule.parseCapsule(text);
        if (res && res.success && res.capsule) {
          capsule = res.capsule;
        } else {
          throw new Error(res?.error || "Invalid Context Capsule file");
        }
      } else {
        capsule = JSON.parse(text);
        if (capsule.nexus_capsule_version !== "1.0.0" || !capsule.capsule_id || !capsule.source_chat?.thread_id) {
          throw new Error("File does not match the Nexus Context Capsule schema specification.");
        }
      }

      onCapsuleDropped(capsule, jsonFile.name);
    } catch (err: any) {
      if (onError) {
        onError(err?.message || "Failed to parse dropped Context Capsule.");
      }
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
      style={style}
    >
      {children}

      {/* Drag Overlay */}
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-50 rounded-xl bg-[#060c14]/90 backdrop-blur-sm border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Box className="w-6 h-6 text-cyan-300 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="text-cyan-200 font-bold text-xs">
              Drop Context Capsule to continue this conversation
            </div>
            <div className="text-zinc-400 text-[10px]">
              Validated session exchanges and task context will be attached to this chat
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
            <FileJson className="w-3 h-3" />
            <span>.json schema v1.0.0</span>
          </div>
        </div>
      )}
    </div>
  );
}
