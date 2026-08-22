/**
 * NEXUS Multi-Model AI Architecture - Type Definitions & Constants
 */

const PROVIDER_IDS = {
  NEXUS_1: 'nexus1',
  NEXUS_2: 'nexus2',
  NEXUS_3: 'nexus3',
  NEXUS_4: 'nexus4',
  NEXUS_5: 'nexus5',
  NEXUS_6: 'nexus6',
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
  [PROVIDER_IDS.NEXUS_1]: 'gemini-2.5-flash',
  [PROVIDER_IDS.NEXUS_2]: 'gemini-3.5-flash',
  [PROVIDER_IDS.NEXUS_3]: 'gemini-3.5-flash',
  [PROVIDER_IDS.NEXUS_4]: 'gemini-3.5-flash',
  [PROVIDER_IDS.NEXUS_5]: 'gemini-3.5-flash',
  [PROVIDER_IDS.NEXUS_6]: 'openai/gpt-oss-120b',
  [PROVIDER_IDS.GEMINI]: 'gemini-2.5-flash',
  [PROVIDER_IDS.GROQ]: 'openai/gpt-oss-120b',
  [PROVIDER_IDS.OPENAI]: 'gpt-4o',
  [PROVIDER_IDS.CLAUDE]: 'claude-3-5-sonnet-20241022',
  [PROVIDER_IDS.DEEPSEEK]: 'deepseek-coder',
  [PROVIDER_IDS.GROK]: 'grok-2-latest',
};

const PROVIDER_METADATA = {
  [PROVIDER_IDS.NEXUS_1]: {
    name: 'NEXUS 1',
    providerType: 'gemini',
    secondaryName: 'Gemini',
    keyPlaceholder: 'AQ.Ab8RN6... / AIzaSy...',
    envVarNames: ['GEMINI_KEY_1', 'GEMINI_API_KEY_1'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
    slotIndex: 1,
  },
  [PROVIDER_IDS.NEXUS_2]: {
    name: 'NEXUS 2',
    providerType: 'gemini',
    secondaryName: 'Gemini',
    keyPlaceholder: 'AQ.Ab8RN6... / AIzaSy...',
    envVarNames: ['GEMINI_KEY_2', 'GEMINI_API_KEY_2'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
    slotIndex: 2,
  },
  [PROVIDER_IDS.NEXUS_3]: {
    name: 'NEXUS 3',
    providerType: 'gemini',
    secondaryName: 'Gemini',
    keyPlaceholder: 'AQ.Ab8RN6... / AIzaSy...',
    envVarNames: ['GEMINI_KEY_3', 'GEMINI_API_KEY_3'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
    slotIndex: 3,
  },
  [PROVIDER_IDS.NEXUS_4]: {
    name: 'NEXUS 4',
    providerType: 'gemini',
    secondaryName: 'Gemini',
    keyPlaceholder: 'AQ.Ab8RN6... / AIzaSy...',
    envVarNames: ['GEMINI_KEY_4', 'GEMINI_API_KEY_4'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
    slotIndex: 4,
  },
  [PROVIDER_IDS.NEXUS_5]: {
    name: 'NEXUS 5',
    providerType: 'gemini',
    secondaryName: 'Gemini',
    keyPlaceholder: 'AQ.Ab8RN6... / AIzaSy...',
    envVarNames: ['GEMINI_KEY_5', 'GEMINI_API_KEY_5'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
    slotIndex: 5,
  },
  [PROVIDER_IDS.NEXUS_6]: {
    name: 'NEXUS 6',
    providerType: 'groq',
    secondaryName: 'Groq',
    keyPlaceholder: 'gsk_... (Groq Key)',
    envVarNames: ['GROQ_API_KEY', 'GEMINI_KEY_6', 'GEMINI_API_KEY_6', 'NEXUS_KEY_6'],
    helpUrl: 'https://console.groq.com/keys',
    slotIndex: 6,
  },
  [PROVIDER_IDS.GEMINI]: {
    name: 'Google Gemini',
    providerType: 'gemini',
    keyPlaceholder: 'AIzaSy...',
    envVarNames: ['GEMINI_API_KEY'],
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  [PROVIDER_IDS.GROQ]: {
    name: 'Groq',
    providerType: 'groq',
    keyPlaceholder: 'gsk_...',
    envVarNames: ['GROQ_API_KEY'],
    helpUrl: 'https://console.groq.com/keys',
  },
  [PROVIDER_IDS.OPENAI]: {
    name: 'OpenAI',
    providerType: 'openai',
    keyPlaceholder: 'sk-...',
    envVarNames: ['OPENAI_API_KEY'],
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  [PROVIDER_IDS.CLAUDE]: {
    name: 'Anthropic Claude',
    providerType: 'claude',
    keyPlaceholder: 'sk-ant-...',
    envVarNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  [PROVIDER_IDS.DEEPSEEK]: {
    name: 'DeepSeek',
    providerType: 'deepseek',
    keyPlaceholder: 'sk-...',
    envVarNames: ['DEEPSEEK_API_KEY'],
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
  [PROVIDER_IDS.GROK]: {
    name: 'xAI Grok',
    providerType: 'grok',
    keyPlaceholder: 'xai-...',
    envVarNames: ['XAI_API_KEY', 'GROK_API_KEY'],
    helpUrl: 'https://console.x.ai/',
  },
};

/**
 * Parses and extracts structured rate limit information (429) across AI providers.
 * @param {Error|Object|string} error
 * @param {string} [providerId='groq']
 * @param {string} [modelId='']
 * @returns {{ isRateLimit: boolean, statusCode: number, providerId: string, modelId: string, message: string, retryAfter: string, retryAfterMs: number } | null}
 */
function parseRateLimitError(error, providerId = 'groq', modelId = '') {
  if (!error) return null;
  const errMsg = typeof error === 'string' ? error : (error?.message || error?.error || '');
  const statusCode = error?.statusCode || (typeof error === 'object' && error?.status) || 0;
  
  const is429 = Boolean(
    statusCode === 429 ||
    error?.isRateLimit ||
    /429|rate\s*limit|too\s*many\s*requests|quota\s*exceeded|resource_exhausted|tpm|rpm/i.test(errMsg)
  );

  if (!is429) return null;

  // Extract retry-after from error object, headers, or message regex
  let retryAfter = error?.retryAfter || error?.retry_after || null;
  let retryAfterMs = 5000;

  if (!retryAfter) {
    // Match "try again in 5.2s" or "try again in 5200ms" or "retry after 5 seconds"
    const match = errMsg.match(/(?:try again in|retry after|wait)\s+([0-9.]+\s*(?:s|ms|seconds|sec|minutes|m)?)/i);
    if (match) {
      retryAfter = match[1].trim();
    }
  }

  if (retryAfter) {
    const num = parseFloat(retryAfter);
    if (!isNaN(num)) {
      if (/ms/i.test(retryAfter)) {
        retryAfterMs = Math.round(num);
      } else if (/m(?:inutes)?/i.test(retryAfter)) {
        retryAfterMs = Math.round(num * 60000);
      } else {
        // default seconds
        retryAfterMs = Math.round(num * 1000);
      }
    }
  } else {
    retryAfter = '5s';
  }

  // Clean rate limit message
  let message = errMsg;
  if (message.includes('{') && message.includes('}')) {
    try {
      const jsonStart = message.indexOf('{');
      const parsed = JSON.parse(message.slice(jsonStart));
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch (_) {}
  }
  // Extract actual model and provider from error payload or message if present
  let detectedModel = error?.modelId || error?.model || modelId || '';
  if (!detectedModel || detectedModel === 'openai/gpt-oss-120b' || detectedModel === 'default') {
    const modelMatch = errMsg.match(/(?:for model|model)\s+[`"']?([a-zA-Z0-9_./-]+)[`"']?/i);
    if (modelMatch && modelMatch[1] && !/^(?:the|this|a|an)$/i.test(modelMatch[1])) {
      detectedModel = modelMatch[1];
    }
  } else {
    // If the error message explicitly names a different model that actually failed, prioritize the error message model
    const modelMatch = errMsg.match(/(?:for model|model)\s+[`"']?([a-zA-Z0-9_./-]+)[`"']?/i);
    if (modelMatch && modelMatch[1] && !/^(?:the|this|a|an)$/i.test(modelMatch[1])) {
      detectedModel = modelMatch[1];
    }
  }

  let detectedProvider = error?.providerId || error?.provider || providerId || 'groq';
  const providerMatch = errMsg.match(/(?:on|provider)\s+[`"']?(groq|openai|anthropic|claude|gemini|deepseek|grok|xai)[`"']?/i);
  if (providerMatch && providerMatch[1]) {
    detectedProvider = providerMatch[1].toLowerCase();
  }

  return {
    isRateLimit: true,
    statusCode: 429,
    providerId: detectedProvider,
    modelId: detectedModel,
    message,
    retryAfter: typeof retryAfter === 'string' ? retryAfter : `${retryAfter}s`,
    retryAfterMs,
  };
}

module.exports = {
  PROVIDER_IDS,
  PROVIDER_STATUS,
  DEFAULT_MODELS,
  PROVIDER_METADATA,
  parseRateLimitError,
};
