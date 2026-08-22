/**
 * NEXUS Multi-Model AI Architecture - Groq Provider Adapter
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class GroqProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      PROVIDER_IDS.GROQ,
      'Groq',
      'https://api.groq.com/openai/v1',
      [
        { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (High Intelligence & Active)' },
        { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
        { id: 'groq/compound', name: 'Groq Compound (Fast Multi-Expert)' },
        { id: 'groq/compound-mini', name: 'Groq Compound Mini' },
        { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B' },
        { id: 'allam-2-7b', name: 'ALLaM 2 7B' },
        { id: 'canopylabs/orpheus-v1-english', name: 'Canopy Labs Orpheus English' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.GROQ] || 'openai/gpt-oss-120b',
      { supportsJsonMode: true }
    );
  }
}

module.exports = GroqProvider;
