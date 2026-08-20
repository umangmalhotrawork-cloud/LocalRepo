const path = require('path');
const fs = require('fs');
const { runAgentTask, agentManager } = require('../electron/agentManager');

async function main() {
  console.log("[TEST] Starting AI Agent Mode Test Suite...");
  const origKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const workspacePath = path.join(__dirname, '../../demo-workspaces/ai_cart_project');

  // 1. Task Planning & Step Generation
  const res1 = await runAgentTask({
    task: "Generate unit tests for cart calculation",
    workspacePath,
    maxSteps: 3,
  });

  console.log(`[TEST 1] Task planning: success=${res1.success}, steps=${res1.steps.length}`);
  if (!res1.success || res1.steps.length === 0) {
    throw new Error("Test 1 failed: Agent planning failed");
  }

  // 2. Verify maxSteps limit
  const res2 = await runAgentTask({
    task: "Refactor cart duplicate code",
    workspacePath,
    maxSteps: 2,
  });
  console.log(`[TEST 2] maxSteps limit: requested 2, received ${res2.steps.length}`);
  if (res2.steps.length > 2) {
    throw new Error("Test 2 failed: maxSteps exceeded");
  }

  // 3. Verify Patch Structure
  const stepWithEdit = res1.steps.find((s) => s.proposedEdits && s.proposedEdits.length > 0);
  if (!stepWithEdit) {
    throw new Error("Test 3 failed: Step with proposedEdits expected");
  }
  console.log(`[TEST 3] Patch structure: filePath=${stepWithEdit.proposedEdits[0].filePath}`);
  if (!stepWithEdit.proposedEdits[0].filePath || stepWithEdit.proposedEdits[0].replacement === undefined) {
    throw new Error("Test 3 failed: Invalid patch structure");
  }

  // 4. Verify Firewall Invocation
  console.log(`[TEST 4] Firewall evaluation: risk_level=${stepWithEdit.firewallResult?.risk_level}`);
  if (!stepWithEdit.firewallResult || !stepWithEdit.firewallResult.risk_level) {
    throw new Error("Test 4 failed: Patch firewall result missing");
  }

  // 5. Verify Drift Invocation
  console.log(`[TEST 5] Semantic Intent Drift: drift_level=${stepWithEdit.driftResult?.drift_level}`);
  if (!stepWithEdit.driftResult || !stepWithEdit.driftResult.drift_level) {
    throw new Error("Test 5 failed: Semantic intent drift result missing");
  }

  // 6. Verify Offline Fallback on Empty or Missing Key
  const resOffline = await runAgentTask({
    task: "Fix all TypeScript errors",
    workspacePath,
  });
  console.log(`[TEST 6] Offline fallback: success=${resOffline.success}, steps=${resOffline.steps.length}`);
  if (!resOffline.success || resOffline.steps.length === 0) {
    throw new Error("Test 6 failed: Offline fallback failed");
  }
  if (origKey) process.env.GEMINI_API_KEY = origKey;

  // 7. Verify Deterministic Output
  const rA = await runAgentTask({ task: "Add JWT authentication", workspacePath });
  const rB = await runAgentTask({ task: "Add JWT authentication", workspacePath });
  if (rA.steps.length !== rB.steps.length || rA.steps[0].title !== rB.steps[0].title) {
    throw new Error("Test 7 failed: Output should be deterministic");
  }
  console.log("[TEST 7] Deterministic execution verified");

  console.log(">>> ALL 7 AI AGENT TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
