/**
 * NEXUS CODEX HARNESS - RUNTIME ORCHESTRATOR
 * Coordinates ThreadManager, TurnManager, ItemStore, EventBus, and Persistence Adapter
 * to enforce deterministic, multi-turn, multi-item headless agent execution lifecycles.
 */

const { harnessEventBus, HarnessEventBus } = require('./eventBus');
const { itemStore, ItemStore } = require('./ItemStore');
const { turnManager, TurnManager } = require('./TurnManager');
const { threadManager, ThreadManager } = require('./ThreadManager');
const { harnessPersistenceAdapter, HarnessPersistenceAdapter } = require('./HarnessPersistenceAdapter');
const { toolRegistry, ToolRegistry } = require('./ToolRegistry');
const { modelAdapter, ModelAdapter } = require('./ModelAdapter');
const { contextEngine, ContextEngine } = require('./ContextEngine');
const { AgentLoop } = require('./AgentLoop');
const { ChangeSet } = require('./ChangeSet');
const { HandoffState } = require('./HandoffState');
const { SubagentManager, subagentManager } = require('./SubagentManager');
const { WorkspaceIsolationManager, workspaceIsolationManager } = require('./WorkspaceIsolationManager');
const { WorkerRuntime, workerRuntime } = require('./WorkerRuntime');
const { SwarmOrchestrator, swarmOrchestrator } = require('./SwarmOrchestrator');
const { registerCoreTools } = require('./tools');
const { requestRouter, RequestRouter, ROUTER_MODES, CODING_INTENTS } = require('./RequestRouter');
const { aiProviderRouter } = require('../ai/AIProviderRouter');
const { capabilityRegistry, CapabilityRegistry } = require('./CapabilityRegistry');
const { mcpServerManager, MCPServerManager } = require('./mcp');
const { skillRegistry, SkillRegistry } = require('./skills');
const { ProjectCapabilityLoader, projectCapabilityLoader } = require('./ProjectCapabilityLoader');
const { ChangeConflictResolver } = require('./ChangeConflictResolver');
const { RepositorySymbolIndex, repositorySymbolIndex } = require('./RepositorySymbolIndex');
const { ImpactAnalyzer, impactAnalyzer } = require('./ImpactAnalyzer');
const { RefactorPlan } = require('./RefactorPlan');
const {
  THREAD_STATUS,
  TURN_STATUS,
  ITEM_STATUS,
  ITEM_TYPES,
  EVENT_TYPES,
} = require('./types');


class HarnessRuntime {
  constructor(options = {}) {
    if (options.isolated) {
      this.eventBus = options.eventBus || new HarnessEventBus();
      this.itemStore = options.itemStore || new ItemStore(this.eventBus);
      this.turnManager = options.turnManager || new TurnManager(this.eventBus, this.itemStore, this);
      this.turnManager.runtime = this;
      this.threadManager = options.threadManager || new ThreadManager(this.eventBus, this.turnManager);
      this.toolRegistry = options.toolRegistry || new ToolRegistry();
      registerCoreTools(this.toolRegistry);
      this.capabilityRegistry = options.capabilityRegistry || new CapabilityRegistry({ eventBus: this.eventBus, toolRegistry: this.toolRegistry });
      this.mcpServerManager = options.mcpServerManager || new MCPServerManager({
        eventBus: this.eventBus,
        capabilityRegistry: this.capabilityRegistry,
        limits: options.mcpLimits,
      });
      this.skillRegistry = options.skillRegistry || new SkillRegistry({ eventBus: this.eventBus, capabilityRegistry: this.capabilityRegistry });
      this._seedCoreCapabilities();
      this.workspaceIsolationManager = options.workspaceIsolationManager || new WorkspaceIsolationManager({ eventBus: this.eventBus });
      this.persistenceAdapter = options.persistenceAdapter || new HarnessPersistenceAdapter(undefined, undefined, this.workspaceIsolationManager);
      this.workerRuntime = options.workerRuntime || new WorkerRuntime({ eventBus: this.eventBus, limits: options.workerLimits });
      this.modelAdapter = options.modelAdapter || new ModelAdapter();
      this.contextEngine = options.contextEngine || new ContextEngine({ eventBus: this.eventBus });
      this.requestRouter = options.requestRouter || new RequestRouter();
      this.agentLoop = options.agentLoop || new AgentLoop({
        runtime: this,
        toolRegistry: this.toolRegistry,
        modelAdapter: this.modelAdapter,
        contextEngine: this.contextEngine,
      });
      this.subagentManager = options.subagentManager || new SubagentManager({
        runtime: this,
        limits: options.subagentLimits,
        workspaceIsolationManager: this.workspaceIsolationManager,
        workerRuntime: this.workerRuntime,
      });
      this.subagentManager.setRuntime(this);
      this.swarmOrchestrator = options.swarmOrchestrator || new SwarmOrchestrator({
        eventBus: this.eventBus,
        subagentManager: this.subagentManager,
        limits: options.swarmLimits,
      });
      this.projectCapabilityLoader = options.projectCapabilityLoader || new ProjectCapabilityLoader({
        eventBus: this.eventBus,
        capabilityRegistry: this.capabilityRegistry,
        mcpServerManager: this.mcpServerManager,
        skillRegistry: this.skillRegistry,
        limits: options.projectLimits,
      });
      this.changeConflictResolver = options.changeConflictResolver || new ChangeConflictResolver({
        eventBus: this.eventBus,
        harnessRuntime: this,
      });
      this.symbolIndex = options.symbolIndex || new RepositorySymbolIndex({
        eventBus: this.eventBus,
      });
      this.impactAnalyzer = options.impactAnalyzer || new ImpactAnalyzer({
        eventBus: this.eventBus,
        symbolIndex: this.symbolIndex,
      });

    } else {
      this.eventBus = options.eventBus || harnessEventBus;
      this.itemStore = options.itemStore || itemStore;
      this.turnManager = options.turnManager || turnManager;
      this.threadManager = options.threadManager || threadManager;
      this.persistenceAdapter = options.persistenceAdapter || harnessPersistenceAdapter;
      this.toolRegistry = options.toolRegistry || toolRegistry;
      this.capabilityRegistry = options.capabilityRegistry || capabilityRegistry;
      this.mcpServerManager = options.mcpServerManager || mcpServerManager;
      this.skillRegistry = options.skillRegistry || skillRegistry;
      this.projectCapabilityLoader = options.projectCapabilityLoader || projectCapabilityLoader;
      this._seedCoreCapabilities();
      this.modelAdapter = options.modelAdapter || modelAdapter;
      this.contextEngine = options.contextEngine || contextEngine;
      this.requestRouter = options.requestRouter || requestRouter;
      this.agentLoop = options.agentLoop || new AgentLoop({
        runtime: this,
        toolRegistry: this.toolRegistry,
        modelAdapter: this.modelAdapter,
        contextEngine: this.contextEngine,
      });
      this.workspaceIsolationManager = options.workspaceIsolationManager || workspaceIsolationManager;
      this.workerRuntime = options.workerRuntime || workerRuntime;
      this.subagentManager = options.subagentManager || subagentManager;
      this.subagentManager.setRuntime(this);
      this.swarmOrchestrator = options.swarmOrchestrator || swarmOrchestrator;
      this.changeConflictResolver = options.changeConflictResolver || new ChangeConflictResolver({
        eventBus: this.eventBus,
        harnessRuntime: this,
      });
      this.symbolIndex = options.symbolIndex || repositorySymbolIndex;
      this.impactAnalyzer = options.impactAnalyzer || impactAnalyzer;
    }
    this.refactorPlans = new Map();
  }

  /**
   * Seeds core registered tools into CapabilityRegistry.
   * @private
   */
  _seedCoreCapabilities() {
    if (!this.capabilityRegistry || !this.toolRegistry) return;
    for (const t of this.toolRegistry.list()) {
      const fullTool = this.toolRegistry.get(t.name);
      if (fullTool && !this.capabilityRegistry.hasCapability(t.name)) {
        this.capabilityRegistry.registerCapability({
          name: fullTool.name,
          description: fullTool.description,
          source: 'nexus',
          type: 'NEXUS_TOOL',
          inputSchema: fullTool.inputSchema,
          requiresApproval: fullTool.requiresApproval,
          execute: fullTool.execute,
        });
      }
    }
  }

  static createIsolated(options = {}) {
    return new HarnessRuntime({ isolated: true, ...options });
  }

  // ==========================================
  // ITERATIVE AGENT LOOP (MILESTONE 2)
  // ==========================================

  /**
   * Executes an iterative multi-tool agent turn to completion.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async runTurn(payload = {}) {
    return this.agentLoop.runTurn(payload);
  }

  /**
   * Executes a tool directly through the runtime's tool registry.
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async executeTool(toolName, args = {}, context = {}) {
    return this.toolRegistry.execute(toolName, args, context);
  }

  /**
   * Approves a pending tool action in the agent loop.
   * @param {Object} payload - { turnId, callId, decision }
   * @returns {{ success: boolean, error?: string }}
   */
  approveAction(payload = {}) {
    return this.agentLoop.approveAction(payload.turnId, payload.callId, payload.decision || payload);
  }

  /**
   * Rejects a pending tool action in the agent loop.
   * @param {Object} payload - { turnId, callId, reason }
   * @returns {{ success: boolean, error?: string }}
   */
  rejectAction(payload = {}) {
    return this.agentLoop.rejectAction(payload.turnId, payload.callId, payload.reason);
  }

  /**
   * Creates a new ChangeSet bound to this runtime's eventBus.
   * @param {Object} [options]
   * @returns {ChangeSet}
   */
  createChangeSet(options = {}) {
    return new ChangeSet({
      eventBus: this.eventBus,
      ...options,
    });
  }

  /**
   * Creates a validated HandoffState instance.
   * @param {Object} payload
   * @returns {HandoffState}
   */
  createHandoff(payload = {}) {
    return new HandoffState(payload);
  }

  // ==========================================
  // SUBAGENTS & CHILD THREADS (MILESTONE 8)
  // ==========================================

  /**
   * Creates a new child Thread for a subagent under a parent Thread.
   * @param {Object} options
   * @returns {Object} Created child Thread
   */
  createSubagent(options = {}) {
    return this.subagentManager.createChildThread(options);
  }

  /**
   * Runs a complete subagent task under parent orchestration.
   * @param {Object} options
   * @returns {Promise<Object>} Structured subagent result
   */
  async runSubagent(options = {}) {
    return this.subagentManager.runChild(options);
  }

  /**
   * Runs a turn on an existing child subagent Thread.
   * @param {string} childThreadId
   * @param {Object} delegationPackage
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async startChildTurn(childThreadId, delegationPackage = {}, options = {}) {
    return this.subagentManager.startChildTurn(childThreadId, delegationPackage, options);
  }

  /**
   * Runs multiple child subagent tasks with bounded concurrency and preflight conflict safety.
   * @param {Array<Object>} childrenConfigs
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async runSubagentsConcurrent(childrenConfigs = [], options = {}) {
    return this.subagentManager.runChildrenConcurrent(childrenConfigs, options);
  }

  /**
   * Cancels a specific child subagent Thread.
   * @param {string} childThreadId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelSubagent(childThreadId, reason) {
    return this.subagentManager.cancelChild(childThreadId, reason);
  }

  /**
   * Lists all child subagent Threads for a parent Thread.
   * @param {string} parentThreadId
   * @returns {Array<Object>}
   */
  listSubagents(parentThreadId) {
    return this.subagentManager.listChildren(parentThreadId);
  }

  // ==========================================
  // WORKSPACE ISOLATION (MILESTONE 9A)
  // ==========================================

  /**
   * Creates an isolated workspace for a subagent.
   * @param {Object} options
   * @returns {Object}
   */
  createChildWorkspace(options = {}) {
    return this.workspaceIsolationManager.createChildWorkspace(options);
  }

  /**
   * Authoritatively adopts verified child subagent changes into the parent workspace.
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async adoptChildChanges(options = {}) {
    return this.workspaceIsolationManager.adoptChildChanges(options);
  }

  /**
   * Cleans up an isolated child workspace.
   * @param {string} id - workspaceId or threadId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async cleanupChildWorkspace(id, options = {}) {
    return this.workspaceIsolationManager.cleanupChildWorkspace(id, options);
  }

  /**
   * Retrieves an isolated child workspace record.
   * @param {string} id
   * @returns {Object|null}
   */
  getChildWorkspace(id) {
    return this.workspaceIsolationManager.getChildWorkspace(id);
  }

  /**
   * Lists all child workspaces for a parent workspace.
   * @param {string} [parentWorkspacePath]
   * @returns {Array<Object>}
   */
  listChildWorkspaces(parentWorkspacePath) {
    return this.workspaceIsolationManager.listChildWorkspaces(parentWorkspacePath);
  }

  // ==========================================
  // WORKER RUNTIME (MILESTONE 9B)
  // ==========================================

  /**
   * Starts an isolated worker for a subagent thread.
   * @param {Object} options
   * @returns {Object}
   */
  startWorker(options = {}) {
    return this.workerRuntime.startWorker(options);
  }

  /**
   * Executes a turn inside an isolated worker.
   * @param {string} workerIdOrThreadId
   * @param {Object} delegationPackage
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async executeWorkerTurn(workerIdOrThreadId, delegationPackage = {}, options = {}) {
    return this.workerRuntime.executeTurn(workerIdOrThreadId, delegationPackage, options);
  }

  /**
   * Sends a structured message to a worker.
   * @param {string} workerIdOrThreadId
   * @param {Object} message
   */
  sendWorkerMessage(workerIdOrThreadId, message) {
    return this.workerRuntime.sendMessage(workerIdOrThreadId, message);
  }

  /**
   * Cancels a running worker.
   * @param {string} workerIdOrThreadId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelWorker(workerIdOrThreadId, reason) {
    return this.workerRuntime.cancelWorker(workerIdOrThreadId, reason);
  }

  /**
   * Force terminates a worker process or thread.
   * @param {string} workerIdOrThreadId
   * @param {boolean} [force=true]
   * @returns {Object}
   */
  terminateWorker(workerIdOrThreadId, force = true) {
    return this.workerRuntime.terminateWorker(workerIdOrThreadId, force);
  }

  /**
   * Retrieves status for a worker.
   * @param {string} workerIdOrThreadId
   * @returns {Object|null}
   */
  getWorkerStatus(workerIdOrThreadId) {
    return this.workerRuntime.getStatus(workerIdOrThreadId);
  }

  // ==========================================
  // SWARM COORDINATOR (MILESTONE 10)
  // ==========================================

  /**
   * Creates a structured Swarm Plan.
   * @param {Object} planInput
   * @returns {Object}
   */
  createSwarmPlan(planInput = {}) {
    return this.swarmOrchestrator.createPlan(planInput);
  }

  /**
   * Executes a Swarm Plan with dependency graph scheduling and bounded concurrency.
   * @param {Object} planInputOrPlan
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async executeSwarm(planInputOrPlan, options = {}) {
    return this.swarmOrchestrator.executeSwarm(planInputOrPlan, options);
  }

  /**
   * Detects file and baseline conflicts across sibling ChangeSets.
   * @param {Array<Object>} changeSets
   * @param {Object} [options]
   * @returns {Object}
   */
  detectSwarmConflicts(changeSets = [], options = {}) {
    return this.swarmOrchestrator.detectConflicts(changeSets, options);
  }

  /**
   * Adopts non-conflicting ChangeSets from a swarm atomically.
   * @param {Array<Object>} changeSets
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async adoptSwarmChanges(changeSets = [], options = {}) {
    return this.swarmOrchestrator.adoptNonConflictingChanges(changeSets, options);
  }

  /**
   * Cancels a running swarm.
   * @param {string} swarmId
   * @param {string} [reason]
   * @returns {Object}
   */
  cancelSwarm(swarmId, reason) {
    return this.swarmOrchestrator.cancelSwarm(swarmId, reason);
  }

  /**
   * Retrieves live status of a swarm.
   * @param {string} swarmId
   * @returns {Object|null}
   */
  getSwarmStatus(swarmId) {
    return this.swarmOrchestrator.getSwarmStatus(swarmId);
  }






  // ==========================================
  // REQUEST ROUTER & ORCHESTRATION (MILESTONE 4)
  // ==========================================

  /**
   * Authoritatively classifies an incoming user prompt.
   * @param {string} userInput
   * @param {Object} [context]
   * @returns {Object} { mode, codingIntent, confidence, reasons, requiresWorkspace }
   */
  classifyRequest(userInput, context = {}) {
    return this.requestRouter.classify(userInput, context);
  }

  /**
   * Authoritative entrypoint for any user prompt.
   * Directs CONVERSATION to direct AI provider (zero tools/scans),
   * and CODING_TASK to the iterative AgentLoop.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handleRequest(payload = {}) {
    const {
      userInput = '',
      context = {},
      workspacePath = process.cwd(),
      activeFilePath = null,
      providerId,
      modelId,
      threadId: inputThreadId,
      approvalMode = 'strict',
      continuumSnapshot,
    } = payload;

    const classification = this.classifyRequest(userInput, {
      ...context,
      activeFilePath: activeFilePath || context.activeFilePath,
      workspacePath: workspacePath || context.workspacePath,
    });

    // 1. CONVERSATION PATH: Bypass AgentLoop and workspace scanning completely
    if (classification.mode === ROUTER_MODES.CONVERSATION) {
      let assistantText = 'Hello! I am NEXUS AI Assistant. How can I help you today?';
      let executionMeta = {
        providerId: providerId || 'groq',
        modelId: modelId || 'llama-3.3-70b-versatile',
        requestedProviderId: providerId || 'groq',
        requestedModelId: modelId || 'llama-3.3-70b-versatile',
        isFallback: false,
      };

      try {
        const resolved = aiProviderRouter.resolveProviderAndModel(providerId, modelId);
        if (resolved && resolved.provider) {
          executionMeta = {
            providerId: resolved.provider.getId(),
            modelId: resolved.modelId,
            requestedProviderId: providerId || resolved.provider.getId(),
            requestedModelId: modelId || resolved.modelId,
            isFallback: Boolean(resolved.isFallback),
          };
        }
        if (aiProviderRouter) {
          const providerRes = await aiProviderRouter.generateAgentPlan({
            task: userInput,
            workspacePath,
            maxSteps: 1,
            activeFilePath: null,
            files: [],
            targetFile: null,
            intent: 'GENERAL_CHAT',
            providerId,
            modelId,
          });
          if (providerRes && providerRes.summary) {
            assistantText = providerRes.summary;
            executionMeta = providerRes.execution || executionMeta;
          }
        }
      } catch (err) {
        console.warn('[HARNESS-ROUTER] Conversational provider call failed:', err.message);
      }

      return {
        success: true,
        mode: ROUTER_MODES.CONVERSATION,
        codingIntent: null,
        route: classification,
        response: assistantText,
        summary: assistantText,
        execution: executionMeta,
      };
    }

    // 2. CODING TASK PATH: Ensure Thread and run Turn via AgentLoop
    let threadId = inputThreadId;
    if (!threadId) {
      const thread = this.createThread({
        metadata: {
          workspacePath,
          activeFilePath,
          title: userInput.slice(0, 60),
        },
      });
      threadId = thread.threadId;
    }

    const turnOutcome = await this.runTurn({
      threadId,
      userInput,
      workspacePath,
      activeFilePath,
      intent: classification.codingIntent || CODING_INTENTS.READ_ONLY,
      approvalMode,
      providerId,
      modelId,
      modelHandler: payload.modelHandler,
      continuumSnapshot,
      handoffState: payload.handoffState,
    });


    return {
      ...turnOutcome,
      mode: ROUTER_MODES.CODING_TASK,
      codingIntent: classification.codingIntent,
      route: classification,
      threadId,
    };
  }

  // ==========================================
  // THREAD LIFECYCLE
  // ==========================================

  /**
   * Creates a new persistent Thread session.
   * @param {Object} [options]
   * @returns {Object} Created Thread
   */
  createThread(options = {}) {
    return this.threadManager.createThread(options);
  }

  /**
   * Retrieves a Thread by ID with its Turns and Items.
   * @param {string} threadId
   * @returns {Object|null}
   */
  getThread(threadId) {
    return this.threadManager.getThread(threadId);
  }

  /**
   * Lists all active/archived in-memory Threads.
   * @param {Object} [filter]
   * @returns {Array<Object>}
   */
  listThreads(filter = {}) {
    return this.threadManager.listThreads(filter);
  }

  /**
   * Archives a Thread.
   * @param {string} threadId
   * @returns {Object}
   */
  archiveThread(threadId) {
    return this.threadManager.archiveThread(threadId);
  }

  /**
   * Updates Thread metadata.
   * @param {string} threadId
   * @param {Object} updates
   * @returns {Object}
   */
  updateThread(threadId, updates = {}) {
    return this.threadManager.updateThread(threadId, updates);
  }

  // ==========================================
  // TURN LIFECYCLE
  // ==========================================

  /**
   * Starts a new Turn within a parent Thread.
   * Enforces Invariant 1: A Turn cannot exist without an active Thread.
   * @param {string} threadId
   * @param {string} userInput
   * @param {Object} [metadata]
   * @param {Object} [options]
   * @returns {Object} Started Turn
   */
  startTurn(threadId, userInput = '', metadata = {}, options = {}) {
    const thread = this.threadManager.getThread(threadId);
    if (!thread) {
      const err = new Error(`[HARNESS-RUNTIME] Invariant violation: Cannot start Turn for non-existent Thread "${threadId}"`);
      this.eventBus.emit(EVENT_TYPES.HARNESS_ERROR, {
        threadId,
        payload: { error: err.message },
      });
      throw err;
    }

    if (thread.status === THREAD_STATUS.ARCHIVED) {
      const err = new Error(`[HARNESS-RUNTIME] Invariant violation: Cannot start Turn on archived Thread "${threadId}"`);
      this.eventBus.emit(EVENT_TYPES.HARNESS_ERROR, {
        threadId,
        payload: { error: err.message },
      });
      throw err;
    }

    // Touch thread timestamp
    this.threadManager.touchThread(threadId);

    const turn = this.turnManager.startTurn(threadId, userInput, metadata, options);
    return turn;
  }

  /**
   * Retrieves a Turn by ID with its Items.
   * @param {string} turnId
   * @returns {Object|null}
   */
  getTurn(turnId) {
    return this.turnManager.getTurn(turnId);
  }

  /**
   * Completes a Turn.
   * @param {string} turnId
   * @param {Object} [metadata]
   * @returns {Object}
   */
  completeTurn(turnId, metadata = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found`);
    }

    this.threadManager.touchThread(turn.threadId);
    return this.turnManager.completeTurn(turnId, metadata);
  }

  /**
   * Fails a Turn.
   * @param {string} turnId
   * @param {string|Error} error
   * @param {Object} [metadata]
   * @returns {Object}
   */
  failTurn(turnId, error, metadata = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found`);
    }

    this.threadManager.touchThread(turn.threadId);
    return this.turnManager.failTurn(turnId, error, metadata);
  }

  /**
   * Cancels a Turn.
   * @param {string} turnId
   * @param {Object} [metadata]
   * @returns {Object}
   */
  cancelTurn(turnId, metadata = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found`);
    }

    this.threadManager.touchThread(turn.threadId);

    // Propagate cancellation to active child threads under this thread
    if (this.subagentManager) {
      const reason = typeof metadata === 'string' ? metadata : (metadata?.reason || 'Parent turn cancelled');
      this.subagentManager.cancelAllChildren(turn.threadId, reason);
    }

    return this.turnManager.cancelTurn(turnId, metadata);
  }


  /**
   * Sets a Turn into WAITING_FOR_APPROVAL state.
   * @param {string} turnId
   * @param {Object} [metadata]
   * @returns {Object}
   */
  setWaitingForApproval(turnId, metadata = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found`);
    }

    this.threadManager.touchThread(turn.threadId);
    return this.turnManager.setWaitingForApproval(turnId, metadata);
  }

  /**
   * Pauses an active Turn.
   * @param {string} turnId
   * @param {Object} [metadata]
   * @returns {Object}
   */
  pauseTurn(turnId, metadata = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found`);
    }

    this.threadManager.touchThread(turn.threadId);
    return this.turnManager.pauseTurn(turnId, metadata);
  }

  /**
   * Resumes a Turn safely without duplicate tool execution or loss of state.
   * @param {string} turnId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async resumeTurn(turnId, options = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      throw new Error(`[HARNESS-RUNTIME] Turn "${turnId}" not found for resumption`);
    }

    if (turn.status === TURN_STATUS.COMPLETED) {
      return {
        success: true,
        status: TURN_STATUS.COMPLETED,
        turnId,
        turn,
        message: 'Turn is already completed',
      };
    }

    if (turn.status === TURN_STATUS.CANCELLED) {
      return {
        success: false,
        status: TURN_STATUS.CANCELLED,
        turnId,
        turn,
        message: 'Cannot resume a cancelled turn',
      };
    }

    if (turn.status === TURN_STATUS.FAILED) {
      return {
        success: false,
        status: TURN_STATUS.FAILED,
        turnId,
        turn,
        message: 'Cannot resume a failed turn without a new directive',
      };
    }

    this.threadManager.touchThread(turn.threadId);

    // If turn is in WAITING_FOR_APPROVAL or PAUSED, unpause it
    if (turn.status === TURN_STATUS.PAUSED || turn.status === TURN_STATUS.WAITING_FOR_APPROVAL) {
      this.turnManager.resumeTurn(turnId, options.metadata);
    }

    if (options.runAgentLoop !== false) {
      return this.agentLoop.runTurn({
        turnId,
        threadId: turn.threadId,
        userInput: options.userInput || turn.userInput,
        workspacePath: options.workspacePath || turn.metadata?.workspacePath,
        activeFilePath: options.activeFilePath || turn.metadata?.activeFilePath,
        intent: options.intent || turn.metadata?.intent || 'MUTATION',
        approvalMode: options.approvalMode || 'strict',
        modelHandler: options.modelHandler,
        providerId: options.providerId || turn.metadata?.providerId,
        modelId: options.modelId || turn.metadata?.modelId,
        continuumSnapshot: options.continuumSnapshot,
        contextOptions: options.contextOptions,
        handoffState: options.handoffState || turn.metadata?.handoffState || null,
      });
    }


    return {
      success: true,
      status: TURN_STATUS.RUNNING,
      turn: this.turnManager.getTurn(turnId),
    };
  }

  /**
   * Compiles context for a turn or thread using the runtime's ContextEngine.
   * @param {Object} params
   * @returns {Object}
   */
  buildContext(params = {}) {
    return this.contextEngine.buildContext(params);
  }

  // ==========================================
  // ITEM LIFECYCLE
  // ==========================================

  /**
   * Starts a typed Item associated with a Turn.
   * Enforces Invariant 2: An Item cannot exist without a Turn.
   * Enforces Invariant 3: A completed Turn cannot accept new Items.
   * Enforces Invariant 5: A cancelled Turn cannot execute additional Items.
   * @param {string} turnId
   * @param {string} type - One of ITEM_TYPES
   * @param {Object} [payload]
   * @param {Object} [metadata]
   * @param {Object} [options]
   * @returns {Object}
   */
  startItem(turnId, type, payload = {}, metadata = {}, options = {}) {
    const turn = this.turnManager.getTurn(turnId);
    if (!turn) {
      const err = new Error(`[HARNESS-RUNTIME] Invariant violation: Cannot create Item for non-existent Turn "${turnId}"`);
      this.eventBus.emit(EVENT_TYPES.HARNESS_ERROR, {
        turnId,
        payload: { error: err.message },
      });
      throw err;
    }

    if ([TURN_STATUS.COMPLETED, TURN_STATUS.FAILED, TURN_STATUS.CANCELLED].includes(turn.status)) {
      const err = new Error(`[HARNESS-RUNTIME] Invariant violation: Cannot add Item to Turn "${turnId}" in terminal state "${turn.status}"`);
      this.eventBus.emit(EVENT_TYPES.HARNESS_ERROR, {
        threadId: turn.threadId,
        turnId,
        payload: { error: err.message },
      });
      throw err;
    }

    this.threadManager.touchThread(turn.threadId);
    return this.itemStore.startItem(turnId, type, payload, metadata, {
      ...options,
      threadId: turn.threadId,
    });
  }

  /**
   * Updates an Item.
   * @param {string} itemId
   * @param {Object} payloadUpdates
   * @param {Object} metadataUpdates
   * @returns {Object}
   */
  updateItem(itemId, payloadUpdates = {}, metadataUpdates = {}) {
    const item = this.itemStore.getItem(itemId);
    if (!item) {
      throw new Error(`[HARNESS-RUNTIME] Item "${itemId}" not found`);
    }

    const turn = this.turnManager.getTurn(item.turnId);
    if (turn) {
      this.threadManager.touchThread(turn.threadId);
    }

    return this.itemStore.updateItem(itemId, payloadUpdates, metadataUpdates, {
      threadId: turn?.threadId,
    });
  }

  /**
   * Completes an Item.
   * @param {string} itemId
   * @param {Object} finalPayload
   * @param {Object} metadataUpdates
   * @returns {Object}
   */
  completeItem(itemId, finalPayload = {}, metadataUpdates = {}) {
    const item = this.itemStore.getItem(itemId);
    if (!item) {
      throw new Error(`[HARNESS-RUNTIME] Item "${itemId}" not found`);
    }

    const turn = this.turnManager.getTurn(item.turnId);
    if (turn) {
      this.threadManager.touchThread(turn.threadId);
    }

    return this.itemStore.completeItem(itemId, finalPayload, metadataUpdates, {
      threadId: turn?.threadId,
    });
  }

  /**
   * Fails an Item.
   * @param {string} itemId
   * @param {string|Error} error
   * @param {Object} metadataUpdates
   * @returns {Object}
   */
  failItem(itemId, error, metadataUpdates = {}) {
    const item = this.itemStore.getItem(itemId);
    if (!item) {
      throw new Error(`[HARNESS-RUNTIME] Item "${itemId}" not found`);
    }

    const turn = this.turnManager.getTurn(item.turnId);
    if (turn) {
      this.threadManager.touchThread(turn.threadId);
    }

    return this.itemStore.failItem(itemId, error, metadataUpdates, {
      threadId: turn?.threadId,
    });
  }

  /**
   * Cancels an Item.
   * @param {string} itemId
   * @param {Object} metadataUpdates
   * @returns {Object}
   */
  cancelItem(itemId, metadataUpdates = {}) {
    const item = this.itemStore.getItem(itemId);
    if (!item) {
      throw new Error(`[HARNESS-RUNTIME] Item "${itemId}" not found`);
    }

    const turn = this.turnManager.getTurn(item.turnId);
    if (turn) {
      this.threadManager.touchThread(turn.threadId);
    }

    return this.itemStore.cancelItem(itemId, metadataUpdates, {
      threadId: turn?.threadId,
    });
  }

  /**
   * Retrieves an Item by ID.
   * @param {string} itemId
   * @returns {Object|null}
   */
  getItem(itemId) {
    return this.itemStore.getItem(itemId);
  }

  // ==========================================
  // PERSISTENCE INTEGRATION
  // ==========================================

  /**
   * Persists a Thread and its Turns & Items to Continuum storage.
   * @param {string} threadId
   * @param {string} [workspacePath]
   * @returns {Object}
   */
  saveThread(threadId, workspacePath = '') {
    const thread = this.threadManager.getThread(threadId);
    if (!thread) {
      throw new Error(`[HARNESS-RUNTIME] Cannot save non-existent Thread "${threadId}"`);
    }

    const turns = this.turnManager.listTurnsByThread(threadId);
    const items = [];
    for (const turn of turns) {
      items.push(...this.itemStore.getItemsByTurn(turn.turnId));
    }

    return this.persistenceAdapter.saveThread(thread, turns, items, workspacePath);
  }

  /**
   * Loads a Thread and its Turns & Items from Continuum storage into in-memory runtime.
   * @param {string} threadId
   * @param {string} [workspacePath]
   * @returns {{ success: boolean, thread?: Object, error?: string }}
   */
  loadThread(threadId, workspacePath = '') {
    const res = this.persistenceAdapter.loadThread(threadId, workspacePath);
    if (!res.success || !res.thread) {
      return res;
    }

    // Hydrate into in-memory ThreadManager, TurnManager, ItemStore
    this.threadManager.restoreThread(res.thread);

    if (Array.isArray(res.turns)) {
      for (const turn of res.turns) {
        this.turnManager.restoreTurn(turn);
      }
    }

    if (Array.isArray(res.items)) {
      for (const item of res.items) {
        this.itemStore.restoreItem(item);
      }
    }

    if (res.workspace) {
      this.workspaceIsolationManager.restoreWorkspace(res.workspace);
    }


    return {
      success: true,
      thread: this.threadManager.getThread(threadId),
    };
  }

  /**
   * Lists persisted threads from storage for a workspace.
   * @param {string} [workspacePath]
   * @returns {Array<Object>}
   */
  listPersistedThreads(workspacePath = '') {
    return this.persistenceAdapter.listPersistedThreads(workspacePath);
  }

  // ==========================================
  // EVENT BUS SUBSCRIPTIONS
  // ==========================================

  subscribe(listener) {
    return this.eventBus.subscribe(listener);
  }

  unsubscribe(listener) {
    this.eventBus.unsubscribe(listener);
  }

  on(type, listener) {
    return this.eventBus.on(type, listener);
  }

  off(type, listener) {
    this.eventBus.off(type, listener);
  }

  getEvents(filter = {}) {
    return this.eventBus.getEvents(filter);
  }

  // ==========================================
  // CAPABILITY & MCP LAYER (MILESTONE 12)
  // ==========================================

  registerCapability(cap) {
    return this.capabilityRegistry.registerCapability(cap);
  }

  getCapability(idOrName) {
    return this.capabilityRegistry.getCapability(idOrName);
  }

  listCapabilities(filter) {
    return this.capabilityRegistry.listCapabilities(filter);
  }

  enableCapability(idOrName) {
    return this.capabilityRegistry.enableCapability(idOrName);
  }

  disableCapability(idOrName) {
    return this.capabilityRegistry.disableCapability(idOrName);
  }

  registerMCPServer(config) {
    return this.mcpServerManager.registerServer(config);
  }

  async startMCPServer(serverId) {
    return this.mcpServerManager.startServer(serverId);
  }

  async stopMCPServer(serverId) {
    return this.mcpServerManager.stopServer(serverId);
  }

  async restartMCPServer(serverId) {
    return this.mcpServerManager.restartServer(serverId);
  }

  getMCPServer(serverId) {
    return this.mcpServerManager.getServer(serverId);
  }

  listMCPServers() {
    return this.mcpServerManager.listServers();
  }

  registerSkill(skill) {
    return this.skillRegistry.registerSkill(skill);
  }

  getSkill(idOrName) {
    return this.skillRegistry.getSkill(idOrName);
  }

  listSkills() {
    return this.skillRegistry.listSkills();
  }

  resolveSkills(context) {
    return this.skillRegistry.resolveSkills(context);
  }

  enableSkill(idOrName) {
    return this.skillRegistry.enableSkill(idOrName);
  }

  disableSkill(idOrName) {
    return this.skillRegistry.disableSkill(idOrName);
  }

  // ==========================================
  // PROJECT CAPABILITY LOADER (MILESTONE 13)
  // ==========================================

  /**
   * Discovers declarative capabilities (.nexus/mcp.json and .nexus/skills/*.md) in a workspace.
   * @param {string} workspacePath
   * @returns {Object}
   */
  discoverProjectCapabilities(workspacePath) {
    return this.projectCapabilityLoader.discoverProjectConfig(workspacePath);
  }

  /**
   * Hydrates project-level MCP servers and skills into runtime registries.
   * @param {string} workspacePath
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async loadProjectCapabilities(workspacePath, options = {}) {
    return this.projectCapabilityLoader.hydrateCapabilities(workspacePath, options);
  }

  /**
   * Safely hot reloads project capabilities without tearing down active servers on invalid configs.
   * @param {string} workspacePath
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async reloadProjectCapabilities(workspacePath, options = {}) {
    return this.projectCapabilityLoader.reloadProjectCapabilities(workspacePath, options);
  }

  /**
   * Retrieves safe persistence metadata for project capabilities.
   * @param {string} workspacePath
   * @returns {Object}
   */
  getProjectPersistenceMetadata(workspacePath) {
    return this.projectCapabilityLoader.getPersistenceMetadata(workspacePath);
  }

  /**
   * Starts watching a workspace's .nexus directory for automatic hot reloading.
   * @param {string} workspacePath
   */
  startWatchingProjectCapabilities(workspacePath) {
    return this.projectCapabilityLoader.startWatching(workspacePath);
  }

  /**
   * Stops watching a workspace's .nexus directory.
   * @param {string} workspacePath
   */
  stopWatchingProjectCapabilities(workspacePath) {
    return this.projectCapabilityLoader.stopWatching(workspacePath);
  }

  // ==========================================
  // 3-WAY CONFLICT RESOLUTION (MILESTONE 16)
  // ==========================================

  createChangeConflict(options) {
    return this.changeConflictResolver.createConflict(options);
  }

  getChangeConflict(conflictId) {
    return this.changeConflictResolver.getConflict(conflictId);
  }

  listChangeConflicts() {
    return this.changeConflictResolver.listConflicts();
  }

  resolveChangeConflictHunk(conflictId, hunkId, resolution, customContent, context) {
    return this.changeConflictResolver.resolveHunk(conflictId, hunkId, resolution, customContent, context);
  }

  createParentChangeSetFromConflicts(options) {
    return this.changeConflictResolver.createParentChangeSet(options);
  }

  async applyResolvedConflicts(options) {
    return this.changeConflictResolver.applyResolvedConflicts(options);
  }

  cancelConflictResolution(options) {
    return this.changeConflictResolver.cancelResolution(options);
  }

  getConflictPersistenceMetadata() {
    return this.changeConflictResolver.getPersistenceMetadata();
  }

  // ==========================================
  // REPOSITORY SYMBOL INDEX (MILESTONE 19)
  // ==========================================

  async buildSymbolIndex(workspacePath, options) {
    return this.symbolIndex.build(workspacePath, options);
  }

  getSymbolIndex() {
    return this.symbolIndex;
  }

  findSymbol(name) {
    return this.symbolIndex.findSymbol(name);
  }

  getFileSymbols(filePath) {
    return this.symbolIndex.getFileSymbols(filePath);
  }

  getSymbolCallers(symbolName) {
    return this.symbolIndex.getCallers(symbolName);
  }

  getPotentialImpact(targets) {
    return this.symbolIndex.getPotentialImpact(targets);
  }

  queryContextIntelligence(query) {
    return this.symbolIndex.queryContextIntelligence(query);
  }

  // ==========================================
  // IMPACT ANALYZER (MILESTONE 20)
  // ==========================================

  getImpactAnalyzer() {
    return this.impactAnalyzer;
  }

  analyzeImpact(symbolIdOrName, options) {
    return this.impactAnalyzer.analyzeSymbol(symbolIdOrName, options);
  }

  analyzeFileImpact(filePath, options) {
    return this.impactAnalyzer.analyzeFile(filePath, options);
  }

  analyzeChangeSetImpact(changeSet, options) {
    return this.impactAnalyzer.analyzeChangeSet(changeSet, options);
  }

  generateRefactorPlan(impactResult, options) {
    return this.impactAnalyzer.generateRefactorPlan(impactResult, options);
  }

  // ==========================================
  // REFACTOR PLAN & SWARM (MILESTONE 21)
  // ==========================================

  createRefactorPlan(options = {}) {
    const plan = new RefactorPlan({
      ...options,
      eventBus: this.eventBus,
      runtime: this,
    });
    this.refactorPlans.set(plan.planId, plan);
    return plan;
  }

  getRefactorPlan(planId) {
    return this.refactorPlans.get(planId) || null;
  }

  approveRefactorPlan(planId, options = {}) {
    const plan = this.getRefactorPlan(planId);
    if (!plan) throw new Error(`[HARNESS-RUNTIME] RefactorPlan "${planId}" not found`);
    return plan.approve(options);
  }

  rejectRefactorPlan(planId, reason) {
    const plan = this.getRefactorPlan(planId);
    if (!plan) throw new Error(`[HARNESS-RUNTIME] RefactorPlan "${planId}" not found`);
    return plan.reject(reason);
  }

  /**
   * Resets all runtime in-memory state. Used for isolated unit testing.
   */
  reset() {
    this.eventBus.clear();
    this.itemStore.clear();
    this.turnManager.clear();
    this.threadManager.clear();
    if (this.projectCapabilityLoader) this.projectCapabilityLoader.unwatchAll();
    if (this.capabilityRegistry) this.capabilityRegistry.clear();
    if (this.mcpServerManager) this.mcpServerManager.shutdown();
    if (this.skillRegistry) this.skillRegistry.clear();
    if (this.changeConflictResolver) this.changeConflictResolver.clear();
    this._seedCoreCapabilities();
  }
}

const harnessRuntime = new HarnessRuntime();

module.exports = {
  HarnessRuntime,
  harnessRuntime,
};
