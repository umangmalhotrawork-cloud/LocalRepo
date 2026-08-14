"use client";

import { useState, useCallback, useRef } from "react";
import { PythonCpuProfile, PythonMemoryProfile, profilePythonCPU, profilePythonMemory } from "../../runtime/pythonProfiler";
import { JsProfileResult, profileJavaScript } from "../../runtime/jsProfiler";

export type ReactMetric = {
  component: string;
  renderCount: number;
  totalDurationMs: number;
  averageRenderTimeMs: number;
  lastRenderTimeMs: number;
  wastedRenders: number;
};

export type TimelineEvent = {
  id: string;
  label: string;
  startMs: number;
  durationMs: number;
  type: "cpu" | "memory" | "render" | "io";
};

export function useProfiler() {
  const [cpuProfile, setCpuProfile] = useState<PythonCpuProfile | null>(null);
  const [memoryProfile, setMemoryProfile] = useState<PythonMemoryProfile | null>(null);
  const [jsProfile, setJsProfile] = useState<JsProfileResult | null>(null);
  const [reactMetrics, setReactMetrics] = useState<ReactMetric[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isProfiling, setIsProfiling] = useState<boolean>(false);

  const metricsMapRef = useRef<Map<string, ReactMetric>>(new Map());

  // Record React component render metrics
  const recordRender = useCallback((componentName: string, renderDurationMs: number, isWasted: boolean = false) => {
    const map = metricsMapRef.current;
    const existing = map.get(componentName) || {
      component: componentName,
      renderCount: 0,
      totalDurationMs: 0,
      averageRenderTimeMs: 0,
      lastRenderTimeMs: 0,
      wastedRenders: 0,
    };

    existing.renderCount += 1;
    existing.totalDurationMs += renderDurationMs;
    existing.lastRenderTimeMs = Math.round(renderDurationMs * 100) / 100;
    existing.averageRenderTimeMs = Math.round((existing.totalDurationMs / existing.renderCount) * 100) / 100;
    if (isWasted) existing.wastedRenders += 1;

    map.set(componentName, existing);
    setReactMetrics(Array.from(map.values()));
  }, []);

  // Run Python CPU & Memory Profiler
  const profilePython = useCallback(async (code: string, filePath: string = "main.py") => {
    setIsProfiling(true);
    try {
      const [cpuRes, memRes] = await Promise.all([
        profilePythonCPU(code, filePath),
        profilePythonMemory(code, filePath),
      ]);

      setCpuProfile(cpuRes);
      setMemoryProfile(memRes);

      // Generate horizontal timeline events
      const events: TimelineEvent[] = [];
      let currentOffset = 0;

      (cpuRes.functions || []).forEach((fn, idx) => {
        events.push({
          id: `cpu-${idx}`,
          label: fn.name,
          startMs: currentOffset,
          durationMs: Math.max(1, fn.cumulativeTime),
          type: "cpu",
        });
        currentOffset += Math.max(1, fn.totalTime);
      });

      (memRes.topAllocations || []).forEach((alloc, idx) => {
        events.push({
          id: `mem-${idx}`,
          label: `alloc@${alloc.line}`,
          startMs: (idx * 3) % (currentOffset || 10),
          durationMs: 2,
          type: "memory",
        });
      });

      setTimelineEvents(events);
      return { cpuRes, memRes };
    } catch (err) {
      console.error("[PROFILER] Python profile failed:", err);
      return null;
    } finally {
      setIsProfiling(false);
    }
  }, []);

  // Run JavaScript / TypeScript Profiler
  const profileJs = useCallback(async (code: string, filePath: string = "main.ts") => {
    setIsProfiling(true);
    try {
      const res = await profileJavaScript(code, filePath);
      setJsProfile(res);

      const events: TimelineEvent[] = (res.functions || []).map((fn, idx) => ({
        id: `js-${idx}`,
        label: fn.name,
        startMs: idx * 2,
        durationMs: fn.cumulativeTime || 1,
        type: "cpu",
      }));

      setTimelineEvents(events);
      return res;
    } catch (err) {
      console.error("[PROFILER] JS profile failed:", err);
      return null;
    } finally {
      setIsProfiling(false);
    }
  }, []);

  // Clear all profiler data
  const clearProfile = useCallback(() => {
    setCpuProfile(null);
    setMemoryProfile(null);
    setJsProfile(null);
    setTimelineEvents([]);
  }, []);

  // Export profiling session report
  const exportProfile = useCallback(async () => {
    const sessionData = {
      cpuProfile,
      memoryProfile,
      jsProfile,
      reactMetrics,
      timelineEvents,
    };

    if (typeof window !== "undefined" && (window as any).electronAPI?.profiler?.export) {
      try {
        const res = await (window as any).electronAPI.profiler.export(sessionData);
        return res;
      } catch (e) {}
    }

    const json = JSON.stringify(sessionData, null, 2);
    // Create client-side download fallback
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-profiler-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, reportJson: json };
  }, [cpuProfile, memoryProfile, jsProfile, reactMetrics, timelineEvents]);

  return {
    cpuProfile,
    memoryProfile,
    jsProfile,
    reactMetrics,
    timelineEvents,
    isProfiling,
    recordRender,
    profilePython,
    profileJs,
    clearProfile,
    exportProfile,
  };
}
