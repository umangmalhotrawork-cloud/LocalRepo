const fs = require('fs');
const path = require('path');
const os = require('os');
const searchManager = require('../electron/searchManager');

async function runSearchTests() {
  console.log('[TEST] Starting Workspace Search & Replace Test Suite...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-nullity-search-test-'));
  console.log(`[TEST] Created temporary test workspace: ${tempDir}`);

  try {
    // Create nested directory tree with multiple files
    const srcDir = path.join(tempDir, 'src');
    const utilsDir = path.join(tempDir, 'src', 'utils');
    const hiddenDir = path.join(tempDir, '.hidden');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.mkdirSync(hiddenDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const appTitle = "EchoIDE";\nconsole.log("Welcome to EchoIDE");\n');
    fs.writeFileSync(path.join(srcDir, 'calculator.py'), 'def calculate_total(items):\n    # Calculate total in EchoIDE\n    return sum(items)\n');
    fs.writeFileSync(path.join(utilsDir, 'helper.js'), 'function logInfo(msg) {\n    console.info("[EchoIDE]", msg);\n}\n');
    fs.writeFileSync(path.join(hiddenDir, 'config.json'), '{"appName": "EchoIDE"}\n');

    // 1. Plain Text Search
    const test1 = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'EchoIDE',
    });
    console.log(`[TEST 1] Plain text search for 'EchoIDE': matches=${test1.totalMatches}, files=${test1.totalFiles}, duration=${test1.durationMs}ms`);
    if (test1.totalMatches !== 4 || test1.totalFiles !== 3) {
      throw new Error(`Expected 4 matches in 3 files, got matches=${test1.totalMatches}, files=${test1.totalFiles}`);
    }

    // 2. Case Sensitive Search
    const test2 = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'echoide',
      isCaseSensitive: true,
    });
    console.log(`[TEST 2] Case-sensitive search for 'echoide': matches=${test2.totalMatches}`);
    if (test2.totalMatches !== 0) throw new Error('Expected 0 matches for case-sensitive mismatch');

    // 3. Whole Word Search
    const test3 = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'calc',
      isWholeWord: true,
    });
    console.log(`[TEST 3] Whole-word search for 'calc': matches=${test3.totalMatches}`);
    if (test3.totalMatches !== 0) throw new Error('Expected 0 matches for whole-word boundary');

    const test3b = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'items',
      isWholeWord: true,
    });
    console.log(`[TEST 3b] Whole-word search for 'items': matches=${test3b.totalMatches}`);
    if (test3b.totalMatches !== 2) throw new Error('Expected 2 matches for whole-word items');

    // 4. Regex Search
    const test4 = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'def\\s+[a-z_]+\\(',
      isRegex: true,
    });
    console.log(`[TEST 4] Regex search for function definitions: matches=${test4.totalMatches}`);
    if (test4.totalMatches !== 1) throw new Error('Expected 1 regex match');

    // 5. Replace Single Occurrence
    const firstMatch = test1.results.find(r => r.file.includes('calculator.py'));
    await searchManager.replaceSingle({
      workspacePath: tempDir,
      file: firstMatch.file,
      line: firstMatch.line,
      column: firstMatch.column,
      matchText: 'EchoIDE',
      replaceText: 'EchoNext',
    });

    const verifyReplaceSingle = fs.readFileSync(path.join(tempDir, firstMatch.file), 'utf8');
    console.log(`[TEST 5] Replace single verify content includes EchoNext: ${verifyReplaceSingle.includes('EchoNext')}`);
    if (!verifyReplaceSingle.includes('EchoNext')) throw new Error('Replace single failed');

    // 6. Replace All in Workspace
    const replaceAllRes = await searchManager.replaceAll({
      workspacePath: tempDir,
      query: 'EchoIDE',
      replaceText: 'EchoNullityFlagship',
    });
    console.log(`[TEST 6] Replace all in workspace: filesChanged=${replaceAllRes.filesChanged}, replacements=${replaceAllRes.replacementsCount}`);
    if (replaceAllRes.replacementsCount < 3) throw new Error('Replace all count mismatch');

    const postSearch = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'EchoNullityFlagship',
    });
    console.log(`[TEST 6] Search for replaced string: matches=${postSearch.totalMatches}`);
    if (postSearch.totalMatches < 3) throw new Error('Expected matches for replaced string');

    // 7. Performance Benchmark (1000 files)
    const benchmarkDir = path.join(tempDir, 'bench');
    fs.mkdirSync(benchmarkDir, { recursive: true });
    for (let i = 0; i < 1000; i++) {
      fs.writeFileSync(path.join(benchmarkDir, `file_${i}.js`), `// Generated file ${i}\nconst FLAG_TARGET = ${i % 10 === 0 ? '"TARGET_HIT"' : '"NO_HIT"'};\n`);
    }

    const benchStart = Date.now();
    const benchSearch = await searchManager.runSearch({
      workspacePath: tempDir,
      query: 'TARGET_HIT',
    });
    const benchDuration = Date.now() - benchStart;
    console.log(`[TEST 7] Benchmark 1000+ files: matches=${benchSearch.totalMatches}, duration=${benchDuration}ms`);
    if (benchSearch.totalMatches !== 100) throw new Error('Benchmark match count mismatch');

    console.log('>>> ALL 7 WORKSPACE SEARCH & REPLACE UNIT TESTS PASSED SUCCESSFULLY! <<<');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runSearchTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
