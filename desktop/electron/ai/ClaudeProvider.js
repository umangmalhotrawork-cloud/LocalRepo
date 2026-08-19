/**
 * NEXUS Multi-Model AI Architecture - Claude Provider Adapter (Architecture-Ready / Unconfigured)
 */

const AIProvider = require('./AIProvider');
const { PROVIDER_IDS } = require('./types');

class ClaudeProvider extends AIProvider {
  constructor() {
    super(
      PROVIDER_IDS.CLAUDE,
      'Claude',
      [
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-haiku', name: 'Claude 3 Haiku' },
      ],
      'claude-3-5-sonnet'
    );
  }

  isConfigured(apiKey) {
    return false;
  }

  async validateKey(apiKey) {
    return { valid: false, error: 'Claude provider integration is coming soon in Phase 2.' };
  }

  async generateAgentPlan(apiKey, model, payload) {
    throw new Error('Claude provider is not configured for Phase 1. Please select Gemini.');
  }

  async generateCodeAction(apiKey, model, payload) {
    throw new Error('Claude provider is not configured for Phase 1. Please select Gemini.');
  }
}

module.exports = ClaudeProvider;
