"use client";

import React, { useState, useMemo } from "react";
import {
  Flame,
  Activity,
  Cpu,
  Database,
  Layers,
  Clock,
  Download,
  Trash2,
  Play,
  RotateCcw,
  ArrowUpDown,
  FileCode,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useProfiler, ReactMetric, TimelineEvent } from "../hooks/useProfiler";
import { ProfileFunction } from "../../runtime/pythonProfiler";

interface ProfilerPanelProps {
  profiler: ReturnType<typeof useProfiler>;
  activeCode: string;
  activeFilePath: string;
  onSelectFile: (filePath: string, line?: number) => void;
}

export default function ProfilerPanel({
  profiler,
  activeCode,
  activeFilePath,
  onSelectFile,
}: ProfilerPanelProps) {
  const {
    cpuProfile,
    memoryProfile,
    jsProfile,
    reactMetrics,
    timelineEvents,
    isProfiling,
    profilePython,
    profileJs,
    clearProfile,
    exportProfile,
  } = profiler;

  const [activeTab, setActiveTab] = useState<"hotpath" | "memory" | "react">("hotpath");
  const [sortField, setSortField] = useState<"cumulativeTime" | "totalTime" | "calls">("cumulativeTime");
  const [sortAsc, setSortAsc] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  const functionsList: ProfileFunction[] = useMemo(() => {
    const list = cpuProfile?.functions || (jsProfile?.functions as ProfileFunction[]) || [];
    return [...list].sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [cpuProfile, jsProfile, sortField, sortAsc]);

  const totalCpuTime = cpuProfile?.totalTime || jsProfile?.totalTime || 0;
  const peakMemoryKb = memoryProfile?.peakMemoryKb || 0;
  const totalRenders = reactMetrics.reduce((acc, m) => acc + m.renderCount, 0);
  const slowestFunction = functionsList[0]?.name || "N/A";

  const maxTimelineDuration = useMemo(() => {
    if (timelineEvents.length === 0) return 100;
    return Math.max(...timelineEvents.map((e) => e.startMs + e.durationMs), 50);
  }, [timelineEvents]);

  const handleSort = (field: "cumulativeTime" | "totalTime" | "calls") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#050508] border-r border-[#1f1f24] overflow-hidden">
      {/* Top Header & Actions */}
      <div className="h-11 bg-[#09090d] border-b border-[#1f1f24] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            Performance Profiler
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => profilePython(activeCode, activeFilePath)}
            disabled={isProfiling}
            className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
            title="Profile active Python file (F7)"
          >
            <Play className="w-3 h-3 fill-amber-400" />
            <span>Profile Python</span>
          </button>

          <button
            onClick={() => profileJs(activeCode, activeFilePath)}
            disabled={isProfiling}
            className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
            title="Profile active JavaScript/TypeScript code"
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>Profile JS</span>
          </button>

          <button
            onClick={exportProfile}
            className="p-1.5 rounded-lg bg-[#14141c] hover:bg-[#1f1f28] border border-[#272730] text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Export Profiler Report (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={clearProfile}
            className="p-1.5 rounded-lg hover:bg-rose-950 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
            title="Clear Profiling Data"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="p-3 grid grid-cols-4 gap-2.5 border-b border-[#1f1f24] bg-[#07070b] shrink-0">
        <div className="p-2 rounded-xl bg-[#0d0d14] border border-[#1f1f28] space-y-1">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Total CPU Time</span>
          </div>
          <div className="text-sm font-bold text-cyan-300 font-mono">
            {totalCpuTime} <span className="text-[10px] font-normal text-zinc-500">ms</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-[#0d0d14] border border-[#1f1f28] space-y-1">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Database className="w-3 h-3 text-amber-400" />
            <span>Peak Memory</span>
          </div>
          <div className="text-sm font-bold text-amber-300 font-mono">
            {peakMemoryKb} <span className="text-[10px] font-normal text-zinc-500">KB</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-[#0d0d14] border border-[#1f1f28] space-y-1">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>React Renders</span>
          </div>
          <div className="text-sm font-bold text-purple-300 font-mono">
            {totalRenders} <span className="text-[10px] font-normal text-zinc-500">renders</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-[#0d0d14] border border-[#1f1f28] space-y-1 truncate">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Slowest Hotspot</span>
          </div>
          <div className="text-xs font-bold text-rose-300 font-mono truncate" title={slowestFunction}>
            {slowestFunction}
          </div>
        </div>
      </div>

      {/* Flame-Chart Style Horizontal Timeline */}
      <div className="p-3 border-b border-[#1f1f24] bg-[#08080c] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-zinc-400 font-bold uppercase tracking-wider">
            Execution Timeline (Flame Chart)
          </span>
          <span className="text-[10px] text-zinc-500">
            {maxTimelineDuration.toFixed(1)} ms total span
          </span>
        </div>

        <div className="h-16 w-full rounded-xl bg-[#0d0d14] border border-[#1f1f28] p-2 relative overflow-hidden flex flex-col justify-center">
          {timelineEvents.length === 0 ? (
            <div className="text-center text-zinc-600 text-[11px]">
              Run a profiling session to generate execution timeline.
            </div>
          ) : (
            <div className="relative w-full h-8 flex items-center">
              {timelineEvents.map((evt) => {
                const leftPct = (evt.startMs / maxTimelineDuration) * 100;
                const widthPct = Math.max(2, (evt.durationMs / maxTimelineDuration) * 100);

                const bgClass =
                  evt.type === "cpu"
                    ? "bg-cyan-600 hover:bg-cyan-500 border-cyan-400/50"
                    : evt.type === "memory"
                    ? "bg-amber-600 hover:bg-amber-500 border-amber-400/50"
                    : "bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50";

                return (
                  <div
                    key={evt.id}
                    onMouseEnter={() => setHoveredEvent(evt)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    className={`absolute h-6 rounded-md border text-[9px] text-black font-bold flex items-center justify-center truncate px-1 transition-all cursor-pointer shadow-sm ${bgClass}`}
                  >
                    {evt.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hoveredEvent && (
          <div className="text-[10px] text-cyan-300 bg-[#121218] p-1.5 rounded-lg border border-[#272730] flex items-center justify-between">
            <span>Event: <strong>{hoveredEvent.label}</strong> ({hoveredEvent.type.toUpperCase()})</span>
            <span>Duration: {hoveredEvent.durationMs}ms | Start: {hoveredEvent.startMs}ms</span>
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="h-9 bg-[#0b0b10] border-b border-[#1f1f24] px-3 flex items-center gap-1 shrink-0">
        <button
          onClick={() => setActiveTab("hotpath")}
          className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
            activeTab === "hotpath"
              ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Hot Paths (CPU)
        </button>

        <button
          onClick={() => setActiveTab("memory")}
          className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
            activeTab === "memory"
              ? "bg-amber-950 text-amber-300 border border-amber-500/40"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Memory Allocations
        </button>

        <button
          onClick={() => setActiveTab("react")}
          className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
            activeTab === "react"
              ? "bg-purple-950 text-purple-300 border border-purple-500/40"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          React Component Renders ({reactMetrics.length})
        </button>
      </div>

      {/* Tab Tables */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "hotpath" && (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#1f1f24]">
              <div className="col-span-4">Function</div>
              <div
                className="col-span-2 text-right cursor-pointer hover:text-zinc-300 flex items-center justify-end gap-1"
                onClick={() => handleSort("calls")}
              >
                <span>Calls</span>
                <ArrowUpDown className="w-2.5 h-2.5" />
              </div>
              <div
                className="col-span-2 text-right cursor-pointer hover:text-zinc-300 flex items-center justify-end gap-1"
                onClick={() => handleSort("totalTime")}
              >
                <span>Total (ms)</span>
                <ArrowUpDown className="w-2.5 h-2.5" />
              </div>
              <div
                className="col-span-2 text-right cursor-pointer hover:text-zinc-300 flex items-center justify-end gap-1"
                onClick={() => handleSort("cumulativeTime")}
              >
                <span>Cum (ms)</span>
                <ArrowUpDown className="w-2.5 h-2.5" />
              </div>
              <div className="col-span-2 text-right">Location</div>
            </div>

            {/* Table Rows */}
            {functionsList.map((fn, idx) => (
              <div
                key={idx}
                onClick={() => onSelectFile(fn.file, fn.line)}
                className="grid grid-cols-12 gap-2 p-2 rounded-xl bg-[#09090e] hover:bg-[#121218] border border-[#1a1a24] hover:border-cyan-500/30 transition-all cursor-pointer items-center text-[11px]"
              >
                <div className="col-span-4 font-bold text-zinc-200 truncate flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{fn.name}</span>
                </div>
                <div className="col-span-2 text-right text-zinc-400">{fn.calls}</div>
                <div className="col-span-2 text-right text-zinc-300 font-mono">{fn.totalTime}</div>
                <div className="col-span-2 text-right font-bold text-cyan-400 font-mono">
                  {fn.cumulativeTime}
                </div>
                <div className="col-span-2 text-right text-zinc-500 text-[10px] truncate">
                  {fn.file}:{fn.line}
                </div>
              </div>
            ))}

            {functionsList.length === 0 && (
              <div className="py-12 text-center text-zinc-600 text-xs">
                No CPU profile data available. Click "Profile Python" to analyze.
              </div>
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#1f1f24]">
              <div className="col-span-6">File & Line</div>
              <div className="col-span-3 text-right">Size (KB)</div>
              <div className="col-span-3 text-right">Allocations</div>
            </div>

            {/* Table Rows */}
            {(memoryProfile?.topAllocations || []).map((alloc, idx) => (
              <div
                key={idx}
                onClick={() => onSelectFile(alloc.file, alloc.line)}
                className="grid grid-cols-12 gap-2 p-2 rounded-xl bg-[#09090e] hover:bg-[#121218] border border-[#1a1a24] hover:border-amber-500/30 transition-all cursor-pointer items-center text-[11px]"
              >
                <div className="col-span-6 font-bold text-zinc-200 truncate flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{alloc.file}:{alloc.line}</span>
                </div>
                <div className="col-span-3 text-right font-bold text-amber-400 font-mono">
                  {alloc.sizeKb} KB
                </div>
                <div className="col-span-3 text-right text-zinc-400 font-mono">{alloc.count}</div>
              </div>
            ))}

            {(!memoryProfile || memoryProfile.topAllocations.length === 0) && (
              <div className="py-12 text-center text-zinc-600 text-xs">
                No memory allocation data available.
              </div>
            )}
          </div>
        )}

        {activeTab === "react" && (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#1f1f24]">
              <div className="col-span-4">Component</div>
              <div className="col-span-2 text-right">Renders</div>
              <div className="col-span-2 text-right">Avg (ms)</div>
              <div className="col-span-2 text-right">Last (ms)</div>
              <div className="col-span-2 text-right">Wasted</div>
            </div>

            {/* Table Rows */}
            {reactMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 p-2 rounded-xl bg-[#09090e] border border-[#1a1a24] items-center text-[11px]"
              >
                <div className="col-span-4 font-bold text-purple-300 truncate flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">{metric.component}</span>
                </div>
                <div className="col-span-2 text-right text-zinc-300 font-mono">{metric.renderCount}</div>
                <div className="col-span-2 text-right text-zinc-300 font-mono">{metric.averageRenderTimeMs}</div>
                <div className="col-span-2 text-right text-cyan-400 font-mono">{metric.lastRenderTimeMs}</div>
                <div className="col-span-2 text-right text-amber-400 font-mono">{metric.wastedRenders}</div>
              </div>
            ))}

            {reactMetrics.length === 0 && (
              <div className="py-12 text-center text-zinc-600 text-xs">
                No React component metrics recorded yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
