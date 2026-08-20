/**
 * NEXUS CODEX HARNESS - SUBAGENT MANAGER (Milestone 8)
 * Orchestrates true child-thread subagents with isolated Thread, Turn, Context,
 * and AgentLoop lifecycles under parent Thread authority.
 */

const path = require('path');
const fs = require('fs');
const {
  THREAD_STATUS,
  TURN_STATUS,
  ITEM_STATUS,
  ITEM_TYPES,
  EVENT_TYPES,
  DEFAULT_SUBAGENT_LIMITS,
  generateThreadId,
  generateTurnId,
} = require('./types');


const { aiRoleRouter } = require('../ai/AIRoleRouter');
const { HandoffState } = require('./HandoffState');
const { workspaceIsolationManager, WorkspaceIsolationManager } = require('./WorkspaceIsolationManager');
const { workerRuntime, WorkerRuntime } = require('./WorkerRuntime');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

class SubagentManager {
  /**
   * @param {Object} options
   * @param {Object} options.runtime - Bound HarnessRuntime instance
   * @param {Object} [options.limits] - Custom resource and depth limits
   * @param {Object} [options.workspaceIsolationManager]
   * @param {Object} [options.workerRuntime]
   */
  constructor(options = {}) {
    this.runtime = options.runtime || null;
    this.workspaceIsolationManager = options.workspaceIsolationManager || workspaceIsolationManager;
    this.workerRuntime = options.workerRuntime || workerRuntime;
    this.limits = {
      ...DEFAULT_SUBAGENT_LIMITS,
      ...(options.limits || {}),
    };
    this.activeChildTasks = new Map(); // childThreadId -> Promise / abort handler
  }



  /**
   * Sets or updates the HarnessRuntime instance.
   * @param {Object} runtime
   */
  setRuntime(runtime) {
    this.runtime = runtime;
  }

  /**
   * Creates a new child Thread under a parent Thread.
   * @param {Object} options
   * @param {string} options.parentThreadId - Parent Thread ID
   * @param {string} [options.parentTurnId] - Parent Turn ID initiating delegation
   * @param {string} options.role - Assigned subagent role (e.g. 'researcher', 'tester', 'reviewer', 'coder')
   * @param {string} [options.providerId] - Optional explicit AI provider override
   * @param {string} [options.modelId] - Optional explicit AI model override
   * @param {Object} [options.metadata] - Additional thread metadata
   * @param {Object} [options.limits] - Custom limit overrides
   * @returns {Object} Created child Thread
   */
  createChildThread(options = {}) {
    if (!this.runtime) {
      throw new Error('[SUBAGENT-MANAGER] HarnessRuntime not bound to SubagentManager');
    }

    const {
      parentThreadId,
      parentTurnId = null,
      role = 'researcher',
      metadata = {},
    } = options;

    if (!parentThreadId) {
      throw new Error('[SUBAGENT-MANAGER] Cannot create child thread without parentThreadId');
    }

    const parentThread = this.runtime.threadManager.getThread(parentThreadId);
    if (!parentThread) {
      throw new Error(`[SUBAGENT-MANAGER] Parent Thread "${parentThreadId}" not found`);
    }

    if ([THREAD_STATUS.ARCHIVED].includes(parentThread.status)) {
      throw new Error(`[SUBAGENT-MANAGER] Cannot create subagent under parent Thread in status "${parentThread.status}"`);
    }

    const activeLimits = { ...this.limits, ...(options.limits || {}) };

    // 1. Depth Limit Enforcement
    const parentDepth = typeof parentThread.depth === 'number' ? parentThread.depth : 0;
    const targetDepth = parentDepth + 1;
    if (targetDepth > activeLimits.maxChildDepth) {
      throw new Error(`[SUBAGENT-MANAGER] Max subagent depth exceeded (current depth: ${parentDepth}, max depth: ${activeLimits.maxChildDepth})`);
    }

    // 2. Max Children Per Thread Enforcement
    const existingChildren = this.runtime.threadManager.listChildThreads(parentThreadId);
    if (existingChildren.length >= activeLimits.maxChildrenPerThread) {
      throw new Error(`[SUBAGENT-MANAGER] Max children per thread exceeded (existing: ${existingChildren.length}, limit: ${activeLimits.maxChildrenPerThread})`);
    }

    // 3. Max Children Per Turn Enforcement
    if (parentTurnId) {
      const turnChildren = existingChildren.filter((c) => c.parentTurnId === parentTurnId);
      if (turnChildren.length >= activeLimits.maxTotalChildrenPerTurn) {
        throw new Error(`[SUBAGENT-MANAGER] Max children for turn "${parentTurnId}" exceeded (existing: ${turnChildren.length}, limit: ${activeLimits.maxTotalChildrenPerTurn})`);
      }
    }

    // 4. Role Resolution (Delegated to AIRoleRouter)
    const resolvedRole = aiRoleRouter.resolveRole(role, {
      roles: metadata.roles || {},
      aiState: metadata.aiState || {},
    });

    const providerId = options.providerId || resolvedRole.providerId;
    const modelId = options.modelId || resolvedRole.modelId;

    const childThreadId = options.threadId || generateThreadId();
    const parentWorkspacePath = path.resolve(
      options.parentWorkspacePath || parentThread.metadata?.workspacePath || process.cwd()
    );

    let childWorkspace = null;
    let effectiveWorkspacePath = options.workspacePath || parentWorkspacePath;

    const shouldIsolate = Boolean(
      options.isolateWorkspace ||
      options.workspaceIsolationMode ||
      (role === 'coder' && options.isolateWorkspace !== false)
    );

    if (shouldIsolate) {
      try {
        childWorkspace = this.workspaceIsolationManager.createChildWorkspace({
          parentWorkspacePath,
          threadId: childThreadId,
          parentThreadId,
          mode: options.workspaceIsolationMode || 'auto',
          cleanupPolicy: options.cleanupPolicy || 'DELETE_ON_COMPLETION',
          metadata: { role },
        });
        effectiveWorkspacePath = childWorkspace.childWorkspacePath;
      } catch (wsErr) {
        console.warn('[SUBAGENT-MANAGER] Workspace isolation fallback:', wsErr.message);
      }
    }

    const childMetadata = {
      ...parentThread.metadata,
      ...metadata,
      role,
      roleDefinition: resolvedRole,
      providerId,
      modelId,
      parentWorkspacePath,
      workspacePath: effectiveWorkspacePath,
      workspaceId: childWorkspace ? childWorkspace.workspaceId : null,
      workspaceIsolationMode: childWorkspace ? childWorkspace.mode : 'none',
      isIsolatedWorkspace: Boolean(childWorkspace),
      title: options.title || `Subagent [${role}]: ${parentThread.metadata?.title || 'Task'}`,
    };

    const childThread = this.runtime.threadManager.createThread({
      threadId: childThreadId,
      parentThreadId,
      parentTurnId,
      rootThreadId: parentThread.rootThreadId || parentThread.threadId,
      depth: targetDepth,
      role,
      createdBy: 'subagent_manager',
      metadata: childMetadata,
    });


    // Emit SUBAGENT_CREATED event
    this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_CREATED, {
      threadId: parentThreadId,
      turnId: parentTurnId,
      payload: {
        childThreadId: childThread.threadId,
        parentThreadId,
        parentTurnId,
        role,
        depth: targetDepth,
        providerId,
        modelId,
      },
    });

    // Record in EvidenceGraph
    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: parentThreadId,
          type: 'TASK',
          statement: `Subagent created [${role}] (childThreadId: ${childThread.threadId}, depth: ${targetDepth})`,
          provenanceClass: 'SYSTEM_GENERATED',
          verificationLevel: 'OBSERVED',
          metadata: {
            childThreadId: childThread.threadId,
            role,
            depth: targetDepth,
          },
        });
      } catch (e) {}
    }

    return childThread;
  }

  /**
   * Starts and executes a scoped Turn on a child Thread.
   * @param {string} childThreadId
   * @param {Object} delegationPackage - Scoped task specification for child
   * @param {Object} [options]
   * @returns {Promise<Object>} Structured subagent result
   */
  async startChildTurn(childThreadId, delegationPackage = {}, options = {}) {
    if (!this.runtime) {
      throw new Error('[SUBAGENT-MANAGER] HarnessRuntime not bound to SubagentManager');
    }

    if (!childThreadId) {
      throw new Error('[SUBAGENT-MANAGER] childThreadId is required');
    }

    const childThread = this.runtime.threadManager.getThread(childThreadId);
    if (!childThread) {
      throw new Error(`[SUBAGENT-MANAGER] Child Thread "${childThreadId}" not found`);
    }

    const parentThreadId = childThread.parentThreadId;
    const parentTurnId = delegationPackage.parentTurnId || childThread.parentTurnId || null;
    const taskGoal = delegationPackage.taskGoal || delegationPackage.task || childThread.metadata?.title || 'Subagent objective';
    const role = childThread.role || delegationPackage.role || 'researcher';
    const codingIntent = delegationPackage.codingIntent || (role === 'coder' ? 'MUTATION' : 'READ_ONLY');
    const workspacePath = delegationPackage.workspacePath || childThread.metadata?.workspacePath || process.cwd();
    const activeFilePath = delegationPackage.activeFilePath || childThread.metadata?.activeFilePath || null;

    // 1. Create Scoped Child HandoffState (Child must NOT receive raw parent conversation)
    const constraints = Array.isArray(delegationPackage.constraints)
      ? [...delegationPackage.constraints]
      : [];
    if (childThread.metadata?.isIsolatedWorkspace) {
      constraints.push(`[ISOLATION] You are working inside an isolated child workspace at "${workspacePath}". Modifications and tools are scoped to this directory.`);
    }

    const childHandoff = new HandoffState({
      threadId: childThreadId,
      sourceTurnId: parentTurnId || 'turn_delegation',
      taskGoal,
      codingIntent,
      workspacePath,
      activeFilePath,
      completedObjectives: [],
      pendingObjectives: Array.isArray(delegationPackage.pendingObjectives)
        ? delegationPackage.pendingObjectives
        : [taskGoal],
      changedFiles: Array.isArray(delegationPackage.relevantFiles)
        ? delegationPackage.relevantFiles
        : (activeFilePath ? [activeFilePath] : []),
      unresolvedIssues: [],
      verificationState: delegationPackage.verificationRequirements
        ? { testStatus: 'NOT_RUN', failingTests: [], verified: false }
        : { testStatus: 'NOT_RUN', failingTests: [], verified: true },
      safetyState: { overallRiskLevel: 'AUTO_APPROVE', riskScore: 0 },
      importantDecisions: Array.isArray(delegationPackage.relevantDecisions)
        ? delegationPackage.relevantDecisions
        : [],
      nextRecommendedAction: taskGoal,
      continuationConstraints: constraints,
    });

    childThread.handoffState = childHandoff;
    childThread.metadata.handoffState = childHandoff.toJSON();

    // 2. Record SUBAGENT_DELEGATION Item on Parent Turn if parentTurnId exists
    let delegationItem = null;
    if (parentTurnId) {
      try {
        delegationItem = this.runtime.startItem(parentTurnId, ITEM_TYPES.SUBAGENT_DELEGATION, {
          childThreadId,
          role,
          task: taskGoal,
          status: ITEM_STATUS.IN_PROGRESS,
          codingIntent,
          workspacePath,
          isIsolatedWorkspace: Boolean(childThread.metadata?.isIsolatedWorkspace),
        });
      } catch (e) {}
    }

    // Emit SUBAGENT_STARTED
    this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_STARTED, {
      threadId: parentThreadId,
      turnId: parentTurnId,
      payload: {
        childThreadId,
        parentThreadId,
        parentTurnId,
        role,
        taskGoal,
        workspacePath,
        isIsolatedWorkspace: Boolean(childThread.metadata?.isIsolatedWorkspace),
      },
    });

    // Record in EvidenceGraph
    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: parentThreadId,
          type: 'TASK',
          statement: `Subagent started [${role}]: "${taskGoal}" (childThreadId: ${childThreadId})`,
          provenanceClass: 'SYSTEM_GENERATED',
          verificationLevel: 'OBSERVED',
          metadata: { childThreadId, role, taskGoal, workspacePath },
        });
      } catch (e) {}
    }

    // 3. Execute Child Turn via WorkerRuntime or in-process HarnessRuntime
    let turnOutcome;
    const useWorker = Boolean(
      (options.useWorkerRuntime ?? delegationPackage.useWorkerRuntime ?? childThread.metadata?.useWorkerRuntime) &&
      typeof options.modelHandler !== 'function'
    );


    if (useWorker) {
      let worker = this.workerRuntime.getStatus(childThreadId);
      if (!worker) {
        worker = this.workerRuntime.startWorker({
          childThreadId,
          workspacePath,
          workerType: options.workerType || 'process',
          limits: options.workerLimits,
        });
      }

      const childTurnId = delegationPackage.turnId || generateTurnId();

      try {
        const workerResult = await this.workerRuntime.executeTurn(
          worker.workerId,
          {
            threadId: childThreadId,
            turnId: childTurnId,
            userInput: taskGoal,
            role: delegationPackage.role,
            intent: codingIntent,
            relevantFiles: delegationPackage.relevantFiles,
            workspacePath,
            activeFilePath,
            handoffState: childHandoff ? childHandoff.toJSON() : null,
            mockResponses: delegationPackage.mockResponses || options.mockResponses,
          },
          options
        );


        turnOutcome = {
          success: workerResult.success,
          status: workerResult.status,
          finalResponse: workerResult.summary,
          error: workerResult.error,
          workerResult,
        };
      } catch (workerErr) {
        turnOutcome = {
          success: false,
          status: TURN_STATUS.FAILED,
          error: workerErr.message,
          finalResponse: `Worker execution error: ${workerErr.message}`,
        };
      }
    } else {
      try {
        turnOutcome = await this.runtime.runTurn({
          threadId: childThreadId,
          userInput: taskGoal,
          workspacePath,
          activeFilePath,
          intent: codingIntent,
          role,
          isChild: true,
          allowedTools: options.allowedTools || childThread.metadata?.allowedTools,
          handoffState: childHandoff,
          providerId: options.providerId || childThread.metadata?.providerId,
          modelId: options.modelId || childThread.metadata?.modelId,
          approvalMode: options.approvalMode || 'strict',
          modelHandler: options.modelHandler,
          contextOptions: options.contextOptions,
        });
      } catch (turnErr) {
        turnOutcome = {
          success: false,
          status: TURN_STATUS.FAILED,
          error: turnErr.message,
          finalResponse: `Subagent execution error: ${turnErr.message}`,
        };
      }
    }

    // 4. Construct Structured Child Result (Parent receives structured summary, not raw transcript)
    let structuredResult;
    if (useWorker && turnOutcome.workerResult) {
      structuredResult = {
        childThreadId,
        parentThreadId,
        parentTurnId,
        role,
        status: turnOutcome.workerResult.status || (turnOutcome.success ? TURN_STATUS.COMPLETED : TURN_STATUS.FAILED),
        success: Boolean(turnOutcome.success),
        summary: turnOutcome.workerResult.summary || turnOutcome.finalResponse || 'Completed',
        findings: turnOutcome.workerResult.findings || [],
        changedFiles: turnOutcome.workerResult.changedFiles || [],
        changeSets: turnOutcome.workerResult.changeSets || [],
        verification: turnOutcome.workerResult.verification || null,
        handoffState: turnOutcome.workerResult.handoffState || (childHandoff ? childHandoff.toJSON() : null),
        evidenceRefs: [],
        workspaceId: childThread.metadata?.workspaceId || null,
        workspacePath: childThread.metadata?.workspacePath || workspacePath,
        isIsolatedWorkspace: Boolean(childThread.metadata?.isIsolatedWorkspace),
        isWorkerIsolated: true,
        error: turnOutcome.error || turnOutcome.workerResult.error || null,
      };
    } else {
      const childTurn = turnOutcome.turn || (turnOutcome.turnId ? this.runtime.turnManager.getTurn(turnOutcome.turnId) : null);
      const childItems = childTurn ? this.runtime.itemStore.getItemsByTurn(childTurn.turnId) : [];

      const changedFiles = [];
      const changeSets = [];
      const findings = [];
      let verificationOutcome = null;

      for (const item of childItems) {
        if (item.type === ITEM_TYPES.FILE_CHANGE && item.payload?.filePath) {
          changedFiles.push(item.payload.filePath);
        }
        if (item.type === ITEM_TYPES.CHANGE_SET && item.payload) {
          changeSets.push(item.payload.changeSet || item.payload);
        }
        if (item.type === ITEM_TYPES.TOOL_RESULT && item.payload?.result?.changeSet) {
          changeSets.push(item.payload.result.changeSet);
        }

        if (item.type === ITEM_TYPES.TOOL_RESULT && item.payload?.toolName === 'run_tests') {
          verificationOutcome = {
            testStatus: item.payload?.success ? 'PASSED' : 'FAILED',
            details: item.payload?.result,
          };
        }
        if (item.type === ITEM_TYPES.AGENT_MESSAGE && item.payload?.text) {
          findings.push(item.payload.text);
        }
      }

      const summary = turnOutcome.finalResponse
        || (turnOutcome.error ? `Subagent execution error: ${turnOutcome.error}` : null)
        || findings[findings.length - 1]
        || (turnOutcome.success ? 'Subagent completed task' : 'Subagent execution failed');

      structuredResult = {
        childThreadId,
        parentThreadId,
        parentTurnId,
        role,
        status: turnOutcome.status || (turnOutcome.success ? TURN_STATUS.COMPLETED : TURN_STATUS.FAILED),
        success: Boolean(turnOutcome.success),
        summary,
        findings: Array.from(new Set(findings)),
        changedFiles: Array.from(new Set(changedFiles)),
        changeSets,
        verification: verificationOutcome || turnOutcome.turn?.metadata?.verification || null,
        handoffState: turnOutcome.handoffState || childThread.handoffState || null,
        evidenceRefs: [],
        workspaceId: childThread.metadata?.workspaceId || null,
        workspacePath: childThread.metadata?.workspacePath || workspacePath,
        isIsolatedWorkspace: Boolean(childThread.metadata?.isIsolatedWorkspace),
        error: turnOutcome.error || null,
      };
    }




    // 5. Complete Parent Delegation Item & Record SUBAGENT_RESULT Item
    if (parentTurnId) {
      if (delegationItem) {
        try {
          if (structuredResult.success) {
            this.runtime.completeItem(delegationItem.itemId, {
              status: ITEM_STATUS.COMPLETED,
              resultSummary: structuredResult.summary,
            });
          } else if (structuredResult.status === TURN_STATUS.CANCELLED) {
            this.runtime.cancelItem(delegationItem.itemId, 'Subagent was cancelled');
          } else {
            this.runtime.failItem(delegationItem.itemId, structuredResult.error || 'Subagent failed');
          }
        } catch (e) {}
      }

      try {
        const resultItem = this.runtime.startItem(parentTurnId, ITEM_TYPES.SUBAGENT_RESULT, {
          childThreadId,
          role,
          status: structuredResult.status,
          success: structuredResult.success,
          summary: structuredResult.summary,
          findings: structuredResult.findings,
          changedFiles: structuredResult.changedFiles,
          verification: structuredResult.verification,
          recommendedNextAction: structuredResult.summary,
        });
        this.runtime.completeItem(resultItem.itemId);
      } catch (e) {}
    }

    // 6. Emit Lifecycle Events
    if (structuredResult.status === TURN_STATUS.CANCELLED) {
      this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_CANCELLED, {
        threadId: parentThreadId,
        turnId: parentTurnId,
        payload: { childThreadId, role, reason: turnOutcome.error || 'Cancelled' },
      });
    } else if (structuredResult.success) {
      this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_COMPLETED, {
        threadId: parentThreadId,
        turnId: parentTurnId,
        payload: structuredResult,
      });
    } else {
      this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_FAILED, {
        threadId: parentThreadId,
        turnId: parentTurnId,
        payload: { childThreadId, role, error: structuredResult.error },
      });
    }

    this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_RESULT, {
      threadId: parentThreadId,
      turnId: parentTurnId,
      payload: structuredResult,
    });

    // Record in EvidenceGraph
    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: parentThreadId,
          type: 'OBSERVATION',
          statement: `Subagent result [${role}]: ${structuredResult.summary.slice(0, 200)}`,
          provenanceClass: structuredResult.success ? 'OBSERVED' : 'MODEL_INFERENCE',
          verificationLevel: structuredResult.verification?.testStatus === 'PASSED' ? 'TEST_VERIFIED' : 'OBSERVED',
          metadata: {
            childThreadId,
            role,
            status: structuredResult.status,
            changedFiles: structuredResult.changedFiles,
          },
        });
      } catch (e) {}
    }

    return structuredResult;
  }

  /**
   * Convenience: Creates a child thread, initiates a turn, and awaits structured result.
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async runChild(options = {}) {
    const childThread = this.createChildThread(options);
    const delegationPackage = {
      taskGoal: options.taskGoal || options.task || options.title,
      role: options.role || childThread.role,
      codingIntent: options.codingIntent || options.intent,
      workspacePath: options.workspacePath || childThread.metadata?.workspacePath,
      activeFilePath: options.activeFilePath,
      constraints: options.constraints,
      relevantDecisions: options.relevantDecisions,
      relevantFiles: options.relevantFiles,
      verificationRequirements: options.verificationRequirements,
      parentTurnId: options.parentTurnId,
    };

    return this.startChildTurn(childThread.threadId, delegationPackage, options);
  }

  /**
   * Runs multiple child tasks with bounded concurrency and preflight mutation safety checks.
   * @param {Array<Object>} childrenConfigs - List of child task configurations
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>} List of structured child results
   */
  async runChildrenConcurrent(childrenConfigs = [], options = {}) {
    if (!Array.isArray(childrenConfigs) || childrenConfigs.length === 0) {
      return [];
    }

    const maxConcurrent = options.maxConcurrent || this.limits.maxConcurrentChildren;
    const conflictPolicy = options.conflictPolicy || 'serialize'; // 'serialize' | 'reject'

    // 1. Preflight Mutation Conflict Check
    const mutationTasks = childrenConfigs.filter((c) => (c.codingIntent === 'MUTATION' || c.intent === 'MUTATION' || c.role === 'coder'));
    const targetFileUsages = new Map(); // filePath -> array of task indices

    mutationTasks.forEach((task, idx) => {
      const files = [
        task.activeFilePath,
        ...(Array.isArray(task.relevantFiles) ? task.relevantFiles : []),
        ...(Array.isArray(task.targetFiles) ? task.targetFiles : []),
      ].filter(Boolean);

      for (const file of files) {
        if (!targetFileUsages.has(file)) {
          targetFileUsages.set(file, []);
        }
        targetFileUsages.get(file).push(idx);
      }
    });

    // Check if any file has overlapping mutation requests
    const conflictingFiles = [];
    for (const [file, taskIndices] of targetFileUsages.entries()) {
      if (taskIndices.length > 1) {
        conflictingFiles.push(file);
      }
    }

    if (conflictingFiles.length > 0) {
      if (conflictPolicy === 'reject') {
        throw new Error(`[SUBAGENT-MANAGER] Concurrent mutation conflict on files: [${conflictingFiles.join(', ')}]. Concurrent overlapping mutations strictly disallowed.`);
      }
      // If serialize policy: execute conflicting mutation tasks sequentially
    }

    // 2. Execute tasks with bounded concurrency pool
    const results = [];
    const executing = [];

    for (const config of childrenConfigs) {
      const taskPromise = (async () => {
        return this.runChild({
          ...options,
          ...config,
        });
      })();

      results.push(taskPromise);

      if (maxConcurrent <= childrenConfigs.length) {
        const e = taskPromise.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= maxConcurrent) {
          await Promise.race(executing);
        }
      }
    }

    return Promise.all(results);
  }

  /**
   * Cancels an active child thread.
   * @param {string} childThreadId
   * @param {string} [reason]
   * @returns {Object} Cancel result
   */
  cancelChild(childThreadId, reason = 'Subagent cancelled by user or parent directive') {
    if (!this.runtime) {
      throw new Error('[SUBAGENT-MANAGER] HarnessRuntime not bound to SubagentManager');
    }

    const childThread = this.runtime.threadManager.getThread(childThreadId);
    if (!childThread) {
      throw new Error(`[SUBAGENT-MANAGER] Child Thread "${childThreadId}" not found`);
    }

    const activeTurns = this.runtime.turnManager.listTurnsByThread(childThreadId)
      .filter((t) => [TURN_STATUS.RUNNING, TURN_STATUS.WAITING_FOR_APPROVAL, TURN_STATUS.PAUSED].includes(t.status));

    for (const turn of activeTurns) {
      try {
        this.runtime.cancelTurn(turn.turnId, reason);
      } catch (e) {}
    }

    try {
      this.workerRuntime.cancelWorker(childThreadId, reason);
    } catch (e) {}

    this.runtime.eventBus.emit(EVENT_TYPES.SUBAGENT_CANCELLED, {
      threadId: childThread.parentThreadId,
      payload: {
        childThreadId,
        parentThreadId: childThread.parentThreadId,
        reason,
      },
    });

    return {
      success: true,
      childThreadId,
      status: TURN_STATUS.CANCELLED,
    };
  }

  /**
   * Cancels all active child threads belonging to a parent thread.
   * @param {string} parentThreadId
   * @param {string} [reason]
   * @returns {Array<Object>}
   */
  cancelAllChildren(parentThreadId, reason = 'Parent thread cancelled') {
    if (!this.runtime || !parentThreadId) return [];

    const children = this.runtime.threadManager.listChildThreads(parentThreadId);
    const cancelResults = [];

    for (const child of children) {
      try {
        const res = this.cancelChild(child.threadId, reason);
        cancelResults.push(res);
      } catch (e) {}
    }

    return cancelResults;
  }

  /**
   * Retrieves a child Thread by ID.
   * @param {string} childThreadId
   * @returns {Object|null}
   */
  getChildThread(childThreadId) {
    if (!this.runtime) return null;
    return this.runtime.threadManager.getThread(childThreadId);
  }

  /**
   * Lists all children for a parent Thread.
   * @param {string} parentThreadId
   * @returns {Array<Object>}
   */
  listChildren(parentThreadId) {
    if (!this.runtime || !parentThreadId) return [];
    return this.runtime.threadManager.listChildThreads(parentThreadId);
  }

  /**
   * Starts an isolated worker for a child thread.
   * @param {Object} options
   * @returns {Object}
   */
  startWorker(options = {}) {
    return this.workerRuntime.startWorker(options);
  }

  /**
   * Cancels a worker.
   * @param {string} workerIdOrThreadId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelWorker(workerIdOrThreadId, reason) {
    return this.workerRuntime.cancelWorker(workerIdOrThreadId, reason);
  }

  /**
   * Force terminates a worker.
   * @param {string} workerIdOrThreadId
   * @param {boolean} [force=true]
   * @returns {Object}
   */
  terminateWorker(workerIdOrThreadId, force = true) {
    return this.workerRuntime.terminateWorker(workerIdOrThreadId, force);
  }

  /**
   * Retrieves worker status.
   * @param {string} workerIdOrThreadId
   * @returns {Object|null}
   */
  getWorkerStatus(workerIdOrThreadId) {
    return this.workerRuntime.getStatus(workerIdOrThreadId);
  }

  /**
   * Authoritatively adopts changes produced by a child subagent into the parent workspace.
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async adoptChildChanges(options = {}) {
    return this.workspaceIsolationManager.adoptChildChanges(options);
  }

  /**
   * Cleans up an isolated child workspace.
   * @param {string} id - workspaceId or threadId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async cleanupChildWorkspace(id, options = {}) {
    return this.workspaceIsolationManager.cleanupChildWorkspace(id, options);
  }

  /**
   * Retrieves an isolated workspace record.
   * @param {string} id - workspaceId or threadId
   * @returns {Object|null}
   */
  getChildWorkspace(id) {
    return this.workspaceIsolationManager.getChildWorkspace(id);
  }

  /**
   * Lists all isolated child workspaces for a parent workspace.
   * @param {string} [parentWorkspacePath]
   * @returns {Array<Object>}
   */
  listChildWorkspaces(parentWorkspacePath) {
    return this.workspaceIsolationManager.listChildWorkspaces(parentWorkspacePath);
  }
}


const subagentManager = new SubagentManager();

module.exports = {
  SubagentManager,
  subagentManager,
};

