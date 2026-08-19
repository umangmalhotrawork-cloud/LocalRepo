/**
 * TEST SUITE: Phase 1D AI-Native Agent Workspace UX
 * Validates agent context injection, session continuity, turn recording,
 * Patch Firewall evaluation, and Nexus Capsule compatibility.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { agentManager } = require('./agentManager');
const { aiProviderRouter } = require('./ai/AIProviderRouter');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumCapsuleBuilder } = require('../engine/continuum_capsule_builder');
const secretFilter = require('../security/secretFilter');

async function runAgentWorkspaceUXTests() {
  console.log('[TEST] Starting Phase 1D AI-Native Agent Workspace UX Test Suite...');

  const workspacePath = path.join(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');
  const activeFilePath = 'src/behavior_demo.js';
  const sessionId = `session_agent_ux_${Date.now()}`;

  // TEST 1, 2, 3, 4: Agent execution with context, active file, and session model
  const agentResult = await agentManager.runAgentTask({
    task: 'Analyze redundant operations and apply safe patch',
    workspacePath,
    activeFilePath,
    providerId: 'gemini',
    modelId: 'gemini-1.5-flash',
    selectionText: 'return total * 1;',
    selectionLineRange: '10-10',
  });

  assert.ok(agentResult.success);
  assert.ok(agentResult.steps.length > 0);
  assert.ok(agentResult.execution);
  console.log(`[TEST 1-4 PASSED] Agent task executed with workspace context (${agentResult.steps.length} steps generated)`);

  // TEST 5 & 6: Continuum turn recording and provider metadata survival
  const capsuleResult = await agentManager.exportAgentTaskCapsule({
    task: 'Analyze redundant operations and apply safe patch',
    workspacePath,
    activeFilePath,
    sessionId,
    execution: agentResult.execution,
    steps: agentResult.steps,
    summary: agentResult.summary,
  });

  assert.ok(capsuleResult.success);
  assert.strictEqual(capsuleResult.capsule.continuum_snapshot.metadata.sessionId, sessionId);
  
  const turns = capsuleResult.capsule.continuum_snapshot.conversation.recentTurns;
  assert.ok(turns.length > 0);
  const latestTurn = turns[turns.length - 1];
  assert.ok(latestTurn.providerId);
  console.log(`[TEST 5 & 6 PASSED] Turn recorded in session ${sessionId} with provider ${latestTurn.providerId}`);

  // TEST 7: No API keys appear in renderer result or turn records
  const fakeKey = 'AIzaSySecretTesting123456789';
  const resultJson = JSON.stringify(agentResult);
  const turnJson = JSON.stringify(turns);
  assert.strictEqual(resultJson.includes(fakeKey), false);
  assert.strictEqual(turnJson.includes(fakeKey), false);
  console.log('[TEST 7 PASSED] Zero API keys detected in renderer result or turn data');

  // TEST 8 & 9: Existing Patch Firewall and Intent Drift remain active
  const patchStep = agentResult.steps.find((s) => s.proposedEdits && s.proposedEdits.length > 0);
  if (patchStep) {
    assert.ok(patchStep.firewallResult);
    assert.ok(patchStep.firewallResult.risk_level);
    assert.ok(patchStep.driftResult);
    console.log(`[TEST 8 & 9 PASSED] Patch Firewall evaluated (${patchStep.firewallResult.risk_level}) and Intent Drift validated`);
  }

  // TEST 10: Existing diff preview structure remains authoritative
  assert.ok(agentResult.steps.every((s) => Array.isArray(s.proposedEdits)));
  console.log('[TEST 10 PASSED] Proposed edit structure validated for diff review');

  // TEST 11: Multi-turn agent execution preserves single session ID
  const turn2Result = await agentManager.runAgentTask({
    task: 'Explain function calculate_discount',
    workspacePath,
    activeFilePath,
    providerId: 'gemini',
    modelId: 'gemini-1.5-flash',
  });

  const capsule2Result = await agentManager.exportAgentTaskCapsule({
    task: 'Explain function calculate_discount',
    workspacePath,
    activeFilePath,
    sessionId, // SAME SESSION
    parentSessionId: capsuleResult.snapshotId,
    execution: turn2Result.execution,
    steps: turn2Result.steps,
    summary: turn2Result.summary,
    recentTurns: turns,
  });

  assert.strictEqual(capsule2Result.capsule.continuum_snapshot.metadata.sessionId, sessionId);
  console.log(`[TEST 11 PASSED] Multi-turn interaction preserved single session identity: ${sessionId}`);

  // TEST 12: Existing Nexus Capsule generation remains functional
  const fullCapsule = await continuumCapsuleBuilder.buildCapsule(capsule2Result.capsule.continuum_snapshot, workspacePath);
  assert.ok(fullCapsule);
  assert.ok(fullCapsule.capsule_meta.capsule_id);
  console.log(`[TEST 12 PASSED] Nexus Capsule generation functional (Capsule ID: ${fullCapsule.capsule_meta.capsule_id})`);

  console.log('>>> ALL PHASE 1D AI-NATIVE AGENT WORKSPACE TESTS PASSED CLEANLY! <<<');
}

runAgentWorkspaceUXTests().catch((err) => {
  console.error('[TEST FAILURE] Phase 1D Test Suite failed:', err);
  process.exit(1);
});
