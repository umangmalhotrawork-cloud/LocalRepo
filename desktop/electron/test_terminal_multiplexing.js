/**
 * NEXUS CODEX HARNESS - TERMINAL MULTIPLEXING & MULTI-TAB SHELL SUITE
 * Milestone 29 Verification:
 * 1. Multi-session concurrent spawning & listing
 * 2. Session isolation & distinct output streams
 * 3. In-memory ring buffer retention & retrieval
 * 4. Session renaming & metadata tracking
 * 5. Buffer clearing per session
 * 6. Session resize & dimension updates
 * 7. Background process exit & status event propagation
 * 8. Session restart with configuration preservation
 * 9. Safe batch cleanup of all multiplexed sessions
 */

const fs = require('fs');
const path = require('path');
const ptyManager = require('./ptyManager');

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTerminalMultiplexingTestSuite() {
  console.log('====================================================');
  console.log('STARTING NEXUS M29: TERMINAL MULTIPLEXING TEST SUITE');
  console.log('====================================================\n');

  const receivedData = new Map();
  const receivedExits = new Map();
  const receivedStatuses = new Map();

  const mockWebContents = {
    isDestroyed: () => false,
    send: (channel, payload) => {
      if (channel === 'terminal:data') {
        const arr = receivedData.get(payload.id) || [];
        arr.push(payload.data);
        receivedData.set(payload.id, arr);
      } else if (channel === 'terminal:exit') {
        receivedExits.set(payload.id, payload);
      } else if (channel === 'terminal:status') {
        receivedStatuses.set(payload.id, payload);
      }
    },
  };

  try {
    // ----------------------------------------------------
    // Test 1: Multi-Session Concurrent Creation
    // ----------------------------------------------------
    console.log('--- Test 1: Spawning Multiple Concurrent Terminal Sessions ---');
    const term1 = ptyManager.createTerminal(
      { cwd: process.cwd(), name: 'Dev Server', cols: 100, rows: 30 },
      mockWebContents
    );
    const term2 = ptyManager.createTerminal(
      { cwd: process.cwd(), name: 'Test Runner', cols: 80, rows: 24 },
      mockWebContents
    );
    const term3 = ptyManager.createTerminal(
      { cwd: process.cwd(), name: 'Git Ops', cols: 120, rows: 40 },
      mockWebContents
    );

    assert(term1 && term1.id && term1.pid, 'Session 1 spawned with valid ID and PID');
    assert(term2 && term2.id && term2.pid, 'Session 2 spawned with valid ID and PID');
    assert(term3 && term3.id && term3.pid, 'Session 3 spawned with valid ID and PID');
    assert(term1.id !== term2.id && term2.id !== term3.id, 'All 3 sessions have unique identifiers');
    assert(term1.name === 'Dev Server', 'Session 1 has custom name "Dev Server"');
    assert(term2.name === 'Test Runner', 'Session 2 has custom name "Test Runner"');
    assert(term3.name === 'Git Ops', 'Session 3 has custom name "Git Ops"');

    // ----------------------------------------------------
    // Test 2: Active Sessions Listing & Rich Metadata
    // ----------------------------------------------------
    console.log('\n--- Test 2: Querying Active Sessions Metadata ---');
    const list = ptyManager.list();
    assert(list.length >= 3, `Session list contains at least 3 active sessions (count=${list.length})`);
    
    const info1 = list.find((t) => t.id === term1.id);
    const info2 = list.find((t) => t.id === term2.id);
    const info3 = list.find((t) => t.id === term3.id);

    assert(Boolean(info1 && info2 && info3), 'All 3 spawned sessions present in list');
    assert(info1.name === 'Dev Server' && info1.status === 'running', 'Session 1 status is running with name Dev Server');
    assert(info2.cols === 80 && info2.rows === 24, 'Session 2 preserves cols and rows dimensions');
    assert(typeof info1.createdAt === 'number' && info1.createdAt > 0, 'Session 1 records valid createdAt timestamp');
    assert(typeof info1.lastActive === 'number' && info1.lastActive > 0, 'Session 1 records valid lastActive timestamp');

    // ----------------------------------------------------
    // Test 3: Session Data Routing & Stream Isolation
    // ----------------------------------------------------
    console.log('\n--- Test 3: Testing Stream Isolation and Buffer Retention ---');
    ptyManager.write(term1.id, 'echo "UNIQUE_TOKEN_SESSION_ONE"\n');
    ptyManager.write(term2.id, 'echo "UNIQUE_TOKEN_SESSION_TWO"\n');

    await sleep(400);

    const stream1 = (receivedData.get(term1.id) || []).join('');
    const stream2 = (receivedData.get(term2.id) || []).join('');

    assert(stream1.includes('UNIQUE_TOKEN_SESSION_ONE'), 'Session 1 stream contains its unique output token');
    assert(stream2.includes('UNIQUE_TOKEN_SESSION_TWO'), 'Session 2 stream contains its unique output token');
    assert(!stream1.includes('UNIQUE_TOKEN_SESSION_TWO'), 'Session 1 does NOT leak data from Session 2');
    assert(!stream2.includes('UNIQUE_TOKEN_SESSION_ONE'), 'Session 2 does NOT leak data from Session 1');

    // ----------------------------------------------------
    // Test 4: In-Memory Ring Buffer Query
    // ----------------------------------------------------
    console.log('\n--- Test 4: Testing Ring Buffer Retrieval (Hydration) ---');
    const bufRes1 = ptyManager.getBuffer(term1.id);
    assert(bufRes1.success === true, 'getBuffer returns success for Session 1');
    assert(Array.isArray(bufRes1.buffer) && bufRes1.buffer.length > 0, 'Session 1 in-memory buffer contains output lines');
    assert(
      bufRes1.buffer.some((l) => l.includes('UNIQUE_TOKEN_SESSION_ONE')),
      'Session 1 in-memory ring buffer preserved the executed command token'
    );

    // ----------------------------------------------------
    // Test 5: Session Renaming
    // ----------------------------------------------------
    console.log('\n--- Test 5: Testing Session Renaming ---');
    const renameRes = ptyManager.rename(term1.id, 'Frontend Vite Server');
    assert(renameRes.success === true && renameRes.name === 'Frontend Vite Server', 'Session 1 successfully renamed');
    
    const updatedList = ptyManager.list();
    const updatedInfo1 = updatedList.find((t) => t.id === term1.id);
    assert(updatedInfo1.name === 'Frontend Vite Server', 'Updated session list reflects new name "Frontend Vite Server"');

    // ----------------------------------------------------
    // Test 6: Buffer Clearing
    // ----------------------------------------------------
    console.log('\n--- Test 6: Testing Output Buffer Clearing ---');
    const clearRes = ptyManager.clear(term1.id);
    assert(clearRes.success === true, 'clear returned success for Session 1');
    const clearedBuf = ptyManager.getBuffer(term1.id);
    assert(clearedBuf.buffer.length === 0, 'Session 1 buffer is now empty after clear()');

    // ----------------------------------------------------
    // Test 7: Resize Operation
    // ----------------------------------------------------
    console.log('\n--- Test 7: Testing Terminal Resizing ---');
    ptyManager.resize(term2.id, 140, 45);
    const listAfterResize = ptyManager.list();
    const resizedInfo2 = listAfterResize.find((t) => t.id === term2.id);
    assert(resizedInfo2.cols === 140 && resizedInfo2.rows === 45, 'Session 2 dimensions updated to 140x45');

    // ----------------------------------------------------
    // Test 8: Session Restart
    // ----------------------------------------------------
    console.log('\n--- Test 8: Testing Session Restart ---');
    const restarted = ptyManager.restart(term3.id, mockWebContents);
    assert(restarted && restarted.id, 'Restarted session spawned successfully with new ID');
    assert(restarted.name === 'Git Ops', 'Restarted session preserved original custom name');
    assert(!ptyManager.list().some((t) => t.id === term3.id), 'Old session ID was cleaned up');
    assert(ptyManager.list().some((t) => t.id === restarted.id), 'New session ID is registered in active list');

    // ----------------------------------------------------
    // Test 9: Process Exit and Status Notification
    // ----------------------------------------------------
    console.log('\n--- Test 9: Testing Background Process Exit Detection ---');
    const exitTerm = ptyManager.createTerminal(
      { cwd: process.cwd(), name: 'Exit Worker' },
      mockWebContents
    );
    ptyManager.write(exitTerm.id, 'exit 0\n');
    await sleep(400);

    const exitPayload = receivedExits.get(exitTerm.id);
    assert(Boolean(exitPayload), 'terminal:exit event was dispatched for exiting session');
    assert(exitPayload.exitCode === 0, `Exit code matches expected value (code=${exitPayload.exitCode})`);

    // ----------------------------------------------------
    // Test 10: Batch Cleanup
    // ----------------------------------------------------
    console.log('\n--- Test 10: Testing Safe Batch Cleanup ---');
    ptyManager.cleanupAll();
    assert(ptyManager.list().length === 0, 'cleanupAll() successfully terminated and cleared all active PTY sessions');

    console.log('\n====================================================');
    console.log('>>> ALL 10 M29 TERMINAL MULTIPLEXING TESTS PASSED <<<');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST RUNNER EXCEPTION]', err);
    ptyManager.cleanupAll();
    process.exit(1);
  }
}

runTerminalMultiplexingTestSuite();
