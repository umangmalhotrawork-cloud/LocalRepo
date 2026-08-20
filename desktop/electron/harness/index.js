/**
 * NEXUS CODEX HARNESS - MAIN ENTRYPOINT
 * Exports core harness runtime, managers, stores, types, and persistence adapter.
 */

const types = require('./types');
const { harnessEventBus, HarnessEventBus } = require('./eventBus');
const { itemStore, ItemStore } = require('./ItemStore');
const { turnManager, TurnManager } = require('./TurnManager');
const { threadManager, ThreadManager } = require('./ThreadManager');
const { harnessPersistenceAdapter, HarnessPersistenceAdapter } = require('./HarnessPersistenceAdapter');
const { toolRegistry, ToolRegistry } = require('./ToolRegistry');
const { modelAdapter, ModelAdapter } = require('./ModelAdapter');
const { contextEngine, ContextEngine } = require('./ContextEngine');
const { AgentLoop } = require('./AgentLoop');
const { ChangeSet, CHANGESET_STATUS } = require('./ChangeSet');
const { HandoffState, HANDOFF_STATUS } = require('./HandoffState');
const { SubagentManager, subagentManager } = require('./SubagentManager');
const { WorkspaceIsolationManager, workspaceIsolationManager, PROTECTED_COPY_DIRS } = require('./WorkspaceIsolationManager');
const { WorkerRuntime, workerRuntime, WORKER_ENTRY_PATH } = require('./WorkerRuntime');
const { SwarmOrchestrator, swarmOrchestrator } = require('./SwarmOrchestrator');
const tools = require('./tools');
const { harnessRuntime, HarnessRuntime } = require('./HarnessRuntime');
const {
  RequestRouter,
  requestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
} = require('./RequestRouter');
const { CapabilityRegistry, capabilityRegistry } = require('./CapabilityRegistry');
const mcp = require('./mcp');
const skills = require('./skills');
const { ProjectCapabilityLoader, projectCapabilityLoader } = require('./ProjectCapabilityLoader');


const { ChangeConflict, ChangeConflictResolver, perform3WayLineMerge } = require('./ChangeConflictResolver');
const { ASTDiffEngine, astDiffEngine, SUPPORTED_LANGUAGES, NODE_CHANGE_TYPES } = require('./ASTDiffEngine');
const { RepositorySymbolIndex, repositorySymbolIndex, IGNORED_DIRECTORIES, SUPPORTED_EXTENSIONS } = require('./RepositorySymbolIndex');
const { ImpactAnalyzer, impactAnalyzer } = require('./ImpactAnalyzer');
const { RefactorPlan, MAX_REPAIR_CYCLES } = require('./RefactorPlan');

module.exports = {
  ...types,

  harnessEventBus,
  HarnessEventBus,
  itemStore,
  ItemStore,
  turnManager,
  TurnManager,
  threadManager,
  ThreadManager,
  harnessPersistenceAdapter,
  HarnessPersistenceAdapter,
  toolRegistry,
  ToolRegistry,
  capabilityRegistry,
  CapabilityRegistry,
  ...mcp,
  ...skills,
  ProjectCapabilityLoader,
  projectCapabilityLoader,
  modelAdapter,
  ModelAdapter,
  contextEngine,
  ContextEngine,
  AgentLoop,
  ChangeSet,
  CHANGESET_STATUS,
  ChangeConflict,
  ChangeConflictResolver,
  perform3WayLineMerge,
  ASTDiffEngine,
  astDiffEngine,
  SUPPORTED_LANGUAGES,
  NODE_CHANGE_TYPES,
  RepositorySymbolIndex,
  repositorySymbolIndex,
  IGNORED_DIRECTORIES,
  SUPPORTED_EXTENSIONS,
  ImpactAnalyzer,
  impactAnalyzer,
  RefactorPlan,
  MAX_REPAIR_CYCLES,
  HandoffState,
  HANDOFF_STATUS,
  SubagentManager,
  subagentManager,
  WorkspaceIsolationManager,
  workspaceIsolationManager,
  PROTECTED_COPY_DIRS,
  WorkerRuntime,
  workerRuntime,
  WORKER_ENTRY_PATH,
  SwarmOrchestrator,
  swarmOrchestrator,
  tools,
  ...tools,
  harnessRuntime,
  HarnessRuntime,
  RequestRouter,
  requestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
};





