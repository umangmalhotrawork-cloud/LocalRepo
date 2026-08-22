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

const NEXUS_SLOT_IDS = [
  PROVIDER_IDS.NEXUS_1,
  PROVIDER_IDS.NEXUS_2,
  PROVIDER_IDS.NEXUS_3,
  PROVIDER_IDS.NEXUS_4,
  PROVIDER_IDS.NEXUS_5,
  PROVIDER_IDS.NEXUS_6,
];

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
    this.slotDiagnostics = new Map();

    this.activeProviderId = PROVIDER_IDS.NEXUS_1;
    this.activeModelId = DEFAULT_MODELS[PROVIDER_IDS.NEXUS_1];
    this.slotModelIds = new Map();

    this.registerProviders();
    this.initializeSlotModels();
    this.initDefaultKeys();
  }

  isNexusSlot(providerId) {
    return NEXUS_SLOT_IDS.includes(providerId);
  }

  getValidModelId(providerId, requestedModelId) {
    const provider = this.providers.get(providerId);
    if (!provider) return '';

    const models = (typeof provider.getModels === 'function' ? provider.getModels() : provider.models) || [];
    const ids = models.map((model) => (typeof model === 'string' ? model : model?.id || '')).filter(Boolean);
    const defaultModel = typeof provider.getDefaultModel === 'function'
      ? provider.getDefaultModel()
      : (DEFAULT_MODELS[providerId] || ids[0] || '');

    if (requestedModelId && (ids.includes(requestedModelId) || ids.length === 0)) return requestedModelId;
    if (ids.includes(defaultModel) || ids.length === 0) return defaultModel;
    return ids[0] || defaultModel;
  }

  initializeSlotModels(savedSlotModels = {}) {
    for (const providerId of NEXUS_SLOT_IDS) {
      this.slotModelIds.set(providerId, this.getValidModelId(providerId, savedSlotModels[providerId]));
    }
  }

  getSelectedModelId(providerId) {
    if (this.isNexusSlot(providerId)) {
      return this.getValidModelId(providerId, this.slotModelIds.get(providerId));
    }
    return this.getValidModelId(providerId, providerId === this.activeProviderId ? this.activeModelId : undefined);
  }

  synchronizeSlotModel(providerId, requestedModelId, persist = false) {
    const modelId = this.getValidModelId(providerId, requestedModelId);
    if (this.isNexusSlot(providerId)) {
      const changed = this.slotModelIds.get(providerId) !== modelId;
      this.slotModelIds.set(providerId, modelId);
      if (providerId === this.activeProviderId) this.activeModelId = modelId;
      if (persist && changed) this.saveActiveSelection(this.activeProviderId, this.activeModelId);
    }
    return modelId;
  }

  getVaultCandidatePaths() {
    const candidates = [];
    if (appModule && typeof appModule.getPath === 'function') {
      try {
        const userData = appModule.getPath('userData');
        if (userData) candidates.push(path.join(userData, 'nexus_ai_vault.json'));
      } catch (e) {}
    }
    const { getProjectRoot } = require('../envLoader');
    let projectRoot = path.resolve(__dirname, '..', '..');
    try {
      if (typeof getProjectRoot === 'function') projectRoot = getProjectRoot();
    } catch (e) {}

    candidates.push(path.join(projectRoot, '.nexus-recovery', 'nexus_ai_vault.json'));
    candidates.push(path.join(path.resolve(__dirname, '..', '..'), '.nexus-recovery', 'nexus_ai_vault.json'));
    candidates.push(path.join(path.resolve(__dirname, '..', '..', '..'), '.nexus-recovery', 'nexus_ai_vault.json'));
    candidates.push(path.join(process.cwd(), '.nexus-recovery', 'nexus_ai_vault.json'));
    const os = require('os');
    try {
      candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'NEXUS', 'nexus_ai_vault.json'));
      candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'Echo Nullity', 'nexus_ai_vault.json'));
      candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'echo-nullity', 'nexus_ai_vault.json'));
      candidates.push(path.join(os.homedir(), '.config', 'NEXUS', 'nexus_ai_vault.json'));
      candidates.push(path.join(os.homedir(), '.config', 'echo-nullity', 'nexus_ai_vault.json'));
    } catch (e) {}
    return Array.from(new Set(candidates));
  }

  getVaultFilePath() {
    const candidates = this.getVaultCandidatePaths();
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          fs.accessSync(p, fs.constants.R_OK | fs.constants.W_OK);
          return p;
        }
      } catch (e) {}
    }
    for (const p of candidates) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
        return p;
      } catch (e) {}
    }
    return candidates[0];
  }

  saveKeyToVault(providerId, apiKey) {
    const candidatePaths = this.getVaultCandidatePaths();
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
          const entry = {};
          if (safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function' && safeStorageModule.isEncryptionAvailable()) {
            try {
              entry.enc = safeStorageModule.encryptString(apiKey).toString('hex');
            } catch (e) {}
          }
          entry.b64 = Buffer.from(apiKey, 'utf8').toString('base64');
          vault[providerId] = entry;
        } else {
          delete vault[providerId];
        }

        fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
        saved = true;
      } catch (e) {
        // Continue saving to other candidate paths
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
    const candidatePaths = this.getVaultCandidatePaths();
    const loadedVault = {};
    let loadedAny = false;

    for (const vaultPath of candidatePaths) {
      if (!vaultPath) continue;
      try {
        if (!fs.existsSync(vaultPath)) continue;
        const raw = fs.readFileSync(vaultPath, 'utf8');
        const vault = JSON.parse(raw) || {};
        for (const [pId, val] of Object.entries(vault)) {
          if (!val || typeof val !== 'object') continue;
          if (this.apiKeys.has(pId) && this.apiKeys.get(pId)) continue;
          let decrypted = null;
          if (val.enc && safeStorageModule && typeof safeStorageModule.isEncryptionAvailable === 'function' && safeStorageModule.isEncryptionAvailable()) {
            try {
              decrypted = safeStorageModule.decryptString(Buffer.from(val.enc, 'hex'));
            } catch (e) {}
          }
          if (!decrypted && val.b64) {
            try {
              decrypted = Buffer.from(val.b64, 'base64').toString('utf8');
            } catch (e) {}
          }
          if (decrypted && decrypted.trim()) {
            this.apiKeys.set(pId, decrypted.trim());
            this.keyValidationStatus.set(pId, PROVIDER_STATUS.CONNECTED);
            loadedVault[pId] = decrypted.trim();
            loadedAny = true;
          }
        }
      } catch (e) {
        // Try next candidate
      }
    }

    if (loadedAny) {
      for (const [pId, keyVal] of Object.entries(loadedVault)) {
        this.saveKeyToVault(pId, keyVal);
      }
    }
  }

  registerProviders() {
    // 1. Register Primary Six-Slot Gemini Backend (NEXUS 1 – NEXUS 6)
    const nexus1 = new GeminiProvider(PROVIDER_IDS.NEXUS_1, 'NEXUS 1', undefined, 'gemini-2.5-flash', { slotIndex: 1, secondaryName: 'Gemini' });
    const nexus2 = new GeminiProvider(PROVIDER_IDS.NEXUS_2, 'NEXUS 2', undefined, 'gemini-3.5-flash', { slotIndex: 2, secondaryName: 'Gemini' });
    const nexus3 = new GeminiProvider(PROVIDER_IDS.NEXUS_3, 'NEXUS 3', undefined, 'gemini-3.5-flash', { slotIndex: 3, secondaryName: 'Gemini' });
    const nexus4 = new GeminiProvider(PROVIDER_IDS.NEXUS_4, 'NEXUS 4', undefined, 'gemini-3.5-flash', { slotIndex: 4, secondaryName: 'Gemini' });
    const nexus5 = new GeminiProvider(PROVIDER_IDS.NEXUS_5, 'NEXUS 5', undefined, 'gemini-3.5-flash', { slotIndex: 5, secondaryName: 'Gemini' });
    const nexus6 = new GroqProvider(PROVIDER_IDS.NEXUS_6, 'NEXUS 6', undefined, 'openai/gpt-oss-120b', { slotIndex: 6, secondaryName: 'Groq' });

    this.providers.set(nexus1.getId(), nexus1);
    this.providers.set(nexus2.getId(), nexus2);
    this.providers.set(nexus3.getId(), nexus3);
    this.providers.set(nexus4.getId(), nexus4);
    this.providers.set(nexus5.getId(), nexus5);
    this.providers.set(nexus6.getId(), nexus6);

    // 2. Register Existing Providers for Backward Compatibility
    const gemini = new GeminiProvider(PROVIDER_IDS.GEMINI, 'Google Gemini', undefined, 'gemini-2.5-flash');
    const groq = new GroqProvider();
    const openai = new OpenAIProvider();
    const claude = new ClaudeProvider();
    const deepseek = new DeepSeekProvider();
    const grok = new GrokProvider();

    this.providers.set(gemini.getId(), gemini);
    this.providers.set(groq.getId(), groq);
    this.providers.set(openai.getId(), openai);
    this.providers.set(claude.getId(), claude);
    this.providers.set(deepseek.getId(), deepseek);
    this.providers.set(grok.getId(), grok);
  }

  initDefaultKeys() {
    // 1. Check environment variables per provider/slot
    const envMappings = {
      [PROVIDER_IDS.NEXUS_1]: ['GEMINI_KEY_1', 'GEMINI_API_KEY_1', 'NEXUS_KEY_1'],
      [PROVIDER_IDS.NEXUS_2]: ['GEMINI_KEY_2', 'GEMINI_API_KEY_2', 'NEXUS_KEY_2'],
      [PROVIDER_IDS.NEXUS_3]: ['GEMINI_KEY_3', 'GEMINI_API_KEY_3', 'NEXUS_KEY_3'],
      [PROVIDER_IDS.NEXUS_4]: ['GEMINI_KEY_4', 'GEMINI_API_KEY_4', 'NEXUS_KEY_4'],
      [PROVIDER_IDS.NEXUS_5]: ['GEMINI_KEY_5', 'GEMINI_API_KEY_5', 'NEXUS_KEY_5'],
      [PROVIDER_IDS.NEXUS_6]: ['GROQ_API_KEY', 'GEMINI_KEY_6', 'GEMINI_API_KEY_6', 'NEXUS_KEY_6'],
      [PROVIDER_IDS.GEMINI]: ['GEMINI_API_KEY'],
      [PROVIDER_IDS.GROQ]: ['GROQ_API_KEY'],
      [PROVIDER_IDS.OPENAI]: ['OPENAI_API_KEY'],
      [PROVIDER_IDS.CLAUDE]: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      [PROVIDER_IDS.DEEPSEEK]: ['DEEPSEEK_API_KEY'],
      [PROVIDER_IDS.GROK]: ['XAI_API_KEY', 'GROK_API_KEY'],
    };

    for (const [pId, envKeys] of Object.entries(envMappings)) {
      for (const envKey of envKeys) {
        const val = process.env[envKey];
        if (val && val.trim() && val.trim() !== 'PASTE_KEY_HERE') {
          this.apiKeys.set(pId, val.trim());
          this.keyValidationStatus.set(pId, PROVIDER_STATUS.CONNECTED);
          break;
        }
      }
    }

    // Fallback: if only GEMINI_API_KEY is provided and nexus1 is empty, assign it to nexus1
    if (process.env.GEMINI_API_KEY && !this.apiKeys.has(PROVIDER_IDS.NEXUS_1) && process.env.GEMINI_API_KEY.trim() !== 'PASTE_KEY_HERE') {
      this.apiKeys.set(PROVIDER_IDS.NEXUS_1, process.env.GEMINI_API_KEY.trim());
      this.keyValidationStatus.set(PROVIDER_IDS.NEXUS_1, PROVIDER_STATUS.CONNECTED);
    }

    // 2. Load keys from encrypted persistent vault
    this.loadKeysFromVault();

    // 3. Set default active provider (prefer first connected nexus slot or nexus1)
    const firstConnectedNexus = NEXUS_SLOT_IDS.find((slotId) => this.apiKeys.has(slotId));

    if (firstConnectedNexus) {
      this.activeProviderId = firstConnectedNexus;
      this.activeModelId = this.getSelectedModelId(firstConnectedNexus);
    } else {
      this.activeProviderId = PROVIDER_IDS.NEXUS_1;
      this.activeModelId = this.getSelectedModelId(PROVIDER_IDS.NEXUS_1);
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
        const slotModels = Object.fromEntries(NEXUS_SLOT_IDS.map((slotId) => [
          slotId,
          this.getSelectedModelId(slotId),
        ]));
        fs.writeFileSync(configPath, JSON.stringify({
          activeProvider: providerId,
          activeModel: this.getValidModelId(providerId, modelId),
          slotModels,
        }, null, 2), 'utf8');
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
            const savedSlotModels = { ...(data.slotModels || {}) };
            // Legacy files persisted only activeModel. Apply it to its original
            // slot, then validate every NEXUS selection before any request.
            if (data.activeModel && this.isNexusSlot(data.activeProvider) && !savedSlotModels[data.activeProvider]) {
              savedSlotModels[data.activeProvider] = data.activeModel;
            }
            this.initializeSlotModels(savedSlotModels);
            this.activeProviderId = data.activeProvider;
            this.activeModelId = this.isNexusSlot(data.activeProvider)
              ? this.getSelectedModelId(data.activeProvider)
              : this.getValidModelId(data.activeProvider, data.activeModel);
            // Persist the correction and migrate legacy single-model files.
            this.saveActiveSelection(this.activeProviderId, this.activeModelId);
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

  recordSlotRequest(slotId, status, modelId = '') {
    const pId = slotId || this.activeProviderId || PROVIDER_IDS.NEXUS_1;
    const provider = this.providers.get(pId);
    const meta = PROVIDER_METADATA[pId] || {};
    const existing = this.slotDiagnostics.get(pId) || {};
    this.slotDiagnostics.set(pId, {
      ...existing,
      slotId: pId,
      name: provider?.getName() || meta.name || pId,
      secondaryName: meta.secondaryName || 'Gemini',
      slotIndex: meta.slotIndex || null,
      status: status || 'SUCCESS',
      lastRequestAt: Date.now(),
      lastModel: modelId || existing.lastModel || '',
    });
  }

  getConfig() {
    const orderedIds = [
      PROVIDER_IDS.NEXUS_1,
      PROVIDER_IDS.NEXUS_2,
      PROVIDER_IDS.NEXUS_3,
      PROVIDER_IDS.NEXUS_4,
      PROVIDER_IDS.NEXUS_5,
      PROVIDER_IDS.NEXUS_6,
      PROVIDER_IDS.GEMINI,
      PROVIDER_IDS.GROQ,
      PROVIDER_IDS.OPENAI,
      PROVIDER_IDS.CLAUDE,
      PROVIDER_IDS.DEEPSEEK,
      PROVIDER_IDS.GROK,
    ];

    const providersList = orderedIds
      .map((pId) => {
        const p = this.providers.get(pId);
        if (!p) return null;
        const status = this.getProviderStatus(pId);
        const meta = PROVIDER_METADATA[pId] || {};
        const isConfigured = status === PROVIDER_STATUS.CONNECTED;
        const diag = this.slotDiagnostics.get(pId) || {
          slotId: pId,
          name: p.getName(),
          secondaryName: meta.secondaryName || 'Gemini',
          slotIndex: meta.slotIndex || null,
          status: isConfigured ? 'IDLE' : 'NOT_CONFIGURED',
          lastRequestAt: null,
          lastModel: '',
        };

        return {
          id: pId,
          providerId: pId,
          name: p.getName(),
          secondaryName: meta.secondaryName || 'Gemini',
          slotIndex: meta.slotIndex || null,
          authenticated: isConfigured,
          keyConfigured: this.apiKeys.has(pId),
          models: p.getModels(),
          defaultModel: p.getDefaultModel(),
          selectedModelId: this.getSelectedModelId(pId),
          status,
          maskedKey: this.getMaskedKey(pId),
          isConfigured,
          keyPlaceholder: meta.keyPlaceholder || 'Enter API key...',
          helpUrl: meta.helpUrl || '',
          lastDiscoveryAt: p.lastDiscoveryAt || 0,
          diagnostics: {
            ...diag,
            isConfigured,
          },
        };
      })
      .filter(Boolean);

    const activeMeta = PROVIDER_METADATA[this.activeProviderId] || {};
    return {
      activeProvider: this.activeProviderId,
      activeModel: this.activeModelId,
      activeProviderName: this.providers.get(this.activeProviderId)?.getName() || 'NEXUS 1',
      activeSecondaryName: activeMeta.secondaryName || 'Gemini',
      providers: providersList,
    };
  }

  setConfig(providerId, modelId) {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      this.activeModelId = this.synchronizeSlotModel(providerId, modelId);
      if (!this.isNexusSlot(providerId)) this.activeModelId = this.getValidModelId(providerId, modelId);
      this.saveActiveSelection(this.activeProviderId, this.activeModelId);
      return { success: true, activeProvider: this.activeProviderId, activeModel: this.activeModelId };
    }
    return { success: false, error: `Unsupported provider: ${providerId}` };
  }

  async setApiKey(providerId, apiKey) {
    if (!this.providers.has(providerId)) {
      return { success: false, error: `Unsupported provider: ${providerId}` };
    }

    const provider = this.providers.get(providerId);
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
      this.apiKeys.delete(providerId);
      this.keyValidationStatus.delete(providerId);
      this.removeKeyFromVault(providerId);
      return { success: true, status: PROVIDER_STATUS.NOT_CONFIGURED, maskedKey: '', configured: false };
    }

    if (trimmedKey.length < 8) {
      return {
        success: false,
        status: PROVIDER_STATUS.INVALID_KEY,
        error: 'API key is too short. Please check your credential.',
        configured: false,
      };
    }

    this.apiKeys.set(providerId, trimmedKey);
    this.keyValidationStatus.set(providerId, PROVIDER_STATUS.CONNECTED);
    this.saveKeyToVault(providerId, trimmedKey);
    this.activeProviderId = providerId;
    this.activeModelId = this.synchronizeSlotModel(providerId, this.getValidModelId(providerId));
    if (!this.isNexusSlot(providerId)) this.activeModelId = this.getValidModelId(providerId);
    this.saveActiveSelection(this.activeProviderId, this.activeModelId);

    return {
      success: true,
      status: PROVIDER_STATUS.CONNECTED,
      maskedKey: this.getMaskedKey(providerId),
      configured: true,
      models: provider.getModels(),
    };
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

  async getProviderDiagnostics(providerId = 'nexus1') {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        authenticated: false,
        reachable: false,
        error: `Unknown provider: ${providerId}`,
        models: [],
        configuredModel: this.getSelectedModelId(providerId),
        configuredModelAvailable: false,
      };
    }

    const apiKey = this.apiKeys.get(providerId);
    const meta = PROVIDER_METADATA[providerId] || {};
    const lastDiag = this.slotDiagnostics.get(providerId);

    if (!apiKey || !apiKey.trim()) {
      return {
        providerId,
        name: provider.getName(),
        secondaryName: meta.secondaryName || 'Gemini',
        slotIndex: meta.slotIndex || null,
        authenticated: false,
        reachable: false,
        error: 'API key is missing or not configured',
        models: provider.getModels(),
        configuredModel: this.getSelectedModelId(providerId),
        configuredModelAvailable: false,
        lastRequestAt: lastDiag?.lastRequestAt || null,
        lastStatus: lastDiag?.status || 'NOT_CONFIGURED',
      };
    }

    if (typeof provider.getAvailableModels === 'function') {
      const configuredModel = this.getSelectedModelId(providerId);
      const diag = await provider.getAvailableModels(apiKey, configuredModel);
      if (diag.authenticated && diag.reachable && this.isNexusSlot(providerId)) {
        const correctedModel = this.synchronizeSlotModel(providerId, configuredModel, true);
        diag.configuredModel = correctedModel;
        diag.configuredModelAvailable = diag.models.some((model) => model.id === correctedModel);
      }
      return {
        ...diag,
        providerId,
        name: provider.getName(),
        secondaryName: meta.secondaryName || 'Gemini',
        slotIndex: meta.slotIndex || null,
        lastRequestAt: lastDiag?.lastRequestAt || null,
        lastStatus: lastDiag?.status || (diag.authenticated ? 'CONNECTED' : 'ERROR'),
      };
    }

    return {
      authenticated: true,
      reachable: true,
      providerId,
      name: provider.getName(),
      secondaryName: meta.secondaryName || 'Gemini',
      slotIndex: meta.slotIndex || null,
      models: provider.getModels(),
      configuredModel: this.getSelectedModelId(providerId),
      configuredModelAvailable: true,
      lastRequestAt: lastDiag?.lastRequestAt || null,
      lastStatus: lastDiag?.status || 'CONNECTED',
    };
  }

  /**
   * Resolves target provider, model, and isolated key.
   * GUARANTEE: Never sends one provider's key to another provider.
   * If the target provider is not configured, returns null (delegates to offline deterministic engine).
   */
  resolveProviderAndModel(requestedProviderId, requestedModelId) {
    const pId = requestedProviderId || this.activeProviderId || PROVIDER_IDS.NEXUS_1;
    const mId = requestedModelId || this.getSelectedModelId(pId);

    let provider = this.providers.get(pId);
    let apiKey = provider ? this.apiKeys.get(pId) : null;

    if (provider && provider.isConfigured(apiKey)) {
      const targetModel = this.getValidModelId(pId, mId);
      this.synchronizeSlotModel(pId, targetModel, true);
      return {
        provider,
        apiKey,
        modelId: targetModel,
        isFallback: false,
        requestedProviderId: pId,
        requestedModelId: targetModel,
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
