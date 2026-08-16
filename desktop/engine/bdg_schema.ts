/**
 * Behavioral Dependency Graph (BDG) Schema Definitions
 * Defines normalized Node, Edge, Graph Query, Runtime Telemetry, What-If, Behavioral Diff, and AI Reasoning/Mutation interfaces.
 */

export type BDGNodeType =
  | "file"
  | "module"
  | "function"
  | "class"
  | "variable"
  | "external-api"
  | "database-op"
  | "command"
  | "test";

export type BDGRelationshipType =
  | "imports"
  | "calls"
  | "reads"
  | "writes"
  | "mutates"
  | "returns-to"
  | "instantiates"
  | "inherits"
  | "invokes"
  | "external-call"
  | "database-read"
  | "database-write"
  | "test-covers";

export interface BDGLocation {
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
}

export interface BDGNode {
  id: string;
  type: BDGNodeType;
  file: string;
  symbol: string;
  location: BDGLocation;
  language: "python" | "javascript" | "typescript" | "generic";
  metadata?: Record<string, any>;
  runtimeTelemetry?: BDGNodeRuntimeTelemetry;
}

export interface BDGEdge {
  id: string;
  source: string;
  target: string;
  relationship: BDGRelationshipType;
  sourceLocation?: BDGLocation;
  confidence?: number;
}

export interface BDGGraphData {
  nodes: Record<string, BDGNode>;
  edges: BDGEdge[];
}

export interface BDGQueryResult {
  node: BDGNode | null;
  callers: BDGNode[];
  callees: BDGNode[];
  reads: BDGNode[];
  writes: BDGNode[];
  externalEffects: BDGNode[];
  directDependencies: BDGNode[];
  transitiveDependencies: BDGNode[];
}

export type ImpactConfidence = "CERTAIN" | "PROBABLE" | "INFERRED";

export interface BlastRadiusItem {
  node: BDGNode;
  relationship: string;
  confidence: ImpactConfidence;
  depth: number;
  reasoning: string;
}

export interface BlastRadiusRiskSummary {
  filesAffectedCount: number;
  functionsAffectedCount: number;
  externalSystemsCount: number;
  testsCount: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface BlastRadiusResult {
  targetNode: BDGNode | null;
  certainItems: BlastRadiusItem[];
  probableItems: BlastRadiusItem[];
  inferredItems: BlastRadiusItem[];
  affectedFiles: string[];
  affectedFunctions: BDGNode[];
  externalEffects: BDGNode[];
  coveringTests: BDGNode[];
  riskSummary: BlastRadiusRiskSummary;
}

export type RuntimeSessionType = "current" | "previous" | "test_run" | "debug_run";

export interface RuntimeExecutionEvent {
  id: string;
  nodeId: string;
  file: string;
  symbol: string;
  eventType: "execute" | "call" | "error" | "return";
  timestamp: number;
  executionCount: number;
  durationMs?: number | null;
  success: boolean;
  callerSymbol?: string | null;
  sessionId: string;
  sessionType: RuntimeSessionType;
}

export interface BDGNodeRuntimeTelemetry {
  observed: boolean;
  executionCount: number;
  lastSeen: number | null;
  averageDurationMs: number | null;
  errorCount: number;
  observedCallers: string[];
  sessions: string[];
}

export interface RuntimeCallChainComparison {
  staticCallers: BDGNode[];
  runtimeCallers: string[];
  unobservedCallers: BDGNode[];
}

export type WhatIfOperationType =
  | "remove-node"
  | "remove-call"
  | "remove-variable-write"
  | "disable-external-api"
  | "disable-database-op";

export interface WhatIfRequest {
  targetNodeId: string;
  operation: WhatIfOperationType;
  secondaryNodeId?: string;
}

export interface WhatIfComparisonResult {
  operation: WhatIfOperationType;
  targetNode: BDGNode | null;
  originalRiskLevel: string;
  hypotheticalRiskLevel: string;
  removedEdges: BDGEdge[];
  newlyDisconnectedNodes: BDGNode[];
  newlyAffectedNodes: BDGNode[];
  runtimeObservedImpact: {
    observedExecutionsLost: number;
    errorCountSaved: number;
    observedCallersImpacted: string[];
  };
  predictedRisks: string[];
}

export type StructuralChangeType =
  | "node_added"
  | "node_removed"
  | "call_changed"
  | "dependency_changed"
  | "db_op_changed"
  | "external_api_changed";

export interface StructuralChangeItem {
  type: StructuralChangeType;
  node: BDGNode;
  detail: string;
}

export interface BehavioralDiffReport {
  gitStatus: { modifiedFiles: string[]; stagedFiles: string[] };
  hasBehavioralChange: boolean;
  textualChangeOnly: boolean;
  structuralChanges: StructuralChangeItem[];
  impactedFunctions: BDGNode[];
  impactedFiles: string[];
  impactedTests: BDGNode[];
  impactedDbOps: BDGNode[];
  impactedExternalApis: BDGNode[];
  runtimeEvidenceSummary: {
    totalObservedExecutions: number;
    observedCallers: string[];
    errorsInvolved: number;
  };
  whatIfPredictions: WhatIfComparisonResult[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export type AIProposalStatus = "pending" | "approved" | "applied" | "rejected" | "rolled_back" | "error";

export interface AIReasoningProposal {
  id: string;
  targetSymbol: string;
  targetFile: string;
  startLine: number;
  problemSummary: string;
  whyItMatters: string;
  affectedCallersDependencies: BDGNode[];
  runtimeEvidence: BDGNodeRuntimeTelemetry;
  predictedBlastRadius: BlastRadiusRiskSummary;
  whatIfResult: WhatIfComparisonResult;
  originalCode: string;
  proposedCode: string;
  expectedBehavioralImpact: string;
  verificationPlan: string;
  status: AIProposalStatus;
  verificationResult?: {
    success: boolean;
    diffReport?: BehavioralDiffReport;
    message: string;
  };
}
