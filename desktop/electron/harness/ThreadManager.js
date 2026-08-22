const path = require('path');
const {
  THREAD_STATUS,
  EVENT_TYPES,
  generateThreadId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const { turnManager: defaultTurnManager } = require('./TurnManager');
const secretFilter = require('../../security/secretFilter');

/**
 * Generates a clean, short, human-readable thread title from the initial user prompt.
 * @param {string} userInput
 * @returns {string} Short formatted title
 */
function generateSmartThreadTitle(userInput = '') {
  if (!userInput || typeof userInput !== 'string') return 'New Task';

  // 1. Take first non-empty line and strip markdown/code formatting
  const lines = userInput.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'New Task';
  let text = lines[0].replace(/^[`"'\s*#-]+|[`"'\s]+$/g, '').trim();
  if (!text) return 'New Task';

  // 2. Remove common leading conversational / command filler phrases
  const leadingFillers = [
    /^(?:please\s+)?(?:can\s+you\s+)?(?:help\s+me\s+)?(?:to\s+)?/i,
    /^(?:i\s+want\s+to\s+|i\s+need\s+to\s+|let'?s\s+|could\s+you\s+|would\s+you\s+)/i,
    /^(?:hey\s+|hello\s+|hi\s+)?(?:nexus,?\s*)?/i,
  ];
  for (const filler of leadingFillers) {
    text = text.replace(filler, '');
  }
  text = text.trim();

  // 3. Pattern: File mentions with action verbs
  // Match any file path with standard code extension
  const fileMatch = text.match(/(?:[a-zA-Z0-9_./-]+\/)?([a-zA-Z0-9_-]+\.(?:py|ts|tsx|js|jsx|json|go|rs|cpp|c|h|java|html|css|sql|md|ya?ml))/i);
  const targetFileName = fileMatch ? fileMatch[1] : null;

  if (targetFileName) {
    // Inspect / Fix / Refactor / Debug / Error / Failure pattern first
    if (/\b(?:inspect|fix|repair|refactor|modify|update|clean|debug|patch|optimize|check|redundant|why|throw|throws|fail|fails|failed|failing|error|errors|broken|crash|crashing|bug|bugs|issue|issues)\b/i.test(text)) {
      return `Fix ${targetFileName}`;
    }
    // Tests pattern: "Add unit tests for cart_calculator.py" -> "Tests for cart_calculator.py"
    if (/\b(?:test|tests|testing|spec|specs|assert|assertion|assertions)\b/i.test(text)) {
      return `Tests for ${targetFileName}`;
    }
    // Review pattern
    if (/\b(?:review|analyze|audit)\b/i.test(text)) {
      return `Review ${targetFileName}`;
    }
    // Fallback file mention
    return `Inspect ${targetFileName}`;
  }

  // 4. Pattern: "Investigate why auth fails" -> "Investigate authentication"
  const authMatch = text.match(/investigate\s+(?:why\s+)?auth(?:entication)?(?:\s+fails?)?/i);
  if (authMatch) {
    return 'Investigate authentication';
  }

  // 5. Pattern: "Explain the NEXUS architecture" -> "NEXUS architecture"
  const explainMatch = text.match(/(?:explain|what\s+is|tell\s+me\s+about)\s+(?:the\s+)?(.+)/i);
  if (explainMatch) {
    let topic = explainMatch[1].trim().replace(/[.?:]+$/, '');
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);
    if (topic.length > 35) topic = topic.slice(0, 32) + '...';
    return topic;
  }

  // 6. Pattern: Action phrases: "Implement dark mode", "Add payment integration"
  const actionMatch = text.match(/^(add|create|implement|build|setup|configure|refactor|remove|delete)\s+(.+)/i);
  if (actionMatch) {
    const verb = actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1).toLowerCase();
    let subject = actionMatch[2].trim().replace(/[.?:]+$/, '');
    // If long with prepositions ("in the settings drawer", "for user profile"), take primary subject
    const prepParts = subject.split(/\s+(?:in|for|on|at|inside|to|using|with)\s+/i);
    if (prepParts.length > 1 && prepParts[0].length >= 4) {
      subject = prepParts[0].trim();
    }
    if (subject.length > 25) {
      subject = subject.slice(0, 22) + '...';
    }
    return `${verb} ${subject}`;
  }

  // 7. General fallback: Truncate to first clause or 35 chars
  const clauseMatch = text.match(/^([^.?!,;:\n]+)/);
  let shortText = clauseMatch ? clauseMatch[1].trim() : text;
  shortText = shortText.charAt(0).toUpperCase() + shortText.slice(1);
  if (shortText.length > 35) {
    shortText = shortText.slice(0, 32) + '...';
  }
  return shortText || 'New Task';
}

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
   * @param {string} [options.title] - Explicit thread title
   * @param {string} [options.userInput] - Initial user prompt for smart title generation
   * @param {boolean} [options.pinned] - Whether thread is pinned
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

    // Title resolution: explicit title > options.metadata.title > generateSmartThreadTitle(options.userInput) > 'New Task'
    let title = options.title || options.metadata?.title;
    if (!title && options.userInput) {
      title = generateSmartThreadTitle(options.userInput);
    }
    if (!title) {
      title = 'New Task';
    }

    const pinned = Boolean(options.pinned !== undefined ? options.pinned : options.metadata?.pinned);
    const workspacePath = options.workspacePath || options.metadata?.workspacePath || process.cwd();
    const workspaceName = options.workspaceName || options.metadata?.workspaceName || path.basename(workspacePath) || 'NEXUS';

    const mergedMetadata = {
      workspacePath,
      workspaceName,
      title,
      pinned,
      providerId: options.providerId || options.metadata?.providerId || 'nexus1',
      modelId: options.modelId || options.metadata?.modelId || 'gemini-2.5-flash',
      ...(options.metadata || {}),
    };
    mergedMetadata.title = title;
    mergedMetadata.pinned = pinned;

    const sanitizedMetadata = secretFilter.sanitizeObject(mergedMetadata);

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
      title: thread.metadata?.title || 'New Task',
      pinned: Boolean(thread.metadata?.pinned),
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
   * Pins or unpins a Thread.
   * @param {string} threadId
   * @param {boolean} [pinned=true]
   * @returns {Object} Updated Thread
   */
  pinThread(threadId, pinned = true) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`[HARNESS-THREADMANAGER] Thread "${threadId}" not found`);
    }

    thread.metadata = thread.metadata || {};
    thread.metadata.pinned = Boolean(pinned);
    thread.updatedAt = Date.now();

    this.eventBus.emit(EVENT_TYPES.THREAD_UPDATED, {
      threadId,
      payload: { thread: { ...thread } },
    });

    return this.getThread(threadId);
  }

  /**
   * Renames a Thread.
   * @param {string} threadId
   * @param {string} newTitle
   * @returns {Object} Updated Thread
   */
  renameThread(threadId, newTitle = '') {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`[HARNESS-THREADMANAGER] Thread "${threadId}" not found`);
    }

    const title = newTitle && newTitle.trim() ? newTitle.trim() : 'Untitled Task';
    thread.metadata = thread.metadata || {};
    thread.metadata.title = title;
    thread.updatedAt = Date.now();

    this.eventBus.emit(EVENT_TYPES.THREAD_UPDATED, {
      threadId,
      payload: { thread: { ...thread } },
    });

    return this.getThread(threadId);
  }

  /**
   * Deletes a Thread completely from memory.
   * @param {string} threadId
   * @returns {boolean}
   */
  deleteThread(threadId) {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    this.threads.delete(threadId);

    this.eventBus.emit(EVENT_TYPES.THREAD_ARCHIVED, {
      threadId,
      payload: { thread: { ...thread, status: 'DELETED' } },
    });

    return true;
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
  generateSmartThreadTitle,
};
