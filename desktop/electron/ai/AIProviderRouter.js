const fs = require('fs');
const path = require('path');
const { PROVIDER_IDS, PROVIDER_STATUS, DEFAULT_MODELS } = require('./types');
const GeminiProvider = require('./GeminiProvider');
const ClaudeProvider = require('./ClaudeProvider');
const GrokProvider = require('./GrokProvider');
const DeepSeekProvider = require('./DeepSeekProvider');

let appModule = null;
let safeStorageModule = null;
try {
  const electron = require('electron');
  appModule = electron.app;
  safeStorageModule = electron.safeStorage;
} catch (e) {}

class AIProviderRouter {
  constructor() {
    this.providers = new Map();
    this.apiKeys = new Map();
    this.keyValidationStatus = new Map();

    this.activeProviderId = PROVIDER_IDS.GEMINI;
    this.activeModelId = DEFAULT_MODELS[PROVIDER_IDS.GEMINI];

    this.registerProviders();
    this.initDefaultKeys();
  }

  getVaultFilePath() {
    if (appModule && typeof appModule.getPath === 'function') {
      try {
        const userData = appModule.getPath('userData');
        if (userData) {
          return path.join(userData, 'nexus_ai_vault.json');
        }
      } catch (e) {}
    }
    return null;
  }

  saveKeyToVault(providerId, apiKey) {
    const vaultPath = this.getVaultFilePath();
    if (!vaultPath) return;
    try {
      let vault = {};
      if (fs.existsSync(vaultPath)) {
        try {
          vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8')) || {};
        } catch (e) {
          vault = {};
        }
      }
      if (apiKey) {
        if (safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function' && safeStorageModule.isEncryptionAvailable()) {
          vault[providerId] = { enc: safeStorageModule.encryptString(apiKey).toString('hex') };
        } else {
          vault[providerId] = { b64: Buffer.from(apiKey, 'utf8').toString('base64') };
        }
      } else {
        delete vault[providerId];
      }
      fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
    } catch (e) {
      console.warn('[AI-VAULT] Failed to persist key to vault:', e.message);
    }
  }

  removeKeyFromVault(providerId) {
    this.saveKeyToVault(providerId, null);
  }

  loadKeysFromVault() {
    const vaultPath = this.getVaultFilePath();
    if (!vaultPath || !fs.existsSync(vaultPath)) return;
    try {
      const raw = fs.readFileSync(vaultPath, 'utf8');
      const vault = JSON.parse(raw) || {};
      for (const [pId, val] of Object.entries(vault)) {
        if (!val || typeof val !== 'object') continue;
        let decrypted = null;
        if (val.enc && safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function' && safeStorageModule.isEncryptionAvailable()) {
          try {
            decrypted = safeStorageModule.decryptString(Buffer.from(val.enc, 'hex'));
          } catch (e) {}
        } else if (val.b64) {
          try {
            decrypted = Buffer.from(val.b64, 'base64').toString('utf8');
          } catch (e) {}
        }
        if (decrypted && decrypted.trim()) {
          this.apiKeys.set(pId, decrypted.trim());
          this.keyValidationStatus.set(pId, PROVIDER_STATUS.CONNECTED);
        }
      }
    } catch (e) {
      console.warn('[AI-VAULT] Failed to load keys from vault:', e.message);
    }
  }

  registerProviders() {
    const gemini = new GeminiProvider();
    const claude = new ClaudeProvider();
    const grok = new GrokProvider();
    const deepseek = new DeepSeekProvider();

    this.providers.set(gemini.getId(), gemini);
    this.providers.set(claude.getId(), claude);
    this.providers.set(grok.getId(), grok);
    this.providers.set(deepseek.getId(), deepseek);
  }

  initDefaultKeys() {
    const envGeminiKey = process.env.GEMINI_API_KEY;
    if (envGeminiKey && envGeminiKey.trim()) {
      this.apiKeys.set(PROVIDER_IDS.GEMINI, envGeminiKey.trim());
      this.keyValidationStatus.set(PROVIDER_IDS.GEMINI, PROVIDER_STATUS.CONNECTED);
      return;
    }
    this.loadKeysFromVault();
  }

  getActiveProvider() {
    return this.providers.get(this.activeProviderId) || this.providers.get(PROVIDER_IDS.GEMINI);
  }

  getActiveModel() {
    return this.activeModelId || DEFAULT_MODELS[this.activeProviderId] || 'gemini-1.5-flash';
  }

  getMaskedKey(providerId) {
    const key = this.apiKeys.get(providerId);
    if (!key || typeof key !== 'string' || key.length < 8) {
      return '';
    }
    const prefix = key.slice(0, 4);
    const suffix = key.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }

  getProviderStatus(providerId) {
    if (providerId !== PROVIDER_IDS.GEMINI) {
      return PROVIDER_STATUS.NOT_CONFIGURED;
    }

    const key = this.apiKeys.get(providerId);
    if (!key || !key.trim()) {
      return PROVIDER_STATUS.NOT_CONFIGURED;
    }

    return this.keyValidationStatus.get(providerId) || PROVIDER_STATUS.CONNECTED;
  }

  getConfig() {
    const providersList = Array.from(this.providers.values()).map((p) => {
      const pId = p.getId();
      const status = this.getProviderStatus(pId);
      return {
        id: pId,
        name: p.getName(),
        models: p.getModels(),
        defaultModel: p.getDefaultModel(),
        status,
        maskedKey: this.getMaskedKey(pId),
        isConfigured: status === PROVIDER_STATUS.CONNECTED,
      };
    });

    return {
      activeProvider: this.activeProviderId,
      activeModel: this.activeModelId,
      providers: providersList,
    };
  }

  setConfig(providerId, modelId) {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      const provider = this.providers.get(providerId);
      const validModels = provider.getModels().map((m) => m.id);

      if (modelId && validModels.includes(modelId)) {
        this.activeModelId = modelId;
      } else {
        this.activeModelId = provider.getDefaultModel();
      }
      return { success: true, activeProvider: this.activeProviderId, activeModel: this.activeModelId };
    }
    return { success: false, error: `Unsupported provider: ${providerId}` };
  }

  async setApiKey(providerId, apiKey) {
    if (!this.providers.has(providerId)) {
      return { success: false, error: `Unsupported provider: ${providerId}` };
    }

    if (providerId !== PROVIDER_IDS.GEMINI) {
      return { success: false, error: `Provider ${providerId} is not functional in Phase 1.` };
    }

    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
      this.apiKeys.delete(providerId);
      this.keyValidationStatus.delete(providerId);
      this.removeKeyFromVault(providerId);
      return { success: true, status: PROVIDER_STATUS.NOT_CONFIGURED, maskedKey: '', configured: false };
    }

    const provider = this.providers.get(providerId);
    const validation = await provider.validateKey(trimmedKey);

    if (validation.valid) {
      this.apiKeys.set(providerId, trimmedKey);
      this.keyValidationStatus.set(providerId, PROVIDER_STATUS.CONNECTED);
      this.saveKeyToVault(providerId, trimmedKey);
      return {
        success: true,
        status: PROVIDER_STATUS.CONNECTED,
        maskedKey: this.getMaskedKey(providerId),
        configured: true,
      };
    } else {
      this.keyValidationStatus.set(providerId, PROVIDER_STATUS.INVALID_KEY);
      return {
        success: false,
        status: PROVIDER_STATUS.INVALID_KEY,
        error: validation.error || 'Invalid API key or Gemini connection failed.',
        configured: false,
      };
    }
  }

  removeApiKey(providerId) {
    this.apiKeys.delete(providerId);
    this.keyValidationStatus.delete(providerId);
    this.removeKeyFromVault(providerId);
    return { success: true, status: PROVIDER_STATUS.NOT_CONFIGURED, configured: false };
  }

  async validateKey(providerId, apiKey) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return { valid: false, error: `Unknown provider: ${providerId}` };
    }
    return provider.validateKey(apiKey);
  }

  resolveProviderAndModel(requestedProviderId, requestedModelId) {
    const pId = requestedProviderId || this.activeProviderId;
    const mId = requestedModelId || (pId === this.activeProviderId ? this.activeModelId : undefined);

    let provider = this.providers.get(pId);
    let apiKey = provider ? this.apiKeys.get(pId) : null;

    if (provider && provider.isConfigured(apiKey)) {
      const validModels = provider.getModels().map((m) => m.id);
      const targetModel = mId && validModels.includes(mId) ? mId : provider.getDefaultModel();
      return {
        provider,
        apiKey,
        modelId: targetModel,
        isFallback: false,
        requestedProviderId: pId,
        requestedModelId: mId,
      };
    }

    const defaultProvider = this.getActiveProvider();
    const defaultKey = this.apiKeys.get(defaultProvider.getId());
    if (defaultProvider && defaultProvider.isConfigured(defaultKey)) {
      return {
        provider: defaultProvider,
        apiKey: defaultKey,
        modelId: this.getActiveModel(),
        isFallback: true,
        requestedProviderId: pId,
        requestedModelId: mId,
      };
    }

    return null;
  }

  async generateAgentPlan(payload = {}) {
    const resolved = this.resolveProviderAndModel(payload.providerId, payload.modelId);
    if (!resolved) {
      return null;
    }

    const result = await resolved.provider.generateAgentPlan(resolved.apiKey, resolved.modelId, payload);
    if (result && typeof result === 'object') {
      result.execution = {
        providerId: resolved.provider.getId(),
        modelId: resolved.modelId,
        requestedProviderId: resolved.requestedProviderId,
        requestedModelId: resolved.requestedModelId,
        isFallback: resolved.isFallback,
      };
    }
    return result;
  }

  async generateCodeAction(payload = {}) {
    const resolved = this.resolveProviderAndModel(payload.providerId, payload.modelId);
    if (!resolved) {
      return null;
    }

    const result = await resolved.provider.generateCodeAction(resolved.apiKey, resolved.modelId, payload);
    if (result && typeof result === 'object') {
      result.execution = {
        providerId: resolved.provider.getId(),
        modelId: resolved.modelId,
        requestedProviderId: resolved.requestedProviderId,
        requestedModelId: resolved.requestedModelId,
        isFallback: resolved.isFallback,
      };
    }
    return result;
  }
}

const aiProviderRouter = new AIProviderRouter();

module.exports = {
  AIProviderRouter,
  aiProviderRouter,
};
