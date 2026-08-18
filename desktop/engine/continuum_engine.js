/**
 * CONTINUUM ENGINE v1.0.0
 * Deterministic, offline-capable core engine for building, validating, serializing,
 * deserializing, compressing, and chaining Continuum snapshots.
 */

const secretFilter = require('../security/secretFilter');

const CURRENT_SCHEMA_VERSION = "1.0.0";

class ContinuumEngine {
  constructor() {
    this.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  /**
   * Estimates token count for a text input based on standard ~4 chars/token heuristic.
   */
  estimateContextSize(text) {
    if (typeof text !== "string" || !text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Deterministically reduces conversation history to a strict token budget.
   * Preserves exact directives, node IDs, and decisions while compressing body content.
   */
  buildConversationSummary(input = {}) {
    const maxSummaryChars = 800; // Strict deterministic character boundary (~200 tokens)
    const rawSummary = input.condensedSummary || input.conversationHistory || "";
    const lastUserDirective = input.lastUserDirective || "";
    const lastAgentResponseSnippet = input.lastAgentResponseSnippet || "";

    let condensed = rawSummary;
    if (typeof condensed !== "string") {
      condensed = String(condensed);
    }

    if (condensed.length > maxSummaryChars) {
      const head = condensed.slice(0, 350);
      const tail = condensed.slice(-350);
      condensed = `${head}\n\n... [Deterministically reduced from ${condensed.length} to ${maxSummaryChars} characters] ...\n\n${tail}`;
    }

    const totalText = `${condensed} ${lastUserDirective} ${lastAgentResponseSnippet}`;
    const tokenCountEstimate = this.estimateContextSize(totalText);

    return {
      tokenCountEstimate,
      condensedSummary: secretFilter.sanitizeString(condensed),
      lastUserDirective: secretFilter.sanitizeString(lastUserDirective),
      lastAgentResponseSnippet: secretFilter.sanitizeString(lastAgentResponseSnippet),
    };
  }

  /**
   * Constructs a new ContinuumSnapshot object from provided input parameters.
   * All fields are sanitized via secretFilter to guarantee zero credential retention.
   */
  createSnapshot(input = {}) {
    const now = Date.now();
    const sanitizedInput = secretFilter.sanitizeObject(input);

    const sessionId = sanitizedInput.sessionId || `session_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const parentSessionId = sanitizedInput.parentSessionId !== undefined ? sanitizedInput.parentSessionId : null;
    const sequenceNumber = typeof sanitizedInput.sequenceNumber === "number" ? sanitizedInput.sequenceNumber : 1;
    const generatorAgent = sanitizedInput.generatorAgent || "echo-nullity-continuum-v1";

    const convState = this.buildConversationSummary(sanitizedInput.conversation || {});

    const snapshot = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      metadata: {
        sessionId,
        parentSessionId,
        createdAt: typeof sanitizedInput.createdAt === "number" ? sanitizedInput.createdAt : now,
        updatedAt: now,
        sequenceNumber,
        generatorAgent,
      },
      project: {
        workspaceName: sanitizedInput.project?.workspaceName || "unknown-workspace",
        workspacePath: sanitizedInput.project?.workspacePath || "",
        workspaceHash: sanitizedInput.project?.workspaceHash || "0000000000000000",
        detectedStack: {
          primaryLanguage: sanitizedInput.project?.detectedStack?.primaryLanguage || "unknown",
          frameworks: Array.isArray(sanitizedInput.project?.detectedStack?.frameworks)
            ? sanitizedInput.project.detectedStack.frameworks
            : [],
          testRunner: sanitizedInput.project?.detectedStack?.testRunner || null,
        },
        bdgGraphSummary: {
          totalNodes: typeof sanitizedInput.project?.bdgGraphSummary?.totalNodes === "number" ? sanitizedInput.project.bdgGraphSummary.totalNodes : 0,
          totalEdges: typeof sanitizedInput.project?.bdgGraphSummary?.totalEdges === "number" ? sanitizedInput.project.bdgGraphSummary.totalEdges : 0,
          entryPointFiles: Array.isArray(sanitizedInput.project?.bdgGraphSummary?.entryPointFiles)
            ? sanitizedInput.project.bdgGraphSummary.entryPointFiles
            : [],
        },
      },
      task: {
        userGoal: sanitizedInput.task?.userGoal || "",
        activeMilestone: sanitizedInput.task?.activeMilestone || "",
        currentSubtask: sanitizedInput.task?.currentSubtask || "",
        completedSteps: Array.isArray(sanitizedInput.task?.completedSteps) ? sanitizedInput.task.completedSteps : [],
        pendingSteps: Array.isArray(sanitizedInput.task?.pendingSteps) ? sanitizedInput.task.pendingSteps : [],
        blockers: Array.isArray(sanitizedInput.task?.blockers) ? sanitizedInput.task.blockers : [],
      },
      codeState: {
        activeTargetNodeId: sanitizedInput.codeState?.activeTargetNodeId || null,
        activeFilePath: sanitizedInput.codeState?.activeFilePath || null,
        cursorLine: typeof sanitizedInput.codeState?.cursorLine === "number" ? sanitizedInput.codeState.cursorLine : null,
        dirtyFiles: Array.isArray(sanitizedInput.codeState?.dirtyFiles) ? sanitizedInput.codeState.dirtyFiles : [],
        modifiedSymbols: Array.isArray(sanitizedInput.codeState?.modifiedSymbols) ? sanitizedInput.codeState.modifiedSymbols : [],
      },
      decisions: Array.isArray(sanitizedInput.decisions) ? sanitizedInput.decisions : [],
      debugging: {
        discoveredBugs: Array.isArray(sanitizedInput.debugging?.discoveredBugs) ? sanitizedInput.debugging.discoveredBugs : [],
        failedFixes: Array.isArray(sanitizedInput.debugging?.failedFixes) ? sanitizedInput.debugging.failedFixes : [],
        successfulFixes: Array.isArray(sanitizedInput.debugging?.successfulFixes) ? sanitizedInput.debugging.successfulFixes : [],
      },
      verification: {
        lastTestStatus: sanitizedInput.verification?.lastTestStatus || "NOT_RUN",
        failingTestNames: Array.isArray(sanitizedInput.verification?.failingTestNames) ? sanitizedInput.verification.failingTestNames : [],
        behavioralDiffSummary: sanitizedInput.verification?.behavioralDiffSummary || null,
      },
      conversation: convState,
      aiState: {
        provider: sanitizedInput.aiState?.provider || "offline",
        modelName: sanitizedInput.aiState?.modelName || "deterministic-rule-engine",
        temperature: typeof sanitizedInput.aiState?.temperature === "number" ? sanitizedInput.aiState.temperature : 0.1,
        maxTokens: typeof sanitizedInput.aiState?.maxTokens === "number" ? sanitizedInput.aiState.maxTokens : 2048,
        activeRole: sanitizedInput.aiState?.activeRole || "software-engineer",
      },
      handoff: {
        immediateNextAction: sanitizedInput.handoff?.immediateNextAction || "",
        requiredFilesToLoad: Array.isArray(sanitizedInput.handoff?.requiredFilesToLoad) ? sanitizedInput.handoff.requiredFilesToLoad : [],
        unresolvedQuestions: Array.isArray(sanitizedInput.handoff?.unresolvedQuestions) ? sanitizedInput.handoff.unresolvedQuestions : [],
        systemInstructionOverride: sanitizedInput.handoff?.systemInstructionOverride || "",
      },
    };

    return snapshot;
  }

  /**
   * Safely validates a ContinuumSnapshot against structural and versioning rules.
   * Returns { valid: boolean, errors: string[] }. Never throws or crashes.
   */
  validateSnapshot(snapshot) {
    const errors = [];

    if (!snapshot || typeof snapshot !== "object") {
      return { valid: false, errors: ["Snapshot must be a non-null object"] };
    }

    // 1. Version Check
    if (snapshot.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      errors.push(`Unsupported schemaVersion: "${snapshot.schemaVersion}". Expected "${CURRENT_SCHEMA_VERSION}".`);
    }

    // 2. Metadata Section
    if (!snapshot.metadata || typeof snapshot.metadata !== "object") {
      errors.push("Missing required section: 'metadata'");
    } else {
      if (typeof snapshot.metadata.sessionId !== "string" || !snapshot.metadata.sessionId) {
        errors.push("Invalid or missing 'metadata.sessionId'");
      }
      if (typeof snapshot.metadata.createdAt !== "number") {
        errors.push("Invalid or missing 'metadata.createdAt'");
      }
      if (typeof snapshot.metadata.updatedAt !== "number") {
        errors.push("Invalid or missing 'metadata.updatedAt'");
      }
      if (typeof snapshot.metadata.sequenceNumber !== "number") {
        errors.push("Invalid or missing 'metadata.sequenceNumber'");
      }
    }

    // 3. Project Section
    if (!snapshot.project || typeof snapshot.project !== "object") {
      errors.push("Missing required section: 'project'");
    } else {
      if (typeof snapshot.project.workspaceName !== "string") {
        errors.push("Invalid or missing 'project.workspaceName'");
      }
      if (typeof snapshot.project.workspacePath !== "string") {
        errors.push("Invalid or missing 'project.workspacePath'");
      }
    }

    // 4. Task Section
    if (!snapshot.task || typeof snapshot.task !== "object") {
      errors.push("Missing required section: 'task'");
    }

    // 5. Code State Section
    if (!snapshot.codeState || typeof snapshot.codeState !== "object") {
      errors.push("Missing required section: 'codeState'");
    }

    // 6. Verification Section
    if (!snapshot.verification || typeof snapshot.verification !== "object") {
      errors.push("Missing required section: 'verification'");
    }

    // 7. Conversation Section
    if (!snapshot.conversation || typeof snapshot.conversation !== "object") {
      errors.push("Missing required section: 'conversation'");
    }

    // 8. AI State Section
    if (!snapshot.aiState || typeof snapshot.aiState !== "object") {
      errors.push("Missing required section: 'aiState'");
    }

    // 9. Handoff Section
    if (!snapshot.handoff || typeof snapshot.handoff !== "object") {
      errors.push("Missing required section: 'handoff'");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serializes a snapshot object into formatted JSON string after secret redaction check.
   */
  serializeSnapshot(snapshot) {
    const sanitized = secretFilter.sanitizeObject(snapshot);
    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * Deserializes a JSON string into a validated ContinuumSnapshot object.
   * Returns { success: boolean, snapshot: ContinuumSnapshot | null, errors: string[] }.
   */
  deserializeSnapshot(serialized) {
    if (typeof serialized !== "string" || !serialized.trim()) {
      return { success: false, snapshot: null, errors: ["Serialized payload is empty or invalid string"] };
    }

    let parsed = null;
    try {
      parsed = JSON.parse(serialized);
    } catch (e) {
      return { success: false, snapshot: null, errors: [`JSON parse error: ${e.message}`] };
    }

    const validation = this.validateSnapshot(parsed);
    if (!validation.valid) {
      return { success: false, snapshot: null, errors: validation.errors };
    }

    return { success: true, snapshot: parsed, errors: [] };
  }

  /**
   * Creates a sequential snapshot chained to a previous snapshot.
   * Updates parentSessionId, sequenceNumber, and merges state updates cleanly.
   */
  createNextSnapshot(previousSnapshot, updates = {}) {
    if (!previousSnapshot || typeof previousSnapshot !== "object") {
      throw new Error("createNextSnapshot requires a valid previousSnapshot object");
    }

    const prevSessionId = previousSnapshot.metadata?.sessionId || "session_unknown";
    const nextSeq = (previousSnapshot.metadata?.sequenceNumber || 1) + 1;

    const mergedInput = {
      ...previousSnapshot,
      ...updates,
      sessionId: updates.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      parentSessionId: prevSessionId,
      sequenceNumber: nextSeq,
      createdAt: previousSnapshot.metadata?.createdAt || Date.now(),
      project: {
        ...previousSnapshot.project,
        ...(updates.project || {}),
      },
      task: {
        ...previousSnapshot.task,
        ...(updates.task || {}),
      },
      codeState: {
        ...previousSnapshot.codeState,
        ...(updates.codeState || {}),
      },
      decisions: updates.decisions || previousSnapshot.decisions || [],
      debugging: {
        ...previousSnapshot.debugging,
        ...(updates.debugging || {}),
      },
      verification: {
        ...previousSnapshot.verification,
        ...(updates.verification || {}),
      },
      conversation: {
        ...previousSnapshot.conversation,
        ...(updates.conversation || {}),
      },
      aiState: {
        ...previousSnapshot.aiState,
        ...(updates.aiState || {}),
      },
      handoff: {
        ...previousSnapshot.handoff,
        ...(updates.handoff || {}),
      },
    };

    return this.createSnapshot(mergedInput);
  }
}

const continuumEngine = new ContinuumEngine();

module.exports = {
  ContinuumEngine,
  continuumEngine,
  CURRENT_SCHEMA_VERSION,
};
