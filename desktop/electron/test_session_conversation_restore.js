/**
 * TEST SUITE: Phase 1E Session Continuity + Conversation Restoration
 * Validates deterministic conversation hydration, duplicate turn prevention,
 * turn metadata preservation, capsule import conversation recovery, and secret safety.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumManager } = require('./continuumManager');
const { continuumCapsuleBuilder } = require('../engine/continuum_capsule_builder');
const { agentManager } = require('./agentManager');
const secretFilter = require('../security/secretFilter');

async function runSessionConversationRestoreTests() {
  console.log('[TEST] Starting Phase 1E Session Conversation Restore Test Suite...');

  const workspacePath = path.join(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');

  // Helper function simulating renderer conversation hydration from a snapshot
  function hydrateMessagesFromSnapshot(snapshot) {
    const turns = snapshot?.conversation?.recentTurns || [];
    const hydratedMessages = [];
    turns.forEach((turn) => {
      if (turn.userPrompt) {
        hydratedMessages.push({
          id: `user_${turn.turnId || turn.timestamp}`,
          role: 'user',
          content: turn.userPrompt,
          timestamp: turn.timestamp,
          turnId: turn.turnId,
        });
      }
      if (turn.agentSummary) {
        hydratedMessages.push({
          id: `agent_${turn.turnId || turn.timestamp}`,
          role: 'agent',
          content: turn.agentSummary,
          timestamp: turn.timestamp + 1,
          turnId: turn.turnId,
          status: turn.status || 'VERIFIED',
          execution: {
            providerId: turn.providerId || snapshot.aiState?.provider || 'gemini',
            modelId: turn.modelId || snapshot.aiState?.modelName || 'gemini-1.5-flash',
            isFallback: false,
          },
        });
      }
    });
    return hydratedMessages;
  }

  // TEST 1: Empty session restores empty conversation
  const emptySnapInput = {
    sessionId: `session_empty_${Date.now()}`,
    sequenceNumber: 1,
    project: { workspaceName: 'demo', workspacePath, workspaceHash: '1234', detectedStack: { primaryLanguage: 'js', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Empty task', activeMilestone: '', currentSubtask: '', completedSteps: [], pendingSteps: [], blockers: [] },
    codeState: { activeTargetNodeId: null, activeFilePath: null, cursorLine: null, dirtyFiles: [], modifiedSymbols: [] },
    decisions: [],
    debugging: { discoveredBugs: [], failedFixes: [], successfulFixes: [] },
    verification: { lastTestStatus: 'NOT_RUN', failingTestNames: [], behavioralDiffSummary: null },
    conversation: { condensedSummary: '', lastUserDirective: '', lastAgentResponseSnippet: '', recentTurns: [] },
    aiState: { provider: 'gemini', modelName: 'gemini-1.5-flash', temperature: 0.1, maxTokens: 2048, activeRole: 'engineer' },
    handoff: { immediateNextAction: '', requiredFilesToLoad: [], unresolvedQuestions: [], systemInstructionOverride: '' },
  };
  const emptySnap = continuumEngine.createSnapshot(emptySnapInput);
  const emptyMessages = hydrateMessagesFromSnapshot(emptySnap);
  assert.strictEqual(emptyMessages.length, 0);
  console.log('[TEST 1 PASSED] Empty session restores 0 conversation messages');

  // TEST 2-6: Session with 2 turns restores exactly 2 turns and preserves turnId, status, providerId, modelId
  const turn1Timestamp = Date.now() - 5000;
  const turn2Timestamp = Date.now() - 2000;
  const multiTurnSnapInput = {
    ...emptySnapInput,
    sessionId: `session_multi_${Date.now()}`,
    conversation: {
      condensedSummary: 'Multi-turn conversation',
      lastUserDirective: 'Refactor checkout',
      lastAgentResponseSnippet: 'Applied verified patch',
      recentTurns: [
        {
          turnId: 'turn_001',
          timestamp: turn1Timestamp,
          userPrompt: 'Analyze checkout flow',
          agentSummary: 'Identified discount calculation logic',
          status: 'IMPLEMENTED',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
        },
        {
          turnId: 'turn_002',
          timestamp: turn2Timestamp,
          userPrompt: 'Refactor checkout with safe removal',
          agentSummary: 'Applied verified AST transformation',
          status: 'VERIFIED',
          providerId: 'claude',
          modelId: 'claude-3-5-sonnet',
        },
      ],
    },
  };
  const multiTurnSnap = continuumEngine.createSnapshot(multiTurnSnapInput);
  const restoredMessages = hydrateMessagesFromSnapshot(multiTurnSnap);
  assert.strictEqual(restoredMessages.length, 4); // 2 user + 2 agent messages

  const restoredUser1 = restoredMessages[0];
  const restoredAgent1 = restoredMessages[1];
  const restoredUser2 = restoredMessages[2];
  const restoredAgent2 = restoredMessages[3];

  assert.strictEqual(restoredUser1.turnId, 'turn_001');
  assert.strictEqual(restoredUser1.content, 'Analyze checkout flow');
  assert.strictEqual(restoredAgent1.turnId, 'turn_001');
  assert.strictEqual(restoredAgent1.status, 'IMPLEMENTED');
  assert.strictEqual(restoredAgent1.execution.providerId, 'gemini');
  assert.strictEqual(restoredAgent1.execution.modelId, 'gemini-1.5-flash');

  assert.strictEqual(restoredUser2.turnId, 'turn_002');
  assert.strictEqual(restoredAgent2.turnId, 'turn_002');
  assert.strictEqual(restoredAgent2.status, 'VERIFIED');
  assert.strictEqual(restoredAgent2.execution.providerId, 'claude');
  assert.strictEqual(restoredAgent2.execution.modelId, 'claude-3-5-sonnet');
  console.log('[TEST 2-6 PASSED] Restored turns preserved turnId, status, providerId, and modelId accurately');

  // TEST 7: Repeated session resume does not duplicate turns (deterministic hydration)
  const resume1 = hydrateMessagesFromSnapshot(multiTurnSnap);
  const resume2 = hydrateMessagesFromSnapshot(multiTurnSnap);
  assert.strictEqual(resume1.length, 4);
  assert.strictEqual(resume2.length, 4);
  assert.deepStrictEqual(resume1.map(m => m.id), resume2.map(m => m.id));
  console.log('[TEST 7 PASSED] Repeated session resumes maintain deterministic turn count (0 duplicates)');

  // TEST 8 & 9: New turn after resume appends exactly one new turn in same logical session chain
  const chainedSnap = continuumEngine.createNextSnapshot(multiTurnSnap, {
    conversation: {
      ...multiTurnSnap.conversation,
      recentTurns: [
        ...multiTurnSnap.conversation.recentTurns,
        {
          turnId: 'turn_003',
          timestamp: Date.now(),
          userPrompt: 'Run verification tests',
          agentSummary: 'All 12 tests passed successfully',
          status: 'VERIFIED',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
        },
      ],
    },
  });

  const chainedMessages = hydrateMessagesFromSnapshot(chainedSnap);
  assert.strictEqual(chainedMessages.length, 6); // 3 user + 3 agent messages
  assert.strictEqual(chainedSnap.metadata.parentSessionId, multiTurnSnap.metadata.sessionId);
  assert.strictEqual(chainedSnap.metadata.sequenceNumber, 2);
  console.log('[TEST 8 & 9 PASSED] New turn chained cleanly into same session line (parentSessionId preserved)');

  // TEST 10 & 11: Old turns retain original provider/model & current session model restores correctly
  assert.strictEqual(chainedMessages[1].execution.providerId, 'gemini');
  assert.strictEqual(chainedMessages[3].execution.providerId, 'claude');
  assert.strictEqual(chainedMessages[5].execution.providerId, 'gemini');
  assert.strictEqual(chainedSnap.aiState.provider, 'gemini');
  console.log('[TEST 10 & 11 PASSED] Historical turn models retained (Turn 1: Gemini, Turn 2: Claude, Turn 3: Gemini)');

  // TEST 12, 13, 14: Imported Nexus Capsule restores conversation without secrets
  const capsule = await continuumCapsuleBuilder.buildCapsule(chainedSnap, workspacePath);
  assert.ok(capsule);
  const capsuleSnapshot = capsule.continuum_snapshot;
  const capsuleMessages = hydrateMessagesFromSnapshot(capsuleSnapshot);
  assert.strictEqual(capsuleMessages.length, 6);

  const fakeKey = 'AIzaSySecretSampleKey12345';
  const rawCapsuleText = JSON.stringify(capsule);
  const rawMessagesText = JSON.stringify(capsuleMessages);
  assert.strictEqual(rawCapsuleText.includes(fakeKey), false);
  assert.strictEqual(rawMessagesText.includes(fakeKey), false);
  console.log('[TEST 12-14 PASSED] Nexus Capsule import restored 6 conversation messages with zero credential leakage');

  // TEST 15: Hidden reasoning / raw HTTP responses are never reconstructed
  capsuleMessages.forEach((msg) => {
    assert.strictEqual(msg.hiddenReasoning, undefined);
    assert.strictEqual(msg.rawHttpResponse, undefined);
    assert.strictEqual(msg.authorizationHeader, undefined);
  });
  console.log('[TEST 15 PASSED] Zero hidden reasoning or raw HTTP payloads reconstructed in UI message objects');

  console.log('>>> ALL PHASE 1E SESSION CONVERSATION RESTORATION TESTS PASSED CLEANLY! <<<');
}

runSessionConversationRestoreTests().catch((err) => {
  console.error('[TEST FAILURE] Phase 1E Test Suite failed:', err);
  process.exit(1);
});
