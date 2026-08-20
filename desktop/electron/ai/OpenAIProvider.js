/**
 * NEXUS Multi-Model AI Architecture - OpenAI Provider Adapter
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      PROVIDER_IDS.OPENAI,
      'OpenAI',
      'https://api.openai.com/v1',
      [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'o1-mini', name: 'o1 Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.OPENAI] || 'gpt-4o',
      { supportsJsonMode: true }
    );
  }
}

module.exports = OpenAIProvider;
