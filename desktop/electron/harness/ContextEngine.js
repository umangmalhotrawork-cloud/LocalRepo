/**
 * NEXUS CODEX HARNESS - CONTEXT ENGINE & COMPACTION
 * Compiles provider-neutral model context from Threads, Turns, Items, Continuum state,
 * workspace metadata, active files, approved decisions, and verification facts.
 * Enforces strict budgets, tool result bounding, and lossless compaction.
 */

const {
  ITEM_TYPES,
  ITEM_STATUS,
  TURN_STATUS,
  EVENT_TYPES,
} = require('./types');
const { continuumContextBuilder } = require('../../engine/continuum_context_builder');
const secretFilter = require('../../security/secretFilter');

// Default Context Budgets (in tokens or characters)
const DEFAULT_BUDGETS = Object.freeze({
  totalBudgetTokens: 6000,        // ~24,000 chars overall ceiling
  historyBudgetTokens: 2500,      // ~10,000 chars history ceiling
  toolResultBudgetChars: 2500,    // Max characters per tool result representation
  workspaceBudgetChars: 2000,     // Max characters for workspace & file state
  systemBudgetChars: 3000,        // Max characters for system prompt & instructions
  recentItemLimit: 30,            // Max recent items retained before older compaction
});

// Bounded & Compact Context Budgets for Coding Tasks (e.g. Groq with 8000 TPM limit)
const CODING_TASK_BUDGETS = Object.freeze({
  totalBudgetTokens: 1800,        // ~7,200 chars total ceiling (avoids 429s on 8k TPM)
  historyBudgetTokens: 500,       // ~2,000 chars history ceiling
  toolResultBudgetChars: 900,     // 900 chars max per tool result representation
  workspaceBudgetChars: 350,      // 350 chars max for workspace & file state
  systemBudgetChars: 2500,        // 2500 chars max for system prompt & instructions (preserves Continuum & handoff)
  recentItemLimit: 5,             // Max 5 recent items retained before older compaction
});

class ContextEngine {
  constructor(options = {}) {
    this.eventBus = options.eventBus || null;
    this.instanceCustomBudgets = options.budgets || {};
    this.budgets = {
      ...DEFAULT_BUDGETS,
      ...(options.budgets || {}),
    };
  }

  /**
   * Fast, deterministic token estimation heuristic (4 characters ~ 1 token).
   * @param {string|Object} input
   * @returns {number} Estimated tokens
   */
  estimateTokens(input) {
    if (!input) return 0;
    if (typeof input === 'string') {
      return Math.ceil(input.length / 4);
    }
    try {
      const str = JSON.stringify(input);
      return Math.ceil(str.length / 4);
    } catch (e) {
      return 0;
    }
  }

  /**
   * Binds and bounds large tool results to prevent context overflows
   * while strictly preserving metadata for auditing and model inspection.
   * @param {Object|string} result - Raw tool result payload
   * @param {string} toolName - Name of the tool
   * @param {string} callId - Call ID
   * @param {number} [maxChars] - Optional max character budget override
   * @returns {Object} Normalized, bounded tool result representation
   */
  boundToolResult(result, toolName, callId, maxChars = null) {
    const limit = typeof maxChars === 'number' ? maxChars : this.budgets.toolResultBudgetChars;
    const sanitized = secretFilter.sanitizeObject(result !== undefined ? result : {});

    // If result is already compact
    const str = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    if (str.length <= limit) {
      return sanitized;
    }

    // Preserve core metadata
    const metadata = {
      toolName: toolName || 'unknown_tool',
      callId: callId || 'unknown_call',
      success: sanitized.success !== false,
      exitCode: sanitized.exitCode ?? (sanitized.result?.exitCode ?? null),
      path: sanitized.path || sanitized.filePath || sanitized.result?.path || null,
      lineRanges: sanitized.lineRange || sanitized.lineRanges || sanitized.result?.lineRange || null,
      isTruncated: true,
      originalLength: str.length,
      characterBudget: limit,
    };

    // Specific bounded representations by tool type
    if (toolName === 'read_file') {
      const content = sanitized.content || sanitized.result?.content || (typeof sanitized === 'string' ? sanitized : '');
      const lines = content.split('\n');
      const totalLines = lines.length;

      if (totalLines <= 35 && str.length <= limit) {
        return sanitized;
      }

      // Keep head and tail lines within character limit
      const headLines = lines.slice(0, 25).join('\n');
      const tailLines = lines.slice(-10).join('\n');
      const snippet = `${headLines}\n\n... [TRUNCATED ${Math.max(0, totalLines - 35)} lines] ...\n\n${tailLines}`;

      return {
        ...metadata,
        path: sanitized.path || sanitized.relPath,
        totalLines,
        content: secretFilter.sanitizeString(snippet),
      };
    }

    if (toolName === 'apply_patch') {
      const cs = sanitized.changeSet || sanitized.result || sanitized;
      return {
        ...metadata,
        changeSetId: cs.changeSetId || sanitized.changeSetId || 'cs_current',
        status: cs.status || sanitized.status || 'WAITING_FOR_APPROVAL',
        filesCount: cs.files?.length || cs.filesCount || (sanitized.edits?.length || 1),
        riskLevel: cs.risk?.overallRiskLevel || sanitized.riskLevel || 'AUTO_APPROVE',
        summary: sanitized.summary || `ChangeSet staged with ${cs.files?.length || 1} file edit(s).`,
      };
    }

    if (toolName === 'search_workspace') {
      const matches = sanitized.matches || sanitized.result?.matches || [];
      const totalMatches = matches.length;
      const topMatches = matches.slice(0, 8).map((m) => ({
        file: m.file || m.path,
        line: m.line || m.lineNumber,
        snippet: typeof m.content === 'string' ? m.content.trim().slice(0, 80) : undefined,
      }));

      return {
        ...metadata,
        totalMatches,
        matches: topMatches,
        notice: `Showing top ${topMatches.length} of ${totalMatches} matches`,
      };
    }

    if (toolName === 'run_command' || toolName === 'run_tests') {
      const stdout = sanitized.stdout || sanitized.result?.stdout || '';
      const stderr = sanitized.stderr || sanitized.result?.stderr || '';
      const stdoutHead = stdout.slice(0, Math.floor(limit * 0.6));
      const stderrHead = stderr.slice(0, Math.floor(limit * 0.3));

      return {
        ...metadata,
        stdout: `${stdoutHead}${stdout.length > stdoutHead.length ? `\n... [TRUNCATED stdout ${stdout.length - stdoutHead.length} chars] ...` : ''}`,
        stderr: stderrHead ? `${stderrHead}${stderr.length > stderrHead.length ? `\n... [TRUNCATED stderr ${stderr.length - stderrHead.length} chars] ...` : ''}` : undefined,
        summary: sanitized.summary || sanitized.result?.summary || null,
        passed: sanitized.passed ?? sanitized.result?.passed ?? null,
        failed: sanitized.failed ?? sanitized.result?.failed ?? null,
      };
    }

    if (toolName === 'swarm_execute') {
      const summaries = (sanitized.summaries || sanitized.result?.summaries || []).slice(0, 5);
      const findings = (sanitized.findings || sanitized.result?.findings || []).slice(0, 10);
      const changedFiles = (sanitized.changedFiles || sanitized.result?.changedFiles || []).slice(0, 10);
      const conflicts = sanitized.conflicts || sanitized.result?.conflicts || { hasConflicts: false };
      const changeSets = (sanitized.changeSets || sanitized.result?.changeSets || []).map((cs) => ({
        changeSetId: cs.changeSetId || cs.id,
        filesCount: cs.filesCount || cs.files?.length || 0,
        status: cs.status,
      }));

      return {
        ...metadata,
        swarmId: sanitized.swarmId || sanitized.result?.swarmId,
        status: sanitized.status || sanitized.result?.status,
        completedTaskCount: sanitized.completedTaskCount ?? sanitized.result?.completedTaskCount,
        failedTaskCount: sanitized.failedTaskCount ?? sanitized.result?.failedTaskCount,
        summaries,
        findings,
        changedFiles,
        changeSets,
        conflicts: conflicts.hasConflicts ? {
          hasConflicts: true,
          category: conflicts.category,
          conflictingFiles: conflicts.conflictingFiles,
        } : { hasConflicts: false },
        nextRecommendedAction: sanitized.nextRecommendedAction || sanitized.result?.nextRecommendedAction,
      };
    }

    if (toolName === 'swarm_plan') {
      return {
        ...metadata,
        swarmId: sanitized.swarmId || sanitized.result?.swarmId,
        status: sanitized.status || sanitized.result?.status,
        goal: sanitized.goal || sanitized.result?.goal,
        taskCount: sanitized.taskCount ?? sanitized.result?.taskCount,
        nextRecommendedAction: sanitized.nextRecommendedAction || sanitized.result?.nextRecommendedAction,
      };
    }

    // Generic truncation
    const head = str.slice(0, Math.floor(limit * 0.7));
    const tail = str.slice(-Math.floor(limit * 0.2));
    return {
      ...metadata,
      summary: `${head}\n... [TRUNCATED ${str.length - limit} characters] ...\n${tail}`,
    };
  }

  /**
   * Compiles an individual Turn's typed Items into provider-neutral message representations.
   * @param {Array<Object>} items - Array of Items
   * @param {Object} [options]
   * @returns {Array<Object>} Normalized message array
   */
  compileTurnItems(items = [], options = {}) {
    const messages = [];

    for (const item of items) {
      if (!item || !item.type) continue;

      const payload = item.payload || {};

      switch (item.type) {
        case ITEM_TYPES.USER_MESSAGE: {
          const text = payload.text || payload.userInput || payload.prompt || '';
          if (text) {
            messages.push({
              role: 'user',
              content: secretFilter.sanitizeString(text),
            });
          }
          break;
        }

        case ITEM_TYPES.AGENT_MESSAGE: {
          const text = payload.text || payload.summary || payload.content || '';
          if (text) {
            messages.push({
              role: 'assistant',
              content: secretFilter.sanitizeString(text),
            });
          }
          break;
        }

        case ITEM_TYPES.PLAN: {
          const planText = payload.plan || payload.text || payload.summary || '';
          if (planText) {
            messages.push({
              role: 'assistant',
              content: `[EXECUTION_PLAN]:\n${secretFilter.sanitizeString(planText)}`,
            });
          }
          break;
        }

        case ITEM_TYPES.TOOL_CALL: {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: payload.callId || item.itemId,
                type: 'function',
                function: {
                  name: payload.toolName || 'unknown_tool',
                  arguments: typeof payload.arguments === 'string' ? payload.arguments : JSON.stringify(payload.arguments || {}),
                },
              },
            ],
          });
          break;
        }

        case ITEM_TYPES.TOOL_RESULT: {
          const boundedContent = this.boundToolResult(
            payload.success ? (payload.result !== undefined ? payload.result : payload) : { error: payload.error || item.error || 'Tool failed' },
            payload.toolName,
            payload.callId,
            options.toolResultBudgetChars
          );

          messages.push({
            role: 'tool',
            tool_call_id: payload.callId || item.itemId,
            name: payload.toolName || 'tool',
            content: boundedContent,
          });
          break;
        }

        case ITEM_TYPES.FILE_CHANGE: {
          const changeSummary = `[FILE_CHANGE] ${payload.changeType || 'MODIFY'} on "${payload.filePath}" (status: ${payload.status || 'applied'})`;
          messages.push({
            role: 'system',
            content: secretFilter.sanitizeString(changeSummary),
          });
          break;
        }

        case ITEM_TYPES.CHANGE_SET: {
          const cs = payload.changeSet || payload;
          const fileCount = cs.files?.length || 0;
          const riskLevel = cs.risk?.overallRiskLevel || payload.risk?.overallRiskLevel || 'AUTO_APPROVE';
          const csSummary = `[CHANGE_SET ${payload.changeSetId || cs.changeSetId || ''}] Status: ${payload.status || cs.status || 'APPLIED'} (${fileCount} files, Risk: ${riskLevel})`;
          messages.push({
            role: 'system',
            content: secretFilter.sanitizeString(csSummary),
          });
          break;
        }

        case ITEM_TYPES.APPROVAL_REQUEST: {
          const approvalSummary = `[APPROVAL_REQUEST] Tool "${payload.toolName}" (Call ID: ${payload.callId}) status: ${item.status}`;
          messages.push({
            role: 'system',
            content: secretFilter.sanitizeString(approvalSummary),
          });
          break;
        }

        case ITEM_TYPES.SUBAGENT_DELEGATION: {
          const delText = `[SUBAGENT_DELEGATION] Delegated to [${payload.role || 'subagent'}] (Child Thread: ${payload.childThreadId}): "${payload.task || ''}" (status: ${payload.status || item.status})`;
          messages.push({
            role: 'system',
            content: secretFilter.sanitizeString(delText),
          });
          break;
        }

        case ITEM_TYPES.SUBAGENT_RESULT: {
          const resText = `[SUBAGENT_RESULT from ${payload.role || 'subagent'} (${payload.childThreadId})]: Status: ${payload.status || 'COMPLETED'}\nSummary: ${payload.summary || ''}${payload.changedFiles?.length ? `\nChanged Files: ${payload.changedFiles.join(', ')}` : ''}`;
          messages.push({
            role: 'system',
            content: secretFilter.sanitizeString(resText),
          });
          break;
        }

        case ITEM_TYPES.ERROR: {
          const errorMsg = payload.error || item.error || 'Unspecified error';
          messages.push({
            role: 'system',
            content: `[SYSTEM_ERROR in turn ${item.turnId}]: ${secretFilter.sanitizeString(errorMsg)}`,
          });
          break;
        }

        default:
          break;
      }
    }

    return messages;
  }

  /**
   * Compiles items from older completed turns into concise dialogue messages (user, plan, file-change, agent response).
   * @param {Array<Object>} items - Array of older Items
   * @param {Object} [options]
   * @returns {Array<Object>}
   */
  compileOlderTurnItems(items = [], options = {}) {
    const olderMessages = [];
    for (const item of items) {
      if (!item || !item.type) continue;
      const payload = item.payload || {};

      switch (item.type) {
        case ITEM_TYPES.USER_MESSAGE: {
          const text = payload.text || payload.userInput || payload.prompt || '';
          if (text) {
            olderMessages.push({ role: 'user', content: secretFilter.sanitizeString(text) });
          }
          break;
        }

        case ITEM_TYPES.AGENT_MESSAGE: {
          const text = payload.text || payload.summary || payload.content || '';
          if (text) {
            olderMessages.push({ role: 'assistant', content: secretFilter.sanitizeString(text) });
          }
          break;
        }

        case ITEM_TYPES.PLAN: {
          const planText = payload.plan || payload.text || payload.summary || '';
          if (planText) {
            olderMessages.push({ role: 'assistant', content: `[EXECUTION_PLAN]:\n${secretFilter.sanitizeString(planText)}` });
          }
          break;
        }

        case ITEM_TYPES.FILE_CHANGE: {
          const changeSummary = `[FILE_CHANGE] ${payload.changeType || 'MODIFY'} on "${payload.filePath}" (status: ${payload.status || 'applied'})`;
          olderMessages.push({ role: 'system', content: secretFilter.sanitizeString(changeSummary) });
          break;
        }

        case ITEM_TYPES.CHANGE_SET: {
          const cs = payload.changeSet || payload;
          const fileCount = cs.files?.length || 0;
          const riskLevel = cs.risk?.overallRiskLevel || payload.risk?.overallRiskLevel || 'AUTO_APPROVE';
          const csSummary = `[CHANGE_SET ${payload.changeSetId || cs.changeSetId || ''}] Status: ${payload.status || cs.status || 'APPLIED'} (${fileCount} files, Risk: ${riskLevel})`;
          olderMessages.push({ role: 'system', content: secretFilter.sanitizeString(csSummary) });
          break;
        }

        case ITEM_TYPES.SUBAGENT_DELEGATION: {
          olderMessages.push({
            role: 'system',
            content: secretFilter.sanitizeString(`[SUBAGENT_DELEGATION] [${payload.role || 'subagent'}]: "${payload.task || ''}"`),
          });
          break;
        }

        case ITEM_TYPES.SUBAGENT_RESULT: {
          olderMessages.push({
            role: 'system',
            content: secretFilter.sanitizeString(`[SUBAGENT_RESULT from ${payload.role || 'subagent'}]: "${(payload.summary || '').slice(0, 150)}"`),
          });
          break;
        }

        default:
          break;
      }
    }
    return olderMessages;
  }


  compileContext(params = {}) {
    return this.buildContext(params);
  }

  /**
   * Compiles complete provider-neutral model context with budgeting & compaction.
   * @param {Object} params
   * @param {Object} [params.thread] - Active Thread
   * @param {Object} [params.turn] - Current Turn
   * @param {Array<Object>} [params.turns] - All thread turns (ordered chronological)
   * @param {Array<Object>} [params.items] - All thread items (ordered chronological)
   * @param {Object} [params.continuumSnapshot] - Continuum snapshot
   * @param {Object} [params.handoffState] - Active HandoffState object or payload
   * @param {string} [params.workspacePath] - Active workspace root
   * @param {string} [params.activeFilePath] - Active editor file path
   * @param {string} [params.intent] - 'READ_ONLY' | 'MUTATION' | 'GENERAL_CHAT'
   * @param {Array<Object>} [params.decisions] - Approved engineering decisions
   * @param {Object} [params.verification] - Verification status & test outcome
   * @param {Object} [params.options] - Custom budgets or parameters
   * @returns {Object} { systemPrompt, messages, metadata }
   */
  buildContext(params = {}) {
    const {
      thread = null,
      turn = null,
      turns = [],
      items = [],
      continuumSnapshot = null,
      continuumContextText = null,
      continuumActive = false,
      handoffState = null,
      workspacePath = process.cwd(),
      activeFilePath = null,
      selectionText = null,
      selectionStartLine = null,
      selectionStartColumn = null,
      selectionEndLine = null,
      selectionEndColumn = null,
      cursorLine = null,
      cursorColumn = null,
      gitBranch = null,
      diagnostic = null,
      intent = 'MUTATION',
      decisions = [],
      verification = null,
      resolvedSkills = [],
      capabilities = [],
      options = {},
    } = params;

    const isCodingTask = intent === 'MUTATION' || intent === 'READ_ONLY' || options.isCodingTask !== false;
    const baseBudget = isCodingTask ? CODING_TASK_BUDGETS : DEFAULT_BUDGETS;
    const budgets = {
      ...baseBudget,
      ...(this.instanceCustomBudgets || {}),
      ...(options.budgets || {}),
    };

    const sections = {};
    const truncatedSections = [];
    let omittedItems = 0;
    let compactionApplied = false;
    let compactedTurnsCount = 0;

    // 1. Continuum Layer (Synthesized handoff from previous chat context)
    let continuumText = '';
    const isContinuumOn = continuumActive === true;

    if (isContinuumOn) {
      if (continuumContextText && typeof continuumContextText === 'string' && continuumContextText.trim()) {
        continuumText = continuumContextText.trim();
      } else if (continuumSnapshot) {
        try {
          const built = continuumContextBuilder.buildSynthesizedHandoffPrompt
            ? continuumContextBuilder.buildSynthesizedHandoffPrompt(continuumSnapshot)
            : continuumContextBuilder.buildContext(continuumSnapshot);
          if (built && (built.handoffText || built.contextText)) {
            continuumText = built.handoffText || built.contextText;
          }
        } catch (e) {}
      }
    }
    sections.continuumTokens = this.estimateTokens(continuumText);
    sections.continuumHandoffPresent = Boolean(continuumText);

    // 2. Active Handoff Context (Milestone 7 Durable Handoff)
    let handoffText = '';
    const activeHandoff = handoffState || turn?.metadata?.handoffState || thread?.metadata?.handoffState;
    if (activeHandoff) {
      if (typeof activeHandoff.toContextPrompt === 'function') {
        handoffText = activeHandoff.toContextPrompt();
      } else if (typeof activeHandoff === 'object') {
        const lines = [
          '## ACTIVE HANDOFF',
          `- Task Goal: ${activeHandoff.taskGoal || activeHandoff.goal || ''}`,
          activeHandoff.codingIntent ? `- Operational Intent: ${activeHandoff.codingIntent}` : null,
          activeHandoff.activeFilePath ? `- Active File: ${activeHandoff.activeFilePath}` : null,
        ].filter(Boolean);

        const completed = activeHandoff.completedObjectives || activeHandoff.completed || [];
        if (Array.isArray(completed) && completed.length > 0) {
          lines.push('- Completed Objectives:');
          for (const c of completed) lines.push(`  * [COMPLETED] ${c}`);
        }

        const pending = activeHandoff.pendingObjectives || activeHandoff.pending || [];
        if (Array.isArray(pending) && pending.length > 0) {
          lines.push('- Pending Objectives:');
          for (const p of pending) lines.push(`  * [PENDING] ${p}`);
        }

        const constraints = activeHandoff.continuationConstraints || activeHandoff.constraints || [];
        if (Array.isArray(constraints) && constraints.length > 0) {
          lines.push('- Continuation Constraints:');
          for (const c of constraints) lines.push(`  * [CONSTRAINT] ${c}`);
        }

        const decisionsList = activeHandoff.importantDecisions || activeHandoff.decisions || [];
        if (Array.isArray(decisionsList) && decisionsList.length > 0) {
          lines.push('- Key Engineering Decisions:');
          for (const d of decisionsList) {
            const text = typeof d === 'string' ? d : (d.decision || d.statement || JSON.stringify(d));
            lines.push(`  * [DECISION] ${text}`);
          }
        }

        const vState = activeHandoff.verificationState || activeHandoff.verification;
        if (vState && vState.testStatus) {
          lines.push(`- Verification State: ${vState.testStatus}${vState.failingTests?.length ? ` (Failing: ${vState.failingTests.join(', ')})` : ''}`);
        }

        const nextAct = activeHandoff.nextRecommendedAction || activeHandoff.nextAction || pending[0];
        if (nextAct) {
          lines.push(`- Immediate Next Action: ${nextAct}`);
        }

        handoffText = lines.join('\n');
      }
    }
    sections.handoffTokens = this.estimateTokens(handoffText);

    // 2b. Active Editor Context & Selection Bridge (Milestone 24)
    let editorContextText = '';
    const resolvedSelectionText = selectionText || turn?.metadata?.selectionText || null;
    const resolvedSelectionStartLine = selectionStartLine ?? turn?.metadata?.selectionStartLine ?? null;
    const resolvedSelectionEndLine = selectionEndLine ?? turn?.metadata?.selectionEndLine ?? null;
    const resolvedSelectionStartCol = selectionStartColumn ?? turn?.metadata?.selectionStartColumn ?? null;
    const resolvedSelectionEndCol = selectionEndColumn ?? turn?.metadata?.selectionEndColumn ?? null;
    const resolvedCursorLine = cursorLine ?? turn?.metadata?.cursorLine ?? null;
    const resolvedCursorCol = cursorColumn ?? turn?.metadata?.cursorColumn ?? null;

    if (activeFilePath || resolvedCursorLine !== null || resolvedSelectionText) {
      const editorLines = ['## ACTIVE EDITOR CONTEXT'];
      if (activeFilePath) {
        editorLines.push(`- Active File: ${activeFilePath}`);
      }
      if (resolvedCursorLine !== null) {
        const colPart = resolvedCursorCol !== null ? `, column ${resolvedCursorCol}` : '';
        editorLines.push(`- Cursor: line ${resolvedCursorLine}${colPart}`);
      }
      if (resolvedSelectionText && typeof resolvedSelectionText === 'string' && resolvedSelectionText.trim().length > 0) {
        let rangeLabel = 'selected code';
        if (resolvedSelectionStartLine !== null && resolvedSelectionEndLine !== null) {
          rangeLabel = resolvedSelectionStartLine === resolvedSelectionEndLine
            ? `line ${resolvedSelectionStartLine}`
            : `lines ${resolvedSelectionStartLine}–${resolvedSelectionEndLine}`;
        }
        let boundedSelection = secretFilter.sanitizeString(resolvedSelectionText.trim());
        if (boundedSelection.length > 1500) {
          boundedSelection = boundedSelection.slice(0, 1500) + '\n... [TRUNCATED]';
          truncatedSections.push('selection');
        }
        editorLines.push(`- Selection (${rangeLabel}):\n\`\`\`\n${boundedSelection}\n\`\`\``);
      }
      editorContextText = editorLines.join('\n');
    }
    sections.editorContextTokens = this.estimateTokens(editorContextText);

    // 2c. Active Git Context (Milestone 24)
    let gitContextText = '';
    const resolvedGitBranch = gitBranch || turn?.metadata?.gitBranch || null;
    if (resolvedGitBranch && typeof resolvedGitBranch === 'string' && resolvedGitBranch.trim().length > 0) {
      const cleanBranch = secretFilter.sanitizeString(resolvedGitBranch.trim());
      if (cleanBranch) {
        gitContextText = `## CURRENT GIT CONTEXT\n- Active Branch: ${cleanBranch}`;
      }
    }
    sections.gitContextTokens = this.estimateTokens(gitContextText);

    // 2d. Active Debugging Context (Milestone 25)
    let debuggingContextText = '';
    const resolvedDiagnostic = diagnostic || turn?.metadata?.diagnostic || null;
    if (resolvedDiagnostic && typeof resolvedDiagnostic === 'object') {
      const debugLines = ['## CURRENT DEBUGGING CONTEXT'];
      if (resolvedDiagnostic.command) {
        debugLines.push(`Command:\n${resolvedDiagnostic.command}`);
      }
      if (resolvedDiagnostic.exitCode !== undefined && resolvedDiagnostic.exitCode !== null) {
        debugLines.push(`Exit Code:\n${resolvedDiagnostic.exitCode}`);
      }
      if (resolvedDiagnostic.filePath) {
        debugLines.push(`File:\n${resolvedDiagnostic.filePath}`);
      }
      if (resolvedDiagnostic.line) {
        const colStr = resolvedDiagnostic.column ? `:${resolvedDiagnostic.column}` : '';
        debugLines.push(`Line:\n${resolvedDiagnostic.line}${colStr}`);
      }
      const errSummary = resolvedDiagnostic.summary || resolvedDiagnostic.error || resolvedDiagnostic.message || resolvedDiagnostic.friendlyExplanation;
      if (errSummary) {
        debugLines.push(`Error:\n${secretFilter.sanitizeString(errSummary)}`);
      }
      const rawTrace = resolvedDiagnostic.stackTrace || resolvedDiagnostic.traceback || resolvedDiagnostic.stderr;
      if (rawTrace && typeof rawTrace === 'string' && rawTrace.trim().length > 0) {
        let boundedTrace = secretFilter.sanitizeString(rawTrace.trim());
        if (boundedTrace.length > 2000) {
          boundedTrace = boundedTrace.slice(0, 2000) + '\n... [TRUNCATED]';
          truncatedSections.push('diagnosticTrace');
        }
        debugLines.push(`Trace:\n\`\`\`\n${boundedTrace}\n\`\`\``);
      }
      debuggingContextText = debugLines.join('\n\n');
    }
    sections.debuggingTokens = this.estimateTokens(debuggingContextText);

    // 2e. Active Debug Session Context (Milestone 34)
    let debugSessionText = '';
    const resolvedDebugSession = params.activeDebugSession || params.debugSession || options.activeDebugSession || options.debugSession || turn?.metadata?.activeDebugSession || null;
    if (resolvedDebugSession && typeof resolvedDebugSession === 'object') {
      const dLines = ['## ACTIVE DEBUG SESSION'];
      if (resolvedDebugSession.runtime) {
        dLines.push(`- Runtime: ${resolvedDebugSession.runtime}`);
      }
      if (resolvedDebugSession.status) {
        dLines.push(`- Status: ${resolvedDebugSession.status}`);
      }
      if (resolvedDebugSession.currentFile) {
        dLines.push(`- Current File: ${resolvedDebugSession.currentFile}`);
      }
      if (resolvedDebugSession.currentLine !== null && resolvedDebugSession.currentLine !== undefined) {
        dLines.push(`- Current Line: ${resolvedDebugSession.currentLine}`);
      }
      if (Array.isArray(resolvedDebugSession.callStack) && resolvedDebugSession.callStack.length > 0) {
        dLines.push('- Call Stack:');
        for (const frame of resolvedDebugSession.callStack.slice(0, 5)) {
          const loc = frame.file ? `${frame.file}:${frame.line || 1}` : `line ${frame.line || 1}`;
          dLines.push(`  - #${frame.order || 0} ${frame.name || '<anonymous>'} (${loc})`);
        }
      }
      if (resolvedDebugSession.variables && typeof resolvedDebugSession.variables === 'object') {
        const varEntries = Object.entries(resolvedDebugSession.variables).slice(0, 10);
        if (varEntries.length > 0) {
          dLines.push('- Variables:');
          for (const [k, v] of varEntries) {
            const valStr = typeof v === 'object' && v !== null ? (v.value || JSON.stringify(v)) : String(v);
            const safeVal = secretFilter.sanitizeString(String(valStr));
            dLines.push(`  - ${k}: ${safeVal.slice(0, 100)}`);
          }
        }
      }
      if (resolvedDebugSession.exception) {
        const exMsg = typeof resolvedDebugSession.exception === 'string'
          ? resolvedDebugSession.exception
          : resolvedDebugSession.exception.message || 'Exception occurred';
        dLines.push(`- Exception: ${secretFilter.sanitizeString(exMsg)}`);
      }
      debugSessionText = dLines.join('\n');
    }
    sections.debugSessionTokens = this.estimateTokens(debugSessionText);

    // 3. Workspace & Code State Context
    const activeGroup = params.activeGroupId || options.activeGroupId || null;
    const activeSymbol = params.activeSymbolName || params.symbolName || options.activeSymbolName || null;
    const rawBreadcrumbs = params.breadcrumbs || options.breadcrumbs || null;
    let breadcrumbStr = null;
    if (rawBreadcrumbs) {
      breadcrumbStr = Array.isArray(rawBreadcrumbs)
        ? rawBreadcrumbs.map((b) => (typeof b === 'string' ? b : b.label || b.name)).filter(Boolean).join(' > ')
        : String(rawBreadcrumbs);
    }

    const workspaceLines = [
      `Workspace Root: "${workspacePath || process.cwd()}"`,
      activeFilePath ? `Active Editor File: "${activeFilePath}"` : null,
      activeGroup ? `Active Editor Group: "${activeGroup}"` : null,
      activeSymbol ? `Enclosing Symbol: "${activeSymbol}"` : null,
      breadcrumbStr ? `Breadcrumbs: ${breadcrumbStr}` : null,
      cursorLine ? `Cursor Position: Line ${cursorLine}${cursorColumn ? ', Col ' + cursorColumn : ''}` : null,
      selectionText ? `Active Selection:\n\`\`\`\n${selectionText.slice(0, 300)}\n\`\`\`` : null,
      `Operational Intent: ${intent}`,
    ].filter(Boolean);

    // Add recent modified files if present in items
    const fileChangeItems = items.filter((i) => i.type === ITEM_TYPES.FILE_CHANGE);
    if (fileChangeItems.length > 0) {
      const modifiedFiles = Array.from(new Set(fileChangeItems.map((i) => i.payload?.filePath).filter(Boolean)));
      if (modifiedFiles.length > 0) {
        workspaceLines.push(`Modified Files in Session: ${modifiedFiles.join(', ')}`);
      }
    }

    let workspaceText = workspaceLines.join('\n');
    if (workspaceText.length > budgets.workspaceBudgetChars) {
      workspaceText = workspaceText.slice(0, budgets.workspaceBudgetChars - 50) + '\n... [TRUNCATED]';
      truncatedSections.push('workspace');
    }
    sections.workspaceTokens = this.estimateTokens(workspaceText);

    // 4. Approved Engineering Decisions (Within current thread session; previous session decisions only enter when Continuum is ON)
    let decisionsText = '';
    const allDecisions = Array.isArray(decisions) ? [...decisions] : [];
    if (isContinuumOn) {
      if (Array.isArray(continuumSnapshot?.decisions)) {
        allDecisions.push(...continuumSnapshot.decisions);
      }
      if (Array.isArray(continuumSnapshot?.metadata?.harness?.handoffState?.importantDecisions)) {
        allDecisions.push(...continuumSnapshot.metadata.harness.handoffState.importantDecisions);
      }
      if (Array.isArray(thread?.metadata?.handoffState?.importantDecisions)) {
        allDecisions.push(...thread.metadata.handoffState.importantDecisions);
      }
    }
    if (Array.isArray(thread?.metadata?.decisions)) {
      allDecisions.push(...thread.metadata.decisions);
    }
    if (allDecisions.length > 0) {
      const uniqueDecisions = Array.from(new Set(allDecisions.map((d) => {
        if (typeof d === 'string') return d;
        const text = d.decision || d.statement || d.text || '';
        const rationale = d.rationale ? ` (Rationale: ${d.rationale})` : '';
        return `[${d.userApproved !== false ? 'APPROVED' : 'PENDING'}] ${text}${rationale}`;
      }).filter(Boolean)));
      decisionsText = `## APPROVED ENGINEERING DECISIONS\n${uniqueDecisions.join('\n')}`;
    }
    sections.decisionsTokens = this.estimateTokens(decisionsText);

    // 5. Verification State
    let verificationText = '';
    if (verification) {
      const vLines = [
        `## VERIFICATION & SAFETY STATE`,
        `- Last Test Status: ${verification.testStatus || verification.lastTestStatus || 'NOT_RUN'}`,
        verification.failingTests?.length ? `- Failing Tests: ${verification.failingTests.join(', ')}` : null,
        verification.firewallStatus ? `- Firewall Status: ${verification.firewallStatus}` : null,
        verification.verificationLevel ? `- Verification Level: ${verification.verificationLevel}` : null,
      ].filter(Boolean);
      verificationText = vLines.join('\n');
    }
    sections.verificationTokens = this.estimateTokens(verificationText);

    // 5b. Active Problems Context (Milestone 31)
    let problemsText = '';
    const resolvedProblems = Array.isArray(params.activeProblems || params.problems || options.activeProblems || options.problems)
      ? (params.activeProblems || params.problems || options.activeProblems || options.problems)
      : [];

    if (resolvedProblems.length > 0) {
      const relevant = activeFilePath
        ? resolvedProblems.filter((p) => p.filePath === activeFilePath || p.filePath?.endsWith(activeFilePath) || activeFilePath.endsWith(p.filePath))
        : resolvedProblems;
      const candidates = relevant.length > 0 ? relevant : resolvedProblems;
      const topProblems = candidates.slice(0, 5);

      const pLines = ['## ACTIVE PROBLEMS'];
      for (const p of topProblems) {
        const sev = (p.severity || 'error').toUpperCase();
        const src = p.source ? ` (${p.source}${p.code ? ' ' + p.code : ''})` : '';
        const loc = p.filePath ? `${p.filePath}${p.line ? ':' + p.line : ''}` : 'workspace';
        pLines.push(`- [${sev}]${src} ${loc}: ${secretFilter.sanitizeString(p.message || 'Error')}`);
      }
      problemsText = pLines.join('\n');
      if (problemsText.length > 600) {
        problemsText = problemsText.slice(0, 550) + '\n... [TRUNCATED]';
        truncatedSections.push('problems');
      }
    }
    sections.problemsTokens = this.estimateTokens(problemsText);

    // 5c. Active Git Hunk Context (Milestone 33)
    let gitHunkText = '';
    const resolvedHunk = params.activeGitHunk || options.activeGitHunk || turn?.metadata?.activeGitHunk || null;
    if (resolvedHunk && typeof resolvedHunk === 'object') {
      const hunkLines = ['## ACTIVE GIT HUNK'];
      if (resolvedHunk.filePath) {
        hunkLines.push(`- File: ${resolvedHunk.filePath}`);
      }
      if (resolvedHunk.hunkId || (resolvedHunk.startLine !== undefined && resolvedHunk.endLine !== undefined)) {
        const idPart = resolvedHunk.hunkId ? `${resolvedHunk.hunkId} ` : '';
        const rangePart = resolvedHunk.startLine !== undefined ? `(Lines ${resolvedHunk.startLine}–${resolvedHunk.endLine})` : '';
        hunkLines.push(`- Hunk: ${idPart}${rangePart}`.trim());
      }
      if (resolvedHunk.changeType) {
        hunkLines.push(`- Change Type: ${resolvedHunk.changeType}`);
      }
      if (Array.isArray(resolvedHunk.oldLines) && resolvedHunk.oldLines.length > 0) {
        const oldContent = secretFilter.sanitizeString(resolvedHunk.oldLines.slice(0, 20).join('\n'));
        hunkLines.push(`- Original (HEAD):\n\`\`\`\n${oldContent}\n\`\`\``);
      }
      if (Array.isArray(resolvedHunk.newLines) && resolvedHunk.newLines.length > 0) {
        const newContent = secretFilter.sanitizeString(resolvedHunk.newLines.slice(0, 20).join('\n'));
        hunkLines.push(`- Current:\n\`\`\`\n${newContent}\n\`\`\``);
      }
      gitHunkText = hunkLines.join('\n');
    }
    sections.gitHunkTokens = this.estimateTokens(gitHunkText);

    // 6. Active Skills & Engineering Guidance (Milestone 12)
    let skillsText = '';
    const activeSkills = Array.isArray(resolvedSkills) && resolvedSkills.length > 0 ? resolvedSkills : (options.skills || []);
    if (activeSkills.length > 0) {
      const sLines = ['## ACTIVE SKILLS & GUIDANCE'];
      for (const skill of activeSkills) {
        sLines.push(`### Skill: ${skill.name} (v${skill.version || '1.0.0'})`);
        if (skill.instructions) sLines.push(skill.instructions);
        if (Array.isArray(skill.constraints) && skill.constraints.length > 0) {
          sLines.push(`Constraints: ${skill.constraints.join('; ')}`);
        }
      }
      skillsText = sLines.join('\n');
    }
    sections.skillsTokens = this.estimateTokens(skillsText);

    // 7. Compact Available Capabilities (Milestone 12)
    let capabilitiesText = '';
    const availableCaps = Array.isArray(capabilities) && capabilities.length > 0 ? capabilities : (options.capabilities || []);
    if (availableCaps.length > 0) {
      const cLines = ['## AVAILABLE CAPABILITIES'];
      for (const cap of availableCaps) {
        cLines.push(`- \`${cap.name}\` (${cap.source || 'nexus'}): ${cap.description || ''}`);
      }
      capabilitiesText = cLines.join('\n');
    }
    sections.capabilitiesTokens = this.estimateTokens(capabilitiesText);

    // 7b. Project Capabilities (Milestone 13)
    let projectCapabilitiesText = '';
    const projectCaps = params.projectCapabilities || options.projectCapabilities || null;
    if (projectCaps && typeof projectCaps === 'object') {
      const pLines = ['## PROJECT CAPABILITIES'];
      if (Array.isArray(projectCaps.mcpServers) && projectCaps.mcpServers.length > 0) {
        const serverNames = projectCaps.mcpServers.map((s) => (typeof s === 'string' ? s : s.name || s.serverId)).filter(Boolean);
        if (serverNames.length > 0) {
          pLines.push(`- Enabled MCP Servers: ${serverNames.join(', ')}`);
        }
      }
      if (Array.isArray(projectCaps.skills) && projectCaps.skills.length > 0) {
        const skillNames = projectCaps.skills.map((s) => (typeof s === 'string' ? s : s.name || s.skillId)).filter(Boolean);
        if (skillNames.length > 0) {
          pLines.push(`- Available Project Skills: ${skillNames.join(', ')}`);
        }
      }
      if (Array.isArray(projectCaps.restrictions) && projectCaps.restrictions.length > 0) {
        pLines.push(`- Capability Restrictions: ${projectCaps.restrictions.join('; ')}`);
      }
      if (pLines.length > 1) {
        projectCapabilitiesText = pLines.join('\n');
      }
    }
    sections.projectCapabilitiesTokens = this.estimateTokens(projectCapabilitiesText);

    // 8. Build Base System Prompt (Concise & Focused)
    const baseInstruction = 'You are NEXUS, an autonomous software engineering pair programmer. Analyze directives and use tools iteratively to inspect files, search code, apply verified surgical patches, and run unit tests.';

    const systemPromptComponents = [
      baseInstruction,
      // Only include capabilities text if native tools schema is not being supplied
      (!capabilities || capabilities.length === 0) && capabilitiesText ? `\n--- PERMITTED CAPABILITIES ---\n${capabilitiesText}` : null,
      skillsText ? `\n--- ACTIVE SKILLS ---\n${skillsText}` : null,
      handoffText ? `\n--- ACTIVE TASK HANDOFF ---\n${handoffText}` : null,
      editorContextText ? `\n--- ACTIVE EDITOR CONTEXT ---\n${editorContextText}` : null,
      gitHunkText ? `\n--- ACTIVE GIT HUNK ---\n${gitHunkText}` : null,
      gitContextText ? `\n--- CURRENT GIT CONTEXT ---\n${gitContextText}` : null,
      debuggingContextText ? `\n--- CURRENT DEBUGGING CONTEXT ---\n${debuggingContextText}` : null,
      problemsText ? `\n--- ACTIVE PROBLEMS ---\n${problemsText}` : null,
      continuumText ? `\n--- CONTINUUM REPOSITORY CONTEXT ---\n${continuumText}` : null,
      workspaceText ? `\n--- WORKSPACE & TARGET STATE ---\n${workspaceText}` : null,
      decisionsText ? `\n--- ENGINEERING DECISIONS ---\n${decisionsText}` : null,
      verificationText ? `\n--- VERIFICATION STATE ---\n${verificationText}` : null,
    ].filter(Boolean);

    let systemPrompt = systemPromptComponents.join('\n\n');
    if (systemPrompt.length > budgets.systemBudgetChars) {
      systemPrompt = secretFilter.sanitizeString(systemPrompt.slice(0, budgets.systemBudgetChars - 50) + '\n... [System Context Truncated]');
      truncatedSections.push('systemPrompt');
    } else {
      systemPrompt = secretFilter.sanitizeString(systemPrompt);
    }
    sections.systemPromptTokens = this.estimateTokens(systemPrompt);


    // 6. Separate Older Turns from Current Turn
    const currentTurnId = turn?.turnId;
    const olderTurns = turns.filter((t) => t.turnId !== currentTurnId);
    const currentTurnItems = items.filter((i) => i.turnId === currentTurnId);
    const olderTurnItems = items.filter((i) => i.turnId !== currentTurnId);

    // Build raw messages for current turn (includes all active tool calls and results)
    let currentTurnMessages = this.compileTurnItemMessages(currentTurnItems, {
      toolResultBudgetChars: budgets.toolResultBudgetChars,
    });

    // If current turn has user prompt but no item yet, ensure user message is present
    if (turn?.userInput && !currentTurnMessages.some((m) => m.role === 'user')) {
      currentTurnMessages.unshift({
        role: 'user',
        content: secretFilter.sanitizeString(turn.userInput),
      });
    }

    sections.currentTurnTokens = this.estimateTokens(currentTurnMessages);

    // Build raw messages for older history (focused conversational turns)
    let olderTurnMessages = this.compileOlderTurnItems(olderTurnItems, {
      toolResultBudgetChars: budgets.toolResultBudgetChars,
    });
    sections.historyTokens = this.estimateTokens(olderTurnMessages);

    // 7. Check if Compaction is Required
    const totalTokensBefore = sections.systemPromptTokens + sections.currentTurnTokens + sections.historyTokens;
    const compactionRequired = totalTokensBefore > budgets.totalBudgetTokens || sections.historyTokens > budgets.historyBudgetTokens;

    let finalMessages = [];

    if (compactionRequired && olderTurns.length > 0) {
      compactionApplied = true;
      compactedTurnsCount = olderTurns.length;
      omittedItems = olderTurnItems.length;

      // Notify Compaction Started
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit(EVENT_TYPES.CONTEXT_COMPACTION_STARTED, {
          threadId: thread?.threadId || turn?.threadId || null,
          turnId: currentTurnId || null,
          payload: {
            beforeTokens: totalTokensBefore,
            budgetLimit: budgets.totalBudgetTokens,
            compactedTurns: olderTurns.length,
            reason: 'Context exceeded configured budget ceiling',
          },
        });
      }

      // Compact older history into high-density structured summary
      const compactedHistorySummary = this.generateHistorySummary(olderTurns, olderTurnItems);

      // Preserved recent items count
      const preservedRecentOlder = olderTurnMessages.slice(-budgets.recentItemLimit);
      omittedItems = Math.max(0, olderTurnItems.length - preservedRecentOlder.length);

      finalMessages = [
        {
          role: 'system',
          content: secretFilter.sanitizeString(compactedHistorySummary),
        },
        ...preservedRecentOlder,
        ...currentTurnMessages,
      ];

      // Update history tokens after compaction
      sections.historyTokens = this.estimateTokens(compactedHistorySummary) + this.estimateTokens(preservedRecentOlder);
      const totalTokensAfter = sections.systemPromptTokens + sections.currentTurnTokens + sections.historyTokens;

      // Notify Compaction Completed
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit(EVENT_TYPES.CONTEXT_COMPACTION_COMPLETED, {
          threadId: thread?.threadId || turn?.threadId || null,
          turnId: currentTurnId || null,
          payload: {
            beforeTokens: totalTokensBefore,
            afterTokens: totalTokensAfter,
            retainedSections: ['systemPrompt', 'handoff', 'continuum', 'workspace', 'decisions', 'verification', 'currentTurn'],
            summarizedSections: ['olderTurnsHistory'],
            omittedItems,
            compactedTurnsCount,
          },
        });
      }
    } else {
      // No compaction needed
      finalMessages = [
        ...olderTurnMessages,
        ...currentTurnMessages,
      ];
    }

    const totalEstimatedTokens = sections.systemPromptTokens + this.estimateTokens(finalMessages);

    return {
      systemPrompt,
      messages: finalMessages,
      metadata: {
        totalEstimatedTokens,
        sections,
        truncatedSections,
        omittedItems,
        compactionRequired,
        compactionApplied,
        compactedTurnsCount,
      },
    };
  }

  /**
   * Helper: Generates a compact structured summary of older turns without losing key facts.
   * @param {Array<Object>} olderTurns
   * @param {Array<Object>} olderItems
   * @returns {string} Compact history text
   */
  generateHistorySummary(olderTurns = [], olderItems = []) {
    const lines = [
      `## PREVIOUS CONVERSATION & ACTIONS SUMMARY (${olderTurns.length} turns compacted)`,
    ];

    for (const turn of olderTurns) {
      const turnItems = olderItems.filter((i) => i.turnId === turn.turnId);
      const agentMsg = turnItems.find((i) => i.type === ITEM_TYPES.AGENT_MESSAGE);
      const toolCalls = turnItems.filter((i) => i.type === ITEM_TYPES.TOOL_CALL);
      const fileChanges = turnItems.filter((i) => i.type === ITEM_TYPES.FILE_CHANGE);
      const changeSets = turnItems.filter((i) => i.type === ITEM_TYPES.CHANGE_SET);
      const testResults = turnItems.filter((i) => i.type === ITEM_TYPES.TOOL_RESULT && i.payload?.toolName === 'run_tests');

      const toolsUsed = toolCalls.map((tc) => tc.payload?.toolName).filter(Boolean);
      const changedFiles = fileChanges.map((fc) => fc.payload?.filePath).filter(Boolean);

      for (const cs of changeSets) {
        const csFiles = cs.payload?.files || cs.payload?.changeSet?.files || [];
        for (const f of csFiles) {
          if (f.filePath) changedFiles.push(f.filePath);
        }
      }

      let turnSummary = `- Turn [${turn.turnId}] (${turn.status}): User asked "${turn.userInput || 'directive'}"`;
      if (toolsUsed.length > 0) {
        turnSummary += ` -> Used tools: [${Array.from(new Set(toolsUsed)).join(', ')}]`;
      }
      if (changedFiles.length > 0) {
        turnSummary += ` -> Modified: [${Array.from(new Set(changedFiles)).join(', ')}]`;
      }
      const subagentResults = turnItems.filter((i) => i.type === ITEM_TYPES.SUBAGENT_RESULT);
      if (subagentResults.length > 0) {
        const roles = subagentResults.map((sr) => sr.payload?.role).filter(Boolean);
        turnSummary += ` -> Subagents: [${Array.from(new Set(roles)).join(', ')}]`;
      }
      if (agentMsg?.payload?.summary || agentMsg?.payload?.text) {
        const summaryText = (agentMsg.payload.summary || agentMsg.payload.text).slice(0, 120);
        turnSummary += ` -> Outcome: "${summaryText}"`;
      }

      lines.push(turnSummary);
    }


    return lines.join('\n');
  }


  /**
   * Internal helper: Maps raw turn items into message objects.
   * @param {Array<Object>} items
   * @param {Object} options
   * @returns {Array<Object>}
   */
  compileTurnItemMessages(items = [], options = {}) {
    return this.compileTurnItems(items, options);
  }
}

const contextEngine = new ContextEngine();

module.exports = {
  ContextEngine,
  contextEngine,
  DEFAULT_BUDGETS,
};
