/**
 * NEXUS Multi-Model AI Architecture - Groq Provider Adapter
 */

const OpenAICompatibleProvider = require('./OpenAICompatibleProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class GroqProvider extends OpenAICompatibleProvider {
  constructor(
    id = PROVIDER_IDS.GROQ,
    name = 'Groq',
    staticModels = [
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (High Intelligence & Active)' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
      { id: 'groq/compound', name: 'Groq Compound (Fast Multi-Expert)' },
      { id: 'groq/compound-mini', name: 'Groq Compound Mini' },
      { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B' },
      { id: 'allam-2-7b', name: 'ALLaM 2 7B' },
      { id: 'canopylabs/orpheus-v1-english', name: 'Canopy Labs Orpheus English' },
    ],
    defaultModel = DEFAULT_MODELS[id] || 'openai/gpt-oss-120b',
    options = {}
  ) {
    super(
      id,
      name,
      'https://api.groq.com/openai/v1',
      staticModels,
      defaultModel,
      { supportsJsonMode: true, ...options }
    );
    this.slotIndex = options.slotIndex || null;
    this.secondaryName = options.secondaryName || 'Groq';
  }
}

module.exports = GroqProvider;
