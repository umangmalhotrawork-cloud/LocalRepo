/**
 * CONTINUUM CONTEXT BUILDER v1.0.0
 * Converts validated ContinuumSnapshots into compact, deterministic, provider-neutral
 * context representations suitable for injection into any AI model / system instruction.
 */

const { continuumEngine } = require('./continuum_engine');
const secretFilter = require('../security/secretFilter');

const MAX_CONTEXT_CHARS = 6000; // ~1,500 token budget limit

class ContinuumContextBuilder {
  /**
   * Compiles a validated ContinuumSnapshot into a provider-neutral context payload.
   * Never calls external APIs. Sanitizes all secret credentials. Safe error fallback.
   */
  buildContext(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return this.getFallbackContext("No snapshot provided");
    }

    const validation = continuumEngine.validateSnapshot(snapshot);
    if (!validation.valid) {
      return this.getFallbackContext(`Invalid snapshot: ${validation.errors.join("; ")}`);
    }

    // 1. Sanitize snapshot via secretFilter
    const sanitized = secretFilter.sanitizeObject(snapshot);

    // 2. Build structured provider-neutral markdown components
    const projectSection = [
      `## PROJECT IDENTITY`,
      `- Workspace: ${sanitized.project.workspaceName} (${sanitized.project.workspacePath || "N/A"})`,
      `- Stack: ${sanitized.project.detectedStack?.primaryLanguage || "unknown"} (Frameworks: ${(sanitized.project.detectedStack?.frameworks || []).join(", ") || "none"})`,
      `- BDG Summary: Nodes: ${sanitized.project.bdgGraphSummary?.totalNodes || 0}, Edges: ${sanitized.project.bdgGraphSummary?.totalEdges || 0}`,
    ].join("\n");

    const dirtyFilesStr = (sanitized.codeState?.dirtyFiles || [])
      .map((f) => `${f.relPath} (${f.lineCount} lines, unsaved changes)`)
      .join(", ") || "None";

    const codeSection = [
      `## CANONICAL TARGET & CODE STATE`,
      `- Active Target Node ID: ${sanitized.codeState?.activeTargetNodeId || "None"}`,
      `- Active File: ${sanitized.codeState?.activeFilePath || "None"} (Line: ${sanitized.codeState?.cursorLine || 1})`,
      `- Dirty Files: ${dirtyFilesStr}`,
    ].join("\n");

    const taskSection = [
      `## TASK MILESTONE & PROGRESS`,
      `- User Goal: ${sanitized.task?.userGoal || "None"}`,
      `- Active Milestone: ${sanitized.task?.activeMilestone || "None"}`,
      `- Current Subtask: ${sanitized.task?.currentSubtask || "None"}`,
      `- Completed Steps: ${(sanitized.task?.completedSteps || []).join(", ") || "None"}`,
      `- Pending Steps: ${(sanitized.task?.pendingSteps || []).join(", ") || "None"}`,
    ].join("\n");

    const decisionsFormatted = (sanitized.decisions || [])
      .map((d) => `- [${d.userApproved ? "APPROVED" : "PENDING"}] ${d.decision} (Rationale: ${d.rationale})`)
      .join("\n");

    const decisionsSection = [
      `## APPROVED ENGINEERING DECISIONS`,
      decisionsFormatted || "- None recorded",
    ].join("\n");

    const failingTestsStr = (sanitized.verification?.failingTestNames || []).join(", ") || "None";
    const verificationSection = [
      `## VERIFICATION & BEHAVIORAL DIFF STATE`,
      `- Last Test Status: ${sanitized.verification?.lastTestStatus || "NOT_RUN"}`,
      `- Failing Tests: ${failingTestsStr}`,
      `- Behavioral Risk: ${sanitized.verification?.behavioralDiffSummary?.riskLevel || "LOW"}`,
    ].join("\n");

    const turnsFormatted = (sanitized.conversation?.recentTurns || [])
      .map((t) => `- [${t.status || "UNKNOWN"}] User: "${t.userPrompt}" -> Agent: "${t.agentSummary}"`)
      .join("\n");

    const conversationSection = [
      `## CONSTRUCTED CONVERSATION SUMMARY`,
      sanitized.conversation?.condensedSummary || "No prior conversation summary recorded.",
      turnsFormatted ? `\nRecent Conversation Turns:\n${turnsFormatted}` : "",
    ].filter(Boolean).join("\n");

    const handoffSection = [
      `## HANDOFF DIRECTIVE & NEXT ACTION`,
      `- Immediate Next Action: ${sanitized.handoff?.immediateNextAction || "None"}`,
      `- Last User Directive: ${sanitized.conversation?.lastUserDirective || "None"}`,
    ].join("\n");

    // 3. Assemble full context text
    let fullContextText = [
      `# CONTINUUM CONTEXT HANDOFF SNAPSHOT (Schema v${sanitized.schemaVersion})`,
      `[Session ID: ${sanitized.metadata.sessionId} | Sequence: ${sanitized.metadata.sequenceNumber}]`,
      "",
      projectSection,
      "",
      codeSection,
      "",
      taskSection,
      "",
      decisionsSection,
      "",
      verificationSection,
      "",
      conversationSection,
      "",
      handoffSection,
    ].join("\n");

    // 4. Enforce strict character budget limit (~6,000 characters / ~1,500 tokens)
    if (fullContextText.length > MAX_CONTEXT_CHARS) {
      const budgetHead = fullContextText.slice(0, MAX_CONTEXT_CHARS - 150);
      fullContextText = `${budgetHead}\n\n... [Deterministically capped to ${MAX_CONTEXT_CHARS} characters] ...\n\n${handoffSection}`;
    }

    // 5. Final secret redaction check
    fullContextText = secretFilter.sanitizeString(fullContextText);

    const tokenEstimate = continuumEngine.estimateContextSize(fullContextText);

    return {
      success: true,
      contextText: fullContextText,
      tokenEstimate,
      snapshotId: sanitized.metadata.sessionId,
      sessionId: sanitized.metadata.sessionId,
      parentSessionId: sanitized.metadata.parentSessionId,
    };
  }

  /**
   * Safe fallback context returned on error or malformed snapshot input.
   */
  getFallbackContext(reason = "Fallback") {
    const fallbackText = `### CONTINUUM CONTEXT: Unavailable (${reason})`;
    return {
      success: false,
      contextText: fallbackText,
      tokenEstimate: continuumEngine.estimateContextSize(fallbackText),
      snapshotId: null,
      sessionId: null,
      parentSessionId: null,
    };
  }
}

const continuumContextBuilder = new ContinuumContextBuilder();

module.exports = {
  ContinuumContextBuilder,
  continuumContextBuilder,
  buildContext: (snapshot) => continuumContextBuilder.buildContext(snapshot),
};
