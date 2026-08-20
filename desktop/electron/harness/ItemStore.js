/**
 * NEXUS CODEX HARNESS - ITEM STORE
 * Manages strongly typed lifecycle items (messages, plans, tool calls, tool results,
 * file changes, approvals, errors) with state transition invariants.
 */

const {
  ITEM_STATUS,
  ITEM_TYPES,
  EVENT_TYPES,
  generateItemId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const secretFilter = require('../../security/secretFilter');

class ItemStore {
  constructor(eventBus = harnessEventBus) {
    this.items = new Map(); // itemId -> Item
    this.turnItems = new Map(); // turnId -> Set(itemId)
    this.eventBus = eventBus;
  }

  /**
   * Starts a new typed Item associated with a specific Turn.
   * @param {string} turnId
   * @param {string} type - One of ITEM_TYPES
   * @param {Object} [payload] - Initial payload
   * @param {Object} [metadata] - Item metadata
   * @param {Object} [options] - Additional options (e.g. threadId for event bus routing)
   * @returns {Object} Created Item
   */
  startItem(turnId, type, payload = {}, metadata = {}, options = {}) {
    if (!turnId || typeof turnId !== 'string') {
      throw new Error('[HARNESS-ITEMSTORE] Cannot create Item without a valid turnId');
    }

    if (!type || !Object.values(ITEM_TYPES).includes(type)) {
      throw new Error(`[HARNESS-ITEMSTORE] Invalid or missing Item type: "${type}"`);
    }

    const now = Date.now();
    const itemId = options.itemId || generateItemId();
    const sanitizedPayload = secretFilter.sanitizeObject(payload || {});
    const sanitizedMetadata = secretFilter.sanitizeObject(metadata || {});

    const item = {
      itemId,
      turnId,
      type,
      status: ITEM_STATUS.STARTED,
      createdAt: now,
      startedAt: now,
      completedAt: null,
      payload: sanitizedPayload,
      metadata: sanitizedMetadata,
      error: null,
    };

    this.items.set(itemId, item);

    if (!this.turnItems.has(turnId)) {
      this.turnItems.set(turnId, new Set());
    }
    this.turnItems.get(turnId).add(itemId);

    this.eventBus.emit(EVENT_TYPES.ITEM_STARTED, {
      threadId: options.threadId || null,
      turnId,
      itemId,
      payload: { item: { ...item } },
    });

    return item;
  }

  /**
   * Updates an existing in-progress/started Item's payload and/or metadata.
   * @param {string} itemId
   * @param {Object} [payloadUpdates]
   * @param {Object} [metadataUpdates]
   * @param {Object} [options]
   * @returns {Object} Updated Item
   */
  updateItem(itemId, payloadUpdates = {}, metadataUpdates = {}, options = {}) {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`[HARNESS-ITEMSTORE] Item "${itemId}" not found`);
    }

    // Invariant: Completed or terminal item cannot be modified
    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.CANCELLED].includes(item.status)) {
      throw new Error(`[HARNESS-ITEMSTORE] Cannot update Item "${itemId}" in terminal state "${item.status}"`);
    }

    const sanitizedPayloadUpdates = secretFilter.sanitizeObject(payloadUpdates || {});
    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});

    item.status = ITEM_STATUS.IN_PROGRESS;
    item.payload = {
      ...item.payload,
      ...sanitizedPayloadUpdates,
    };
    item.metadata = {
      ...item.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.ITEM_UPDATED, {
      threadId: options.threadId || null,
      turnId: item.turnId,
      itemId,
      payload: { item: { ...item } },
    });

    return item;
  }

  /**
   * Transitions an Item to COMPLETED state.
   * @param {string} itemId
   * @param {Object} [finalPayload]
   * @param {Object} [metadataUpdates]
   * @param {Object} [options]
   * @returns {Object} Completed Item
   */
  completeItem(itemId, finalPayload = {}, metadataUpdates = {}, options = {}) {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`[HARNESS-ITEMSTORE] Item "${itemId}" not found`);
    }

    // Invariant: Completed or terminal item cannot transition back
    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.CANCELLED].includes(item.status)) {
      throw new Error(`[HARNESS-ITEMSTORE] Cannot complete Item "${itemId}" which is already in state "${item.status}"`);
    }

    const sanitizedFinalPayload = secretFilter.sanitizeObject(finalPayload || {});
    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});

    item.status = ITEM_STATUS.COMPLETED;
    item.completedAt = Date.now();
    item.payload = {
      ...item.payload,
      ...sanitizedFinalPayload,
    };
    item.metadata = {
      ...item.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.ITEM_COMPLETED, {
      threadId: options.threadId || null,
      turnId: item.turnId,
      itemId,
      payload: { item: { ...item } },
    });

    return item;
  }

  /**
   * Transitions an Item to FAILED state.
   * @param {string} itemId
   * @param {string|Error|Object} error
   * @param {Object} [metadataUpdates]
   * @param {Object} [options]
   * @returns {Object} Failed Item
   */
  failItem(itemId, error, metadataUpdates = {}, options = {}) {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`[HARNESS-ITEMSTORE] Item "${itemId}" not found`);
    }

    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.CANCELLED].includes(item.status)) {
      throw new Error(`[HARNESS-ITEMSTORE] Cannot fail Item "${itemId}" which is already in state "${item.status}"`);
    }

    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    const sanitizedError = secretFilter.sanitizeString(errorMessage || 'Unknown item failure');
    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});

    item.status = ITEM_STATUS.FAILED;
    item.completedAt = Date.now();
    item.error = sanitizedError;
    item.metadata = {
      ...item.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.ITEM_FAILED, {
      threadId: options.threadId || null,
      turnId: item.turnId,
      itemId,
      payload: { item: { ...item }, error: sanitizedError },
    });

    return item;
  }

  /**
   * Transitions an Item to CANCELLED state.
   * @param {string} itemId
   * @param {Object} [metadataUpdates]
   * @param {Object} [options]
   * @returns {Object} Cancelled Item
   */
  cancelItem(itemId, metadataUpdates = {}, options = {}) {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`[HARNESS-ITEMSTORE] Item "${itemId}" not found`);
    }

    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.CANCELLED].includes(item.status)) {
      return item; // Idempotent or terminal
    }

    const sanitizedMetadataUpdates = secretFilter.sanitizeObject(metadataUpdates || {});

    item.status = ITEM_STATUS.CANCELLED;
    item.completedAt = Date.now();
    item.metadata = {
      ...item.metadata,
      ...sanitizedMetadataUpdates,
    };

    this.eventBus.emit(EVENT_TYPES.ITEM_CANCELLED, {
      threadId: options.threadId || null,
      turnId: item.turnId,
      itemId,
      payload: { item: { ...item } },
    });

    return item;
  }

  /**
   * Retrieves a single Item by ID.
   * @param {string} itemId
   * @returns {Object|null}
   */
  getItem(itemId) {
    const item = this.items.get(itemId);
    return item ? { ...item } : null;
  }

  /**
   * Retrieves all Items belonging to a Turn in chronological insertion order.
   * @param {string} turnId
   * @returns {Array<Object>}
   */
  getItemsByTurn(turnId) {
    const itemIds = this.turnItems.get(turnId);
    if (!itemIds) return [];
    return Array.from(itemIds).map((id) => ({ ...this.items.get(id) })).filter(Boolean);
  }

  /**
   * Restores an item directly (used during persistence deserialization).
   * @param {Object} itemData
   */
  restoreItem(itemData) {
    if (!itemData || !itemData.itemId || !itemData.turnId) return;
    this.items.set(itemData.itemId, { ...itemData });
    if (!this.turnItems.has(itemData.turnId)) {
      this.turnItems.set(itemData.turnId, new Set());
    }
    this.turnItems.get(itemData.turnId).add(itemData.itemId);
  }

  /**
   * Clears internal state (primarily for test resets).
   */
  clear() {
    this.items.clear();
    this.turnItems.clear();
  }
}

const itemStore = new ItemStore();

module.exports = {
  ItemStore,
  itemStore,
};
