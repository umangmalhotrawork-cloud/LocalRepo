/**
 * NEXUS Multi-Model AI Architecture - Grok Provider Adapter (Architecture-Ready / Unconfigured)
 */

const AIProvider = require('./AIProvider');
const { PROVIDER_IDS } = require('./types');

class GrokProvider extends AIProvider {
  constructor() {
    super(
      PROVIDER_IDS.GROK,
      'Grok',
      [
        { id: 'grok-2', name: 'Grok 2' },
        { id: 'grok-beta', name: 'Grok Beta' },
      ],
      'grok-2'
    );
  }

  isConfigured(apiKey) {
    return false;
  }

  async validateKey(apiKey) {
    return { valid: false, error: 'Grok provider integration is coming soon in Phase 2.' };
  }

  async generateAgentPlan(apiKey, model, payload) {
    throw new Error('Grok provider is not configured for Phase 1. Please select Gemini.');
  }

  async generateCodeAction(apiKey, model, payload) {
    throw new Error('Grok provider is not configured for Phase 1. Please select Gemini.');
  }
}

module.exports = GrokProvider;
