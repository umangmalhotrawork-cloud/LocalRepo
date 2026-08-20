/**
 * NEXUS Multi-Model AI Architecture - Type Definitions & Constants
 */

const PROVIDER_IDS = {
  GEMINI: 'gemini',
  GROQ: 'groq',
  OPENAI: 'openai',
  CLAUDE: 'claude',
  DEEPSEEK: 'deepseek',
  GROK: 'grok',
};

const PROVIDER_STATUS = {
  CONNECTED: 'CONNECTED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  INVALID_KEY: 'INVALID_KEY',
  ERROR: 'ERROR',
};

const DEFAULT_MODELS = {
  [PROVIDER_IDS.GEMINI]: 'gemini-1.5-flash',
  [PROVIDER_IDS.GROQ]: 'llama-3.3-70b-versatile',
  [PROVIDER_IDS.OPENAI]: 'gpt-4o',
  [PROVIDER_IDS.CLAUDE]: 'claude-3-5-sonnet-20241022',
  [PROVIDER_IDS.DEEPSEEK]: 'deepseek-coder',
  [PROVIDER_IDS.GROK]: 'grok-2-latest',
};

const PROVIDER_METADATA = {
  [PROVIDER_IDS.GEMINI]: {
    name: 'Google Gemini',
    keyPlaceholder: 'AIzaSy...',
    envVarNames: ['GEMINI_API_KEY'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  [PROVIDER_IDS.GROQ]: {
    name: 'Groq',
    keyPlaceholder: 'gsk_...',
    envVarNames: ['GROQ_API_KEY'],
    helpUrl: 'https://console.groq.com/keys',
  },
  [PROVIDER_IDS.OPENAI]: {
    name: 'OpenAI',
    keyPlaceholder: 'sk-...',
    envVarNames: ['OPENAI_API_KEY'],
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  [PROVIDER_IDS.CLAUDE]: {
    name: 'Anthropic Claude',
    keyPlaceholder: 'sk-ant-...',
    envVarNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  [PROVIDER_IDS.DEEPSEEK]: {
    name: 'DeepSeek',
    keyPlaceholder: 'sk-...',
    envVarNames: ['DEEPSEEK_API_KEY'],
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
  [PROVIDER_IDS.GROK]: {
    name: 'xAI Grok',
    keyPlaceholder: 'xai-...',
    envVarNames: ['XAI_API_KEY', 'GROK_API_KEY'],
    helpUrl: 'https://console.x.ai/',
  },
};

module.exports = {
  PROVIDER_IDS,
  PROVIDER_STATUS,
  DEFAULT_MODELS,
  PROVIDER_METADATA,
};
