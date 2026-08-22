/**
 * NEXUS Multi-Model AI Architecture - Abstract Base Provider
 */

class AIProvider {
  constructor(id, name, models = [], defaultModel = '') {
    this.id = id;
    this.name = name;
    this.models = models || [];
    this.staticModels = models || [];
    this.dynamicModels = null;
    this.defaultModel = defaultModel;
    this.lastDiscoveryAt = 0;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getModels() {
    if (this.dynamicModels && this.dynamicModels.length > 0) {
      return this.dynamicModels;
    }
    return this.models || this.staticModels || [];
  }

  getDefaultModel() {
    if (this.dynamicModels && this.dynamicModels.length > 0) {
      return this.dynamicModels[0].id;
    }
    return this.defaultModel;
  }

  isConfigured(apiKey) {
    return Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);
  }

  async getAvailableModels(apiKey, configuredModel = null) {
    return {
      authenticated: this.isConfigured(apiKey),
      reachable: true,
      models: this.getModels().map((m) => ({
        id: m.id,
        name: m.name || m.id,
        active: true,
        ownedBy: this.name,
        contextWindow: m.contextWindow || 8192,
        capabilities: m.capabilities || { chat: true, tools: true, vision: false },
      })),
      configuredModel: configuredModel || this.getDefaultModel(),
      configuredModelAvailable: true,
      totalModels: this.getModels().length,
      lastDiscoveryAt: this.lastDiscoveryAt || Date.now(),
    };
  }

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: `${this.name} API key is missing or empty` };
    }
    const diag = await this.getAvailableModels(apiKey);
    return {
      valid: Boolean(diag.authenticated && diag.reachable),
      models: this.getModels(),
      error: diag.error,
    };
  }

  async validateModelAvailability(apiKey, modelId) {
    if (!this.isConfigured(apiKey)) {
      throw new Error(`${this.name} API key is not configured`);
    }

    const diag = await this.getAvailableModels(apiKey, modelId);
    if (!diag.reachable && !diag.authenticated) {
      if (diag.statusCode === 401 || diag.statusCode === 403) {
        throw new Error(`Authentication/permission failed for ${this.name} (HTTP ${diag.statusCode}). Please check your API key.`);
      }
      throw new Error(`Unable to reach ${this.name} API: ${diag.error || 'Connection failed'}`);
    }

    if (diag.models && diag.models.length > 0) {
      const exists = diag.models.some((m) => m.id === modelId);
      if (!exists) {
        const availableIds = diag.models.map((m) => m.id).join(', ');
        throw new Error(
          `Selected model "${modelId}" is unavailable for this API key. Available models: [${availableIds}]. Please select an available model from the model selector.`
        );
      }
    }
    return true;
  }

  async generateAgentPlan(apiKey, model, payload) {
    throw new Error(`generateAgentPlan not implemented for provider ${this.id}`);
  }

  async generateCodeAction(apiKey, model, payload) {
    throw new Error(`generateCodeAction not implemented for provider ${this.id}`);
  }
}

module.exports = AIProvider;
