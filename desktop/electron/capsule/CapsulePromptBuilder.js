/**
 * CAPSULE PROMPT BUILDER
 * Deterministic local generation of human-readable continuation prompts from NEXUS Context Capsules.
 * Zero external AI calls. Zero mutation of source state.
 *
 * Three Layers:
 *  1. Base Chat (first meaningful exchange / topic from Chat A)
 *  2. Important / Repeated Context (constraints, decisions, reinforced requirements, state, files)
 *  3. Last 3 Complete Exchanges (chronological User -> Assistant turns)
 */

/**
 * Checks whether a message string is merely a short conversational greeting.
 * @param {string} text
 * @returns {boolean}
 */
function isGreetingOnly(text) {
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
 * Builds a structured, human-readable continuation prompt from a validated Context Capsule.
 * @param {Object} capsule - Validated Context Capsule
 * @returns {string} Continuation prompt text
 */
function generateContinuationPrompt(capsule) {
  if (!capsule || typeof capsule !== 'object') {
    return '';
  }

  const taskState = capsule.task_state || {};
  const convoContext = capsule.conversation_context || {};
  const baseChat = convoContext.base_chat;
  const rawExchanges = Array.isArray(convoContext.last_exchanges) ? convoContext.last_exchanges : [];
  
  // Retain at most the last 3 complete exchanges in chronological order
  const exchanges = rawExchanges.slice(-3);

  const sections = [
    'CONTINUE PREVIOUS NEXUS CONVERSATION',
    '',
    'I am continuing a previous NEXUS conversation.',
  ];

  // ------------------------------------------------------------------
  // LAYER 1: BASE CHAT / BASE CONTEXT
  // ------------------------------------------------------------------
  const baseLines = [];
  if (taskState.primary_goal && typeof taskState.primary_goal === 'string' && taskState.primary_goal.trim()) {
    const rawGoal = taskState.primary_goal.trim();
    const cleanGoal = rawGoal.replace(/^the original conversation was about\s+/i, '').replace(/^about\s+/i, '');
    baseLines.push(`The original conversation was about ${cleanGoal}.`);
  }

  if (baseChat && typeof baseChat === 'object') {
    if (baseChat.user && typeof baseChat.user === 'string' && baseChat.user.trim()) {
      const userText = baseChat.user.trim();
      // If primary goal didn't already capture the full text, include it
      if (!taskState.primary_goal || !taskState.primary_goal.includes(userText)) {
        baseLines.push(`Initial Request: ${userText}`);
      }
    }
    if (baseChat.assistant && typeof baseChat.assistant === 'string' && baseChat.assistant.trim()) {
      const assistantText = baseChat.assistant.trim();
      const firstSentence = assistantText.length > 300 ? assistantText.slice(0, 297) + '...' : assistantText;
      baseLines.push(`Initial Response: ${firstSentence}`);
    }
  }

  if (baseLines.length === 0 && convoContext.summary && typeof convoContext.summary === 'string') {
    baseLines.push(convoContext.summary.trim());
  }

  if (baseLines.length > 0) {
    sections.push('');
    sections.push('BASE CONTEXT:');
    sections.push(baseLines.join('\n'));
  }

  // ------------------------------------------------------------------
  // LAYER 2: IMPORTANT / REPEATED CONTEXT
  // ------------------------------------------------------------------
  // 1. Important Context & Reinforced Requirements
  const importantItems = [];
  if (Array.isArray(taskState.important_context)) {
    for (const item of taskState.important_context) {
      if (typeof item === 'string' && item.trim()) {
        importantItems.push(item.trim());
      }
    }
  }
  if (importantItems.length > 0) {
    sections.push('');
    sections.push('IMPORTANT CONTEXT:');
    for (const item of importantItems) {
      sections.push(`- ${item}`);
    }
  }

  // 2. Important Decisions
  if (Array.isArray(taskState.important_decisions) && taskState.important_decisions.length > 0) {
    const validDecisions = taskState.important_decisions.filter((d) => typeof d === 'string' && d.trim());
    if (validDecisions.length > 0) {
      sections.push('');
      sections.push('IMPORTANT DECISIONS:');
      for (const d of validDecisions) {
        sections.push(`- ${d.trim()}`);
      }
    }
  }

  // 3. Current State
  if (taskState.current_status && typeof taskState.current_status === 'string' && taskState.current_status.trim()) {
    sections.push('');
    sections.push('CURRENT STATE:');
    sections.push(`- ${taskState.current_status.trim()}`);
  }

  // 4. Constraints
  if (Array.isArray(taskState.constraints) && taskState.constraints.length > 0) {
    const validConstraints = taskState.constraints.filter((c) => typeof c === 'string' && c.trim());
    if (validConstraints.length > 0) {
      sections.push('');
      sections.push('CONSTRAINTS:');
      for (const c of validConstraints) {
        sections.push(`- ${c.trim()}`);
      }
    }
  }

  // 5. Pending Work
  if (Array.isArray(taskState.pending_work) && taskState.pending_work.length > 0) {
    const validPending = taskState.pending_work.filter((p) => typeof p === 'string' && p.trim());
    if (validPending.length > 0) {
      sections.push('');
      sections.push('PENDING WORK:');
      for (const p of validPending) {
        sections.push(`- ${p.trim()}`);
      }
    }
  }

  // 6. Relevant Files
  if (Array.isArray(taskState.relevant_files) && taskState.relevant_files.length > 0) {
    const validFiles = taskState.relevant_files.filter((f) => typeof f === 'string' && f.trim());
    if (validFiles.length > 0) {
      sections.push('');
      sections.push('RELEVANT FILES:');
      for (const f of validFiles) {
        sections.push(`- ${f.trim()}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // LAYER 3: LAST 3 COMPLETE EXCHANGES
  // ------------------------------------------------------------------
  if (exchanges.length > 0) {
    sections.push('');
    sections.push('LAST 3 EXCHANGES:');
    exchanges.forEach((ex, idx) => {
      sections.push('');
      sections.push(`[Exchange ${idx + 1}]`);
      sections.push(`User: ${(ex.user || '').trim()}`);
      sections.push(`Assistant: ${(ex.assistant || '').trim()}`);
    });
  }

  // Trailing continuation directive & placeholder
  sections.push('');
  sections.push('Continue naturally from this context.');

  return sections.join('\n');
}

module.exports = {
  isGreetingOnly,
  generateContinuationPrompt,
};
