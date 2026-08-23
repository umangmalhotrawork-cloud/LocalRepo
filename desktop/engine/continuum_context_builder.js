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
      const notice = `\n\n... [Deterministically capped to ${MAX_CONTEXT_CHARS} characters] ...\n\n${handoffSection}`;
      const allowedHeadLength = Math.max(0, MAX_CONTEXT_CHARS - notice.length);
      const budgetHead = fullContextText.slice(0, allowedHeadLength);
      fullContextText = `${budgetHead}${notice}`;
      if (fullContextText.length > MAX_CONTEXT_CHARS) {
        fullContextText = fullContextText.slice(0, MAX_CONTEXT_CHARS);
      }
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
   * Generates a concise synthesized handoff prompt matching the exact NEXUS Continuum specification:
   * 
   * CONTINUUM HANDOFF FROM PREVIOUS CHAT
   * 
   * Project:
   * ...
   * 
   * Important repeated context:
   * ...
   * 
   * Important decisions:
   * ...
   * 
   * Last 3 meaningful exchanges:
   * ...
   * 
   * Current state:
   * ...
   * 
   * Relevant files:
   * ...
   * 
   * Open issues / next action:
   * ...
   * 
   * Continue from this context.
   */
  buildSynthesizedHandoffPrompt(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return this.getFallbackContext("No snapshot provided");
    }

    const validation = continuumEngine.validateSnapshot(snapshot);
    if (!validation.valid) {
      return this.getFallbackContext(`Invalid snapshot: ${validation.errors.join("; ")}`);
    }

    const sanitized = secretFilter.sanitizeObject(snapshot);

    // 1. Project
    const projectLines = [
      `- Workspace: ${sanitized.project.workspaceName || "workspace"}`,
      `- Stack: ${sanitized.project.detectedStack?.primaryLanguage || "unknown"}${sanitized.project.detectedStack?.frameworks?.length ? ` (${sanitized.project.detectedStack.frameworks.join(", ")})` : ""}`,
      sanitized.project.detectedStack?.testRunner ? `- Test Runner: ${sanitized.project.detectedStack.testRunner}` : null,
    ].filter(Boolean);

    // 2. Important Repeated Context (Architecture facts, model routing rules, constraints)
    const repeatedContextLines = [];
    if (sanitized.decisions && Array.isArray(sanitized.decisions)) {
      for (const d of sanitized.decisions) {
        if (/NEXUS|Gemini|Groq|ChangeSet|Firewall|architecture|workflow|rule|constraint|model/i.test(d.decision)) {
          repeatedContextLines.push(`- ${d.decision}`);
        }
      }
    }
    if (sanitized.handoff?.systemInstructionOverride) {
      repeatedContextLines.push(`- Directive: ${sanitized.handoff.systemInstructionOverride}`);
    }
    if (repeatedContextLines.length === 0) {
      repeatedContextLines.push("- Maintain strict separation of concerns, surgical changesets, and verified testing.");
    }

    // 3. Important Decisions
    const decisionLines = [];
    if (Array.isArray(sanitized.decisions) && sanitized.decisions.length > 0) {
      for (const d of sanitized.decisions) {
        const rationale = d.rationale ? ` (Rationale: ${d.rationale})` : "";
        decisionLines.push(`- [${d.userApproved ? "APPROVED" : "PENDING"}] ${d.decision}${rationale}`);
      }
    } else {
      decisionLines.push("- None recorded");
    }

    // 4. Last 3 Meaningful Exchanges (NOT raw transcript dump, but concise summary of last 3 exchanges)
    const recentTurns = Array.isArray(sanitized.conversation?.recentTurns) ? sanitized.conversation.recentTurns : [];
    const last3Turns = recentTurns.slice(-3);
    const exchangeLines = [];
    if (last3Turns.length > 0) {
      for (const t of last3Turns) {
        const userShort = (t.userPrompt || "").replace(/\n+/g, " ").slice(0, 140);
        const agentShort = (t.agentSummary || "").replace(/\n+/g, " ").slice(0, 140);
        exchangeLines.push(`- User: "${userShort}" -> Assistant: "${agentShort}"`);
      }
    } else if (sanitized.conversation?.lastUserDirective) {
      exchangeLines.push(`- User: "${sanitized.conversation.lastUserDirective.slice(0, 140)}" -> Completed`);
    } else {
      exchangeLines.push("- No prior exchanges in previous session.");
    }

    // 5. Current State
    const stateLines = [
      sanitized.task?.userGoal ? `- Goal: ${sanitized.task.userGoal}` : null,
      sanitized.task?.activeMilestone ? `- Active Milestone: ${sanitized.task.activeMilestone}` : null,
      sanitized.task?.currentSubtask ? `- Current Subtask: ${sanitized.task.currentSubtask}` : null,
      sanitized.task?.completedSteps?.length ? `- Completed: ${sanitized.task.completedSteps.join(", ")}` : null,
      sanitized.verification?.lastTestStatus && sanitized.verification.lastTestStatus !== "NOT_RUN" ? `- Last Test Status: ${sanitized.verification.lastTestStatus}` : null,
    ].filter(Boolean);
    if (stateLines.length === 0) {
      stateLines.push("- Workspace initialized and idle.");
    }

    // 6. Relevant Files
    const relevantFiles = new Set();
    if (sanitized.codeState?.activeFilePath) relevantFiles.add(sanitized.codeState.activeFilePath);
    if (Array.isArray(sanitized.codeState?.dirtyFiles)) {
      sanitized.codeState.dirtyFiles.forEach((df) => df.relPath && relevantFiles.add(df.relPath));
    }
    if (Array.isArray(sanitized.handoff?.requiredFilesToLoad)) {
      sanitized.handoff.requiredFilesToLoad.forEach((rf) => relevantFiles.add(rf));
    }
    const relevantFilesLines = relevantFiles.size > 0 
      ? Array.from(relevantFiles).map((f) => `- ${f}`)
      : ["- None specifically targeted"];

    // 7. Open issues / next action
    const openIssueLines = [];
    if (sanitized.handoff?.immediateNextAction) {
      openIssueLines.push(`- Immediate Next Action: ${sanitized.handoff.immediateNextAction}`);
    }
    if (Array.isArray(sanitized.handoff?.unresolvedQuestions) && sanitized.handoff.unresolvedQuestions.length > 0) {
      for (const q of sanitized.handoff.unresolvedQuestions) {
        openIssueLines.push(`- Unresolved: ${q}`);
      }
    }
    if (Array.isArray(sanitized.task?.pendingSteps) && sanitized.task.pendingSteps.length > 0) {
      for (const p of sanitized.task.pendingSteps) {
        openIssueLines.push(`- Pending Step: ${p}`);
      }
    }
    if (openIssueLines.length === 0) {
      openIssueLines.push("- Ready for next directive.");
    }

    // Assemble the complete synthesized handoff
    const sections = [
      "CONTINUUM HANDOFF FROM PREVIOUS CHAT",
      "",
      "Project:",
      projectLines.join("\n"),
      "",
      "Important repeated context:",
      repeatedContextLines.join("\n"),
      "",
      "Important decisions:",
      decisionLines.join("\n"),
      "",
      "Last 3 meaningful exchanges:",
      exchangeLines.join("\n"),
      "",
      "Current state:",
      stateLines.join("\n"),
      "",
      "Relevant files:",
      relevantFilesLines.join("\n"),
      "",
      "Open issues / next action:",
      openIssueLines.join("\n"),
      "",
      "Continue from this context.",
    ];

    let fullPrompt = sections.join("\n");

    // Enforce budget limit
    if (fullPrompt.length > MAX_CONTEXT_CHARS) {
      const notice = "\n\n... [Handoff capped for token efficiency] ...\n\nContinue from this context.";
      const allowedHeadLength = Math.max(0, MAX_CONTEXT_CHARS - notice.length);
      fullPrompt = fullPrompt.slice(0, allowedHeadLength) + notice;
    }

    fullPrompt = secretFilter.sanitizeString(fullPrompt);

    return {
      success: true,
      contextText: fullPrompt,
      handoffText: fullPrompt,
      tokenEstimate: continuumEngine.estimateContextSize(fullPrompt),
      snapshot: sanitized,
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
      handoffText: fallbackText,
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
  buildSynthesizedHandoffPrompt: (snapshot) => continuumContextBuilder.buildSynthesizedHandoffPrompt(snapshot),
};
