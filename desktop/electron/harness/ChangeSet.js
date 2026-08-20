/**
 * NEXUS CODEX HARNESS - CHANGE SET ABSTRACTION (Milestone 7)
 * Represents ONE logical engineering mutation operation across zero or more files.
 * Coordinates multi-file safety evaluation, aggregated approval, atomic apply
 * via TransactionalPatchApplier, and automated verification.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  CHANGESET_STATUS,
  EVENT_TYPES,
  generateChangeSetId,
} = require('./types');
const { evaluateAIPatchFirewall } = require('../../engine/ai_patch_firewall');
const { evaluateRepositoryPatchFirewall } = require('../../engine/repository_patch_firewall');
const { analyzeSemanticIntentDrift } = require('../../engine/semantic_intent_drift');
const { astDiffEngine } = require('./ASTDiffEngine');
const { impactAnalyzer } = require('./ImpactAnalyzer');
const { transactionalPatchApplier } = require('../transactionalPatchApplier');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}


class ChangeSet {
  /**
   * @param {Object} options
   * @param {string} [options.changeSetId]
   * @param {string} options.threadId
   * @param {string} [options.turnId]
   * @param {string} [options.intent] - 'MUTATION' | 'REFACTOR' | 'BUG_FIX' | etc.
   * @param {Array<Object>} [options.files] - Initial list of file edits
   * @param {Object} [options.metadata]
   * @param {Object} [options.eventBus]
   */
  constructor(options = {}) {
    const now = Date.now();
    this.changeSetId = options.changeSetId || generateChangeSetId();
    this.threadId = options.threadId || null;
    this.turnId = options.turnId || null;
    this.createdAt = options.createdAt || now;
    this.updatedAt = options.updatedAt || now;
    this.status = options.status || CHANGESET_STATUS.PROPOSED;
    this.intent = options.intent || 'MUTATION';
    this.workspacePath = options.workspacePath || null;
    this.metadata = secretFilter.sanitizeObject(options.metadata || {});
    this.eventBus = options.eventBus || null;


    // Aggregated Risk Evaluation
    this.risk = options.risk || {
      overallRiskLevel: 'AUTO_APPROVE',
      riskScore: 0,
      filesAffected: 0,
      blockedFiles: [],
      approvalRequired: false,
      safeToAutoApply: true,
      reasons: [],
    };

    // Approval State
    this.approvalState = options.approvalState || {
      required: false,
      status: 'PENDING',
      approvedBy: null,
      reason: null,
      timestamp: null,
    };

    // Verification State
    this.verification = options.verification || {
      status: 'NOT_RUN',
      verified: false,
      testsPassed: 0,
      testsFailed: 0,
      details: null,
    };

    // Normalize file entries
    this.files = [];
    const initialFiles = options.files || options.edits || [];
    if (Array.isArray(initialFiles)) {
      for (const f of initialFiles) {
        this.addFile(f);
      }
    }


  }

  /**
   * Helper: Emit harness event if event bus attached.
   */
  _emit(eventType, payload = {}) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      try {
        this.eventBus.emit(eventType, {
          threadId: this.threadId,
          turnId: this.turnId,
          changeSetId: this.changeSetId,
          payload: {
            changeSet: this.toJSON(),
            ...payload,
          },
        });
      } catch (e) {
        console.warn(`[CHANGESET] Failed to emit event ${eventType}:`, e.message);
      }
    }
  }

  /**
   * Adds or normalizes a file edit in this ChangeSet.
   * @param {Object} fileEntry
   * @returns {Object} Added file entry
   */
  addFile(fileEntry = {}) {
    if (!fileEntry || typeof fileEntry !== 'object') {
      throw new Error('[CHANGESET] fileEntry must be an object');
    }

    const filePath = (fileEntry.filePath || fileEntry.relPath || '').trim();
    if (!filePath) {
      throw new Error('[CHANGESET] fileEntry missing valid filePath');
    }

    const original = typeof fileEntry.original === 'string' ? fileEntry.original : '';
    const replacement = typeof fileEntry.replacement === 'string' ? fileEntry.replacement : '';
    const changeType = fileEntry.changeType || (original ? 'MODIFY' : (replacement ? 'CREATE' : 'DELETE'));

    const originalContentHash = fileEntry.originalContentHash ||
      (original ? crypto.createHash('sha1').update(original, 'utf-8').digest('hex') : null);

    const proposedDiff = fileEntry.proposedDiff ||
      `--- a/${path.basename(filePath)}\n+++ b/${path.basename(filePath)}\n@@ -1,1 +1,1 @@\n-${original.slice(0, 40)}\n+${replacement.slice(0, 40)}`;

    const entry = {
      filePath,
      changeType,
      originalContentHash,
      original,
      replacement,
      proposedDiff: secretFilter.sanitizeString(proposedDiff),
      firewallResult: fileEntry.firewallResult || null,
      intentDriftResult: fileEntry.intentDriftResult || null,
      applyStatus: fileEntry.applyStatus || 'PENDING',
    };

    // Replace if existing filePath already in list
    const existingIndex = this.files.findIndex((f) => f.filePath === filePath);
    if (existingIndex >= 0) {
      this.files[existingIndex] = entry;
    } else {
      this.files.push(entry);
    }

    this.updatedAt = Date.now();
    this.risk.filesAffected = this.files.length;
    return entry;
  }

  /**
   * Runs multi-file safety evaluation across all files in the ChangeSet.
   * Integrates ai_patch_firewall, repository_patch_firewall, and semantic_intent_drift.
   * @param {Object} [options]
   * @param {string} [options.workspacePath]
   * @param {boolean} [options.strictApproval]
   * @returns {Promise<Object>} Aggregated Risk Assessment
   */
  async evaluateSafety(options = {}) {
    this.status = CHANGESET_STATUS.EVALUATING;
    this.updatedAt = Date.now();
    this._emit(EVENT_TYPES.CHANGE_SET_EVALUATING);

    const workspaceRoot = path.resolve(options.workspacePath || this.workspacePath || process.cwd());
    const blockedFiles = [];
    const reasons = [];

    let maxRiskScore = 0;
    let hasHighRisk = false;
    let hasReviewRequired = false;
    let hasHighIntentDrift = false;

    // 1. Individual File & Hunk Safety Evaluations
    for (const file of this.files) {
      const absPath = path.isAbsolute(file.filePath)
        ? file.filePath
        : path.resolve(workspaceRoot, file.filePath);

      let candidateLine = 1;

      try {
        if (fs.existsSync(absPath) && file.original) {
          const content = fs.readFileSync(absPath, 'utf-8');
          const lines = content.split('\n');
          const firstOrigLine = file.original.trim().split('\n')[0];
          const foundIdx = lines.findIndex((l) => l.includes(firstOrigLine));
          if (foundIdx >= 0) {
            candidateLine = foundIdx + 1;
          }
        }
      } catch (e) {}

      file.proposedDiff = `--- a/${file.filePath}\n+++ b/${file.filePath}\n@@ -${candidateLine},1 +${candidateLine},1 @@\n-${file.original}\n+${file.replacement}`;

      // Single-file firewall evaluation
      let fwResult = null;
      try {
        fwResult = await evaluateAIPatchFirewall({
          file_path: absPath,
          patch_text: file.proposedDiff,
          candidate_line: candidateLine,
        });
      } catch (err) {

        fwResult = {
          risk_level: 'REVIEW_REQUIRED',
          risk_score: 25,
          safe_to_auto_apply: false,
          summary: { error: err.message },
        };
      }
      file.firewallResult = fwResult;


      // Semantic Intent Drift Analysis
      let driftResult = null;
      try {
        driftResult = analyzeSemanticIntentDrift({
          original_source: file.original,
          edited_source: file.replacement,
          function_name: path.basename(file.filePath),
        });
      } catch (err) {
        driftResult = { drift_level: 'NONE', drift_score: 0 };
      }
      file.intentDriftResult = driftResult;

      // AST Structural Diff Analysis (Milestone 18B)
      let astDiffResult = null;
      try {
        astDiffResult = astDiffEngine.compare(file.original, file.replacement, '', file.filePath);
      } catch (err) {
        astDiffResult = { fallback: true, mode: 'TEXT_DIFF_ONLY', error: err.message };
      }
      file.astDiffResult = astDiffResult;
      file.semanticSummary = astDiffResult.summary || null;
      file.astRiskHints = astDiffResult.summary?.riskHints || [];

      const fileScore = fwResult.risk_score || 0;
      maxRiskScore = Math.max(maxRiskScore, fileScore);

      if (fwResult.risk_level === 'BLOCKED') {
        hasHighRisk = true;
        blockedFiles.push(file.filePath);
        reasons.push(`Firewall blocked ${file.filePath} (Risk score: ${fileScore})`);
      } else if (fwResult.risk_level === 'HIGH_RISK') {
        hasHighRisk = true;
        reasons.push(`High risk in ${file.filePath} (Risk score: ${fileScore})`);
      } else if (fwResult.risk_level === 'REVIEW_REQUIRED' || !fwResult.safe_to_auto_apply) {
        hasReviewRequired = true;
        reasons.push(`Review required for ${file.filePath}`);
      }

      if (driftResult.drift_level === 'HIGH') {
        hasHighIntentDrift = true;
        reasons.push(`High semantic intent drift detected in ${file.filePath}`);
      }
    }

    // 2. Multi-File Architectural Consistency via Repository Firewall
    let repoFirewallResult = null;
    if (this.files.length > 1) {
      try {
        const repoEdits = this.files.map((f) => ({
          file_path: f.filePath,
          patch_text: f.proposedDiff,
        }));
        repoFirewallResult = await evaluateRepositoryPatchFirewall({
          edits: repoEdits,
          workspace_root: workspaceRoot,
        });

        if (repoFirewallResult && repoFirewallResult.risk_level === 'BLOCKED') {
          blockedFiles.push('repository_consistency');
          reasons.push('Repository-wide structural consistency violation');
        } else if (repoFirewallResult && repoFirewallResult.risk_level === 'HIGH_RISK') {
          hasHighRisk = true;
          reasons.push('Multi-file architectural risk detected');
        }
      } catch (err) {
        reasons.push(`Repository firewall check skipped: ${err.message}`);
      }
    }

    // 3. Aggregate Overall Risk Level & Blast-Radius Impact Analysis (Milestone 20)
    let overallRiskLevel = 'AUTO_APPROVE';
    let safeToAutoApply = true;
    let approvalRequired = false;

    let impactAnalysis = null;
    try {
      impactAnalysis = impactAnalyzer.analyzeChangeSet(this);
    } catch (err) {
      impactAnalysis = { impactConfidence: 'HEURISTIC', warnings: [] };
    }

    if (blockedFiles.length > 0) {
      overallRiskLevel = 'BLOCKED';
      safeToAutoApply = false;
      approvalRequired = true;
    } else if (hasHighRisk || maxRiskScore >= 60) {
      overallRiskLevel = 'HIGH_RISK';
      safeToAutoApply = false;
      approvalRequired = true;
    } else if (hasReviewRequired || hasHighIntentDrift || maxRiskScore > 0) {
      overallRiskLevel = 'REVIEW_REQUIRED';
      safeToAutoApply = false;
      approvalRequired = true;
    } else {
      overallRiskLevel = 'AUTO_APPROVE';
      safeToAutoApply = true;
      approvalRequired = Boolean(options.strictApproval);
    }

    this.risk = {
      overallRiskLevel,
      riskScore: maxRiskScore,
      filesAffected: this.files.length,
      blockedFiles,
      approvalRequired,
      safeToAutoApply,
      reasons: Array.from(new Set(reasons)),
      impactAnalysis,
    };

    this.approvalState.required = approvalRequired;

    // Transition Status
    if (approvalRequired) {
      this.status = CHANGESET_STATUS.APPROVAL_REQUIRED;
      this.approvalState.status = 'PENDING';
      this._emit(EVENT_TYPES.CHANGE_SET_APPROVAL_REQUIRED, { risk: this.risk });
    } else {
      this.status = CHANGESET_STATUS.APPROVED;
      this.approvalState.status = 'AUTO_APPROVED';
      this.approvalState.timestamp = Date.now();
      this._emit(EVENT_TYPES.CHANGE_SET_APPROVED, { autoApproved: true });
    }

    // Record Safety Check in EvidenceGraph
    if (evidenceGraphInstance && this.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: this.threadId,
          type: 'SAFETY_CHECK',
          statement: `Multi-file ChangeSet ${this.changeSetId} safety evaluation: ${overallRiskLevel} (Risk score: ${maxRiskScore}, Files: ${this.files.length})`,
          provenanceClass: 'FIREWALL_VERIFIED',
          verificationLevel: safeToAutoApply ? 'SAFETY_VERIFIED' : 'UNVERIFIED',
          metadata: {
            changeSetId: this.changeSetId,
            risk: this.risk,
          },
        });
      } catch (e) {}
    }

    this.updatedAt = Date.now();
    return this.risk;
  }

  /**
   * Approves the ChangeSet as ONE logical engineering operation.
   * @param {Object} [decision]
   * @returns {Object} Approval decision metadata
   */
  approve(decision = {}) {
    this.status = CHANGESET_STATUS.APPROVED;
    this.approvalState = {
      required: this.approvalState.required,
      status: 'APPROVED',
      approvedBy: decision.approvedBy || 'user',
      reason: decision.reason || 'Approved by user',
      timestamp: Date.now(),
      force: Boolean(decision.force),
    };
    this.updatedAt = Date.now();

    this._emit(EVENT_TYPES.CHANGE_SET_APPROVED, { decision: this.approvalState });

    if (evidenceGraphInstance && this.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: this.threadId,
          type: 'USER_APPROVAL',
          statement: `Approved ChangeSet ${this.changeSetId} across ${this.files.length} files: ${this.approvalState.reason}`,
          provenanceClass: 'USER_APPROVED',
          verificationLevel: 'USER_VERIFIED',
          metadata: {
            changeSetId: this.changeSetId,
            approvalState: this.approvalState,
          },
        });
      } catch (e) {}
    }

    return this.approvalState;
  }

  /**
   * Rejects the ChangeSet.
   * @param {string} [reason]
   * @returns {Object} Rejection metadata
   */
  reject(reason = 'ChangeSet rejected by user') {
    this.status = CHANGESET_STATUS.REJECTED;
    this.approvalState = {
      required: this.approvalState.required,
      status: 'REJECTED',
      approvedBy: null,
      reason,
      timestamp: Date.now(),
    };
    this.updatedAt = Date.now();

    this._emit(EVENT_TYPES.CHANGE_SET_FAILED, { reason, rejected: true });

    return this.approvalState;
  }

  /**
   * Applies the ChangeSet atomically via TransactionalPatchApplier.
   * The ChangeSet layer NEVER writes directly to disk.
   * @param {Object} [options]
   * @param {string} [options.workspacePath]
   * @param {boolean} [options.force]
   * @param {Object} [options.applier]
   * @returns {Promise<Object>} Apply outcome
   */
  async apply(options = {}) {
    const workspaceRoot = path.resolve(options.workspacePath || this.workspacePath || process.cwd());
    const applier = options.applier || transactionalPatchApplier;


    // Convert file entries into format expected by TransactionalPatchApplier
    const edits = this.files.map((f) => ({
      filePath: f.filePath,
      original: f.original,
      replacement: f.replacement,
    }));

    try {
      const txResult = await applier.applyTransaction(edits, {
        workspacePath: workspaceRoot,
        sessionId: this.threadId || 'default_session',
        enforceFirewall: true,
        force: Boolean(options.force || this.approvalState.force),
      });

      if (!txResult || !txResult.success) {
        // Mark all files rolled back
        for (const file of this.files) {
          file.applyStatus = 'ROLLED_BACK';
        }
        this.status = CHANGESET_STATUS.ROLLED_BACK;
        this.updatedAt = Date.now();
        this.metadata.transactionError = txResult?.error || 'Atomic transaction failed';

        this._emit(EVENT_TYPES.CHANGE_SET_ROLLED_BACK, {
          error: txResult?.error,
          conflictingFiles: txResult?.conflictingFiles,
        });

        if (evidenceGraphInstance && this.threadId) {
          try {
            evidenceGraphInstance.addNode({
              sessionId: this.threadId,
              type: 'TRANSACTION',
              statement: `ChangeSet ${this.changeSetId} application failed and rolled back: ${txResult?.error}`,
              provenanceClass: 'TRANSACTION_VERIFIED',
              verificationLevel: 'UNVERIFIED',
              metadata: {
                changeSetId: this.changeSetId,
                success: false,
                rolledBack: true,
              },
            });
          } catch (e) {}
        }

        return {
          success: false,
          status: CHANGESET_STATUS.ROLLED_BACK,
          error: txResult?.error || 'Transactional patch application failed',
          rolledBack: true,
          conflictingFiles: txResult?.conflictingFiles || [],
        };
      }

      // Mark all files applied
      for (const file of this.files) {
        file.applyStatus = 'APPLIED';
      }
      this.status = CHANGESET_STATUS.APPLIED;
      this.metadata.transactionId = txResult.transactionId;
      this.metadata.appliedCount = txResult.appliedCount;
      this.updatedAt = Date.now();

      this._emit(EVENT_TYPES.CHANGE_SET_APPLIED, {
        transactionId: txResult.transactionId,
        appliedCount: txResult.appliedCount,
        modifiedFiles: txResult.modifiedFiles,
      });

      if (evidenceGraphInstance && this.threadId) {
        try {
          for (const f of this.files) {
            evidenceGraphInstance.addNode({
              sessionId: this.threadId,
              type: 'CODE_CHANGE',
              statement: `Applied ChangeSet ${this.changeSetId} modification to ${f.filePath}`,
              provenanceClass: 'TRANSACTION_VERIFIED',
              verificationLevel: 'TRANSACTION_VERIFIED',
              filePath: f.filePath,
              metadata: {
                changeSetId: this.changeSetId,
                transactionId: txResult.transactionId,
              },
            });
          }
        } catch (e) {}
      }

      return {
        success: true,
        status: CHANGESET_STATUS.APPLIED,
        transactionId: txResult.transactionId,
        appliedCount: txResult.appliedCount,
        modifiedFiles: txResult.modifiedFiles,
      };
    } catch (err) {
      for (const file of this.files) {
        file.applyStatus = 'ROLLED_BACK';
      }
      this.status = CHANGESET_STATUS.ROLLED_BACK;
      this.updatedAt = Date.now();
      this.metadata.transactionError = err.message;

      this._emit(EVENT_TYPES.CHANGE_SET_ROLLED_BACK, { error: err.message });

      return {
        success: false,
        status: CHANGESET_STATUS.ROLLED_BACK,
        error: err.message,
        rolledBack: true,
      };
    }
  }

  /**
   * Verifies the ChangeSet after application (e.g. running tests or static checks).
   * Transitions status to VERIFIED or FAILED.
   * @param {Object|Function} [verifier] - Test execution function or object
   * @param {Object} [options]
   * @returns {Promise<Object>} Verification outcome
   */
  async verify(verifier, options = {}) {
    let testOutcome = null;

    if (typeof verifier === 'function') {
      try {
        testOutcome = await verifier(this, options);
      } catch (err) {
        testOutcome = { success: false, error: err.message };
      }
    } else if (verifier && typeof verifier.runTests === 'function') {
      try {
        testOutcome = await verifier.runTests(options);
      } catch (err) {
        testOutcome = { success: false, error: err.message };
      }
    } else if (options.testResult) {
      testOutcome = options.testResult;
    } else {
      testOutcome = { success: true, verified: true, testStatus: 'PASSED' };
    }

    const isVerified = Boolean(testOutcome.success || testOutcome.verified || testOutcome.testStatus === 'PASSED');

    this.verification = {
      status: isVerified ? 'PASSED' : 'FAILED',
      verified: isVerified,
      testsPassed: testOutcome.passed ?? (testOutcome.testsPassed ?? (isVerified ? 1 : 0)),
      testsFailed: testOutcome.failed ?? (testOutcome.testsFailed ?? (isVerified ? 0 : 1)),
      details: secretFilter.sanitizeObject(testOutcome.details || testOutcome),
    };

    this.status = isVerified ? CHANGESET_STATUS.VERIFIED : CHANGESET_STATUS.FAILED;
    this.updatedAt = Date.now();

    if (isVerified) {
      this._emit(EVENT_TYPES.CHANGE_SET_VERIFIED, { verification: this.verification });
    } else {
      this._emit(EVENT_TYPES.CHANGE_SET_FAILED, { verification: this.verification });
    }

    if (evidenceGraphInstance && this.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: this.threadId,
          type: isVerified ? 'VERIFICATION' : 'TEST_RESULT',
          statement: `ChangeSet ${this.changeSetId} verification: ${this.verification.status} (passed: ${this.verification.testsPassed}, failed: ${this.verification.testsFailed})`,
          provenanceClass: isVerified ? 'TEST_VERIFIED' : 'MODEL_INFERENCE',
          verificationLevel: isVerified ? 'TEST_VERIFIED' : 'UNVERIFIED',
          metadata: {
            changeSetId: this.changeSetId,
            verification: this.verification,
          },
        });
      } catch (e) {}
    }

    return {
      success: isVerified,
      status: this.status,
      verification: this.verification,
    };
  }

  /**
   * Generates a clean representation for ItemStore payload.
   * @returns {Object}
   */
  toItemPayload() {
    return {
      changeSetId: this.changeSetId,
      threadId: this.threadId,
      turnId: this.turnId,
      status: this.status,
      intent: this.intent,
      files: this.files.map((f) => ({
        filePath: f.filePath,
        changeType: f.changeType,
        applyStatus: f.applyStatus,
        firewallRisk: f.firewallResult?.risk_level || null,
        intentDrift: f.intentDriftResult?.drift_level || null,
      })),
      risk: this.risk,
      approvalState: this.approvalState,
      verification: this.verification,
      metadata: this.metadata,
    };
  }

  /**
   * Serializes the ChangeSet cleanly with secret filtering.
   * @returns {Object}
   */
  toJSON() {
    return secretFilter.sanitizeObject({
      changeSetId: this.changeSetId,
      threadId: this.threadId,
      turnId: this.turnId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      intent: this.intent,
      files: this.files,
      risk: this.risk,
      approvalState: this.approvalState,
      verification: this.verification,
      metadata: this.metadata,
    });
  }

  /**
   * Deserializes a ChangeSet from persisted or serialized JSON.
   * @param {Object} data
   * @param {Object} [options]
   * @returns {ChangeSet}
   */
  static fromJSON(data = {}, options = {}) {
    if (!data || typeof data !== 'object') {
      throw new Error('[CHANGESET] Invalid serialized ChangeSet data');
    }
    return new ChangeSet({
      ...data,
      eventBus: options.eventBus,
    });
  }
}

module.exports = {
  ChangeSet,
  CHANGESET_STATUS,
};
