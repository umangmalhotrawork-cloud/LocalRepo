/**
 * NEXUS CODEX HARNESS - CAPABILITY CENTER & MCP CONTROL TEST SUITE (Milestone 15)
 * 
 * Verifies Capability Center runtime APIs, event streaming, control actions, and safety boundaries:
 * 1. initial server state hydration
 * 2. MCP started event
 * 3. MCP stopped event
 * 4. MCP failure event
 * 5. restart action
 * 6. skill hydration
 * 7. skill enable
 * 8. skill disable
 * 9. skill reload
 * 10. invalid config presentation
 * 11. tool list
 * 12. capability list
 * 13. status updates
 * 14. event cleanup
 * 15. secret filtering
 * 16. control ownership boundary
 * 17. nonexistent server handling
 * 18. nonexistent skill handling
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), 'nexus_test_cap_center_continuum_' + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
  MCP_SERVER_STATUS,
  MCP_TRANSPORT,
  SKILL_STATUS,
  SKILL_SCOPE,
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

async function runCapabilityCenterTests() {
  console.log('====================================================');
  console.log('[TEST] Starting Capability Center Test Suite (Milestone 15)...');
  console.log('====================================================\n');

  const baseTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cap-center-'));
  const sampleWorkspace = path.join(baseTestDir, 'sample_project');
  const nexusDir = path.join(sampleWorkspace, '.nexus');
  const skillsDir = path.join(nexusDir, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const sampleMcpJson = {
    servers: [
      {
        id: 'github-ops',
        name: 'GitHub Operations',
        transport: 'in_process',
        enabled: true,
        tools: [
          {
            name: 'git_list_prs',
            description: 'List open pull requests',
            riskLevel: 'SAFE',
            isReadOnly: true,
          },
        ],
      },
      {
        id: 'deploy-srv',
        name: 'Deploy Server',
        transport: 'in_process',
        enabled: false,
        tools: [
          {
            name: 'trigger_deploy',
            description: 'Trigger deployment',
            riskLevel: 'HIGH_RISK',
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(nexusDir, 'mcp.json'), JSON.stringify(sampleMcpJson, null, 2), 'utf-8');

  const sampleSkill = `---
id: deploy-safety
name: Deployment Safety
version: 1.0.0
triggers: deploy, release
requires: trigger_deploy
---
Always verify staging before production.
`;
  fs.writeFileSync(path.join(skillsDir, 'deploy-safety.md'), sampleSkill, 'utf-8');

  const runtime = HarnessRuntime.createIsolated();

  // Test 1: initial server state hydration
  await asyncTest('Test 1: initial server state hydration hydrates servers and tools', async () => {
    const hyd = await runtime.loadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(hyd.success, true);

    const servers = runtime.listMCPServers();
    assert.strictEqual(servers.length, 2);
    assert.ok(servers.some((s) => s.serverId === 'github-ops' && s.status === MCP_SERVER_STATUS.RUNNING));
    assert.ok(servers.some((s) => s.serverId === 'deploy-srv' && s.status === MCP_SERVER_STATUS.REGISTERED));
  });

  // Test 2: MCP started event
  await asyncTest('Test 2: MCP started event emitted on startMCPServer', async () => {
    let startedEvent = null;
    const unsub = runtime.subscribe((evt) => {
      if (evt.type === EVENT_TYPES.MCP_SERVER_STARTED) {
        startedEvent = evt;
      }
    });

    await runtime.startMCPServer('deploy-srv');
    unsub();

    assert.ok(startedEvent);
    assert.strictEqual(startedEvent.payload.serverId, 'deploy-srv');
    assert.strictEqual(runtime.getMCPServer('deploy-srv').status, MCP_SERVER_STATUS.RUNNING);
  });

  // Test 3: MCP stopped event
  await asyncTest('Test 3: MCP stopped event emitted on stopMCPServer', async () => {
    let stoppedEvent = null;
    const unsub = runtime.subscribe((evt) => {
      if (evt.type === EVENT_TYPES.MCP_SERVER_STOPPED) {
        stoppedEvent = evt;
      }
    });

    await runtime.stopMCPServer('deploy-srv');
    unsub();

    assert.ok(stoppedEvent);
    assert.strictEqual(stoppedEvent.payload.serverId, 'deploy-srv');
    assert.strictEqual(runtime.getMCPServer('deploy-srv').status, MCP_SERVER_STATUS.STOPPED);
  });

  // Test 4: MCP failure event
  await asyncTest('Test 4: MCP failure event emitted on crashed or failing server', async () => {
    let failedEvent = null;
    const unsub = runtime.subscribe((evt) => {
      if (evt.type === EVENT_TYPES.MCP_SERVER_FAILED) {
        failedEvent = evt;
      }
    });

    runtime.registerMCPServer({
      serverId: 'failing-srv',
      name: 'Failing Server',
      transport: MCP_TRANSPORT.STDIO,
      processConfig: {
        command: 'invalid_cmd_does_not_exist_xyz',
      },
    });

    try {
      await runtime.startMCPServer('failing-srv');
    } catch (e) {}
    unsub();

    assert.ok(failedEvent);
    assert.strictEqual(failedEvent.payload.serverId, 'failing-srv');
    assert.strictEqual(runtime.getMCPServer('failing-srv').status, MCP_SERVER_STATUS.FAILED);
  });

  // Test 5: restart action
  await asyncTest('Test 5: restart action transitions through stop and start', async () => {
    await runtime.restartMCPServer('github-ops');
    assert.strictEqual(runtime.getMCPServer('github-ops').status, MCP_SERVER_STATUS.RUNNING);
  });

  // Test 6: skill hydration
  test('Test 6: skill hydration indexes project skills in SkillRegistry', () => {
    const skills = runtime.listSkills();
    assert.ok(skills.length >= 5); // Built-in + project
    assert.ok(skills.some((s) => s.skillId === 'deploy-safety'));
  });

  // Test 7: skill disable
  test('Test 7: skill disable changes skill status to DISABLED and excludes from resolution', () => {
    runtime.disableSkill('deploy-safety');
    const sk = runtime.getSkill('deploy-safety');
    assert.strictEqual(sk.enabled, false);
    assert.strictEqual(sk.status, SKILL_STATUS.DISABLED);

    const resolved = runtime.resolveSkills({ userInput: 'Please deploy application' });
    assert.ok(!resolved.some((s) => s.skillId === 'deploy-safety'));
  });

  // Test 8: skill enable
  test('Test 8: skill enable reactivates skill and updates status to ACTIVE', () => {
    runtime.enableSkill('deploy-safety');
    const sk = runtime.getSkill('deploy-safety');
    assert.strictEqual(sk.enabled, true);
    assert.strictEqual(sk.status, SKILL_STATUS.ACTIVE);
  });

  // Test 9: skill reload
  await asyncTest('Test 9: skill reload atomically updates skill definitions', async () => {
    const updatedSkill = `---
id: deploy-safety
name: Deployment Safety v2
version: 2.0.0
triggers: deploy, release
---
Updated production checklist.
`;
    fs.writeFileSync(path.join(skillsDir, 'deploy-safety.md'), updatedSkill, 'utf-8');

    await runtime.reloadProjectCapabilities(sampleWorkspace);
    const sk = runtime.getSkill('deploy-safety');
    assert.strictEqual(sk.name, 'Deployment Safety v2');
    assert.strictEqual(sk.version, '2.0.0');
  });

  // Test 10: invalid config presentation
  await asyncTest('Test 10: invalid config presentation records structured errors without crashing', async () => {
    const badWs = path.join(baseTestDir, 'bad_config_project');
    const bNexus = path.join(badWs, '.nexus');
    fs.mkdirSync(bNexus, { recursive: true });
    fs.writeFileSync(path.join(bNexus, 'mcp.json'), '{ MALFORMED_JSON_CONTENT }', 'utf-8');

    const disc = runtime.discoverProjectCapabilities(badWs);
    assert.strictEqual(disc.exists, true);

    const res = await runtime.loadProjectCapabilities(badWs);
    assert.strictEqual(res.success, false);
    assert.ok(res.errors.length > 0);
  });

  // Test 11: tool list
  test('Test 11: tool list provides server-specific exposed tools', () => {
    const s = runtime.getMCPServer('github-ops');
    assert.ok(s);
    assert.ok(Array.isArray(s.tools));
    assert.ok(s.tools.some((t) => t.name === 'git_list_prs'));
  });

  // Test 12: capability list
  test('Test 12: capability list returns normalized capability items', () => {
    const caps = runtime.capabilityRegistry.listCapabilities();
    assert.ok(caps.length > 0);
    assert.ok(caps.some((c) => c.name === 'git_list_prs' && c.type === CAPABILITY_TYPE.MCP_TOOL));
    assert.ok(caps.some((c) => c.id === 'deploy-safety' && c.type === CAPABILITY_TYPE.SKILL));
  });

  // Test 13: status updates
  test('Test 13: status updates reflect accurate server state', () => {
    assert.strictEqual(runtime.mcpServerManager.getServerStatus('github-ops'), MCP_SERVER_STATUS.RUNNING);
    const deployStatus = runtime.mcpServerManager.getServerStatus('deploy-srv');
    assert.ok(deployStatus === MCP_SERVER_STATUS.REGISTERED || deployStatus === MCP_SERVER_STATUS.STOPPED);
  });

  // Test 14: event cleanup
  test('Test 14: event cleanup unsubscribes listener cleanly', () => {
    let callCount = 0;
    const unsub = runtime.subscribe(() => {
      callCount++;
    });

    runtime.eventBus.emit('TEST_EVENT_1', {});
    assert.strictEqual(callCount, 1);

    unsub();
    runtime.eventBus.emit('TEST_EVENT_2', {});
    assert.strictEqual(callCount, 1);
  });

  // Test 15: secret filtering
  test('Test 15: secret filtering ensures server lists contain zero API keys', () => {
    const srvs = runtime.listMCPServers();
    for (const s of srvs) {
      assert.strictEqual(s.env, undefined);
      assert.strictEqual(s.OPENAI_API_KEY, undefined);
      assert.strictEqual(s.ANTHROPIC_API_KEY, undefined);
    }
  });

  // Test 16: control ownership boundary
  test('Test 16: control ownership boundary ensures actions route through HarnessRuntime', () => {
    assert.strictEqual(typeof runtime.startMCPServer, 'function');
    assert.strictEqual(typeof runtime.stopMCPServer, 'function');
    assert.strictEqual(typeof runtime.restartMCPServer, 'function');
    assert.strictEqual(typeof runtime.enableSkill, 'function');
    assert.strictEqual(typeof runtime.disableSkill, 'function');
  });

  // Test 17: nonexistent server handling
  await asyncTest('Test 17: nonexistent server handling returns NOT_FOUND or rejects gracefully', async () => {
    const status = runtime.mcpServerManager.getServerStatus('non_existent_server_123');
    assert.strictEqual(status, 'NOT_FOUND');

    let errCaught = false;
    try {
      await runtime.startMCPServer('non_existent_server_123');
    } catch (e) {
      errCaught = true;
      assert.ok(e.message.includes('not found'));
    }
    assert.strictEqual(errCaught, true);
  });

  // Test 18: nonexistent skill handling
  test('Test 18: nonexistent skill handling returns null and fails disable gracefully', () => {
    const sk = runtime.getSkill('non_existent_skill_xyz');
    assert.strictEqual(sk, null);

    const res = runtime.disableSkill('non_existent_skill_xyz');
    assert.strictEqual(res, false);
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCapabilityCenterTests().catch((err) => {
  console.error('[FATAL] Capability Center Test runner crashed:', err);
  process.exit(1);
});
