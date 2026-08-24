/**
 * NEXUS CODEX HARNESS - ITERATIVE AGENT LOOP
 * Headless, multi-turn, multi-tool agent execution loop.
 * Coordinates Turn lifecycle, typed Item creation, ToolRegistry execution, and model context.
 */

const {
  ITEM_TYPES,
  ITEM_STATUS,
  TURN_STATUS,
  EVENT_TYPES,
} = require('./types');
const { toolRegistry: defaultToolRegistry } = require('./ToolRegistry');
const { modelAdapter: defaultModelAdapter } = require('./ModelAdapter');
const { contextEngine: defaultContextEngine } = require('./ContextEngine');
const { ChangeSet } = require('./ChangeSet');
const { HandoffState } = require('./HandoffState');
const { swarmOrchestrator: defaultSwarmOrchestrator } = require('./SwarmOrchestrator');
const { isGreeting, getConversationalGreetingResponse, getConversationalResponse, requestRouter, ROUTER_MODES } = require('./RequestRouter');
const { continuumContextBuilder } = require('../../engine/continuum_context_builder');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}


const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOOL_CALLS = 25;

class AgentLoop {
  constructor(options = {}) {
    this.runtime = options.runtime; // Reference to HarnessRuntime
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.modelAdapter = options.modelAdapter || defaultModelAdapter;
    this.contextEngine = options.contextEngine || defaultContextEngine;
    this.pendingApprovals = new Map(); // key `${turnId}:${callId}` -> { resolve }
  }

  /**
   * Waits for an approval decision from the renderer UI.
   * @param {string} turnId
   * @param {string} callId
   * @param {number} [timeoutMs]
   * @returns {Promise<{ approved: boolean, reason?: string, force?: boolean }>}
   */
  waitForApproval(turnId, callId, timeoutMs = 300000) {
    const key = `${turnId}:${callId}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(key);
        resolve({ approved: false, reason: 'Approval request timed out after 5 minutes' });
      }, timeoutMs);

      this.pendingApprovals.set(key, {
        resolve: (decision) => {
          clearTimeout(timer);
          this.pendingApprovals.delete(key);
          resolve(decision);
        },
      });
    });
  }

  /**
   * Approves a pending tool action.
   * @param {string} turnId
   * @param {string} callId
   * @param {Object} [decision]
   * @returns {{ success: boolean, error?: string }}
   */
  approveAction(turnId, callId, decision = {}) {
    const key = `${turnId}:${callId}`;
    const pending = this.pendingApprovals.get(key);
    if (pending) {
      pending.resolve({ approved: true, ...decision });
      return { success: true, callId };
    }
    for (const [k, p] of this.pendingApprovals.entries()) {
      if (k.endsWith(`:${callId}`) || k === callId) {
        p.resolve({ approved: true, ...decision });
        this.pendingApprovals.delete(k);
        return { success: true, callId };
      }
    }
    return { success: false, error: `No pending approval found for action "${callId}"` };
  }

  /**
   * Rejects a pending tool action.
   * @param {string} turnId
   * @param {string} callId
   * @param {string} [reason]
   * @returns {{ success: boolean, error?: string }}
   */
  rejectAction(turnId, callId, reason = 'Action rejected by user') {
    const key = `${turnId}:${callId}`;
    const pending = this.pendingApprovals.get(key);
    if (pending) {
      pending.resolve({ approved: false, reason });
      return { success: true, callId };
    }
    for (const [k, p] of this.pendingApprovals.entries()) {
      if (k.endsWith(`:${callId}`) || k === callId) {
        p.resolve({ approved: false, reason });
        this.pendingApprovals.delete(k);
        return { success: true, callId };
      }
    }
    return { success: false, error: `No pending approval found for action "${callId}"` };
  }

  /**
   * Executes an iterative agent turn to completion.
   * @param {Object} payload
   * @param {string} payload.threadId - Target Thread ID
   * @param {string} [payload.turnId] - Existing or new Turn ID
   * @param {string} payload.userInput - User prompt / directive
   * @param {string} [payload.workspacePath] - Active workspace root
   * @param {string} [payload.activeFilePath] - Active editor file path
   * @param {string} [payload.intent] - 'GENERAL_CHAT' | 'READ_ONLY' | 'MUTATION'
   * @param {string} [payload.approvalMode] - 'strict' | 'auto' | 'manual'
   * @param {number} [payload.maxIterations] - Safety ceiling for iterations (default: 10)
   * @param {number} [payload.maxToolCalls] - Safety ceiling for tool calls (default: 25)
   * @param {Function} [payload.modelHandler] - Optional simulated/mock model callback for testing
   * @param {string} [payload.providerId] - Provider ID override
   * @param {string} [payload.modelId] - Model ID override
   * @param {Object} [payload.continuumSnapshot] - Optional snapshot context to inject
   * @returns {Promise<Object>} Execution outcome metadata
   */
  async runTurn(payload = {}) {
    const {
      threadId,
      userInput = '',
      workspacePath = process.cwd(),
      activeFilePath = null,
      intent = 'MUTATION',
      approvalMode = 'strict',
      maxIterations = DEFAULT_MAX_ITERATIONS,
      maxToolCalls = DEFAULT_MAX_TOOL_CALLS,
      modelHandler,
      providerId,
      modelId,
      continuumSnapshot: rawContinuumSnapshot,
      continuumContextText: rawContinuumContextText,
      continuumActive: rawContinuumActive,
    } = payload;

    const continuumActive = payload.continuumActive === true;
    let continuumSnapshot = null;
    let continuumContextText = '';

    if (continuumActive) {
      continuumSnapshot = rawContinuumSnapshot || null;
      continuumContextText = rawContinuumContextText || '';
      if (!continuumSnapshot && !continuumContextText && this.runtime?.getLatestWorkspaceSnapshot) {
        try {
          continuumSnapshot = this.runtime.getLatestWorkspaceSnapshot(workspacePath, threadId);
        } catch (e) {}
      }
    }

    if (!threadId || typeof threadId !== 'string') {
      throw new Error('[HARNESS-AGENTLOOP] Valid "threadId" is required to run turn');
    }

    if (!this.runtime) {
      throw new Error('[HARNESS-AGENTLOOP] AgentLoop requires an attached HarnessRuntime');
    }

    const targetTurnId = payload.turnId || payload.retryTurnId;
    let initialTurn = null;
    if (targetTurnId) {
      initialTurn = this.runtime.getTurn(targetTurnId);
      if (initialTurn && initialTurn.status === TURN_STATUS.CANCELLED) {
        return {
          success: false,
          status: TURN_STATUS.CANCELLED,
          turnId: initialTurn.turnId,
          threadId: initialTurn.threadId || threadId,
          iterations: 0,
          totalToolCalls: 0,
          finalResponse: 'Turn was cancelled',
          summary: 'Turn was cancelled',
          steps: [],
        };
      }
    }

    // 0. Conversational Intent Gate: Conversational messages must not inspect workspace or call tools
    const routerClassification = this.runtime?.classifyRequest
      ? this.runtime.classifyRequest(userInput, { activeFilePath, workspacePath })
      : requestRouter.classify(userInput, { activeFilePath, workspacePath });

    const isExplicitGeneralChat = payload.intent === 'GENERAL_CHAT';
    const isPureGreeting = isGreeting(userInput);
    const isClassifiedConversation = routerClassification.mode === ROUTER_MODES.CONVERSATION;

    const isConversational = isPureGreeting ||
      isExplicitGeneralChat ||
      (typeof modelHandler !== 'function' && isClassifiedConversation) ||
      (typeof modelHandler === 'function' && isExplicitGeneralChat);

    if (isConversational) {
      let turn = initialTurn;
      if (!turn && targetTurnId) {
        turn = this.runtime.getTurn(targetTurnId);
      }
      if (!turn) {
        turn = this.runtime.startTurn(threadId, userInput, {
          intent: 'GENERAL_CHAT',
          activeFilePath: null,
          workspacePath,
          providerId,
          modelId,
        });
      }

      const turnId = turn.turnId;

      // Add USER_MESSAGE Item
      const existingItems = this.runtime.itemStore.getItemsByTurn(turnId);
      const hasUserMsg = existingItems.some((i) => i.type === ITEM_TYPES.USER_MESSAGE);
      if (!hasUserMsg && userInput) {
        const userItem = this.runtime.startItem(turnId, ITEM_TYPES.USER_MESSAGE, {
          text: userInput,
        });
        this.runtime.completeItem(userItem.itemId);
      }

      // Return conversational response (pure greetings use zero-AI deterministic gate; non-greetings invoke modelHandler / conversational AI with tools: [] with smart deterministic fallback)
      let reply = '';
      if (isGreeting(userInput)) {
        reply = getConversationalGreetingResponse(userInput);
      } else if (typeof modelHandler === 'function') {
        try {
          const handlerOutput = await modelHandler(
            [
              { role: 'system', content: continuumContextText || '' },
              { role: 'user', content: userInput },
            ],
            []
          );
          reply = typeof handlerOutput === 'string' ? handlerOutput : (handlerOutput?.content || handlerOutput?.summary || 'Handled by custom modelHandler');
        } catch (e) {
          reply = getConversationalResponse(userInput, continuumContextText);
        }
      } else {
        let modelReplied = false;
        try {
          const convSystemPrompt = continuumContextText
            ? `You are NEXUS, a helpful, natural, and concise AI pair programmer.\nContinuum Lineage Context:\n${continuumContextText}\n\nRespond conversationally, naturally, and concisely to the user. Do not perform code mutations or invent file paths unless asked.`
            : `You are NEXUS, a helpful, natural, and concise AI pair programmer. Respond conversationally, naturally, and concisely to the user. Do not perform code mutations or invent file paths unless asked.`;

          const convMessages = [
            { role: 'system', content: convSystemPrompt },
            { role: 'user', content: userInput },
          ];

          const modelRes = await this.modelAdapter.invoke(convMessages, [], {
            threadId,
            turnId,
            workspacePath,
            activeFilePath,
            intent: 'GENERAL_CHAT',
            providerId,
            modelId,
          });

          if (modelRes && modelRes.content && modelRes.content.trim()) {
            reply = modelRes.content.trim();
            modelReplied = true;
          }
        } catch (err) {
          // Provider unconfigured or offline — fallback cleanly
        }

        if (!modelReplied) {
          reply = getConversationalResponse(userInput, continuumContextText);
        }
      }

      const agentItem = this.runtime.startItem(turnId, ITEM_TYPES.AGENT_MESSAGE, {
        text: reply,
        summary: reply,
      });
      this.runtime.completeItem(agentItem.itemId);

      this.runtime.turnManager.completeTurn(turnId, { summary: reply, outcome: 'SUCCESS', iterations: 0, totalToolCalls: 0 });

      return {
        success: true,
        status: TURN_STATUS.COMPLETED,
        turnId,
        threadId,
        iterations: 0,
        totalToolCalls: 0,
        finalResponse: reply,
        summary: reply,
        steps: [],
        execution: {
          providerId: providerId || 'nexus1',
          modelId: modelId || 'gemini-2.5-flash',
        },
        isConversational: true,
      };
    }

    // 1. Start or retrieve active Turn
    let turn = initialTurn;
    if (targetTurnId) {
      if (!turn) {
        turn = this.runtime.getTurn(targetTurnId);
      }
      if (!turn) {
        throw new Error(`[HARNESS-AGENTLOOP] Turn "${targetTurnId}" not found`);
      }
      // If turn is paused, failed (for retry), or waiting for approval, resume/reactivate it
      if (turn.status === TURN_STATUS.FAILED) {
        try {
          turn = this.runtime.turnManager.retryTurn(targetTurnId);
        } catch (e) {
          turn.status = TURN_STATUS.RUNNING;
        }
      } else if (turn.status === TURN_STATUS.PAUSED || turn.status === TURN_STATUS.WAITING_FOR_APPROVAL) {
        try {
          turn = this.runtime.turnManager.resumeTurn(targetTurnId);
        } catch (e) {
          turn.status = TURN_STATUS.RUNNING;
        }
      }
    } else {
      turn = this.runtime.startTurn(threadId, userInput, {
        intent,
        activeFilePath,
        workspacePath,
        providerId,
        modelId,
        selectionText: payload.selectionText,
        selectionStartLine: payload.selectionStartLine,
        selectionStartColumn: payload.selectionStartColumn,
        selectionEndLine: payload.selectionEndLine,
        selectionEndColumn: payload.selectionEndColumn,
        cursorLine: payload.cursorLine,
        cursorColumn: payload.cursorColumn,
        gitBranch: payload.gitBranch,
        diagnostic: payload.diagnostic,
      });
    }

    const turnId = turn.turnId;

    if (turn.status === TURN_STATUS.CANCELLED) {
      return {
        success: false,
        status: TURN_STATUS.CANCELLED,
        turnId,
        iterations: 0,
        message: 'Turn is in CANCELLED state',
      };
    }

    if (turn.status === TURN_STATUS.COMPLETED) {
      return {
        success: true,
        status: TURN_STATUS.COMPLETED,
        turnId,
        iterations: 0,
        finalResponse: turn.metadata?.summary || 'Turn already completed',
      };
    }

    // 2. Add USER_MESSAGE Item if not already created
    const existingItems = this.runtime.itemStore.getItemsByTurn(turnId);
    const hasUserMsg = existingItems.some((i) => i.type === ITEM_TYPES.USER_MESSAGE);
    if (userInput && !hasUserMsg) {
      const userItem = this.runtime.startItem(turnId, ITEM_TYPES.USER_MESSAGE, {
        text: userInput,
      });
      this.runtime.completeItem(userItem.itemId);

      if (evidenceGraphInstance && threadId) {
        try {
          evidenceGraphInstance.addNode({
            sessionId: threadId,
            type: 'TASK',
            statement: `User Task: ${userInput}`,
            provenanceClass: 'USER_APPROVED',
            verificationLevel: 'USER_VERIFIED',
          });
        } catch (e) {}
      }
    }

    // Resolve active skills for turn context (Milestone 12)
    let resolvedSkills = [];
    if (this.runtime?.skillRegistry) {
      resolvedSkills = this.runtime.skillRegistry.resolveSkills({
        userInput,
        activeFilePath,
        intent,
        requestedSkills: payload.requestedSkills || turn?.metadata?.requestedSkills || [],
      });
    }

    // Tool availability based on intent, role, and CapabilityRegistry (Milestone 12)
    let tools = [];
    if (intent !== 'GENERAL_CHAT') {
      if (this.runtime?.capabilityRegistry) {
        const permittedCaps = this.runtime.capabilityRegistry.filterCapabilitiesForTurn({
          role: payload.role || turn?.metadata?.role,
          intent,
          allowedTools: payload.allowedTools || turn?.metadata?.allowedTools,
          isChild: Boolean(payload.isChild || turn?.metadata?.isChild),
        });
        tools = permittedCaps.filter((c) => c.type !== 'SKILL').map((c) => ({
          name: c.name,
          description: c.description,
          inputSchema: c.inputSchema,
          requiresApproval: typeof c.requiresApproval === 'function' ? 'conditional' : Boolean(c.requiresApproval),
        }));
      } else if (intent === 'READ_ONLY') {
        tools = this.toolRegistry.list().filter((t) => t.name !== 'apply_patch');
      } else {
        tools = this.toolRegistry.list();
      }

      if (Array.isArray(payload.allowedTools) && payload.allowedTools.length > 0) {
        const allowSet = new Set(payload.allowedTools);
        tools = tools.filter((t) => allowSet.has(t.name));
      }
    }

    let iterations = 0;
    let totalToolCalls = 0;
    let finalAssistantResponse = null;
    let lastContextMetrics = null;

    try {
      while (iterations < maxIterations) {
        // Check for Turn Cancellation before calling model
        const currentTurnCheck = this.runtime.getTurn(turnId);
        if (currentTurnCheck && currentTurnCheck.status === TURN_STATUS.CANCELLED) {
          return {
            success: false,
            status: TURN_STATUS.CANCELLED,
            turnId,
            iterations,
            message: 'Agent turn was cancelled by user directive',
          };
        }

        iterations++;

        // 3. Compile context via ContextEngine
        const threadTurns = this.runtime.turnManager.listTurnsByThread(threadId);
        const threadItems = [];
        for (const t of threadTurns) {
          threadItems.push(...this.runtime.itemStore.getItemsByTurn(t.turnId));
        }

        let decisions = [];
        let verification = null;
        if (evidenceGraphInstance && threadId) {
          try {
            const nodes = evidenceGraphInstance.getNodesBySession(threadId);
            decisions = nodes.filter((n) => n.type === 'AI_DECISION' || n.type === 'USER_APPROVAL');
            verification = evidenceGraphInstance.getVerificationSummary(threadId);
          } catch (e) {}
        }

        const contextOutcome = this.contextEngine.buildContext({
          thread: this.runtime.getThread(threadId),
          turn: this.runtime.getTurn(turnId),
          turns: threadTurns,
          items: threadItems,
          continuumSnapshot,
          continuumContextText,
          continuumActive,
          importedCapsule: payload.importedCapsule || turn?.metadata?.importedCapsule || null,
          handoffState: payload.handoffState || turn?.metadata?.handoffState || null,
          workspacePath,
          activeFilePath,
          selectionText: payload.selectionText ?? turn?.metadata?.selectionText,
          selectionStartLine: payload.selectionStartLine ?? turn?.metadata?.selectionStartLine,
          selectionStartColumn: payload.selectionStartColumn ?? turn?.metadata?.selectionStartColumn,
          selectionEndLine: payload.selectionEndLine ?? turn?.metadata?.selectionEndLine,
          selectionEndColumn: payload.selectionEndColumn ?? turn?.metadata?.selectionEndColumn,
          cursorLine: payload.cursorLine ?? turn?.metadata?.cursorLine,
          cursorColumn: payload.cursorColumn ?? turn?.metadata?.cursorColumn,
          gitBranch: payload.gitBranch ?? turn?.metadata?.gitBranch,
          diagnostic: payload.diagnostic ?? turn?.metadata?.diagnostic ?? null,
          intent,
          decisions,
          verification,
          resolvedSkills,
          capabilities: tools,
          options: payload.contextOptions || {},
        });

        lastContextMetrics = contextOutcome?.metadata || null;

        const messages = [
          { role: 'system', content: contextOutcome.systemPrompt },
          ...contextOutcome.messages,
        ];

        // 4. Stream Model Output Progressive Deltas
        let streamItem = null;
        let streamStarted = false;
        let accumulatedText = '';
        let streamToolCalls = [];
        let modelResponse = { role: 'assistant', content: '', toolCalls: [] };

        const abortController = new AbortController();

        try {
          const streamGen = this.modelAdapter.stream(messages, tools, {
            threadId,
            turnId,
            workspacePath,
            activeFilePath,
            intent,
            providerId,
            modelId,
            modelHandler,
            abortSignal: abortController.signal,
          });

          for await (const chunk of streamGen) {
            // Check turn cancellation mid-stream
            const currentTurn = this.runtime.getTurn(turnId);
            if (currentTurn && currentTurn.status === TURN_STATUS.CANCELLED) {
              abortController.abort();
              if (streamItem) {
                this.runtime.cancelItem(streamItem.itemId, 'Turn cancelled during streaming');
              }
              return {
                success: false,
                status: TURN_STATUS.CANCELLED,
                turnId,
                iterations,
                message: 'Agent turn was cancelled during streaming',
              };
            }

            if (chunk.type === 'message_delta' && chunk.delta) {
              accumulatedText = chunk.accumulated || (accumulatedText + chunk.delta);

              if (!streamStarted) {
                streamItem = this.runtime.startItem(turnId, ITEM_TYPES.AGENT_MESSAGE, {
                  text: accumulatedText,
                  delta: chunk.delta,
                });
                streamStarted = true;
              } else {
                this.runtime.updateItem(streamItem.itemId, {
                  text: accumulatedText,
                  delta: chunk.delta,
                });
              }
            }

            if (chunk.toolCalls && chunk.toolCalls.length > 0) {
              streamToolCalls = chunk.toolCalls;
            }
          }

          modelResponse.content = accumulatedText;
          modelResponse.toolCalls = streamToolCalls;
        } catch (streamErr) {
          if (streamItem) {
            this.runtime.failItem(streamItem.itemId, streamErr.message);
          }
          throw streamErr;
        }

        // Check for cancellation immediately after model return
        const postModelTurnCheck = this.runtime.getTurn(turnId);
        if (postModelTurnCheck && postModelTurnCheck.status === TURN_STATUS.CANCELLED) {
          if (streamItem && streamItem.status !== ITEM_STATUS.COMPLETED && streamItem.status !== ITEM_STATUS.CANCELLED) {
            this.runtime.cancelItem(streamItem.itemId, 'Turn was cancelled');
          }
          return {
            success: false,
            status: TURN_STATUS.CANCELLED,
            turnId,
            iterations,
            message: 'Agent turn was cancelled',
          };
        }

        const toolCalls = modelResponse.toolCalls || [];

        // 5. If model returned Tool Calls: execute sequentially
        if (toolCalls.length > 0) {
          if (streamItem) {
            this.runtime.completeItem(streamItem.itemId, { text: accumulatedText });
          }
          // Check safety ceiling for tool calls
          if (totalToolCalls + toolCalls.length > maxToolCalls) {
            const errItem = this.runtime.startItem(turnId, ITEM_TYPES.ERROR, {
              error: `Maximum tool call limit of ${maxToolCalls} exceeded`,
            });
            this.runtime.completeItem(errItem.itemId);
            this.runtime.failTurn(turnId, `Exceeded maximum tool calls limit of ${maxToolCalls}`);
            return {
              success: false,
              status: TURN_STATUS.FAILED,
              turnId,
              error: `Exceeded maximum tool calls limit of ${maxToolCalls}`,
            };
          }

          for (const tc of toolCalls) {
            // Check cancellation before executing individual tool
            const preToolCheck = this.runtime.getTurn(turnId);
            if (preToolCheck && preToolCheck.status === TURN_STATUS.CANCELLED) {
              return {
                success: false,
                status: TURN_STATUS.CANCELLED,
                turnId,
                iterations,
                message: 'Turn cancelled before tool execution',
              };
            }

            // Prevent duplicate tool execution if resuming a partially completed sequence
            const liveTurnItems = this.runtime.itemStore.getItemsByTurn(turnId);
            const alreadyExecuted = liveTurnItems.some(
              (i) => i.type === ITEM_TYPES.TOOL_CALL && i.payload?.callId === tc.callId
            );
            if (alreadyExecuted) {
              continue;
            }

            totalToolCalls++;

            // Create and complete TOOL_CALL Item
            const toolCallItem = this.runtime.startItem(turnId, ITEM_TYPES.TOOL_CALL, {
              callId: tc.callId,
              toolName: tc.toolName,
              arguments: tc.arguments,
            });
            this.runtime.completeItem(toolCallItem.itemId);

            const execContext = {
              threadId,
              turnId,
              callId: tc.callId,
              workspacePath,
              activeFilePath,
              approvalMode,
              providerId,
              modelId,
              intent,
              modelHandler,
              mockResponses: payload.mockResponses,
              eventBus: this.runtime?.eventBus,
              runtime: this.runtime,
              swarmOrchestrator: this.runtime?.swarmOrchestrator || defaultSwarmOrchestrator,
            };

            const capDef = this.runtime?.capabilityRegistry?.getCapability(tc.toolName);
            const isExternal = capDef && (capDef.source === 'mcp' || capDef.source === 'project' || capDef.type === 'MCP_TOOL' || Boolean(capDef.metadata?.serverId));

            if (isExternal && this.runtime?.eventBus) {
              this.runtime.eventBus.emit(EVENT_TYPES.EXTERNAL_TOOL_STARTED, {
                payload: {
                  callId: tc.callId,
                  toolName: tc.toolName,
                  serverId: capDef.metadata?.serverId,
                  arguments: tc.arguments,
                },
              });
            }

            let execResult;
            if (intent === 'READ_ONLY' && tc.toolName === 'apply_patch') {
              execResult = {
                success: false,
                error: 'Mutation tool "apply_patch" is strictly disallowed in READ_ONLY intent.',
                requiresApproval: false,
              };
            } else {
              execResult = await this.toolRegistry.execute(tc.toolName, tc.arguments, execContext);
            }

            if (isExternal && this.runtime?.eventBus) {
              if (execResult.success) {
                this.runtime.eventBus.emit(EVENT_TYPES.EXTERNAL_TOOL_COMPLETED, {
                  payload: {
                    callId: tc.callId,
                    toolName: tc.toolName,
                    serverId: capDef.metadata?.serverId,
                    success: true,
                  },
                });
              } else if (!execResult.requiresApproval) {
                this.runtime.eventBus.emit(EVENT_TYPES.EXTERNAL_TOOL_FAILED, {
                  payload: {
                    callId: tc.callId,
                    toolName: tc.toolName,
                    serverId: capDef.metadata?.serverId,
                    error: execResult.error,
                  },
                });
              }
            }

            // If apply_patch staged a ChangeSet, record CHANGE_SET item immediately
            let changeSetItemId = null;
            if (tc.toolName === 'apply_patch' && Array.isArray(tc.arguments?.edits)) {
              const cs = execResult.changeSet || execResult.result?.changeSet;
              if (cs) {
                console.log(`[HARNESS-AGENTLOOP] Staged ChangeSet: ${cs.changeSetId} (${cs.files?.length || 0} files)`);
                try {
                  const changeSetItem = this.runtime.startItem(turnId, ITEM_TYPES.CHANGE_SET, {
                    changeSetId: cs.changeSetId,
                    status: cs.status || 'staged',
                    risk: cs.risk || execResult.result?.firewall || { risk_level: 'AUTO_APPROVE', risk_score: 0 },
                    files: cs.files,
                    transactionId: execResult.result?.transactionId,
                  });
                  this.runtime.completeItem(changeSetItem.itemId);
                  changeSetItemId = changeSetItem.itemId;
                } catch (csErr) {}
              }
            }

            // If tool required approval and was blocked, wait for user decision unless auto mode
            if (execResult.requiresApproval && !execResult.success) {
              console.log(`[HARNESS-AGENTLOOP] Action "${tc.callId}" (${tc.toolName}) requires approval. Transitioning to WAITING_FOR_APPROVAL.`);
              const approvalItem = this.runtime.startItem(turnId, ITEM_TYPES.APPROVAL_REQUEST, {
                callId: tc.callId,
                toolName: tc.toolName,
                policyDecision: execResult.policyDecision,
                error: execResult.error,
                changeSet: execResult.changeSet || execResult.result?.changeSet || null,
              });
              this.runtime.completeItem(approvalItem.itemId);

              if (approvalMode !== 'auto') {
                // Set turn state to WAITING_FOR_APPROVAL while blocked
                try {
                  this.runtime.turnManager.setWaitingForApproval(turnId);
                } catch (e) {}

                const decision = await this.waitForApproval(turnId, tc.callId, payload.approvalTimeoutMs || 300000);
                console.log(`[HARNESS-AGENTLOOP] Received approval decision for "${tc.callId}": approved=${Boolean(decision?.approved)}`);

                // Resume turn to RUNNING after decision
                try {
                  this.runtime.turnManager.resumeTurn(turnId);
                } catch (e) {}

                if (decision && decision.approved) {
                  execResult = await this.toolRegistry.execute(tc.toolName, tc.arguments, {
                    ...execContext,
                    isApproved: true,
                    isForceApproved: Boolean(decision.force),
                    approvalReason: decision.reason,
                  });
                } else {
                  execResult = {
                    success: false,
                    error: decision?.reason || 'Tool execution was rejected by user',
                    rejected: true,
                  };
                }
              }
            }

            // If apply_patch was executed successfully, record FILE_CHANGE items
            if (tc.toolName === 'apply_patch' && Array.isArray(tc.arguments?.edits)) {
              if (!changeSetItemId) {
                const cs = execResult.result?.changeSet || execResult.changeSet;
                if (cs) {
                  try {
                    const changeSetItem = this.runtime.startItem(turnId, ITEM_TYPES.CHANGE_SET, {
                      changeSetId: cs.changeSetId,
                      status: cs.status || (execResult.success ? 'applied' : 'staged'),
                      risk: cs.risk || execResult.result?.firewall || { risk_level: 'AUTO_APPROVE', risk_score: 0 },
                      files: cs.files,
                      transactionId: execResult.result?.transactionId,
                    });
                    this.runtime.completeItem(changeSetItem.itemId);
                  } catch (csErr) {}
                }
              }



              if (execResult.success) {
                for (const edit of tc.arguments.edits) {
                  try {
                    const fileChangeItem = this.runtime.startItem(turnId, ITEM_TYPES.FILE_CHANGE, {
                      filePath: edit.filePath,
                      changeType: 'MODIFY',
                      original: edit.original,
                      replacement: edit.replacement,
                      diff: `--- a/${edit.filePath}\n+++ b/${edit.filePath}\n@@ -1,1 +1,1 @@\n-${edit.original}\n+${edit.replacement}`,
                      firewall: execResult.result?.firewall || { risk_level: 'AUTO_APPROVE', risk_score: 0 },
                      status: 'applied',
                    });
                    this.runtime.completeItem(fileChangeItem.itemId);

                    if (evidenceGraphInstance && threadId) {
                      try {
                        evidenceGraphInstance.addNode({
                          sessionId: threadId,
                          type: 'CODE_CHANGE',
                          statement: `Applied patch to ${edit.filePath}`,
                          provenanceClass: 'TRANSACTION_VERIFIED',
                          verificationLevel: 'TRANSACTION_VERIFIED',
                          file_path: edit.filePath,
                        });
                        if (execResult.result?.firewall) {
                          evidenceGraphInstance.addNode({
                            sessionId: threadId,
                            type: 'SAFETY_CHECK',
                            statement: `Firewall risk assessment: ${execResult.result.firewall.risk_level || 'LOW'}`,
                            provenanceClass: 'FIREWALL_VERIFIED',
                            verificationLevel: 'SAFETY_VERIFIED',
                            file_path: edit.filePath,
                          });
                        }
                      } catch (e) {}
                    }
                  } catch (fcErr) {}
                }
              }
            }

            // Create and complete TOOL_RESULT Item
            const toolResultItem = this.runtime.startItem(turnId, ITEM_TYPES.TOOL_RESULT, {
              callId: tc.callId,
              toolName: tc.toolName,
              success: execResult.success,
              result: execResult.result,
              error: execResult.error,
              requiresApproval: execResult.requiresApproval || false,
            });

            if (execResult.success) {
              this.runtime.completeItem(toolResultItem.itemId);
            } else {
              this.runtime.failItem(toolResultItem.itemId, execResult.error || 'Tool failed');
            }

            // Record evidence for tool execution
            if (evidenceGraphInstance && threadId) {
              try {
                if (tc.toolName === 'read_file' || tc.toolName === 'search_workspace') {
                  evidenceGraphInstance.addNode({
                    sessionId: threadId,
                    type: 'OBSERVATION',
                    statement: `Observed output from ${tc.toolName}`,
                    provenanceClass: 'OBSERVED',
                    verificationLevel: 'OBSERVED',
                    file_path: tc.arguments?.path,
                  });
                } else if (tc.toolName === 'run_tests') {
                  evidenceGraphInstance.addNode({
                    sessionId: threadId,
                    type: 'TEST_RESULT',
                    statement: `Test execution: ${execResult.success ? 'PASSED' : 'FAILED'} (passed: ${execResult.result?.passed ?? 0}, failed: ${execResult.result?.failed ?? 0})`,
                    provenanceClass: 'TEST_VERIFIED',
                    verificationLevel: 'TEST_VERIFIED',
                  });
                } else if (tc.toolName === 'swarm_plan') {
                  evidenceGraphInstance.addNode({
                    sessionId: threadId,
                    type: 'TASK',
                    statement: `Swarm Plan configured [${execResult.result?.swarmId || 'unknown'}]: ${execResult.result?.taskCount || 0} tasks (${execResult.success ? 'VALID' : 'FAILED'})`,
                    provenanceClass: 'SYSTEM_GENERATED',
                    verificationLevel: 'OBSERVED',
                    metadata: { swarmId: execResult.result?.swarmId, taskCount: execResult.result?.taskCount },
                  });
                } else if (tc.toolName === 'swarm_execute') {
                  evidenceGraphInstance.addNode({
                    sessionId: threadId,
                    type: 'TASK',
                    statement: `Swarm Execution [${execResult.result?.swarmId || tc.arguments?.swarmId || 'unknown'}]: status ${execResult.result?.status || (execResult.success ? 'COMPLETED' : 'FAILED')}, completed ${execResult.result?.completedTaskCount || 0}/${execResult.result?.taskCount || 0}`,
                    provenanceClass: 'SYSTEM_GENERATED',
                    verificationLevel: 'OBSERVED',
                    metadata: {
                      swarmId: execResult.result?.swarmId || tc.arguments?.swarmId,
                      status: execResult.result?.status,
                      completedTaskCount: execResult.result?.completedTaskCount,
                    },
                  });
                } else if (tc.toolName === 'swarm_cancel') {
                  evidenceGraphInstance.addNode({
                    sessionId: threadId,
                    type: 'TASK',
                    statement: `Swarm Cancelled [${execResult.result?.swarmId || tc.arguments?.swarmId || 'unknown'}]`,
                    provenanceClass: 'USER_APPROVED',
                    verificationLevel: 'OBSERVED',
                    metadata: { swarmId: execResult.result?.swarmId || tc.arguments?.swarmId },
                  });
                }
              } catch (e) {}
            }
          }

          // Continue to next iteration loop to let model observe results
          continue;
        }

        // 6. If model returned final conversational text (no tool calls): complete turn
        finalAssistantResponse = modelResponse.content || 'Task completed successfully.';

        if (streamItem) {
          this.runtime.completeItem(streamItem.itemId, {
            text: finalAssistantResponse,
            summary: finalAssistantResponse,
          });
        } else {
          const agentMsgItem = this.runtime.startItem(turnId, ITEM_TYPES.AGENT_MESSAGE, {
            text: finalAssistantResponse,
            summary: finalAssistantResponse,
          });
          this.runtime.completeItem(agentMsgItem.itemId);
        }

        const completedTurn = this.runtime.completeTurn(turnId, {
          outcome: 'SUCCESS',
          summary: finalAssistantResponse,
          iterations,
          totalToolCalls,
        });

        if (evidenceGraphInstance && threadId) {
          try {
            evidenceGraphInstance.addNode({
              sessionId: threadId,
              type: 'VERIFICATION',
              statement: `Turn completed successfully with ${totalToolCalls} tool operations.`,
              provenanceClass: 'MODEL_INFERENCE',
              verificationLevel: 'UNVERIFIED',
            });
          } catch (e) {}
        }

        return {
          success: true,
          status: TURN_STATUS.COMPLETED,
          turnId,
          threadId,
          providerId,
          modelId,
          turn: completedTurn,
          finalResponse: finalAssistantResponse,
          iterations,
          totalToolCalls,
          contextMetrics: lastContextMetrics,
        };
      }

      // If loop finished due to max iterations limit
      const iterErrorMsg = `Maximum iteration limit of ${maxIterations} reached without completion`;
      const errorItem = this.runtime.startItem(turnId, ITEM_TYPES.ERROR, {
        error: iterErrorMsg,
      });
      this.runtime.completeItem(errorItem.itemId);

      const failedTurn = this.runtime.failTurn(turnId, iterErrorMsg);
      return {
        success: false,
        status: TURN_STATUS.FAILED,
        turnId,
        turn: failedTurn,
        error: iterErrorMsg,
        iterations,
        totalToolCalls,
      };
    } catch (err) {
      console.error('[HARNESS-AGENTLOOP] Turn execution error:', err);
      const actualProviderId = err.rateInfo?.providerId || err.providerId || providerId;
      const actualModelId = err.rateInfo?.modelId || err.modelId || modelId;
      const { parseRateLimitError } = require('../ai/types');
      const rateInfo = err.rateInfo || parseRateLimitError(err, actualProviderId, actualModelId);
      const finalProviderId = rateInfo?.providerId || actualProviderId || 'groq';
      const finalModelId = rateInfo?.modelId || actualModelId || '';
      const safeErrorMsg = secretFilter.sanitizeString(rateInfo ? rateInfo.message : (err.message || 'Agent loop encountered an error'));

      try {
        const errorItem = this.runtime.startItem(turnId, ITEM_TYPES.ERROR, {
          error: safeErrorMsg,
          isRateLimit: Boolean(rateInfo),
          rateInfo,
          providerId: finalProviderId,
          modelId: finalModelId,
        });
        this.runtime.completeItem(errorItem.itemId);
      } catch (e) {}

      try {
        this.runtime.failTurn(turnId, safeErrorMsg);
      } catch (e) {}

      return {
        success: false,
        status: TURN_STATUS.FAILED,
        turnId,
        threadId,
        isRateLimit: Boolean(rateInfo),
        rateInfo: rateInfo || undefined,
        providerId: finalProviderId,
        modelId: finalModelId,
        error: safeErrorMsg,
        iterations,
        totalToolCalls,
      };
    }
  }
}

module.exports = {
  AgentLoop,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS,
};
