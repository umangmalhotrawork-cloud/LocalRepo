/**
 * NEXUS CODEX HARNESS - TURN MANAGER
 * Manages Turn lifecycles, item collections, and transitions within a parent Thread.
 */

const {
  TURN_STATUS,
  EVENT_TYPES,
  generateTurnId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const { itemStore: defaultItemStore } = require('./ItemStore');
const secretFilter = require('../../security/secretFilter');

class TurnManager {
  constructor(eventBus = harnessEventBus, itemStore = defaultItemStore, runtime = null) {
    this.turns = new Map(); // turnId -> Turn
    this.threadTurns = new Map(); // threadId -> Set(turnId)
    this.eventBus = eventBus;
    this.itemStore = itemStore;
    this.runtime = runtime;
  }

  /**
   * Starts a new Turn for a given Thread.
   * @param {string} threadId - Parent Thread ID
   * @param {string} userInput - User directive / prompt
   * @param {Object} [metadata] - Additional turn metadata
   * @param {Object} [options] - Additional options (e.g. custom turnId)
   * @returns {Object} Created & started Turn
   */
  startTurn(threadId, userInput = '', metadata = {}, options = {}) {
    if (!threadId || typeof threadId !== 'string') {
      throw new Error('[HARNESS-TURNMANAGER] Cannot start Turn without a valid threadId');
    }

    const now = Date.now();
    const turnId = options.turnId || generateTurnId();
    const sanitizedUserInput = secretFilter.sanitizeString(typeof userInput === 'string' ? userInput : String(userInput || ''));
    const sanitizedMetadata = secretFilter.sanitizeObject(metadata || {});

    const turn = {
      turnId,
      threadId,
      createdAt: now,
      startedAt: now,
      completedAt: null,
      status: TURN_STATUS.RUNNING,
      userInput: sanitizedUserInput,
      itemIds: [],
      metadata: sanitizedMetadata,
      error: null,
    };

    this.turns.set(turnId, turn);

    if (!this.threadTurns.has(threadId)) {
      this.threadTurns.set(threadId, new Set());
    }
    this.threadTurns.get(threadId).add(turnId);

    this.eventBus.emit(EVENT_TYPES.TURN_STARTED, {
      threadId,
      turnId,
      payload: { turn: { ...turn } },
    });

    return turn;
  }

  /**
   * Retrieves a Turn by ID with its live associated Item IDs.
   * @param {string} turnId
   * @returns {Object|null}
   */
  getTurn(turnId) {
    const turn = this.turns.get(turnId);
    if (!turn) return null;

    // Synchronize latest itemIds from itemStore
    const items = this.itemStore.getItemsByTurn(turnId);
    const itemIds = items.map((i) => i.itemId);

    return {
      ...turn,
      itemIds,
      items,
    };
  }

  /**
   * Updates an existing Turn's metadata.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Updated Turn
   */
  updateTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot update Turn "${turnId}" in terminal state "${turn.status}"`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_UPDATED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn } },
    });

    return this.getTurn(turnId);
  }

  /**
   * Completes a Turn.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Completed Turn
   */
  completeTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot complete Turn "${turnId}" already in state "${turn.status}"`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.COMPLETED;
    turn.completedAt = Date.now();
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_COMPLETED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn } },
    });

    return this.getTurn(turnId);
  }

  /**
   * Fails a Turn with an error.
   * @param {string} turnId
   * @param {string|Error|Object} error
   * @param {Object} [metadataUpdates]
   * @returns {Object} Failed Turn
   */
  failTurn(turnId, error, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot fail Turn "${turnId}" already in state "${turn.status}"`);
    }

    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    const sanitizedError = secretFilter.sanitizeString(errorMessage || 'Turn failed with unspecified error');
    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});

    turn.status = TURN_STATUS.FAILED;
    turn.completedAt = Date.now();
    turn.error = sanitizedError;
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_FAILED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn }, error: sanitizedError },
    });

    return this.getTurn(turnId);
  }

  /**
   * Sets a Turn's status to WAITING_FOR_APPROVAL.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Updated Turn
   */
  setWaitingForApproval(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot set Turn "${turnId}" to WAITING_FOR_APPROVAL in terminal state "${turn.status}"`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.WAITING_FOR_APPROVAL;
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_UPDATED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn }, status: TURN_STATUS.WAITING_FOR_APPROVAL },
    });

    return this.getTurn(turnId);
  }

  /**
   * Pauses an active Turn.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Updated Turn
   */
  pauseTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot pause Turn "${turnId}" in terminal state "${turn.status}"`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.PAUSED;
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_UPDATED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn }, status: TURN_STATUS.PAUSED },
    });

    return this.getTurn(turnId);
  }

  /**
   * Reactivates or retries a failed, paused, or waiting Turn back to RUNNING.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Updated Turn
   */
  retryTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.RUNNING;
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
      isRetrying: true,
    };
    turn.updatedAt = Date.now();

    this.eventBus.emit(EVENT_TYPES.TURN_UPDATED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn }, status: TURN_STATUS.RUNNING },
    });

    return this.getTurn(turnId);
  }

  /**
   * Resumes a paused or waiting Turn back to RUNNING.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Updated Turn
   */
  resumeTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      throw new Error(`[HARNESS-TURNMANAGER] Cannot resume Turn "${turnId}" in terminal state "${turn.status}"`);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.RUNNING;
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.TURN_UPDATED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn }, status: TURN_STATUS.RUNNING },
    });

    return this.getTurn(turnId);
  }

  /**
   * Cancels a Turn and all running items within it.
   * @param {string} turnId
   * @param {Object} [metadataUpdates]
   * @returns {Object} Cancelled Turn
   */
  cancelTurn(turnId, metadataUpdates = {}) {
    const turn = this.turns.get(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-TURNMANAGER] Turn "${turnId}" not found`);
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      return this.getTurn(turnId);
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});
    turn.status = TURN_STATUS.CANCELLED;
    turn.completedAt = Date.now();
    turn.metadata = {
      ...turn.metadata,
      ...sanitizedMetadataUpdates,
    };

    // Cancel any active items in this turn
    const items = this.itemStore.getItemsByTurn(turnId);
    for (const item of items) {
      if (item.status === 'STARTED' || item.status === 'IN_PROGRESS') {
        try {
          this.itemStore.cancelItem(item.itemId, {}, { threadId: turn.threadId });
        } catch (e) {}
      }
    }

    // Cancel any in-flight MCP tool executions for this turn
    if (this.runtime?.mcpServerManager && typeof this.runtime.mcpServerManager.cancelTurnTools === 'function') {
      try {
        this.runtime.mcpServerManager.cancelTurnTools(turnId, 'Parent turn cancelled');
      } catch (e) {}
    }

    this.eventBus.emit(EVENT_TYPES.TURN_CANCELLED, {
      threadId: turn.threadId,
      turnId,
      payload: { turn: { ...turn } },
    });

    return this.getTurn(turnId);
  }

  /**
   * Lists all Turns belonging to a Thread in chronological order.
   * @param {string} threadId
   * @returns {Array<Object>}
   */
  listTurnsByThread(threadId) {
    const turnIds = this.threadTurns.get(threadId);
    if (!turnIds) return [];
    return Array.from(turnIds).map((id) => this.getTurn(id)).filter(Boolean);
  }

  /**
   * Restores a turn directly during deserialization.
   * @param {Object} turnData
   */
  restoreTurn(turnData) {
    if (!turnData || !turnData.turnId || !turnData.threadId) return;
    this.turns.set(turnData.turnId, { ...turnData });
    if (!this.threadTurns.has(turnData.threadId)) {
      this.threadTurns.set(turnData.threadId, new Set());
    }
    this.threadTurns.get(turnData.threadId).add(turnData.turnId);
  }

  /**
   * Clears internal state (primarily for test resets).
   */
  clear() {
    this.turns.clear();
    this.threadTurns.clear();
  }
}

const turnManager = new TurnManager();

module.exports = {
  TurnManager,
  turnManager,
};
