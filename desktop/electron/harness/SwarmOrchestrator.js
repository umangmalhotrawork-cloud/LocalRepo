/**
 * NEXUS CODEX HARNESS - SWARM ORCHESTRATOR (Milestone 10)
 * Parent-level multi-agent swarm coordinator orchestrating fan-out delegation,
 * dependency graph scheduling, parallel child execution, structured fan-in aggregation,
 * multi-agent conflict detection, parent-authoritative ChangeSet adoption, and EvidenceGraph tracing.
 */

const path = require('path');
const fs = require('fs');
const {
  SWARM_STATUS,
  SWARM_TASK_STATUS,
  SWARM_FAILURE_POLICY,
  SWARM_CONFLICT_CATEGORY,
  DEFAULT_SWARM_LIMITS,
  EVENT_TYPES,
  TURN_STATUS,
  generateSwarmId,
  generateSwarmTaskId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const { subagentManager } = require('./SubagentManager');
const { ChangeSet } = require('./ChangeSet');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

const KNOWN_ROLES = new Set([
  'researcher',
  'coder',
  'tester',
  'reviewer',
  'planner',
  'orchestrator',
  'architect',
  'debugger',
  'devops',
  'designer',
  'specialist',
]);

class SwarmOrchestrator {
  /**
   * @param {Object} [options]
   * @param {Object} [options.eventBus] - Central authoritative HarnessEventBus
   * @param {Object} [options.subagentManager] - Bound SubagentManager
   * @param {Object} [options.limits] - Custom swarm resource limits
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.subagentManager = options.subagentManager || subagentManager;
    this.limits = {
      ...DEFAULT_SWARM_LIMITS,
      ...(options.limits || {}),
    };
    this.activeSwarms = new Map(); // swarmId -> SwarmState
  }

  /**
   * Creates and validates a new Swarm Plan.
   * @param {Object} planInput
   * @returns {Object} Normalized Swarm Plan
   */
  createPlan(planInput = {}) {
    const {
      parentThreadId,
      parentTurnId = null,
      goal,
      tasks = [],
      maxConcurrency = this.limits.maxConcurrentTasks,
      failurePolicy = SWARM_FAILURE_POLICY.BEST_EFFORT,
      metadata = {},
    } = planInput;

    if (!parentThreadId) {
      throw new Error('[SWARM-ORCHESTRATOR] parentThreadId is required to create a swarm plan');
    }

    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      throw new Error('[SWARM-ORCHESTRATOR] Swarm plan requires a non-empty goal statement');
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('[SWARM-ORCHESTRATOR] Swarm plan must contain at least one task');
    }

    if (tasks.length > this.limits.maxTasksPerSwarm) {
      throw new Error(`[SWARM-ORCHESTRATOR] Tasks count (${tasks.length}) exceeds maxTasksPerSwarm (${this.limits.maxTasksPerSwarm})`);
    }

    const swarmId = generateSwarmId();
    const effectiveConcurrency = Math.min(Math.max(1, maxConcurrency), this.limits.maxConcurrentTasks);

    // Normalize and validate individual tasks
    const normalizedTasks = [];
    const seenTaskIds = new Set();

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t || typeof t !== 'object') {
        throw new Error(`[SWARM-ORCHESTRATOR] Invalid task object at index ${i}`);
      }

      const taskId = t.taskId || generateSwarmTaskId();
      if (seenTaskIds.has(taskId)) {
        throw new Error(`[SWARM-ORCHESTRATOR] Duplicate taskId "${taskId}" detected in plan`);
      }
      seenTaskIds.add(taskId);

      const role = (t.role && typeof t.role === 'string') ? t.role.toLowerCase() : 'researcher';
      if (!KNOWN_ROLES.has(role)) {
        throw new Error(`[SWARM-ORCHESTRATOR] Unsupported task role "${t.role}" for task "${taskId}"`);
      }

      const objective = (t.objective && typeof t.objective === 'string') ? t.objective.trim() : (t.taskGoal || t.task || '');
      if (!objective) {
        throw new Error(`[SWARM-ORCHESTRATOR] Task "${taskId}" requires a non-empty objective`);
      }

      const dependencies = Array.isArray(t.dependencies) ? t.dependencies : [];
      if (dependencies.includes(taskId)) {
        throw new Error(`[SWARM-ORCHESTRATOR] Task "${taskId}" cannot depend on itself`);
      }

      normalizedTasks.push({
        taskId,
        role,
        objective,
        codingIntent: t.codingIntent || (role === 'coder' ? 'MUTATION' : 'READ_ONLY'),
        relevantFiles: Array.isArray(t.relevantFiles) ? t.relevantFiles : [],
        dependencies,
        allowMutation: Boolean(t.allowMutation ?? (role === 'coder')),
        isolateWorkspace: Boolean(t.isolateWorkspace ?? true),
        useWorkerRuntime: Boolean(t.useWorkerRuntime ?? true),
        priority: Number.isInteger(t.priority) ? t.priority : 1,
        status: SWARM_TASK_STATUS.PENDING,
        metadata: t.metadata || {},
      });
    }

    // Validate dependency references and check for circular dependencies
    this.validateDependencyGraph(normalizedTasks);

    const swarmPlan = {
      swarmId,
      parentThreadId,
      parentTurnId,
      goal: goal.trim(),
      tasks: normalizedTasks,
      maxConcurrency: effectiveConcurrency,
      failurePolicy: [SWARM_FAILURE_POLICY.FAIL_FAST, SWARM_FAILURE_POLICY.BEST_EFFORT].includes(failurePolicy)
        ? failurePolicy
        : SWARM_FAILURE_POLICY.BEST_EFFORT,
      status: SWARM_STATUS.PLANNING,
      createdAt: Date.now(),
      completedAt: null,
      metadata: secretFilter.sanitizeObject(metadata),
    };

    const taskStates = new Map();
    for (const t of normalizedTasks) {
      taskStates.set(t.taskId, {
        task: t,
        status: SWARM_TASK_STATUS.PENDING,
        childThreadId: null,
        workerId: null,
        result: null,
        error: null,
      });
    }

    const swarmRecord = {
      plan: swarmPlan,
      taskStates,
      startTime: Date.now(),
      endTime: null,
      cancelled: false,
      activePromises: new Map(),
    };

    this.activeSwarms.set(swarmId, swarmRecord);

    // Emit SWARM_CREATED Event
    this.eventBus.emit(EVENT_TYPES.SWARM_CREATED, {
      threadId: parentThreadId,
      turnId: parentTurnId,
      payload: {
        swarmId,
        parentThreadId,
        goal: swarmPlan.goal,
        tasks: normalizedTasks,
        taskCount: normalizedTasks.length,
        maxConcurrency: effectiveConcurrency,
        failurePolicy: swarmPlan.failurePolicy,
      },
    });

    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: parentThreadId,
          type: 'TASK',
          statement: `Swarm Plan created [${swarmId}]: "${swarmPlan.goal}" with ${normalizedTasks.length} tasks`,
          provenanceClass: 'SYSTEM_GENERATED',
          verificationLevel: 'OBSERVED',
          metadata: { swarmId, parentThreadId, taskCount: normalizedTasks.length },
        });
      } catch (e) {}
    }

    return swarmPlan;
  }

  /**
   * Validates dependency graph for missing references and cycles.
   * @param {Array<Object>} tasks
   */
  validateDependencyGraph(tasks = []) {
    const taskMap = new Map();
    for (const t of tasks) {
      taskMap.set(t.taskId, t);
    }

    for (const t of tasks) {
      for (const depId of t.dependencies) {
        if (!taskMap.has(depId)) {
          throw new Error(`[SWARM-ORCHESTRATOR] Task "${t.taskId}" references non-existent dependency "${depId}"`);
        }
      }
    }

    // Cycle detection via DFS / Topological Sort
    const visited = new Map(); // taskId -> 0 (unvisited), 1 (visiting), 2 (visited)
    for (const t of tasks) {
      visited.set(t.taskId, 0);
    }

    const checkCycle = (taskId, stack = []) => {
      visited.set(taskId, 1);
      stack.push(taskId);

      const task = taskMap.get(taskId);
      for (const depId of task.dependencies) {
        if (visited.get(depId) === 1) {
          throw new Error(`[SWARM-ORCHESTRATOR] Circular dependency detected in swarm plan: ${[...stack, depId].join(' -> ')}`);
        }
        if (visited.get(depId) === 0) {
          checkCycle(depId, stack);
        }
      }

      stack.pop();
      visited.set(taskId, 2);
    };

    for (const t of tasks) {
      if (visited.get(t.taskId) === 0) {
        checkCycle(t.taskId, []);
      }
    }
  }

  /**
   * Executes a Swarm Plan: handles bounded fan-out, parallel execution, fan-in, and conflict detection.
   * @param {Object} planInputOrPlan
   * @param {Object} [options]
   * @returns {Promise<Object>} Aggregated Swarm Outcome
   */
  async executeSwarm(planInputOrPlan, options = {}) {
    const plan = planInputOrPlan.swarmId ? planInputOrPlan : this.createPlan(planInputOrPlan);
    const swarmId = plan.swarmId;

    let swarmRecord = this.activeSwarms.get(swarmId);
    if (!swarmRecord) {
      const taskStates = new Map();
      for (const t of plan.tasks) {
        taskStates.set(t.taskId, {
          task: t,
          status: SWARM_TASK_STATUS.PENDING,
          childThreadId: null,
          workerId: null,
          result: null,
          error: null,
        });
      }
      swarmRecord = {
        plan,
        taskStates,
        startTime: Date.now(),
        endTime: null,
        cancelled: false,
        activePromises: new Map(),
      };
      this.activeSwarms.set(swarmId, swarmRecord);
    }

    plan.status = SWARM_STATUS.RUNNING;

    // Emit SWARM_STARTED
    this.eventBus.emit(EVENT_TYPES.SWARM_STARTED, {
      threadId: plan.parentThreadId,
      turnId: plan.parentTurnId,
      payload: { swarmId, taskCount: plan.tasks.length, maxConcurrency: plan.maxConcurrency },
    });

    // Emit SWARM_TASK_QUEUED for initial tasks
    for (const [, state] of swarmRecord.taskStates.entries()) {
      state.status = SWARM_TASK_STATUS.QUEUED;
      this.eventBus.emit(EVENT_TYPES.SWARM_TASK_QUEUED, {
        threadId: plan.parentThreadId,
        turnId: plan.parentTurnId,
        payload: {
          swarmId,
          taskId: state.task.taskId,
          role: state.task.role,
          objective: state.task.objective,
          dependencies: state.task.dependencies,
        },
      });
    }

    try {
      // Execute dependency scheduler loop
      await this._runSchedulerLoop(swarmRecord, options);

      // Fan-In Aggregation
      plan.status = SWARM_STATUS.AGGREGATING;
      this.eventBus.emit(EVENT_TYPES.SWARM_AGGREGATING, {
        threadId: plan.parentThreadId,
        turnId: plan.parentTurnId,
        payload: { swarmId },
      });

      const aggregated = this._aggregateResults(swarmRecord);

      // Conflict Detection across child ChangeSets
      const conflictReport = this.detectConflicts(aggregated.changeSets, {
        workspacePath: options.workspacePath || plan.metadata?.workspacePath || process.cwd(),
      });

      if (conflictReport.hasConflicts) {
        this.eventBus.emit(EVENT_TYPES.SWARM_CONFLICT_DETECTED, {
          threadId: plan.parentThreadId,
          turnId: plan.parentTurnId,
          payload: {
            swarmId,
            category: conflictReport.category,
            conflictingFiles: conflictReport.conflictingFiles,
            conflicts: conflictReport.conflicts,
          },
        });
      }

      // Safe Auto-Adoption if requested and no conflicts exist
      let adoptionResult = null;
      if (options.autoAdopt && !conflictReport.hasConflicts && aggregated.changeSets.length > 0) {
        adoptionResult = await this.adoptNonConflictingChanges(aggregated.changeSets, {
          parentWorkspacePath: options.workspacePath || process.cwd(),
          parentThreadId: plan.parentThreadId,
          parentTurnId: plan.parentTurnId,
          verifierFn: options.verifierFn,
        });
      }

      // Finalize status
      const hasFailures = aggregated.failedTaskCount > 0;
      const allFailed = aggregated.failedTaskCount === plan.tasks.length;
      plan.status = swarmRecord.cancelled
        ? SWARM_STATUS.CANCELLED
        : (allFailed ? SWARM_STATUS.FAILED : (hasFailures ? SWARM_STATUS.PARTIAL_SUCCESS : SWARM_STATUS.COMPLETED));

      plan.completedAt = Date.now();
      swarmRecord.endTime = Date.now();

      const finalOutcome = {
        swarmId,
        parentThreadId: plan.parentThreadId,
        parentTurnId: plan.parentTurnId,
        status: plan.status,
        success: plan.status === SWARM_STATUS.COMPLETED || plan.status === SWARM_STATUS.PARTIAL_SUCCESS,
        goal: plan.goal,
        taskCount: plan.tasks.length,
        completedTaskCount: aggregated.completedTaskCount,
        failedTaskCount: aggregated.failedTaskCount,
        skippedTaskCount: aggregated.skippedTaskCount,
        durationMs: swarmRecord.endTime - swarmRecord.startTime,
        summaries: aggregated.summaries,
        findings: aggregated.findings,
        changedFiles: aggregated.changedFiles,
        changeSets: aggregated.changeSets,
        verification: aggregated.verification,
        conflicts: conflictReport,
        adoptionResult,
        taskResults: Array.from(swarmRecord.taskStates.values()).map((ts) => ({
          taskId: ts.task.taskId,
          role: ts.task.role,
          objective: ts.task.objective,
          status: ts.status,
          childThreadId: ts.childThreadId,
          summary: ts.result?.summary || null,
          error: ts.error || ts.result?.error || null,
        })),
      };

      const finalEventType = plan.status === SWARM_STATUS.COMPLETED || plan.status === SWARM_STATUS.PARTIAL_SUCCESS
        ? EVENT_TYPES.SWARM_COMPLETED
        : (plan.status === SWARM_STATUS.CANCELLED ? EVENT_TYPES.SWARM_CANCELLED : EVENT_TYPES.SWARM_FAILED);

      this.eventBus.emit(finalEventType, {
        threadId: plan.parentThreadId,
        turnId: plan.parentTurnId,
        payload: {
          swarmId,
          status: plan.status,
          success: finalOutcome.success,
          taskCount: plan.tasks.length,
          completedCount: aggregated.completedTaskCount,
          failedCount: aggregated.failedTaskCount,
          conflictsDetected: conflictReport.hasConflicts,
        },
      });

      if (evidenceGraphInstance) {
        try {
          evidenceGraphInstance.addNode({
            sessionId: plan.parentThreadId,
            type: 'TASK',
            statement: `Swarm ${swarmId} [${plan.status}]: ${aggregated.completedTaskCount}/${plan.tasks.length} tasks completed`,
            provenanceClass: 'SYSTEM_GENERATED',
            verificationLevel: 'OBSERVED',
            metadata: { swarmId, status: plan.status, completedCount: aggregated.completedTaskCount },
          });
        } catch (e) {}
      }

      return finalOutcome;
    } catch (err) {
      plan.status = SWARM_STATUS.FAILED;
      this.eventBus.emit(EVENT_TYPES.SWARM_FAILED, {
        threadId: plan.parentThreadId,
        turnId: plan.parentTurnId,
        payload: { swarmId, error: err.message },
      });
      throw err;
    }
  }

  /**
   * Internal scheduler executing ready tasks with bounded concurrency.
   * @private
   */
  async _runSchedulerLoop(swarmRecord, options = {}) {
    const { plan, taskStates, activePromises } = swarmRecord;
    const completedTasks = new Set();
    const failedTasks = new Set();

    while (true) {
      if (swarmRecord.cancelled) break;

      // 1. Identify ready tasks whose dependencies are satisfied
      const readyTasks = [];
      for (const [taskId, state] of taskStates.entries()) {
        if (state.status === SWARM_TASK_STATUS.PENDING || state.status === SWARM_TASK_STATUS.QUEUED) {
          const deps = state.task.dependencies || [];
          const allDepsMet = deps.every((d) => completedTasks.has(d));
          const anyDepFailed = deps.some((d) => failedTasks.has(d));

          if (anyDepFailed) {
            state.status = SWARM_TASK_STATUS.SKIPPED;
            failedTasks.add(taskId);
            this.eventBus.emit(EVENT_TYPES.SWARM_TASK_FAILED, {
              threadId: plan.parentThreadId,
              payload: { swarmId: plan.swarmId, taskId, reason: 'Prerequisite dependency failed' },
            });
          } else if (allDepsMet) {
            readyTasks.push(state);
          }
        }
      }

      // Sort ready tasks by priority (highest first)
      readyTasks.sort((a, b) => (b.task.priority || 1) - (a.task.priority || 1));

      // 2. Launch tasks up to maxConcurrency
      while (activePromises.size < plan.maxConcurrency && readyTasks.length > 0) {
        const nextState = readyTasks.shift();
        const taskId = nextState.task.taskId;
        nextState.status = SWARM_TASK_STATUS.RUNNING;

        this.eventBus.emit(EVENT_TYPES.SWARM_TASK_STARTED, {
          threadId: plan.parentThreadId,
          payload: {
            swarmId: plan.swarmId,
            taskId,
            role: nextState.task.role,
            objective: nextState.task.objective,
          },
        });

        const taskPromise = this._executeTask(swarmRecord, nextState, options)
          .then((res) => {
            activePromises.delete(taskId);
            if (res.success) {
              nextState.status = SWARM_TASK_STATUS.COMPLETED;
              nextState.result = res;
              completedTasks.add(taskId);
              this.eventBus.emit(EVENT_TYPES.SWARM_TASK_COMPLETED, {
                threadId: plan.parentThreadId,
                payload: { swarmId: plan.swarmId, taskId, result: res },
              });
            } else {
              nextState.status = SWARM_TASK_STATUS.FAILED;
              nextState.error = res.error || 'Task execution failed';
              nextState.result = res;
              failedTasks.add(taskId);
              this.eventBus.emit(EVENT_TYPES.SWARM_TASK_FAILED, {
                threadId: plan.parentThreadId,
                payload: { swarmId: plan.swarmId, taskId, error: nextState.error },
              });

              if (plan.failurePolicy === SWARM_FAILURE_POLICY.FAIL_FAST) {
                swarmRecord.cancelled = true;
              }
            }
          })
          .catch((err) => {
            activePromises.delete(taskId);
            nextState.status = SWARM_TASK_STATUS.FAILED;
            nextState.error = err.message;
            failedTasks.add(taskId);
            this.eventBus.emit(EVENT_TYPES.SWARM_TASK_FAILED, {
              threadId: plan.parentThreadId,
              payload: { swarmId: plan.swarmId, taskId, error: err.message },
            });

            if (plan.failurePolicy === SWARM_FAILURE_POLICY.FAIL_FAST) {
              swarmRecord.cancelled = true;
            }
          });

        activePromises.set(taskId, taskPromise);
      }

      // 3. Check termination conditions
      if (activePromises.size === 0 && readyTasks.length === 0) {
        // If there are still pending/queued tasks that can never run, mark them skipped
        for (const [, state] of taskStates.entries()) {
          if (state.status === SWARM_TASK_STATUS.PENDING || state.status === SWARM_TASK_STATUS.QUEUED) {
            state.status = SWARM_TASK_STATUS.SKIPPED;
          }
        }
        break;
      }

      // 4. Await next settling promise
      if (activePromises.size > 0) {
        await Promise.race(Array.from(activePromises.values()));
      }
    }
  }

  /**
   * Executes a single subagent task within the swarm.
   * @private
   */
  async _executeTask(swarmRecord, taskState, options = {}) {
    const { plan } = swarmRecord;
    const task = taskState.task;

    // 1. Create Child Thread via SubagentManager
    const childThread = this.subagentManager.createChildThread({
      parentThreadId: plan.parentThreadId,
      role: task.role,
      isolateWorkspace: task.isolateWorkspace,
      metadata: {
        swarmId: plan.swarmId,
        swarmTaskId: task.taskId,
        objective: task.objective,
        relevantFiles: task.relevantFiles,
        allowMutation: task.allowMutation,
        useWorkerRuntime: task.useWorkerRuntime,
        ...task.metadata,
      },
    });

    taskState.childThreadId = childThread.threadId;

    // Determine mock responses or handler
    let taskMockResponses = undefined;
    if (options.mockResponses) {
      if (typeof options.mockResponses === 'object') {
        const candidate = options.mockResponses[task.taskId] || options.mockResponses[task.role];
        if (candidate) {
          taskMockResponses = Array.isArray(candidate) ? candidate : [candidate];
        }
      }
    }

    const useWorker = Boolean(
      task.useWorkerRuntime &&
      !options.modelHandler &&
      options.useWorkerRuntime !== false
    );

    // 2. Execute Child Turn
    const turnResult = await this.subagentManager.startChildTurn(
      childThread.threadId,
      {
        taskGoal: task.objective,
        role: task.role,
        codingIntent: task.codingIntent,
        relevantFiles: task.relevantFiles,
        useWorkerRuntime: useWorker,
        mockResponses: taskMockResponses,
        ...task.metadata,
      },
      {
        approvalMode: options.approvalMode || (task.allowMutation ? 'auto' : 'strict'),
        modelHandler: options.modelHandler || (options.mockResponses ? this._createMockHandlerForTask(task, options.mockResponses) : undefined),
        mockResponses: taskMockResponses,
        workspacePath: childThread.metadata?.workspacePath,
      }
    );

    return turnResult;
  }

  /**
   * Generates mock model handler for a task if mock responses provided.
   * @private
   */
  _createMockHandlerForTask(task, mockResponses) {
    if (typeof mockResponses === 'function') return mockResponses;
    if (mockResponses[task.taskId]) {
      const resp = mockResponses[task.taskId];
      return Array.isArray(resp) ? async (m, t, o) => resp.shift() || resp[resp.length - 1] : async () => resp;
    }
    if (mockResponses[task.role]) {
      const resp = mockResponses[task.role];
      return Array.isArray(resp) ? async (m, t, o) => resp.shift() || resp[resp.length - 1] : async () => resp;
    }
    return undefined;
  }

  /**
   * Fan-In: Aggregates structured summaries and outputs across child results.
   * @private
   */
  _aggregateResults(swarmRecord) {
    const { taskStates } = swarmRecord;
    const summaries = [];
    const findings = [];
    const changedFiles = new Set();
    const changeSets = [];
    let completedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let verificationOutcome = null;

    for (const [, state] of taskStates.entries()) {
      if (state.status === SWARM_TASK_STATUS.COMPLETED) {
        completedCount++;
        const res = state.result;
        if (res) {
          if (res.summary) summaries.push(`[${state.task.role.toUpperCase()} - ${state.task.taskId}]: ${res.summary}`);
          if (Array.isArray(res.findings)) {
            for (const f of res.findings) findings.push(f);
          }
          if (Array.isArray(res.changedFiles)) {
            for (const f of res.changedFiles) changedFiles.add(f);
          }
          if (Array.isArray(res.changeSets)) {
            for (const cs of res.changeSets) changeSets.push(cs);
          }
          if (res.verification) {
            verificationOutcome = res.verification;
          }
        }
      } else if (state.status === SWARM_TASK_STATUS.FAILED) {
        failedCount++;
      } else if (state.status === SWARM_TASK_STATUS.SKIPPED || state.status === SWARM_TASK_STATUS.CANCELLED) {
        skippedCount++;
      }
    }

    return {
      completedTaskCount: completedCount,
      failedTaskCount: failedCount,
      skippedTaskCount: skippedCount,
      summaries,
      findings: Array.from(new Set(findings)),
      changedFiles: Array.from(changedFiles),
      changeSets,
      verification: verificationOutcome,
    };
  }

  /**
   * Conflict Detection across sibling ChangeSets.
   * @param {Array<Object>} changeSets
   * @param {Object} [options]
   * @returns {Object} Conflict Report
   */
  detectConflicts(changeSets = [], options = {}) {
    if (!Array.isArray(changeSets) || changeSets.length === 0) {
      return {
        hasConflicts: false,
        category: SWARM_CONFLICT_CATEGORY.NO_CONFLICT,
        conflictingFiles: [],
        conflicts: [],
      };
    }

    const fileToChanges = new Map(); // filePath -> Array<{ changeSetId, edit }>
    const conflictingFiles = new Set();
    const conflicts = [];

    // 1. Detect file overlap across sibling ChangeSets (if multiple ChangeSets)
    if (changeSets.length > 1) {
      for (const cs of changeSets) {
        const csId = cs.changeSetId || cs.id || 'cs_unknown';
        const files = cs.files || cs.edits || [];

        for (const f of files) {
          const targetPath = path.normalize(f.filePath || f.path || '');
          if (!fileToChanges.has(targetPath)) {
            fileToChanges.set(targetPath, []);
          }
          fileToChanges.get(targetPath).push({
            changeSetId: csId,
            original: f.original,
            replacement: f.replacement,
          });
        }
      }

      for (const [filePath, edits] of fileToChanges.entries()) {
        if (edits.length > 1) {
          conflictingFiles.add(filePath);
          conflicts.push({
            filePath,
            category: SWARM_CONFLICT_CATEGORY.FILE_CONFLICT,
            reason: `Multiple sibling ChangeSets modified the same file: ${filePath}`,
            changeSetIds: edits.map((e) => e.changeSetId),
          });
        }
      }
    }

    // 2. Baseline Conflict Check against parent disk state
    const parentWs = options.workspacePath;
    if (parentWs && fs.existsSync(parentWs)) {
      for (const cs of changeSets) {
        const files = cs.files || cs.edits || [];
        for (const f of files) {
          const fullPath = path.isAbsolute(f.filePath) ? f.filePath : path.join(parentWs, f.filePath);
          if (fs.existsSync(fullPath)) {
            const currentDisk = fs.readFileSync(fullPath, 'utf8');
            if (f.original && !currentDisk.includes(f.original)) {
              conflictingFiles.add(f.filePath);
              conflicts.push({
                filePath: f.filePath,
                category: SWARM_CONFLICT_CATEGORY.BASELINE_CONFLICT,
                reason: `Parent disk content for "${f.filePath}" has diverged from child ChangeSet baseline`,
                changeSetId: cs.changeSetId,
              });
            }
          }
        }
      }
    }

    const hasConflicts = conflicts.length > 0;
    let category = SWARM_CONFLICT_CATEGORY.NO_CONFLICT;
    if (hasConflicts) {
      category = conflicts.some((c) => c.category === SWARM_CONFLICT_CATEGORY.FILE_CONFLICT)
        ? SWARM_CONFLICT_CATEGORY.FILE_CONFLICT
        : SWARM_CONFLICT_CATEGORY.BASELINE_CONFLICT;
    }

    return {
      hasConflicts,
      category,
      conflictingFiles: Array.from(conflictingFiles),
      conflicts,
    };
  }


  /**
   * Adopts non-conflicting ChangeSets atomically into parent workspace.
   * @param {Array<Object>} changeSets
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async adoptNonConflictingChanges(changeSets = [], options = {}) {
    const {
      parentWorkspacePath,
      parentThreadId,
      parentTurnId,
      verifierFn,
    } = options;

    if (!parentWorkspacePath || !fs.existsSync(parentWorkspacePath)) {
      throw new Error(`[SWARM-ORCHESTRATOR] Invalid parentWorkspacePath: "${parentWorkspacePath}"`);
    }

    // Check conflict safety again before mutation
    const conflictCheck = this.detectConflicts(changeSets, { workspacePath: parentWorkspacePath });
    if (conflictCheck.hasConflicts) {
      throw new Error(`[SWARM-ORCHESTRATOR] Cannot auto-adopt ChangeSets with active conflicts: ${conflictCheck.conflicts.map((c) => c.reason).join('; ')}`);
    }

    // Merge non-conflicting edits into a unified parent ChangeSet
    const mergedEdits = [];
    for (const cs of changeSets) {
      const edits = cs.files || cs.edits || [];
      for (const e of edits) {
        mergedEdits.push(e);
      }
    }

    if (mergedEdits.length === 0) {
      return { success: true, adoptedFiles: [], status: 'NO_CHANGES' };
    }

    const parentChangeSet = new ChangeSet({
      workspacePath: parentWorkspacePath,
      threadId: parentThreadId,
      turnId: parentTurnId,
      edits: mergedEdits,
    });

    // Parent safety evaluation & approval
    await parentChangeSet.evaluateSafety();
    parentChangeSet.approve();

    // Atomic Transactional Apply
    const applyOutcome = await parentChangeSet.apply();
    if (!applyOutcome.success) {
      throw new Error(`[SWARM-ORCHESTRATOR] Failed to apply merged ChangeSet: ${applyOutcome.error}`);
    }

    // Post-Adoption Verification
    let verification = null;
    if (typeof verifierFn === 'function') {
      verification = await parentChangeSet.verify(verifierFn);
    }

    return {
      success: true,
      changeSetId: parentChangeSet.changeSetId,
      adoptedFiles: parentChangeSet.files.map((f) => f.filePath),
      verification,
    };
  }

  /**
   * Cancels a running swarm and all active child threads/workers.
   * @param {string} swarmId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelSwarm(swarmId, reason = 'Swarm cancelled by parent authority') {
    const swarmRecord = this.activeSwarms.get(swarmId);
    if (!swarmRecord) return { success: false, error: 'Swarm not found' };

    swarmRecord.cancelled = true;
    swarmRecord.plan.status = SWARM_STATUS.CANCELLED;

    // Cancel all active child threads
    for (const [, state] of swarmRecord.taskStates.entries()) {
      if (state.childThreadId && state.status === SWARM_TASK_STATUS.RUNNING) {
        try {
          this.subagentManager.cancelChild(state.childThreadId, reason);
        } catch (e) {}
        state.status = SWARM_TASK_STATUS.CANCELLED;
      }
    }

    this.eventBus.emit(EVENT_TYPES.SWARM_CANCELLED, {
      threadId: swarmRecord.plan.parentThreadId,
      turnId: swarmRecord.plan.parentTurnId,
      payload: { swarmId, reason },
    });

    return {
      success: true,
      swarmId,
      status: SWARM_STATUS.CANCELLED,
    };
  }

  /**
   * Retrieves live status of a swarm.
   * @param {string} swarmId
   * @returns {Object|null}
   */
  getSwarmStatus(swarmId) {
    const record = this.activeSwarms.get(swarmId);
    if (!record) return null;

    return {
      swarmId,
      parentThreadId: record.plan.parentThreadId,
      goal: record.plan.goal,
      status: record.plan.status,
      maxConcurrency: record.plan.maxConcurrency,
      failurePolicy: record.plan.failurePolicy,
      startTime: record.startTime,
      endTime: record.endTime,
      tasks: Array.from(record.taskStates.values()).map((ts) => ({
        taskId: ts.task.taskId,
        role: ts.task.role,
        objective: ts.task.objective,
        dependencies: ts.task.dependencies || [],
        codingIntent: ts.task.codingIntent,
        allowMutation: ts.task.allowMutation,
        priority: ts.task.priority,
        status: ts.status,
        childThreadId: ts.childThreadId,
        result: ts.result || null,
        error: ts.error || null,
      })),
    };
  }

  /**
   * Cleans up all active swarms.
   */
  dispose() {
    for (const [swarmId] of this.activeSwarms) {
      this.cancelSwarm(swarmId, 'Orchestrator disposed');
    }
    this.activeSwarms.clear();
  }
}

const swarmOrchestrator = new SwarmOrchestrator();

module.exports = {
  SwarmOrchestrator,
  swarmOrchestrator,
};
