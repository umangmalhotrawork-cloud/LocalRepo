/**
 * NEXUS CODEX HARNESS - WORKER RUNTIME (Milestone 9B)
 * Provides process-isolated and thread-isolated execution boundaries for subagents.
 * Strictly encapsulates child process/worker thread management, message protocol dispatching,
 * parent event bus translation, approval bridging, and crash isolation.
 */

const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { Worker } = (function() {
  try {
    return require('worker_threads');
  } catch (e) {
    return { Worker: null };
  }
})();

const {
  WORKER_STATUS,
  WORKER_TYPE,
  WORKER_MESSAGE_TYPES,
  DEFAULT_WORKER_LIMITS,
  EVENT_TYPES,
  TURN_STATUS,
  generateWorkerId,
  generateId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const secretFilter = require('../../security/secretFilter');

const WORKER_ENTRY_PATH = path.resolve(__dirname, 'worker-entry.js');

class WorkerRuntime {
  /**
   * @param {Object} [options]
   * @param {Object} [options.eventBus] - Authoritative parent HarnessEventBus
   * @param {Object} [options.limits] - Custom worker resource bounds
   * @param {string} [options.defaultWorkerType] - 'process' | 'thread'
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.limits = {
      ...DEFAULT_WORKER_LIMITS,
      ...(options.limits || {}),
    };
    this.defaultWorkerType = options.defaultWorkerType || WORKER_TYPE.PROCESS;

    this.activeWorkers = new Map(); // workerId -> WorkerRecord
    this.threadToWorker = new Map(); // threadId -> workerId
    this.pendingTurnResolvers = new Map(); // requestId -> { resolve, reject, timeoutTimer }
  }

  /**
   * Starts a new isolated worker for a child thread.
   * @param {Object} options
   * @param {string} options.childThreadId - Subagent Thread ID
   * @param {string} options.workspacePath - Isolated workspace directory
   * @param {string} [options.workerType] - 'process' | 'thread'
   * @param {Object} [options.limits] - Custom limits
   * @returns {Object} Created WorkerRecord
   */
  startWorker(options = {}) {
    const {
      childThreadId,
      workspacePath,
      workerType = this.defaultWorkerType,
    } = options;

    if (!childThreadId) {
      throw new Error('[WORKER-RUNTIME] childThreadId is required to start a worker');
    }

    if (!workspacePath || !fs.existsSync(workspacePath)) {
      throw new Error(`[WORKER-RUNTIME] Invalid or non-existent isolated workspacePath: "${workspacePath}"`);
    }

    // Enforce Max Concurrent Workers Limit
    const activeRunningCount = Array.from(this.activeWorkers.values()).filter(
      (w) => [WORKER_STATUS.RUNNING, WORKER_STATUS.STARTING, WORKER_STATUS.WAITING_FOR_APPROVAL].includes(w.status)
    ).length;

    const limits = { ...this.limits, ...(options.limits || {}) };
    if (activeRunningCount >= limits.maxConcurrentWorkers) {
      throw new Error(`[WORKER-RUNTIME] Maximum concurrent workers limit (${limits.maxConcurrentWorkers}) reached`);
    }

    const workerId = generateWorkerId();
    const effectiveType = (workerType === WORKER_TYPE.THREAD && Worker) ? WORKER_TYPE.THREAD : WORKER_TYPE.PROCESS;

    let handle = null;
    let pid = null;

    if (effectiveType === WORKER_TYPE.PROCESS) {
      // Fork isolated Node process running worker-entry.js
      handle = fork(WORKER_ENTRY_PATH, [], {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_SYSTEM: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          NEXUS_ISOLATED_WORKER: '1',
        },
      });
      pid = handle.pid;
    } else {
      // Thread Worker
      handle = new Worker(WORKER_ENTRY_PATH, {
        workerData: { workerId, childThreadId, workspacePath },
      });
      pid = process.pid;
    }

    const workerRecord = {
      workerId,
      childThreadId,
      workspacePath,
      workerType: effectiveType,
      status: WORKER_STATUS.IDLE,
      handle,
      pid,
      startedAt: Date.now(),
      completedAt: null,
      exitCode: null,
      limits,
      activeTurnId: null,
    };

    this.activeWorkers.set(workerId, workerRecord);
    this.threadToWorker.set(childThreadId, workerId);

    // Attach Process / Thread Listeners
    this._attachWorkerListeners(workerRecord);

    return workerRecord;
  }

  /**
   * Dispatches and executes a child turn inside the isolated worker.
   * @param {string} workerIdOrThreadId
   * @param {Object} delegationPackage
   * @param {Object} [options]
   * @returns {Promise<Object>} Structured subagent result
   */
  async executeTurn(workerIdOrThreadId, delegationPackage = {}, options = {}) {
    const worker = this._resolveWorker(workerIdOrThreadId);
    if (!worker) {
      throw new Error(`[WORKER-RUNTIME] Worker not found for ID "${workerIdOrThreadId}"`);
    }

    if ([WORKER_STATUS.TERMINATED, WORKER_STATUS.FAILED].includes(worker.status)) {
      throw new Error(`[WORKER-RUNTIME] Cannot execute turn on worker in status "${worker.status}"`);
    }

    const requestId = generateId('req');
    const childThreadId = worker.childThreadId;
    const turnId = options.turnId || delegationPackage.turnId || generateId('turn');

    worker.status = WORKER_STATUS.RUNNING;
    worker.activeTurnId = turnId;

    return new Promise((resolve, reject) => {
      // Lifetime safety timer
      const maxLifetime = worker.limits.maxWorkerLifetimeMs || DEFAULT_WORKER_LIMITS.maxWorkerLifetimeMs;
      const timeoutTimer = setTimeout(() => {
        if (this.pendingTurnResolvers.has(requestId)) {
          this.pendingTurnResolvers.delete(requestId);
          this.cancelWorker(worker.workerId, 'Worker lifetime execution timeout exceeded');
          resolve({
            success: false,
            status: TURN_STATUS.FAILED,
            error: `Worker execution exceeded timeout of ${maxLifetime}ms`,
            childThreadId,
            summary: `Worker execution exceeded timeout of ${maxLifetime}ms`,
            findings: [],
            changedFiles: [],
            changeSets: [],
          });
        }
      }, maxLifetime);

      this.pendingTurnResolvers.set(requestId, {
        resolve,
        reject,
        timeoutTimer,
        workerId: worker.workerId,
        childThreadId,
        turnId,
      });

      // Send START_TURN to worker
      this.sendMessage(worker.workerId, {
        type: WORKER_MESSAGE_TYPES.START_TURN,
        requestId,
        threadId: childThreadId,
        turnId,
        workspacePath: worker.workspacePath,
        payload: {
          ...delegationPackage,
          ...options,
        },
      });
    });
  }

  /**
   * Sends a structured message to a worker.
   * @param {string} workerIdOrThreadId
   * @param {Object} message
   */
  sendMessage(workerIdOrThreadId, message) {
    const worker = this._resolveWorker(workerIdOrThreadId);
    if (!worker || !worker.handle) {
      throw new Error(`[WORKER-RUNTIME] Worker "${workerIdOrThreadId}" not found or handle missing`);
    }

    const sanitized = {
      ...message,
      payload: secretFilter.sanitizeObject(message.payload || {}),
    };

    if (worker.workerType === WORKER_TYPE.THREAD) {
      worker.handle.postMessage(sanitized);
    } else if (worker.workerType === WORKER_TYPE.PROCESS && typeof worker.handle.send === 'function') {
      try {
        worker.handle.send(sanitized);
      } catch (err) {
        console.error('[WORKER-RUNTIME] Failed to send message to worker:', err);
      }
    }
  }

  /**
   * Requests graceful turn cancellation, with automated fallback to hard termination.
   * @param {string} workerIdOrThreadId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelWorker(workerIdOrThreadId, reason = 'Subagent execution cancelled') {
    const worker = this._resolveWorker(workerIdOrThreadId);
    if (!worker) return { success: false, error: 'Worker not found' };

    worker.status = WORKER_STATUS.CANCELLED;

    // 1. Send graceful CANCEL_TURN message
    this.sendMessage(worker.workerId, {
      type: WORKER_MESSAGE_TYPES.CANCEL_TURN,
      threadId: worker.childThreadId,
      turnId: worker.activeTurnId,
      payload: { reason },
    });

    // 2. Set timeout for hard termination fallback
    const cancelTimeout = worker.limits.workerCancellationTimeoutMs || DEFAULT_WORKER_LIMITS.workerCancellationTimeoutMs;
    setTimeout(() => {
      if (this.activeWorkers.has(worker.workerId) && worker.status !== WORKER_STATUS.TERMINATED) {
        this.terminateWorker(worker.workerId, true);
      }
    }, cancelTimeout);

    return {
      success: true,
      workerId: worker.workerId,
      status: WORKER_STATUS.CANCELLED,
    };
  }

  /**
   * Force terminates a worker process or thread.
   * @param {string} workerIdOrThreadId
   * @param {boolean} [force=true]
   * @returns {Object}
   */
  terminateWorker(workerIdOrThreadId, force = true) {
    const worker = this._resolveWorker(workerIdOrThreadId);
    if (!worker) return { success: false, error: 'Worker not found' };

    try {
      if (worker.workerType === WORKER_TYPE.THREAD && worker.handle) {
        worker.handle.terminate();
      } else if (worker.workerType === WORKER_TYPE.PROCESS && worker.handle) {
        if (worker.handle.connected) {
          try { worker.handle.disconnect(); } catch (e) {}
        }
        try { worker.handle.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch (e) {}
        try { worker.handle.unref(); } catch (e) {}
      }
    } catch (e) {}


    worker.status = WORKER_STATUS.TERMINATED;
    worker.completedAt = Date.now();

    this.eventBus.emit(EVENT_TYPES.WORKER_EXITED, {
      threadId: worker.childThreadId,
      payload: { workerId: worker.workerId, status: WORKER_STATUS.TERMINATED },
    });

    return {
      success: true,
      workerId: worker.workerId,
      status: WORKER_STATUS.TERMINATED,
    };
  }

  /**
   * Retrieves live worker status and metrics.
   * @param {string} workerIdOrThreadId
   * @returns {Object|null}
   */
  getStatus(workerIdOrThreadId) {
    const worker = this._resolveWorker(workerIdOrThreadId);
    if (!worker) return null;

    return {
      workerId: worker.workerId,
      childThreadId: worker.childThreadId,
      workspacePath: worker.workspacePath,
      workerType: worker.workerType,
      status: worker.status,
      pid: worker.pid,
      startedAt: worker.startedAt,
      completedAt: worker.completedAt,
      exitCode: worker.exitCode,
    };
  }

  /**
   * Internal: Resolves worker by workerId or childThreadId.
   * @private
   */
  _resolveWorker(id) {
    if (!id) return null;
    if (this.activeWorkers.has(id)) {
      return this.activeWorkers.get(id);
    }
    if (this.threadToWorker.has(id)) {
      const wId = this.threadToWorker.get(id);
      return this.activeWorkers.get(wId) || null;
    }
    return null;
  }

  /**
   * Internal: Attaches message, error, and exit listeners to worker handle.
   * @private
   */
  _attachWorkerListeners(worker) {
    const onMessage = (msg) => {
      if (!msg || typeof msg !== 'object') return;

      const { type, requestId, threadId, turnId, payload = {} } = msg;

      // 1. If message is an approval request, bridge it to parent EventBus
      if (type === EVENT_TYPES.ITEM_STARTED && payload?.type === 'APPROVAL_REQUEST') {
        worker.status = WORKER_STATUS.WAITING_FOR_APPROVAL;
      }

      // 2. Translate worker message to authoritative parent EventBus
      if (type && (Object.values(EVENT_TYPES).includes(type) || Object.values(WORKER_MESSAGE_TYPES).includes(type))) {
        this.eventBus.emit(type, {
          threadId: threadId || worker.childThreadId,
          turnId: turnId || worker.activeTurnId,
          payload,
        });
      }

      // 3. If final turn outcome received, resolve pending execution promise
      if (requestId && this.pendingTurnResolvers.has(requestId)) {
        if (payload?.isFinalResult || payload?.result) {
          const resolver = this.pendingTurnResolvers.get(requestId);
          this.pendingTurnResolvers.delete(requestId);
          if (resolver.timeoutTimer) clearTimeout(resolver.timeoutTimer);

          worker.status = type === EVENT_TYPES.TURN_COMPLETED
            ? WORKER_STATUS.COMPLETED
            : (type === EVENT_TYPES.TURN_CANCELLED ? WORKER_STATUS.CANCELLED : WORKER_STATUS.FAILED);
          worker.completedAt = Date.now();

          const res = payload.result || {
            childThreadId: worker.childThreadId,
            success: type === EVENT_TYPES.TURN_COMPLETED,
            status: type === EVENT_TYPES.TURN_COMPLETED ? TURN_STATUS.COMPLETED : (type === EVENT_TYPES.TURN_CANCELLED ? TURN_STATUS.CANCELLED : TURN_STATUS.FAILED),
            summary: payload.error || (type === EVENT_TYPES.TURN_COMPLETED ? 'Completed' : 'Failed'),
            findings: [],
            changedFiles: [],
            changeSets: [],
            error: payload.error || null,
          };

          resolver.resolve(res);
        }
      }

    };

    const onError = (err) => {
      worker.status = WORKER_STATUS.FAILED;
      this.eventBus.emit(EVENT_TYPES.WORKER_ERROR, {
        threadId: worker.childThreadId,
        payload: { workerId: worker.workerId, error: err.message },
      });
    };

    const onExit = (code) => {
      worker.exitCode = code;
      if (worker.status !== WORKER_STATUS.TERMINATED && worker.status !== WORKER_STATUS.COMPLETED) {
        worker.status = code === 0 ? WORKER_STATUS.COMPLETED : WORKER_STATUS.FAILED;
      }
      worker.completedAt = Date.now();

      this.eventBus.emit(EVENT_TYPES.WORKER_EXITED, {
        threadId: worker.childThreadId,
        payload: { workerId: worker.workerId, exitCode: code },
      });

      // Fail any pending turn resolvers if worker died unexpectedly
      for (const [reqId, resolver] of this.pendingTurnResolvers.entries()) {
        if (resolver.workerId === worker.workerId) {
          this.pendingTurnResolvers.delete(reqId);
          if (resolver.timeoutTimer) clearTimeout(resolver.timeoutTimer);
          resolver.resolve({
            childThreadId: worker.childThreadId,
            success: false,
            status: TURN_STATUS.FAILED,
            error: `Worker process exited with code ${code}`,
            summary: `Worker process exited with code ${code}`,
            findings: [],
            changedFiles: [],
            changeSets: [],
          });
        }
      }
    };

    if (worker.workerType === WORKER_TYPE.THREAD) {
      worker.handle.on('message', onMessage);
      worker.handle.on('error', onError);
      worker.handle.on('exit', onExit);
    } else if (worker.workerType === WORKER_TYPE.PROCESS) {
      worker.handle.on('message', onMessage);
      worker.handle.on('error', onError);
      worker.handle.on('exit', onExit);
    }
  }

  /**
   * Cleans up all active workers.
   */
  dispose() {
    for (const [wId] of this.activeWorkers) {
      this.terminateWorker(wId, true);
    }
    this.activeWorkers.clear();
    this.threadToWorker.clear();
    for (const [, resolver] of this.pendingTurnResolvers) {
      if (resolver.timeoutTimer) clearTimeout(resolver.timeoutTimer);
    }
    this.pendingTurnResolvers.clear();
  }
}

const workerRuntime = new WorkerRuntime();

module.exports = {
  WorkerRuntime,
  workerRuntime,
  WORKER_ENTRY_PATH,
};
