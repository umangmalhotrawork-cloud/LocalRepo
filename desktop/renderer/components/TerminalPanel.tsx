"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Terminal as TerminalIcon, Plus, X, RotateCcw, Square, 
  ChevronRight, ChevronDown, ChevronUp, FileText, Bug, Trash2, Copy, Check,
  Sparkles, AlertTriangle, ExternalLink, Bot, Columns, Rows, Edit2, Maximize2
} from "lucide-react";
import { TerminalTab, SplitLayout } from "../hooks/useTerminal";
import { parseDiagnosticFromText, TerminalDiagnostic } from "../utils/diagnosticParser";

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCreateTab: (shell?: string, name?: string) => void;
  onCloseTab: (id: string) => void;
  onRestartTab: (id: string) => void;
  onSendInput: (id: string, input: string) => void;
  onRenameTab?: (id: string, newName: string) => void;
  onClearTabOutput?: (id: string) => void;
  splitLayout?: SplitLayout;
  splitTabIds?: string[];
  focusedPaneId?: string;
  onSplitTab?: (direction: "vertical" | "horizontal", targetTabId?: string) => void;
  onUnsplit?: () => void;
  onFocusPane?: (id: string) => void;
  logs?: string[];
  onClearLogs?: () => void;
  debugLogs?: string[];
  pythonOutput?: string;
  onClearDebugLogs?: () => void;
  activeMode?: "terminal" | "output" | "debug";
  onModeChange?: (mode: "terminal" | "output" | "debug") => void;
  onClosePanel?: () => void;
  onAskAiAboutDiagnostic?: (diagnostic: TerminalDiagnostic) => void;
  onOpenLocation?: (filePath: string, line?: number, column?: number) => void;
  onSendSelectionToAi?: (selectedText: string) => void;
}

interface SinglePaneProps {
  tab: TerminalTab;
  isFocused: boolean;
  isSplit: boolean;
  onFocus: () => void;
  onSendInput: (id: string, input: string) => void;
  onClose?: () => void;
  onAskAiAboutDiagnostic?: (diagnostic: TerminalDiagnostic) => void;
  onOpenLocation?: (filePath: string, line?: number, column?: number) => void;
  onSendSelectionToAi?: (selectedText: string) => void;
}

function SingleTerminalPane({
  tab,
  isFocused,
  isSplit,
  onFocus,
  onSendInput,
  onClose,
  onAskAiAboutDiagnostic,
  onOpenLocation,
  onSendSelectionToAi,
}: SinglePaneProps) {
  const [commandInput, setCommandInput] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selectedTerminalText, setSelectedTerminalText] = useState<string>("");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [dismissedDiagnosticSummary, setDismissedDiagnosticSummary] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  // Diagnostic computation for this pane's tab
  const activeDiagnostic = useMemo(() => {
    if (!tab || tab.output.length === 0) return null;
    const combinedOutput = tab.output.slice(-60).join("\n");
    const parsed = parseDiagnosticFromText(combinedOutput, {
      cwd: tab.cwd,
      exitCode: tab.status === "error" ? (tab.exitCode || 1) : undefined,
    });
    if (parsed && dismissedDiagnosticSummary === parsed.summary) return null;
    return parsed;
  }, [tab?.output, tab?.status, tab?.cwd, tab?.exitCode, dismissedDiagnosticSummary]);

  const focusInput = React.useCallback(() => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (isFocused) {
      focusInput();
    }
  }, [isFocused, focusInput]);

  useEffect(() => {
    const el = outputContainerRef.current;
    if (!el || userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [tab.output]);

  const handleScroll = () => {
    const el = outputContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  };

  const handleOutputMouseUp = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      setSelectedTerminalText(sel.toString().trim());
    } else {
      setSelectedTerminalText("");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = commandInput;
      if (cmd.trim()) {
        setHistory((prev) => [...prev, cmd]);
      }
      setHistoryIndex(-1);
      onSendInput(tab.id, cmd + "\n");
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
      onSendInput(tab.id, "\x03");
      setCommandInput("");
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 min-w-0 bg-[#050507] cursor-text relative transition-all ${
        isSplit
          ? isFocused
            ? "border border-cyan-500/50 shadow-inner"
            : "border border-[#1a1a24] opacity-90 hover:opacity-100"
          : ""
      }`}
      onClick={() => {
        onFocus();
        focusInput();
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          document.activeElement !== inputRef.current &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          inputRef.current?.focus();
        }
      }}
    >
      {/* Split Pane Sub-Header */}
      {isSplit && (
        <div className="h-6 px-2.5 bg-[#09090e] border-b border-[#1f1f24] flex items-center justify-between text-[10px] text-zinc-400 select-none shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {tab.status === "running" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Running" />
            )}
            {tab.status === "exited" && (
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" title="Exited" />
            )}
            {tab.status === "error" && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Error" />
            )}
            <span className={`font-semibold truncate ${isFocused ? "text-cyan-300" : "text-zinc-400"}`}>
              {tab.name}
            </span>
            <span className="text-zinc-600 truncate hidden sm:inline font-mono text-[9.5px]">
              ({tab.cwd})
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                title="Close Pane"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Diagnostic Banner Card */}
      {activeDiagnostic && (
        <div className="mx-2 mt-2 p-2 rounded-md bg-[#160b12] border border-rose-500/30 text-zinc-200 shadow-md shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold text-rose-300 truncate">
                  {activeDiagnostic.summary}
                </div>
                {activeDiagnostic.friendlyExplanation && (
                  <div className="text-[9.5px] text-zinc-400 mt-0.5 line-clamp-2">
                    {activeDiagnostic.friendlyExplanation}
                  </div>
                )}
                {activeDiagnostic.filePath && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeDiagnostic.filePath) {
                        onOpenLocation?.(
                          activeDiagnostic.filePath,
                          activeDiagnostic.line || undefined,
                          activeDiagnostic.column || undefined
                        );
                      }
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline bg-[#0f172a] px-1.5 py-0.2 rounded border border-cyan-500/30 cursor-pointer"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>
                      {activeDiagnostic.filePath.split("/").pop() || activeDiagnostic.filePath}
                      {activeDiagnostic.line ? `:${activeDiagnostic.line}` : ""}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onAskAiAboutDiagnostic && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiAboutDiagnostic(activeDiagnostic);
                  }}
                  className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[9.5px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                >
                  <Sparkles className="w-2.5 h-2.5 text-cyan-200" />
                  <span>Ask AI</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTechnicalDetails(!showTechnicalDetails);
                }}
                className="px-1 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[9.5px] flex items-center gap-0.5 cursor-pointer border border-zinc-800"
                title="Toggle Stack Trace / Raw Details"
              >
                {showTechnicalDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedDiagnosticSummary(activeDiagnostic.summary);
                }}
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                title="Dismiss Diagnostic"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {showTechnicalDetails && activeDiagnostic.stackTrace && (
            <div className="mt-1.5 p-1.5 rounded bg-[#09090c] border border-zinc-800 text-[9.5px] font-mono text-zinc-400 max-h-28 overflow-y-auto whitespace-pre-wrap select-text">
              {activeDiagnostic.stackTrace}
            </div>
          )}
        </div>
      )}

      {/* Text Selection AI Handoff Banner */}
      {selectedTerminalText && onSendSelectionToAi && (
        <div className="mx-2 mt-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-between text-[10px] text-cyan-200 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Bot className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Selected <strong>{selectedTerminalText.length}</strong> chars</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSendSelectionToAi(selectedTerminalText);
                setSelectedTerminalText("");
              }}
              className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[9.5px] flex items-center gap-1 transition-all cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Send to AI</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTerminalText("");
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Terminal Output Buffer */}
      <div
        ref={outputContainerRef}
        onScroll={handleScroll}
        onMouseUp={handleOutputMouseUp}
        onClick={focusInput}
        className="flex-1 p-2.5 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300 select-text"
      >
        {tab.output.length > 0 ? (
          tab.output.map((line, idx) => <div key={idx}>{line}</div>)
        ) : (
          <div className="text-zinc-600 italic">Terminal process started ({tab.name}). Ready for input...</div>
        )}
      </div>

      {/* Interactive Shell Input Prompt Bar */}
      <div
        className="px-2.5 py-1.5 bg-[#0a0a0d] border-t border-[#1f1f1f] flex items-center gap-2 cursor-text shrink-0"
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
          placeholder={tab.output.length === 0 && !commandInput ? "Type command (e.g. ls, npm test, git status)..." : ""}
          aria-label={`Command input for ${tab.name}`}
          autoFocus={isFocused}
          className="flex-1 bg-transparent text-cyan-200 outline-none font-mono text-xs caret-cyan-400 placeholder:text-zinc-600 focus:outline-none rounded px-1"
        />
      </div>
    </div>
  );
}

export default function TerminalPanel({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onCloseTab,
  onRestartTab,
  onSendInput,
  onRenameTab,
  onClearTabOutput,
  splitLayout = null,
  splitTabIds = [],
  focusedPaneId = "",
  onSplitTab,
  onUnsplit,
  onFocusPane,
  logs = [],
  onClearLogs,
  debugLogs = [],
  pythonOutput,
  onClearDebugLogs,
  activeMode: externalMode,
  onModeChange,
  onClosePanel,
  onAskAiAboutDiagnostic,
  onOpenLocation,
  onSendSelectionToAi,
}: TerminalPanelProps) {
  const [internalMode, setInternalMode] = useState<"terminal" | "output" | "debug">("terminal");
  const activeMode = externalMode !== undefined ? externalMode : internalMode;

  const setMode = (mode: "terminal" | "output" | "debug") => {
    if (onModeChange) onModeChange(mode);
    setInternalMode(mode);
  };

  const [copied, setCopied] = useState<boolean>(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [showShellDropdown, setShowShellDropdown] = useState<boolean>(false);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const debugContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const effectiveFocusedId = focusedPaneId || activeTabId || (tabs[0]?.id ?? "");

  // Auto-scroll for logs and debug console
  useEffect(() => {
    if (activeMode === "output" && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    } else if (activeMode === "debug" && debugContainerRef.current) {
      debugContainerRef.current.scrollTop = debugContainerRef.current.scrollHeight;
    }
  }, [logs, debugLogs, pythonOutput, activeMode]);

  const handleStartRename = (tab: TerminalTab, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingName(tab.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleSaveRename = (tabId: string) => {
    if (editingName.trim() && onRenameTab) {
      onRenameTab(tabId, editingName.trim());
    }
    setEditingTabId(null);
  };

  const handleCopyLogs = () => {
    const textToCopy =
      activeMode === "output"
        ? logs.join("\n")
        : pythonOutput || debugLogs.join("\n");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine tabs to render based on split layout
  const isSplitActive = splitLayout !== null && splitTabIds.length >= 2;
  const paneTabs = useMemo(() => {
    if (!isSplitActive) {
      return activeTab ? [activeTab] : [];
    }
    return splitTabIds
      .map((id) => tabs.find((t) => t.id === id))
      .filter((t): t is TerminalTab => Boolean(t));
  }, [isSplitActive, splitTabIds, tabs, activeTab]);

  return (
    <div className="h-full flex flex-col bg-[#050507] border-t border-[#1f1f1f] font-mono text-xs select-none">
      {/* Header Toolbar & Primary Mode Tabs */}
      <div className="h-8 bg-[#0a0a0d] border-b border-[#1f1f1f] flex items-center justify-between px-2 overflow-x-auto shrink-0">
        
        {/* Left Side: Primary Tabs (Terminal / Output / Debug Console) & Sub-tabs */}
        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          
          {/* Terminal Mode Tab */}
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

          {/* Output Mode Tab */}
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

          {/* Debug Console Mode Tab */}
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

          {/* Sub-tabs for Multiplexed Terminal Shells */}
          {activeMode === "terminal" && (
            <div className="flex items-center gap-1 pl-2 border-l border-[#1f1f1f] overflow-x-auto">
              {tabs.map((tab) => {
                const isActive = activeTabId === tab.id || (isSplitActive && splitTabIds.includes(tab.id));
                const isEditing = editingTabId === tab.id;

                return (
                  <div
                    key={tab.id}
                    onClick={() => {
                      onSelectTab(tab.id);
                      if (onFocusPane) onFocusPane(tab.id);
                    }}
                    onDoubleClick={(e) => handleStartRename(tab, e)}
                    className={`group min-h-[24px] px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition-all text-[10.5px] ${
                      isActive
                        ? "bg-[#151520] text-cyan-300 font-bold border border-cyan-500/30"
                        : "bg-[#0d0d10] text-zinc-500 hover:text-zinc-300 border border-transparent"
                    }`}
                  >
                    {/* Status & Unread Badge */}
                    {tab.status === "running" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Running" />
                    )}
                    {tab.status === "exited" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" title="Exited" />
                    )}
                    {tab.status === "error" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Error" />
                    )}
                    {tab.unread && !isActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                        title="Unread terminal output"
                      />
                    )}

                    {/* Tab Title or Rename Input */}
                    {isEditing ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveRename(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(tab.id);
                          if (e.key === "Escape") setEditingTabId(null);
                        }}
                        className="w-20 bg-[#09090c] text-white text-[10.5px] px-1 py-0.2 rounded border border-cyan-400 outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate max-w-[120px]">{tab.name}</span>
                    )}

                    {/* Quick Rename Button */}
                    <button
                      onClick={(e) => handleStartRename(tab, e)}
                      aria-label="Rename Tab"
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-white transition-opacity"
                      title="Rename Tab (or double click)"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>

                    {/* Close Tab Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      aria-label={`Close terminal tab ${tab.name}`}
                      className="min-w-[18px] min-h-[18px] opacity-40 hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Plus Button & Shell Dropdown */}
              <div className="relative">
                <div className="flex items-center">
                  <button
                    onClick={() => onCreateTab()}
                    aria-label="Create new shell terminal tab"
                    className="min-w-[26px] min-h-[26px] p-1 rounded-l bg-[#18181b] hover:bg-[#27272a] text-zinc-300 border-y border-l border-[#27272a] transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                    title="Create New Terminal Tab (Default Shell)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowShellDropdown(!showShellDropdown)}
                    aria-label="Select Shell Profile"
                    className="min-w-[16px] min-h-[26px] px-0.5 rounded-r bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-white border-y border-r border-[#27272a] transition-all cursor-pointer flex items-center justify-center"
                    title="Select Shell Type"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {showShellDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-44 bg-[#0a0a0e] border border-[#272732] rounded-md shadow-2xl p-1 text-[10.5px] space-y-0.5 font-sans">
                    <button
                      onClick={() => {
                        onCreateTab(undefined, "Default Shell");
                        setShowShellDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#1f1f28] text-cyan-300 flex items-center justify-between"
                    >
                      <span>Default System Shell</span>
                    </button>
                    <button
                      onClick={() => {
                        onCreateTab("/bin/zsh", "zsh");
                        setShowShellDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#1f1f28] text-zinc-300 flex items-center justify-between"
                    >
                      <span>Zsh (/bin/zsh)</span>
                    </button>
                    <button
                      onClick={() => {
                        onCreateTab("/bin/bash", "bash");
                        setShowShellDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#1f1f28] text-zinc-300 flex items-center justify-between"
                    >
                      <span>Bash (/bin/bash)</span>
                    </button>
                    <button
                      onClick={() => {
                        onCreateTab("/bin/sh", "sh");
                        setShowShellDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#1f1f28] text-zinc-300 flex items-center justify-between"
                    >
                      <span>POSIX Sh (/bin/sh)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls: Multiplexing, Clear, Restart, Kill, Close */}
        <div className="flex items-center gap-1.5 text-[10.5px] shrink-0">
          {activeMode === "terminal" && activeTab && (
            <>
              <span className="text-zinc-500 hidden lg:inline truncate max-w-[200px]">
                CWD: <strong className="text-purple-300">{activeTab.cwd}</strong>
              </span>

              {/* Split Buttons */}
              {onSplitTab && (
                <div className="flex items-center gap-1 bg-[#121218] p-0.5 rounded border border-[#26262e]">
                  <button
                    onClick={() => onSplitTab("vertical")}
                    aria-label="Split Terminal Right (Vertical)"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                    title="Split Terminal Vertically (Side-by-Side) [⌘\]"
                  >
                    <Columns className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline text-[9.5px]">Split Right</span>
                  </button>

                  <button
                    onClick={() => onSplitTab("horizontal")}
                    aria-label="Split Terminal Down (Horizontal)"
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                    title="Split Terminal Horizontally (Stacked) [⌘⇧\]"
                  >
                    <Rows className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline text-[9.5px]">Split Down</span>
                  </button>

                  {isSplitActive && onUnsplit && (
                    <button
                      onClick={onUnsplit}
                      aria-label="Unsplit terminal panes"
                      className="p-1 rounded hover:bg-zinc-800 text-purple-300 hover:text-purple-200 cursor-pointer flex items-center gap-1"
                      title="Collapse to Single Active Tab"
                    >
                      <Maximize2 className="w-3 h-3 text-purple-400" />
                      <span className="hidden sm:inline text-[9.5px]">Single</span>
                    </button>
                  )}
                </div>
              )}

              {/* Clear Output Buffer */}
              {onClearTabOutput && (
                <button
                  onClick={() => onClearTabOutput(effectiveFocusedId)}
                  aria-label="Clear active terminal buffer"
                  className="min-h-[26px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-[#27272a] transition-all cursor-pointer flex items-center gap-1 focus:outline-none"
                  title="Clear Terminal Output"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden md:inline">Clear</span>
                </button>
              )}

              {/* Restart Terminal */}
              <button
                onClick={() => onRestartTab(effectiveFocusedId)}
                aria-label="Restart terminal shell process"
                className="min-h-[26px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/30 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                title="Restart Terminal Process"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>

              {/* Kill Terminal */}
              <button
                onClick={() => onCloseTab(effectiveFocusedId)}
                aria-label="Kill terminal shell process"
                className="min-h-[26px] px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
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
                className="min-h-[26px] px-2 py-0.5 rounded bg-[#151520] hover:bg-[#1f1f24] text-zinc-300 border border-[#26262e] transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
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
                className="min-h-[26px] px-2 py-0.5 rounded bg-[#151520] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-[#26262e] transition-all cursor-pointer flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
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
              className="min-w-[26px] min-h-[26px] p-1 rounded text-zinc-500 hover:text-zinc-200 transition-all cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              title="Hide Terminal Panel (⌘`)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Panel Content Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#050507] overflow-hidden">
        
        {/* 1. Terminal Mode: Single or Multiplexed Split Panes */}
        {activeMode === "terminal" && (
          paneTabs.length > 0 ? (
            <div
              className={`flex-1 flex min-h-0 min-w-0 ${
                isSplitActive
                  ? splitLayout === "horizontal"
                    ? "flex-col divide-y divide-[#1f1f28]"
                    : "flex-row divide-x divide-[#1f1f28]"
                  : "flex-col"
              }`}
            >
              {paneTabs.map((tab) => (
                <SingleTerminalPane
                  key={tab.id}
                  tab={tab}
                  isFocused={tab.id === effectiveFocusedId}
                  isSplit={isSplitActive}
                  onFocus={() => {
                    if (onFocusPane) onFocusPane(tab.id);
                    onSelectTab(tab.id);
                  }}
                  onSendInput={onSendInput}
                  onClose={isSplitActive ? () => onCloseTab(tab.id) : undefined}
                  onAskAiAboutDiagnostic={onAskAiAboutDiagnostic}
                  onOpenLocation={onOpenLocation}
                  onSendSelectionToAi={onSendSelectionToAi}
                />
              ))}
            </div>
          ) : (
            <div
              className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-xs cursor-pointer"
              onClick={() => onCreateTab()}
            >
              <span>
                No active terminal. Click <strong className="text-cyan-400">+</strong> to open a shell.
              </span>
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
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Python Execution Stream:
                </div>
                <div className="p-2 rounded bg-[#0a0a0d] border border-[#1f1f24] whitespace-pre-wrap text-zinc-200 font-mono text-xs">
                  {pythonOutput}
                </div>
              </div>
            )}

            {debugLogs.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                  Debugger Trace Steps:
                </div>
                {debugLogs.map((dLog, idx) => (
                  <div key={idx} className="p-1 rounded bg-[#0a0a0d] border border-[#1a1a20] text-zinc-300">
                    {dLog}
                  </div>
                ))}
              </div>
            ) : (
              !pythonOutput && (
                <div className="text-zinc-600 italic">
                  No active debugger session. Press F5 to start tracing.
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

