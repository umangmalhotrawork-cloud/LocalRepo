/**
 * NEXUS CODEX HARNESS TOOL - APPLY PATCH
 * Safely applies multi-file code modifications via TransactionalPatchApplier
 * and Patch Firewall safety verification.
 */

const path = require('path');
const { transactionalPatchApplier } = require('../../transactionalPatchApplier');
const { ChangeSet } = require('../ChangeSet');
const { evaluateAIPatchFirewall } = require('../../../engine/ai_patch_firewall');
const secretFilter = require('../../../security/secretFilter');

const ApplyPatchTool = {
  name: 'apply_patch',
  description: 'Applies transactional code replacements to workspace files with Patch Firewall protection and ChangeSet orchestration.',
  inputSchema: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: 'Array of surgical edit operations to apply atomically',
        items: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Relative path to file' },
            original: { type: 'string', description: 'Exact code substring to replace' },
            replacement: { type: 'string', description: 'New replacement code' },
          },
          required: ['filePath', 'replacement'],
        },
      },
    },
    required: ['edits'],
  },
  requiresApproval: true,

  async execute(args = {}, context = {}) {
    const rawEdits = args.edits;
    if (!Array.isArray(rawEdits) || rawEdits.length === 0) {
      return {
        success: false,
        error: 'Argument "edits" must be a non-empty array of edit objects',
      };
    }

    const workspaceRoot = path.resolve(context.workspacePath || process.cwd());

    // 1. Validate edit structures & construct ChangeSet
    const changeSet = new ChangeSet({
      threadId: context.threadId || 'default_session',
      turnId: context.turnId || null,
      intent: context.intent || 'MUTATION',
      eventBus: context.eventBus || null,
    });

    for (let i = 0; i < rawEdits.length; i++) {
      const e = rawEdits[i];
      if (!e || typeof e !== 'object') {
        return {
          success: false,
          error: `Edit at index ${i} is not a valid object`,
        };
      }
      if (!e.filePath || typeof e.filePath !== 'string' || !e.filePath.trim()) {
        return {
          success: false,
          error: `Edit at index ${i} missing valid "filePath"`,
        };
      }
      if (typeof e.replacement !== 'string') {
        return {
          success: false,
          error: `Edit at index ${i} missing "replacement" string`,
        };
      }

      changeSet.addFile({
        filePath: e.filePath.trim(),
        original: typeof e.original === 'string' ? e.original : '',
        replacement: e.replacement,
      });
    }

    // 2. Preflight Multi-File Safety Evaluation via ChangeSet & Patch Firewall
    const risk = await changeSet.evaluateSafety({
      workspacePath: workspaceRoot,
      strictApproval: context.approvalMode === 'strict',
    });

    const firstFileFw = changeSet.files[0]?.firewallResult;
    const firewallResult = {
      risk_level: risk.overallRiskLevel,
      risk_score: risk.riskScore,
      safe_to_auto_apply: risk.safeToAutoApply,
      summary: firstFileFw?.summary || null,
    };

    // If Patch Firewall classified as BLOCKED and not explicitly forced
    if ((risk.overallRiskLevel === 'BLOCKED' || (firstFileFw && firstFileFw.risk_level === 'BLOCKED')) && !context.isForceApproved) {
      return {
        success: false,
        error: `Patch Firewall BLOCKED unsafe modification (Risk score: ${risk.riskScore || 90})`,
        firewall: firewallResult,
        changeSet: changeSet.toJSON(),
        reason: 'FIREWALL_BLOCKED',
      };
    }

    if (context.isApproved || context.isForceApproved) {
      changeSet.approve({
        approvedBy: 'user',
        reason: context.approvalReason || 'Approved by user',
        force: Boolean(context.isForceApproved),
      });
    }

    // 3. Apply atomically via ChangeSet / TransactionalPatchApplier (never raw fs.writeFileSync)
    try {
      const applyOutcome = await changeSet.apply({
        workspacePath: workspaceRoot,
        force: Boolean(context.isForceApproved),
        applier: transactionalPatchApplier,
      });

      if (!applyOutcome.success) {
        return {
          success: false,
          error: applyOutcome.error || 'ChangeSet failed to apply atomically',
          changeSet: changeSet.toJSON(),
          transactionId: applyOutcome.transactionId,
          rolledBack: true,
          reason: applyOutcome.reason || 'TRANSACTION_FAILED',
        };
      }


      return {
        success: true,
        transactionId: applyOutcome.transactionId,
        appliedCount: applyOutcome.appliedCount,
        modifiedFiles: (applyOutcome.modifiedFiles || []).map((m) => ({
          relPath: m.relPath,
          originalLength: m.originalLength,
          newLength: m.newLength,
        })),
        firewall: {
          risk_level: risk.overallRiskLevel || 'AUTO_APPROVE',
          risk_score: risk.riskScore || 10,
          safe_to_auto_apply: Boolean(risk.safeToAutoApply),
        },
        changeSet: changeSet.toJSON(),
      };
    } catch (applyErr) {
      return {
        success: false,
        error: `Transactional patch applier threw an exception: ${applyErr.message}`,
        rolledBack: true,
        changeSet: changeSet.toJSON(),
      };
    }
  },
};

module.exports = ApplyPatchTool;

