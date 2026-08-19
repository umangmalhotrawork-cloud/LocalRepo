/**
 * NEXUS Multi-Model AI Architecture - Type Definitions & Constants
 */

const PROVIDER_IDS = {
  GEMINI: 'gemini',
  CLAUDE: 'claude',
  GROK: 'grok',
  DEEPSEEK: 'deepseek',
};

const PROVIDER_STATUS = {
  CONNECTED: 'CONNECTED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  INVALID_KEY: 'INVALID_KEY',
  ERROR: 'ERROR',
};

const DEFAULT_MODELS = {
  [PROVIDER_IDS.GEMINI]: 'gemini-1.5-flash',
  [PROVIDER_IDS.CLAUDE]: 'claude-3-5-sonnet',
  [PROVIDER_IDS.GROK]: 'grok-2',
  [PROVIDER_IDS.DEEPSEEK]: 'deepseek-coder-v2',
};

module.exports = {
  PROVIDER_IDS,
  PROVIDER_STATUS,
  DEFAULT_MODELS,
};
