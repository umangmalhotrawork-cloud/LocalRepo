"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export type SwarmStatus =
  | "PLANNING"
  | "CREATED"
  | "RUNNING"
  | "AGGREGATING"
  | "COMPLETED"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type SwarmTaskStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export interface SwarmTask {
  taskId: string;
  role: string;
  objective: string;
  status: SwarmTaskStatus;
  childThreadId?: string;
  workerId?: string;
  workspaceId?: string;
  startTime?: number;
  endTime?: number;
  elapsedMs?: number;
  findings?: string[];
  changedFiles?: string[];
  changeSets?: any[];
  verification?: any;
  error?: string | null;
  summary?: string | null;
  dependencies?: string[];
  priority?: number;
  allowMutation?: boolean;
  codingIntent?: string;
}

export interface SwarmConflict {
  file?: string;
  conflictingTasks?: string[];
  changeSets?: string[];
  reason?: string;
  category?: string;
}

export interface SwarmConflictReport {
  hasConflicts: boolean;
  category?: string;
  conflictingFiles?: string[];
  conflicts?: SwarmConflict[];
  summary?: string;
}

export interface SwarmState {
  swarmId: string;
  parentThreadId?: string;
  goal: string;
  status: SwarmStatus;
  taskCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  maxConcurrency?: number;
  failurePolicy?: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  conflicts?: SwarmConflictReport | null;
  adoptionResult?: any;
  error?: string | null;
  lastSequenceNumber: number;
}

interface UseSwarmActivityOptions {
  threadId?: string | null;
  swarmId?: string | null;
}

/**
 * In-renderer secret sanitizer to ensure no credentials or raw keys are exposed.
 */
export function sanitizeSwarmText(input: any): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/(?:sk-[a-zA-Z0-9_-]{20,}|gsk_[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35})/g, "[REDACTED_SECRET]")
    .replace(/bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]");
}

/**
 * Pure state reducer for SWARM events.
 * Exported so both the hook and headless test suites can test deterministic state transitions.
 */
export function applySwarmEvent(
  prevState: { swarm: SwarmState | null; tasks: SwarmTask[] },
  event: any
): { swarm: SwarmState | null; tasks: SwarmTask[] } {
  if (!event || typeof event !== "object") return prevState;
  const { type, sequenceNumber, payload = {}, timestamp = Date.now() } = event;

  if (typeof type !== "string" || !type.startsWith("SWARM_")) {
    return prevState;
  }

  // Reject out-of-order or stale events if sequenceNumber is provided and less than or equal to last seen
  if (
    typeof sequenceNumber === "number" &&
    prevState.swarm &&
    sequenceNumber <= prevState.swarm.lastSequenceNumber
  ) {
    return prevState;
  }

  const newSequence = typeof sequenceNumber === "number"
    ? sequenceNumber
    : (prevState.swarm ? prevState.swarm.lastSequenceNumber + 1 : 1);

  let currentSwarm = prevState.swarm;
  let currentTasks = [...prevState.tasks];

  switch (type) {
    case "SWARM_CREATED": {
      const rawTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      const mappedTasks: SwarmTask[] = rawTasks.map((t: any) => ({
        taskId: t.taskId || `swtask_${Date.now()}`,
        role: t.role || "specialist",
        objective: sanitizeSwarmText(t.objective || t.goal || ""),
        status: (t.status as SwarmTaskStatus) || "PENDING",
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
        priority: typeof t.priority === "number" ? t.priority : 1,
        allowMutation: Boolean(t.allowMutation),
        codingIntent: t.codingIntent || "READ_ONLY",
      }));

      currentSwarm = {
        swarmId: payload.swarmId || `swarm_${Date.now()}`,
        parentThreadId: event.threadId || payload.parentThreadId,
        goal: sanitizeSwarmText(payload.goal || "Multi-Agent Swarm Task"),
        status: "CREATED",
        taskCount: payload.taskCount || mappedTasks.length || 0,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        maxConcurrency: payload.maxConcurrency,
        failurePolicy: payload.failurePolicy,
        startTime: timestamp,
        lastSequenceNumber: newSequence,
      };

      currentTasks = mappedTasks;
      break;
    }

    case "SWARM_STARTED": {
      if (!currentSwarm) {
        currentSwarm = {
          swarmId: payload.swarmId || `swarm_${Date.now()}`,
          parentThreadId: event.threadId || payload.parentThreadId,
          goal: sanitizeSwarmText(payload.goal || "Multi-Agent Swarm Task"),
          status: "RUNNING",
          taskCount: payload.taskCount || currentTasks.length || 0,
          completedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          maxConcurrency: payload.maxConcurrency,
          startTime: timestamp,
          lastSequenceNumber: newSequence,
        };
      } else {
        currentSwarm = {
          ...currentSwarm,
          status: "RUNNING",
          startTime: currentSwarm.startTime || timestamp,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_TASK_QUEUED": {
      const taskId = payload.taskId;
      if (!taskId) break;

      const idx = currentTasks.findIndex((t) => t.taskId === taskId);
      if (idx >= 0) {
        currentTasks[idx] = {
          ...currentTasks[idx],
          status: "QUEUED",
          role: payload.role || currentTasks[idx].role,
          objective: payload.objective ? sanitizeSwarmText(payload.objective) : currentTasks[idx].objective,
          dependencies: Array.isArray(payload.dependencies) ? payload.dependencies : currentTasks[idx].dependencies,
        };
      } else {
        currentTasks.push({
          taskId,
          role: payload.role || "specialist",
          objective: sanitizeSwarmText(payload.objective || ""),
          status: "QUEUED",
          dependencies: Array.isArray(payload.dependencies) ? payload.dependencies : [],
        });
      }

      if (currentSwarm) {
        currentSwarm = {
          ...currentSwarm,
          taskCount: Math.max(currentSwarm.taskCount, currentTasks.length),
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_TASK_STARTED": {
      const taskId = payload.taskId;
      if (!taskId) break;

      const idx = currentTasks.findIndex((t) => t.taskId === taskId);
      if (idx >= 0) {
        currentTasks[idx] = {
          ...currentTasks[idx],
          status: "RUNNING",
          startTime: timestamp,
          role: payload.role || currentTasks[idx].role,
          objective: payload.objective ? sanitizeSwarmText(payload.objective) : currentTasks[idx].objective,
          childThreadId: payload.childThreadId || currentTasks[idx].childThreadId,
          workerId: payload.workerId || currentTasks[idx].workerId,
          workspaceId: payload.workspaceId || currentTasks[idx].workspaceId,
        };
      } else {
        currentTasks.push({
          taskId,
          role: payload.role || "specialist",
          objective: sanitizeSwarmText(payload.objective || ""),
          status: "RUNNING",
          startTime: timestamp,
          childThreadId: payload.childThreadId,
          workerId: payload.workerId,
          workspaceId: payload.workspaceId,
        });
      }

      if (currentSwarm) {
        currentSwarm = {
          ...currentSwarm,
          status: currentSwarm.status === "CREATED" ? "RUNNING" : currentSwarm.status,
          taskCount: Math.max(currentSwarm.taskCount, currentTasks.length),
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_TASK_COMPLETED": {
      const taskId = payload.taskId;
      if (!taskId) break;

      const res = payload.result || {};
      const idx = currentTasks.findIndex((t) => t.taskId === taskId);
      const start = idx >= 0 ? (currentTasks[idx].startTime || timestamp) : timestamp;
      const elapsedMs = timestamp - start;

      const completedTask: SwarmTask = {
        taskId,
        role: (idx >= 0 ? currentTasks[idx].role : payload.role) || "specialist",
        objective: (idx >= 0 ? currentTasks[idx].objective : sanitizeSwarmText(payload.objective || "")),
        status: "COMPLETED",
        startTime: start,
        endTime: timestamp,
        elapsedMs: elapsedMs >= 0 ? elapsedMs : 0,
        summary: res.summary ? sanitizeSwarmText(res.summary) : null,
        findings: Array.isArray(res.findings) ? res.findings.map(sanitizeSwarmText) : undefined,
        changedFiles: Array.isArray(res.changedFiles) ? res.changedFiles : (res.changeSet?.files?.map((f: any) => f.filePath) || []),
        changeSets: res.changeSets || (res.changeSet ? [res.changeSet] : []),
        verification: res.verification || null,
        childThreadId: payload.childThreadId || (idx >= 0 ? currentTasks[idx].childThreadId : undefined),
        workerId: payload.workerId || (idx >= 0 ? currentTasks[idx].workerId : undefined),
        workspaceId: payload.workspaceId || (idx >= 0 ? currentTasks[idx].workspaceId : undefined),
        dependencies: idx >= 0 ? currentTasks[idx].dependencies : [],
      };

      if (idx >= 0) {
        currentTasks[idx] = completedTask;
      } else {
        currentTasks.push(completedTask);
      }

      if (currentSwarm) {
        const completedCount = currentTasks.filter((t) => t.status === "COMPLETED").length;
        currentSwarm = {
          ...currentSwarm,
          completedCount,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_TASK_FAILED": {
      const taskId = payload.taskId;
      if (!taskId) break;

      const idx = currentTasks.findIndex((t) => t.taskId === taskId);
      const start = idx >= 0 ? (currentTasks[idx].startTime || timestamp) : timestamp;
      const elapsedMs = timestamp - start;

      const errorMsg = sanitizeSwarmText(payload.error || payload.reason || "Task failed");
      const isSkipped = payload.reason === "Prerequisite dependency failed";

      const failedTask: SwarmTask = {
        taskId,
        role: (idx >= 0 ? currentTasks[idx].role : payload.role) || "specialist",
        objective: (idx >= 0 ? currentTasks[idx].objective : sanitizeSwarmText(payload.objective || "")),
        status: isSkipped ? "SKIPPED" : "FAILED",
        startTime: start,
        endTime: timestamp,
        elapsedMs: elapsedMs >= 0 ? elapsedMs : 0,
        error: errorMsg,
        childThreadId: payload.childThreadId || (idx >= 0 ? currentTasks[idx].childThreadId : undefined),
        workerId: payload.workerId || (idx >= 0 ? currentTasks[idx].workerId : undefined),
        workspaceId: payload.workspaceId || (idx >= 0 ? currentTasks[idx].workspaceId : undefined),
        dependencies: idx >= 0 ? currentTasks[idx].dependencies : [],
      };

      if (idx >= 0) {
        currentTasks[idx] = failedTask;
      } else {
        currentTasks.push(failedTask);
      }

      if (currentSwarm) {
        const failedCount = currentTasks.filter((t) => t.status === "FAILED").length;
        const skippedCount = currentTasks.filter((t) => t.status === "SKIPPED").length;
        currentSwarm = {
          ...currentSwarm,
          failedCount,
          skippedCount,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_TASK_CANCELLED": {
      const taskId = payload.taskId;
      if (!taskId) break;

      const idx = currentTasks.findIndex((t) => t.taskId === taskId);
      if (idx >= 0) {
        currentTasks[idx] = {
          ...currentTasks[idx],
          status: "CANCELLED",
          endTime: timestamp,
          error: sanitizeSwarmText(payload.reason || "Cancelled"),
        };
      }

      if (currentSwarm) {
        currentSwarm = {
          ...currentSwarm,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_CONFLICT_DETECTED": {
      const conflicts: SwarmConflictReport = {
        hasConflicts: true,
        category: payload.category || "FILE_CONFLICT",
        conflictingFiles: Array.isArray(payload.conflictingFiles) ? payload.conflictingFiles : [],
        conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
        summary: sanitizeSwarmText(payload.summary || "Conflicts detected across parallel subagent ChangeSets"),
      };

      if (currentSwarm) {
        currentSwarm = {
          ...currentSwarm,
          conflicts,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_AGGREGATING": {
      if (currentSwarm) {
        currentSwarm = {
          ...currentSwarm,
          status: "AGGREGATING",
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_COMPLETED": {
      const isPartial = payload.status === "PARTIAL_SUCCESS" || (currentSwarm?.failedCount || 0) > 0;
      const finalStatus: SwarmStatus = isPartial ? "PARTIAL_SUCCESS" : "COMPLETED";

      if (currentSwarm) {
        const start = currentSwarm.startTime || timestamp;
        currentSwarm = {
          ...currentSwarm,
          status: finalStatus,
          endTime: timestamp,
          durationMs: timestamp - start,
          completedCount: typeof payload.completedCount === "number" ? payload.completedCount : currentSwarm.completedCount,
          failedCount: typeof payload.failedCount === "number" ? payload.failedCount : currentSwarm.failedCount,
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_FAILED": {
      if (currentSwarm) {
        const start = currentSwarm.startTime || timestamp;
        currentSwarm = {
          ...currentSwarm,
          status: "FAILED",
          endTime: timestamp,
          durationMs: timestamp - start,
          error: sanitizeSwarmText(payload.error || "Swarm execution failed"),
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    case "SWARM_CANCELLED": {
      if (currentSwarm) {
        const start = currentSwarm.startTime || timestamp;
        // Mark all active tasks cancelled
        currentTasks = currentTasks.map((t) =>
          t.status === "RUNNING" || t.status === "PENDING" || t.status === "QUEUED"
            ? { ...t, status: "CANCELLED", endTime: timestamp, error: "Swarm cancelled" }
            : t
        );

        currentSwarm = {
          ...currentSwarm,
          status: "CANCELLED",
          endTime: timestamp,
          durationMs: timestamp - start,
          error: sanitizeSwarmText(payload.reason || "Swarm cancelled by user"),
          lastSequenceNumber: newSequence,
        };
      }
      break;
    }

    default:
      break;
  }

  return { swarm: currentSwarm, tasks: currentTasks };
}

export function useSwarmActivity(options: UseSwarmActivityOptions = {}) {
  const { threadId, swarmId } = options;

  const [swarm, setSwarm] = useState<SwarmState | null>(null);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const stateRef = useRef<{ swarm: SwarmState | null; tasks: SwarmTask[] }>({ swarm: null, tasks: [] });

  useEffect(() => {
    stateRef.current = { swarm, tasks };
  }, [swarm, tasks]);

  const handleEvent = useCallback((event: any) => {
    if (!event || typeof event !== "object") return;
    const { type, threadId: evtThreadId, payload = {} } = event;

    if (typeof type !== "string" || !type.startsWith("SWARM_")) {
      return;
    }

    if (threadId && evtThreadId && evtThreadId !== threadId) {
      return;
    }

    if (swarmId && payload.swarmId && payload.swarmId !== swarmId) {
      return;
    }

    const nextState = applySwarmEvent(stateRef.current, event);
    stateRef.current = nextState;
    setSwarm(nextState.swarm);
    setTasks(nextState.tasks);

    if (nextState.tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(nextState.tasks[0].taskId);
    }
  }, [threadId, swarmId, selectedTaskId]);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electronAPI?.harness?.onEvent) {
      return;
    }

    const unsubscribe = (window as any).electronAPI.harness.onEvent((event: any) => {
      handleEvent(event);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [handleEvent]);

  const refreshFromHistory = useCallback(async (customFilter?: { threadId?: string; swarmId?: string }) => {
    if (typeof window === "undefined" || !(window as any).electronAPI?.harness) {
      return;
    }

    const targetThreadId = customFilter?.threadId || threadId;
    const targetSwarmId = customFilter?.swarmId || swarmId;

    try {
      if (targetThreadId && (window as any).electronAPI.harness.getEvents) {
        const events = await (window as any).electronAPI.harness.getEvents({ threadId: targetThreadId });
        if (Array.isArray(events)) {
          const swarmEvents = events
            .filter((e: any) => e.type && e.type.startsWith("SWARM_"))
            .sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

          let reconstructed = { swarm: null as SwarmState | null, tasks: [] as SwarmTask[] };
          for (const evt of swarmEvents) {
            reconstructed = applySwarmEvent(reconstructed, evt);
          }

          if (reconstructed.swarm) {
            stateRef.current = reconstructed;
            setSwarm(reconstructed.swarm);
            setTasks(reconstructed.tasks);
            if (reconstructed.tasks.length > 0) {
              setSelectedTaskId((prev) => prev || reconstructed.tasks[0].taskId);
            }
            return;
          }
        }
      }

      if (targetSwarmId && (window as any).electronAPI.harness.getSwarmStatus) {
        const status = await (window as any).electronAPI.harness.getSwarmStatus(targetSwarmId);
        if (status) {
          const mappedTasks: SwarmTask[] = Array.isArray(status.tasks)
            ? status.tasks.map((t: any) => ({
                taskId: t.taskId,
                role: t.role || "specialist",
                objective: sanitizeSwarmText(t.objective || ""),
                status: t.status as SwarmTaskStatus,
                childThreadId: t.childThreadId,
                dependencies: t.dependencies || [],
                summary: t.result?.summary ? sanitizeSwarmText(t.result.summary) : null,
                error: t.error ? sanitizeSwarmText(t.error) : null,
              }))
            : [];

          const recSwarm: SwarmState = {
            swarmId: status.swarmId,
            parentThreadId: status.parentThreadId,
            goal: sanitizeSwarmText(status.goal || "Multi-Agent Swarm"),
            status: status.status as SwarmStatus,
            taskCount: mappedTasks.length,
            completedCount: mappedTasks.filter((t) => t.status === "COMPLETED").length,
            failedCount: mappedTasks.filter((t) => t.status === "FAILED").length,
            skippedCount: mappedTasks.filter((t) => t.status === "SKIPPED").length,
            startTime: status.startTime,
            endTime: status.endTime,
            durationMs: status.endTime && status.startTime ? status.endTime - status.startTime : undefined,
            lastSequenceNumber: 0,
          };

          stateRef.current = { swarm: recSwarm, tasks: mappedTasks };
          setSwarm(recSwarm);
          setTasks(mappedTasks);
          if (mappedTasks.length > 0) {
            setSelectedTaskId((prev) => prev || mappedTasks[0].taskId);
          }
        }
      }
    } catch (e) {
      console.error("[USE-SWARM-ACTIVITY] Failed to refresh swarm history:", e);
    }
  }, [threadId, swarmId]);

  useEffect(() => {
    if (threadId || swarmId) {
      refreshFromHistory();
    }
  }, [threadId, swarmId, refreshFromHistory]);

  const cancelSwarm = useCallback(async (reason = "Swarm cancelled by user") => {
    if (!swarm?.swarmId) return;
    if (typeof window !== "undefined" && (window as any).electronAPI?.harness?.cancelSwarm) {
      try {
        await (window as any).electronAPI.harness.cancelSwarm(swarm.swarmId, reason);
      } catch (err) {
        console.error("[USE-SWARM-ACTIVITY] Error calling cancelSwarm:", err);
      }
    }
  }, [swarm?.swarmId]);

  const clearSwarm = useCallback(() => {
    setSwarm(null);
    setTasks([]);
    setSelectedTaskId(null);
    stateRef.current = { swarm: null, tasks: [] };
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return tasks[0] || null;
    return tasks.find((t) => t.taskId === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const conflicts = useMemo(() => {
    return swarm?.conflicts || null;
  }, [swarm?.conflicts]);

  const changeSets = useMemo(() => {
    const list: any[] = [];
    for (const t of tasks) {
      if (Array.isArray(t.changeSets)) {
        list.push(...t.changeSets);
      }
    }
    return list;
  }, [tasks]);

  return {
    swarm,
    tasks,
    selectedTaskId,
    selectedTask,
    conflicts,
    changeSets,
    selectTask,
    cancelSwarm,
    clearSwarm,
    refreshFromHistory,
  };
}
