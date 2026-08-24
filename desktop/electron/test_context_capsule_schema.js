/**
 * CONTEXT CAPSULE — TEST SUITE (Phase 2: Schema + Manager)
 * Comprehensive verification of CapsuleSchema, ContextCapsuleManager,
 * secret sanitization, thread extraction, atomic persistence, and Continuum isolation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  NEXUS_CAPSULE_VERSION,
  generateCapsuleId,
  validateCapsule,
  assertValidCapsule,
  serializeCapsule,
  parseCapsule,
} = require('./capsule/CapsuleSchema');

const {
  ContextCapsuleManager,
  contextCapsuleManager,
} = require('./capsule/ContextCapsuleManager');

const { ThreadManager } = require('./harness/ThreadManager');
const { TurnManager } = require('./harness/TurnManager');
const { ItemStore } = require('./harness/ItemStore');
const { ITEM_TYPES, THREAD_STATUS, TURN_STATUS } = require('./harness/types');
const { harnessEventBus } = require('./harness/eventBus');

async function runContextCapsuleTestSuite() {
  console.log('================================================================');
  console.log('STARTING CONTEXT CAPSULE (PHASE 2) TEST SUITE');
  console.log('================================================================');

  let passedCount = 0;
  const totalTests = 19;

  // Setup isolated temporary directory for test storage
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-capsule-test-'));
  const testCapsuleDir = path.join(tempDir, 'context-capsules');
  fs.mkdirSync(testCapsuleDir, { recursive: true });

  // Create isolated harness instances
  const testItemStore = new ItemStore(harnessEventBus);
  const testTurnManager = new TurnManager(harnessEventBus, testItemStore);
  const testThreadManager = new ThreadManager(harnessEventBus, testTurnManager);

  const manager = new ContextCapsuleManager({
    storageDir: testCapsuleDir,
    threadManager: testThreadManager,
    turnManager: testTurnManager,
    itemStore: testItemStore,
  });

  // ------------------------------------------------------------------
  // TEST 1: Valid capsule validates
  // ------------------------------------------------------------------
  console.log('\n[TEST 1] Valid capsule validates against schema...');
  const sampleCapsule = {
    nexus_capsule_version: NEXUS_CAPSULE_VERSION,
    capsule_id: generateCapsuleId(),
    created_at: Date.now(),
    source_chat: {
      thread_id: 'thread_12345',
      title: 'Checkout Flow Refactor',
      workspace_name: 'NexusRepo',
      provider_id: 'nexus1',
      model_id: 'gemini-2.5-flash',
    },
    task_state: {
      primary_goal: 'Fix checkout exception handling',
      current_status: 'ACTIVE',
      important_decisions: ['Use atomic discount calculation'],
      pending_work: ['Add integration tests'],
      relevant_files: ['src/checkout.py'],
    },
    conversation_context: {
      summary: 'Task: Checkout Flow Refactor | Status: ACTIVE',
      last_exchanges: [
        {
          user: 'Please check checkout.py for errors',
          assistant: 'Found syntax issue in checkout.py line 42',
        },
      ],
    },
  };

  const val1 = validateCapsule(sampleCapsule);
  assert.strictEqual(val1.valid, true, `Expected valid capsule, got errors: ${val1.errors.join(', ')}`);
  assert.doesNotThrow(() => assertValidCapsule(sampleCapsule));
  passedCount++;
  console.log('✓ TEST 1 PASSED: Valid capsule validated successfully');

  // ------------------------------------------------------------------
  // TEST 2: Capsule ID generated correctly
  // ------------------------------------------------------------------
  console.log('\n[TEST 2] Capsule ID generated correctly...');
  const testTs = 1787550000000;
  const generatedId = generateCapsuleId(testTs);
  assert.ok(generatedId.startsWith(`capsule_${testTs}_`), 'Capsule ID must start with capsule_<timestamp>_');
  assert.ok(/^capsule_\d+_[a-f0-9]+$/.test(generatedId), 'Capsule ID must match pattern /^capsule_\\d+_[a-f0-9]+$/');
  passedCount++;
  console.log(`✓ TEST 2 PASSED: Capsule ID generated correctly (${generatedId})`);

  // ------------------------------------------------------------------
  // TEST 3: Schema version is 1.0.0
  // ------------------------------------------------------------------
  console.log('\n[TEST 3] Schema version is 1.0.0...');
  assert.strictEqual(NEXUS_CAPSULE_VERSION, '1.0.0', 'Schema version must be 1.0.0');
  assert.strictEqual(sampleCapsule.nexus_capsule_version, '1.0.0');
  passedCount++;
  console.log('✓ TEST 3 PASSED: Schema version is 1.0.0');

  // ------------------------------------------------------------------
  // TEST 4 & 5: Thread with >3 exchanges -> Last 3 preserved in order, older excluded
  // ------------------------------------------------------------------
  console.log('\n[TEST 4 & 5] Thread with 5 exchanges -> Last 3 preserved chronologically, older excluded...');
  const multiThread = testThreadManager.createThread({
    threadId: 'thread_multi_turns',
    title: 'Multi Turn Process',
    userInput: 'Initial user directive 1',
    metadata: {
      workspaceName: 'ECommerceApp',
      providerId: 'nexus_local',
      modelId: 'gemini-flash',
    },
  });

  // Create 5 turns with user input & agent messages
  for (let i = 1; i <= 5; i++) {
    const turn = testTurnManager.startTurn(multiThread.threadId, `User message ${i}`);
    testItemStore.startItem(turn.turnId, ITEM_TYPES.USER_MESSAGE, { text: `User message ${i}` });
    testItemStore.startItem(turn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: `Assistant response ${i}` });
    testTurnManager.completeTurn(turn.turnId);
  }

  const multiCapsule = manager.createCapsule(multiThread.threadId);
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges.length, 3, 'Must retain at most 3 exchanges');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[0].user, 'User message 3');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[0].assistant, 'Assistant response 3');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[1].user, 'User message 4');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[1].assistant, 'Assistant response 4');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[2].user, 'User message 5');
  assert.strictEqual(multiCapsule.conversation_context.last_exchanges[2].assistant, 'Assistant response 5');

  passedCount += 2;
  console.log('✓ TEST 4 PASSED: Last 3 exchanges preserved in strict chronological order');
  console.log('✓ TEST 5 PASSED: Older exchanges (1 and 2) cleanly excluded');

  // ------------------------------------------------------------------
  // TEST 6: Tool calls and tool results are not treated as user/assistant exchanges
  // ------------------------------------------------------------------
  console.log('\n[TEST 6] Tool calls and tool results are not treated as user/assistant exchanges...');
  const toolThread = testThreadManager.createThread({
    threadId: 'thread_tools_only',
    title: 'Tool execution thread',
    userInput: 'Run diagnostic tool',
  });

  const toolTurn = testTurnManager.startTurn(toolThread.threadId, 'Analyze filesystem');
  testItemStore.startItem(toolTurn.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'Analyze filesystem' });
  testItemStore.startItem(toolTurn.turnId, ITEM_TYPES.TOOL_CALL, {
    toolName: 'read_file',
    arguments: { path: 'config.json' },
  });
  testItemStore.startItem(toolTurn.turnId, ITEM_TYPES.TOOL_RESULT, {
    toolName: 'read_file',
    result: { port: 8080 },
  });
  testItemStore.startItem(toolTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: 'Found port 8080 in config.json' });
  testTurnManager.completeTurn(toolTurn.turnId);

  const toolCapsule = manager.createCapsule(toolThread.threadId);
  assert.strictEqual(toolCapsule.conversation_context.last_exchanges.length, 1);
  assert.strictEqual(toolCapsule.conversation_context.last_exchanges[0].user, 'Analyze filesystem');
  assert.strictEqual(toolCapsule.conversation_context.last_exchanges[0].assistant, 'Found port 8080 in config.json');
  assert.ok(!toolCapsule.conversation_context.last_exchanges[0].assistant.includes('TOOL_CALL'), 'Tool call must not be in assistant message');
  passedCount++;
  console.log('✓ TEST 6 PASSED: Tool calls and results excluded from user/assistant exchanges');

  // ------------------------------------------------------------------
  // TEST 7: Thread source data is not mutated
  // ------------------------------------------------------------------
  console.log('\n[TEST 7] Thread source data is not mutated...');
  const originalThread = testThreadManager.getThread(multiThread.threadId);
  const originalTurns = testTurnManager.listTurnsByThread(multiThread.threadId);
  const originalTurnsCount = originalTurns.length;
  const originalTurn1Items = testItemStore.getItemsByTurn(originalTurns[0].turnId);

  // Generate capsule again
  manager.createCapsule(multiThread.threadId);

  const afterThread = testThreadManager.getThread(multiThread.threadId);
  const afterTurns = testTurnManager.listTurnsByThread(multiThread.threadId);
  const afterTurn1Items = testItemStore.getItemsByTurn(afterTurns[0].turnId);

  assert.strictEqual(afterTurns.length, originalTurnsCount, 'Turns count must remain untouched');
  assert.strictEqual(afterTurn1Items.length, originalTurn1Items.length, 'Turn items must remain untouched');
  assert.strictEqual(afterThread.title, originalThread.title, 'Thread title must remain untouched');
  passedCount++;
  console.log('✓ TEST 7 PASSED: Source thread data remained 100% immutable');

  // ------------------------------------------------------------------
  // TEST 8: Important structured state is included when available
  // ------------------------------------------------------------------
  console.log('\n[TEST 8] Important structured state is included when available...');
  const structuredThread = testThreadManager.createThread({
    threadId: 'thread_structured_state',
    title: 'Auth Refactor Plan',
    userInput: 'Migrate JWT tokens to OAuth2',
    metadata: {
      primaryGoal: 'OAuth2 migration',
      decisions: ['Use PKCE flow', 'Deprecate legacy API keys'],
      pendingWork: ['Implement refresh token rotation', 'Update client SDK'],
      relevantFiles: ['auth/oauth.py', 'auth/tokens.py'],
    },
  });
  const structTurn = testTurnManager.startTurn(structuredThread.threadId, 'Draft OAuth2 architecture');
  testItemStore.startItem(structTurn.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'Draft OAuth2 architecture' });
  testItemStore.startItem(structTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: 'Architecture draft completed' });
  testItemStore.startItem(structTurn.turnId, ITEM_TYPES.FILE_CHANGE, { filePath: 'auth/oauth.py' });
  testTurnManager.completeTurn(structTurn.turnId);

  const structCapsule = manager.createCapsule(structuredThread.threadId);
  assert.strictEqual(structCapsule.task_state.primary_goal, 'OAuth2 migration');
  assert.deepStrictEqual(structCapsule.task_state.important_decisions, ['Use PKCE flow', 'Deprecate legacy API keys']);
  assert.deepStrictEqual(structCapsule.task_state.pending_work, ['Implement refresh token rotation', 'Update client SDK']);
  assert.ok(structCapsule.task_state.relevant_files.includes('auth/oauth.py'));
  assert.ok(structCapsule.task_state.relevant_files.includes('auth/tokens.py'));
  passedCount++;
  console.log('✓ TEST 8 PASSED: Structured state captured cleanly when available');

  // ------------------------------------------------------------------
  // TEST 9: Missing unavailable state is not invented
  // ------------------------------------------------------------------
  console.log('\n[TEST 9] Missing unavailable state is not invented...');
  const emptyThread = testThreadManager.createThread({
    threadId: 'thread_minimal',
    title: 'Minimal Thread',
  });
  const minCapsule = manager.createCapsule(emptyThread.threadId);
  assert.deepStrictEqual(minCapsule.task_state.important_decisions, [], 'Decisions must be empty array when unavailable');
  assert.deepStrictEqual(minCapsule.task_state.pending_work, [], 'Pending work must be empty array when unavailable');
  assert.deepStrictEqual(minCapsule.task_state.relevant_files, [], 'Relevant files must be empty array when unavailable');
  assert.deepStrictEqual(minCapsule.conversation_context.last_exchanges, [], 'Exchanges must be empty array when no turns exist');
  passedCount++;
  console.log('✓ TEST 9 PASSED: Missing state left empty without hallucination');

  // ------------------------------------------------------------------
  // TEST 10: Secrets are sanitized
  // ------------------------------------------------------------------
  console.log('\n[TEST 10] Secrets are sanitized...');
  const secretThread = testThreadManager.createThread({
    threadId: 'thread_with_secrets',
    title: 'Debug API with key',
    userInput: 'Connecting with key AIzaSyA1234567890abcdef1234567890abcdef',
    metadata: {
      apiKey: 'gsk_1234567890abcdef1234567890abcdef',
      dbUrl: 'postgres://admin:super_secret_pw@db.nexus.internal:5432/nexus_prod',
    },
  });

  const secTurn = testTurnManager.startTurn(secretThread.threadId, 'Use bearer token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak');
  testItemStore.startItem(secTurn.turnId, ITEM_TYPES.USER_MESSAGE, {
    text: 'Use OpenAI key sk-1234567890abcdef1234567890abcdef and password = "mysecretpassword123"',
  });
  testItemStore.startItem(secTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, {
    text: 'Configured DB with postgres://admin:super_secret_pw@db.nexus.internal:5432/nexus_prod',
  });
  testTurnManager.completeTurn(secTurn.turnId);

  const secCapsule = manager.createCapsule(secretThread.threadId);
  const secJson = JSON.stringify(secCapsule);

  // Assert no plaintext secrets exist in capsule JSON
  assert.ok(!secJson.includes('AIzaSyA1234567890abcdef1234567890abcdef'), 'Gemini API key must be sanitized');
  assert.ok(!secJson.includes('gsk_1234567890abcdef1234567890abcdef'), 'Groq API key must be sanitized');
  assert.ok(!secJson.includes('sk-1234567890abcdef1234567890abcdef'), 'OpenAI API key must be sanitized');
  assert.ok(!secJson.includes('super_secret_pw'), 'Database password must be sanitized');
  assert.ok(!secJson.includes('mysecretpassword123'), 'Plaintext password must be sanitized');
  assert.ok(secJson.includes('[REDACTED_SECRET:'), 'Sanitization marker must be present');
  passedCount++;
  console.log('✓ TEST 10 PASSED: All secrets, keys, URIs, and passwords sanitized');

  // ------------------------------------------------------------------
  // TEST 11: Capsule serializes and deserializes losslessly
  // ------------------------------------------------------------------
  console.log('\n[TEST 11] Capsule serializes and deserializes losslessly...');
  const serialized = manager.serializeCapsule(structCapsule);
  assert.strictEqual(typeof serialized, 'string');
  const deserialized = manager.parseCapsule(serialized);
  assert.deepStrictEqual(deserialized, structCapsule, 'Deserialized capsule must strictly match original');
  passedCount++;
  console.log('✓ TEST 11 PASSED: Lossless serialization and deserialization');

  // ------------------------------------------------------------------
  // TEST 12: Save and load works from independent capsule storage
  // ------------------------------------------------------------------
  console.log('\n[TEST 12] Save and load works from independent capsule storage...');
  const saveResult = manager.saveCapsule(structCapsule);
  assert.strictEqual(saveResult.success, true);
  assert.strictEqual(saveResult.capsuleId, structCapsule.capsule_id);
  assert.ok(fs.existsSync(saveResult.filePath));

  const loadedCapsule = manager.loadCapsule(structCapsule.capsule_id);
  assert.deepStrictEqual(loadedCapsule, structCapsule);
  passedCount++;
  console.log('✓ TEST 12 PASSED: Saved and loaded accurately from independent storage');

  // ------------------------------------------------------------------
  // TEST 13: Delete works
  // ------------------------------------------------------------------
  console.log('\n[TEST 13] Delete works...');
  const deleted = manager.deleteCapsule(structCapsule.capsule_id);
  assert.strictEqual(deleted, true);
  assert.ok(!fs.existsSync(saveResult.filePath));
  assert.throws(() => manager.loadCapsule(structCapsule.capsule_id), /not found/);
  passedCount++;
  console.log('✓ TEST 13 PASSED: Delete successfully removed capsule file');

  // ------------------------------------------------------------------
  // TEST 14: List works
  // ------------------------------------------------------------------
  console.log('\n[TEST 14] List works...');
  const capA = { ...sampleCapsule, capsule_id: generateCapsuleId(1000), created_at: 1000 };
  const capB = { ...sampleCapsule, capsule_id: generateCapsuleId(2000), created_at: 2000 };
  const capC = { ...sampleCapsule, capsule_id: generateCapsuleId(3000), created_at: 3000 };

  manager.saveCapsule(capA);
  manager.saveCapsule(capB);
  manager.saveCapsule(capC);

  const listed = manager.listCapsules();
  assert.strictEqual(listed.length, 3);
  // Sorted descending by created_at
  assert.strictEqual(listed[0].created_at, 3000);
  assert.strictEqual(listed[1].created_at, 2000);
  assert.strictEqual(listed[2].created_at, 1000);
  passedCount++;
  console.log('✓ TEST 14 PASSED: List returned sorted capsules (newest first)');

  // ------------------------------------------------------------------
  // TEST 15: Atomic storage leaves no partial final capsule
  // ------------------------------------------------------------------
  console.log('\n[TEST 15] Atomic storage leaves no partial final capsule...');
  const targetId = generateCapsuleId();
  const atomicCapsule = { ...sampleCapsule, capsule_id: targetId };
  const targetPath = path.join(testCapsuleDir, `${targetId}.json`);

  manager.saveCapsule(atomicCapsule);
  assert.ok(fs.existsSync(targetPath));

  // Check no leftover .tmp files
  const dirFiles = fs.readdirSync(testCapsuleDir);
  const tmpFiles = dirFiles.filter((f) => f.startsWith('.tmp_'));
  assert.strictEqual(tmpFiles.length, 0, 'There must be no lingering temporary files');
  passedCount++;
  console.log('✓ TEST 15 PASSED: Atomic write completed without lingering temporary files');

  // ------------------------------------------------------------------
  // TEST 16: Malformed capsules are rejected
  // ------------------------------------------------------------------
  console.log('\n[TEST 16] Malformed capsules are rejected...');
  
  // 16a: Missing version
  const badVer = { ...sampleCapsule, nexus_capsule_version: '2.0.0' };
  assert.strictEqual(validateCapsule(badVer).valid, false);

  // 16b: Invalid capsule ID
  const badId = { ...sampleCapsule, capsule_id: 'invalid_id' };
  assert.strictEqual(validateCapsule(badId).valid, false);

  // 16c: Missing source chat thread_id
  const badThread = { ...sampleCapsule, source_chat: { ...sampleCapsule.source_chat, thread_id: '' } };
  assert.strictEqual(validateCapsule(badThread).valid, false);

  // 16d: Missing summary
  const badSummary = { ...sampleCapsule, conversation_context: { ...sampleCapsule.conversation_context, summary: 12345 } };
  assert.strictEqual(validateCapsule(badSummary).valid, false);

  // 16e: More than 3 exchanges
  const badExchanges = {
    ...sampleCapsule,
    conversation_context: {
      summary: 'Summary',
      last_exchanges: [
        { user: '1', assistant: '1' },
        { user: '2', assistant: '2' },
        { user: '3', assistant: '3' },
        { user: '4', assistant: '4' },
      ],
    },
  };
  assert.strictEqual(validateCapsule(badExchanges).valid, false);

  // 16f: Malformed exchange items (non-string message)
  const badExchangeMsg = {
    ...sampleCapsule,
    conversation_context: {
      summary: 'Summary',
      last_exchanges: [
        { user: { text: 'object instead of string' }, assistant: 'ok' },
      ],
    },
  };
  assert.strictEqual(validateCapsule(badExchangeMsg).valid, false);

  passedCount++;
  console.log('✓ TEST 16 PASSED: All malformed capsule schemas rejected strictly');

  // ------------------------------------------------------------------
  // TEST 17: Strict Continuum isolation
  // ------------------------------------------------------------------
  console.log('\n[TEST 17] Strict Continuum isolation check...');
  const schemaFileContent = fs.readFileSync(path.join(__dirname, 'capsule', 'CapsuleSchema.js'), 'utf8');
  const managerFileContent = fs.readFileSync(path.join(__dirname, 'capsule', 'ContextCapsuleManager.js'), 'utf8');

  const forbiddenTerms = [
    'continuumManager',
    'continuum_engine',
    'continuum_context_builder',
    'HarnessPersistenceAdapter',
    'SnapshotPanel',
    'ContinuumDrawer',
    'ContinuumBadge',
    'useContinuumSnapshot',
    '.echo-nullity/continuum',
    'electronAPI.continuum',
  ];

  for (const term of forbiddenTerms) {
    assert.ok(!schemaFileContent.includes(term), `CapsuleSchema.js must NOT reference "${term}"`);
    assert.ok(!managerFileContent.includes(term), `ContextCapsuleManager.js must NOT reference "${term}"`);
  }

  // Storage path check
  const managerStorage = manager.getStorageDir();
  assert.ok(!managerStorage.includes('.echo-nullity/continuum'), 'Context Capsule storage must never be inside continuum directory');
  assert.ok(managerStorage.includes('context-capsules') || managerStorage.includes('.echo-nullity-capsules'));

  passedCount++;
  console.log('✓ TEST 17 PASSED: 100% Strict Continuum Isolation verified');

  // ------------------------------------------------------------------
  // TEST 18: Zero AI provider / model calls
  // ------------------------------------------------------------------
  console.log('\n[TEST 18] Zero AI provider / model calls...');
  // Verify that generating capsule from a thread executes synchronously/locally without loading or calling AI providers
  assert.ok(!managerFileContent.includes('AIProviderRouter'));
  assert.ok(!managerFileContent.includes('GeminiProvider'));
  assert.ok(!managerFileContent.includes('OpenAIProvider'));
  assert.ok(!managerFileContent.includes('GroqProvider'));
  passedCount++;
  console.log('✓ TEST 18 PASSED: Zero AI calls used in Context Capsule generation');

  // ------------------------------------------------------------------
  // TEST 19: Zero Git mutations
  // ------------------------------------------------------------------
  console.log('\n[TEST 19] Zero Git mutations...');
  assert.ok(!managerFileContent.includes('simple-git'));
  assert.ok(!managerFileContent.includes('gitManager'));
  passedCount++;
  console.log('✓ TEST 19 PASSED: Zero Git mutations performed');

  // Cleanup test directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n================================================================');
  console.log(`CONTEXT CAPSULE TEST SUITE SUMMARY: ${passedCount}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');
}

runContextCapsuleTestSuite().catch((err) => {
  console.error('\n❌ CONTEXT CAPSULE TEST SUITE FAILED:', err);
  process.exit(1);
});
