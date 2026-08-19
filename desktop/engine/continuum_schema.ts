/**
 * CONTINUUM SCHEMA v1.0.0
 * Strongly typed schema definitions for Echo Nullity's persistent AI-context continuity system.
 */

export interface ContinuumMetadata {
  sessionId: string;
  parentSessionId: string | null;
  createdAt: number;
  updatedAt: number;
  sequenceNumber: number;
  generatorAgent: string;
}

export interface ContinuumDetectedStack {
  primaryLanguage: string;
  frameworks: string[];
  testRunner: string | null;
}

export interface ContinuumBDGGraphSummary {
  totalNodes: number;
  totalEdges: number;
  entryPointFiles: string[];
}

export interface ContinuumProjectState {
  workspaceName: string;
  workspacePath: string;
  workspaceHash: string;
  detectedStack: ContinuumDetectedStack;
  bdgGraphSummary: ContinuumBDGGraphSummary;
}

export interface ContinuumTaskState {
  userGoal: string;
  activeMilestone: string;
  currentSubtask: string;
  completedSteps: string[];
  pendingSteps: string[];
  blockers: string[];
}

export interface ContinuumDirtyFile {
  relPath: string;
  lineCount: number;
  unsavedChanges: boolean;
}

export interface ContinuumModifiedSymbol {
  symbol: string;
  file: string;
  type: "function" | "variable" | "class";
  mutationStatus: "pending" | "applied" | "rolled_back";
}

export interface ContinuumCodeState {
  activeTargetNodeId: string | null;
  activeFilePath: string | null;
  cursorLine: number | null;
  dirtyFiles: ContinuumDirtyFile[];
  modifiedSymbols: ContinuumModifiedSymbol[];
  workspaceSnapshotId?: string | null;
  surgerySessionIds?: string[];
}

export interface ContinuumDecision {
  timestamp: number;
  decision: string;
  rationale: string;
  rejectedAlternatives: string[];
  userApproved: boolean;
}

export interface ContinuumDiscoveredBug {
  symbol: string;
  file: string;
  line: number;
  description: string;
  rootCause: string;
  status: "open" | "investigating" | "resolved" | "failed_fix";
}

export interface ContinuumDebuggingState {
  discoveredBugs: ContinuumDiscoveredBug[];
  failedFixes: string[];
  successfulFixes: string[];
}

export interface ContinuumBehavioralDiffSummary {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  disconnectedNodesCount: number;
  affectedFilesCount: number;
}

export interface ContinuumPatchFirewallDecision {
  file_path: string;
  risk_level: string;
  risk_score?: number;
  safe_to_auto_apply: boolean;
  decision_summary: string;
  timestamp?: number;
  operation_id?: string;
}

export interface ContinuumVerificationState {
  lastTestStatus: "PASSED" | "FAILED" | "NOT_RUN";
  failingTestNames: string[];
  behavioralDiffSummary: ContinuumBehavioralDiffSummary | null;
  patchFirewallDecisions?: ContinuumPatchFirewallDecision[];
}

export interface ContinuumConversationTurn {
  turnId: string;
  timestamp: number;
  userPrompt: string;
  agentSummary: string;
  status: "IMPLEMENTED" | "VERIFIED" | "PLANNED" | "BLOCKED" | "UNKNOWN";
  providerId?: string;
  modelId?: string;
}

export interface ContinuumConversationState {
  tokenCountEstimate: number;
  condensedSummary: string;
  lastUserDirective: string;
  lastAgentResponseSnippet: string;
  recentTurns?: ContinuumConversationTurn[];
}

export interface ContinuumAIState {
  provider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  activeRole: string;
}

export interface ContinuumHandoffState {
  immediateNextAction: string;
  requiredFilesToLoad: string[];
  unresolvedQuestions: string[];
  systemInstructionOverride: string;
}

export interface ContinuumSnapshot {
  schemaVersion: "1.0.0";
  metadata: ContinuumMetadata;
  project: ContinuumProjectState;
  task: ContinuumTaskState;
  codeState: ContinuumCodeState;
  decisions: ContinuumDecision[];
  debugging: ContinuumDebuggingState;
  verification: ContinuumVerificationState;
  conversation: ContinuumConversationState;
  aiState: ContinuumAIState;
  handoff: ContinuumHandoffState;
}
