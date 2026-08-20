/**
 * NEXUS CODEX HARNESS TOOL - SWARM CANCEL
 * Cancels an active multi-agent swarm and halts all associated child threads and workers.
 */

const { swarmOrchestrator: defaultSwarmOrchestrator } = require('../SwarmOrchestrator');
const secretFilter = require('../../../security/secretFilter');

const SwarmCancelTool = {
  name: 'swarm_cancel',
  description: 'Cancels an active multi-agent swarm and terminates all associated child subagent threads and workers.',
  inputSchema: {
    type: 'object',
    properties: {
      swarmId: {
        type: 'string',
        description: 'Unique identifier of the swarm to cancel',
      },
      reason: {
        type: 'string',
        description: 'Optional cancellation reason or explanation',
      },
    },
    required: ['swarmId'],
  },
  requiresApproval: false,

  async execute(args = {}, context = {}) {
    if (!args || typeof args !== 'object') {
      return {
        success: false,
        error: 'Arguments must be an object containing "swarmId"',
      };
    }

    const { swarmId, reason } = args;

    if (!swarmId || typeof swarmId !== 'string' || !swarmId.trim()) {
      return {
        success: false,
        error: 'Argument "swarmId" must be a non-empty string',
      };
    }

    const orchestrator = context.swarmOrchestrator || context.runtime?.swarmOrchestrator || defaultSwarmOrchestrator;
    const cleanSwarmId = swarmId.trim();

    const record = orchestrator.activeSwarms.get(cleanSwarmId);
    if (!record) {
      return {
        success: false,
        error: `Swarm "${cleanSwarmId}" not found`,
      };
    }

    // Parent ownership boundary check
    if (
      record.plan &&
      record.plan.parentThreadId &&
      context.threadId &&
      record.plan.parentThreadId !== context.threadId
    ) {
      return {
        success: false,
        error: `Permission Denied: Swarm "${cleanSwarmId}" belongs to parent thread "${record.plan.parentThreadId}", not "${context.threadId}".`,
      };
    }

    const cancelReason = typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : 'Swarm cancelled by parent authority';

    try {
      const outcome = orchestrator.cancelSwarm(cleanSwarmId, cancelReason);

      return {
        success: outcome.success,
        swarmId: cleanSwarmId,
        status: outcome.status || 'CANCELLED',
        reason: cancelReason,
      };
    } catch (err) {
      return {
        success: false,
        error: secretFilter.sanitizeString(err.message || 'Failed to cancel swarm'),
        swarmId: cleanSwarmId,
      };
    }
  },
};

module.exports = SwarmCancelTool;
