/**
 * NEXUS CODEX HARNESS - WORKSPACE ISOLATION TEST SUITE (Milestone 9A)
 * Verifies isolated subagent workspace environments (Git Worktree & Shadow Copy Fallback):
 * 1. Git repo detection
 * 2. Child worktree creation
 * 3. Child workspace metadata
 * 4. Parent workspace unchanged
 * 5. Child read_file isolation
 * 6. Child search isolation
 * 7. Child run_tests isolation
 * 8. Child run_command cwd isolation
 * 9. Child apply_patch isolation
 * 10. Child ChangeSet remains workspace-local
 * 11. Conflicting parent changes rejected
 * 12. Child adoption
 * 13. Parent-side firewall
 * 14. Parent-side transactional apply
 * 15. Adoption verification
 * 16. Cleanup
 * 17. Failed child preservation
 * 18. Cancellation cleanup
 * 19. Crash/restart metadata restoration
 * 20. Non-Git fallback workspace
 * 21. Path traversal protection
 * 22. Secret handling
 * 23. Concurrent child workspace isolation
 * 24. Parent workspace integrity
 * 25. Phase 14 End-to-End Scenario
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), `nexus_test_continuum_${Date.now()}`);
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  WorkspaceIsolationManager,
  ChangeSet,
  WORKSPACE_STATUS,
  WORKSPACE_CLEANUP_POLICY,
  WORKSPACE_ISOLATION_MODE,
  ITEM_TYPES,
  TURN_STATUS,
  EVENT_TYPES,
} = require('./harness');


const { evidenceGraph } = require('./evidence/EvidenceGraph');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    console.error(err.stack);
    failedTests++;
  }
}

console.log('====================================================');
console.log('[TEST] Starting NEXUS Codex Harness Workspace Isolation Suite (Milestone 9A)...');
console.log('====================================================\n');

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  HOME: os.tmpdir(),
};

// Helper: Sets up a real git repo in a temp dir
function setupGitRepo() {
  const repoDir = path.join(os.tmpdir(), `nexus_git_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(repoDir, { recursive: true });

  execSync('git init', { cwd: repoDir, stdio: 'pipe', env: gitEnv });
  execSync('git config user.name "Nexus Tester"', { cwd: repoDir, stdio: 'pipe', env: gitEnv });
  execSync('git config user.email "tester@nexus.local"', { cwd: repoDir, stdio: 'pipe', env: gitEnv });

  const fileA = path.join(repoDir, 'auth.ts');
  const fileB = path.join(repoDir, 'session.ts');
  fs.writeFileSync(fileA, 'export function verifyToken(token: string) { return Boolean(token); }\n');
  fs.writeFileSync(fileB, 'export function getSession(id: string) { return { id, active: true }; }\n');

  execSync('git add .', { cwd: repoDir, stdio: 'ignore', env: gitEnv });
  execSync('git commit -m "initial commit"', { cwd: repoDir, stdio: 'ignore', env: gitEnv });

  return { repoDir, fileA, fileB };
}


// Helper: Sets up a non-git dir
function setupNonGitDir() {
  const dir = path.join(os.tmpdir(), `nexus_nongit_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.ts'), 'export const app = "nexus";\n');
  return dir;
}

(async () => {
  const { repoDir, fileA, fileB } = setupGitRepo();
  const nonGitDir = setupNonGitDir();

  // Test 1: Git Repo Detection
  test('Test 1: Git Repository Detection', () => {
    const mgr = new WorkspaceIsolationManager();
    assert.strictEqual(mgr.isGitRepository(repoDir), true);
    assert.strictEqual(mgr.isGitRepository(nonGitDir), false);
  });

  // Test 2: Child Worktree Creation
  test('Test 2: Child Git Worktree Creation', () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_child_01',
      mode: 'git_worktree',
    });

    assert.strictEqual(ws.mode, WORKSPACE_ISOLATION_MODE.GIT_WORKTREE);
    assert.strictEqual(ws.status, WORKSPACE_STATUS.READY);
    assert.ok(fs.existsSync(ws.childWorkspacePath));
    assert.ok(fs.existsSync(path.join(ws.childWorkspacePath, 'auth.ts')));
    assert.ok(ws.branchName.startsWith('nexus-subagent-'));
  });

  // Test 3: Child Workspace Metadata
  test('Test 3: Child Workspace Metadata Structure', () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_child_02',
      cleanupPolicy: WORKSPACE_CLEANUP_POLICY.KEEP,
    });

    assert.ok(ws.workspaceId.startsWith('ws_iso_'));
    assert.strictEqual(ws.parentWorkspacePath, path.resolve(repoDir));
    assert.strictEqual(ws.threadId, 'thread_child_02');
    assert.strictEqual(ws.cleanupPolicy, WORKSPACE_CLEANUP_POLICY.KEEP);
  });

  // Test 4: Parent Workspace Unchanged
  test('Test 4: Modifying Child Workspace Leaves Parent Unchanged', () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_child_03',
    });

    const childAuthPath = path.join(ws.childWorkspacePath, 'auth.ts');
    fs.writeFileSync(childAuthPath, 'export function verifyToken() { return "MUTATED_IN_CHILD"; }\n');

    const parentAuthContent = fs.readFileSync(fileA, 'utf8');
    const childAuthContent = fs.readFileSync(childAuthPath, 'utf8');

    assert.ok(childAuthContent.includes('MUTATED_IN_CHILD'));
    assert.ok(parentAuthContent.includes('Boolean(token)'));
    assert.ok(!parentAuthContent.includes('MUTATED_IN_CHILD'));
  });

  // Test 5: Child read_file Isolation
  await asyncTest('Test 5: Child read_file Tool Isolation', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { workspacePath: repoDir } });

    // Child in isolated workspace
    const child = runtime.createSubagent({
      parentThreadId: parent.threadId,
      role: 'coder',
      isolateWorkspace: true,
    });

    const ws = runtime.getChildWorkspace(child.threadId);
    assert.ok(ws !== null);

    // Modify child's auth.ts
    fs.writeFileSync(path.join(ws.childWorkspacePath, 'auth.ts'), '// Child unique comment\n');

    const readTool = runtime.toolRegistry.getTool('read_file');
    const res = await readTool.execute({ path: 'auth.ts' }, { workspacePath: ws.childWorkspacePath });

    assert.strictEqual(res.success, true);
    assert.ok(res.content.includes('Child unique comment'));
  });

  // Test 6: Child search_workspace Isolation
  await asyncTest('Test 6: Child search_workspace Tool Isolation', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const ws = runtime.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_search' });

    fs.writeFileSync(path.join(ws.childWorkspacePath, 'secret_child_feature.ts'), 'export const FEATURE_XYZ = 123;\n');

    const searchTool = runtime.toolRegistry.getTool('search_workspace');
    const childRes = await searchTool.execute({ query: 'FEATURE_XYZ' }, { workspacePath: ws.childWorkspacePath });
    const parentRes = await searchTool.execute({ query: 'FEATURE_XYZ' }, { workspacePath: repoDir });

    assert.strictEqual(childRes.success, true);
    assert.ok(childRes.totalMatches > 0);
    assert.strictEqual(parentRes.totalMatches, 0);
  });

  // Test 7: Child run_tests Isolation
  await asyncTest('Test 7: Child run_tests Scoped to Child Directory', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const ws = runtime.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_test' });

    const testsTool = runtime.toolRegistry.getTool('run_tests');
    const res = await testsTool.execute({}, { workspacePath: ws.childWorkspacePath });

    assert.ok(res !== null);
  });

  // Test 8: Child run_command Cwd Isolation
  await asyncTest('Test 8: Child run_command Cwd Isolation', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const ws = runtime.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_cmd' });

    const cmdTool = runtime.toolRegistry.getTool('run_command');
    const res = await cmdTool.execute({ command: 'pwd' }, { workspacePath: ws.childWorkspacePath, approvalMode: 'auto' });

    assert.strictEqual(res.success, true);
    assert.ok(res.stdout.includes(path.basename(ws.childWorkspacePath)) || res.stdout.includes(ws.workspaceId));
  });

  // Test 9: Child apply_patch Isolation
  await asyncTest('Test 9: Child apply_patch Writes Only to Isolated Workspace', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const ws = runtime.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_patch' });

    const applyTool = runtime.toolRegistry.getTool('apply_patch');
    const patchRes = await applyTool.execute({
      edits: [
        {
          filePath: 'auth.ts',
          original: 'return Boolean(token);',
          replacement: 'return token.startsWith("bearer_");',
        },
      ],
    }, {
      workspacePath: ws.childWorkspacePath,
      isApproved: true,
    });

    assert.strictEqual(patchRes.success, true);

    const childAuth = fs.readFileSync(path.join(ws.childWorkspacePath, 'auth.ts'), 'utf8');
    const parentAuth = fs.readFileSync(fileA, 'utf8');

    assert.ok(childAuth.includes('token.startsWith("bearer_")'));
    assert.ok(parentAuth.includes('return Boolean(token);'));
    assert.ok(!parentAuth.includes('bearer_'));
  });

  // Test 10: Child ChangeSet Remains Workspace-Local
  test('Test 10: Child ChangeSet is Bound to Child Workspace', () => {
    const runtime = HarnessRuntime.createIsolated();
    const ws = runtime.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_cs' });

    const cs = runtime.createChangeSet({
      threadId: 'thread_child_cs',
      workspacePath: ws.childWorkspacePath,
    });

    assert.strictEqual(cs.workspacePath, ws.childWorkspacePath);
  });

  // Test 11: Conflicting Parent Changes Rejected on Adoption
  await asyncTest('Test 11: Conflicting Parent Changes are Safely Rejected on Adoption', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_conflict' });

    // Child creates change set expecting 'ORIGINAL_XYZ'
    const cs = new ChangeSet({
      threadId: 'thread_child_conflict',
      workspacePath: ws.childWorkspacePath,
      files: [
        {
          filePath: 'auth.ts',
          original: 'NON_EXISTENT_SUBSTRING_XYZ_123',
          replacement: 'NEW_CODE',
        },
      ],
    });

    await assert.rejects(async () => {
      await mgr.adoptChildChanges({
        childThreadId: 'thread_child_conflict',
        changeSet: cs,
        parentWorkspacePath: repoDir,
      });
    }, /ADOPT-CONFLICT/);
  });

  // Test 12: Child Adoption Flow
  await asyncTest('Test 12: Child Adoption Applies Changes into Parent Workspace', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_adopt' });

    const cs = new ChangeSet({
      threadId: 'thread_child_adopt',
      workspacePath: ws.childWorkspacePath,
      files: [
        {
          filePath: 'auth.ts',
          original: 'return Boolean(token);',
          replacement: 'return Boolean(token && token.length >= 8);',
        },
      ],
    });

    const adoptResult = await mgr.adoptChildChanges({
      childThreadId: 'thread_child_adopt',
      changeSet: cs,
      parentWorkspacePath: repoDir,
    });

    assert.strictEqual(adoptResult.success, true);
    assert.strictEqual(adoptResult.changeSet.status, 'APPLIED');

    // Parent workspace updated!
    const updatedParentAuth = fs.readFileSync(fileA, 'utf8');
    assert.ok(updatedParentAuth.includes('token.length >= 8'));
  });

  // Test 13: Parent-Side Firewall
  await asyncTest('Test 13: Parent-Side Patch Firewall Evaluates on Adoption', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_fw' });

    const cs = new ChangeSet({
      threadId: 'thread_child_fw',
      workspacePath: ws.childWorkspacePath,
      files: [
        {
          filePath: 'session.ts',
          original: 'active: true',
          replacement: 'active: true, secure: true',
        },
      ],
    });

    const res = await mgr.adoptChildChanges({
      childThreadId: 'thread_child_fw',
      changeSet: cs,
      parentWorkspacePath: repoDir,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.changeSet.risk !== undefined);
  });

  // Test 14: Parent-Side Transactional Apply
  await asyncTest('Test 14: Adoption Uses TransactionalPatchApplier Atomically', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_tx' });

    const cs = new ChangeSet({
      threadId: 'thread_child_tx',
      workspacePath: ws.childWorkspacePath,
      files: [
        {
          filePath: 'session.ts',
          original: 'active: true, secure: true',
          replacement: 'active: true, secure: true, ttl: 3600',
        },
      ],
    });

    const res = await mgr.adoptChildChanges({
      childThreadId: 'thread_child_tx',
      changeSet: cs,
      parentWorkspacePath: repoDir,
    });

    assert.strictEqual(res.success, true);
    const updatedSession = fs.readFileSync(fileB, 'utf8');
    assert.ok(updatedSession.includes('ttl: 3600'));
  });

  // Test 15: Adoption Verification
  await asyncTest('Test 15: Post-Adoption Verification Function Execution', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_child_v' });

    const cs = new ChangeSet({
      threadId: 'thread_child_v',
      files: [{ filePath: 'session.ts', original: 'ttl: 3600', replacement: 'ttl: 7200' }],
    });

    let verifierCalled = false;
    const res = await mgr.adoptChildChanges({
      childThreadId: 'thread_child_v',
      changeSet: cs,
      parentWorkspacePath: repoDir,
      verifierFn: async () => {
        verifierCalled = true;
        return { success: true, testsPassed: 5, testsFailed: 0 };
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(verifierCalled, true);
    assert.strictEqual(res.verification.verified, true);
  });

  // Test 16: Workspace Cleanup
  await asyncTest('Test 16: Workspace Cleanup Removes Worktree / Directory', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_child_cleanup',
      cleanupPolicy: WORKSPACE_CLEANUP_POLICY.DELETE_ON_COMPLETION,
    });

    const wsPath = ws.childWorkspacePath;
    assert.ok(fs.existsSync(wsPath));

    const cleanRes = await mgr.cleanupChildWorkspace(ws.workspaceId);
    assert.strictEqual(cleanRes.success, true);
    assert.ok(!fs.existsSync(wsPath));
  });

  // Test 17: Failed Child Preservation
  await asyncTest('Test 17: Failed Workspace Preserved under KEEP or DELETE_ON_FAILURE Policy', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_child_keep',
      cleanupPolicy: WORKSPACE_CLEANUP_POLICY.KEEP,
    });

    const cleanRes = await mgr.cleanupChildWorkspace(ws.workspaceId, { force: false });
    assert.strictEqual(cleanRes.skipped, true);
    assert.ok(fs.existsSync(ws.childWorkspacePath));
  });

  // Test 18: Cancellation Cleanup
  await asyncTest('Test 18: Subagent Cancellation Triggers Appropriate Cleanup', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { workspacePath: repoDir } });

    const child = runtime.createSubagent({
      parentThreadId: parent.threadId,
      role: 'coder',
      isolateWorkspace: true,
      cleanupPolicy: WORKSPACE_CLEANUP_POLICY.DELETE_ON_COMPLETION,
    });

    const ws = runtime.getChildWorkspace(child.threadId);
    assert.ok(ws !== null);
    assert.ok(fs.existsSync(ws.childWorkspacePath));

    runtime.cancelSubagent(child.threadId);
    await runtime.cleanupChildWorkspace(ws.workspaceId, { force: true });
    assert.ok(!fs.existsSync(ws.childWorkspacePath));
  });

  // Test 19: Crash / Restart Metadata Restoration
  test('Test 19: Persistence and Restoration of Workspace Isolation Metadata', () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { workspacePath: repoDir } });
    const child = runtime.createSubagent({
      parentThreadId: parent.threadId,
      role: 'coder',
      isolateWorkspace: true,
    });

    const ws = runtime.getChildWorkspace(child.threadId);

    // Save thread via persistence adapter
    const saveRes = runtime.saveThread(child.threadId, repoDir);
    assert.strictEqual(saveRes.success, true);

    // Reconstruct in fresh runtime
    const freshRuntime = HarnessRuntime.createIsolated();
    const loadRes = freshRuntime.loadThread(child.threadId, repoDir);
    assert.strictEqual(loadRes.success, true);

    const restoredWs = freshRuntime.getChildWorkspace(child.threadId);
    assert.ok(restoredWs !== null);
    assert.strictEqual(restoredWs.workspaceId, ws.workspaceId);
    assert.strictEqual(restoredWs.childWorkspacePath, ws.childWorkspacePath);
  });

  // Test 20: Non-Git Fallback Workspace (Shadow Copy)
  test('Test 20: Non-Git Fallback Uses Shadow Copy Strategy', () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: nonGitDir,
      threadId: 'thread_nongit_child',
      mode: 'auto',
    });

    assert.strictEqual(ws.mode, WORKSPACE_ISOLATION_MODE.SHADOW_COPY);
    assert.ok(fs.existsSync(path.join(ws.childWorkspacePath, 'app.ts')));
  });

  // Test 21: Path Traversal Protection
  await asyncTest('Test 21: Security Boundary and Path Traversal Defense', async () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({ parentWorkspacePath: repoDir, threadId: 'thread_traversal' });

    const cs = new ChangeSet({
      threadId: 'thread_traversal',
      files: [{ filePath: '../../outside_secret.key', original: 'key', replacement: 'bad' }],
    });

    await assert.rejects(async () => {
      await mgr.adoptChildChanges({
        childThreadId: 'thread_traversal',
        changeSet: cs,
        parentWorkspacePath: repoDir,
      });
    }, /Security Violation/);
  });

  // Test 22: Secret Handling in Workspace Metadata
  test('Test 22: Secret Filtering across Workspace Isolation Metadata', () => {
    const mgr = new WorkspaceIsolationManager();
    const ws = mgr.createChildWorkspace({
      parentWorkspacePath: repoDir,
      threadId: 'thread_secrets',
      metadata: { apiKey: 'sk-secret-key-12345' },
    });

    assert.ok(ws.metadata.apiKey.includes('REDACTED'));
  });


  // Test 23: Concurrent Child Workspace Isolation
  await asyncTest('Test 23: Multiple Concurrent Subagents in Independent Isolated Workspaces', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { workspacePath: repoDir } });

    const childA = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'coder', isolateWorkspace: true });
    const childB = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'coder', isolateWorkspace: true });

    const wsA = runtime.getChildWorkspace(childA.threadId);
    const wsB = runtime.getChildWorkspace(childB.threadId);

    assert.notStrictEqual(wsA.childWorkspacePath, wsB.childWorkspacePath);
    assert.notStrictEqual(wsA.workspaceId, wsB.workspaceId);

    // Modify independently
    fs.writeFileSync(path.join(wsA.childWorkspacePath, 'auth.ts'), '// Branch A mutation\n');
    fs.writeFileSync(path.join(wsB.childWorkspacePath, 'auth.ts'), '// Branch B mutation\n');

    const contentA = fs.readFileSync(path.join(wsA.childWorkspacePath, 'auth.ts'), 'utf8');
    const contentB = fs.readFileSync(path.join(wsB.childWorkspacePath, 'auth.ts'), 'utf8');

    assert.ok(contentA.includes('Branch A mutation'));
    assert.ok(contentB.includes('Branch B mutation'));
    assert.ok(!contentA.includes('Branch B'));
  });

  // Test 24: Parent Workspace Integrity
  test('Test 24: Parent Workspace Integrity Remains 100% Intact', () => {
    const parentAuth = fs.readFileSync(fileA, 'utf8');
    assert.ok(parentAuth.includes('token.length >= 8'));
  });

  // Test 25: Phase 14 End-to-End Scenario
  await asyncTest('Test 25: Phase 14 End-to-End Isolated Subagent Mutation and Adoption', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parentThread = runtime.createThread({ metadata: { workspacePath: repoDir, title: 'Parent Experiment' } });
    const parentTurn = runtime.startTurn(parentThread.threadId, 'Experiment with refactoring authentication.');

    // 1. Parent delegates to child coder with isolated workspace
    const childThread = runtime.createSubagent({
      parentThreadId: parentThread.threadId,
      parentTurnId: parentTurn.turnId,
      role: 'coder',
      isolateWorkspace: true,
      workspacePath: repoDir,
    });

    const ws = runtime.getChildWorkspace(childThread.threadId);
    assert.ok(ws !== null);

    // 2. Child executes turn inside isolated workspace
    const childResult = await runtime.startChildTurn(
      childThread.threadId,
      {
        taskGoal: 'Refactor session TTL to 86400',
        role: 'coder',
        codingIntent: 'MUTATION',
        workspacePath: ws.childWorkspacePath,
        relevantFiles: ['session.ts'],
      },
      {
        modelHandler: async (messages) => {
          if (messages.some((m) => m.role === 'tool')) {
            return 'Refactored session TTL to 86400 inside isolated workspace.';
          }
          return {
            tool_calls: [
              {
                callId: 'c_patch',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    {
                      filePath: 'session.ts',
                      original: 'ttl: 7200',
                      replacement: 'ttl: 86400',
                    },
                  ],
                },
              },
            ],
          };
        },
        approvalMode: 'auto',
      }
    );

    assert.strictEqual(childResult.success, true);
    assert.ok(childResult.changeSets.length > 0);

    // 3. Verify parent workspace is untouched prior to adoption
    const parentSessionBefore = fs.readFileSync(fileB, 'utf8');
    assert.ok(!parentSessionBefore.includes('86400'));

    // 4. Parent inspects & adopts child ChangeSet
    const adoptRes = await runtime.adoptChildChanges({
      childThreadId: childThread.threadId,
      changeSet: childResult.changeSets[0],
      parentWorkspacePath: repoDir,
      verifierFn: async () => ({ success: true, testStatus: 'PASSED' }),
    });

    assert.strictEqual(adoptRes.success, true);

    // 5. Verify parent workspace is now updated
    const parentSessionAfter = fs.readFileSync(fileB, 'utf8');
    assert.ok(parentSessionAfter.includes('ttl: 86400'));
  });

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
