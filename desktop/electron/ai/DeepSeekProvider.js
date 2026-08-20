/**
 * NEXUS Multi-Model AI Architecture - DeepSeek Provider Adapter
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      PROVIDER_IDS.DEEPSEEK,
      'DeepSeek',
      'https://api.deepseek.com',
      [
        { id: 'deepseek-coder', name: 'DeepSeek Coder' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.DEEPSEEK] || 'deepseek-coder',
      { supportsJsonMode: true }
    );
  }
}

module.exports = DeepSeekProvider;
