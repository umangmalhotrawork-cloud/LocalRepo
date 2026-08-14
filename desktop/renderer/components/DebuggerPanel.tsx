import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  Bug,
  Terminal,
  Layers,
  ArrowRight,
  Activity,
  AlertTriangle,
  Network,
} from "lucide-react";
import { DebugStep } from "../../runtime/pythonTimeTravelDebugger";
import ExecutionGraphPanel from "./ExecutionGraphPanel";

interface DebuggerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  steps: DebugStep[];
  currentIndex: number;
  onStepChange: (index: number | ((prev: number) => number)) => void;
  onRestart: () => void;
  error?: string;
}

export default function DebuggerPanel({
  isOpen,
  onClose,
  steps,
  currentIndex,
  onStepChange,
  onRestart,
  error,
}: DebuggerPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [panelTab, setPanelTab] = useState<"timeline" | "graph">("timeline");
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = steps[currentIndex] || null;
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : null;

  // Track variables that changed in this step
  const changedVars = useMemo(() => {
    if (!currentStep) return new Set<string>();
    const changed = new Set<string>();
    const prevLocals = previousStep ? previousStep.locals : {};

    for (const [k, v] of Object.entries(currentStep.locals)) {
      if (prevLocals[k] === undefined || JSON.stringify(prevLocals[k]) !== JSON.stringify(v)) {
        changed.add(k);
      }
    }
    return changed;
  }, [currentStep, previousStep]);

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
            <span>TIME-TRAVEL DEBUGGER</span>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-[#121216] p-0.5 rounded-lg border border-[#27272a]">
            <button
              onClick={() => setPanelTab("timeline")}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                panelTab === "timeline"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="w-3 h-3" />
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
              <span>Execution Graph</span>
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

        {/* Center Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onRestart}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Restart Session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            disabled={currentIndex <= 0}
            onClick={() => onStepChange(Math.max(0, currentIndex - 1))}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-300 hover:text-cyan-300 disabled:opacity-30 transition-colors cursor-pointer"
            title="Step Backward (Shift+F10)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            disabled={totalSteps === 0}
            onClick={() => setIsPlaying((prev) => !prev)}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 font-bold text-[11px] transition-all cursor-pointer ${
              isPlaying
                ? "bg-amber-950 text-amber-300 border border-amber-500/50"
                : "bg-cyan-950 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900"
            }`}
            title={isPlaying ? "Pause Playback" : "Auto Replay"}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            disabled={currentIndex >= totalSteps - 1}
            onClick={() => onStepChange(Math.min(totalSteps - 1, currentIndex + 1))}
            className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-300 hover:text-cyan-300 disabled:opacity-30 transition-colors cursor-pointer"
            title="Step Forward (F10)"
          >
            <SkipForward className="w-3.5 h-3.5" />
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

      {/* Main Content Area: Timeline View or Graph View */}
      {panelTab === "graph" ? (
        <div className="flex-1 h-full overflow-hidden">
          <ExecutionGraphPanel
            steps={steps}
            currentIndex={currentIndex}
            onSelectStep={(idx) => onStepChange(idx)}
          />
        </div>
      ) : (
        /* Main Inspection Grid (Variables Table + Stdout Console) */
        <div className="flex-1 grid grid-cols-2 overflow-hidden bg-[#050507]">
          {/* Variable Inspector */}
          <div className="h-full border-r border-[#1f1f1f] flex flex-col overflow-hidden">
            <div className="h-7 bg-[#0a0a0e] border-b border-[#1f1f1f] px-2.5 flex items-center justify-between text-zinc-400 text-[10.5px]">
              <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Variable Snapshots (Locals)</span>
              </div>
              {currentStep && (
                <span className="text-[10px] text-zinc-500">
                  {Object.keys(currentStep.locals).length} active
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px]">
              {currentStep && Object.keys(currentStep.locals).length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1a1a22] text-[10px] text-zinc-500 uppercase">
                      <th className="pb-1 font-semibold">Name</th>
                      <th className="pb-1 font-semibold">Type</th>
                      <th className="pb-1 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15151c]">
                    {Object.entries(currentStep.locals).map(([name, val]) => {
                      const isChanged = changedVars.has(name);
                      const typeStr = Array.isArray(val)
                        ? "list"
                        : typeof val === "object" && val !== null
                        ? "dict"
                        : typeof val;

                      return (
                        <tr
                          key={name}
                          className={`transition-colors ${
                            isChanged ? "bg-cyan-950/40 text-cyan-200 font-bold" : "text-zinc-300 hover:bg-[#0c0c10]"
                          }`}
                        >
                          <td className="py-1 pr-2 flex items-center gap-1">
                            {isChanged && <ArrowRight className="w-2.5 h-2.5 text-cyan-400 shrink-0" />}
                            <span className="text-cyan-400">{name}</span>
                          </td>
                          <td className="py-1 pr-2 text-zinc-500 text-[10px]">{typeStr}</td>
                          <td className="py-1 text-emerald-400 truncate max-w-xs" title={JSON.stringify(val)}>
                            {JSON.stringify(val)}
                          </td>
                        </tr>
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
