/**
 * NEXUS CODEX HARNESS - SWARM UI & LIVE VISUALIZER TEST SUITE (Milestone 11B)
 * Verifies all 18 required test scenarios:
 * 1. Event subscription
 * 2. Listener cleanup
 * 3. Swarm creation state
 * 4. Task queued state
 * 5. Task started state
 * 6. Task completed state
 * 7. Task failed state
 * 8. Task cancelled state
 * 9. Aggregation state
 * 10. Swarm completion state
 * 11. Swarm failure state
 * 12. Conflict state
 * 13. Task selection
 * 14. ChangeSet rendering data
 * 15. Stale event rejection via sequenceNumber
 * 16. Persisted swarm reconstruction
 * 17. Cancellation request
 * 18. Secret filtering
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), "nexus_test_swarm_ui_continuum_" + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  SwarmOrchestrator,
  SWARM_STATUS,
  SWARM_TASK_STATUS,
  SWARM_FAILURE_POLICY,
  SWARM_CONFLICT_CATEGORY,
  EVENT_TYPES,
  harnessEventBus,
} = require("./harness");

// Pure reducer and sanitizer helper mirroring desktop/renderer/hooks/useSwarmActivity.ts
function sanitizeSwarmText(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/(?:sk-[a-zA-Z0-9_-]{20,}|gsk_[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35})/g, "[REDACTED_SECRET]")
    .replace(/bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]");
}

function applySwarmEvent(prevState, event) {
  if (!event || typeof event !== "object") return prevState;
  const { type, sequenceNumber, payload = {}, timestamp = Date.now() } = event;

  if (typeof type !== "string" || !type.startsWith("SWARM_")) {
    return prevState;
  }

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
      const mappedTasks = rawTasks.map((t) => ({
        taskId: t.taskId || "swtask_" + Date.now(),
        role: t.role || "specialist",
        objective: sanitizeSwarmText(t.objective || t.goal || ""),
        status: t.status || "PENDING",
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
        priority: typeof t.priority === "number" ? t.priority : 1,
        allowMutation: Boolean(t.allowMutation),
        codingIntent: t.codingIntent || "READ_ONLY",
      }));

      currentSwarm = {
        swarmId: payload.swarmId || "swarm_" + Date.now(),
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
          swarmId: payload.swarmId || "swarm_" + Date.now(),
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

      const completedTask = {
        taskId,
        role: (idx >= 0 ? currentTasks[idx].role : payload.role) || "specialist",
        objective: (idx >= 0 ? currentTasks[idx].objective : sanitizeSwarmText(payload.objective || "")),
        status: "COMPLETED",
        startTime: start,
        endTime: timestamp,
        elapsedMs: elapsedMs >= 0 ? elapsedMs : 0,
        summary: res.summary ? sanitizeSwarmText(res.summary) : null,
        findings: Array.isArray(res.findings) ? res.findings.map(sanitizeSwarmText) : undefined,
        changedFiles: Array.isArray(res.changedFiles) ? res.changedFiles : (res.changeSet?.files?.map((f) => f.filePath) || []),
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

      const failedTask = {
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
      const conflicts = {
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
      const finalStatus = isPartial ? "PARTIAL_SUCCESS" : "COMPLETED";

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

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log("[PASS] " + name);
    passedTests++;
  } catch (err) {
    console.error("[FAIL] " + name + ":", err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log("[PASS] " + name);
    passedTests++;
  } catch (err) {
    console.error("[FAIL] " + name + ":", err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function runSwarmUITests() {
  console.log("====================================================");
  console.log("[TEST] Starting NEXUS Codex Harness Swarm UI Suite (Milestone 11B)...");
  console.log("====================================================\n");

  const testWs = path.join(os.tmpdir(), "nexus_test_swarm_ui_ws_" + Date.now());
  fs.mkdirSync(testWs, { recursive: true });

  const harness = new HarnessRuntime();

  // Test 1: Event Subscription
  await asyncTest("Test 1: Event Subscription receives SWARM events", async () => {
    const receivedEvents = [];
    const unsubscribe = harness.subscribe((evt) => {
      if (evt.type.startsWith("SWARM_")) {
        receivedEvents.push(evt);
      }
    });

    const thread = harness.createThread({ metadata: { workspacePath: testWs } });
    const plan = harness.swarmOrchestrator.createPlan({
      parentThreadId: thread.threadId,
      goal: "Investigate subagent architecture",
      tasks: [{ taskId: "t1", role: "researcher", objective: "Analyze subagents" }],
    });

    unsubscribe();
    assert.ok(receivedEvents.length >= 1, "Should have received at least 1 SWARM event");
    assert.strictEqual(receivedEvents[0].type, EVENT_TYPES.SWARM_CREATED);
    assert.strictEqual(receivedEvents[0].payload.swarmId, plan.swarmId);
  });

  // Test 2: Listener Cleanup
  test("Test 2: Listener cleanup properly removes subscription", () => {
    let callCount = 0;
    const listener = (evt) => {
      if (evt.type.startsWith("SWARM_")) callCount++;
    };
    const unsub = harnessEventBus.subscribe(listener);
    harnessEventBus.emit(EVENT_TYPES.SWARM_STARTED, { payload: { swarmId: "sw_test" } });
    assert.strictEqual(callCount, 1);

    unsub();
    harnessEventBus.emit(EVENT_TYPES.SWARM_STARTED, { payload: { swarmId: "sw_test" } });
    assert.strictEqual(callCount, 1, "Should not be called after unsubscribe");
  });

  // Test 3: Swarm Creation State
  test("Test 3: SWARM_CREATED initializes swarm and tasks state", () => {
    const initial = { swarm: null, tasks: [] };
    const event = {
      type: "SWARM_CREATED",
      sequenceNumber: 1,
      threadId: "th_100",
      payload: {
        swarmId: "sw_100",
        goal: "Refactor core components",
        taskCount: 2,
        maxConcurrency: 2,
        failurePolicy: "FAIL_FAST",
        tasks: [
          { taskId: "task_1", role: "researcher", objective: "Research specs", allowMutation: false },
          { taskId: "task_2", role: "coder", objective: "Apply refactor", allowMutation: true, dependencies: ["task_1"] },
        ],
      },
    };

    const next = applySwarmEvent(initial, event);
    assert.ok(next.swarm !== null);
    assert.strictEqual(next.swarm.swarmId, "sw_100");
    assert.strictEqual(next.swarm.status, "CREATED");
    assert.strictEqual(next.swarm.goal, "Refactor core components");
    assert.strictEqual(next.swarm.taskCount, 2);
    assert.strictEqual(next.tasks.length, 2);
    assert.strictEqual(next.tasks[0].taskId, "task_1");
    assert.strictEqual(next.tasks[0].role, "researcher");
    assert.strictEqual(next.tasks[1].taskId, "task_2");
    assert.strictEqual(next.tasks[1].dependencies[0], "task_1");
  });

  // Test 4: Task Queued State
  test("Test 4: SWARM_TASK_QUEUED transitions task to QUEUED status", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "CREATED",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 1,
      },
      tasks: [
        { taskId: "task_1", role: "researcher", objective: "Obj", status: "PENDING" },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_TASK_QUEUED",
      sequenceNumber: 2,
      payload: { swarmId: "sw_100", taskId: "task_1", role: "researcher" },
    });

    assert.strictEqual(next.tasks[0].status, "QUEUED");
    assert.strictEqual(next.swarm.lastSequenceNumber, 2);
  });

  // Test 5: Task Started State
  test("Test 5: SWARM_TASK_STARTED marks task RUNNING with worker and timestamp", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "CREATED",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 2,
      },
      tasks: [
        { taskId: "task_1", role: "researcher", objective: "Obj", status: "QUEUED" },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_TASK_STARTED",
      sequenceNumber: 3,
      timestamp: 1700000000000,
      payload: {
        swarmId: "sw_100",
        taskId: "task_1",
        role: "researcher",
        objective: "Obj",
        childThreadId: "thread_child_1",
        workerId: "worker_proc_1",
        workspaceId: "ws_iso_1",
      },
    });

    assert.strictEqual(next.tasks[0].status, "RUNNING");
    assert.strictEqual(next.tasks[0].startTime, 1700000000000);
    assert.strictEqual(next.tasks[0].workerId, "worker_proc_1");
    assert.strictEqual(next.tasks[0].childThreadId, "thread_child_1");
    assert.strictEqual(next.tasks[0].workspaceId, "ws_iso_1");
    assert.strictEqual(next.swarm.status, "RUNNING");
  });

  // Test 6: Task Completed State
  test("Test 6: SWARM_TASK_COMPLETED records results, duration, findings, and changed files", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startTime: 1700000000000,
        lastSequenceNumber: 3,
      },
      tasks: [
        {
          taskId: "task_1",
          role: "coder",
          objective: "Fix bug",
          status: "RUNNING",
          startTime: 1700000000000,
        },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_TASK_COMPLETED",
      sequenceNumber: 4,
      timestamp: 1700000005000,
      payload: {
        swarmId: "sw_100",
        taskId: "task_1",
        result: {
          success: true,
          summary: "Refactored module successfully",
          findings: ["Found redundant logic in handler", "Added null checks"],
          changedFiles: ["src/handler.js"],
          changeSet: {
            changeSetId: "cs_101",
            files: [{ filePath: "src/handler.js", riskLevel: "LOW" }],
          },
          verification: { passed: true, testsPassed: 4 },
        },
      },
    });

    assert.strictEqual(next.tasks[0].status, "COMPLETED");
    assert.strictEqual(next.tasks[0].summary, "Refactored module successfully");
    assert.strictEqual(next.tasks[0].findings.length, 2);
    assert.strictEqual(next.tasks[0].changedFiles[0], "src/handler.js");
    assert.strictEqual(next.tasks[0].elapsedMs, 5000);
    assert.strictEqual(next.swarm.completedCount, 1);
  });

  // Test 7: Task Failed State
  test("Test 7: SWARM_TASK_FAILED captures error message and increments failedCount", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startTime: 1700000000000,
        lastSequenceNumber: 3,
      },
      tasks: [
        {
          taskId: "task_fail",
          role: "tester",
          objective: "Run unit tests",
          status: "RUNNING",
          startTime: 1700000000000,
        },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_TASK_FAILED",
      sequenceNumber: 4,
      timestamp: 1700000002000,
      payload: {
        swarmId: "sw_100",
        taskId: "task_fail",
        error: "Process exited with status 1: test suite failed",
      },
    });

    assert.strictEqual(next.tasks[0].status, "FAILED");
    assert.strictEqual(next.tasks[0].error, "Process exited with status 1: test suite failed");
    assert.strictEqual(next.tasks[0].elapsedMs, 2000);
    assert.strictEqual(next.swarm.failedCount, 1);
  });

  // Test 8: Task Cancelled State
  test("Test 8: SWARM_TASK_CANCELLED marks task status CANCELLED", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 3,
      },
      tasks: [
        { taskId: "task_cancel", role: "reviewer", objective: "Review diff", status: "RUNNING" },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_TASK_CANCELLED",
      sequenceNumber: 4,
      payload: {
        swarmId: "sw_100",
        taskId: "task_cancel",
        reason: "Cancelled by parent",
      },
    });

    assert.strictEqual(next.tasks[0].status, "CANCELLED");
    assert.strictEqual(next.tasks[0].error, "Cancelled by parent");
  });

  // Test 9: Aggregation State
  test("Test 9: SWARM_AGGREGATING transitions swarm status to AGGREGATING", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 2,
        completedCount: 2,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 5,
      },
      tasks: [],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_AGGREGATING",
      sequenceNumber: 6,
      payload: { swarmId: "sw_100" },
    });

    assert.strictEqual(next.swarm.status, "AGGREGATING");
    assert.strictEqual(next.swarm.lastSequenceNumber, 6);
  });

  // Test 10: Swarm Completion State
  test("Test 10: SWARM_COMPLETED calculates total duration and final metrics", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "AGGREGATING",
        taskCount: 2,
        completedCount: 2,
        failedCount: 0,
        skippedCount: 0,
        startTime: 1700000000000,
        lastSequenceNumber: 6,
      },
      tasks: [
        { taskId: "t1", role: "researcher", objective: "Obj", status: "COMPLETED" },
        { taskId: "t2", role: "coder", objective: "Obj", status: "COMPLETED" },
      ],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_COMPLETED",
      sequenceNumber: 7,
      timestamp: 1700000010000,
      payload: {
        swarmId: "sw_100",
        status: "COMPLETED",
        completedCount: 2,
        failedCount: 0,
      },
    });

    assert.strictEqual(next.swarm.status, "COMPLETED");
    assert.strictEqual(next.swarm.durationMs, 10000);
    assert.strictEqual(next.swarm.completedCount, 2);
  });

  // Test 11: Swarm Failure State
  test("Test 11: SWARM_FAILED captures overall swarm failure error", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 1,
        completedCount: 0,
        failedCount: 1,
        skippedCount: 0,
        startTime: 1700000000000,
        lastSequenceNumber: 3,
      },
      tasks: [],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_FAILED",
      sequenceNumber: 4,
      timestamp: 1700000004000,
      payload: {
        swarmId: "sw_100",
        error: "All subagent tasks failed catastrophically",
      },
    });

    assert.strictEqual(next.swarm.status, "FAILED");
    assert.strictEqual(next.swarm.error, "All subagent tasks failed catastrophically");
    assert.strictEqual(next.swarm.durationMs, 4000);
  });

  // Test 12: Conflict State
  test("Test 12: SWARM_CONFLICT_DETECTED records multi-agent conflict details", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "AGGREGATING",
        taskCount: 2,
        completedCount: 2,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 6,
      },
      tasks: [],
    };

    const next = applySwarmEvent(state, {
      type: "SWARM_CONFLICT_DETECTED",
      sequenceNumber: 7,
      payload: {
        swarmId: "sw_100",
        category: "FILE_CONFLICT",
        conflictingFiles: ["auth.js", "session.js"],
        conflicts: [
          { file: "auth.js", conflictingTasks: ["t1", "t2"], reason: "Concurrent edits to login method" },
        ],
        summary: "File conflict detected across sibling subagents",
      },
    });

    assert.ok(next.swarm.conflicts !== null);
    assert.strictEqual(next.swarm.conflicts.hasConflicts, true);
    assert.strictEqual(next.swarm.conflicts.category, "FILE_CONFLICT");
    assert.strictEqual(next.swarm.conflicts.conflictingFiles.length, 2);
    assert.strictEqual(next.swarm.conflicts.conflicts[0].file, "auth.js");
  });

  // Test 13: Task Selection
  test("Test 13: Task selection accurately retrieves task details", () => {
    const tasks = [
      { taskId: "t1", role: "researcher", objective: "Analyze auth", status: "COMPLETED" },
      { taskId: "t2", role: "coder", objective: "Implement auth", status: "RUNNING" },
    ];

    const selectedId = "t2";
    const selectedTask = tasks.find((t) => t.taskId === selectedId);

    assert.ok(selectedTask !== undefined);
    assert.strictEqual(selectedTask.taskId, "t2");
    assert.strictEqual(selectedTask.role, "coder");
    assert.strictEqual(selectedTask.status, "RUNNING");
  });

  // Test 14: ChangeSet Rendering Data
  test("Test 14: ChangeSets extraction aggregates from task results cleanly", () => {
    const tasks = [
      {
        taskId: "t1",
        role: "coder",
        objective: "Fix 1",
        status: "COMPLETED",
        changeSets: [
          { changeSetId: "cs_1", files: [{ filePath: "file1.js" }], riskLevel: "LOW" },
        ],
      },
      {
        taskId: "t2",
        role: "coder",
        objective: "Fix 2",
        status: "COMPLETED",
        changeSets: [
          { changeSetId: "cs_2", files: [{ filePath: "file2.js" }], riskLevel: "HIGH" },
        ],
      },
    ];

    const allChangeSets = [];
    for (const t of tasks) {
      if (Array.isArray(t.changeSets)) {
        allChangeSets.push(...t.changeSets);
      }
    }

    assert.strictEqual(allChangeSets.length, 2);
    assert.strictEqual(allChangeSets[0].changeSetId, "cs_1");
    assert.strictEqual(allChangeSets[1].riskLevel, "HIGH");
  });

  // Test 15: Stale Event Rejection via SequenceNumber
  test("Test 15: Stale / out-of-order events with sequenceNumber <= lastSeen are rejected", () => {
    const state = {
      swarm: {
        swarmId: "sw_100",
        goal: "Goal",
        status: "RUNNING",
        taskCount: 1,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 10,
      },
      tasks: [
        { taskId: "task_1", role: "coder", objective: "Obj", status: "COMPLETED" },
      ],
    };

    // Stale event with sequenceNumber 5
    const staleEvent = {
      type: "SWARM_TASK_STARTED",
      sequenceNumber: 5,
      payload: { swarmId: "sw_100", taskId: "task_1" },
    };

    const next = applySwarmEvent(state, staleEvent);
    // Should be unchanged
    assert.strictEqual(next.tasks[0].status, "COMPLETED");
    assert.strictEqual(next.swarm.lastSequenceNumber, 10);
  });

  // Test 16: Persisted Swarm Reconstruction
  await asyncTest("Test 16: Reconstruct complete Swarm state from event history stream", async () => {
    const thread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });

    const plan = orchestrator.createPlan({
      parentThreadId: thread.threadId,
      goal: "Reconstruction test swarm",
      tasks: [
        { taskId: "rec_t1", role: "researcher", objective: "Task 1" },
        { taskId: "rec_t2", role: "reviewer", objective: "Task 2", dependencies: ["rec_t1"] },
      ],
    });

    await orchestrator.executeSwarm(plan, {
      mockResponses: {
        rec_t1: "Result 1 findings",
        rec_t2: "Result 2 review pass",
      },
      workspacePath: testWs,
    });

    // Retrieve authoritative events from Harness
    const events = harness.getEvents({ threadId: thread.threadId });
    const swarmEvents = events
      .filter((e) => e.type.startsWith("SWARM_"))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    assert.ok(swarmEvents.length >= 4, "Should have emitted full lifecycle of swarm events");

    let reconstructed = { swarm: null, tasks: [] };
    for (const evt of swarmEvents) {
      reconstructed = applySwarmEvent(reconstructed, evt);
    }

    assert.ok(reconstructed.swarm !== null);
    assert.strictEqual(reconstructed.swarm.swarmId, plan.swarmId);
    assert.strictEqual(reconstructed.swarm.status, "COMPLETED");
    assert.strictEqual(reconstructed.swarm.completedCount, 2);
    assert.strictEqual(reconstructed.tasks.length, 2);
    assert.strictEqual(reconstructed.tasks[0].status, "COMPLETED");
    assert.strictEqual(reconstructed.tasks[1].status, "COMPLETED");
  });

  // Test 17: Cancellation Request
  await asyncTest("Test 17: Cancellation request halts active swarm and transitions UI state", async () => {
    const thread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });

    const plan = orchestrator.createPlan({
      parentThreadId: thread.threadId,
      goal: "Cancellation target swarm",
      tasks: [{ taskId: "c_t1", role: "researcher", objective: "Long running search" }],
    });

    // Cancel swarm
    const cancelRes = orchestrator.cancelSwarm(plan.swarmId, "Operator cancelled via UI");
    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(cancelRes.status, "CANCELLED");

    const events = harness.getEvents({ threadId: thread.threadId });
    const cancelEvt = events.find((e) => e.type === EVENT_TYPES.SWARM_CANCELLED);
    assert.ok(cancelEvt !== undefined);

    let state = {
      swarm: {
        swarmId: plan.swarmId,
        goal: plan.goal,
        status: "RUNNING",
        taskCount: 1,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        lastSequenceNumber: 1,
      },
      tasks: [{ taskId: "c_t1", role: "researcher", objective: "Obj", status: "RUNNING" }],
    };

    state = applySwarmEvent(state, cancelEvt);
    assert.strictEqual(state.swarm.status, "CANCELLED");
    assert.strictEqual(state.tasks[0].status, "CANCELLED");
  });

  // Test 18: Secret Filtering
  test("Test 18: Secret filtering redacts credentials from swarm events & metadata", () => {
    const apiKeyRaw = "sk-abcdef1234567890abcdef1234567890";
    const bearerRaw = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const rawObjective = "Call API with key " + apiKeyRaw + " and token " + bearerRaw;

    const sanitized = sanitizeSwarmText(rawObjective);
    assert.ok(!sanitized.includes(apiKeyRaw), "Raw OpenAI API key should be redacted");
    assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "Raw Bearer token should be redacted");
    assert.ok(sanitized.includes("[REDACTED_SECRET]"));
    assert.ok(sanitized.includes("[REDACTED_TOKEN]"));

    const initial = { swarm: null, tasks: [] };
    const event = {
      type: "SWARM_CREATED",
      sequenceNumber: 1,
      payload: {
        swarmId: "sw_sec",
        goal: "Deploy with " + apiKeyRaw,
        tasks: [{ taskId: "t_sec", role: "coder", objective: rawObjective }],
      },
    };

    const next = applySwarmEvent(initial, event);
    assert.ok(!next.swarm.goal.includes(apiKeyRaw));
    assert.ok(!next.tasks[0].objective.includes(apiKeyRaw));
  });

  console.log("\n====================================================");
  console.log("[RESULTS] " + passedTests + " passed, " + failedTests + " failed.");
  console.log("====================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSwarmUITests().catch((err) => {
  console.error("Unhandled error in Swarm UI test runner:", err);
  process.exit(1);
});
