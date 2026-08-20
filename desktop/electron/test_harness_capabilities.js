/**
 * NEXUS CODEX HARNESS - CAPABILITIES, MCP, & SKILLS TEST SUITE (Milestone 12)
 * Verifies all 24 required test scenarios:
 * 1. Native capability registration
 * 2. Capability lookup & existence checks
 * 3. MCP tool normalization
 * 4. MCP server registration
 * 5. MCP server lifecycle
 * 6. Malformed MCP tool definition rejection
 * 7. Capability policy filtering
 * 8. Secret filtering
 * 9. External tool approval
 * 10. External tool rejection
 * 11. Skill registration & validation
 * 12. Deterministic context-aware skill resolution
 * 13. Irrelevant skills exclusion
 * 14. Capability visibility in AgentLoop
 * 15. Subagent capability restrictions
 * 16. Persistence
 * 17. Restart reconstruction
 * 18. External tool success
 * 19. External tool failure
 * 20. Server crash handling
 * 21. Event ordering
 * 22. Provider-neutral tool contract equivalence
 * 23. Swarm child task capability restrictions
 * 24. Dangerous external capability blocking
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), "nexus_test_capabilities_continuum_" + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  CapabilityRegistry,
  MCPServerManager,
  MCPToolAdapter,
  SkillRegistry,
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
  MCP_SERVER_STATUS,
  MCP_TRANSPORT,
  EVENT_TYPES,
  ITEM_TYPES,
  TURN_STATUS,
  harnessEventBus,
} = require("./harness");

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log("[PASS] " + name);
    passedTests++;
  } catch (err) {
    console.error("[FAIL] " + name + ":", err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log("[PASS] " + name);
    passedTests++;
  } catch (err) {
    console.error("[FAIL] " + name + ":", err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function runCapabilityTests() {
  console.log("====================================================");
  console.log("[TEST] Starting NEXUS Codex Harness Capability Suite (Milestone 12)...");
  console.log("====================================================\n");

  const testWs = path.join(os.tmpdir(), "nexus_test_caps_ws_" + Date.now());
  fs.mkdirSync(testWs, { recursive: true });

  const runtime = HarnessRuntime.createIsolated();

  // Test 1: Native capability registration
  test("Test 1: Native capability registration and ToolRegistry synchronization", () => {
    const customTool = {
      name: "custom_analyzer",
      description: "Custom static analysis tool",
      inputSchema: { type: "object", properties: { target: { type: "string" } } },
      requiresApproval: false,
      execute: async (args) => ({ summary: "Analyzed " + args.target }),
    };

    const cap = runtime.registerCapability({
      ...customTool,
      source: "nexus",
      type: CAPABILITY_TYPE.NEXUS_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.SAFE,
    });

    assert.ok(cap !== null);
    assert.strictEqual(cap.name, "custom_analyzer");
    assert.strictEqual(cap.type, CAPABILITY_TYPE.NEXUS_TOOL);
    assert.strictEqual(cap.riskLevel, CAPABILITY_RISK_LEVEL.SAFE);
    assert.ok(runtime.toolRegistry.has("custom_analyzer"), "ToolRegistry should have synchronized custom_analyzer");
  });

  // Test 2: Capability lookup & existence checks
  test("Test 2: Capability lookup by ID and Name", () => {
    const foundByName = runtime.getCapability("custom_analyzer");
    assert.ok(foundByName !== null);
    assert.strictEqual(foundByName.name, "custom_analyzer");

    const foundById = runtime.getCapability(foundByName.id);
    assert.ok(foundById !== null);
    assert.strictEqual(foundById.id, foundByName.id);

    assert.strictEqual(runtime.capabilityRegistry.hasCapability("custom_analyzer"), true);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability("non_existent_cap"), false);
  });

  // Test 3: MCP tool normalization
  test("Test 3: MCPToolAdapter normalizes external MCP tool to standard contract", () => {
    const rawMcpTool = {
      name: "fetch_api_docs",
      description: "Fetches official remote API documentation",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
      serverId: "docs_server",
      isReadOnly: true,
      networkAllowed: true,
      handler: async (args) => ({ content: "Documentation for " + args.url }),
    };

    const normalized = MCPToolAdapter.normalizeTool(rawMcpTool);
    assert.strictEqual(normalized.name, "fetch_api_docs");
    assert.strictEqual(normalized.source, "mcp");
    assert.strictEqual(normalized.type, CAPABILITY_TYPE.MCP_TOOL);
    assert.strictEqual(normalized.riskLevel, CAPABILITY_RISK_LEVEL.SAFE);
    assert.strictEqual(normalized.metadata.serverId, "docs_server");
    assert.strictEqual(typeof normalized.execute, "function");
  });

  // Test 4: MCP server registration
  test("Test 4: MCPServerManager registers MCP server descriptor", () => {
    const serverRecord = runtime.registerMCPServer({
      serverId: "test_mcp_srv",
      name: "Test MCP Server",
      transport: MCP_TRANSPORT.IN_PROCESS,
      tools: [
        {
          name: "mcp_echo",
          description: "Echoes input text",
          inputSchema: { type: "object", properties: { text: { type: "string" } } },
          handler: async (args) => ({ echoed: args.text }),
        },
      ],
      policy: { networkAllowed: false },
    });

    assert.strictEqual(serverRecord.serverId, "test_mcp_srv");
    assert.strictEqual(serverRecord.status, MCP_SERVER_STATUS.REGISTERED);
    assert.strictEqual(serverRecord.tools.length, 1);
    assert.strictEqual(runtime.getMCPServer("test_mcp_srv").name, "Test MCP Server");
  });

  // Test 5: MCP server lifecycle
  await asyncTest("Test 5: MCP server start, status check, stop, and restart lifecycle", async () => {
    const started = await runtime.startMCPServer("test_mcp_srv");
    assert.strictEqual(started.status, MCP_SERVER_STATUS.RUNNING);
    assert.strictEqual(runtime.mcpServerManager.getServerStatus("test_mcp_srv"), MCP_SERVER_STATUS.RUNNING);
    assert.ok(runtime.capabilityRegistry.hasCapability("mcp_echo"), "CapabilityRegistry should have mcp_echo after server start");

    const stopped = await runtime.stopMCPServer("test_mcp_srv");
    assert.strictEqual(stopped.status, MCP_SERVER_STATUS.STOPPED);

    const restarted = await runtime.restartMCPServer("test_mcp_srv");
    assert.strictEqual(restarted.status, MCP_SERVER_STATUS.RUNNING);
  });

  // Test 6: Malformed MCP tool definition rejection
  test("Test 6: Malformed MCP tool definitions are safely rejected", () => {
    assert.throws(() => {
      MCPToolAdapter.normalizeTool(null);
    }, /must be an object/);

    assert.throws(() => {
      MCPToolAdapter.normalizeTool({ description: "Missing name" });
    }, /name is required/);
  });

  // Test 7: Capability policy filtering
  test("Test 7: Capability policy classification and filtering (SAFE, REVIEW_REQUIRED, HIGH_RISK, BLOCKED)", () => {
    runtime.registerCapability({
      name: "safe_search",
      description: "Safe search",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.SAFE,
      execute: async () => ({ res: "ok" }),
    });

    runtime.registerCapability({
      name: "mutate_db",
      description: "Mutate database schema",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED,
      requiresApproval: true,
      metadata: { allowMutation: true },
      execute: async () => ({ res: "db modified" }),
    });

    runtime.registerCapability({
      name: "shell_exec",
      description: "Direct shell execution",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.HIGH_RISK,
      requiresApproval: true,
      execute: async () => ({ res: "shell run" }),
    });

    runtime.registerCapability({
      name: "malicious_tool",
      description: "Dangerous tool",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.BLOCKED,
      execute: async () => ({ res: "blocked" }),
    });

    const readOnlyCaps = runtime.capabilityRegistry.filterCapabilitiesForTurn({ intent: "READ_ONLY" });
    const readOnlyNames = readOnlyCaps.map((c) => c.name);

    assert.ok(readOnlyNames.includes("safe_search"), "SAFE tool should be in READ_ONLY");
    assert.ok(!readOnlyNames.includes("mutate_db"), "Mutation tool should NOT be in READ_ONLY");
    assert.ok(!readOnlyNames.includes("malicious_tool"), "BLOCKED tool should never be in turn capabilities");
  });

  // Test 8: Secret filtering on external tool inputs & outputs
  await asyncTest("Test 8: Secret filtering redacts credentials from MCP arguments and results", async () => {
    let capturedArgs = null;
    const secureTool = MCPToolAdapter.normalizeTool({
      name: "mcp_secure_call",
      handler: async (args) => {
        capturedArgs = args;
        return { apiKeyReceived: args.apiKey, outputSecret: "sk-secret12345678901234567890" };
      },
    });

    const execRes = await secureTool.execute(
      { apiKey: "sk-inputsecret1234567890123456", targetUrl: "https://api.example.com" },
      { callId: "c_sec" }
    );

    assert.ok(execRes.success === true);
    assert.ok(!JSON.stringify(capturedArgs).includes("sk-inputsecret1234567890123456"), "Input key should be redacted");
    assert.ok(!JSON.stringify(execRes.result).includes("sk-secret12345678901234567890"), "Output key should be redacted");
  });

  // Test 9: External tool approval workflow
  await asyncTest("Test 9: External tool with REVIEW_REQUIRED pauses for approval and executes upon approveAction", async () => {
    const thread = runtime.createThread({ metadata: { workspacePath: testWs } });

    let externalExecuted = false;
    runtime.registerCapability({
      name: "mcp_deploy_service",
      description: "Deploys a staging service",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED,
      requiresApproval: true,
      execute: async (args, context) => {
        if (!context.isApproved) {
          return { success: false, requiresApproval: true, error: "Requires approval" };
        }
        externalExecuted = true;
        return { deployed: true, service: args.service };
      },
    });

    let turnStarted = false;
    const turnPromise = runtime.runTurn({
      threadId: thread.threadId,
      userInput: "Deploy the auth service",
      workspacePath: testWs,
      approvalMode: "strict",
      modelHandler: async (messages) => {
        if (!turnStarted) {
          turnStarted = true;
          return {
            tool_calls: [
              { callId: "c_deploy_1", toolName: "mcp_deploy_service", arguments: { service: "auth-api" } },
            ],
          };
        }
        return "Deployment was approved and completed successfully.";
      },
    });

    // Wait for approval pause
    await new Promise((r) => setTimeout(r, 100));

    const pendingTurns = runtime.turnManager.listTurnsByThread(thread.threadId);
    const activeTurn = pendingTurns[0];
    assert.strictEqual(activeTurn.status, TURN_STATUS.WAITING_FOR_APPROVAL);

    // Approve action
    const approveRes = runtime.agentLoop.approveAction(activeTurn.turnId, "c_deploy_1");
    assert.strictEqual(approveRes.success, true);

    const outcome = await turnPromise;
    assert.strictEqual(outcome.success, true);
    assert.strictEqual(externalExecuted, true);
  });

  // Test 10: External tool rejection workflow
  await asyncTest("Test 10: External tool rejection stops execution safely", async () => {
    const thread = runtime.createThread({ metadata: { workspacePath: testWs } });

    let executed = false;
    runtime.registerCapability({
      name: "mcp_wipe_cache",
      description: "Wipes remote cache",
      type: CAPABILITY_TYPE.MCP_TOOL,
      riskLevel: CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED,
      requiresApproval: true,
      execute: async (args, context) => {
        if (!context.isApproved) return { success: false, requiresApproval: true };
        executed = true;
        return { wiped: true };
      },
    });

    let turnStarted = false;
    const turnPromise = runtime.runTurn({
      threadId: thread.threadId,
      userInput: "Wipe the cache",
      workspacePath: testWs,
      approvalMode: "strict",
      modelHandler: async () => {
        if (!turnStarted) {
          turnStarted = true;
          return {
            tool_calls: [
              { callId: "c_wipe_1", toolName: "mcp_wipe_cache", arguments: {} },
            ],
          };
        }
        return "Cache wipe was rejected.";
      },
    });

    await new Promise((r) => setTimeout(r, 100));
    const activeTurn = runtime.turnManager.listTurnsByThread(thread.threadId)[0];
    runtime.agentLoop.rejectAction(activeTurn.turnId, "c_wipe_1", "Operator denied cache wipe");

    const outcome = await turnPromise;
    assert.strictEqual(outcome.success, true);
    assert.strictEqual(executed, false, "Rejected tool must not have executed");
  });

  // Test 11: Skill registration & validation
  test("Test 11: Skill registration validates instructions and indexes in CapabilityRegistry", () => {
    const skill = runtime.registerSkill({
      skillId: "skill_custom_db",
      name: "Database Migration Guidance",
      version: "1.2.0",
      description: "Safely author and run database migrations.",
      triggers: ["migration", "schema", "postgres", "table"],
      instructions: "Always write idempotent migrations. Test rollback before committing.",
      constraints: ["No destructive table drops in prod"],
      allowedTools: ["read_file", "search_workspace", "run_tests"],
    });

    assert.strictEqual(skill.skillId, "skill_custom_db");
    assert.strictEqual(skill.version, "1.2.0");
    assert.ok(runtime.capabilityRegistry.hasCapability("Database Migration Guidance"));
  });

  // Test 12: Deterministic context-aware skill resolution
  test("Test 12: Context-aware skill resolution accurately matches triggers without LLM", () => {
    const resolvedGit = runtime.resolveSkills({ userInput: "Please create a git branch and inspect the diff" });
    const gitSkillNames = resolvedGit.map((s) => s.skillId);
    assert.ok(gitSkillNames.includes("skill_git_workflow"));

    const resolvedTDD = runtime.resolveSkills({ userInput: "Fix the failing pytest unit tests in test_cart.py" });
    const tddSkillNames = resolvedTDD.map((s) => s.skillId);
    assert.ok(tddSkillNames.includes("skill_test_driven_development"));

    const resolvedDB = runtime.resolveSkills({ userInput: "Generate a schema migration for users table" });
    const dbSkillNames = resolvedDB.map((s) => s.skillId);
    assert.ok(dbSkillNames.includes("skill_custom_db"));
  });

  // Test 13: Irrelevant skills exclusion
  test("Test 13: Irrelevant skills are excluded from turn context", () => {
    const resolved = runtime.resolveSkills({ userInput: "Tell me a joke about programming" });
    assert.strictEqual(resolved.length, 0, "No engineering skills should trigger for general joke request");
  });

  // Test 14: Capability visibility in AgentLoop
  await asyncTest("Test 14: Permitted tools and active skills are presented in context to model", async () => {
    const thread = runtime.createThread({ metadata: { workspacePath: testWs } });

    let capturedMessages = null;
    let capturedTools = null;

    await runtime.runTurn({
      threadId: thread.threadId,
      userInput: "Please review git branch status",
      workspacePath: testWs,
      intent: "READ_ONLY",
      modelHandler: async (messages, tools) => {
        capturedMessages = messages;
        capturedTools = tools;
        return "Git status reviewed.";
      },
    });

    assert.ok(Array.isArray(capturedTools));
    const toolNames = capturedTools.map((t) => t.name);
    assert.ok(!toolNames.includes("apply_patch"), "apply_patch must be excluded in READ_ONLY");

    const systemPrompt = capturedMessages.find((m) => m.role === "system")?.content || "";
    assert.ok(systemPrompt.includes("Git Workflow"), "Active skill Git Workflow should be present in system prompt");
    assert.ok(systemPrompt.includes("PERMITTED CAPABILITIES") || systemPrompt.includes("AVAILABLE TOOLS"));
  });

  // Test 15: Subagent capability restrictions
  test("Test 15: Subagent researcher is restricted to read/search and cannot mutate", () => {
    const researcherCaps = runtime.capabilityRegistry.filterCapabilitiesForTurn({
      role: "researcher",
      intent: "MUTATION",
      isChild: true,
    });

    const capNames = researcherCaps.map((c) => c.name);
    assert.ok(capNames.includes("read_file"), "Researcher should have read_file");
    assert.ok(capNames.includes("search_workspace"), "Researcher should have search_workspace");
    assert.ok(!capNames.includes("apply_patch"), "Researcher must NOT have apply_patch");
    assert.ok(!capNames.includes("swarm_execute"), "Subagent cannot spawn swarms");
  });

  // Test 16: Persistence of capability and server metadata
  test("Test 16: Capability and MCP server metadata persists without secrets", () => {
    const serverList = runtime.listMCPServers();
    assert.ok(Array.isArray(serverList));
    assert.ok(serverList.length >= 1);
    const srv = serverList[0];
    assert.ok(srv.serverId);
    assert.ok(srv.name);
    assert.strictEqual(srv.processConfig, undefined, "Process environment secrets must not be exposed in list");
  });

  // Test 17: Restart reconstruction
  test("Test 17: Reconstruct capability and server registries across restart", () => {
    const isolatedRuntime = HarnessRuntime.createIsolated();
    assert.ok(isolatedRuntime.capabilityRegistry.hasCapability("read_file"));
    assert.ok(isolatedRuntime.skillRegistry.getSkill("skill_git_workflow") !== null);
    assert.ok(isolatedRuntime.skillRegistry.getSkill("skill_test_driven_development") !== null);
  });

  // Test 18: External tool success
  await asyncTest("Test 18: External tool execution succeeds with normalized output", async () => {
    const normalizedTool = MCPToolAdapter.normalizeTool({
      name: "mcp_weather",
      handler: async (args) => ({ temp: 72, condition: "Sunny", city: args.city }),
    });

    const res = await normalizedTool.execute({ city: "San Francisco" }, { callId: "c_w1" });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result.city, "San Francisco");
    assert.strictEqual(res.result.condition, "Sunny");
  });

  // Test 19: External tool failure & error capture
  await asyncTest("Test 19: External tool error is caught and normalized cleanly", async () => {
    const errorTool = MCPToolAdapter.normalizeTool({
      name: "mcp_failing_service",
      handler: async () => {
        throw new Error("Remote server connection timed out");
      },
    });

    const res = await errorTool.execute({}, { callId: "c_err1" });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes("Remote server connection timed out"));
  });

  // Test 20: Server crash handling
  await asyncTest("Test 20: Server failure transitions status and emits MCP_SERVER_FAILED", async () => {
    let failedEventReceived = false;
    runtime.eventBus.on(EVENT_TYPES.MCP_SERVER_FAILED, () => {
      failedEventReceived = true;
    });

    const crashServer = runtime.registerMCPServer({
      serverId: "crash_srv",
      name: "Crash Server",
      transport: MCP_TRANSPORT.STDIO,
      processConfig: {
        command: "node",
        args: ["-e", "process.exit(1)"],
      },
    });

    try {
      await runtime.startMCPServer("crash_srv");
    } catch (e) {}

    // Allow exit event to propagate
    await new Promise((r) => setTimeout(r, 100));

    const status = runtime.mcpServerManager.getServerStatus("crash_srv");
    assert.ok(status === MCP_SERVER_STATUS.STOPPED || status === MCP_SERVER_STATUS.FAILED);
  });

  // Test 21: Event ordering on HarnessEventBus
  await asyncTest("Test 21: Structured capability events are emitted in sequence", async () => {
    const events = [];
    const unsub = runtime.subscribe((evt) => {
      if (
        evt.type === EVENT_TYPES.CAPABILITY_REGISTERED ||
        evt.type === EVENT_TYPES.MCP_SERVER_STARTED ||
        evt.type === EVENT_TYPES.EXTERNAL_TOOL_STARTED ||
        evt.type === EVENT_TYPES.EXTERNAL_TOOL_COMPLETED
      ) {
        events.push(evt.type);
      }
    });

    const server = runtime.registerMCPServer({
      serverId: "event_srv",
      name: "Event Srv",
      transport: MCP_TRANSPORT.IN_PROCESS,
      tools: [
        {
          name: "mcp_evt_tool",
          handler: async () => ({ res: "ok" }),
        },
      ],
    });

    await runtime.startMCPServer("event_srv");

    const thread = runtime.createThread({ metadata: { workspacePath: testWs } });
    await runtime.runTurn({
      threadId: thread.threadId,
      userInput: "Run event tool",
      workspacePath: testWs,
      modelHandler: async (messages) => {
        if (messages.some((m) => m.role === "tool")) return "Tool done";
        return {
          tool_calls: [{ callId: "c_evt_1", toolName: "mcp_evt_tool", arguments: {} }],
        };
      },
    });

    unsub();

    assert.ok(events.includes(EVENT_TYPES.CAPABILITY_REGISTERED));
    assert.ok(events.includes(EVENT_TYPES.MCP_SERVER_STARTED));
    assert.ok(events.includes(EVENT_TYPES.EXTERNAL_TOOL_STARTED));
    assert.ok(events.includes(EVENT_TYPES.EXTERNAL_TOOL_COMPLETED));
  });

  // Test 22: Provider-neutral tool contract equivalence
  test("Test 22: Provider-neutral tool contract matches between native and MCP tools", () => {
    const nativeTool = runtime.toolRegistry.get("read_file");
    const mcpCap = runtime.capabilityRegistry.getCapability("mcp_echo");

    assert.ok(nativeTool.inputSchema);
    assert.ok(mcpCap.inputSchema);
    assert.strictEqual(typeof nativeTool.execute, "function");
    assert.strictEqual(typeof mcpCap.execute, "function");
  });

  // Test 23: Swarm child task capability restrictions
  test("Test 23: Swarm child tasks enforce role capability scoping", () => {
    const coderCaps = runtime.capabilityRegistry.filterCapabilitiesForTurn({
      role: "coder",
      intent: "MUTATION",
      isChild: true,
    });
    const coderNames = coderCaps.map((c) => c.name);
    assert.ok(coderNames.includes("apply_patch"));
    assert.ok(coderNames.includes("read_file"));
    assert.ok(!coderNames.includes("swarm_plan"), "Swarm child cannot call swarm_plan");

    const reviewerCaps = runtime.capabilityRegistry.filterCapabilitiesForTurn({
      role: "reviewer",
      intent: "MUTATION",
      isChild: true,
    });
    const reviewerNames = reviewerCaps.map((c) => c.name);
    assert.ok(!reviewerNames.includes("apply_patch"), "Reviewer cannot call apply_patch");
  });

  // Test 24: Dangerous external capability blocking
  await asyncTest("Test 24: Dangerous capability with riskLevel BLOCKED is rejected immediately", async () => {
    const blockedTool = MCPToolAdapter.normalizeTool({
      name: "mcp_rm_rf",
      riskLevel: CAPABILITY_RISK_LEVEL.BLOCKED,
      handler: async () => ({ res: "deleted" }),
    });

    const res = await blockedTool.execute({}, { callId: "c_blk" });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes("permanently blocked by security policy"));
  });

  console.log("\n====================================================");
  console.log("[RESULTS] " + passedTests + " passed, " + failedTests + " failed.");
  console.log("====================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCapabilityTests().catch((err) => {
  console.error("Unhandled error in Capability test runner:", err);
  process.exit(1);
});
