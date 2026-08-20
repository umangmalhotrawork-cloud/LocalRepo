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
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B 32k' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.GROQ] || 'llama-3.3-70b-versatile',
      { supportsJsonMode: true }
    );
  }
}

module.exports = GroqProvider;
