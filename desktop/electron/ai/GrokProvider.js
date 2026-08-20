/**
 * NEXUS Multi-Model AI Architecture - Grok (xAI) Provider Adapter
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class GrokProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      PROVIDER_IDS.GROK,
      'Grok',
      'https://api.x.ai/v1',
      [
        { id: 'grok-2-latest', name: 'Grok 2' },
        { id: 'grok-beta', name: 'Grok Beta' },
        { id: 'grok-vision-beta', name: 'Grok Vision Beta' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.GROK] || 'grok-2-latest',
      { supportsJsonMode: true }
    );
  }
}

module.exports = GrokProvider;
