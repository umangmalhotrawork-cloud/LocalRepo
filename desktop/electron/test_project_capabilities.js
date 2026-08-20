/**
 * NEXUS CODEX HARNESS - PROJECT CAPABILITIES (MCP + SKILLS) TEST SUITE (Milestone 13)
 * 
 * Verifies all 26 required test scenarios:
 * 1. .nexus directory discovery
 * 2. valid mcp.json load
 * 3. invalid JSON handling
 * 4. duplicate server detection
 * 5. invalid transport rejection
 * 6. path traversal rejection
 * 7. unsafe environment filtering
 * 8. enabled server hydration
 * 9. disabled server preservation
 * 10. MCP tool discovery hydration
 * 11. skills directory discovery
 * 12. valid skill parsing
 * 13. malformed skill rejection
 * 14. duplicate skill IDs
 * 15. skill size limit
 * 16. capability registry hydration
 * 17. context-aware skill activation
 * 18. hot reload of valid skill
 * 19. hot reload of valid MCP config
 * 20. failed config does not destroy active server
 * 21. persistence metadata
 * 22. restart rehydration
 * 23. subagent capability restriction
 * 24. secret filtering
 * 25. project capability events
 * 26. nonexistent .nexus directory behaves cleanly
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), 'nexus_test_project_caps_continuum_' + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  ProjectCapabilityLoader,
  CapabilityRegistry,
  MCPServerManager,
  SkillRegistry,
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
  MCP_SERVER_STATUS,
  MCP_TRANSPORT,
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

async function runProjectCapabilityTests() {
  console.log('====================================================');
  console.log('[TEST] Starting NEXUS Project Capabilities Test Suite (Milestone 13)...');
  console.log('====================================================\n');

  const baseTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-proj-cap-test-'));

  // Setup sample workspace with .nexus
  const sampleWorkspace = path.join(baseTestDir, 'sample_project');
  const nexusDir = path.join(sampleWorkspace, '.nexus');
  const skillsDir = path.join(nexusDir, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const sampleMcpJson = {
    servers: [
      {
        id: 'github-tools',
        name: 'GitHub Tools',
        transport: 'in_process',
        enabled: true,
        riskLevel: 'REVIEW_REQUIRED',
        tools: [
          {
            name: 'git_status_check',
            description: 'Check git status for workspace',
            riskLevel: 'SAFE',
            isReadOnly: true,
          },
          {
            name: 'git_create_pr',
            description: 'Create a pull request on GitHub',
            riskLevel: 'REVIEW_REQUIRED',
            allowMutation: true,
          },
        ],
      },
      {
        id: 'database-mcp',
        name: 'Database Inspector',
        transport: 'in_process',
        enabled: false,
        riskLevel: 'HIGH_RISK',
        tools: [
          {
            name: 'db_drop_table',
            description: 'Drop a table in DB',
            riskLevel: 'HIGH_RISK',
            allowMutation: true,
          },
        ],
      },
    ],
  };

  fs.writeFileSync(path.join(nexusDir, 'mcp.json'), JSON.stringify(sampleMcpJson, null, 2), 'utf-8');

  const sampleSkillMd = `---
id: custom-git-flow
name: Custom Git Flow
version: 1.2.0
description: Project specific git branch and PR conventions
triggers: git, branch, pr, pull request
allowedTools: git_status_check, read_file
constraints:
  - Never push directly to main
  - Always run tests before PR
---
# Custom Git Workflow Instructions
Always create feature branches with prefix feat/ or fix/.
Check status using git_status_check and verify clean state.
`;

  fs.writeFileSync(path.join(skillsDir, 'git-flow.md'), sampleSkillMd, 'utf-8');

  const runtime = HarnessRuntime.createIsolated();
  const loader = runtime.projectCapabilityLoader;

  // Test 1: .nexus directory discovery
  test('Test 1: .nexus directory discovery', () => {
    const discovery = loader.discoverProjectConfig(sampleWorkspace);
    assert.strictEqual(discovery.exists, true, 'Discovery exists must be true');
    assert.strictEqual(discovery.hasMCPConfig, true, 'hasMCPConfig must be true');
    assert.strictEqual(discovery.hasSkillsDir, true, 'hasSkillsDir must be true');
    assert.strictEqual(discovery.skillFiles.length, 1, 'Should find 1 skill file');
  });

  // Test 2: Valid mcp.json load
  test('Test 2: Valid mcp.json load', () => {
    const mcpResult = loader.loadMCPConfig(sampleWorkspace);
    assert.strictEqual(mcpResult.success, true, 'mcp.json load must succeed');
    assert.strictEqual(mcpResult.servers.length, 2, 'Should load 2 servers');
    assert.strictEqual(mcpResult.servers[0].id, 'github-tools', 'First server ID must match');
    assert.strictEqual(mcpResult.servers[0].enabled, true, 'First server enabled must be true');
    assert.strictEqual(mcpResult.servers[1].enabled, false, 'Second server enabled must be false');
    assert.ok(mcpResult.configHash, 'Must generate config hash');
  });

  // Test 3: Invalid JSON handling
  test('Test 3: Invalid JSON handling returns structured error without crashing', () => {
    const badWs = path.join(baseTestDir, 'bad_json_ws');
    const badNexus = path.join(badWs, '.nexus');
    fs.mkdirSync(badNexus, { recursive: true });
    fs.writeFileSync(path.join(badNexus, 'mcp.json'), '{ invalid json ::::', 'utf-8');

    const res = loader.loadMCPConfig(badWs);
    assert.strictEqual(res.success, false, 'Load must fail for malformed JSON');
    assert.ok(res.errors.length > 0, 'Must record structured errors');
    assert.ok(res.errors[0].includes('Malformed JSON'), 'Error should describe malformed JSON');
  });

  // Test 4: Duplicate server detection
  test('Test 4: Duplicate server detection', () => {
    const dupWs = path.join(baseTestDir, 'dup_server_ws');
    const dupNexus = path.join(dupWs, '.nexus');
    fs.mkdirSync(dupNexus, { recursive: true });
    const dupConfig = {
      servers: [
        { id: 'server-1', name: 'Server 1', transport: 'in_process' },
        { id: 'server-1', name: 'Server 1 Duplicate', transport: 'in_process' },
      ],
    };
    fs.writeFileSync(path.join(dupNexus, 'mcp.json'), JSON.stringify(dupConfig), 'utf-8');

    const res = loader.loadMCPConfig(dupWs);
    assert.strictEqual(res.success, false, 'Load must fail for duplicate server IDs');
    assert.ok(res.errors.some((e) => e.includes('Duplicate server ID')), 'Must report duplicate server ID');
  });

  // Test 5: Invalid transport rejection
  test('Test 5: Invalid transport rejection', () => {
    const badTransportWs = path.join(baseTestDir, 'bad_transport_ws');
    const badNexus = path.join(badTransportWs, '.nexus');
    fs.mkdirSync(badNexus, { recursive: true });
    const badConfig = {
      servers: [
        { id: 'server-bad-trans', name: 'Bad Transport', transport: 'unsupported_socket_type' },
      ],
    };
    fs.writeFileSync(path.join(badNexus, 'mcp.json'), JSON.stringify(badConfig), 'utf-8');

    const res = loader.loadMCPConfig(badTransportWs);
    assert.strictEqual(res.success, false, 'Must reject invalid transport');
    assert.ok(res.errors.some((e) => e.includes('unsupported transport')), 'Must report unsupported transport');
  });

  // Test 6: Path traversal rejection in cwd and args
  test('Test 6: Path traversal rejection in cwd and args', () => {
    const traversalWs = path.join(baseTestDir, 'traversal_ws');
    const tNexus = path.join(traversalWs, '.nexus');
    fs.mkdirSync(tNexus, { recursive: true });
    const tConfig = {
      servers: [
        {
          id: 'server-traversal',
          name: 'Traversal Server',
          transport: 'stdio',
          command: 'node',
          cwd: '../../etc/passwd',
        },
      ],
    };
    fs.writeFileSync(path.join(tNexus, 'mcp.json'), JSON.stringify(tConfig), 'utf-8');

    const res = loader.loadMCPConfig(traversalWs);
    assert.strictEqual(res.success, false, 'Must reject path traversal in cwd');
    assert.ok(res.errors.some((e) => e.includes('escapes workspace boundary') || e.includes('path traversal')), 'Must detect path traversal');
  });

  // Test 7: Unsafe environment filtering
  test('Test 7: Unsafe environment filtering strips secrets and raw API keys', () => {
    const envWs = path.join(baseTestDir, 'env_ws');
    const envNexus = path.join(envWs, '.nexus');
    fs.mkdirSync(envNexus, { recursive: true });
    const envConfig = {
      servers: [
        {
          id: 'server-env',
          name: 'Env Server',
          transport: 'in_process',
          env: {
            OPENAI_API_KEY: 'sk-abcdef1234567890abcdef1234567890',
            DATABASE_PASSWORD: 'supersecretpass',
            SAFE_CONFIG_FLAG: 'production_mode',
          },
        },
      ],
    };
    fs.writeFileSync(path.join(envNexus, 'mcp.json'), JSON.stringify(envConfig), 'utf-8');

    const res = loader.loadMCPConfig(envWs);
    assert.strictEqual(res.success, true, 'Load succeeds with sanitized env');
    const server = res.servers[0];
    assert.strictEqual(server.env.OPENAI_API_KEY, undefined, 'OPENAI_API_KEY must be stripped');
    assert.strictEqual(server.env.DATABASE_PASSWORD, undefined, 'DATABASE_PASSWORD must be stripped');
    assert.strictEqual(server.env.SAFE_CONFIG_FLAG, 'production_mode', 'Safe env preserved');
    assert.ok(res.warnings.length >= 2, 'Should warn about filtered secrets');
  });

  // Test 8: Enabled server hydration
  await asyncTest('Test 8: Enabled server hydration starts server automatically', async () => {
    const res = await runtime.loadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(res.success, true, 'Hydration must succeed');
    assert.strictEqual(res.startedServers, 1, 'Only 1 enabled server should be started');

    const server = runtime.getMCPServer('github-tools');
    assert.ok(server, 'Server record must exist');
    assert.strictEqual(server.status, MCP_SERVER_STATUS.RUNNING, 'github-tools should be RUNNING');
  });

  // Test 9: Disabled server preservation
  test('Test 9: Disabled server preservation remains registered metadata only', () => {
    const dbServer = runtime.getMCPServer('database-mcp');
    assert.ok(dbServer, 'database-mcp server must exist');
    assert.strictEqual(dbServer.status, MCP_SERVER_STATUS.REGISTERED, 'Disabled server remains REGISTERED');
    assert.strictEqual(dbServer.enabled, false, 'Server enabled flag is false');
  });

  // Test 10: MCP tool discovery hydration into CapabilityRegistry
  test('Test 10: MCP tool discovery hydration into CapabilityRegistry', () => {
    const gitTool = runtime.getCapability('git_status_check');
    assert.ok(gitTool, 'git_status_check must be registered in CapabilityRegistry');
    assert.strictEqual(gitTool.source, 'project', 'Source must be project');
    assert.strictEqual(gitTool.type, CAPABILITY_TYPE.MCP_TOOL, 'Type must be MCP_TOOL');
  });

  // Test 11: Skills directory discovery
  test('Test 11: Skills directory discovery', () => {
    const skillsRes = loader.loadSkills(sampleWorkspace);
    assert.strictEqual(skillsRes.success, true, 'Skills load must succeed');
    assert.strictEqual(skillsRes.skills.length, 1, 'Should load 1 skill');
  });

  // Test 12: Valid skill parsing
  test('Test 12: Valid skill parsing parses metadata and instructions', () => {
    const skill = runtime.getSkill('custom-git-flow');
    assert.ok(skill, 'Skill custom-git-flow must exist');
    assert.strictEqual(skill.name, 'Custom Git Flow', 'Skill name must match');
    assert.strictEqual(skill.version, '1.2.0', 'Skill version must match');
    assert.ok(skill.triggers.includes('git'), 'Triggers should include git');
    assert.ok(skill.constraints.length >= 2, 'Constraints parsed');
    assert.ok(skill.instructions.includes('Custom Git Workflow Instructions'), 'Instructions parsed');
  });

  // Test 13: Malformed skill rejection
  test('Test 13: Malformed skill rejection (empty instructions)', () => {
    const badSkillWs = path.join(baseTestDir, 'bad_skill_ws');
    const badSkillsDir = path.join(badSkillWs, '.nexus', 'skills');
    fs.mkdirSync(badSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(badSkillsDir, 'empty.md'), '---\nname: Empty Skill\n---\n   ', 'utf-8');

    const res = loader.loadSkills(badSkillWs);
    assert.strictEqual(res.success, false, 'Must reject skill with empty instructions');
    assert.ok(res.errors.some((e) => e.includes('no instructions text')), 'Must report missing instructions');
  });

  // Test 14: Duplicate skill IDs
  test('Test 14: Duplicate skill IDs rejection', () => {
    const dupSkillWs = path.join(baseTestDir, 'dup_skill_ws');
    const dSkillsDir = path.join(dupSkillWs, '.nexus', 'skills');
    fs.mkdirSync(dSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(dSkillsDir, 's1.md'), '---\nid: same-id\nname: Skill 1\n---\nInstructions 1', 'utf-8');
    fs.writeFileSync(path.join(dSkillsDir, 's2.md'), '---\nid: same-id\nname: Skill 2\n---\nInstructions 2', 'utf-8');

    const res = loader.loadSkills(dupSkillWs);
    assert.strictEqual(res.success, false, 'Must reject duplicate skill IDs');
    assert.ok(res.errors.some((e) => e.includes('Duplicate skill ID')), 'Must report duplicate ID');
  });

  // Test 15: Skill size limit
  test('Test 15: Skill size limit rejection (>1MB)', () => {
    const hugeSkillWs = path.join(baseTestDir, 'huge_skill_ws');
    const hSkillsDir = path.join(hugeSkillWs, '.nexus', 'skills');
    fs.mkdirSync(hSkillsDir, { recursive: true });
    const hugeContent = '---\nname: Huge\n---\n' + 'A'.repeat(1024 * 1024 + 100);
    fs.writeFileSync(path.join(hSkillsDir, 'huge.md'), hugeContent, 'utf-8');

    const res = loader.loadSkills(hugeSkillWs);
    assert.strictEqual(res.success, false, 'Must reject oversize skill file');
    assert.ok(res.errors.some((e) => e.includes('exceeds max size')), 'Must report size limit exceeded');
  });

  // Test 16: Capability registry hydration
  test('Test 16: Capability registry contains both MCP tools and project skills', () => {
    const capTool = runtime.getCapability('git_status_check');
    const capSkill = runtime.getCapability('custom-git-flow');
    assert.ok(capTool, 'git_status_check capability exists');
    assert.ok(capSkill, 'custom-git-flow skill capability exists');
    assert.strictEqual(capTool.type, CAPABILITY_TYPE.MCP_TOOL);
    assert.strictEqual(capSkill.type, CAPABILITY_TYPE.SKILL);
  });

  // Test 17: Context-aware skill activation
  test('Test 17: Context-aware skill activation resolves matching project skill', () => {
    const matched = runtime.resolveSkills({ userInput: 'Please check git branch and prepare PR' });
    assert.ok(matched.some((s) => s.skillId === 'custom-git-flow'), 'custom-git-flow should be resolved on git trigger');

    const unmatched = runtime.resolveSkills({ userInput: 'What is the color of the sky?' });
    assert.ok(!unmatched.some((s) => s.skillId === 'custom-git-flow'), 'custom-git-flow should not resolve for unrelated input');
  });

  // Test 18: Hot reload of valid skill
  await asyncTest('Test 18: Hot reload of valid skill updates instructions', async () => {
    const updatedSkillMd = `---
id: custom-git-flow
name: Custom Git Flow Updated
version: 1.3.0
description: Updated git flow rules
triggers: git, branch, commit
allowedTools: git_status_check
constraints:
  - Mandatory code review before merge
---
# Updated Git Instructions
Ensure all branch commits are signed and formatted cleanly.
`;
    fs.writeFileSync(path.join(skillsDir, 'git-flow.md'), updatedSkillMd, 'utf-8');

    const reloadRes = await runtime.reloadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(reloadRes.success, true, 'Reload must succeed');

    const updatedSkill = runtime.getSkill('custom-git-flow');
    assert.strictEqual(updatedSkill.name, 'Custom Git Flow Updated', 'Skill name must update');
    assert.strictEqual(updatedSkill.version, '1.3.0', 'Skill version must update');
    assert.ok(updatedSkill.instructions.includes('Updated Git Instructions'), 'Instructions must update');
  });

  // Test 19: Hot reload of valid MCP config
  await asyncTest('Test 19: Hot reload of valid MCP config', async () => {
    const updatedMcpJson = {
      servers: [
        {
          id: 'github-tools',
          name: 'GitHub Tools v2',
          transport: 'in_process',
          enabled: true,
          riskLevel: 'SAFE',
          tools: [
            {
              name: 'git_status_check_v2',
              description: 'V2 git status check',
              riskLevel: 'SAFE',
            },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(nexusDir, 'mcp.json'), JSON.stringify(updatedMcpJson, null, 2), 'utf-8');

    const reloadRes = await runtime.reloadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(reloadRes.success, true, 'MCP reload must succeed');

    const server = runtime.getMCPServer('github-tools');
    assert.strictEqual(server.name, 'GitHub Tools v2', 'Server name must be updated');
    const newTool = runtime.getCapability('git_status_check_v2');
    assert.ok(newTool, 'New tool must be registered');
  });

  // Test 20: Failed config does not destroy active server
  await asyncTest('Test 20: Failed config does not destroy active working server', async () => {
    // Break the mcp.json syntax
    fs.writeFileSync(path.join(nexusDir, 'mcp.json'), '{ MALFORMED_JSON_CONTENT :::: }', 'utf-8');

    const reloadRes = await runtime.reloadProjectCapabilities(sampleWorkspace);
    assert.strictEqual(reloadRes.success, false, 'Reload should report failure for malformed config');

    // Working server should STILL be alive and running!
    const server = runtime.getMCPServer('github-tools');
    assert.ok(server, 'Active server must NOT be destroyed by invalid reload');
    assert.strictEqual(server.status, MCP_SERVER_STATUS.RUNNING, 'Server must remain RUNNING');
  });

  // Test 21: Persistence metadata
  test('Test 21: Persistence metadata exports safe non-secret summary', () => {
    // Restore valid config first
    fs.writeFileSync(path.join(nexusDir, 'mcp.json'), JSON.stringify(sampleMcpJson, null, 2), 'utf-8');
    const meta = runtime.getProjectPersistenceMetadata(sampleWorkspace);

    assert.strictEqual(meta.workspacePath, sampleWorkspace);
    assert.ok(Array.isArray(meta.mcpServerIds), 'mcpServerIds array present');
    assert.ok(meta.serverStatuses['github-tools'], 'Status recorded');
    assert.ok(meta.skillIds.includes('custom-git-flow'), 'Skill ID recorded');
    assert.strictEqual(meta.env, undefined, 'No secrets or env in persistence metadata');
  });

  // Test 22: Restart rehydration
  await asyncTest('Test 22: Restart rehydration re-creates capabilities cleanly', async () => {
    const newRuntime = HarnessRuntime.createIsolated();
    const hydRes = await newRuntime.loadProjectCapabilities(sampleWorkspace);

    assert.strictEqual(hydRes.success, true, 'Hydration on new runtime must succeed');
    assert.ok(newRuntime.getMCPServer('github-tools'), 'github-tools restored');
    assert.ok(newRuntime.getSkill('custom-git-flow'), 'custom-git-flow restored');
  });

  // Test 23: Subagent capability restriction on project capabilities
  test('Test 23: Subagent researcher is restricted from mutation even with project tools', () => {
    const capRegistry = runtime.capabilityRegistry;

    // Register a project mutation tool
    capRegistry.registerCapability({
      name: 'project_deploy_prod',
      description: 'Deploy project to production',
      source: 'project',
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.HIGH_RISK,
      metadata: { allowMutation: true, source: 'project' },
      execute: async () => ({ deployed: true }),
    });

    const parentCaps = capRegistry.filterCapabilitiesForTurn({
      role: 'parent',
      intent: 'MUTATION',
    });
    assert.ok(parentCaps.some((c) => c.name === 'project_deploy_prod'), 'Parent can see deploy tool');

    const researcherCaps = capRegistry.filterCapabilitiesForTurn({
      role: 'researcher',
      intent: 'READ_ONLY',
      isChild: true,
    });
    assert.ok(!researcherCaps.some((c) => c.name === 'project_deploy_prod'), 'Researcher MUST NOT see mutation tool');
  });

  // Test 24: Secret filtering on project skills and MCP tool arguments
  test('Test 24: Secret filtering on project skills and tool definitions', () => {
    const secretSkillContent = `---
id: secret-skill
name: Secret Skill
triggers: secret
---
Please use api key AIzaSyTestKey1234567890abcdefghij and token ghp_123456789012345678901234567890123456
`;
    const parsed = loader.parseSkillFrontmatter(secretSkillContent, 'secret-skill.md');
    assert.ok(!parsed.instructions.includes('AIzaSyTestKey1234567890abcdefghij'), 'API key must be redacted');
    assert.ok(parsed.instructions.includes('[REDACTED_SECRET:GEMINI_API_KEY]'), 'Redaction placeholder present');
  });

  // Test 25: Project capability events emission
  await asyncTest('Test 25: Project capability events emission', async () => {
    const events = [];
    const unsubscribe = runtime.subscribe((evt) => {
      if (evt.type.startsWith('PROJECT_') || evt.type.startsWith('MCP_CONFIG_') || evt.type.startsWith('SKILL_')) {
        events.push(evt);
      }
    });

    await runtime.loadProjectCapabilities(sampleWorkspace);
    unsubscribe();

    assert.ok(events.length > 0, 'Events must be emitted');
    const eventTypes = events.map((e) => e.type);
    assert.ok(eventTypes.includes(EVENT_TYPES.PROJECT_CAPABILITIES_DISCOVERED), 'PROJECT_CAPABILITIES_DISCOVERED emitted');
  });

  // Test 26: Nonexistent .nexus directory behaves cleanly
  await asyncTest('Test 26: Nonexistent .nexus directory behaves cleanly without errors', async () => {
    const emptyWs = path.join(baseTestDir, 'empty_workspace_' + Date.now());
    fs.mkdirSync(emptyWs, { recursive: true });

    const discovery = loader.discoverProjectConfig(emptyWs);
    assert.strictEqual(discovery.exists, false, 'Discovery exists is false');

    const res = await runtime.loadProjectCapabilities(emptyWs);
    assert.strictEqual(res.success, true, 'Load must succeed cleanly');
    assert.strictEqual(res.serverCount, 0, '0 servers');
    assert.strictEqual(res.skillCount, 0, '0 skills');
    assert.strictEqual(res.errors.length, 0, '0 errors');
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runProjectCapabilityTests().catch((err) => {
  console.error('[FATAL] Test runner crashed:', err);
  process.exit(1);
});
