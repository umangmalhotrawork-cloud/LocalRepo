/**
 * NEXUS Multi-Model AI Architecture - Anthropic Claude Provider Adapter
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const AIProvider = require('./AIProvider');
const { PROVIDER_IDS, DEFAULT_MODELS } = require('./types');

class ClaudeProvider extends AIProvider {
  constructor() {
    super(
      PROVIDER_IDS.CLAUDE,
      'Claude',
      [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
      ],
      DEFAULT_MODELS[PROVIDER_IDS.CLAUDE] || 'claude-3-5-sonnet-20241022'
    );
    this.dynamicModels = null;
  }

  getModels() {
    if (this.dynamicModels && this.dynamicModels.length > 0) {
      return this.dynamicModels;
    }
    return this.models;
  }

  request(endpoint, method = 'GET', apiKey = '', body = null, timeoutMs = 25000) {
    const parsed = new URL(`https://api.anthropic.com/v1${endpoint}`);

    const requestHeaders = {
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'User-Agent': 'NEXUS-Workbench-App',
      'Accept': 'application/json',
    };

    let postData = null;
    if (body !== null && body !== undefined) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          port: 443,
          path: `${parsed.pathname}${parsed.search}`,
          method,
          headers: requestHeaders,
          timeout: timeoutMs,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(raw);
            } catch (e) {
              json = null;
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ statusCode: res.statusCode, data: json || raw, raw });
            } else {
              const errMsg = json?.error?.message || json?.message || raw || `HTTP ${res.statusCode}`;
              const err = new Error(errMsg);
              err.statusCode = res.statusCode;
              err.data = json;
              reject(err);
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Connection to Claude API timed out after ${timeoutMs}ms`));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  async getAvailableModels(apiKey, configuredModel = null) {
    if (!this.isConfigured(apiKey)) {
      return {
        authenticated: false,
        reachable: false,
        error: 'Claude API key is missing or empty',
        models: [],
        configuredModel: configuredModel || this.getDefaultModel(),
        configuredModelAvailable: false,
      };
    }

    try {
      const res = await this.request('/models', 'GET', apiKey, null, 12000);
      const rawModels = res.data?.data || (Array.isArray(res.data) ? res.data : []);

      const mapped = rawModels
        .filter((m) => m.id && typeof m.id === 'string' && m.id.includes('claude'))
        .map((m) => ({
          id: m.id,
          name: m.display_name || m.id,
          active: true,
          ownedBy: 'Anthropic',
          contextWindow: 200000,
          capabilities: { chat: true, tools: true, vision: true },
        }));

      this.lastDiscoveryAt = Date.now();
      if (mapped.length > 0) {
        this.dynamicModels = mapped;
      }

      const activeTarget = configuredModel || this.getDefaultModel();
      const isAvailable = (mapped.length > 0 ? mapped : this.getModels()).some((m) => m.id === activeTarget);

      return {
        authenticated: true,
        reachable: true,
        models: mapped.length > 0 ? mapped : this.getModels(),
        configuredModel: activeTarget,
        configuredModelAvailable: isAvailable,
        totalModels: (mapped.length > 0 ? mapped : this.getModels()).length,
        lastDiscoveryAt: this.lastDiscoveryAt,
      };
    } catch (err) {
      const code = err.statusCode || 0;
      const isAuthError = code === 401 || (err.message && (err.message.includes('auth') || err.message.includes('invalid') || err.message.includes('key')));
      return {
        authenticated: !isAuthError && code !== 0,
        reachable: code > 0,
        error: isAuthError ? `Authentication failed (HTTP ${code}): ${err.message}` : `Connection failed: ${err.message}`,
        statusCode: code,
        models: [],
        configuredModel: configuredModel || this.getDefaultModel(),
        configuredModelAvailable: false,
      };
    }
  }

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: 'Claude API key is missing or empty' };
    }
    const diag = await this.getAvailableModels(apiKey);
    if (diag.authenticated && diag.reachable) {
      return { valid: true, models: this.getModels() };
    }
    return { valid: false, error: diag.error || 'Claude key validation failed', statusCode: diag.statusCode };
  }

  async generateAgentPlan(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error('Claude API key is not configured');
    }

    const selectedModel = model || this.getDefaultModel();
    await this.validateModelAvailability(apiKey, selectedModel);

    const {
      task = '',
      workspacePath = process.cwd(),
      maxSteps = 5,
      activeFilePath,
      continuumContextText = '',
      files = [],
      targetFile,
      intent = 'MUTATION',
    } = payload;

    const relativeTarget = targetFile ? (path.relative(workspacePath, targetFile) || path.basename(targetFile)) : 'workspace';
    const orderedFiles = targetFile ? [targetFile, ...files.filter((f) => path.resolve(f) !== path.resolve(targetFile))] : files;

    const fileSummaries = orderedFiles.slice(0, 10).map((f) => {
      try {
        const content = fs.readFileSync(f, 'utf8');
        return `File: ${path.relative(workspacePath, f)}\n${content.slice(0, 800)}\n---`;
      } catch (e) {
        return `File: ${path.relative(workspacePath, f)} (unreadable)`;
      }
    }).join('\n\n');

    const contextPrefix = continuumContextText ? `${continuumContextText}\n\n---\n\n` : '';
    const readOnlyDirective = intent === 'READ_ONLY'
      ? '\nCRITICAL DIRECTIVE: This is a READ_ONLY analysis task. DO NOT generate code modifications or surgical patches. Return empty proposedEdits: [] for all steps.'
      : '';

    let systemPrompt;
    if (intent === 'GENERAL_CHAT') {
      systemPrompt = `${contextPrefix}You are NEXUS AI Assistant powered by Claude.
Respond conversationally, helpfully, and concisely to the user's message.
DO NOT generate any code modifications or surgical patches.

Workspace files context:
${fileSummaries}

Respond ONLY with a valid JSON object matching this schema:
{
  "summary": "<Helpful conversational response>",
  "taskIntent": "GENERAL_CHAT",
  "steps": []
}`;
    } else {
      systemPrompt = `${contextPrefix}You are NEXUS Autonomous AI Agent powered by Claude.
Analyze the workspace and task, then output a structured JSON plan with maximum ${maxSteps} steps.${readOnlyDirective}
Active editor file: "${relativeTarget}". Treat it as the primary analysis target. All proposedEdits must target this file.

Workspace files context:
${fileSummaries}

Respond ONLY with a valid JSON object strictly matching this schema (no markdown wrap, no conversational filler):
{
  "summary": "<High level execution summary>",
  "taskIntent": "${intent}",
  "steps": [
    {
      "id": "step-1",
      "title": "<Short step title>",
      "reasoning": "<Technical reasoning for step>",
      "filesRead": ["<relative path>"],
      "proposedEdits": [
        {
          "filePath": "<relative path to file>",
          "original": "<exact code substring to replace>",
          "replacement": "<new replacement code>"
        }
      ]
    }
  ]
}`;
    }

    const requestBody = {
      model: selectedModel,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: intent === 'GENERAL_CHAT' ? `User message: "${task}"` : `Task Directive: "${task}"\nGenerate the structured execution plan in JSON.` },
      ],
      temperature: 0.1,
    };

    const res = await this.request('/messages', 'POST', apiKey, requestBody, 35000);
    const textPart = res.data?.content?.[0]?.text || '';

    if (!textPart || !textPart.trim()) {
      throw new Error('Empty response from Claude API');
    }

    let parsed = null;
    try {
      parsed = JSON.parse(textPart);
    } catch (parseErr) {
      const match = textPart.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (mErr) {}
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid JSON format returned from Claude model ${selectedModel}`);
    }

    const normalizedSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return {
      summary: parsed.summary || `Plan generated by Claude (${selectedModel})`,
      steps: normalizedSteps.map((s, idx) => ({
        id: s.id || `step-${idx + 1}`,
        title: s.title || `Step ${idx + 1}`,
        reasoning: s.reasoning || '',
        filesRead: Array.isArray(s.filesRead) ? s.filesRead : (s.filesRead ? [String(s.filesRead)] : []),
        proposedEdits: Array.isArray(s.proposedEdits)
          ? s.proposedEdits
              .filter((e) => e && (e.filePath || relativeTarget))
              .map((e) => ({
                filePath: e.filePath || relativeTarget,
                original: typeof e.original === 'string' ? e.original : '',
                replacement: typeof e.replacement === 'string' ? e.replacement : '',
              }))
          : [],
      })),
      rawResponse: textPart,
    };
  }

  async generateCodeAction(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error('Claude API key is not configured');
    }

    const {
      action = 'explain',
      language = 'python',
      filePath = '',
      selection = '',
      fullFile = '',
      continuumContextText = '',
    } = payload;

    const selectedModel = model || this.getDefaultModel();
    await this.validateModelAvailability(apiKey, selectedModel);
    const contextPrefix = continuumContextText ? `${continuumContextText}\n\n---\n\n` : '';

    const systemPrompt = `${contextPrefix}You are an expert AI code assistant integrated into NEXUS Workbench powered by Claude.
Your task is to perform the action "${action}" on the provided code selection.
Language: ${language}
File: ${filePath}

Instructions for output:
For "explain": Provide a clear, concise technical explanation of what the code does.
For "find_bug": Analyze the code for potential bugs, edge cases, off-by-one errors, or security risks.
For "fix": Identify bugs and provide a corrected version. Output the proposed fix in a markdown code block.
For "refactor": Improve readability, performance, and structure without altering observable behavior.
For "tests": Generate comprehensive unit tests (e.g. pytest for Python, Jest for JS/TS).
For "docs": Generate standard docstrings/JSDoc comments.

If your response proposes replacement code for the selection, ensure the replacement is enclosed in a markdown code block.`;

    const requestBody = {
      model: selectedModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Code Selection:\n\`\`\`${language}\n${selection}\n\`\`\`\n\nFull File Context (reference):\n\`\`\`${language}\n${(fullFile || '').slice(0, 3000)}\n\`\`\``,
        },
      ],
      temperature: 0.2,
    };

    const res = await this.request('/messages', 'POST', apiKey, requestBody, 25000);
    const text = res.data?.content?.[0]?.text || 'No response generated.';

    let proposedPatch = undefined;
    if (['fix', 'refactor', 'docs'].includes(action)) {
      const codeMatch = text.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/);
      if (codeMatch && codeMatch[1]) {
        proposedPatch = {
          original: selection,
          replacement: codeMatch[1],
        };
      }
    }

    return {
      success: true,
      action,
      response: text,
      proposedPatch,
      model: selectedModel,
      provider: this.getId(),
    };
  }
}

module.exports = ClaudeProvider;
