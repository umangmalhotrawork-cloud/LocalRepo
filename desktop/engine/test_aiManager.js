const aiManager = require('../electron/aiManager');

async function runAiTests() {
  console.log('[TEST] Starting AI Code Actions Test Suite...');

  // 1. Test empty selection
  const emptyRes = await aiManager.runCodeAction({
    action: 'explain',
    selection: '',
    language: 'python',
  });
  console.log(`[TEST 1] Empty selection handled: success=${emptyRes.success}, error='${emptyRes.error}'`);
  if (emptyRes.success !== false) throw new Error('Expected success=false on empty selection');

  // 2. Test explain action
  const explainRes = await aiManager.runCodeAction({
    action: 'explain',
    language: 'python',
    filePath: 'cart.py',
    selection: 'total = sum(items)\nreturn total',
    fullFile: 'def calc(items):\n    total = sum(items)\n    return total',
  });
  console.log(`[TEST 2] Explain action: success=${explainRes.success}, response length=${explainRes.response.length}`);
  if (!explainRes.success || !explainRes.response.includes('Code Explanation')) {
    throw new Error('Explain action did not return expected explanation text');
  }

  // 3. Test find_bug action
  const bugRes = await aiManager.runCodeAction({
    action: 'find_bug',
    language: 'python',
    filePath: 'cart.py',
    selection: 'if count > 0:\n    val = items[count]',
  });
  console.log(`[TEST 3] Find bug action: success=${bugRes.success}`);
  if (!bugRes.success || !bugRes.response.includes('Bug & Vulnerability Analysis')) {
    throw new Error('Find bug action failed');
  }

  // 4. Test fix action returns proposedPatch
  const fixRes = await aiManager.runCodeAction({
    action: 'fix',
    language: 'python',
    filePath: 'calculator.py',
    selection: 'total = price * qty',
  });
  console.log(`[TEST 4] Fix action: success=${fixRes.success}, hasProposedPatch=${!!fixRes.proposedPatch}`);
  if (!fixRes.success || !fixRes.proposedPatch || !fixRes.proposedPatch.replacement) {
    throw new Error('Fix action must return a proposedPatch with replacement');
  }

  // 5. Test refactor action returns proposedPatch
  const refactorRes = await aiManager.runCodeAction({
    action: 'refactor',
    language: 'python',
    filePath: 'calculator.py',
    selection: 'def compute(a, b):\n    return a + b',
  });
  console.log(`[TEST 5] Refactor action: success=${refactorRes.success}, hasProposedPatch=${!!refactorRes.proposedPatch}`);
  if (!refactorRes.success || !refactorRes.proposedPatch) {
    throw new Error('Refactor action must return proposedPatch');
  }

  // 6. Test tests action
  const testsRes = await aiManager.runCodeAction({
    action: 'tests',
    language: 'python',
    filePath: 'calculator.py',
    selection: 'def add(a, b): return a + b',
  });
  console.log(`[TEST 6] Tests action: success=${testsRes.success}, includes pytest=${testsRes.response.includes('pytest')}`);
  if (!testsRes.success || !testsRes.response.includes('pytest')) {
    throw new Error('Tests action failed');
  }

  // 7. Test docs action
  const docsRes = await aiManager.runCodeAction({
    action: 'docs',
    language: 'python',
    filePath: 'calculator.py',
    selection: 'def add(a, b): return a + b',
  });
  console.log(`[TEST 7] Docs action: success=${docsRes.success}, hasProposedPatch=${!!docsRes.proposedPatch}`);
  if (!docsRes.success || !docsRes.proposedPatch) {
    throw new Error('Docs action failed');
  }

  console.log('>>> ALL 7 AI CODE ACTIONS UNIT TESTS PASSED SUCCESSFULLY! <<<');
}

runAiTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
