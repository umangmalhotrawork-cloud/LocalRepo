"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal as TerminalIcon, Plus, X, RotateCcw, Square, 
  ChevronRight, FileText, Bug, Trash2, Copy, Check 
} from "lucide-react";
import { TerminalTab } from "../hooks/useTerminal";

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCreateTab: () => void;
  onCloseTab: (id: string) => void;
  onRestartTab: (id: string) => void;
  onSendInput: (id: string, input: string) => void;
  logs?: string[];
  onClearLogs?: () => void;
  debugLogs?: string[];
  pythonOutput?: string;
  onClearDebugLogs?: () => void;
  activeMode?: "terminal" | "output" | "debug";
  onModeChange?: (mode: "terminal" | "output" | "debug") => void;
  onClosePanel?: () => void;
}

export default function TerminalPanel({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onCloseTab,
  onRestartTab,
  onSendInput,
  logs = [],
  onClearLogs,
  debugLogs = [],
  pythonOutput,
  onClearDebugLogs,
  activeMode: externalMode,
  onModeChange,
  onClosePanel,
}: TerminalPanelProps) {
  const [internalMode, setInternalMode] = useState<"terminal" | "output" | "debug">("terminal");
  const activeMode = externalMode !== undefined ? externalMode : internalMode;

  const setMode = (mode: "terminal" | "output" | "debug") => {
    if (onModeChange) onModeChange(mode);
    setInternalMode(mode);
  };

  const [commandInput, setCommandInput] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const debugContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const focusInput = React.useCallback(() => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);

  // Automatically focus terminal input on mount, mode change, tab selection, or tab creation
  useEffect(() => {
    if (activeMode === "terminal" && activeTab) {
      focusInput();
    }
  }, [activeMode, activeTabId, tabs.length, focusInput]);

  // Auto-scroll logic for terminal output
  useEffect(() => {
    const el = outputContainerRef.current;
    if (!el || userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeTab?.output]);

  // Auto-scroll for logs and debug console
  useEffect(() => {
    if (activeMode === "output" && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    } else if (activeMode === "debug" && debugContainerRef.current) {
      debugContainerRef.current.scrollTop = debugContainerRef.current.scrollHeight;
    }
  }, [logs, debugLogs, pythonOutput, activeMode]);

  const handleScroll = () => {
    const el = outputContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && activeTab) {
      e.preventDefault();
      const cmd = commandInput;
      if (cmd.trim()) {
        setHistory((prev) => [...prev, cmd]);
      }
      setHistoryIndex(-1);
      onSendInput(activeTab.id, cmd + "\n");
      setCommandInput("");
      userScrolledUpRef.current = false;
      focusInput();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setCommandInput(history[nextIdx] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setCommandInput("");
        } else {
          setHistoryIndex(nextIdx);
          setCommandInput(history[nextIdx] || "");
        }
      }
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      if (activeTab) {
        onSendInput(activeTab.id, "\x03");
        setCommandInput("");
      }
    }
  };

  const handleCopyLogs = () => {
    const textToCopy = activeMode === "output" ? logs.join("\n") : (pythonOutput || debugLogs.join("\n"));
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#050507] border-t border-[#1f1f1f] font-mono text-xs select-none">
      
      {/* Header Toolbar & Primary Mode Tabs */}
      <div className="h-8 bg-[#0a0a0d] border-b border-[#1f1f1f] flex items-center justify-between px-2 overflow-x-auto shrink-0">
        
        {/* Left Side: Primary Tabs (Terminal / Output / Debug Console) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          
          {/* Terminal Tab */}
          <button
            onClick={() => setMode("terminal")}
            aria-label="Switch to Integrated Terminal tab"
            className={`min-h-[28px] px-2.5 py-1 rounded-t-md flex items-center gap-1.5 cursor-pointer transition-all border-t border-x text-[11px] font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
              activeMode === "terminal"
                ? "bg-[#050507] text-cyan-300 border-cyan-500/40"
                : "bg-[#0d0d10] text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>TERMINAL</span>
            {tabs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#1c1c24] text-[9.5px] text-zinc-300">
                {tabs.length}
              </span>
            )}
          </button>

          {/* Output Tab (IPC & Engine Logs) */}
          <button
            onClick={() => setMode("output")}
            aria-label="Switch to Output Logs tab"
            className={`min-h-[28px] px-2.5 py-1 rounded-t-md flex items-center gap-1.5 cursor-pointer transition-all border-t border-x text-[11px] font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
              activeMode === "output"
                ? "bg-[#050507] text-purple-300 border-purple-500/40"
                : "bg-[#0d0d10] text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>OUTPUT</span>
            {logs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-950/80 border border-purple-500/30 text-[9.5px] text-purple-300">
                {logs.length}
              </span>
            )}
          </button>

          {/* Debug Console Tab */}
          <button
            onClick={() => setMode("debug")}
            aria-label="Switch to Debug Console tab"
            className={`min-h-[28px] px-2.5 py-1 rounded-t-md flex items-center gap-1.5 cursor-pointer transition-all border-t border-x text-[11px] font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
              activeMode === "debug"
                ? "bg-[#050507] text-emerald-300 border-emerald-500/40"
                : "bg-[#0d0d10] text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-emerald-400" />
            <span>DEBUG CONSOLE</span>
          </button>

          {/* Sub-tabs for Terminal Shells */}
          {activeMode === "terminal" && (
            <div className="flex items-center gap-1 pl-2 border-l border-[#1f1f1f]">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id);
                    focusInput();
                  }}
                  className={`group min-h-[24px] px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition-all text-[10.5px] ${
                    activeTabId === tab.id
                      ? "bg-[#151520] text-cyan-300 font-bold border border-cyan-500/30"
                      : "bg-[#0d0d10] text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  {tab.status === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Running" />
                  )}
                  {tab.status === "exited" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" title="Exited" />
                  )}
                  {tab.status === "error" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Error" />
                  )}
                  <span>{tab.name}</span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    aria-label={`Close terminal tab ${tab.name}`}
                    className="min-w-[20px] min-h-[20px] opacity-40 hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  onCreateTab();
                  focusInput();
                }}
                aria-label="Create new shell terminal tab"
                className="min-w-[28px] min-h-[28px] p-1 rounded bg-[#18181b] hover:bg-[#27272a] text-zinc-300 border border-[#27272a] transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                title="Create New Terminal Tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 text-[10.5px]">
          {activeMode === "terminal" && activeTab && (
            <>
              <span className="text-zinc-500 hidden md:inline">CWD: <strong className="text-purple-300">{activeTab.cwd}</strong></span>

              <button
                onClick={() => {
                  onRestartTab(activeTab.id);
                  focusInput();
                }}
                aria-label="Restart terminal shell process"
                className="min-h-[28px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/30 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                title="Restart Terminal Process"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>

              <button
                onClick={() => onCloseTab(activeTab.id)}
                aria-label="Kill terminal shell process"
                className="min-h-[28px] px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                title="Kill Terminal Process"
              >
                <Square className="w-3 h-3 fill-rose-300" />
                <span>Kill</span>
              </button>
            </>
          )}

          {activeMode !== "terminal" && (
            <>
              <button
                onClick={handleCopyLogs}
                aria-label="Copy logs to clipboard"
                className="min-h-[28px] px-2 py-0.5 rounded bg-[#151520] hover:bg-[#1f1f24] text-zinc-300 border border-[#26262e] transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={() => {
                  if (activeMode === "output" && onClearLogs) onClearLogs();
                  if (activeMode === "debug" && onClearDebugLogs) onClearDebugLogs();
                }}
                aria-label="Clear console output"
                className="min-h-[28px] px-2 py-0.5 rounded bg-[#151520] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-[#26262e] transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </>
          )}

          {onClosePanel && (
            <button
              onClick={onClosePanel}
              aria-label="Close bottom terminal drawer"
              className="min-w-[28px] min-h-[28px] p-1 rounded text-zinc-500 hover:text-zinc-200 transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              title="Hide Terminal Panel (⌘`)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* Main Panel Content Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#050507]">
        
        {/* 1. Terminal Shell Mode */}
        {activeMode === "terminal" && (
          activeTab ? (
            <div 
              className="flex-1 flex flex-col min-h-0 cursor-text focus:outline-none"
              onClick={focusInput}
              tabIndex={0}
              onKeyDown={(e) => {
                if (document.activeElement !== inputRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  inputRef.current?.focus();
                }
              }}
            >
              <div
                ref={outputContainerRef}
                onScroll={handleScroll}
                onClick={focusInput}
                className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300 select-text"
              >
                {activeTab.output.length > 0 ? (
                  activeTab.output.map((line, idx) => <div key={idx}>{line}</div>)
                ) : (
                  <div className="text-zinc-600 italic">Terminal process started. Ready for input...</div>
                )}
              </div>

              {/* Interactive Shell Input Prompt Bar */}
              <div 
                className="px-3 py-1.5 bg-[#0a0a0d] border-t border-[#1f1f1f] flex items-center gap-2 cursor-text"
                onClick={focusInput}
              >
                <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 shrink-0">
                  <span>$</span>
                  <ChevronRight className="w-3 h-3 text-cyan-400" />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={activeTab.output.length === 0 && !commandInput ? "Type command (e.g. node -v, python3 --version, pwd)..." : ""}
                  aria-label="Terminal command prompt input"
                  autoFocus
                  className="flex-1 bg-transparent text-cyan-200 outline-none font-mono text-xs caret-cyan-400 placeholder:text-zinc-600 focus:outline-none rounded px-1"
                />
              </div>
            </div>
          ) : (
            <div 
              className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-xs cursor-pointer"
              onClick={() => {
                onCreateTab();
                focusInput();
              }}
            >
              <span>No active terminal. Click <strong className="text-cyan-400">+</strong> to open a shell.</span>
            </div>
          )
        )}

        {/* 2. Output Mode (IPC & Engine Diagnostic Stream) */}
        {activeMode === "output" && (
          <div
            ref={logsContainerRef}
            className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-tight space-y-1 text-zinc-300"
          >
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed hover:bg-[#121218] px-1 rounded">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-zinc-600 italic">No output logs recorded yet.</div>
            )}
          </div>
        )}

        {/* 3. Debug Console Mode */}
        {activeMode === "debug" && (
          <div
            ref={debugContainerRef}
            className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 text-zinc-300"
          >
            {pythonOutput && (
              <div className="space-y-1">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Python Execution Stream:</div>
                <div className="p-2 rounded bg-[#0a0a0d] border border-[#1f1f24] whitespace-pre-wrap text-zinc-200 font-mono text-xs">
                  {pythonOutput}
                </div>
              </div>
            )}

            {debugLogs.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Debugger Trace Steps:</div>
                {debugLogs.map((dLog, idx) => (
                  <div key={idx} className="p-1 rounded bg-[#0a0a0d] border border-[#1a1a20] text-zinc-300">
                    {dLog}
                  </div>
                ))}
              </div>
            ) : (
              !pythonOutput && (
                <div className="text-zinc-600 italic">No active debugger session. Press F5 to start tracing.</div>
              )
            )}
          </div>
        )}

      </div>

    </div>
  );
}
