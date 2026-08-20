/**
 * NEXUS CODEX HARNESS - THREAD MANAGER
 * Manages durable Thread agent sessions, lifecycle states, and thread turn sequencing.
 */

const {
  THREAD_STATUS,
  EVENT_TYPES,
  generateThreadId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const { turnManager: defaultTurnManager } = require('./TurnManager');
const secretFilter = require('../../security/secretFilter');

class ThreadManager {
  constructor(eventBus = harnessEventBus, turnManager = defaultTurnManager) {
    this.threads = new Map(); // threadId -> Thread
    this.eventBus = eventBus;
    this.turnManager = turnManager;
  }

  /**
   * Creates a new persistent Thread session.
   * @param {Object} [options]
   * @param {string} [options.threadId] - Explicit thread ID (e.g. from session ID)
   * @param {string} [options.parentThreadId] - Optional lineage parent thread ID
   * @param {string} [options.parentTurnId] - Optional lineage parent turn ID
   * @param {string} [options.rootThreadId] - Root ancestor thread ID
   * @param {number} [options.depth] - Subagent hierarchy depth (0 = root)
   * @param {string} [options.role] - Subagent assigned role
   * @param {string} [options.createdBy] - Originator ('user' | 'subagent_manager')
   * @param {Object} [options.metadata] - Arbitrary thread metadata (e.g. workspacePath, title)
   * @returns {Object} Created Thread
   */
  createThread(options = {}) {
    const now = Date.now();
    const threadId = options.threadId || generateThreadId();
    const parentThreadId = options.parentThreadId || null;
    const parentTurnId = options.parentTurnId || null;

    // Resolve lineage: rootThreadId & depth
    let rootThreadId = options.rootThreadId || null;
    let depth = typeof options.depth === 'number' ? options.depth : 0;

    if (parentThreadId) {
      const parentThread = this.threads.get(parentThreadId);
      if (parentThread) {
        if (!rootThreadId) {
          rootThreadId = parentThread.rootThreadId || parentThread.threadId;
        }
        if (typeof options.depth !== 'number') {
          depth = (parentThread.depth !== undefined ? parentThread.depth : 0) + 1;
        }
      } else if (!rootThreadId) {
        rootThreadId = parentThreadId;
      }
    } else {
      rootThreadId = threadId;
      depth = 0;
    }

    const role = options.role || options.metadata?.role || null;
    const createdBy = options.createdBy || (parentThreadId ? 'subagent_manager' : 'user');
    const sanitizedMetadata = secretFilter.sanitizeObject(options.metadata || {});

    const thread = {
      threadId,
      parentThreadId,
      parentTurnId,
      rootThreadId,
      depth,
      role,
      createdBy,
      createdAt: typeof options.createdAt === 'number' ? options.createdAt : now,
      updatedAt: typeof options.updatedAt === 'number' ? options.updatedAt : now,
      status: options.status || THREAD_STATUS.ACTIVE,
      turnIds: Array.isArray(options.turnIds) ? [...options.turnIds] : [],
      metadata: sanitizedMetadata,
    };

    this.threads.set(threadId, thread);

    this.eventBus.emit(EVENT_TYPES.THREAD_CREATED, {
      threadId,
      payload: { thread: { ...thread } },
    });

    return thread;
  }

  /**
   * Retrieves all direct child threads of a parent thread.
   * @param {string} parentThreadId
   * @returns {Array<Object>}
   */
  listChildThreads(parentThreadId) {
    if (!parentThreadId) return [];
    return Array.from(this.threads.values())
      .filter((t) => t.parentThreadId === parentThreadId)
      .map((t) => this.getThread(t.threadId))
      .filter(Boolean);
  }

  /**
   * Retrieves the root ancestor Thread for a given threadId.
   * @param {string} threadId
   * @returns {Object|null}
   */
  getRootThread(threadId) {
    const thread = this.getThread(threadId);
    if (!thread) return null;
    if (!thread.parentThreadId || thread.depth === 0) return thread;
    return this.getThread(thread.rootThreadId) || thread;
  }


  /**
   * Retrieves a Thread by ID with its live associated Turns and Turn IDs.
   * @param {string} threadId
   * @returns {Object|null}
   */
  getThread(threadId) {
    const thread = this.threads.get(threadId);
    if (!thread) return null;

    const turns = this.turnManager.listTurnsByThread(threadId);
    const turnIds = turns.map((t) => t.turnId);

    return {
      ...thread,
      turnIds: turnIds.length > 0 ? turnIds : thread.turnIds,
      turns,
    };
  }

  /**
   * Updates an existing Thread's metadata and/or status.
   * @param {string} threadId
   * @param {Object} [updates]
   * @returns {Object} Updated Thread
   */
  updateThread(threadId, updates = {}) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`[HARNESS-THREADMANAGER] Thread "${threadId}" not found`);
    }

    const sanitizedUpdates = secretFilter.sanitizeObject(updates || {});
    thread.updatedAt = Date.now();

    if (sanitizedUpdates.status && Object.values(THREAD_STATUS).includes(sanitizedUpdates.status)) {
      thread.status = sanitizedUpdates.status;
    }

    if (sanitizedUpdates.metadata) {
      thread.metadata = {
        ...thread.metadata,
        ...sanitizedUpdates.metadata,
      };
    }

    this.eventBus.emit(EVENT_TYPES.THREAD_UPDATED, {
      threadId,
      payload: { thread: { ...thread } },
    });

    return this.getThread(threadId);
  }

  /**
   * Updates the `updatedAt` timestamp of a Thread (e.g. when child turn changes).
   * @param {string} threadId
   */
  touchThread(threadId) {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.updatedAt = Date.now();
    }
  }

  /**
   * Archives a Thread.
   * @param {string} threadId
   * @returns {Object} Archived Thread
   */
  archiveThread(threadId) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`[HARNESS-THREADMANAGER] Thread "${threadId}" not found`);
    }

    thread.status = THREAD_STATUS.ARCHIVED;
    thread.updatedAt = Date.now();

    this.eventBus.emit(EVENT_TYPES.THREAD_ARCHIVED, {
      threadId,
      payload: { thread: { ...thread } },
    });

    return this.getThread(threadId);
  }

  /**
   * Lists all Threads matching an optional filter, ordered newest first.
   * @param {Object} [filter]
   * @param {string} [filter.workspacePath]
   * @param {string} [filter.status]
   * @returns {Array<Object>}
   */
  listThreads(filter = {}) {
    let list = Array.from(this.threads.values()).map((t) => this.getThread(t.threadId)).filter(Boolean);

    if (filter.workspacePath) {
      list = list.filter((t) => t.metadata?.workspacePath === filter.workspacePath);
    }

    if (filter.status) {
      list = list.filter((t) => t.status === filter.status);
    }

    // Sort newest first
    list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    return list;
  }

  /**
   * Restores a thread directly (used during persistence deserialization).
   * @param {Object} threadData
   */
  restoreThread(threadData) {
    if (!threadData || !threadData.threadId) return;
    this.threads.set(threadData.threadId, { ...threadData });
  }

  /**
   * Clears internal state (primarily for test resets).
   */
  clear() {
    this.threads.clear();
  }
}

const threadManager = new ThreadManager();

module.exports = {
  ThreadManager,
  threadManager,
};
