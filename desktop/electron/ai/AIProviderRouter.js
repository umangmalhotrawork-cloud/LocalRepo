/**
 * NEXUS Multi-Model AI Architecture - Provider-Agnostic AI Router
 * Manages provider registration, secure per-provider credential storage,
 * dynamic model routing, and strict key isolation.
 */

const fs = require('fs');
const path = require('path');
const { PROVIDER_IDS, PROVIDER_STATUS, DEFAULT_MODELS, PROVIDER_METADATA } = require('./types');
const GeminiProvider = require('./GeminiProvider');
const GroqProvider = require('./GroqProvider');
const OpenAIProvider = require('./OpenAIProvider');
const ClaudeProvider = require('./ClaudeProvider');
const DeepSeekProvider = require('./DeepSeekProvider');
const GrokProvider = require('./GrokProvider');

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

    this.activeProviderId = PROVIDER_IDS.GROQ;
    this.activeModelId = DEFAULT_MODELS[PROVIDER_IDS.GROQ];

    this.registerProviders();
    this.initDefaultKeys();
  }

  getVaultCandidatePaths() {
    const candidates = [];
    if (appModule && typeof appModule.getPath === 'function') {
      try {
        const userData = appModule.getPath('userData');
        if (userData) candidates.push(path.join(userData, 'nexus_ai_vault.json'));
      } catch (e) {}
    }
    const os = require('os');
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'NEXUS', 'nexus_ai_vault.json'));
    candidates.push(path.join(os.homedir(), '.config', 'NEXUS', 'nexus_ai_vault.json'));
    candidates.push(path.join(process.cwd(), '.nexus-recovery', 'nexus_ai_vault.json'));
    return candidates;
  }

  getVaultFilePath() {
    const candidates = this.getVaultCandidatePaths();
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {}
    }
    return candidates[0];
  }

  saveKeyToVault(providerId, apiKey) {
    const candidatePaths = [
      this.getVaultFilePath(),
      ...this.getVaultCandidatePaths(),
    ];

    let saved = false;
    for (const vaultPath of candidatePaths) {
      if (!vaultPath) continue;
      try {
        const dir = path.dirname(vaultPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

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
        saved = true;
        break;
      } catch (e) {
        // Try next candidate
      }
    }
    if (!saved) {
      console.warn('[AI-VAULT] Could not write vault to any candidate path');
    }
  }

  removeKeyFromVault(providerId) {
    this.saveKeyToVault(providerId, null);
  }

  loadKeysFromVault() {
    const candidatePaths = [
      this.getVaultFilePath(),
      ...this.getVaultCandidatePaths(),
    ];
    for (const vaultPath of candidatePaths) {
      if (!vaultPath) continue;
      try {
        if (!fs.existsSync(vaultPath)) continue;
        const raw = fs.readFileSync(vaultPath, 'utf8');
        const vault = JSON.parse(raw) || {};
        let loadedAny = false;
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
            loadedAny = true;
          }
        }
        if (loadedAny) {
          break;
        }
      } catch (e) {
        // Try next candidate
      }
    }
  }

  registerProviders() {
    const groq = new GroqProvider();
    const gemini = new GeminiProvider();
    const openai = new OpenAIProvider();
    const claude = new ClaudeProvider();
    const deepseek = new DeepSeekProvider();
    const grok = new GrokProvider();

    this.providers.set(groq.getId(), groq);
    this.providers.set(gemini.getId(), gemini);
    this.providers.set(openai.getId(), openai);
    this.providers.set(claude.getId(), claude);
    this.providers.set(deepseek.getId(), deepseek);
    this.providers.set(grok.getId(), grok);
  }

  initDefaultKeys() {
    // 1. Check environment variables per provider
    const envMappings = {
      [PROVIDER_IDS.GROQ]: ['GROQ_API_KEY'],
      [PROVIDER_IDS.GEMINI]: ['GEMINI_API_KEY'],
      [PROVIDER_IDS.OPENAI]: ['OPENAI_API_KEY'],
      [PROVIDER_IDS.CLAUDE]: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      [PROVIDER_IDS.DEEPSEEK]: ['DEEPSEEK_API_KEY'],
      [PROVIDER_IDS.GROK]: ['XAI_API_KEY', 'GROK_API_KEY'],
    };

    for (const [pId, envKeys] of Object.entries(envMappings)) {
      for (const envKey of envKeys) {
        const val = process.env[envKey];
        if (val && val.trim()) {
          this.apiKeys.set(pId, val.trim());
          this.keyValidationStatus.set(pId, PROVIDER_STATUS.CONNECTED);
          break;
        }
      }
    }

    // 2. Load keys from encrypted persistent vault
    this.loadKeysFromVault();

    // 3. Align activeProviderId to configured provider if present
    if (this.apiKeys.has(PROVIDER_IDS.GROQ)) {
      this.activeProviderId = PROVIDER_IDS.GROQ;
      this.activeModelId = DEFAULT_MODELS[PROVIDER_IDS.GROQ] || 'openai/gpt-oss-120b';
    } else {
      const firstConnected = Array.from(this.apiKeys.keys())[0];
      if (firstConnected && this.providers.has(firstConnected)) {
        this.activeProviderId = firstConnected;
        this.activeModelId = this.providers.get(firstConnected).getDefaultModel();
      }
    }

    // 4. Load persisted active provider and model selection if available
    this.loadActiveSelection();
  }

  saveActiveSelection(providerId, modelId) {
    const candidateDirs = [];
    const vaultPath = this.getVaultFilePath();
    if (vaultPath) candidateDirs.push(path.dirname(vaultPath));
    candidateDirs.push(path.join(process.cwd(), '.nexus-recovery'));

    for (const dir of candidateDirs) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const configPath = path.join(dir, 'nexus_ai_selection.json');
        fs.writeFileSync(configPath, JSON.stringify({ activeProvider: providerId, activeModel: modelId }, null, 2), 'utf8');
        break;
      } catch (e) {
        // Try next directory
      }
    }
  }

  loadActiveSelection() {
    const candidatePaths = [
      path.join(path.dirname(this.getVaultFilePath() || ''), 'nexus_ai_selection.json'),
      path.join(process.cwd(), '.nexus-recovery', 'nexus_ai_selection.json'),
    ];

    for (const configPath of candidatePaths) {
      try {
        if (fs.existsSync(configPath)) {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (data && data.activeProvider && this.providers.has(data.activeProvider)) {
            this.activeProviderId = data.activeProvider;
            const provider = this.providers.get(data.activeProvider);
            if (data.activeModel) {
              this.activeModelId = data.activeModel;
            } else {
              this.activeModelId = provider.getDefaultModel();
              this.saveActiveSelection(this.activeProviderId, this.activeModelId);
            }
            break;
          }
        }
      } catch (e) {}
    }
  }

  getActiveProvider() {
    return this.providers.get(this.activeProviderId) || this.providers.get(PROVIDER_IDS.GROQ);
  }

  getActiveModel() {
    return this.activeModelId || DEFAULT_MODELS[this.activeProviderId] || 'openai/gpt-oss-120b';
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
    const key = this.apiKeys.get(providerId);
    if (!key || !key.trim()) {
      return PROVIDER_STATUS.NOT_CONFIGURED;
    }
    return this.keyValidationStatus.get(providerId) || PROVIDER_STATUS.CONNECTED;
  }

  hasApiKey(providerId) {
    const key = this.apiKeys.get(providerId);
    return Boolean(key && typeof key === 'string' && key.trim().length > 0);
  }

  getConfig() {
    const providersList = Array.from(this.providers.values()).map((p) => {
      const pId = p.getId();
      const status = this.getProviderStatus(pId);
      const meta = PROVIDER_METADATA[pId] || {};
      const isConfigured = status === PROVIDER_STATUS.CONNECTED;
      return {
        id: pId,
        providerId: pId,
        name: p.getName(),
        authenticated: isConfigured,
        keyConfigured: this.apiKeys.has(pId),
        models: p.getModels(),
        defaultModel: p.getDefaultModel(),
        selectedModelId: pId === this.activeProviderId ? this.activeModelId : p.getDefaultModel(),
        status,
        maskedKey: this.getMaskedKey(pId),
        isConfigured,
        keyPlaceholder: meta.keyPlaceholder || 'Enter API key...',
        helpUrl: meta.helpUrl || '',
        lastDiscoveryAt: p.lastDiscoveryAt || 0,
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
      const rawModels = (typeof provider.getModels === 'function' ? provider.getModels() : provider.models) || [];
      const validModels = rawModels.map((m) => (typeof m === 'string' ? m : m?.id || ''));

      if (modelId && (validModels.includes(modelId) || validModels.length === 0)) {
        this.activeModelId = modelId;
      } else if (typeof provider.getDefaultModel === 'function') {
        this.activeModelId = provider.getDefaultModel();
      } else {
        this.activeModelId = modelId || validModels[0] || '';
      }
      this.saveActiveSelection(this.activeProviderId, this.activeModelId);
      return { success: true, activeProvider: this.activeProviderId, activeModel: this.activeModelId };
    }
    return { success: false, error: `Unsupported provider: ${providerId}` };
  }

  async setApiKey(providerId, apiKey) {
    if (!this.providers.has(providerId)) {
      return { success: false, error: `Unsupported provider: ${providerId}` };
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
      this.activeProviderId = providerId;
      this.activeModelId = provider.getDefaultModel();
      return {
        success: true,
        status: PROVIDER_STATUS.CONNECTED,
        maskedKey: this.getMaskedKey(providerId),
        configured: true,
        models: provider.getModels(),
      };
    } else {
      this.keyValidationStatus.set(providerId, PROVIDER_STATUS.INVALID_KEY);
      return {
        success: false,
        status: PROVIDER_STATUS.INVALID_KEY,
        error: validation.error || `Invalid API key or ${provider.getName()} connection failed.`,
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

  async getProviderDiagnostics(providerId = 'groq') {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        authenticated: false,
        reachable: false,
        error: `Unknown provider: ${providerId}`,
        models: [],
        configuredModel: this.activeModelId,
        configuredModelAvailable: false,
      };
    }

    const apiKey = this.apiKeys.get(providerId);
    if (!apiKey || !apiKey.trim()) {
      return {
        authenticated: false,
        reachable: false,
        error: `No API key configured for ${provider.getName()}`,
        models: [],
        configuredModel: this.activeModelId,
        configuredModelAvailable: false,
      };
    }

    if (typeof provider.getAvailableModels === 'function') {
      const diag = await provider.getAvailableModels(apiKey, this.activeModelId);
      return diag;
    }

    return {
      authenticated: true,
      reachable: true,
      models: provider.getModels(),
      configuredModel: this.activeModelId,
      configuredModelAvailable: true,
    };
  }

  /**
   * Resolves target provider, model, and isolated key.
   * GUARANTEE: Never sends one provider's key to another provider.
   * If the target provider is not configured, returns null (delegates to offline deterministic engine).
   */
  resolveProviderAndModel(requestedProviderId, requestedModelId) {
    const pId = requestedProviderId || this.activeProviderId || PROVIDER_IDS.GROQ;
    const mId = requestedModelId || (pId === this.activeProviderId ? this.activeModelId : undefined);

    let provider = this.providers.get(pId);
    let apiKey = provider ? this.apiKeys.get(pId) : null;

    if (provider && provider.isConfigured(apiKey)) {
      const rawModels = (typeof provider.getModels === 'function' ? provider.getModels() : provider.models) || [];
      const validModels = rawModels.map((m) => (typeof m === 'string' ? m : m?.id || ''));
      const defaultMod = typeof provider.getDefaultModel === 'function' ? provider.getDefaultModel() : (validModels[0] || '');
      const targetModel = mId && (validModels.includes(mId) || validModels.length === 0) ? mId : defaultMod;
      return {
        provider,
        apiKey,
        modelId: targetModel,
        isFallback: false,
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
