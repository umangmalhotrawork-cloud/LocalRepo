/**
 * NEXUS Multi-Model AI Architecture - Abstract Base Provider
 */

class AIProvider {
  constructor(id, name, models = [], defaultModel = '') {
    this.id = id;
    this.name = name;
    this.models = models;
    this.defaultModel = defaultModel;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getModels() {
    return this.models;
  }

  getDefaultModel() {
    return this.defaultModel;
  }

  isConfigured(apiKey) {
    return Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);
  }

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: 'API key is missing or empty' };
    }
    return { valid: true };
  }

  async generateAgentPlan(apiKey, model, payload) {
    throw new Error(`generateAgentPlan not implemented for provider ${this.id}`);
  }

  async generateCodeAction(apiKey, model, payload) {
    throw new Error(`generateCodeAction not implemented for provider ${this.id}`);
  }
}

module.exports = AIProvider;
