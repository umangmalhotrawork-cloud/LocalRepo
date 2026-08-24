/**
 * CONTEXT CAPSULE MANAGER
 * Independent manager for creating, validating, sanitizing, and persisting NEXUS Context Capsules.
 * Strictly decoupled from Continuum Lineage and Continuum state/storage.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let electronApp = null;
try {
  electronApp = require('electron').app;
} catch (e) {}

const secretFilter = require('../../security/secretFilter');
const {
  NEXUS_CAPSULE_VERSION,
  generateCapsuleId,
  generateCapsuleRef,
  normalizeCapsuleRef,
  validateCapsule,
  assertValidCapsule,
  serializeCapsule,
  parseCapsule,
} = require('./CapsuleSchema');
const { generateContinuationPrompt, isGreetingOnly } = require('./CapsulePromptBuilder');

const { threadManager: defaultThreadManager } = require('../harness/ThreadManager');
const { turnManager: defaultTurnManager } = require('../harness/TurnManager');
const { itemStore: defaultItemStore } = require('../harness/ItemStore');
const { ITEM_TYPES } = require('../harness/types');

class ContextCapsuleManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.storageDir] - Custom capsule storage directory
   * @param {Object} [options.threadManager] - Injected ThreadManager instance
   * @param {Object} [options.turnManager] - Injected TurnManager instance
   * @param {Object} [options.itemStore] - Injected ItemStore instance
   */
  constructor(options = {}) {
    this.customStorageDir = options.storageDir || null;
    this.threadManager = options.threadManager || defaultThreadManager;
    this.turnManager = options.turnManager || defaultTurnManager;
    this.itemStore = options.itemStore || defaultItemStore;
  }

  /**
   * Resolves the independent capsule storage directory.
   * Format: <userData>/context-capsules/
   * @returns {string}
   */
  getStorageDir() {
    if (this.customStorageDir) {
      return this.customStorageDir;
    }
    if (process.env.NEXUS_CAPSULE_DIR) {
      return process.env.NEXUS_CAPSULE_DIR;
    }

    try {
      if (electronApp && typeof electronApp.getPath === 'function') {
        const appPath = electronApp.getPath('userData');
        if (appPath) {
          return path.join(appPath, 'context-capsules');
        }
      }
    } catch (e) {}

    // Fallback standard user application support location
    const homeDir = os.homedir();
    const defaultDir = path.join(homeDir, 'Library', 'Application Support', 'echo-nullity', 'context-capsules');
    try {
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      return defaultDir;
    } catch (e) {
      return path.join(process.cwd(), '.echo-nullity-capsules');
    }
  }

  /**
   * Generates a deterministic compact summary from structured thread data.
   * NO AI MODEL OR PROVIDER CALLS ARE USED.
   * @private
   * @param {Object} thread
   * @param {Array<Object>} turns
   * @param {Array<Object>} exchanges
   * @returns {string}
   */
  _buildDeterministicSummary(thread, turns = [], exchanges = []) {
    const title = thread.title || thread.metadata?.title || 'Session';
    const turnCount = turns.length;
    const status = thread.status || (turns.length > 0 ? turns[turns.length - 1].status : 'ACTIVE');

    let summaryParts = [`Task: ${title}`, `Status: ${status}`, `Total Turns: ${turnCount}`];

    if (exchanges.length > 0) {
      const latest = exchanges[exchanges.length - 1];
      if (latest.user) {
        const truncatedUser = latest.user.length > 120 ? latest.user.slice(0, 117) + '...' : latest.user;
        summaryParts.push(`Latest User Directive: "${truncatedUser.replace(/\n+/g, ' ')}"`);
      }
    }

    return summaryParts.join(' | ');
  }

  /**
   * Extracts user and assistant content from a turn and its items.
   * Excludes tool calls and tool results from being counted as user/assistant exchanges.
   * @private
   * @param {Object} turn
   * @returns {{ user: string, assistant: string } | null}
   */
  _extractTurnExchange(turn) {
    if (!turn) return null;

    const items = this.itemStore.getItemsByTurn(turn.turnId) || [];
    let userText = '';
    const assistantTexts = [];

    // Check for user message in items
    for (const item of items) {
      if (!item || !item.type) continue;
      const payload = item.payload || {};

      if (item.type === ITEM_TYPES.USER_MESSAGE) {
        const text = payload.text || payload.userInput || payload.prompt || payload.content || '';
        if (text && typeof text === 'string') {
          userText = text;
        }
      } else if (item.type === ITEM_TYPES.AGENT_MESSAGE) {
        const text = payload.text || payload.summary || payload.content || '';
        if (text && typeof text === 'string') {
          assistantTexts.push(text);
        }
      } else if (item.type === ITEM_TYPES.PLAN) {
        const planText = payload.plan || payload.text || payload.summary || '';
        if (planText && typeof planText === 'string') {
          assistantTexts.push(`[PLAN]: ${planText}`);
        }
      }
      // ITEM_TYPES.TOOL_CALL and ITEM_TYPES.TOOL_RESULT are intentionally excluded
    }

    // Fallback user text from turn.userInput
    if (!userText && turn.userInput && typeof turn.userInput === 'string') {
      userText = turn.userInput;
    }

    // Fallback assistant text from turn metadata if no agent message item existed
    if (assistantTexts.length === 0 && turn.metadata?.summary && typeof turn.metadata.summary === 'string') {
      assistantTexts.push(turn.metadata.summary);
    }

    const assistantText = assistantTexts.join('\n\n');

    // Only return an exchange if there was at least a user directive or assistant response
    if (!userText && !assistantText) {
      return null;
    }

    return {
      user: userText,
      assistant: assistantText,
    };
  }

  /**
   * Extracts relevant files mentioned across items and metadata in a thread.
   * @private
   * @param {Object} thread
   * @param {Array<Object>} turns
   * @returns {string[]}
   */
  _extractRelevantFiles(thread, turns = []) {
    const filesSet = new Set();

    // From thread metadata
    if (Array.isArray(thread.metadata?.relevantFiles)) {
      for (const f of thread.metadata.relevantFiles) {
        if (typeof f === 'string' && f.trim()) filesSet.add(f.trim());
      }
    }
    if (Array.isArray(thread.metadata?.files)) {
      for (const f of thread.metadata.files) {
        if (typeof f === 'string' && f.trim()) filesSet.add(f.trim());
      }
    }

    // From turns and items
    for (const turn of turns) {
      const items = this.itemStore.getItemsByTurn(turn.turnId) || [];
      for (const item of items) {
        if (!item) continue;
        const payload = item.payload || {};

        if (item.type === ITEM_TYPES.FILE_CHANGE && payload.filePath && typeof payload.filePath === 'string') {
          filesSet.add(payload.filePath.trim());
        } else if (item.type === ITEM_TYPES.CHANGE_SET) {
          const files = payload.files || payload.changeSet?.files || [];
          if (Array.isArray(files)) {
            for (const f of files) {
              const p = typeof f === 'string' ? f : (f?.filePath || f?.path);
              if (typeof p === 'string' && p.trim()) filesSet.add(p.trim());
            }
          }
        }
      }
    }

    return Array.from(filesSet);
  }

  /**
   * Checks whether a message string is merely a short conversational greeting/pleasantry.
   * @private
   * @param {string} text
   * @returns {boolean}
   */
  _isGreetingOnly(text) {
    if (!text || typeof text !== 'string') return true;
    const clean = text.trim().toLowerCase().replace(/^[^\w\s]+|[^\w\s]+$/g, '');
    const casualGreetings = [
      'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'good night',
      'howdy', 'yo', 'sup', 'test', 'ping', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'yep', 'nope',
      'cool', 'nice', 'awesome', 'great', 'how are you', 'how are you doing'
    ];
    return casualGreetings.includes(clean) || casualGreetings.some((g) => clean === `${g} there` || clean === `hey ${g}` || clean === `${g} nexus`);
  }

  /**
   * Extracts Layer 1: Base Chat
   * Finds the first meaningful user <-> assistant exchange establishing the task/topic.
   * Skips greeting-only opening exchanges.
   * @private
   * @param {Array<Object>} allExchanges
   * @returns {{ user: string, assistant: string } | null}
   */
  _extractBaseChat(allExchanges = []) {
    if (!allExchanges || allExchanges.length === 0) return null;

    for (const ex of allExchanges) {
      if (!ex || !ex.user) continue;
      if (!this._isGreetingOnly(ex.user)) {
        return {
          user: ex.user,
          assistant: ex.assistant || '',
        };
      }
    }

    // Fallback: return the first exchange if all were brief
    return allExchanges[0] ? { user: allExchanges[0].user, assistant: allExchanges[0].assistant || '' } : null;
  }

  /**
   * Extracts Layer 2: Important / Repeated Context and Constraints.
   * Extracts repeated requirements, decisions, reinforced topics, and recurring constraints.
   * Zero external AI calls.
   * @private
   * @param {Object} thread
   * @param {Array<Object>} turns
   * @param {Array<Object>} allExchanges
   * @returns {{ important_context: string[], constraints: string[] }}
   */
  _extractImportantAndRepeatedContext(thread, turns = [], allExchanges = []) {
    const importantSet = new Set();
    const constraintsSet = new Set();

    // 1. Explicit metadata fields
    if (Array.isArray(thread.metadata?.importantContext)) {
      thread.metadata.importantContext.forEach((c) => typeof c === 'string' && c.trim() && importantSet.add(c.trim()));
    }
    if (Array.isArray(thread.metadata?.important_context)) {
      thread.metadata.important_context.forEach((c) => typeof c === 'string' && c.trim() && importantSet.add(c.trim()));
    }
    if (Array.isArray(thread.metadata?.requirements)) {
      thread.metadata.requirements.forEach((r) => typeof r === 'string' && r.trim() && importantSet.add(`Requirement: ${r.trim()}`));
    }
    if (Array.isArray(thread.metadata?.constraints)) {
      thread.metadata.constraints.forEach((c) => typeof c === 'string' && c.trim() && constraintsSet.add(c.trim()));
    }

    // 2. Intent markers in conversation items
    const importantPatterns = [
      /\b(?:we decided|decision:|agreed to|chosen approach:?)\s+([^\.\n]+)/i,
      /\b(?:important:?|note that|remember that|crucial:?|vital:?)\s+([^\.\n]+)/i,
      /\b(?:requirement:?|required:?|feature requirement:?)\s+([^\.\n]+)/i,
      /\b(?:focus on|ensure that|always ensure)\s+([^\.\n]+)/i,
    ];

    const constraintPatterns = [
      /\b(?:must\s+not|never|do\s+not|cannot|prohibited|forbidden)\s+([^\.\n]+)/i,
      /\b(?:constraint:?|limitation:?|boundary:?)\s+([^\.\n]+)/i,
      /\b(?:must\s+always|must\s+be|must\s+use|must\s+follow)\s+([^\.\n]+)/i,
    ];

    for (const turn of turns) {
      const items = this.itemStore.getItemsByTurn(turn.turnId) || [];
      for (const item of items) {
        const text = item?.payload?.text || item?.payload?.content || item?.payload?.userInput || '';
        if (typeof text !== 'string') continue;

        for (const rx of importantPatterns) {
          const match = text.match(rx);
          if (match && match[0]) {
            const clean = match[0].trim();
            if (clean.length > 8 && clean.length < 180) {
              importantSet.add(clean);
            }
          }
        }

        for (const rx of constraintPatterns) {
          const match = text.match(rx);
          if (match && match[0]) {
            const clean = match[0].trim();
            if (clean.length > 8 && clean.length < 180) {
              constraintsSet.add(clean);
            }
          }
        }
      }
    }

    // 3. Repeated file references across multiple turns
    const fileMentions = new Map();
    for (const ex of allExchanges) {
      const combined = `${ex.user || ''} ${ex.assistant || ''}`;
      const foundFiles = combined.match(/[\w\-\.\/]+\.(?:py|ts|tsx|js|jsx|json|html|css|yaml|yml|sql|go|rs|java|md)\b/g) || [];
      const uniqueFiles = new Set(foundFiles);
      for (const f of uniqueFiles) {
        fileMentions.set(f, (fileMentions.get(f) || 0) + 1);
      }
    }
    for (const [file, count] of fileMentions.entries()) {
      if (count >= 2) {
        importantSet.add(`Repeatedly referenced file: ${file}`);
      }
    }

    return {
      important_context: Array.from(importantSet).slice(0, 10),
      constraints: Array.from(constraintsSet).slice(0, 10),
    };
  }

  /**
   * Creates a sanitized, validated Context Capsule from an existing Thread.
   * DOES NOT MUTATE SOURCE THREAD DATA.
   * DOES NOT CALL EXTERNAL AI SERVICES.
   * @param {string} threadId
   * @param {Object} [options]
   * @param {string} [options.workspacePath]
   * @returns {Object} Validated Context Capsule
   */
  createCapsule(threadId, options = {}) {
    if (!threadId || typeof threadId !== 'string') {
      throw new Error('[CONTEXT_CAPSULE_MANAGER] threadId is required to create a capsule');
    }

    const thread = this.threadManager.getThread(threadId);
    if (!thread) {
      throw new Error(`[CONTEXT_CAPSULE_MANAGER] Thread "${threadId}" not found`);
    }

    const turns = this.turnManager.listTurnsByThread(threadId) || [];

    // Extract user<->assistant exchanges
    const allExchanges = [];
    for (const turn of turns) {
      const exchange = this._extractTurnExchange(turn);
      if (exchange) {
        allExchanges.push(exchange);
      }
    }

    // Retain at most the last 3 exchanges in chronological order (oldest -> newest)
    const last_exchanges = allExchanges.slice(-3);

    // Layer 1: Base Chat (first meaningful exchange)
    const base_chat = this._extractBaseChat(allExchanges);

    // Layer 2: Important & Repeated Context + Constraints
    const { important_context, constraints } = this._extractImportantAndRepeatedContext(thread, turns, allExchanges);

    // Primary goal from thread or initial prompt
    const primary_goal = (
      thread.metadata?.primaryGoal ||
      thread.metadata?.userInput ||
      (base_chat ? base_chat.user : '') ||
      (allExchanges.length > 0 ? allExchanges[0].user : '') ||
      thread.title ||
      thread.metadata?.title ||
      ''
    );

    // Current status
    const current_status = (
      thread.metadata?.currentStatus ||
      thread.metadata?.status ||
      thread.status ||
      (turns.length > 0 ? turns[turns.length - 1].status : 'ACTIVE')
    );

    // Important decisions if structurally present
    let important_decisions = [];
    if (Array.isArray(thread.metadata?.important_decisions)) {
      important_decisions = thread.metadata.important_decisions.filter((d) => typeof d === 'string');
    } else if (Array.isArray(thread.metadata?.importantDecisions)) {
      important_decisions = thread.metadata.importantDecisions.filter((d) => typeof d === 'string');
    } else if (Array.isArray(thread.metadata?.decisions)) {
      important_decisions = thread.metadata.decisions.filter((d) => typeof d === 'string');
    }

    // Pending work if structurally present
    let pending_work = [];
    if (Array.isArray(thread.metadata?.pending_work)) {
      pending_work = thread.metadata.pending_work.filter((p) => typeof p === 'string');
    } else if (Array.isArray(thread.metadata?.pendingWork)) {
      pending_work = thread.metadata.pendingWork.filter((p) => typeof p === 'string');
    } else if (Array.isArray(thread.metadata?.pendingTasks)) {
      pending_work = thread.metadata.pendingTasks.filter((p) => typeof p === 'string');
    }

    // Relevant files
    const relevant_files = this._extractRelevantFiles(thread, turns);

    // Deterministic summary
    const summary = this._buildDeterministicSummary(thread, turns, allExchanges);

    const rawCapsule = {
      nexus_capsule_version: NEXUS_CAPSULE_VERSION,
      capsule_id: generateCapsuleId(),
      capsule_ref: generateCapsuleRef(),
      created_at: Date.now(),

      source_chat: {
        thread_id: thread.threadId || threadId,
        title: thread.title || thread.metadata?.title || 'New Task',
        workspace_name: thread.metadata?.workspaceName || (options.workspacePath ? path.basename(options.workspacePath) : 'NEXUS'),
        provider_id: thread.metadata?.providerId || 'unknown',
        model_id: thread.metadata?.modelId || 'unknown',
      },

      task_state: {
        primary_goal,
        current_status,
        important_decisions,
        important_context,
        constraints,
        pending_work,
        relevant_files,
      },

      conversation_context: {
        summary,
        base_chat,
        last_exchanges,
      },
    };

    // Secret Sanitization boundary
    const sanitizedCapsule = secretFilter.sanitizeObject(rawCapsule);

    // Schema Validation boundary
    assertValidCapsule(sanitizedCapsule);

    return sanitizedCapsule;
  }

  /**
   * Atomically writes data to a destination file.
   * temp file -> fsync -> rename
   * @private
   * @param {string} destinationFilePath
   * @param {string} data
   */
  _writeAtomic(destinationFilePath, data) {
    const dir = path.dirname(destinationFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempFile = path.join(dir, `.tmp_${path.basename(destinationFilePath)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);

    let fd;
    try {
      fd = fs.openSync(tempFile, 'w');
      fs.writeFileSync(fd, data, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(tempFile, destinationFilePath);
    } catch (err) {
      if (fd !== null && fd !== undefined) {
        try { fs.closeSync(fd); } catch (_) {}
      }
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (_) {}
      throw err;
    }
  }

  /**
   * Persists a Context Capsule to independent capsule storage using atomic file write.
   * @param {Object} capsule
   * @returns {{ success: boolean, capsuleId: string, capsuleRef?: string, filePath: string }}
   */
  saveCapsule(capsule) {
    // Sanitization & Validation
    const sanitized = secretFilter.sanitizeObject(capsule);
    assertValidCapsule(sanitized);

    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, `${sanitized.capsule_id}.json`);
    const serialized = serializeCapsule(sanitized);

    this._writeAtomic(filePath, serialized);

    return {
      success: true,
      capsuleId: sanitized.capsule_id,
      capsuleRef: sanitized.capsule_ref,
      filePath,
    };
  }

  /**
   * Loads and validates a Context Capsule from independent storage.
   * @param {string} capsuleId
   * @returns {Object} Validated Context Capsule
   */
  loadCapsule(capsuleId) {
    if (!capsuleId || typeof capsuleId !== 'string') {
      throw new Error('[CONTEXT_CAPSULE_MANAGER] capsuleId is required to load a capsule');
    }

    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, `${capsuleId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`[CONTEXT_CAPSULE_MANAGER] Capsule "${capsuleId}" not found at ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return parseCapsule(raw);
  }

  /**
   * Deletes a Context Capsule from independent storage.
   * @param {string} capsuleId
   * @returns {boolean} True if deleted, false if not found
   */
  deleteCapsule(capsuleId) {
    if (!capsuleId || typeof capsuleId !== 'string') {
      return false;
    }

    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, `${capsuleId}.json`);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      throw new Error(`[CONTEXT_CAPSULE_MANAGER] Failed to delete capsule "${capsuleId}": ${err.message}`);
    }
  }

  /**
   * Lists all valid Context Capsules in independent storage.
   * Sorted by created_at descending (newest first).
   * @returns {Array<Object>}
   */
  listCapsules() {
    const storageDir = this.getStorageDir();
    if (!fs.existsSync(storageDir)) {
      return [];
    }

    const entries = fs.readdirSync(storageDir);
    const capsules = [];

    for (const file of entries) {
      if (!file.endsWith('.json') || file.startsWith('.')) continue;

      const filePath = path.join(storageDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const capsule = parseCapsule(raw);
        capsules.push(capsule);
      } catch (err) {
        // Skip corrupted or unparsable files in list
      }
    }

    capsules.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return capsules;
  }

  /**
   * Validates a capsule.
   * @param {any} capsule
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateCapsule(capsule) {
    return validateCapsule(capsule);
  }

  /**
   * Serializes a capsule to JSON string.
   * @param {Object} capsule
   * @returns {string}
   */
  serializeCapsule(capsule) {
    return serializeCapsule(capsule);
  }

  /**
   * Resolves a public hashtag reference (e.g. #CC7F3A2B, CC7F3A2B) or internal capsuleId against independent storage.
   * Case-insensitive, purely deterministic, zero AI calls.
   * @param {string} capsuleRef
   * @returns {{ success: boolean, capsule?: Object, error?: string }}
   */
  resolveCapsuleReference(capsuleRef) {
    if (!capsuleRef || typeof capsuleRef !== 'string') {
      return { success: false, error: 'Capsule reference must be a non-empty string' };
    }

    const trimmed = capsuleRef.trim();
    if (!trimmed) {
      return { success: false, error: 'Capsule reference cannot be empty' };
    }

    const normalizedRef = normalizeCapsuleRef(trimmed);
    const capsules = this.listCapsules();

    // 1. Match by capsule_ref (exact normalized case-insensitive match)
    let matched = capsules.find((c) => {
      if (c.capsule_ref && typeof c.capsule_ref === 'string') {
        const cRef = normalizeCapsuleRef(c.capsule_ref);
        return cRef.toUpperCase() === normalizedRef.toUpperCase();
      }
      return false;
    });

    // 2. Fallback match by capsule_id (if user pasted the long internal ID or trailing hex)
    if (!matched) {
      const plainHex = trimmed.replace(/^#?CC/i, '').toLowerCase();
      matched = capsules.find((c) => {
        if (c.capsule_id && typeof c.capsule_id === 'string') {
          const lowerId = c.capsule_id.toLowerCase();
          return lowerId === trimmed.toLowerCase() ||
                 (plainHex && lowerId.endsWith(plainHex));
        }
        return false;
      });
    }

    if (!matched) {
      return {
        success: false,
        error: `No Context Capsule exists for ${normalizedRef || trimmed}.`,
      };
    }

    const validation = this.validateCapsule(matched);
    if (!validation.valid) {
      return {
        success: false,
        error: `Capsule ${normalizedRef || trimmed} failed schema validation: ${validation.errors.join('; ')}`,
      };
    }

    return {
      success: true,
      capsule: matched,
    };
  }

  /**
   * Generates a 3-layer continuation prompt from a validated Context Capsule.
   * Deterministic local extraction, zero AI calls.
   * @param {Object} capsule
   * @returns {string}
   */
  generateContinuationPrompt(capsule) {
    return generateContinuationPrompt(capsule);
  }

  /**
   * Parses and validates a raw capsule JSON string.
   * @param {string} raw
   * @returns {Object}
   */
  parseCapsule(raw) {
    return parseCapsule(raw);
  }
}

const contextCapsuleManager = new ContextCapsuleManager();

module.exports = {
  ContextCapsuleManager,
  contextCapsuleManager,
  generateContinuationPrompt,
  isGreetingOnly,
};
