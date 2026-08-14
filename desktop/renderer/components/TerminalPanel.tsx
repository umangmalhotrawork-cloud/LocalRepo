"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Plus, X, RotateCcw, Square, ChevronRight } from "lucide-react";
import { TerminalTab } from "../hooks/useTerminal";

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCreateTab: () => void;
  onCloseTab: (id: string) => void;
  onRestartTab: (id: string) => void;
  onSendInput: (id: string, input: string) => void;
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
  onClosePanel,
}: TerminalPanelProps) {
  const [commandInput, setCommandInput] = useState<string>("");
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Auto-scroll logic with manual scroll lock when user scrolls upward
  useEffect(() => {
    const el = outputContainerRef.current;
    if (!el || userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeTab?.output]);

  const handleScroll = () => {
    const el = outputContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && activeTab) {
      e.preventDefault();
      onSendInput(activeTab.id, commandInput + "\n");
      setCommandInput("");
      userScrolledUpRef.current = false;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050507] border-t border-[#1f1f1f] font-mono text-xs select-none">
      {/* Header Toolbar & Tabs */}
      <div className="h-8 bg-[#0a0a0d] border-b border-[#1f1f1f] flex items-center justify-between px-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <div className="flex items-center gap-1 text-cyan-400 font-bold text-[11px] pr-2 border-r border-[#1f1f1f]">
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>TERMINAL</span>
          </div>

          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group px-2.5 py-1 rounded-t-md flex items-center gap-2 cursor-pointer transition-all border-t border-x text-[11px] ${
                activeTabId === tab.id
                  ? "bg-[#050507] text-cyan-300 border-cyan-500/40 font-bold shadow-sm"
                  : "bg-[#0d0d10] text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {/* Process Status Badge */}
              {tab.status === "running" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Running ●" />
              )}
              {tab.status === "exited" && (
                <span className="w-2 h-2 rounded-full bg-zinc-500" title="Exited ●" />
              )}
              {tab.status === "error" && (
                <span className="w-2 h-2 rounded-full bg-rose-500" title="Error ●" />
              )}

              <span>{tab.name}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="opacity-50 hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={onCreateTab}
            className="p-1 rounded bg-[#18181b] hover:bg-[#27272a] text-zinc-300 border border-[#27272a] transition-all cursor-pointer"
            title="Create New Terminal Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Controls */}
        {activeTab && (
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="text-zinc-500 hidden sm:inline">CWD: <strong className="text-purple-300">{activeTab.cwd}</strong></span>

            <button
              onClick={() => onRestartTab(activeTab.id)}
              className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/30 font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Restart Terminal Process"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restart</span>
            </button>

            <button
              onClick={() => onCloseTab(activeTab.id)}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Kill Terminal Process"
            >
              <Square className="w-3 h-3 fill-rose-300" />
              <span>Kill</span>
            </button>

            {onClosePanel && (
              <button
                onClick={onClosePanel}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-all cursor-pointer"
                title="Hide Terminal Panel (Cmd+`)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Terminal Output Display */}
      {activeTab ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#050507]">
          <div
            ref={outputContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300"
          >
            {activeTab.output.length > 0 ? (
              activeTab.output.map((line, idx) => <div key={idx}>{line}</div>)
            ) : (
              <div className="text-zinc-600 italic">Terminal process started. Ready for input...</div>
            )}
          </div>

          {/* Interactive Shell Input Prompt Bar */}
          <div className="px-3 py-1.5 bg-[#0a0a0d] border-t border-[#1f1f1f] flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
              <span>$</span>
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type command (e.g. node -v, python --version, npm run dev)..."
              className="flex-1 bg-transparent text-cyan-200 outline-none font-mono text-xs placeholder:text-zinc-600"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-xs">
          <span>No active terminal. Click <strong>+</strong> to open a shell.</span>
        </div>
      )}
    </div>
  );
}
