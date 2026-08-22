"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Square,
  X,
  Bug,
  Terminal,
  Layers,
  ArrowRight,
  Activity,
  AlertTriangle,
  Network,
  Eye,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ListTree,
  Send,
  CornerDownLeft,
} from "lucide-react";
import { DebugStep } from "../../runtime/pythonTimeTravelDebugger";
import ExecutionGraphPanel from "./ExecutionGraphPanel";

export interface StackFrameItem {
  id: string;
  name: string;
  file?: string;
  filePath?: string;
  line: number;
  order?: number;
}

export interface WatchItem {
  id: string;
  expression: string;
  value?: any;
  error?: string;
  status: "evaluated" | "error" | "unavailable";
}

interface DebuggerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  steps: DebugStep[];
  currentIndex: number;
  onStepChange: (index: number | ((prev: number) => number)) => void;
  onRestart: () => void;
  onContinue?: () => void;
  onPause?: () => void;
  onStepOver?: () => void;
  onStepInto?: () => void;
  onStepOut?: () => void;
  onStop?: () => void;
  onSelectFrame?: (frame: StackFrameItem) => void;
  callStack?: StackFrameItem[];
  watchExpressions?: WatchItem[];
  onAddWatch?: (expr: string) => void;
  onRemoveWatch?: (id: string) => void;
  onEvaluateConsole?: (expr: string) => Promise<{ success: boolean; value?: any; error?: string }>;
  error?: string;
}

export default function DebuggerPanel({
  isOpen,
  onClose,
  steps,
  currentIndex,
  onStepChange,
  onRestart,
  onContinue,
  onPause,
  onStepOver,
  onStepInto,
  onStepOut,
  onStop,
  onSelectFrame,
  callStack = [],
  watchExpressions = [],
  onAddWatch,
  onRemoveWatch,
  onEvaluateConsole,
  error,
}: DebuggerPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [panelTab, setPanelTab] = useState<"timeline" | "variables" | "callstack" | "watch" | "console" | "graph">("variables");
  const [newWatchInput, setNewWatchInput] = useState("");
  const [isAddingWatch, setIsAddingWatch] = useState(false);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<Array<{ expr: string; result: string; isError: boolean; time: string }>>([]);
  const [expandedVarKeys, setExpandedVarKeys] = useState<Record<string, boolean>>({});
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = steps[currentIndex] || null;
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : null;

  // Track variables that changed in this step
  const changedVars = useMemo(() => {
    if (!currentStep) return new Set<string>();
    const changed = new Set<string>();
    const prevLocals = previousStep ? previousStep.locals : {};

    for (const [k, v] of Object.entries(currentStep.locals || {})) {
      if (prevLocals[k] === undefined || JSON.stringify(prevLocals[k]) !== JSON.stringify(v)) {
        changed.add(k);
      }
    }
    return changed;
  }, [currentStep, previousStep]);

  // Derive callstack from step if not provided externally
  const activeCallStack = useMemo<StackFrameItem[]>(() => {
    if (callStack && callStack.length > 0) return callStack;
    if (currentStep && (currentStep as any).callStack) {
      return (currentStep as any).callStack;
    }
    if (currentStep) {
      return [
        {
          id: "frame_0",
          name: currentStep.functionName || "<global>",
          line: currentStep.line,
          order: 0,
        },
      ];
    }
    return [];
  }, [callStack, currentStep]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        onStepChange((prev: number) => {
          const nextIdx = prev + 1;
          if (nextIdx >= steps.length) {
            setIsPlaying(false);
            return steps.length - 1;
          }
          return nextIdx;
        });
      }, 500);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, steps.length, onStepChange]);

  const handleConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    const expr = consoleInput.trim();
    setConsoleInput("");

    if (onEvaluateConsole) {
      const res = await onEvaluateConsole(expr);
      const now = new Date().toLocaleTimeString();
      setConsoleLogs((prev) => [
        ...prev,
        {
          expr,
          result: res.success ? (typeof res.value === "object" ? JSON.stringify(res.value) : String(res.value)) : (res.error || "Evaluation failed"),
          isError: !res.success,
          time: now,
        },
      ]);
    } else if (currentStep) {
      // Evaluate against current step locals/globals
      const rawVars = { ...(currentStep.globals || {}), ...(currentStep.locals || {}) };
      const now = new Date().toLocaleTimeString();
      try {
        const val = rawVars[expr];
        const resStr = val !== undefined ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : `ReferenceError: ${expr} is not defined`;
        setConsoleLogs((prev) => [
          ...prev,
          {
            expr,
            result: resStr,
            isError: val === undefined,
            time: now,
          },
        ]);
      } catch (err: any) {
        setConsoleLogs((prev) => [
          ...prev,
          {
            expr,
            result: err.message,
            isError: true,
            time: now,
          },
        ]);
      }
    }
  };

  const toggleVarExpand = (key: string) => {
    setExpandedVarKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const currentLine = currentStep ? currentStep.line : 0;
  const currentFunc = currentStep?.functionName;

  return (
    <div className="h-72 bg-[#070709] border-t border-[#1f1f1f] flex flex-col font-mono text-xs select-none overflow-hidden shrink-0 z-30">
      {/* Top Controls Toolbar */}
      <div className="h-9 bg-[#0b0b0f] border-b border-[#1f1f1f] px-3 flex items-center justify-between shrink-0">
        {/* Left Status & Tab Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px] pr-1 border-r border-[#1f1f1f]">
            <Bug className="w-4 h-4 text-cyan-400" />
            <span>UNIFIED DEBUGGER</span>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-0.5 bg-[#121216] p-0.5 rounded-lg border border-[#27272a]">
            <button
              onClick={() => setPanelTab("variables")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "variables"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Variables</span>
            </button>
            <button
              onClick={() => setPanelTab("callstack")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "callstack"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <ListTree className="w-3 h-3" />
              <span>Call Stack ({activeCallStack.length})</span>
            </button>
            <button
              onClick={() => setPanelTab("watch")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "watch"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Watch</span>
            </button>
            <button
              onClick={() => setPanelTab("console")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "console"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Debug Console</span>
            </button>
            <button
              onClick={() => setPanelTab("timeline")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "timeline"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setPanelTab("graph")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "graph"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Network className="w-3 h-3" />
              <span>Graph</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#141418] px-2 py-0.5 rounded border border-[#27272a] text-[10.5px]">
            <span className="text-zinc-500">Step:</span>
            <span className="text-cyan-300 font-bold">
              {totalSteps > 0 ? currentIndex + 1 : 0}
            </span>
            <span className="text-zinc-500">/ {totalSteps}</span>
          </div>

          {currentStep && (
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-bold">
                Line {currentLine}
              </span>
              {currentFunc && (
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                  fn: {currentFunc}()
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center Playback & Stepping Controls */}
        <div className="flex items-center gap-1">
          {/* Continue / Pause */}
          <button
            onClick={() => {
              if (onContinue) onContinue();
              else if (onStepOver) onStepOver();
              else onStepChange((prev) => Math.min(totalSteps - 1, prev + 1));
            }}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            title="Continue / Resume (F5)"
          >
            <Play className="w-3.5 h-3.5" />
          </button>

          {/* Step Over */}
          <button
            disabled={currentIndex >= totalSteps - 1}
            onClick={() => {
              if (onStepOver) onStepOver();
              else onStepChange(Math.min(totalSteps - 1, currentIndex + 1));
            }}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-300 hover:text-cyan-300 disabled:opacity-30 transition-colors cursor-pointer"
            title="Step Over (F10)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Step Into */}
          <button
            disabled={currentIndex >= totalSteps - 1}
            onClick={() => {
              if (onStepInto) onStepInto();
              else onStepChange(Math.min(totalSteps - 1, currentIndex + 1));
            }}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-300 hover:text-cyan-300 disabled:opacity-30 transition-colors cursor-pointer"
            title="Step Into (F11)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Step Backward (Time Travel) */}
          <button
            disabled={currentIndex <= 0}
            onClick={() => onStepChange(Math.max(0, currentIndex - 1))}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-300 hover:text-cyan-300 disabled:opacity-30 transition-colors cursor-pointer"
            title="Step Backward (Shift+F10)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Restart Session (Ctrl+Shift+F5)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Stop */}
          <button
            onClick={() => {
              if (onStop) onStop();
              onClose();
            }}
            className="p-1.5 rounded hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            title="Stop Debugging (Shift+F5)"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Close Button */}
        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
          title="Close Debugger (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrubbable Timeline Slider */}
      <div className="h-6 bg-[#09090d] border-b border-[#1f1f1f] px-3 flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">0</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={currentIndex}
          onChange={(e) => onStepChange(Number(e.target.value))}
          disabled={totalSteps <= 1}
          className="flex-1 h-1.5 bg-[#1a1a22] rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-[10px] text-zinc-500 font-mono">{Math.max(0, totalSteps - 1)}</span>
      </div>

      {/* Main Content Area */}
      {panelTab === "graph" ? (
        <div className="flex-1 h-full overflow-hidden">
          <ExecutionGraphPanel
            steps={steps}
            currentIndex={currentIndex}
            onSelectStep={(idx) => onStepChange(idx)}
          />
        </div>
      ) : panelTab === "callstack" ? (
        /* Call Stack Tab */
        <div className="flex-1 overflow-y-auto p-2 bg-[#050507] font-mono text-[11px]">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-cyan-400" />
            <span>Call Stack Frames</span>
          </div>
          {activeCallStack.length > 0 ? (
            <div className="space-y-1">
              {activeCallStack.map((frame, idx) => (
                <div
                  key={frame.id || idx}
                  onClick={() => onSelectFrame && onSelectFrame(frame)}
                  className={`p-2 rounded border transition-colors cursor-pointer flex items-center justify-between ${
                    idx === 0
                      ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-200"
                      : "bg-[#0c0c10] border-[#1f1f26] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-bold">#{frame.order ?? idx}</span>
                    <span className="font-bold text-zinc-200">{frame.name || "<anonymous>"}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    <span>{frame.file || frame.filePath || "module"}</span>
                    <span className="text-cyan-400 font-bold ml-1.5">:L{frame.line}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
              No active call stack frames available
            </div>
          )}
        </div>
      ) : panelTab === "watch" ? (
        /* Watch Expressions Tab */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050507]">
          <div className="h-8 bg-[#0a0a0e] border-b border-[#1f1f1f] px-2.5 flex items-center justify-between">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Watch Expressions</span>
            </span>
            <button
              onClick={() => setIsAddingWatch(true)}
              className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Watch</span>
            </button>
          </div>

          {isAddingWatch && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newWatchInput.trim() && onAddWatch) {
                  onAddWatch(newWatchInput.trim());
                  setNewWatchInput("");
                  setIsAddingWatch(false);
                }
              }}
              className="p-2 border-b border-[#1f1f1f] bg-[#0c0c12] flex items-center gap-2"
            >
              <input
                autoFocus
                type="text"
                value={newWatchInput}
                onChange={(e) => setNewWatchInput(e.target.value)}
                placeholder="Expression to watch (e.g. user.id, cart.total, items.length)"
                className="flex-1 px-2 py-1 bg-[#050508] border border-[#242436] rounded text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-cyan-400 text-black rounded font-bold text-xs cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingWatch(false)}
                className="px-2 py-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1">
            {watchExpressions.length > 0 ? (
              watchExpressions.map((w) => (
                <div
                  key={w.id}
                  className="p-2 rounded bg-[#0b0b10] border border-[#1a1a24] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{w.expression}:</span>
                    {w.error ? (
                      <span className="text-rose-400 text-[10.5px]">{w.error}</span>
                    ) : w.value !== undefined ? (
                      <span className="text-emerald-400 font-mono">{typeof w.value === "object" ? JSON.stringify(w.value) : String(w.value)}</span>
                    ) : (
                      <span className="text-zinc-600 italic">unavailable</span>
                    )}
                  </div>
                  {onRemoveWatch && (
                    <button
                      onClick={() => onRemoveWatch(w.id)}
                      className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer"
                      title="Remove Watch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                No watch expressions. Click "Add Watch" to monitor expressions.
              </div>
            )}
          </div>
        </div>
      ) : panelTab === "console" ? (
        /* Debug Console Tab */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050507]">
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-2">
            {consoleLogs.length > 0 ? (
              consoleLogs.map((log, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                    <span className="text-cyan-400 font-bold">&gt;</span>
                    <span className="text-zinc-300">{log.expr}</span>
                    <span className="text-zinc-600 ml-auto">{log.time}</span>
                  </div>
                  <div className={`pl-3 text-[11px] ${log.isError ? "text-rose-400" : "text-emerald-300"}`}>
                    {log.result}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                Debug Console ready. Evaluate expressions against current stack frame below.
              </div>
            )}
          </div>

          <form onSubmit={handleConsoleSubmit} className="h-8 bg-[#0a0a0e] border-t border-[#1f1f1f] px-2 flex items-center gap-2 shrink-0">
            <span className="text-cyan-400 font-bold">&gt;</span>
            <input
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              placeholder="Evaluate expression in paused scope..."
              className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono"
            />
            <button type="submit" className="text-cyan-400 hover:text-cyan-300 p-1 cursor-pointer">
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Default Variables & Output Split View */
        <div className="flex-1 grid grid-cols-2 overflow-hidden bg-[#050507]">
          {/* Variable Inspector */}
          <div className="h-full border-r border-[#1f1f1f] flex flex-col overflow-hidden">
            <div className="h-7 bg-[#0a0a0e] border-b border-[#1f1f1f] px-2.5 flex items-center justify-between text-zinc-400 text-[10.5px]">
              <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Variables (Locals & Globals)</span>
              </div>
              {currentStep && (
                <span className="text-[10px] text-zinc-500">
                  {Object.keys(currentStep.locals || {}).length} active
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px]">
              {currentStep && Object.keys(currentStep.locals || {}).length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1a1a22] text-[10px] text-zinc-500 uppercase">
                      <th className="pb-1 font-semibold">Name</th>
                      <th className="pb-1 font-semibold">Type</th>
                      <th className="pb-1 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15151c]">
                    {Object.entries(currentStep.locals || {}).map(([name, val]) => {
                      const isChanged = changedVars.has(name);
                      const isObj = typeof val === "object" && val !== null;
                      const isExpanded = expandedVarKeys[name];
                      const typeStr = Array.isArray(val)
                        ? "Array(" + val.length + ")"
                        : isObj
                        ? "Object"
                        : typeof val;

                      return (
                        <React.Fragment key={name}>
                          <tr
                            className={`transition-colors ${
                              isChanged ? "bg-cyan-950/40 text-cyan-200 font-bold" : "text-zinc-300 hover:bg-[#0c0c10]"
                            }`}
                          >
                            <td className="py-1 pr-2 flex items-center gap-1">
                              {isObj && (
                                <button
                                  onClick={() => toggleVarExpand(name)}
                                  className="text-zinc-500 hover:text-white p-0.5 cursor-pointer"
                                >
                                  {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                </button>
                              )}
                              {isChanged && <ArrowRight className="w-2.5 h-2.5 text-cyan-400 shrink-0" />}
                              <span className="text-cyan-400">{name}</span>
                            </td>
                            <td className="py-1 pr-2 text-zinc-500 text-[10px]">{typeStr}</td>
                            <td className="py-1 text-emerald-400 truncate max-w-xs" title={JSON.stringify(val)}>
                              {JSON.stringify(val)}
                            </td>
                          </tr>
                          {isObj && isExpanded && (
                            <tr>
                              <td colSpan={3} className="pl-6 py-1 bg-[#030306] border-l-2 border-cyan-500/30">
                                <div className="space-y-0.5 text-[10.5px]">
                                  {Object.entries(val).map(([k, childVal]) => (
                                    <div key={k} className="flex items-center gap-2">
                                      <span className="text-purple-400">{k}:</span>
                                      <span className="text-zinc-300">{JSON.stringify(childVal)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                  No local variables in current stack frame
                </div>
              )}
            </div>
          </div>

          {/* Stdout / Stderr Stream */}
          <div className="h-full flex flex-col overflow-hidden bg-[#050507]">
            <div className="h-7 bg-[#0a0a0e] border-b border-[#1f1f1f] px-2.5 flex items-center justify-between text-zinc-400 text-[10.5px]">
              <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>Program Stdout / Stderr Output</span>
              </div>
              {error && (
                <div className="flex items-center gap-1 text-rose-400 text-[10px]">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Runtime Exception</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-tight space-y-1">
              {currentStep?.stdout && (
                <div className="text-emerald-300">{currentStep.stdout}</div>
              )}
              {currentStep?.stderr && (
                <div className="text-rose-400">{currentStep.stderr}</div>
              )}
              {!currentStep?.stdout && !currentStep?.stderr && (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                  No stdout output produced at this step
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
