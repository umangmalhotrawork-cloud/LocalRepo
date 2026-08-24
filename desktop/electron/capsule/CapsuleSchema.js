/**
 * CONTEXT CAPSULE SCHEMA (v1.0.0)
 * Independent schema and validation boundary for NEXUS Context Capsules.
 * Strictly decoupled from Continuum Lineage.
 */

const crypto = require('crypto');

const NEXUS_CAPSULE_VERSION = '1.0.0';
const CAPSULE_ID_REGEX = /^capsule_\d+_[a-zA-Z0-9_-]+$/;
const CAPSULE_REF_REGEX = /^#?CC[0-9A-Fa-f]{6,8}$/;

/**
 * Generates a collision-resistant capsule ID.
 * Format: capsule_<timestamp>_<randomHex>
 * @param {number} [timestamp]
 * @returns {string}
 */
function generateCapsuleId(timestamp = Date.now()) {
  const ts = typeof timestamp === 'number' && !isNaN(timestamp) && timestamp > 0 ? timestamp : Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  return `capsule_${ts}_${rand}`;
}

/**
 * Generates a short human-facing public capsule reference.
 * Format: #CC + 6 uppercase alphanumeric/hex chars (e.g. #CC7F3A2B)
 * @returns {string}
 */
function generateCapsuleRef() {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `#CC${rand}`;
}

/**
 * Normalizes a user-input capsule reference string (adds leading # if missing, uppercase, trimmed).
 * @param {string} ref
 * @returns {string}
 */
function normalizeCapsuleRef(ref) {
  if (!ref || typeof ref !== 'string') return '';
  const trimmed = ref.trim().toUpperCase();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Validates a Context Capsule against the v1.0.0 specification.
 * Rejects malformed structures without silent mutation.
 * @param {any} capsule
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCapsule(capsule) {
  const errors = [];

  if (!capsule || typeof capsule !== 'object' || Array.isArray(capsule)) {
    return { valid: false, errors: ['Capsule must be a non-null object'] };
  }

  // 1. Version check
  if (capsule.nexus_capsule_version !== NEXUS_CAPSULE_VERSION) {
    errors.push(`Invalid nexus_capsule_version: expected "${NEXUS_CAPSULE_VERSION}", got "${capsule.nexus_capsule_version}"`);
  }

  // 2. Capsule ID check
  if (typeof capsule.capsule_id !== 'string' || !capsule.capsule_id || !CAPSULE_ID_REGEX.test(capsule.capsule_id)) {
    errors.push(`Invalid capsule_id: must match pattern ${CAPSULE_ID_REGEX.toString()}, got "${capsule.capsule_id}"`);
  }

  // 2b. Optional Capsule Reference check
  if (capsule.capsule_ref !== undefined) {
    if (typeof capsule.capsule_ref !== 'string' || !CAPSULE_REF_REGEX.test(capsule.capsule_ref)) {
      errors.push(`Invalid capsule_ref: must match pattern #CC[0-9A-F]{6,8}, got "${capsule.capsule_ref}"`);
    }
  }

  // 3. Created At check
  if (typeof capsule.created_at !== 'number' || isNaN(capsule.created_at) || capsule.created_at <= 0) {
    errors.push(`Invalid created_at: must be a positive timestamp, got "${capsule.created_at}"`);
  }

  // 4. Source Chat check
  if (!capsule.source_chat || typeof capsule.source_chat !== 'object' || Array.isArray(capsule.source_chat)) {
    errors.push('source_chat must be a non-null object');
  } else {
    if (typeof capsule.source_chat.thread_id !== 'string' || !capsule.source_chat.thread_id.trim()) {
      errors.push('source_chat.thread_id is required and must be a non-empty string');
    }
    if (capsule.source_chat.title !== undefined && typeof capsule.source_chat.title !== 'string') {
      errors.push('source_chat.title must be a string if provided');
    }
    if (capsule.source_chat.workspace_name !== undefined && typeof capsule.source_chat.workspace_name !== 'string') {
      errors.push('source_chat.workspace_name must be a string if provided');
    }
    if (capsule.source_chat.provider_id !== undefined && typeof capsule.source_chat.provider_id !== 'string') {
      errors.push('source_chat.provider_id must be a string if provided');
    }
    if (capsule.source_chat.model_id !== undefined && typeof capsule.source_chat.model_id !== 'string') {
      errors.push('source_chat.model_id must be a string if provided');
    }
  }

  // 5. Task State check
  if (!capsule.task_state || typeof capsule.task_state !== 'object' || Array.isArray(capsule.task_state)) {
    errors.push('task_state must be a non-null object');
  } else {
    if (capsule.task_state.primary_goal !== undefined && typeof capsule.task_state.primary_goal !== 'string') {
      errors.push('task_state.primary_goal must be a string');
    }
    if (capsule.task_state.current_status !== undefined && typeof capsule.task_state.current_status !== 'string') {
      errors.push('task_state.current_status must be a string');
    }
    if (capsule.task_state.important_decisions !== undefined) {
      if (!Array.isArray(capsule.task_state.important_decisions) || !capsule.task_state.important_decisions.every((d) => typeof d === 'string')) {
        errors.push('task_state.important_decisions must be an array of strings');
      }
    }
    if (capsule.task_state.important_context !== undefined) {
      if (!Array.isArray(capsule.task_state.important_context) || !capsule.task_state.important_context.every((c) => typeof c === 'string')) {
        errors.push('task_state.important_context must be an array of strings');
      }
    }
    if (capsule.task_state.constraints !== undefined) {
      if (!Array.isArray(capsule.task_state.constraints) || !capsule.task_state.constraints.every((c) => typeof c === 'string')) {
        errors.push('task_state.constraints must be an array of strings');
      }
    }
    if (capsule.task_state.pending_work !== undefined) {
      if (!Array.isArray(capsule.task_state.pending_work) || !capsule.task_state.pending_work.every((p) => typeof p === 'string')) {
        errors.push('task_state.pending_work must be an array of strings');
      }
    }
    if (capsule.task_state.relevant_files !== undefined) {
      if (!Array.isArray(capsule.task_state.relevant_files) || !capsule.task_state.relevant_files.every((f) => typeof f === 'string')) {
        errors.push('task_state.relevant_files must be an array of strings');
      }
    }
  }

  // 6. Conversation Context check
  if (!capsule.conversation_context || typeof capsule.conversation_context !== 'object' || Array.isArray(capsule.conversation_context)) {
    errors.push('conversation_context must be a non-null object');
  } else {
    if (typeof capsule.conversation_context.summary !== 'string') {
      errors.push('conversation_context.summary is required and must be a string');
    }

    if (capsule.conversation_context.base_chat !== undefined && capsule.conversation_context.base_chat !== null) {
      if (typeof capsule.conversation_context.base_chat !== 'object' || Array.isArray(capsule.conversation_context.base_chat)) {
        errors.push('conversation_context.base_chat must be an object');
      } else {
        if (capsule.conversation_context.base_chat.user !== undefined && typeof capsule.conversation_context.base_chat.user !== 'string') {
          errors.push('conversation_context.base_chat.user must be a string');
        }
        if (capsule.conversation_context.base_chat.assistant !== undefined && typeof capsule.conversation_context.base_chat.assistant !== 'string') {
          errors.push('conversation_context.base_chat.assistant must be a string');
        }
      }
    }

    if (!Array.isArray(capsule.conversation_context.last_exchanges)) {
      errors.push('conversation_context.last_exchanges is required and must be an array');
    } else {
      if (capsule.conversation_context.last_exchanges.length > 3) {
        errors.push(`conversation_context.last_exchanges must contain at most 3 exchanges, found ${capsule.conversation_context.last_exchanges.length}`);
      }

      for (let i = 0; i < capsule.conversation_context.last_exchanges.length; i++) {
        const exchange = capsule.conversation_context.last_exchanges[i];
        if (!exchange || typeof exchange !== 'object' || Array.isArray(exchange)) {
          errors.push(`conversation_context.last_exchanges[${i}] must be an object`);
          continue;
        }

        if (typeof exchange.user !== 'string') {
          errors.push(`conversation_context.last_exchanges[${i}].user is required and must be a string`);
        }

        if (typeof exchange.assistant !== 'string') {
          errors.push(`conversation_context.last_exchanges[${i}].assistant is required and must be a string`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a capsule and throws an Error if invalid.
 * @param {any} capsule
 */
function assertValidCapsule(capsule) {
  const result = validateCapsule(capsule);
  if (!result.valid) {
    throw new Error(`[CAPSULE_SCHEMA_ERROR] Invalid Context Capsule: ${result.errors.join('; ')}`);
  }
}

/**
 * Serializes a validated Context Capsule to formatted JSON.
 * @param {Object} capsule
 * @param {Object} [options]
 * @param {boolean} [options.skipValidation=false]
 * @returns {string} JSON string
 */
function serializeCapsule(capsule, options = {}) {
  if (!options.skipValidation) {
    assertValidCapsule(capsule);
  }
  return JSON.stringify(capsule, null, 2);
}

/**
 * Parses and validates a raw JSON string into a Context Capsule.
 * @param {string} raw
 * @returns {Object} Validated Context Capsule
 */
function parseCapsule(raw) {
  if (typeof raw !== 'string') {
    throw new Error('[CAPSULE_SCHEMA_ERROR] Cannot parse non-string capsule input');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[CAPSULE_SCHEMA_ERROR] JSON parsing failed: ${err.message}`);
  }

  assertValidCapsule(parsed);
  return parsed;
}

const { generateContinuationPrompt } = require('./CapsulePromptBuilder');

module.exports = {
  NEXUS_CAPSULE_VERSION,
  CAPSULE_ID_REGEX,
  CAPSULE_REF_REGEX,
  generateCapsuleId,
  generateCapsuleRef,
  normalizeCapsuleRef,
  validateCapsule,
  assertValidCapsule,
  serializeCapsule,
  parseCapsule,
  generateContinuationPrompt,
};
