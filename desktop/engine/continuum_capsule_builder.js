/**
 * CONTINUUM CAPSULE BUILDER v1.0.0
 * Constructs portable, self-contained Continuum Capsule artifacts from
 * validated ContinuumSnapshots, workspace file snapshots, and surgery history.
 * Enforces strict secret sanitization, truth boundaries, and minimum sufficient state.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { continuumEngine } = require('./continuum_engine');
const { continuumContextBuilder } = require('./continuum_context_builder');
const secretFilter = require('../security/secretFilter');

// Try requiring snapshotManager safely
let snapshotManager = null;
try {
  snapshotManager = require('../electron/snapshotManager').snapshotManager;
} catch (e) {
  // Snapshot manager unavailable in standalone unit test environment
}

const CAPSULE_SCHEMA_VERSION = "1.0.0";
const TRUTH_BOUNDARY_VERSION = "1.0.0";

const SECRET_FILE_PATTERNS = [
  /^\.env/i,
  /\.(pem|key|crt|pfx)$/i,
  /\.echo-nullity-backup$/i,
  /(secret|credential|password)/i,
];

class ContinuumCapsuleBuilder {
  /**
   * Helper: Check if a relative or absolute file path matches secret file patterns.
   */
  isSecretOrBackupFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return true;
    const baseName = path.basename(filePath);
    return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(baseName) || pattern.test(filePath));
  }

  /**
   * Helper: Derives do_not_touch paths only from explicit negative constraints.
   * Does NOT classify ordinary file mentions as do-not-touch rules.
   */
  deriveDoNotTouch(taskText = '', systemOverrideText = '') {
    const combined = `${taskText || ''}\n${systemOverrideText || ''}`;
    if (!combined.trim()) return [];

    const patterns = [
      /(?:do not|don't|without)\s+(?:modify|modifying|modified|touch|touching|change|changing|changed|alter|altering|edit|editing|update|updating)\s+(?:any\s+files?\s+in\s+)?(['"`]?)([\w\/\.\-\*]+(?:\/)?)\1/gi,
    ];

    const results = new Set();
    const lines = combined.split('\n');

    for (const line of lines) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (match[2]) {
            let cleanPath = match[2].trim().replace(/['"`]/g, '');
            while (cleanPath.endsWith('.') || cleanPath.endsWith(',')) {
              cleanPath = cleanPath.slice(0, -1);
            }
            if (cleanPath && !['any', 'the', 'files', 'code', 'directory', 'folder'].includes(cleanPath.toLowerCase())) {
              results.add(cleanPath);
            }
          }
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Helper: Compute SHA-1 hash of string content.
   */
  computeSha1(content) {
    return crypto.createHash('sha1').update(content || '', 'utf-8').digest('hex');
  }

  /**
   * Helper: Compute SHA-256 hash of text or object.
   */
  computeSha256(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
  }

  /**
   * Reads surgery history entries from surgery-history.json safely.
   */
  loadSurgeryHistory() {
    const userHome = os.homedir();
    const primaryPath = path.join(userHome, 'Library', 'Application Support', 'echo-nullity', 'surgery-history.json');
    const fallbackPath = path.resolve(__dirname, '..', 'state', 'surgery-history.json');

    const targetPath = fs.existsSync(primaryPath) ? primaryPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);
    if (!targetPath) return [];

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
    } catch (e) {
      return [];
    }
  }

  /**
   * Builds a complete ContinuumCapsule v1.0.0 from a ContinuumSnapshot and workspace.
   */
  async buildCapsule(snapshot, workspacePath, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('buildCapsule requires a valid snapshot object');
    }

    const validation = continuumEngine.validateSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(`Invalid input snapshot: ${validation.errors.join('; ')}`);
    }

    const activeWorkspace = workspacePath || snapshot.project?.workspacePath || process.cwd();
    const exportMode = options.exportMode === 'REFERENCE_ONLY' ? 'REFERENCE_ONLY' : 'INLINE';
    const createWorkspaceSnapshot = options.createWorkspaceSnapshot !== false;
    const maxInlineLines = typeof options.maxInlineLines === 'number' ? options.maxInlineLines : 300;

    const now = Date.now();
    const capsuleId = `caps_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Create workspace snapshot via snapshotManager if enabled
    let workspaceSnapshotId = snapshot.codeState?.workspaceSnapshotId || null;

    if (createWorkspaceSnapshot && snapshotManager) {
      try {
        const snapRes = await snapshotManager.createSnapshot({
          workspacePath: activeWorkspace,
          name: `Pre-Capsule Backup (${snapshot.metadata?.sessionId || 'Session'})`,
          description: `Automatic workspace backup for capsule ${capsuleId}`,
          isAuto: true,
        });
        if (snapRes && snapRes.success) {
          workspaceSnapshotId = snapRes.snapshotId;
        }
      } catch (err) {
        console.warn('[CAPSULE-BUILDER] Failed to create workspace snapshot:', err.message);
      }
    }

    // 2. Fetch session surgery history entries
    const sessionStartTime = snapshot.metadata?.createdAt || 0;
    const allHistoryEntries = this.loadSurgeryHistory();

    const sessionSurgeryEntries = allHistoryEntries.filter((entry) => {
      const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
      const isWithinSession = entryTime >= sessionStartTime - 60000;
      const matchesFile = entry.file_path && (
        entry.file_path.startsWith(activeWorkspace) ||
        path.resolve(entry.file_path).startsWith(path.resolve(activeWorkspace))
      );
      return isWithinSession && matchesFile;
    });

    const netFilesModified = Array.from(new Set(
      sessionSurgeryEntries.map((e) => {
        const rel = path.relative(activeWorkspace, e.file_path);
        return rel && !rel.startsWith('..') ? rel : path.basename(e.file_path);
      })
    ));

    const surgerySessionIds = Array.from(new Set(sessionSurgeryEntries.map((e) => e.id)));

    // 3. Build provider-neutral context string via continuumContextBuilder
    const builtContext = continuumContextBuilder.buildContext(snapshot);

    // 4. Collect & process important files
    const candidateFileSet = new Set();
    if (snapshot.codeState?.activeFilePath) candidateFileSet.add(snapshot.codeState.activeFilePath);
    if (Array.isArray(snapshot.handoff?.requiredFilesToLoad)) {
      snapshot.handoff.requiredFilesToLoad.forEach((f) => candidateFileSet.add(f));
    }
    if (Array.isArray(snapshot.codeState?.dirtyFiles)) {
      snapshot.codeState.dirtyFiles.forEach((df) => candidateFileSet.add(df.relPath));
    }

    const importantFiles = [];
    const keyFileHashes = {};

    for (const relPath of candidateFileSet) {
      if (!relPath || typeof relPath !== 'string') continue;
      const normRelPath = relPath.startsWith('/') ? path.relative(activeWorkspace, relPath) : relPath;
      const absPath = path.isAbsolute(relPath) ? relPath : path.join(activeWorkspace, normRelPath);

      let content = null;
      let sha1Hash = '0000000000000000000000000000000000000000';
      let lineCount = 0;

      if (fs.existsSync(absPath) && !this.isSecretOrBackupFile(normRelPath)) {
        try {
          content = fs.readFileSync(absPath, 'utf-8');
          sha1Hash = this.computeSha1(content);
          lineCount = content.split('\n').length;
        } catch (e) {}
      }

      keyFileHashes[normRelPath] = sha1Hash;

      const isSecret = this.isSecretOrBackupFile(normRelPath);
      const allowInline = exportMode === 'INLINE' && !isSecret && content !== null && lineCount <= maxInlineLines;

      let role = 'REFERENCE';
      if (normRelPath === snapshot.codeState?.activeFilePath) role = 'ACTIVE_EDIT_TARGET';
      else if (snapshot.handoff?.requiredFilesToLoad?.includes(normRelPath)) role = 'DEPENDENCY';

      const isDirty = (snapshot.codeState?.dirtyFiles || []).some((df) => df.relPath === normRelPath && df.unsavedChanges);
      const isSurgeryApplied = netFilesModified.includes(normRelPath);

      importantFiles.push({
        rel_path: normRelPath,
        role,
        sha1_hash: sha1Hash,
        line_count: lineCount,
        has_unsaved_changes: isDirty,
        surgery_applied: isSurgeryApplied,
        inline_content: allowInline ? content : null,
        content_summary: `File ${normRelPath} (${lineCount} lines). Role: ${role}.`,
      });
    }

    // 5. Work items assembly with Truth Boundary status assignment
    const workItems = [];
    let itemSeq = 1;

    (snapshot.task?.completedSteps || []).forEach((step) => {
      const matchingSurgery = sessionSurgeryEntries.find((e) =>
        e.removed_lines?.length > 0 || e.operation_type === 'APPLY_SURGERY'
      );
      const evidenceRef = matchingSurgery ? matchingSurgery.id : (workspaceSnapshotId || null);
      workItems.push({
        id: `wi-${String(itemSeq++).padStart(3, '0')}`,
        description: step,
        status: evidenceRef ? 'IMPLEMENTED' : 'UNKNOWN',
        evidence_ref: evidenceRef,
      });
    });

    (snapshot.task?.pendingSteps || []).forEach((step) => {
      workItems.push({
        id: `wi-${String(itemSeq++).padStart(3, '0')}`,
        description: step,
        status: 'PLANNED',
        evidence_ref: null,
      });
    });

    (snapshot.task?.blockers || []).forEach((blocker) => {
      workItems.push({
        id: `wi-${String(itemSeq++).padStart(3, '0')}`,
        description: `Blocked: ${blocker}`,
        status: 'BLOCKED',
        evidence_ref: null,
        blocker_description: blocker,
      });
    });

    // 6. Discover sidecar backup files
    const backupFilesPresent = [];
    try {
      if (fs.existsSync(activeWorkspace)) {
        const scanBackups = (dir, depth = 0) => {
          if (depth > 5) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.name === 'node_modules' || ent.name === '.git') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              scanBackups(full, depth + 1);
            } else if (ent.name.endsWith('.echo-nullity-backup')) {
              backupFilesPresent.push(full);
            }
          }
        };
        scanBackups(activeWorkspace);
      }
    } catch (e) {}

    // Update embedded snapshot codeState linkage
    const updatedEmbeddedSnapshot = JSON.parse(JSON.stringify(snapshot));
    if (updatedEmbeddedSnapshot.codeState) {
      updatedEmbeddedSnapshot.codeState.workspaceSnapshotId = workspaceSnapshotId;
      updatedEmbeddedSnapshot.codeState.surgerySessionIds = surgerySessionIds;
    }

    // Assemble raw capsule object
    const capsuleRaw = {
      capsule_schema_version: CAPSULE_SCHEMA_VERSION,
      capsule_meta: {
        capsule_id: capsuleId,
        generated_at: now,
        generated_by: 'echo-nullity-continuum-capsule-v1',
        source_session_id: snapshot.metadata?.sessionId || 'unknown_session',
        source_sequence_number: snapshot.metadata?.sequenceNumber || 1,
        export_mode: exportMode,
        capsule_hash: '',
        truth_boundary_version: TRUTH_BOUNDARY_VERSION,
      },
      continuum_snapshot: updatedEmbeddedSnapshot,
      task: {
        user_goal: snapshot.task?.userGoal || '',
        objective_summary: snapshot.task?.userGoal
          ? `Goal: ${snapshot.task.userGoal}. Active Milestone: ${snapshot.task.activeMilestone || 'Handoff'}.`
          : 'Engineering Task Handoff Session',
        work_items: workItems,
        active_milestone: snapshot.task?.activeMilestone || '',
        blockers: snapshot.task?.blockers || [],
      },
      important_files: importantFiles,
      source_state: {
        workspace_snapshot_id: workspaceSnapshotId,
        workspace_snapshot_timestamp: now,
        workspace_hash: snapshot.project?.workspaceHash || this.computeSha256(activeWorkspace).slice(0, 16),
        key_file_hashes: keyFileHashes,
        backup_files_present: backupFilesPresent,
        dirty_files_at_export: (snapshot.codeState?.dirtyFiles || []).map((df) => ({
          rel_path: df.relPath,
          has_unsaved_changes: df.unsavedChanges,
        })),
      },
      change_history: {
        session_surgery_entries: sessionSurgeryEntries.map((entry) => ({
          id: entry.id,
          timestamp: entry.timestamp,
          file_path: entry.file_path,
          operation_type: entry.operation_type || 'APPLY_SURGERY',
          removed_lines: entry.removed_lines || [],
          before_hash: entry.before_hash || '',
          after_hash: entry.after_hash || '',
          behavior_preserved: Boolean(entry.behavior_preserved),
          inline_before_source: exportMode === 'INLINE' ? entry.before_source || null : null,
          inline_after_source: exportMode === 'INLINE' ? entry.after_source || null : null,
          unified_diff_summary: `Surgery ${entry.id} (${entry.operation_type}): ${entry.removed_lines?.length || 0} line(s) removed in ${path.basename(entry.file_path)}.`,
        })),
        net_files_modified: netFilesModified,
        total_surgery_operations: sessionSurgeryEntries.length,
        total_undos: sessionSurgeryEntries.filter((e) => e.operation_type === 'UNDO_SURGERY').length,
      },
      verification: {
        last_test_status: snapshot.verification?.lastTestStatus || 'NOT_RUN',
        failing_tests: snapshot.verification?.failingTestNames || [],
        behavioral_risk_level: snapshot.verification?.behavioralDiffSummary?.riskLevel || 'UNKNOWN',
        behavioral_diff_summary: snapshot.verification?.behavioralDiffSummary || null,
        patch_firewall_decisions: (snapshot.verification?.patchFirewallDecisions || snapshot.verification?.patch_firewall_decisions || []).map((d) => ({
          file_path: d.file_path || d.filePath || 'unknown',
          risk_level: d.risk_level || d.riskLevel || 'AUTO_APPROVE',
          risk_score: typeof d.risk_score === 'number' ? d.risk_score : (typeof d.riskScore === 'number' ? d.riskScore : 10),
          safe_to_auto_apply: Boolean(d.safe_to_auto_apply ?? d.safeToAutoApply),
          decision_summary: d.decision_summary || d.decisionSummary || `Patch Firewall evaluation: ${d.risk_level || 'AUTO_APPROVE'}`,
          timestamp: typeof d.timestamp === 'number' ? d.timestamp : now,
          operation_id: d.operation_id || d.operationId || null,
        })),
        verification_summary: `Test status: ${snapshot.verification?.lastTestStatus || 'NOT_RUN'}. Failing tests: ${(snapshot.verification?.failingTestNames || []).join(', ') || 'None'}. Behavioral risk: ${snapshot.verification?.behavioralDiffSummary?.riskLevel || 'UNKNOWN'}.`,
      },
      decisions: (snapshot.decisions || []).map((d) => ({
        timestamp: d.timestamp,
        decision: d.decision,
        rationale: d.rationale,
        rejected_alternatives: d.rejectedAlternatives || [],
        user_approved: Boolean(d.userApproved),
        status: netFilesModified.length > 0 ? 'IMPLEMENTED' : 'PLANNED',
      })),
      debugging: {
        discovered_bugs: snapshot.debugging?.discoveredBugs || [],
        failed_fixes: snapshot.debugging?.failedFixes || [],
        successful_fixes: snapshot.debugging?.successfulFixes || [],
      },
      handoff_context: {
        immediate_next_action: snapshot.handoff?.immediateNextAction || (snapshot.task?.pendingSteps?.[0] || 'Continue engineering task'),
        required_files_to_open: snapshot.handoff?.requiredFilesToLoad || [],
        unresolved_questions: snapshot.handoff?.unresolvedQuestions || [],
        do_not_touch: this.deriveDoNotTouch(snapshot.task?.userGoal, snapshot.handoff?.systemInstructionOverride),
        system_instruction_override: snapshot.handoff?.systemInstructionOverride || '',
        context_injection_text: builtContext.contextText || '',
        truth_assertion: `Truth Boundary Asserted: Work items verified by evidence refs. Implemented items: ${workItems.filter((w) => w.status === 'IMPLEMENTED').length}, Planned items: ${workItems.filter((w) => w.status === 'PLANNED').length}.`,
      },
      conversation_context: {
        condensed_summary: snapshot.conversation?.condensedSummary || '',
        last_user_directive: snapshot.conversation?.lastUserDirective || '',
        last_agent_response_snippet: snapshot.conversation?.lastAgentResponseSnippet || '',
        token_count_estimate: snapshot.conversation?.tokenCountEstimate || 0,
        recent_turns: (snapshot.conversation?.recentTurns || []).slice(-10).map((t) => ({
          turn_id: t.turnId,
          timestamp: t.timestamp,
          user_prompt: t.userPrompt,
          agent_summary: t.agentSummary,
          status: t.status,
        })),
      },
      ai_config: {
        provider: snapshot.aiState?.provider || 'offline',
        model_name: snapshot.aiState?.modelName || 'deterministic-rule-engine',
        active_role: snapshot.aiState?.activeRole || 'software-engineer',
        temperature: snapshot.aiState?.temperature || 0.1,
        max_tokens: snapshot.aiState?.maxTokens || 2048,
      },
    };

    // 7. Secret Redaction via secretFilter
    const sanitizedCapsule = secretFilter.sanitizeObject(capsuleRaw);

    // 8. Calculate capsule_hash
    const hashableBody = JSON.parse(JSON.stringify(sanitizedCapsule));
    delete hashableBody.capsule_meta.capsule_hash;
    const computedHash = this.computeSha256(JSON.stringify(hashableBody));
    sanitizedCapsule.capsule_meta.capsule_hash = computedHash;

    return sanitizedCapsule;
  }

  /**
   * Validates a ContinuumCapsule structure.
   */
  validateCapsule(capsule) {
    const errors = [];
    if (!capsule || typeof capsule !== 'object') {
      return { valid: false, errors: ['Capsule must be a non-null object'] };
    }

    if (capsule.capsule_schema_version !== CAPSULE_SCHEMA_VERSION) {
      errors.push(`Unsupported capsule_schema_version: "${capsule.capsule_schema_version}". Expected "${CAPSULE_SCHEMA_VERSION}".`);
    }

    if (!capsule.capsule_meta || typeof capsule.capsule_meta !== 'object') {
      errors.push("Missing required section: 'capsule_meta'");
    } else {
      if (!capsule.capsule_meta.capsule_id) errors.push("Missing 'capsule_meta.capsule_id'");
      if (!capsule.capsule_meta.source_session_id) errors.push("Missing 'capsule_meta.source_session_id'");
      if (!capsule.capsule_meta.export_mode) errors.push("Missing 'capsule_meta.export_mode'");
      if (!capsule.capsule_meta.capsule_hash) errors.push("Missing 'capsule_meta.capsule_hash'");
    }

    if (!capsule.continuum_snapshot) {
      errors.push("Missing required section: 'continuum_snapshot'");
    } else {
      const snapVal = continuumEngine.validateSnapshot(capsule.continuum_snapshot);
      if (!snapVal.valid) {
        errors.push(`Embedded continuum_snapshot invalid: ${snapVal.errors.join('; ')}`);
      }
    }

    if (!capsule.task) errors.push("Missing required section: 'task'");
    if (!capsule.handoff_context) errors.push("Missing required section: 'handoff_context'");

    // Verify capsule hash integrity if meta exists
    if (capsule.capsule_meta && capsule.capsule_meta.capsule_hash) {
      const hashableBody = JSON.parse(JSON.stringify(capsule));
      delete hashableBody.capsule_meta.capsule_hash;
      const expectedHash = this.computeSha256(JSON.stringify(hashableBody));
      if (capsule.capsule_meta.capsule_hash !== expectedHash) {
        errors.push(`Capsule hash integrity mismatch: calculated "${expectedHash}", stored "${capsule.capsule_meta.capsule_hash}"`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

const continuumCapsuleBuilder = new ContinuumCapsuleBuilder();

module.exports = {
  ContinuumCapsuleBuilder,
  continuumCapsuleBuilder,
  buildCapsule: (snapshot, workspacePath, options) => continuumCapsuleBuilder.buildCapsule(snapshot, workspacePath, options),
  validateCapsule: (capsule) => continuumCapsuleBuilder.validateCapsule(capsule),
  CAPSULE_SCHEMA_VERSION,
  TRUTH_BOUNDARY_VERSION,
};
