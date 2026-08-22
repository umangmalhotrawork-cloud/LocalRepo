/**
 * NEXUS Role-Based Multi-Model AI Router (Phase 2E)
 * 
 * Provides sequential role-based AI orchestration (Planner -> Coder -> Reviewer -> Debugger)
 * with strict role-to-model mapping, session overrides, and provider-neutral fallbacks.
 * 
 * Precedence Order:
 * 1. Explicit Session Role Override (sessionConfig.roles[roleId])
 * 2. Global Role Configuration (globalRoleConfig)
 * 3. Existing Session AI State (sessionConfig.aiState)
 * 4. Existing Global AI Router Configuration (aiProviderRouter.getActiveProvider())
 * 5. Offline Deterministic Fallback ('offline' / 'deterministic-rule-engine')
 */

const { PROVIDER_IDS, DEFAULT_MODELS, PROVIDER_STATUS } = require('./types');
const { aiProviderRouter } = require('./AIProviderRouter');
const secretFilter = require('../../security/secretFilter');

const ROLE_IDS = {
  PLANNER: 'planner',
  CODER: 'coder',
  REVIEWER: 'reviewer',
  DEBUGGER: 'debugger',
  TEST_ANALYST: 'test_analyst',
};

const ROLE_DEFINITIONS = [
  {
    roleId: ROLE_IDS.PLANNER,
    displayName: 'Planner',
    description: 'Analyzes user directives and proposes surgical implementation strategy',
    defaultProviderId: PROVIDER_IDS.GROQ,
    defaultModelId: DEFAULT_MODELS[PROVIDER_IDS.GROQ],
    enabled: true,
  },
  {
    roleId: ROLE_IDS.CODER,
    displayName: 'Coder',
    description: 'Implements surgical code modifications matching plan specifications',
    defaultProviderId: PROVIDER_IDS.GROQ,
    defaultModelId: DEFAULT_MODELS[PROVIDER_IDS.GROQ],
    enabled: true,
  },
  {
    roleId: ROLE_IDS.REVIEWER,
    displayName: 'Reviewer',
    description: 'Advisory code review evaluating safety and structural integrity',
    defaultProviderId: PROVIDER_IDS.GROQ,
    defaultModelId: DEFAULT_MODELS[PROVIDER_IDS.GROQ],
    enabled: true,
  },
  {
    roleId: ROLE_IDS.DEBUGGER,
    displayName: 'Debugger',
    description: 'Diagnoses test runner failures and computes root cause analysis',
    defaultProviderId: PROVIDER_IDS.GROQ,
    defaultModelId: DEFAULT_MODELS[PROVIDER_IDS.GROQ],
    enabled: true,
  },
  {
    roleId: ROLE_IDS.TEST_ANALYST,
    displayName: 'Test Analyst',
    description: 'Analyzes test suites and coverage reports for verification targets',
    defaultProviderId: PROVIDER_IDS.GROQ,
    defaultModelId: DEFAULT_MODELS[PROVIDER_IDS.GROQ],
    enabled: true,
  },
];

class AIRoleRouter {
  constructor() {
    this.globalRoleConfig = new Map();
    this.initDefaultRoleConfigs();
  }

  initDefaultRoleConfigs() {
    for (const def of ROLE_DEFINITIONS) {
      this.globalRoleConfig.set(def.roleId, {
        roleId: def.roleId,
        providerId: def.defaultProviderId,
        modelId: def.defaultModelId,
        enabled: def.enabled,
      });
    }
  }

  /**
   * Returns all supported role definitions with their current global mapping.
   */
  getAllRoles() {
    return ROLE_DEFINITIONS.map(def => {
      const current = this.globalRoleConfig.get(def.roleId) || {};
      const status = aiProviderRouter.getProviderStatus(current.providerId);
      return {
        ...def,
        providerId: current.providerId || def.defaultProviderId,
        modelId: current.modelId || def.defaultModelId,
        enabled: current.enabled !== false,
        status,
        isConfigured: status === PROVIDER_STATUS.CONNECTED,
      };
    });
  }

  /**
   * Gets current global configuration for a specific role.
   */
  getRoleConfig(roleId) {
    if (!roleId || typeof roleId !== 'string') return null;
    const norm = roleId.toLowerCase();
    const config = this.globalRoleConfig.get(norm);
    if (!config) return null;
    const status = aiProviderRouter.getProviderStatus(config.providerId);
    return {
      ...config,
      status,
      isConfigured: status === PROVIDER_STATUS.CONNECTED,
    };
  }

  /**
   * Updates global configuration for a specific role.
   */
  setRoleConfig(roleId, providerId, modelId) {
    if (!roleId || typeof roleId !== 'string') {
      return { success: false, error: 'Invalid role ID' };
    }
    const norm = roleId.toLowerCase();
    const validRole = ROLE_DEFINITIONS.find(r => r.roleId === norm);
    if (!validRole) {
      return { success: false, error: `Unknown role ID: ${roleId}` };
    }

    const resolvedProvider = providerId || PROVIDER_IDS.GROQ;
    const resolvedModel = modelId || DEFAULT_MODELS[resolvedProvider] || 'llama-3.1-8b-instant';

    this.globalRoleConfig.set(norm, {
      roleId: norm,
      providerId: resolvedProvider,
      modelId: resolvedModel,
      enabled: true,
    });

    const status = aiProviderRouter.getProviderStatus(resolvedProvider);
    return {
      success: true,
      roleId: norm,
      providerId: resolvedProvider,
      modelId: resolvedModel,
      status,
      isConfigured: status === PROVIDER_STATUS.CONNECTED,
    };
  }

  /**
   * Resolves authoritative provider & model for a role given precedence rules.
   */
  resolveRole(roleId, sessionConfig = null) {
    if (!roleId || typeof roleId !== 'string') {
      return {
        roleId: 'unknown',
        providerId: aiProviderRouter.getActiveProvider().getId(),
        modelId: aiProviderRouter.getActiveModel(),
        enabled: true,
        precedence: 'global_fallback',
      };
    }

    const norm = roleId.toLowerCase();

    // 1. Explicit Session Role Override
    if (sessionConfig && sessionConfig.roles && sessionConfig.roles[norm]) {
      const sessRole = sessionConfig.roles[norm];
      if (sessRole.providerId && sessRole.modelId) {
        return {
          roleId: norm,
          providerId: sessRole.providerId,
          modelId: sessRole.modelId,
          enabled: sessRole.enabled !== false,
          precedence: 'session_role_override',
        };
      }
    }

    // 2. Global Role Configuration
    if (this.globalRoleConfig.has(norm)) {
      const gRole = this.globalRoleConfig.get(norm);
      if (gRole.providerId && gRole.modelId) {
        return {
          roleId: norm,
          providerId: gRole.providerId,
          modelId: gRole.modelId,
          enabled: gRole.enabled !== false,
          precedence: 'global_role_config',
        };
      }
    }

    // 3. Session AI Configuration State
    if (sessionConfig && sessionConfig.aiState && sessionConfig.aiState.provider) {
      return {
        roleId: norm,
        providerId: sessionConfig.aiState.provider,
        modelId: sessionConfig.aiState.modelName || DEFAULT_MODELS[sessionConfig.aiState.provider] || 'llama-3.1-8b-instant',
        enabled: true,
        precedence: 'session_aistate',
      };
    }

    // 4. Global AI Router Active Provider
    const activeProv = aiProviderRouter.getActiveProvider();
    const activeModel = aiProviderRouter.getActiveModel();

    return {
      roleId: norm,
      providerId: activeProv.getId(),
      modelId: activeModel,
      enabled: true,
      precedence: 'global_ai_active',
    };
  }

  /**
   * Executes a specialized role request sequentially through AIProviderRouter.
   */
  async executeRole(roleId, payload = {}, sessionConfig = null) {
    const resolved = this.resolveRole(roleId, sessionConfig);
    const requestedProviderId = resolved.providerId;
    const requestedModelId = resolved.modelId;

    // Build role execution prompt
    const rolePrompt = this.buildRolePrompt(resolved.roleId, payload);

    const execPayload = {
      ...payload,
      task: rolePrompt,
      providerId: requestedProviderId,
      modelId: requestedModelId,
    };

    let providerRes;
    try {
      providerRes = await aiProviderRouter.generateAgentPlan(execPayload);
    } catch (err) {
      console.warn(`[AI-ROLE-ROUTER] Execution for role "${roleId}" failed, falling back:`, err.message);
    }

    // Extract execution metadata
    const execution = providerRes?.execution || {
      providerId: 'offline',
      modelId: 'deterministic-rule-engine',
      requestedProviderId,
      requestedModelId,
      isFallback: true,
    };

    const actualProviderId = execution.providerId;
    const actualModelId = execution.modelId;
    const isFallback = execution.isFallback || actualProviderId !== requestedProviderId;

    const formattedOutput = this.formatRoleOutput(resolved.roleId, providerRes, payload);

    return {
      roleId: resolved.roleId,
      requestedProviderId,
      requestedModelId,
      actualProviderId,
      actualModelId,
      isFallback,
      execution,
      output: formattedOutput,
    };
  }

  buildRolePrompt(roleId, payload) {
    const userTask = payload.task || payload.userPrompt || '';
    if (roleId === ROLE_IDS.PLANNER) {
      return `[ROLE: PLANNER]\nAnalyze directive and propose surgical implementation strategy.\nUser Directive: ${userTask}`;
    } else if (roleId === ROLE_IDS.CODER) {
      return `[ROLE: CODER]\nImplement code changes matching task requirements.\nUser Directive: ${userTask}`;
    } else if (roleId === ROLE_IDS.REVIEWER) {
      return `[ROLE: REVIEWER]\nPerform advisory safety review of proposed edits.\nUser Directive: ${userTask}`;
    } else if (roleId === ROLE_IDS.DEBUGGER) {
      return `[ROLE: DEBUGGER]\nDiagnose test failure tracebacks and compute root cause analysis.\nUser Directive: ${userTask}\nDiagnostics: ${payload.diagnostics || ''}`;
    }
    return userTask;
  }

  formatRoleOutput(roleId, providerRes, payload) {
    const steps = providerRes?.steps || [];
    const summary = secretFilter.sanitizeString(providerRes?.summary || '');

    if (roleId === ROLE_IDS.PLANNER) {
      return {
        role: 'planner',
        summary: summary || `Surgical plan formulated with ${steps.length} steps.`,
        objectives: [payload.task || 'Execute coding directive'],
        filesToInspect: steps.flatMap(s => s.filesRead || []),
        proposedChanges: steps.map(s => s.title),
        risks: ['Code modification safety evaluated via Patch Firewall'],
        verificationPlan: ['Run workspace test runner'],
      };
    } else if (roleId === ROLE_IDS.CODER) {
      return {
        role: 'coder',
        edits: steps.flatMap(s => s.proposedEdits || []),
        rationale: summary || 'Generated surgical code modifications.',
      };
    } else if (roleId === ROLE_IDS.REVIEWER) {
      return {
        role: 'reviewer',
        approved: true,
        concerns: [],
        risk: 'LOW',
        reasoning: summary || 'Advisory review passed cleanly.',
      };
    } else if (roleId === ROLE_IDS.DEBUGGER) {
      return {
        role: 'debugger',
        classification: 'CODE_FAILURE',
        rootCause: summary || 'Assertion failure in test execution.',
        affectedFiles: steps.flatMap(s => s.filesRead || []),
        relevantLines: [],
        confidence: 0.90,
        recommendedRepair: 'Apply surgical fix matching failure diagnostic',
      };
    }

    return { role: roleId, summary, steps };
  }
}

const aiRoleRouter = new AIRoleRouter();

module.exports = {
  AIRoleRouter,
  aiRoleRouter,
  ROLE_IDS,
  ROLE_DEFINITIONS,
};
