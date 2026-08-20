/**
 * NEXUS CODEX HARNESS - CONTINUUM PERSISTENCE ADAPTER
 * Bridges Harness Threads, Turns, and Items to NEXUS's verified Continuum storage architecture.
 * Guarantees zero schema breakage and 100% compatibility with existing Continuum snapshots.
 */

const path = require('path');
const { continuumManager } = require('../continuumManager');
const { continuumEngine } = require('../../engine/continuum_engine');
const secretFilter = require('../../security/secretFilter');
const { ITEM_TYPES, ITEM_STATUS, TURN_STATUS, THREAD_STATUS } = require('./types');
const { workspaceIsolationManager } = require('./WorkspaceIsolationManager');

class HarnessPersistenceAdapter {

  constructor(continuumMgr = continuumManager, engine = continuumEngine, wsIsoMgr = null) {
    this.continuumManager = continuumMgr;
    this.continuumEngine = engine;
    this.workspaceIsolationManager = wsIsoMgr || workspaceIsolationManager;
  }


  /**
   * Converts a Harness Thread (with its Turns & Items) into a valid ContinuumSnapshot.
   * @param {Object} thread - Harness Thread
   * @param {Array<Object>} [turns] - Array of Turn objects
   * @param {Array<Object>} [items] - Array of Item objects
   * @param {string} [workspacePath] - Workspace directory path
   * @returns {Object} Valid ContinuumSnapshot
   */
  threadToContinuumSnapshot(thread, turns = [], items = [], workspacePath = '') {
    const activeWorkspace = workspacePath || thread.metadata?.workspacePath || process.cwd();
    const workspaceHash = this.continuumManager.getWorkspaceHash(activeWorkspace);
    const workspaceName = thread.metadata?.workspaceName || path.basename(activeWorkspace) || 'workspace';

    // Map turns to Continuum recentTurns
    const recentTurns = turns.map((turn) => {
      // Find agent response / summary from items
      const turnItems = items.filter((i) => i.turnId === turn.turnId);
      const agentMsgItem = turnItems.find((i) => i.type === ITEM_TYPES.AGENT_MESSAGE);
      const summary = agentMsgItem?.payload?.text || agentMsgItem?.payload?.summary || turn.userInput || '';

      let status = 'UNKNOWN';
      if (turn.status === TURN_STATUS.COMPLETED) {
        status = 'IMPLEMENTED';
      } else if (turn.status === TURN_STATUS.RUNNING) {
        status = 'PLANNED';
      } else if (turn.status === TURN_STATUS.FAILED) {
        status = 'BLOCKED';
      }

      return {
        turnId: turn.turnId,
        timestamp: turn.createdAt || Date.now(),
        userPrompt: secretFilter.sanitizeString(turn.userInput || ''),
        agentSummary: secretFilter.sanitizeString(summary),
        status,
        providerId: turn.metadata?.providerId || thread.metadata?.providerId || 'gemini',
        modelId: turn.metadata?.modelId || thread.metadata?.modelId || 'gemini-1.5-flash',
      };
    });

    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const userGoal = lastTurn ? lastTurn.userInput : (thread.metadata?.title || 'Autonomous Harness Thread');
    const completedSteps = turns.filter((t) => t.status === TURN_STATUS.COMPLETED).map((t) => t.userInput);
    const pendingSteps = turns.filter((t) => t.status === TURN_STATUS.RUNNING).map((t) => t.userInput);


    // Extract HandoffState if present on thread, turn, or items
    const handoffData = thread.handoffState || thread.metadata?.handoffState || lastTurn?.metadata?.handoffState || null;
    const handoffStateJSON = handoffData && typeof handoffData.toJSON === 'function' ? handoffData.toJSON() : handoffData;

    const continuumHandoff = {
      immediateNextAction: handoffStateJSON?.nextRecommendedAction || (pendingSteps[0] || 'Continue engineering task'),
      requiredFilesToLoad: handoffStateJSON?.activeFilePath ? [handoffStateJSON.activeFilePath] : [],
      unresolvedQuestions: handoffStateJSON?.unresolvedIssues || [],
      systemInstructionOverride: handoffStateJSON?.continuationConstraints?.join('\n') || '',
    };

    // Extract ChangeSets from items
    const changeSetItems = items.filter((i) => i.type === ITEM_TYPES.CHANGE_SET);
    const changeSetsData = changeSetItems.map((i) => i.payload?.changeSet || i.payload);

    // Create standard validated ContinuumSnapshot
    const snapshotInput = {
      sessionId: thread.threadId,
      parentSessionId: thread.parentThreadId || null,
      createdAt: thread.createdAt || Date.now(),
      updatedAt: thread.updatedAt || Date.now(),
      sequenceNumber: turns.length > 0 ? turns.length : 1,
      generatorAgent: 'nexus-codex-harness-v1',
      project: {
        workspaceName,
        workspacePath: activeWorkspace,
        workspaceHash,
      },
      task: {
        userGoal,
        completedSteps,
        pendingSteps,
      },
      conversation: {
        lastUserDirective: lastTurn?.userInput || '',
        condensedSummary: `Harness Thread: ${thread.threadId} with ${turns.length} turns and ${items.length} items`,
        recentTurns,
      },
    };


    const snapshot = this.continuumEngine.createSnapshot(snapshotInput);
    if (continuumHandoff.immediateNextAction) {
      snapshot.handoff = {
        ...snapshot.handoff,
        ...continuumHandoff,
      };
    }

    // Extract workspace record if isolated
    const wsMgr = this.workspaceIsolationManager || workspaceIsolationManager;
    const workspaceRecord = thread.metadata?.workspaceId
      ? wsMgr.getChildWorkspace(thread.metadata.workspaceId)
      : (wsMgr.getChildWorkspace(thread.threadId) || null);

    snapshot.metadata.harness = {
      thread: secretFilter.sanitizeObject(thread),
      turns: secretFilter.sanitizeObject(turns),
      items: secretFilter.sanitizeObject(items),
      handoffState: secretFilter.sanitizeObject(handoffStateJSON),
      changeSets: secretFilter.sanitizeObject(changeSetsData),
      workspace: secretFilter.sanitizeObject(workspaceRecord),
    };

    return snapshot;
  }

  /**
   * Reconstructs a Thread, Turns, and Items from a loaded ContinuumSnapshot.
   * @param {Object} snapshot - Loaded ContinuumSnapshot
   * @returns {{ thread: Object, turns: Array<Object>, items: Array<Object>, handoffState?: Object }}
   */
  continuumSnapshotToThread(snapshot) {
    if (!snapshot || !snapshot.metadata) {
      throw new Error('[HARNESS-PERSISTENCE] Invalid snapshot object');
    }

    const sessionId = snapshot.metadata.sessionId;
    const parentSessionId = snapshot.metadata.parentSessionId || null;
    const createdAt = snapshot.metadata.createdAt || Date.now();
    const updatedAt = snapshot.metadata.updatedAt || Date.now();
    const workspacePath = snapshot.project?.workspacePath || '';

    // Restore workspace isolation record if present
    const wsMgr = this.workspaceIsolationManager || workspaceIsolationManager;
    if (snapshot.metadata?.harness?.workspace) {
      wsMgr.restoreWorkspace(snapshot.metadata.harness.workspace);
    }


    // 1. If explicit harness metadata was persisted, restore rich state
    if (snapshot.metadata?.harness?.thread) {
      const thread = {
        ...snapshot.metadata.harness.thread,
        threadId: sessionId,
        parentThreadId: parentSessionId || snapshot.metadata.harness.thread.parentThreadId || null,
        parentTurnId: snapshot.metadata.harness.thread.parentTurnId || null,
        rootThreadId: snapshot.metadata.harness.thread.rootThreadId || (parentSessionId ? null : sessionId),
        depth: typeof snapshot.metadata.harness.thread.depth === 'number' ? snapshot.metadata.harness.thread.depth : 0,
        role: snapshot.metadata.harness.thread.role || null,
        createdBy: snapshot.metadata.harness.thread.createdBy || 'user',
      };
      if (snapshot.metadata.harness.handoffState) {
        thread.metadata = thread.metadata || {};
        thread.metadata.handoffState = snapshot.metadata.harness.handoffState;
        thread.handoffState = snapshot.metadata.harness.handoffState;
      }
      const turns = Array.isArray(snapshot.metadata.harness.turns) ? snapshot.metadata.harness.turns : [];
      const items = Array.isArray(snapshot.metadata.harness.items) ? snapshot.metadata.harness.items : [];
      return {
        thread,
        turns,
        items,
        handoffState: snapshot.metadata.harness.handoffState || null,
        changeSets: snapshot.metadata.harness.changeSets || [],
        workspace: snapshot.metadata.harness.workspace || null,
      };
    }



    // 2. Otherwise adapt standard Continuum snapshot into harness format
    const thread = {
      threadId: sessionId,
      parentThreadId: parentSessionId,
      parentTurnId: null,
      rootThreadId: parentSessionId || sessionId,
      depth: parentSessionId ? 1 : 0,
      role: null,
      createdBy: 'user',
      createdAt,
      updatedAt,

      status: THREAD_STATUS.ACTIVE,
      turnIds: [],
      metadata: {
        workspacePath,
        workspaceName: snapshot.project?.workspaceName || 'workspace',
        title: snapshot.task?.userGoal || 'Imported Session',
      },
    };

    const turns = [];
    const items = [];

    const recentTurns = Array.isArray(snapshot.conversation?.recentTurns) ? snapshot.conversation.recentTurns : [];
    recentTurns.forEach((ct, idx) => {
      const turnId = ct.turnId || `turn_${createdAt}_${idx}`;
      thread.turnIds.push(turnId);

      const turn = {
        turnId,
        threadId: sessionId,
        createdAt: ct.timestamp || createdAt,
        startedAt: ct.timestamp || createdAt,
        completedAt: ct.timestamp || createdAt,
        status: ct.status === 'IMPLEMENTED' ? TURN_STATUS.COMPLETED : TURN_STATUS.RUNNING,
        userInput: ct.userPrompt || '',
        itemIds: [],
        metadata: {
          providerId: ct.providerId,
          modelId: ct.modelId,
        },
        error: null,
      };

      if (ct.userPrompt) {
        const userItemId = `item_user_${turnId}`;
        turn.itemIds.push(userItemId);
        items.push({
          itemId: userItemId,
          turnId,
          type: ITEM_TYPES.USER_MESSAGE,
          status: ITEM_STATUS.COMPLETED,
          createdAt: turn.createdAt,
          startedAt: turn.createdAt,
          completedAt: turn.createdAt,
          payload: { text: ct.userPrompt },
          metadata: {},
          error: null,
        });
      }

      if (ct.agentSummary) {
        const agentItemId = `item_agent_${turnId}`;
        turn.itemIds.push(agentItemId);
        items.push({
          itemId: agentItemId,
          turnId,
          type: ITEM_TYPES.AGENT_MESSAGE,
          status: ITEM_STATUS.COMPLETED,
          createdAt: turn.createdAt + 1,
          startedAt: turn.createdAt + 1,
          completedAt: turn.createdAt + 1,
          payload: { text: ct.agentSummary },
          metadata: {},
          error: null,
        });
      }

      turns.push(turn);
    });

    return { thread, turns, items };
  }

  /**
   * Persists a Thread and its active child entities to Continuum storage.
   * @param {Object} thread
   * @param {Array<Object>} turns
   * @param {Array<Object>} items
   * @param {string} [workspacePath]
   * @returns {Object} Save result from continuumManager
   */
  saveThread(thread, turns = [], items = [], workspacePath = '') {
    const activeWorkspace = workspacePath || thread.metadata?.workspacePath || process.cwd();
    const snapshot = this.threadToContinuumSnapshot(thread, turns, items, activeWorkspace);
    return this.continuumManager.saveSnapshot(snapshot, activeWorkspace);
  }

  /**
   * Loads a Thread and its active child entities from Continuum storage.
   * @param {string} threadId
   * @param {string} [workspacePath]
   * @returns {{ success: boolean, thread?: Object, turns?: Array<Object>, items?: Array<Object>, error?: string }}
   */
  loadThread(threadId, workspacePath = '') {
    const activeWorkspace = workspacePath || process.cwd();
    const loadRes = this.continuumManager.loadSnapshot(threadId, activeWorkspace);
    if (!loadRes.success || !loadRes.snapshot) {
      return {
        success: false,
        error: loadRes.error || `Thread "${threadId}" not found`,
      };
    }

    try {
      const { thread, turns, items, workspace } = this.continuumSnapshotToThread(loadRes.snapshot);
      return {
        success: true,
        thread,
        turns,
        items,
        workspace,
        snapshot: loadRes.snapshot,
      };
    } catch (err) {

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Lists persisted threads for a workspace from Continuum storage.
   * @param {string} [workspacePath]
   * @returns {Array<Object>}
   */
  listPersistedThreads(workspacePath = '') {
    const activeWorkspace = workspacePath || process.cwd();
    const snapshots = this.continuumManager.listSnapshots(activeWorkspace);
    return snapshots.map((s) => ({
      threadId: s.sessionId || s.snapshotId,
      parentThreadId: s.parentSessionId || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      title: s.userGoal || 'Persisted Session',
      workspaceName: s.workspaceName,
    }));
  }
}

const harnessPersistenceAdapter = new HarnessPersistenceAdapter();

module.exports = {
  HarnessPersistenceAdapter,
  harnessPersistenceAdapter,
};
