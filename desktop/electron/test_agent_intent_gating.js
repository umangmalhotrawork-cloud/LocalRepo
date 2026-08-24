/**
 * NEXUS AGENT INTENT GATING TEST SUITE
 * 
 * Verifies that simple conversational greetings (e.g. "hi", "hello!", "thanks")
 * return immediate conversational responses without:
 * - workspace/file inspection
 * - directory scanning
 * - tool execution
 * - AI provider / model quota consumption
 * - Git mutations
 * 
 * And verifies that actionable code tasks (e.g. "hi, inspect cart_calculator.py",
 * "find redundant code", "fix the type errors", "analyze architecture")
 * properly enter the coding pipeline.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  requestRouter,
  RequestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
  isGreeting,
  getConversationalGreetingResponse,
} = require('./harness/RequestRouter');

const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { AgentLoop } = require('./harness/AgentLoop');
const { agentManager, classifyTaskIntent } = require('./agentManager');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING NEXUS AGENT INTENT GATING REGRESSION SUITE');
  console.log('====================================================\n');

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-intent-test-'));
  const testWorkspace = path.join(testDir, 'workspace');
  fs.mkdirSync(testWorkspace, { recursive: true });
  fs.writeFileSync(path.join(testWorkspace, 'secret_file.txt'), 'SUPER_SECRET_CONTENT');
  fs.writeFileSync(path.join(testWorkspace, 'app.py'), 'def main(): pass');

  try {
    // ----------------------------------------------------
    // TEST 1: Greeting Classification
    // ----------------------------------------------------
    console.log('[TEST 1] Testing Greeting Classification Heuristics...');
    const greetings = [
      'hi',
      'hi!',
      'hello',
      'hello!',
      'hey',
      'thanks',
      'thank you',
      'good morning',
      'good evening',
      'good night',
      'okay',
      'cool',
      'yes',
      'no',
      'how are you',
      "what's up",
    ];

    for (const g of greetings) {
      assert.strictEqual(isGreeting(g), true, `"${g}" must be identified as greeting`);
      const route = requestRouter.classify(g);
      assert.strictEqual(route.mode, ROUTER_MODES.CONVERSATION, `"${g}" must be classified as CONVERSATION`);
      assert.strictEqual(route.requiresWorkspace, false, `"${g}" must NOT require workspace`);
    }
    console.log('  ✓ All 16 conversational greetings verified without workspace requirements.\n');

    // ----------------------------------------------------
    // TEST 2: Actionable Code Task Classification
    // ----------------------------------------------------
    console.log('[TEST 2] Testing Actionable Code Task Classification...');
    const codeTasks = [
      { text: 'hi, inspect cart_calculator.py', expectedIntent: CODING_INTENTS.READ_ONLY },
      { text: 'find redundant code', expectedIntent: CODING_INTENTS.READ_ONLY },
      { text: 'fix the type errors', expectedIntent: CODING_INTENTS.MUTATION },
      { text: 'analyze architecture', expectedIntent: CODING_INTENTS.READ_ONLY },
      { text: 'review this function', expectedIntent: CODING_INTENTS.READ_ONLY },
      { text: 'modify X', expectedIntent: CODING_INTENTS.MUTATION },
      { text: 'add feature Y', expectedIntent: CODING_INTENTS.MUTATION },
      { text: 'run tests', expectedIntent: CODING_INTENTS.READ_ONLY },
      { text: 'refactor this code', expectedIntent: CODING_INTENTS.MUTATION },
    ];

    for (const task of codeTasks) {
      assert.strictEqual(isGreeting(task.text), false, `"${task.text}" must NOT be classified as simple greeting`);
      const route = requestRouter.classify(task.text);
      assert.strictEqual(route.mode, ROUTER_MODES.CODING_TASK, `"${task.text}" must be classified as CODING_TASK`);
      assert.strictEqual(route.requiresWorkspace, true, `"${task.text}" must require workspace`);
    }
    console.log('  ✓ All 9 code tasks verified as CODING_TASK with workspace requirements.\n');

    // ----------------------------------------------------
    // TEST 3: End-to-End AgentLoop with "hi" — Zero Workspace Inspection
    // ----------------------------------------------------
    console.log('[TEST 3] Running AgentLoop with "hi"...');
    let toolExecutionCount = 0;
    let modelCallCount = 0;

    const runtime = new HarnessRuntime({
      storageDir: path.join(testDir, 'harness_storage'),
    });

    const thread = runtime.createThread({
      userInput: 'hi',
      workspacePath: testWorkspace,
    });

    const outcomeHi = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'hi',
      workspacePath: testWorkspace,
      modelHandler: async () => {
        modelCallCount++;
        return 'Mock model response';
      },
    });

    assert.strictEqual(outcomeHi.success, true, 'Turn must succeed');
    assert.strictEqual(modelCallCount, 0, 'Must NOT invoke modelHandler / AI API for simple greeting "hi"');
    assert.strictEqual(outcomeHi.iterations, 0, 'Iterations must be 0 (bypassed loop)');
    assert.ok(outcomeHi.finalResponse.includes('Hello'), 'Must return conversational response');
    assert.ok(!outcomeHi.finalResponse.includes('secret_file.txt'), 'Must NOT reveal workspace files');
    assert.ok(!outcomeHi.finalResponse.includes('app.py'), 'Must NOT reveal app.py');
    console.log(`  ✓ "hi" produced response: "${outcomeHi.finalResponse}" with 0 model calls and 0 tool calls.\n`);

    // ----------------------------------------------------
    // TEST 4: End-to-End AgentLoop with "hello!" and "thanks"
    // ----------------------------------------------------
    console.log('[TEST 4] Running AgentLoop with "hello!" and "thanks"...');
    const outcomeHello = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'hello!',
      workspacePath: testWorkspace,
      modelHandler: async () => {
        modelCallCount++;
      },
    });
    assert.strictEqual(outcomeHello.success, true);
    assert.strictEqual(modelCallCount, 0, 'Zero model calls for "hello!"');
    assert.ok(outcomeHello.finalResponse.includes('Hello'));

    const outcomeThanks = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'thanks',
      workspacePath: testWorkspace,
      modelHandler: async () => {
        modelCallCount++;
      },
    });
    assert.strictEqual(outcomeThanks.success, true);
    assert.strictEqual(modelCallCount, 0, 'Zero model calls for "thanks"');
    assert.ok(outcomeThanks.finalResponse.includes("welcome") || outcomeThanks.finalResponse.includes("help"));
    console.log(`  ✓ "thanks" produced response: "${outcomeThanks.finalResponse}" with 0 model calls.\n`);

    // ----------------------------------------------------
    // TEST 5: Code Task "hi, inspect cart_calculator.py" enters coding pipeline
    // ----------------------------------------------------
    console.log('[TEST 5] Running AgentLoop with "hi, inspect cart_calculator.py"...');
    let codeTaskModelCalled = false;
    const outcomeCode = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'hi, inspect cart_calculator.py',
      workspacePath: testWorkspace,
      modelHandler: async () => {
        codeTaskModelCalled = true;
        return 'Inspected cart_calculator.py logic.';
      },
    });

    assert.strictEqual(codeTaskModelCalled, true, 'Model handler MUST be called for coding task');
    assert.strictEqual(outcomeCode.success, true);
    console.log('  ✓ "hi, inspect cart_calculator.py" properly invoked coding pipeline.\n');

    // ----------------------------------------------------
    // TEST 6: agentManager deterministic agent handles greetings with zero file scans
    // ----------------------------------------------------
    console.log('[TEST 6] Testing agentManager.runDeterministicAgent on greetings...');
    const agentRes = await agentManager.runDeterministicAgent('hi', testWorkspace, 5, '', null);
    assert.strictEqual(agentRes.taskIntent, 'GENERAL_CHAT');
    assert.strictEqual(agentRes.steps.length, 0, 'Steps must be empty for greeting');
    assert.strictEqual(agentRes.targetFile, null, 'Target file must be null');
    assert.ok(agentRes.summary.includes('Hello'));
    assert.ok(!agentRes.summary.includes('secret_file.txt'));
    console.log('  ✓ agentManager returned greeting with 0 steps and 0 target file.\n');

    console.log('====================================================');
    console.log('ALL AGENT INTENT GATING TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
