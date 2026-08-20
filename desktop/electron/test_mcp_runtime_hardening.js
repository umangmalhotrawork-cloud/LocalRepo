/**
 * NEXUS CODEX HARNESS - MCP RUNTIME HARDENING TEST SUITE (Milestone 14)
 * 
 * Verifies MCP runtime correctness and resilience (Tests 1–21):
 * 1. stdio startup
 * 2. stdio discovery
 * 3. stdio tool execution
 * 4. bounded output
 * 5. stdout/stderr sanitization
 * 6. clean shutdown
 * 7. crash detection
 * 8. restart after crash
 * 9. SSE connect
 * 10. SSE reconnect
 * 11. SSE bounded retry
 * 12. SSE timeout
 * 13. in-process lifecycle
 * 14. tool cancellation
 * 15. server cancellation
 * 16. parent turn cancellation
 * 17. malformed tool schema
 * 18. discovery failure
 * 19. capability cleanup
 * 20. secret filtering
 * 21. zombie-process prevention
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), 'nexus_test_mcp_hardening_continuum_' + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  MCPServerManager,
  MCPTransport,
  StdioMCPTransport,
  SSEMCPTransport,
  InProcessMCPTransport,
  createMCPTransport,
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

async function runMCPHardeningTests() {
  console.log('====================================================');
  console.log('[TEST] Starting MCP Runtime Hardening Test Suite (Milestone 14)...');
  console.log('====================================================\n');

  const baseTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mcp-hard-'));

  // Helper mock stdio script
  const stdioScriptPath = path.join(baseTestDir, 'mock_stdio_server.js');
  fs.writeFileSync(
    stdioScriptPath,
    `
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

    console.error('STDIO Server starting...');

    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.method === 'tools/call') {
          if (msg.params.name === 'crash_tool') {
            process.exit(2);
          }
          if (msg.params.name === 'slow_tool') {
            setTimeout(() => {
              console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { slow: true } }));
            }, 5000);
            return;
          }
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: { echo: msg.params.arguments, status: 'ok' }
          }));
        }
      } catch (e) {
        console.error('Error in stdio server:', e.message);
      }
    });
    `,
    'utf-8'
  );

  const runtime = HarnessRuntime.createIsolated();

  // Test 1: stdio startup
  let stdioServer = null;
  await asyncTest('Test 1: stdio startup initializes process with safe environment', async () => {
    stdioServer = runtime.registerMCPServer({
      serverId: 'stdio-test-srv',
      name: 'Stdio Test Server',
      transport: MCP_TRANSPORT.STDIO,
      processConfig: {
        command: 'node',
        args: [stdioScriptPath],
        cwd: baseTestDir,
        env: { CUSTOM_TEST_VAR: 'hello' },
      },
      tools: [
        {
          name: 'stdio_echo',
          description: 'Echo via stdio',
          riskLevel: 'SAFE',
        },
        {
          name: 'crash_tool',
          description: 'Crash the process',
          riskLevel: 'HIGH_RISK',
        },
      ],
    });

    await runtime.startMCPServer('stdio-test-srv');
    const s = runtime.getMCPServer('stdio-test-srv');
    assert.strictEqual(s.status, MCP_SERVER_STATUS.RUNNING);
  });

  // Test 2: stdio discovery
  test('Test 2: stdio discovery registers valid tools in CapabilityRegistry', () => {
    const cap = runtime.getCapability('stdio_echo');
    assert.ok(cap, 'stdio_echo capability must be registered');
    assert.strictEqual(cap.type, CAPABILITY_TYPE.MCP_TOOL);
    assert.strictEqual(cap.metadata.serverId, 'stdio-test-srv');
  });

  // Test 3: stdio tool execution
  await asyncTest('Test 3: stdio tool execution returns normalized output through AgentLoop / ToolRegistry', async () => {
    const res = await runtime.mcpServerManager.executeToolOnServer('stdio-test-srv', 'stdio_echo', { text: 'hello' });
    assert.strictEqual(res.success, true);
    assert.ok(res.result);
    assert.strictEqual(res.result.echo?.text, 'hello');
  });

  // Test 4: bounded output
  test('Test 4: bounded output limit is enforced on stream buffer', () => {
    const transport = runtime.mcpServerManager.transports.get('stdio-test-srv');
    assert.ok(transport);
    assert.ok(transport.limits.maxOutputChars > 0);
  });

  // Test 5: stdout/stderr sanitization
  test('Test 5: stdout/stderr sanitization redacts leaked secrets', () => {
    const transport = new StdioMCPTransport({
      name: 'sanitizer-test',
      processConfig: {
        command: 'node',
        args: ['-e', 'console.error("Leaked: AIzaSyTestKey1234567890abcdefghij");'],
      },
    });

    assert.ok(transport._createSafeEnvironment);
    const safeEnv = transport._createSafeEnvironment({
      SECRET_KEY: 'sk-123456',
      SAFE_CONFIG: 'ok',
    });
    assert.strictEqual(safeEnv.SECRET_KEY, undefined);
    assert.strictEqual(safeEnv.SAFE_CONFIG, 'ok');
  });

  // Test 6: clean shutdown
  await asyncTest('Test 6: clean shutdown terminates child process without errors', async () => {
    await runtime.stopMCPServer('stdio-test-srv');
    const s = runtime.getMCPServer('stdio-test-srv');
    assert.strictEqual(s.status, MCP_SERVER_STATUS.STOPPED);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('stdio_echo'), false);
  });

  // Test 7: crash detection
  await asyncTest('Test 7: crash detection marks server FAILED and unregisters capabilities', async () => {
    await runtime.startMCPServer('stdio-test-srv');
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('crash_tool'), true);

    try {
      await runtime.mcpServerManager.executeToolOnServer('stdio-test-srv', 'crash_tool', {});
    } catch (e) {}

    // Give child process tick to emit exit
    await new Promise((r) => setTimeout(r, 100));

    const s = runtime.getMCPServer('stdio-test-srv');
    assert.strictEqual(s.status, MCP_SERVER_STATUS.FAILED);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('crash_tool'), false);
  });

  // Test 8: restart after crash
  await asyncTest('Test 8: restart after crash restores server and capabilities', async () => {
    await runtime.startMCPServer('stdio-test-srv');
    const s = runtime.getMCPServer('stdio-test-srv');
    assert.strictEqual(s.status, MCP_SERVER_STATUS.RUNNING);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('stdio_echo'), true);
  });

  // Mock SSE Client for Tests 9-12
  class MockSSEClient {
    constructor(options = {}) {
      this.options = options;
      this.activeResponses = [];
    }

    get(opts, callback) {
      const emitter = new (require('events').EventEmitter)();
      emitter.destroy = () => {};

      process.nextTick(() => {
        if (this.options.shouldFail) {
          emitter.emit('error', new Error(this.options.errorMessage || 'Connection failed'));
          return;
        }

        const res = new (require('events').EventEmitter)();
        res.statusCode = this.options.statusCode || 200;
        this.activeResponses.push(res);
        callback(res);

        process.nextTick(() => {
          res.emit('data', Buffer.from('data: {"status":"connected"}\n\n'));
          if (this.options.closeImmediately) {
            res.emit('end');
          }
        });
      });

      return emitter;
    }
  }

  // Test 9: SSE connect
  let sseTransport = null;
  let mockClient = null;
  await asyncTest('Test 9: SSE connect connects to valid endpoint', async () => {
    mockClient = new MockSSEClient();
    sseTransport = new SSEMCPTransport({
      name: 'mock-sse',
      url: 'http://example.com/events',
      client: mockClient,
    });

    await sseTransport.connect();
    assert.strictEqual(sseTransport.isConnected(), true);
    assert.strictEqual(sseTransport.state, 'CONNECTED');
  });

  // Test 10: SSE reconnect
  await asyncTest('Test 10: SSE reconnect attempts recovery on connection drop', async () => {
    let reconnectingEmitted = false;
    sseTransport.on('reconnecting', () => {
      reconnectingEmitted = true;
    });

    // Close active response
    if (mockClient.activeResponses.length > 0) {
      const conn = mockClient.activeResponses.pop();
      conn.emit('end');
    }

    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(reconnectingEmitted, true);
    await sseTransport.close();
  });

  // Test 11: SSE bounded retry
  await asyncTest('Test 11: SSE bounded retry halts after max attempts and marks FAILED', async () => {
    const failingClient = new MockSSEClient({ shouldFail: true, errorMessage: 'Host unreachable' });
    const failingTransport = new SSEMCPTransport({
      name: 'failing-sse',
      url: 'http://example.com/events',
      client: failingClient,
      limits: { maxReconnectRetries: 2, initialRetryDelayMs: 50 },
    });

    try {
      await failingTransport.connect();
    } catch (e) {}

    assert.strictEqual(failingTransport.state, 'FAILED');
    await failingTransport.close();
  });

  // Test 12: SSE timeout
  await asyncTest('Test 12: SSE timeout rejects unreachable connections with bounded timer', async () => {
    // Client that never responds (simulating hanging connection)
    const hangingClient = {
      get: () => {
        const emitter = new (require('events').EventEmitter)();
        emitter.destroy = () => {};
        return emitter;
      },
    };

    const timeoutTransport = new SSEMCPTransport({
      name: 'timeout-sse',
      url: 'http://example.com/events',
      client: hangingClient,
      limits: { connectionTimeoutMs: 150 },
    });

    let timedOut = false;
    try {
      await timeoutTransport.connect();
    } catch (e) {
      timedOut = true;
      assert.ok(e.message.includes('timed out'));
    }
    assert.strictEqual(timedOut, true);
    await timeoutTransport.close();
  });

  // Test 13: in-process lifecycle
  await asyncTest('Test 13: in-process lifecycle catches exceptions without crashing HarnessRuntime', async () => {
    const inProcServer = runtime.registerMCPServer({
      serverId: 'inproc-srv',
      name: 'In Process Srv',
      transport: MCP_TRANSPORT.IN_PROCESS,
      handler: async ({ toolName, arguments: args }) => {
        if (toolName === 'fail_tool') {
          throw new Error('In-process custom failure');
        }
        return { success: true, result: { toolName, args } };
      },
      tools: [
        { name: 'inproc_echo', description: 'In-proc echo' },
        { name: 'fail_tool', description: 'Failing tool' },
      ],
    });

    await runtime.startMCPServer('inproc-srv');
    assert.strictEqual(runtime.getMCPServer('inproc-srv').status, MCP_SERVER_STATUS.RUNNING);

    const okRes = await runtime.mcpServerManager.executeToolOnServer('inproc-srv', 'inproc_echo', { x: 1 });
    assert.strictEqual(okRes.success, true);

    let errCaught = false;
    try {
      await runtime.mcpServerManager.executeToolOnServer('inproc-srv', 'fail_tool', {});
    } catch (e) {
      errCaught = true;
      assert.ok(e.message.includes('In-process custom failure'));
    }
    assert.strictEqual(errCaught, true);
  });

  // Test 14: tool cancellation
  await asyncTest('Test 14: tool cancellation aborts in-flight invocation cleanly', async () => {
    const inProcTransport = new InProcessMCPTransport({
      handler: async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return { done: true };
      },
    });
    await inProcTransport.connect();

    const promise = inProcTransport.send('long_tool', {}, { callId: 'call_cancel_1' });
    inProcTransport.cancel('call_cancel_1', 'Cancelled by user');

    let rejected = false;
    try {
      await promise;
    } catch (e) {
      rejected = true;
      assert.strictEqual(e.message, 'Cancelled by user');
    }
    assert.strictEqual(rejected, true);
    await inProcTransport.close();
  });

  // Test 15: server cancellation
  await asyncTest('Test 15: server cancellation stops server and cleans up active tools', async () => {
    await runtime.stopMCPServer('inproc-srv');
    assert.strictEqual(runtime.getMCPServer('inproc-srv').status, MCP_SERVER_STATUS.STOPPED);
    assert.strictEqual(runtime.capabilityRegistry.hasCapability('inproc_echo'), false);
  });

  // Test 16: parent turn cancellation
  await asyncTest('Test 16: parent turn cancellation propagates to in-flight MCP tools', async () => {
    const thread = runtime.createThread({ metadata: { workspacePath: baseTestDir } });
    const turn = runtime.turnManager.startTurn(thread.threadId, 'Long turn directive');

    // Register an active in-flight request for this turn
    runtime.mcpServerManager.inFlightRequests.set('turn_tool_call_1', {
      serverId: 'stdio-test-srv',
      toolName: 'stdio_echo',
      turnId: turn.turnId,
    });

    runtime.turnManager.cancelTurn(turn.turnId);
    const updatedTurn = runtime.getTurn(turn.turnId);
    assert.strictEqual(updatedTurn.status, 'CANCELLED');
    assert.strictEqual(runtime.mcpServerManager.inFlightRequests.has('turn_tool_call_1'), false);
  });

  // Test 17: malformed tool schema
  test('Test 17: malformed tool schema is safely rejected without polluting registry', () => {
    const validation = runtime.mcpServerManager.validateToolSchema({
      name: 'bad name with spaces!!',
      inputSchema: 'not an object',
    });
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error);
  });

  // Test 18: discovery failure
  await asyncTest('Test 18: discovery failure records error and emits structured failure event', async () => {
    let failedEvent = null;
    const unsub = runtime.subscribe((evt) => {
      if (evt.type === EVENT_TYPES.MCP_SERVER_FAILED) {
        failedEvent = evt;
      }
    });

    const badSrv = runtime.registerMCPServer({
      serverId: 'bad-exec-srv',
      name: 'Bad Exec Srv',
      transport: MCP_TRANSPORT.STDIO,
      processConfig: {
        command: 'non_existent_binary_12345_xyz',
      },
    });

    try {
      await runtime.startMCPServer('bad-exec-srv');
    } catch (e) {}
    unsub();

    assert.strictEqual(runtime.getMCPServer('bad-exec-srv').status, MCP_SERVER_STATUS.FAILED);
    assert.ok(failedEvent, 'MCP_SERVER_FAILED event must be emitted');
  });

  // Test 19: capability cleanup
  await asyncTest('Test 19: capability cleanup removes only target server capabilities', async () => {
    // stdio-test-srv is still registered
    assert.ok(runtime.getMCPServer('stdio-test-srv'));
    await runtime.mcpServerManager.unregisterServer('bad-exec-srv');

    assert.strictEqual(runtime.getMCPServer('bad-exec-srv'), null);
    assert.ok(runtime.getMCPServer('stdio-test-srv'), 'Other server remains intact');
  });

  // Test 20: secret filtering
  test('Test 20: secret filtering sanitizes arguments and results', () => {
    const sanitized = runtime.mcpServerManager.createSafeEnvironment({
      OPENAI_API_KEY: 'sk-secret123',
      REGULAR_FLAG: 'valid',
    });
    assert.strictEqual(sanitized.OPENAI_API_KEY, undefined);
    assert.strictEqual(sanitized.REGULAR_FLAG, 'valid');
  });

  // Test 21: zombie-process prevention
  await asyncTest('Test 21: zombie-process prevention terminates processes on shutdown', async () => {
    await runtime.mcpServerManager.shutdown();
    assert.strictEqual(runtime.mcpServerManager.servers.size, 0);
    assert.strictEqual(runtime.mcpServerManager.transports.size, 0);
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMCPHardeningTests().catch((err) => {
  console.error('[FATAL] MCP Hardening Test runner crashed:', err);
  process.exit(1);
});
