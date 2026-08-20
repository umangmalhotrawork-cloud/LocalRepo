/**
 * NEXUS CODEX HARNESS - CENTRAL EVENT BUS
 * Provides deterministic, monotonically ordered event emission, history tracking,
 * and subscription handling for the Harness layer.
 */

const { generateEventId, EVENT_TYPES } = require('./types');

class HarnessEventBus {
  constructor() {
    this.sequenceNumber = 0;
    this.events = [];
    this.subscribers = new Set();
    this.typedSubscribers = new Map();
  }

  /**
   * Emits a typed event on the central bus.
   * @param {string} type - Event type from EVENT_TYPES
   * @param {Object} data - Contextual event details
   * @param {string} [data.threadId] - Associated Thread ID
   * @param {string} [data.turnId] - Associated Turn ID
   * @param {string} [data.itemId] - Associated Item ID
   * @param {Object} [data.payload] - Arbitrary event payload
   * @returns {Object} The complete deterministic event object
   */
  emit(type, data = {}) {
    if (!type || typeof type !== 'string') {
      throw new Error('[HARNESS-EVENTBUS] Event type is required');
    }

    this.sequenceNumber += 1;
    const event = {
      eventId: generateEventId(),
      type,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber,
      threadId: data.threadId || null,
      turnId: data.turnId || null,
      itemId: data.itemId || null,
      payload: data.payload !== undefined ? data.payload : {},
    };

    // Store in history buffer
    this.events.push(event);

    // Notify global subscribers
    for (const listener of this.subscribers) {
      try {
        listener(event);
      } catch (err) {
        console.error('[HARNESS-EVENTBUS] Subscriber notification error:', err);
      }
    }

    // Notify typed subscribers
    if (this.typedSubscribers.has(type)) {
      const typeSet = this.typedSubscribers.get(type);
      for (const listener of typeSet) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[HARNESS-EVENTBUS] Typed subscriber (${type}) notification error:`, err);
        }
      }
    }

    return event;
  }

  /**
   * Subscribes to all events emitted on the bus.
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('[HARNESS-EVENTBUS] Listener must be a function');
    }
    this.subscribers.add(listener);
    return () => this.unsubscribe(listener);
  }

  /**
   * Unsubscribes a global listener.
   * @param {Function} listener
   */
  unsubscribe(listener) {
    this.subscribers.delete(listener);
  }

  /**
   * Subscribes to a specific event type.
   * @param {string} type
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  on(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('[HARNESS-EVENTBUS] Listener must be a function');
    }
    if (!this.typedSubscribers.has(type)) {
      this.typedSubscribers.set(type, new Set());
    }
    this.typedSubscribers.get(type).add(listener);
    return () => this.off(type, listener);
  }

  /**
   * Unsubscribes from a specific event type.
   * @param {string} type
   * @param {Function} listener
   */
  off(type, listener) {
    if (this.typedSubscribers.has(type)) {
      this.typedSubscribers.get(type).delete(listener);
    }
  }

  /**
   * Retrieves events matching an optional filter.
   * @param {Object} [filter]
   * @param {string} [filter.threadId]
   * @param {string} [filter.turnId]
   * @param {string} [filter.itemId]
   * @param {string} [filter.type]
   * @param {number} [filter.sinceSequence]
   * @returns {Array<Object>}
   */
  getEvents(filter = {}) {
    return this.events.filter((evt) => {
      if (filter.threadId && evt.threadId !== filter.threadId) return false;
      if (filter.turnId && evt.turnId !== filter.turnId) return false;
      if (filter.itemId && evt.itemId !== filter.itemId) return false;
      if (filter.type && evt.type !== filter.type) return false;
      if (typeof filter.sinceSequence === 'number' && evt.sequenceNumber <= filter.sinceSequence) return false;
      return true;
    });
  }

  /**
   * Clears the event buffer and resets sequence. Primarily for testing.
   */
  clear() {
    this.sequenceNumber = 0;
    this.events = [];
  }
}

const harnessEventBus = new HarnessEventBus();

module.exports = {
  HarnessEventBus,
  harnessEventBus,
};
