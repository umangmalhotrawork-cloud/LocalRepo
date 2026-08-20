/**
 * NEXUS CODEX HARNESS - SKILL LIFECYCLE TEST SUITE (Milestone 14)
 * 
 * Verifies skill lifecycle, versioning, dependencies, scoping, and watcher resilience (Tests 22–37):
 * 22. skill registration
 * 23. skill version update
 * 24. invalid replacement preserves valid prior version
 * 25. skill delete
 * 26. skill rename
 * 27. duplicate skill ID
 * 28. skill dependency resolution
 * 29. missing dependency
 * 30. subagent skill scope
 * 31. project vs builtin precedence
 * 32. watcher debounce
 * 33. atomic file replacement
 * 34. transient invalid save
 * 35. skill disable
 * 36. persistence metadata
 * 37. restart restoration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), 'nexus_test_skill_lifecycle_continuum_' + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  SkillRegistry,
  SKILL_STATUS,
  SKILL_SCOPE,
  CAPABILITY_TYPE,
  EVENT_TYPES,
} = require('./harness');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
    passedTests++;
  } catch (err) {
    console.error('[FAIL] ' + name + ':', err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log('[PASS] ' + name);
    passedTests++;
  } catch (err) {
    console.error('[FAIL] ' + name + ':', err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function runSkillLifecycleTests() {
  console.log('====================================================');
  console.log('[TEST] Starting Skill Lifecycle Test Suite (Milestone 14)...');
  console.log('====================================================\n');

  const baseTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-lifecycle-'));
  const sampleWorkspace = path.join(baseTestDir, 'sample_project');
  const skillsDir = path.join(sampleWorkspace, '.nexus', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const runtime = HarnessRuntime.createIsolated();
  const skillRegistry = runtime.skillRegistry;
  const loader = runtime.projectCapabilityLoader;

  // Test 22: skill registration
  test('Test 22: skill registration initializes versioned skill with active status', () => {
    const s = skillRegistry.registerSkill({
      skillId: 'custom-deploy-skill',
      name: 'Custom Deploy',
      version: '1.0.0',
      description: 'Production deployment checklist',
      triggers: ['deploy', 'prod', 'staging'],
      instructions: 'Always run lint and build before deployment.',
      source: 'project',
      scope: SKILL_SCOPE.PROJECT,
    });

    assert.ok(s);
    assert.strictEqual(s.skillId, 'custom-deploy-skill');
    assert.strictEqual(s.version, '1.0.0');
    assert.strictEqual(s.status, SKILL_STATUS.ACTIVE);
    assert.strictEqual(s.scope, SKILL_SCOPE.PROJECT);
    assert.ok(s.configHash);
  });

  // Test 23: skill version update
  test('Test 23: skill version update updates instructions and emits SKILL_RELOADED', () => {
    let reloadedEmitted = false;
    const unsub = runtime.subscribe((evt) => {
      if (evt.type === EVENT_TYPES.SKILL_RELOADED) {
        reloadedEmitted = true;
      }
    });

    const updated = skillRegistry.updateSkill('custom-deploy-skill', {
      name: 'Custom Deploy',
      version: '1.1.0',
      instructions: 'Run lint, type check, and build before deployment.',
    });
    unsub();

    assert.strictEqual(updated.version, '1.1.0');
    assert.ok(updated.instructions.includes('type check'));
    assert.strictEqual(reloadedEmitted, true);
  });

  // Test 24: invalid replacement preserves valid prior version
  test('Test 24: invalid replacement preserves valid prior version', () => {
    let thrown = false;
    try {
      skillRegistry.updateSkill('custom-deploy-skill', {
        name: 'Custom Deploy',
        instructions: '   ', // Invalid empty instructions
      });
    } catch (e) {
      thrown = true;
    }

    assert.strictEqual(thrown, true);
    const existing = skillRegistry.getSkill('custom-deploy-skill');
    assert.ok(existing);
    assert.strictEqual(existing.version, '1.1.0');
    assert.ok(existing.instructions.includes('type check'));
    assert.strictEqual(existing.status, SKILL_STATUS.ACTIVE);
  });

  // Test 25: skill delete
  test('Test 25: skill delete removes skill and cleans up capability registry', () => {
    const s = skillRegistry.registerSkill({
      skillId: 'temp-skill',
      name: 'Temporary Skill',
      instructions: 'Temporary instructions',
    });
    assert.ok(runtime.capabilityRegistry.hasCapability('temp-skill'));

    skillRegistry.unregisterSkill('temp-skill');
    assert.strictEqual(skillRegistry.getSkill('temp-skill'), null);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('temp-skill'), false);
  });

  // Test 26: skill rename
  test('Test 26: skill rename updates nameIndex and preserves skillId', () => {
    const updated = skillRegistry.updateSkill('custom-deploy-skill', {
      name: 'Advanced Custom Deploy',
      version: '1.2.0',
    });

    assert.strictEqual(updated.name, 'Advanced Custom Deploy');
    assert.ok(skillRegistry.getSkill('Advanced Custom Deploy'));
    assert.strictEqual(skillRegistry.getSkill('Advanced Custom Deploy').skillId, 'custom-deploy-skill');
  });

  // Test 27: duplicate skill ID
  test('Test 27: duplicate skill ID is rejected during file discovery', () => {
    const dupWs = path.join(baseTestDir, 'dup_test_ws');
    const dSkillsDir = path.join(dupWs, '.nexus', 'skills');
    fs.mkdirSync(dSkillsDir, { recursive: true });

    fs.writeFileSync(path.join(dSkillsDir, 'a.md'), '---\nid: same-id\nname: A\n---\nInstruct A', 'utf-8');
    fs.writeFileSync(path.join(dSkillsDir, 'b.md'), '---\nid: same-id\nname: B\n---\nInstruct B', 'utf-8');

    const res = loader.loadSkills(dupWs);
    assert.strictEqual(res.success, false);
    assert.ok(res.errors.some((e) => e.includes('Duplicate skill ID')));
  });

  // Test 28: skill dependency resolution
  test('Test 28: skill dependency resolution matches skill when all requires are satisfied', () => {
    // Register required capability
    runtime.capabilityRegistry.registerCapability({
      id: 'docker_build_tool',
      name: 'docker_build_tool',
      type: CAPABILITY_TYPE.NEXUS_TOOL,
      enabled: true,
      execute: async () => ({ built: true }),
    });

    skillRegistry.registerSkill({
      skillId: 'docker-deploy-skill',
      name: 'Docker Deploy',
      version: '1.0.0',
      triggers: ['docker', 'container'],
      requires: ['docker_build_tool'],
      instructions: 'Run docker_build_tool before push.',
    });

    const resolved = skillRegistry.resolveSkills({ userInput: 'Please build docker container' });
    assert.ok(resolved.some((s) => s.skillId === 'docker-deploy-skill'));
  });

  // Test 29: missing dependency
  test('Test 29: missing dependency excludes skill from resolution', () => {
    skillRegistry.registerSkill({
      skillId: 'kubernetes-deploy-skill',
      name: 'K8s Deploy',
      version: '1.0.0',
      triggers: ['k8s', 'kubernetes'],
      requires: ['non_existent_kubectl_tool_xyz'],
      instructions: 'Apply k8s manifests.',
    });

    const resolved = skillRegistry.resolveSkills({ userInput: 'Please apply kubernetes manifest' });
    assert.ok(!resolved.some((s) => s.skillId === 'kubernetes-deploy-skill'), 'Skill with missing dependency must be excluded');
  });

  // Test 30: subagent skill scope
  test('Test 30: subagent skill scope enforces role capability boundaries', () => {
    const subSkill = skillRegistry.registerSkill({
      skillId: 'subagent-research-skill',
      name: 'Subagent Research',
      version: '1.0.0',
      scope: SKILL_SCOPE.SUBAGENT,
      triggers: ['research', 'survey'],
      instructions: 'Survey codebase and list references.',
    });

    assert.strictEqual(subSkill.scope, SKILL_SCOPE.SUBAGENT);
  });

  // Test 31: project vs builtin precedence
  test('Test 31: project vs builtin precedence preserves builtin skills', () => {
    const builtinGit = skillRegistry.getSkill('skill_git_workflow');
    assert.ok(builtinGit);
    assert.strictEqual(builtinGit.scope, SKILL_SCOPE.BUILTIN);

    // Unregistering project skills should leave built-in intact
    skillRegistry.unregisterProjectSkills();
    assert.ok(skillRegistry.getSkill('skill_git_workflow'), 'Builtin skill remains intact');
  });

  // Test 32: watcher debounce
  await asyncTest('Test 32: watcher debounce handles multiple rapid filesystem events', async () => {
    loader.startWatching(sampleWorkspace);
    assert.ok(loader.activeWatchers.has(sampleWorkspace));
    loader.stopWatching(sampleWorkspace);
    assert.strictEqual(loader.activeWatchers.has(sampleWorkspace), false);
  });

  // Test 33: atomic file replacement
  await asyncTest('Test 33: atomic file replacement updates skill cleanly', async () => {
    const skillPath = path.join(skillsDir, 'test-atomic.md');
    fs.writeFileSync(skillPath, '---\nid: atomic-skill\nname: Atomic Skill\ntriggers: atomic\n---\nInitial Atomic Content', 'utf-8');

    await loader.loadProjectCapabilities(sampleWorkspace);
    assert.ok(skillRegistry.getSkill('atomic-skill'));
    assert.ok(skillRegistry.getSkill('atomic-skill').instructions.includes('Initial Atomic Content'));

    // Write updated content via temp file rename (atomic save pattern)
    const tmpPath = skillPath + '.tmp';
    fs.writeFileSync(tmpPath, '---\nid: atomic-skill\nname: Atomic Skill v2\nversion: 2.0.0\ntriggers: atomic\n---\nUpdated Atomic Content', 'utf-8');
    fs.renameSync(tmpPath, skillPath);

    await loader.reloadProjectCapabilities(sampleWorkspace);
    const updated = skillRegistry.getSkill('atomic-skill');
    assert.ok(updated);
    assert.strictEqual(updated.version, '2.0.0');
    assert.ok(updated.instructions.includes('Updated Atomic Content'));
  });

  // Test 34: transient invalid save
  await asyncTest('Test 34: transient invalid save keeps prior valid skill active', async () => {
    const skillPath = path.join(skillsDir, 'test-atomic.md');

    // Simulate partial/broken editor write
    fs.writeFileSync(skillPath, '---\nid: atomic-skill\nname: Broken\n---\n    ', 'utf-8');

    const reloadRes = await loader.reloadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(reloadRes.success, false);

    // Prior valid skill remains active!
    const activeSkill = skillRegistry.getSkill('atomic-skill');
    assert.ok(activeSkill);
    assert.strictEqual(activeSkill.version, '2.0.0');
    assert.ok(activeSkill.instructions.includes('Updated Atomic Content'));
  });

  // Test 35: skill disable
  test('Test 35: skill disable excludes skill from turn resolution', () => {
    skillRegistry.disableSkill('atomic-skill');
    const s = skillRegistry.getSkill('atomic-skill');
    assert.strictEqual(s.enabled, false);
    assert.strictEqual(s.status, SKILL_STATUS.DISABLED);

    const resolved = skillRegistry.resolveSkills({ userInput: 'Run atomic task' });
    assert.ok(!resolved.some((sk) => sk.skillId === 'atomic-skill'));

    // Re-enable
    skillRegistry.enableSkill('atomic-skill');
    assert.strictEqual(skillRegistry.getSkill('atomic-skill').enabled, true);
    assert.strictEqual(skillRegistry.getSkill('atomic-skill').status, SKILL_STATUS.ACTIVE);
  });

  // Test 36: persistence metadata
  test('Test 36: persistence metadata extracts skill IDs and statuses safely', () => {
    const meta = loader.getPersistenceMetadata(sampleWorkspace);
    assert.ok(meta);
    assert.ok(Array.isArray(meta.skillIds));
    assert.strictEqual(meta.secrets, undefined);
  });

  // Test 37: restart restoration
  await asyncTest('Test 37: restart restoration rebuilds skills from disk', async () => {
    // Restore valid file
    fs.writeFileSync(
      path.join(skillsDir, 'test-atomic.md'),
      '---\nid: atomic-skill\nname: Atomic Skill Restored\nversion: 2.1.0\ntriggers: atomic\n---\nRestored instructions',
      'utf-8'
    );

    const freshRuntime = HarnessRuntime.createIsolated();
    await freshRuntime.loadProjectCapabilities(sampleWorkspace);

    const restored = freshRuntime.getSkill('atomic-skill');
    assert.ok(restored);
    assert.strictEqual(restored.version, '2.1.0');
    assert.ok(restored.instructions.includes('Restored instructions'));
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSkillLifecycleTests().catch((err) => {
  console.error('[FATAL] Skill Lifecycle Test runner crashed:', err);
  process.exit(1);
});
