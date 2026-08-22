import React, { useState, useMemo } from "react";
import { Terminal as TerminalIcon, AlertTriangle, AlertCircle, Info, FileCode, FileText, ChevronRight, ShieldCheck, GitBranch, Bot, ChevronDown, X, Minus } from "lucide-react";
import TerminalPanel from "./TerminalPanel";
import { ProblemItem } from "../utils/diagnosticParser";

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
    onCreateTab: (shell?: string, name?: string) => void;
    onCloseTab: (id: string) => void;
    onRestartTab: (id: string) => void;
    onSendInput: (id: string, input: string) => void;
    onRenameTab?: (id: string, newName: string) => void;
    onClearTabOutput?: (id: string) => void;
    splitLayout?: any;
    splitTabIds?: string[];
    focusedPaneId?: string;
    onSplitTab?: (direction: "vertical" | "horizontal", targetTabId?: string) => void;
    onUnsplit?: () => void;
    onFocusPane?: (id: string) => void;
    logs: string[];
    onClearLogs: () => void;
    debugLogs: string[];
    pythonOutput: string;
    onClearDebugLogs: () => void;
    activeMode: "terminal" | "output" | "debug" | "logs" | "python";
    onModeChange: (mode: any) => void;
    onAskAiAboutDiagnostic?: (diagnostic: any) => void;
    onOpenLocation?: (filePath: string, line?: number, column?: number) => void;
    onSendSelectionToAi?: (selectedText: string) => void;
  };
  // Extra tabs data
  problems?: ProblemItem[] | Array<{ file?: string; filePath?: string; line?: number; column?: number; message: string; severity: "error" | "warning" | "info"; code?: string; source?: string }>;
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
  const errorCount = useMemo(() => problems.filter((p) => p.severity === "error").length, [problems]);
  const warningCount = useMemo(() => problems.filter((p) => p.severity === "warning").length, [problems]);

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
            <AlertTriangle className={`w-3.5 h-3.5 ${errorCount > 0 ? "text-rose-400" : warningCount > 0 ? "text-amber-400" : "text-zinc-400"}`} />
            <span>Problems</span>
            {problems.length > 0 && (
              <span className="flex items-center gap-1 ml-0.5">
                {errorCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    {errorCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {warningCount}
                  </span>
                )}
              </span>
            )}
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
            onRenameTab={terminalProps.onRenameTab}
            onClearTabOutput={terminalProps.onClearTabOutput}
            splitLayout={terminalProps.splitLayout}
            splitTabIds={terminalProps.splitTabIds}
            focusedPaneId={terminalProps.focusedPaneId}
            onSplitTab={terminalProps.onSplitTab}
            onUnsplit={terminalProps.onUnsplit}
            onFocusPane={terminalProps.onFocusPane}
            logs={terminalProps.logs}
            onClearLogs={terminalProps.onClearLogs}
            debugLogs={terminalProps.debugLogs}
            pythonOutput={terminalProps.pythonOutput}
            onClearDebugLogs={terminalProps.onClearDebugLogs}
            activeMode={terminalProps.activeMode === "output" || terminalProps.activeMode === "debug" ? terminalProps.activeMode : "terminal"}
            onModeChange={terminalProps.onModeChange}
            onClosePanel={onClose}
            onAskAiAboutDiagnostic={terminalProps.onAskAiAboutDiagnostic}
            onOpenLocation={terminalProps.onOpenLocation}
            onSendSelectionToAi={terminalProps.onSendSelectionToAi}
          />
        )}

        {activeTab === "problems" && (
          <div className="flex flex-col h-full bg-[#07070a] font-mono text-xs">
            {/* Header summary bar */}
            <div className="px-3 py-1.5 bg-[#0d0d14] border-b border-[#181822] flex items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-3 text-zinc-400">
                <span className="flex items-center gap-1.5 font-bold text-zinc-300">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>{errorCount} {errorCount === 1 ? "Error" : "Errors"}</span>
                </span>
                <span className="flex items-center gap-1.5 font-bold text-zinc-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{warningCount} {warningCount === 1 ? "Warning" : "Warnings"}</span>
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {problems.length} total {problems.length === 1 ? "issue" : "issues"}
              </span>
            </div>

            {/* List grouped by file */}
            <div className="p-2 overflow-y-auto flex-1 space-y-2">
              {problems.length === 0 ? (
                <div className="text-zinc-500 italic text-[11px] py-8 text-center flex flex-col items-center gap-1.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-500/40" />
                  <span>No syntax, type, or runtime errors detected in active workspace.</span>
                </div>
              ) : (
                (() => {
                  const groups: Record<string, any[]> = {};
                  for (const p of problems) {
                    const f = (p as any).filePath || (p as any).file || "workspace";
                    if (!groups[f]) groups[f] = [];
                    groups[f].push(p);
                  }
                  return Object.entries(groups).map(([fileName, items]) => (
                    <div key={fileName} className="rounded border border-[#1b1b26] bg-[#0c0c12] overflow-hidden">
                      <div className="px-2.5 py-1 bg-[#12121a] border-b border-[#1b1b26] flex items-center justify-between text-[11px] font-bold text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="truncate">{fileName}</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#1a1a26] text-zinc-400 font-mono">
                          {items.length}
                        </span>
                      </div>
                      <div className="divide-y divide-[#161622]">
                        {items.map((prob: any, idx: number) => {
                          const isErr = prob.severity === "error";
                          const isWarn = prob.severity === "warning";
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                if (terminalProps.onOpenLocation) {
                                  terminalProps.onOpenLocation(fileName, prob.line, prob.column);
                                }
                              }}
                              className="p-2 hover:bg-[#151520] transition-colors cursor-pointer flex items-start justify-between gap-3 text-[11px]"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                {isErr ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                ) : isWarn ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-zinc-200 leading-tight">
                                    {prob.message}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                    {prob.code && (
                                      <span className="px-1 py-0.2 rounded bg-[#181824] text-cyan-300 font-mono">
                                        {prob.code}
                                      </span>
                                    )}
                                    {prob.source && (
                                      <span className="text-zinc-400">[{prob.source}]</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="text-zinc-500 text-[10px] shrink-0 font-mono">
                                {prob.line ? `line ${prob.line}${prob.column ? `:${prob.column}` : ""}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
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
