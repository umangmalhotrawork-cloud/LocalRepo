/**
 * NEXUS CODEX HARNESS - DURABLE HANDOFF STATE (Milestone 7)
 * Captures the minimum sufficient state necessary for a subsequent Turn, worker,
 * or resumed session to safely continue work without replaying entire conversation history.
 */

const path = require('path');
const {
  HANDOFF_STATUS,
  EVENT_TYPES,
  generateHandoffId,
} = require('./types');
const secretFilter = require('../../security/secretFilter');

class HandoffState {
  /**
   * @param {Object} payload
   */
  constructor(payload = {}) {
    HandoffState.validatePayload(payload);

    const now = Date.now();
    this.handoffId = payload.handoffId || generateHandoffId();
    this.threadId = payload.threadId;
    this.sourceTurnId = payload.sourceTurnId;
    this.createdAt = payload.createdAt || now;
    this.status = payload.status || HANDOFF_STATUS.ACTIVE;

    this.taskGoal = secretFilter.sanitizeString(payload.taskGoal || '');
    this.codingIntent = payload.codingIntent || 'MUTATION';
    this.workspacePath = path.resolve(payload.workspacePath || process.cwd());
    this.activeFilePath = payload.activeFilePath ? path.normalize(payload.activeFilePath) : null;

    this.completedObjectives = Array.isArray(payload.completedObjectives)
      ? payload.completedObjectives.map((o) => secretFilter.sanitizeString(String(o)))
      : [];

    this.pendingObjectives = Array.isArray(payload.pendingObjectives)
      ? payload.pendingObjectives.map((o) => secretFilter.sanitizeString(String(o)))
      : [];

    this.changedFiles = Array.isArray(payload.changedFiles)
      ? payload.changedFiles.map((f) => typeof f === 'string' ? secretFilter.sanitizeString(f) : secretFilter.sanitizeObject(f))
      : [];

    this.unresolvedIssues = Array.isArray(payload.unresolvedIssues)
      ? payload.unresolvedIssues.map((i) => secretFilter.sanitizeString(String(i)))
      : [];

    this.verificationState = secretFilter.sanitizeObject(payload.verificationState || {
      testStatus: 'NOT_RUN',
      failingTests: [],
      verified: false,
    });

    this.safetyState = secretFilter.sanitizeObject(payload.safetyState || {
      overallRiskLevel: 'AUTO_APPROVE',
      riskScore: 0,
      safeToAutoApply: true,
    });

    this.importantDecisions = Array.isArray(payload.importantDecisions)
      ? payload.importantDecisions.map((d) => typeof d === 'string' ? secretFilter.sanitizeString(d) : secretFilter.sanitizeObject(d))
      : [];

    this.relevantToolObservations = Array.isArray(payload.relevantToolObservations)
      ? payload.relevantToolObservations.map((o) => secretFilter.sanitizeString(String(o)))
      : [];

    this.nextRecommendedAction = secretFilter.sanitizeString(payload.nextRecommendedAction || (this.pendingObjectives[0] || 'Continue task'));

    this.continuationConstraints = Array.isArray(payload.continuationConstraints)
      ? payload.continuationConstraints.map((c) => secretFilter.sanitizeString(String(c)))
      : [];

    this.metadata = secretFilter.sanitizeObject(payload.metadata || {});
  }

  /**
   * Validates that payload satisfies required structural invariants.
   * @param {Object} payload
   */
  static validatePayload(payload = {}) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[HANDOFF-STATE] Handoff payload must be a non-null object');
    }

    if (!payload.threadId || typeof payload.threadId !== 'string' || !payload.threadId.trim()) {
      throw new Error('[HANDOFF-STATE] Missing required field "threadId"');
    }

    if (!payload.sourceTurnId || typeof payload.sourceTurnId !== 'string' || !payload.sourceTurnId.trim()) {
      throw new Error('[HANDOFF-STATE] Missing required field "sourceTurnId"');
    }

    if (payload.taskGoal === undefined || payload.taskGoal === null || typeof payload.taskGoal !== 'string' || !payload.taskGoal.trim()) {
      throw new Error('[HANDOFF-STATE] Missing required field "taskGoal"');
    }

    if (payload.workspacePath !== undefined && (typeof payload.workspacePath !== 'string' || !payload.workspacePath.trim())) {
      throw new Error('[HANDOFF-STATE] Field "workspacePath" must be a non-empty string when provided');
    }
  }

  /**
   * Returns a normalized, compact directive object for the next Turn or model invocation.
   * @returns {Object}
   */
  toDirective() {
    return {
      goal: this.taskGoal,
      completed: [...this.completedObjectives],
      pending: [...this.pendingObjectives],
      constraints: [...this.continuationConstraints],
      decisions: [...this.importantDecisions],
      verification: { ...this.verificationState },
      safety: { ...this.safetyState },
      nextAction: this.nextRecommendedAction,
    };
  }

  /**
   * Compiles the HandoffState into a compact, formatted context string for model system prompt.
   * @returns {string} Formatted context block
   */
  toContextPrompt() {
    const lines = [
      '## ACTIVE HANDOFF',
      `- Task Goal: ${this.taskGoal}`,
      `- Operational Intent: ${this.codingIntent}`,
      this.activeFilePath ? `- Active File: ${this.activeFilePath}` : null,
    ].filter(Boolean);

    if (this.completedObjectives.length > 0) {
      lines.push('- Completed Objectives:');
      for (const obj of this.completedObjectives) {
        lines.push(`  * [COMPLETED] ${obj}`);
      }
    }

    if (this.pendingObjectives.length > 0) {
      lines.push('- Pending Objectives:');
      for (const obj of this.pendingObjectives) {
        lines.push(`  * [PENDING] ${obj}`);
      }
    }

    if (this.changedFiles.length > 0) {
      const fileNames = this.changedFiles.map((f) => typeof f === 'string' ? f : (f.filePath || f.relPath || JSON.stringify(f)));
      lines.push(`- Changed Files in Prior Turns: ${fileNames.join(', ')}`);
    }

    if (this.continuationConstraints.length > 0) {
      lines.push('- Continuation Constraints:');
      for (const c of this.continuationConstraints) {
        lines.push(`  * [CONSTRAINT] ${c}`);
      }
    }

    if (this.importantDecisions.length > 0) {
      lines.push('- Key Engineering Decisions:');
      for (const d of this.importantDecisions) {
        const text = typeof d === 'string' ? d : (d.decision || d.statement || JSON.stringify(d));
        lines.push(`  * [DECISION] ${text}`);
      }
    }

    if (this.verificationState && this.verificationState.testStatus) {
      lines.push(`- Verification State: ${this.verificationState.testStatus}${this.verificationState.failingTests?.length ? ` (Failing: ${this.verificationState.failingTests.join(', ')})` : ''}`);
    }

    if (this.unresolvedIssues.length > 0) {
      lines.push('- Unresolved Issues:');
      for (const issue of this.unresolvedIssues) {
        lines.push(`  * [ISSUE] ${issue}`);
      }
    }

    lines.push(`- Immediate Next Action: ${this.nextRecommendedAction}`);

    return lines.join('\n');
  }

  /**
   * Marks the handoff state as consumed by a successor Turn.
   * @param {string} [consumerTurnId]
   */
  consume(consumerTurnId = null) {
    this.status = HANDOFF_STATUS.CONSUMED;
    this.metadata.consumedByTurnId = consumerTurnId;
    this.metadata.consumedAt = Date.now();
  }

  /**
   * Serializes the HandoffState cleanly with secret filtering.
   * @returns {Object}
   */
  toJSON() {
    return secretFilter.sanitizeObject({
      handoffId: this.handoffId,
      threadId: this.threadId,
      sourceTurnId: this.sourceTurnId,
      createdAt: this.createdAt,
      status: this.status,
      taskGoal: this.taskGoal,
      codingIntent: this.codingIntent,
      workspacePath: this.workspacePath,
      activeFilePath: this.activeFilePath,
      completedObjectives: this.completedObjectives,
      pendingObjectives: this.pendingObjectives,
      changedFiles: this.changedFiles,
      unresolvedIssues: this.unresolvedIssues,
      verificationState: this.verificationState,
      safetyState: this.safetyState,
      importantDecisions: this.importantDecisions,
      relevantToolObservations: this.relevantToolObservations,
      nextRecommendedAction: this.nextRecommendedAction,
      continuationConstraints: this.continuationConstraints,
      metadata: this.metadata,
    });
  }

  /**
   * Deserializes a HandoffState from JSON.
   * @param {Object} data
   * @returns {HandoffState}
   */
  static fromJSON(data = {}) {
    return new HandoffState(data);
  }

  /**
   * Constructs a HandoffState from an existing Continuum Capsule object.
   * @param {Object} capsule
   * @returns {HandoffState}
   */
  static fromCapsule(capsule = {}) {
    if (!capsule || typeof capsule !== 'object') {
      throw new Error('[HANDOFF-STATE] Invalid capsule object');
    }

    const task = capsule.task || {};
    const handoffCtx = capsule.handoff_context || {};
    const verification = capsule.verification || {};
    const snap = capsule.continuum_snapshot || {};

    const completed = [];
    const pending = [];

    if (Array.isArray(task.work_items)) {
      for (const wi of task.work_items) {
        if (wi.status === 'IMPLEMENTED' || wi.status === 'VERIFIED') {
          completed.push(wi.description);
        } else {
          pending.push(wi.description);
        }
      }
    } else {
      if (Array.isArray(snap.task?.completedSteps)) completed.push(...snap.task.completedSteps);
      if (Array.isArray(snap.task?.pendingSteps)) pending.push(...snap.task.pendingSteps);
    }

    const changedFiles = Array.isArray(capsule.change_history?.net_files_modified)
      ? capsule.change_history.net_files_modified
      : (Array.isArray(capsule.important_files) ? capsule.important_files.map((f) => f.rel_path) : []);

    return new HandoffState({
      handoffId: capsule.capsule_meta?.capsule_id ? `handoff_${capsule.capsule_meta.capsule_id}` : generateHandoffId(),
      threadId: capsule.capsule_meta?.source_session_id || snap.metadata?.sessionId || 'imported_thread',
      sourceTurnId: `turn_capsule_${Date.now()}`,
      taskGoal: task.user_goal || snap.task?.userGoal || 'Imported Task',
      codingIntent: 'MUTATION',
      workspacePath: snap.project?.workspacePath || process.cwd(),
      activeFilePath: snap.codeState?.activeFilePath || null,
      completedObjectives: completed,
      pendingObjectives: pending,
      changedFiles,
      unresolvedIssues: Array.isArray(handoffCtx.unresolved_questions) ? handoffCtx.unresolved_questions : [],
      verificationState: {
        testStatus: verification.last_test_status || 'NOT_RUN',
        failingTests: verification.failing_tests || [],
        verified: verification.last_test_status === 'PASSED',
      },
      safetyState: {
        overallRiskLevel: verification.behavioral_risk_level || 'AUTO_APPROVE',
        riskScore: 0,
        safeToAutoApply: true,
      },
      importantDecisions: Array.isArray(capsule.decisions) ? capsule.decisions : (Array.isArray(snap.decisions) ? snap.decisions : []),
      nextRecommendedAction: handoffCtx.immediate_next_action || (pending[0] || 'Continue work'),
      continuationConstraints: Array.isArray(handoffCtx.do_not_touch) ? handoffCtx.do_not_touch : [],
      metadata: {
        sourceCapsuleId: capsule.capsule_meta?.capsule_id,
      },
    });
  }
}

module.exports = {
  HandoffState,
  HANDOFF_STATUS,
};
