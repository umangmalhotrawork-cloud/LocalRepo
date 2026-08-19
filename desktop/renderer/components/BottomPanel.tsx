"use client";

import React, { useState } from "react";
import { Terminal as TerminalIcon, AlertTriangle, FileCode, ShieldCheck, GitBranch, Bot, ChevronDown, X, Minus } from "lucide-react";
import TerminalPanel from "./TerminalPanel";

export type BottomPanelTab = "terminal" | "problems" | "output" | "verification" | "git" | "agent_logs";

interface BottomPanelProps {
  isOpen: boolean;
  activeTab: BottomPanelTab;
  onSelectTab: (tab: BottomPanelTab) => void;
  onClose: () => void;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
  // Terminal Panel props
  terminalProps: {
    tabs: any[];
    activeTabId: string | null;
    onSelectTab: (id: string) => void;
    onCreateTab: () => void;
    onCloseTab: (id: string) => void;
    onRestartTab: (id: string) => void;
    onSendInput: (id: string, input: string) => void;
    logs: string[];
    onClearLogs: () => void;
    debugLogs: string[];
    pythonOutput: string;
    onClearDebugLogs: () => void;
    activeMode: "terminal" | "output" | "debug" | "logs" | "python";
    onModeChange: (mode: any) => void;
  };
  // Extra tabs data
  problems?: Array<{ file: string; line: number; message: string; severity: "error" | "warning" }>;
  verificationSummary?: { firewallStatus?: string; driftStatus?: string; riskLevel?: string };
  agentLogs?: string[];
  gitSummary?: { branch?: string; stagedCount?: number; unstagedCount?: number };
}

export default function BottomPanel({
  isOpen,
  activeTab,
  onSelectTab,
  onClose,
  height,
  onResizeStart,
  terminalProps,
  problems = [],
  verificationSummary,
  agentLogs = [],
  gitSummary,
}: BottomPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{ height: `${height}px` }}
      className="bg-[#09090d] border-t border-[#181820] flex flex-col shrink-0 relative font-mono text-xs z-30 select-none"
    >
      {/* Resizer handle */}
      <div
        onMouseDown={onResizeStart}
        className="h-1 w-full bg-[#181820] hover:bg-cyan-500/50 cursor-ns-resize transition-colors"
      />

      {/* Header Tab Bar */}
      <div className="h-8 bg-[#0c0c12] border-b border-[#181820] px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Terminal Tab */}
          <button
            onClick={() => onSelectTab("terminal")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "terminal"
                ? "bg-[#09090d] text-cyan-400 border-t-2 border-cyan-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121a]"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          {/* Problems Tab */}
          <button
            onClick={() => onSelectTab("problems")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "problems"
                ? "bg-[#09090d] text-cyan-400 border-t-2 border-cyan-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121a]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Problems ({problems.length})</span>
          </button>

          {/* Output Tab */}
          <button
            onClick={() => onSelectTab("output")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "output"
                ? "bg-[#09090d] text-cyan-400 border-t-2 border-cyan-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121a]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Output</span>
          </button>

          {/* Verification Tab */}
          <button
            onClick={() => onSelectTab("verification")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "verification"
                ? "bg-[#09090d] text-emerald-400 border-t-2 border-emerald-400"
                : "text-zinc-400 hover:text-emerald-300 hover:bg-[#12121a]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verification</span>
          </button>

          {/* Git Tab */}
          <button
            onClick={() => onSelectTab("git")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "git"
                ? "bg-[#09090d] text-cyan-400 border-t-2 border-cyan-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121a]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Git</span>
          </button>

          {/* Agent Logs Tab */}
          <button
            onClick={() => onSelectTab("agent_logs")}
            className={`px-2.5 py-1 rounded-t-md flex items-center gap-1.5 transition-all text-[11px] font-bold cursor-pointer ${
              activeTab === "agent_logs"
                ? "bg-[#09090d] text-cyan-400 border-t-2 border-cyan-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#12121a]"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agent Logs</span>
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-[#181820] cursor-pointer"
            title="Minimize Panel"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-[#181820] cursor-pointer"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === "terminal" && (
          <TerminalPanel
            tabs={terminalProps.tabs}
            activeTabId={terminalProps.activeTabId || ""}
            onSelectTab={terminalProps.onSelectTab}
            onCreateTab={terminalProps.onCreateTab}
            onCloseTab={terminalProps.onCloseTab}
            onRestartTab={terminalProps.onRestartTab}
            onSendInput={terminalProps.onSendInput}
            logs={terminalProps.logs}
            onClearLogs={terminalProps.onClearLogs}
            debugLogs={terminalProps.debugLogs}
            pythonOutput={terminalProps.pythonOutput}
            onClearDebugLogs={terminalProps.onClearDebugLogs}
            activeMode={terminalProps.activeMode === "output" || terminalProps.activeMode === "debug" ? terminalProps.activeMode : "terminal"}
            onModeChange={terminalProps.onModeChange}
            onClosePanel={onClose}
          />
        )}

        {activeTab === "problems" && (
          <div className="p-3 overflow-y-auto h-full space-y-1.5 text-xs font-mono">
            {problems.length === 0 ? (
              <div className="text-zinc-500 italic text-[11px] py-4 text-center">
                No syntax or type errors detected in active workspace.
              </div>
            ) : (
              problems.map((prob, idx) => (
                <div key={idx} className="p-2 rounded bg-[#121218] border border-[#1f1f2a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-zinc-200 font-medium">{prob.message}</span>
                  </div>
                  <span className="text-zinc-500 text-[10px]">{prob.file}:{prob.line}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "output" && (
          <div className="p-3 overflow-y-auto h-full font-mono text-[11px] text-zinc-300 space-y-1 bg-[#060608]">
            {terminalProps.pythonOutput ? (
              <pre className="whitespace-pre-wrap select-all">{terminalProps.pythonOutput}</pre>
            ) : (
              <div className="text-zinc-500 italic text-[11px] py-4 text-center">
                No application output stream recorded yet. Click &quot;Run Code&quot; to execute.
              </div>
            )}
          </div>
        )}

        {activeTab === "verification" && (
          <div className="p-3 overflow-y-auto h-full font-mono text-xs text-zinc-300 space-y-2">
            <div className="p-2.5 rounded-lg bg-[#0e1410] border border-emerald-500/40 space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>AI Patch Safety Firewall: ACTIVE</span>
              </div>
              <p className="text-zinc-400 text-[10.5px]">
                Deterministic behavioral verification engine actively auditing incoming AST patches and surgical mutations for intent drift.
              </p>
            </div>
          </div>
        )}

        {activeTab === "git" && (
          <div className="p-3 overflow-y-auto h-full font-mono text-xs text-zinc-300 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Branch: <span className="text-cyan-300 font-bold">{gitSummary?.branch || "main"}</span></span>
              <span className="text-zinc-500">Staged: {gitSummary?.stagedCount || 0} | Unstaged: {gitSummary?.unstagedCount || 0}</span>
            </div>
          </div>
        )}

        {activeTab === "agent_logs" && (
          <div className="p-3 overflow-y-auto h-full font-mono text-[11px] text-zinc-300 space-y-1 bg-[#060608]">
            {terminalProps.logs.length === 0 ? (
              <div className="text-zinc-500 italic text-[11px] py-4 text-center">
                No Agent telemetry logs generated for current turn.
              </div>
            ) : (
              terminalProps.logs.map((logLine, idx) => (
                <div key={idx} className="text-cyan-300/90">{logLine}</div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
