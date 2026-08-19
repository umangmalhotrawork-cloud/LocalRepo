/**
 * NEXUS Multi-Model AI Architecture - DeepSeek Provider Adapter (Architecture-Ready / Unconfigured)
 */

const AIProvider = require('./AIProvider');
const { PROVIDER_IDS } = require('./types');

class DeepSeekProvider extends AIProvider {
  constructor() {
    super(
      PROVIDER_IDS.DEEPSEEK,
      'DeepSeek',
      [
        { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat V2' },
      ],
      'deepseek-coder-v2'
    );
  }

  isConfigured(apiKey) {
    return false;
  }

  async validateKey(apiKey) {
    return { valid: false, error: 'DeepSeek provider integration is coming soon in Phase 2.' };
  }

  async generateAgentPlan(apiKey, model, payload) {
    throw new Error('DeepSeek provider is not configured for Phase 1. Please select Gemini.');
  }

  async generateCodeAction(apiKey, model, payload) {
    throw new Error('DeepSeek provider is not configured for Phase 1. Please select Gemini.');
  }
}

module.exports = DeepSeekProvider;
