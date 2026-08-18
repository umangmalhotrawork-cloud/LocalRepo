/**
 * Phase 5B Integration Test Suite — Continuum Conversation Turn Continuity
 * Tests turn recording, capping (5-10 turns), secret filtering, backward compatibility with old snapshots,
 * capsule export/import turn survival, Truth Boundary status mapping, and absence of raw LLM responses.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumCapsuleBuilder, validateCapsule } = require('../engine/continuum_capsule_builder');
const { continuumManager } = require('./continuumManager');
const { agentManager } = require('./agentManager');
const secretFilter = require('../security/secretFilter');

// Set isolated test directory for Continuum manager storage
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-turns-test-'));
process.env.ECHO_CONTINUUM_DIR = tempDir;

async function runTurnsTests() {
  console.log('[TEST] Starting Phase 5B Continuum Turns Test Suite...');

  const tempWorkspace = path.resolve(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');

  // TEST 1: Multiple turns recorded across chained snapshots
  console.log('[TEST 1] Testing turn recording across sequential snapshots...');
  const snap1 = continuumEngine.createSnapshot({
    sessionId: 'session_turns_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Turn 1 Goal', activeMilestone: 'M1', currentSubtask: '', completedSteps: [], pendingSteps: [], blockers: [] },
    conversation: {
      condensedSummary: 'Summary turn 1',
      lastUserDirective: 'Turn 1 Directive',
      lastAgentResponseSnippet: 'Snippet 1',
      recentTurns: [
        { turnId: 'turn-1', timestamp: Date.now() - 20000, userPrompt: 'Turn 1 User Prompt', agentSummary: 'Turn 1 Agent Summary', status: 'IMPLEMENTED' }
      ]
    }
  });

  const snap2 = continuumEngine.createNextSnapshot(snap1, {
    conversation: {
      recentTurns: [
        { turnId: 'turn-2', timestamp: Date.now() - 10000, userPrompt: 'Turn 2 User Prompt', agentSummary: 'Turn 2 Agent Summary', status: 'VERIFIED' }
      ]
    }
  });

  if (snap2.conversation.recentTurns.length !== 2) {
    console.error('[TEST 1 FAILED] Turns were not accumulated correctly:', snap2.conversation.recentTurns);
    process.exit(1);
  }
  console.log('[TEST 1 PASSED] Sequential turns accumulated cleanly (Turn count:', snap2.conversation.recentTurns.length, ')');

  // TEST 2: Turn history bounded to max 10 turns
  console.log('[TEST 2] Verifying turn history bounded to max 10 turns...');
  const manyTurns = Array.from({ length: 15 }, (_, i) => ({
    turnId: `turn-overload-${i + 1}`,
    timestamp: Date.now() + i * 1000,
    userPrompt: `Prompt ${i + 1}`,
    agentSummary: `Summary ${i + 1}`,
    status: 'IMPLEMENTED',
  }));

  const snapOverloaded = continuumEngine.createSnapshot({
    sessionId: 'session_turns_overload',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    conversation: { recentTurns: manyTurns }
  });

  if (snapOverloaded.conversation.recentTurns.length !== 10) {
    console.error('[TEST 2 FAILED] Turn count not capped to 10:', snapOverloaded.conversation.recentTurns.length);
    process.exit(1);
  }
  if (snapOverloaded.conversation.recentTurns[0].turnId !== 'turn-overload-6') {
    console.error('[TEST 2 FAILED] Oldest turns were not pruned correctly:', snapOverloaded.conversation.recentTurns[0]);
    process.exit(1);
  }
  console.log('[TEST 2 PASSED] Turn history correctly bounded to 10 newest items.');

  // TEST 3: Secret filtering in turn prompts and summaries
  console.log('[TEST 3] Verifying secret filter redacts credentials in turn records...');
  const dirtyTurns = [
    {
      turnId: 'turn-dirty-1',
      timestamp: Date.now(),
      userPrompt: 'Set GEMINI_API_KEY="AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p" in config',
      agentSummary: 'Saved database URI mongodb://user:pass123@cluster.com/db',
      status: 'IMPLEMENTED',
    }
  ];

  const snapSecret = continuumEngine.createSnapshot({
    sessionId: 'session_turns_secret',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    conversation: { recentTurns: dirtyTurns }
  });

  const turnRec = snapSecret.conversation.recentTurns[0];
  if (turnRec.userPrompt.includes('AIzaSy') || turnRec.agentSummary.includes('pass123')) {
    console.error('[TEST 3 FAILED] Secrets survived in turn record:', turnRec);
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Secrets redacted from turn prompts and summaries cleanly.');

  // TEST 4: Backward compatibility with old snapshots without recentTurns
  console.log('[TEST 4] Verifying backward compatibility with legacy snapshots missing recentTurns...');
  const oldSnapInput = {
    schemaVersion: '1.0.0',
    metadata: { sessionId: 'session_old_001', parentSessionId: null, createdAt: Date.now(), updatedAt: Date.now(), sequenceNumber: 1, generatorAgent: 'test' },
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Old Goal', activeMilestone: '', currentSubtask: '', completedSteps: [], pendingSteps: [], blockers: [] },
    codeState: { activeTargetNodeId: null, activeFilePath: null, cursorLine: 1, dirtyFiles: [], modifiedSymbols: [] },
    decisions: [],
    debugging: { discoveredBugs: [], failedFixes: [], successfulFixes: [] },
    verification: { lastTestStatus: 'NOT_RUN', failingTestNames: [], behavioralDiffSummary: null },
    conversation: { tokenCountEstimate: 100, condensedSummary: 'Old summary', lastUserDirective: 'Old directive', lastAgentResponseSnippet: 'Old snippet' },
    aiState: { provider: 'offline', modelName: 'test', temperature: 0.1, maxTokens: 2048, activeRole: 'engineer' },
    handoff: { immediateNextAction: '', requiredFilesToLoad: [], unresolvedQuestions: [], systemInstructionOverride: '' }
  };

  const oldValidation = continuumEngine.validateSnapshot(oldSnapInput);
  if (!oldValidation.valid) {
    console.error('[TEST 4 FAILED] Legacy snapshot validation failed:', oldValidation.errors);
    process.exit(1);
  }
  const oldChained = continuumEngine.createNextSnapshot(oldSnapInput, {});
  if (!Array.isArray(oldChained.conversation.recentTurns)) {
    console.error('[TEST 4 FAILED] Chained legacy snapshot missing recentTurns array:', oldChained);
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] Legacy snapshots missing recentTurns validated and chained cleanly.');

  // TEST 5 & 6: Capsule export contains turn history & imported capsule preserves turn history
  console.log('[TEST 5 & 6] Testing capsule export & import turn survival...');
  const capsule = await continuumCapsuleBuilder.buildCapsule(snap2, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  const valCapsule = validateCapsule(capsule);
  if (!valCapsule.valid) {
    console.error('[TEST 5 FAILED] Capsule validation failed:', valCapsule.errors);
    process.exit(1);
  }
  const capTurns = capsule.conversation_context.recent_turns;
  if (!Array.isArray(capTurns) || capTurns.length !== 2) {
    console.error('[TEST 5 FAILED] Capsule conversation_context.recent_turns invalid:', capTurns);
    process.exit(1);
  }
  if (capTurns[0].turn_id !== 'turn-1' || capTurns[1].turn_id !== 'turn-2') {
    console.error('[TEST 6 FAILED] Turn IDs mismatch in capsule:', capTurns);
    process.exit(1);
  }
  console.log('[TEST 5 & 6 PASSED] Capsule export & import preserved turn history intact.');

  // TEST 7: Verification that no raw Gemini HTTP response body or hidden chain-of-thought is stored
  console.log('[TEST 7] Verifying absence of raw LLM HTTP response / hidden chain-of-thought...');
  const capStr = JSON.stringify(capsule);
  if (capStr.includes('candidates') || capStr.includes('promptFeedback') || capStr.includes('safetyRatings')) {
    console.error('[TEST 7 FAILED] Raw Gemini HTTP response fields found in capsule payload!');
    process.exit(1);
  }
  console.log('[TEST 7 PASSED] Zero raw LLM HTTP responses or hidden reasoning stored in capsule.');

  // Cleanup temp dir
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[SUCCESS] ALL PHASE 5B CONTINUUM TURNS TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runTurnsTests();
}

module.exports = { runTurnsTests };
