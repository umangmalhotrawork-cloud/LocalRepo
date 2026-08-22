/**
 * Execute Groq Diagnostics & Real Request inside NEXUS Provider Runtime
 */

const { app } = require('electron');
const { aiProviderRouter } = require('./ai/AIProviderRouter');

app.whenReady().then(async () => {
  console.log('==================================================');
  console.log('NEXUS GROQ PROVIDER DIAGNOSTIC & CHAT TEST');
  console.log('==================================================\n');

  try {
    // 1. Run Provider Diagnostics
    console.log('[1/3] Querying Groq /models via getProviderDiagnostics()...');
    const diag = await aiProviderRouter.getProviderDiagnostics('groq');

    console.log('Diagnostic Result:');
    console.log('- Authenticated:', diag.authenticated);
    console.log('- Reachable:    ', diag.reachable);
    console.log('- Total Models: ', diag.models ? diag.models.length : 0);
    console.log('- Configured Model:', diag.configuredModel);
    console.log('- Configured Available:', diag.configuredModelAvailable);
    if (diag.error) {
      console.log('- Status Note:  ', diag.error);
    }

    if (diag.models && diag.models.length > 0) {
      console.log('\nDiscovered Models List (Model IDs only):');
      diag.models.forEach((m) => {
        console.log(`  • ID: ${m.id} | Active: ${m.active} | Context: ${m.contextWindow} | OwnedBy: ${m.ownedBy}`);
      });

      // 2. Select first available model for a live chat test
      const targetModel = diag.models.find((m) => m.id === diag.configuredModel) || diag.models[0];
      console.log(`\n[2/3] Executing live chat test using available model "${targetModel.id}"...`);

      const planResult = await aiProviderRouter.generateAgentPlan({
        providerId: 'groq',
        modelId: targetModel.id,
        task: 'Say hello in one short sentence.',
        intent: 'GENERAL_CHAT',
      });

      console.log('\n[3/3] Live Chat Response:');
      console.log('- Summary:', planResult?.summary);
      console.log('- Execution Provider:', planResult?.execution?.providerId);
      console.log('- Execution Model:   ', planResult?.execution?.modelId);
      console.log('\nLIVE GROQ TEST SUCCESSFUL!');
    } else {
      console.log('\n[!] No active models returned or authentication required.');
    }
  } catch (err) {
    console.error('\nDiagnostic execution error:', err.message);
  } finally {
    app.quit();
  }
});
