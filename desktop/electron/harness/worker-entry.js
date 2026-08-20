/**
 * NEXUS CODEX HARNESS - WORKER RUNTIME ENTRYPOINT (Milestone 9B)
 * Dedicated process/thread entrypoint for isolated subagent worker execution.
 * Communicates strictly via the normalized Worker Message Protocol.
 */

const path = require('path');
const fs = require('fs');
const { isMainThread, parentPort } = (function() {
  try {
    return require('worker_threads');
  } catch (e) {
    return { isMainThread: true, parentPort: null };
  }
})();

const {
  WORKER_MESSAGE_TYPES,
  EVENT_TYPES,
  TURN_STATUS,
  ITEM_TYPES,
} = require('./types');
const { HarnessRuntime } = require('./HarnessRuntime');
const { HandoffState } = require('./HandoffState');
const secretFilter = require('../../security/secretFilter');

// Determine execution context (child_process fork vs worker_threads)
const isWorkerThread = !isMainThread && Boolean(parentPort);
const isChildProcess = Boolean(process.send);

/**
 * Sends a structured protocol message to the parent process/thread.
 * @param {Object} message
 */
function sendToParent(message) {
  const sanitized = {
    ...message,
    payload: secretFilter.sanitizeObject(message.payload || {}),
  };

  if (isWorkerThread) {
    parentPort.postMessage(sanitized);
  } else if (isChildProcess) {
    process.send(sanitized);
  }
}

// Global active turn execution state inside worker
let currentRequestId = null;
let currentThreadId = null;
let currentTurnId = null;
let activeApprovalResolvers = new Map(); // callId -> resolve function
let isolatedRuntime = null;

/**
 * Initializes the minimal isolated Harness runtime for this worker.
 */
function initRuntime() {
  isolatedRuntime = HarnessRuntime.createIsolated({ isolated: true });

  // Forward all internal harness events to parent with authoritative sequence IDs
  isolatedRuntime.eventBus.subscribe((evt) => {
    if ([EVENT_TYPES.TURN_COMPLETED, EVENT_TYPES.TURN_FAILED, EVENT_TYPES.TURN_CANCELLED].includes(evt.type)) {
      return;
    }
    sendToParent({
      type: evt.type,
      requestId: currentRequestId,
      threadId: currentThreadId || evt.threadId,
      turnId: currentTurnId || evt.turnId,
      eventId: evt.eventId,
      payload: evt.payload,
    });
  });
}


initRuntime();

/**
 * Handles incoming messages from parent.
 * @param {Object} msg
 */
async function handleParentMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  const { type, requestId, threadId, turnId, workspacePath, payload = {} } = msg;

  if (type === WORKER_MESSAGE_TYPES.PING) {
    sendToParent({
      type: WORKER_MESSAGE_TYPES.PONG,
      requestId,
      threadId,
      turnId,
      payload: { status: 'OK', timestamp: Date.now() },
    });
    return;
  }

  if (type === WORKER_MESSAGE_TYPES.SHUTDOWN) {
    sendToParent({
      type: EVENT_TYPES.WORKER_EXITED,
      requestId,
      threadId,
      turnId,
      payload: { reason: 'SHUTDOWN_REQUESTED' },
    });
    if (isChildProcess) {
      process.exit(0);
    }
    return;
  }

  if (type === WORKER_MESSAGE_TYPES.APPROVE_ACTION) {
    const callId = payload.callId;
    if (callId && activeApprovalResolvers.has(callId)) {
      const resolver = activeApprovalResolvers.get(callId);
      activeApprovalResolvers.delete(callId);
      resolver({ approved: true, force: Boolean(payload.force), reason: payload.reason });
    }
    return;
  }

  if (type === WORKER_MESSAGE_TYPES.REJECT_ACTION) {
    const callId = payload.callId;
    if (callId && activeApprovalResolvers.has(callId)) {
      const resolver = activeApprovalResolvers.get(callId);
      activeApprovalResolvers.delete(callId);
      resolver({ approved: false, reason: payload.reason || 'Rejected by parent' });
    }
    return;
  }

  if (type === WORKER_MESSAGE_TYPES.CANCEL_TURN) {
    if (currentTurnId) {
      try {
        isolatedRuntime.cancelTurn(currentTurnId, payload.reason || 'Turn cancelled by parent');
      } catch (e) {}
    }
    sendToParent({
      type: EVENT_TYPES.TURN_CANCELLED,
      requestId,
      threadId: currentThreadId || threadId,
      turnId: currentTurnId || turnId,
      payload: { reason: payload.reason || 'Cancelled by parent' },
    });
    return;
  }

  if (type === WORKER_MESSAGE_TYPES.START_TURN) {
    currentRequestId = requestId;
    currentThreadId = threadId;

    if (!workspacePath || !fs.existsSync(workspacePath)) {
      sendToParent({
        type: EVENT_TYPES.TURN_FAILED,
        requestId,
        threadId,
        turnId,
        payload: { error: `Invalid or non-existent isolated workspacePath: "${workspacePath}"` },
      });
      return;
    }

    sendToParent({
      type: EVENT_TYPES.WORKER_STARTED,
      requestId,
      threadId,
      turnId,
      payload: { workspacePath, timestamp: Date.now() },
    });

    try {
      // 1. Reconstruct Thread in Isolated Runtime
      const childThread = isolatedRuntime.createThread({
        threadId,
        role: payload.role || 'researcher',
        metadata: {
          workspacePath,
          role: payload.role,
          roleDefinition: payload.roleDefinition,
          providerId: payload.providerId,
          modelId: payload.modelId,
          isIsolatedWorkspace: true,
          ...payload.metadata,
        },
      });

      // 2. Reconstruct HandoffState
      let handoff = null;
      if (payload.handoffState) {
        handoff = new HandoffState({
          ...payload.handoffState,
          threadId,
          workspacePath,
        });
        childThread.handoffState = handoff;
      }

      // 3. Setup approval interceptor in AgentLoop
      isolatedRuntime.agentLoop.waitForApproval = async (tId, callId) => {
        return new Promise((resolve) => {
          activeApprovalResolvers.set(callId, resolve);
        });
      };

      // Custom mock model handler if provided (for deterministic tests)
      let customModelHandler = undefined;
      if (payload.mockResponses && Array.isArray(payload.mockResponses)) {
        let respIdx = 0;
        customModelHandler = async (messages) => {
          const resp = payload.mockResponses[respIdx] || payload.mockResponses[payload.mockResponses.length - 1];
          respIdx++;
          return resp;
        };
      }

      // 4. Execute Turn
      const taskGoal = payload.taskGoal || payload.task || 'Subagent execution';
      const turnOutcome = await isolatedRuntime.runTurn({
        threadId,
        userInput: taskGoal,
        workspacePath,
        activeFilePath: payload.activeFilePath || null,
        intent: payload.codingIntent || (payload.role === 'coder' ? 'MUTATION' : 'READ_ONLY'),
        handoffState: handoff,
        providerId: payload.providerId,
        modelId: payload.modelId,
        approvalMode: payload.approvalMode || 'strict',
        modelHandler: customModelHandler,
        contextOptions: payload.contextOptions,
      });

      currentTurnId = turnOutcome.turnId || turnOutcome.turn?.turnId || null;

      // 5. Aggregate Child Items & Results
      const childTurn = turnOutcome.turn || (currentTurnId ? isolatedRuntime.turnManager.getTurn(currentTurnId) : null);
      const childItems = childTurn ? isolatedRuntime.itemStore.getItemsByTurn(childTurn.turnId) : [];

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

      const structuredResult = {
        childThreadId: threadId,
        turnId: currentTurnId,
        role: payload.role || 'researcher',
        status: turnOutcome.status || (turnOutcome.success ? TURN_STATUS.COMPLETED : TURN_STATUS.FAILED),
        success: Boolean(turnOutcome.success),
        summary,
        findings: Array.from(new Set(findings)),
        changedFiles: Array.from(new Set(changedFiles)),
        changeSets,
        verification: verificationOutcome || turnOutcome.turn?.metadata?.verification || null,
        handoffState: turnOutcome.handoffState || (handoff ? handoff.toJSON() : null),
        workspacePath,
        error: turnOutcome.error || null,
      };

      if (turnOutcome.success) {
        sendToParent({
          type: EVENT_TYPES.TURN_COMPLETED,
          requestId,
          threadId,
          turnId: currentTurnId,
          payload: { result: structuredResult, isFinalResult: true },
        });
      } else if (turnOutcome.status === TURN_STATUS.CANCELLED) {
        sendToParent({
          type: EVENT_TYPES.TURN_CANCELLED,
          requestId,
          threadId,
          turnId: currentTurnId,
          payload: { result: structuredResult, error: turnOutcome.error, isFinalResult: true },
        });
      } else {
        sendToParent({
          type: EVENT_TYPES.TURN_FAILED,
          requestId,
          threadId,
          turnId: currentTurnId,
          payload: { result: structuredResult, error: turnOutcome.error || 'Turn failed', isFinalResult: true },
        });
      }
    } catch (err) {
      sendToParent({
        type: EVENT_TYPES.TURN_FAILED,
        requestId,
        threadId,
        turnId: currentTurnId,
        payload: { error: err.message, stack: err.stack, isFinalResult: true },
      });
    }

  }
}

// Attach listener
if (isWorkerThread) {
  parentPort.on('message', (msg) => {
    handleParentMessage(msg).catch((err) => {
      sendToParent({ type: EVENT_TYPES.WORKER_ERROR, payload: { error: err.message } });
    });
  });
} else if (isChildProcess) {
  process.on('message', (msg) => {
    handleParentMessage(msg).catch((err) => {
      sendToParent({ type: EVENT_TYPES.WORKER_ERROR, payload: { error: err.message } });
    });
  });
}

process.on('uncaughtException', (err) => {
  sendToParent({
    type: EVENT_TYPES.WORKER_ERROR,
    requestId: currentRequestId,
    threadId: currentThreadId,
    turnId: currentTurnId,
    payload: { error: err.message, stack: err.stack, fatal: true },
  });
  if (isChildProcess) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  sendToParent({
    type: EVENT_TYPES.WORKER_ERROR,
    requestId: currentRequestId,
    threadId: currentThreadId,
    turnId: currentTurnId,
    payload: { error: String(reason), fatal: false },
  });
});
