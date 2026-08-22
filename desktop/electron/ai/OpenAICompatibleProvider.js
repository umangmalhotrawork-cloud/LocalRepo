/**
 * NEXUS Multi-Model AI Architecture - OpenAI Compatible Base Provider Adapter
 * Powers OpenAI, Groq, DeepSeek, and Grok (xAI) using standard REST APIs.
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const AIProvider = require('./AIProvider');

class OpenAICompatibleProvider extends AIProvider {
  constructor(id, name, baseUrl, staticModels = [], defaultModel = '', options = {}) {
    super(id, name, staticModels, defaultModel);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.staticModels = staticModels;
    this.dynamicModels = null;
    this.options = options;
  }

  getModels() {
    if (this.dynamicModels && this.dynamicModels.length > 0) {
      return this.dynamicModels;
    }
    return this.staticModels;
  }

  async request(endpoint, method = 'GET', apiKey = '', body = null, headers = {}, timeoutMs = 25000, retryCount = 0) {
    try {
      return await this._rawRequest(endpoint, method, apiKey, body, headers, timeoutMs);
    } catch (err) {
      if (err.statusCode === 429 && retryCount < 2) {
        console.warn(`[${this.name}] Rate limit 429 hit, retrying in ${(retryCount + 1) * 2000}ms...`);
        await new Promise((r) => setTimeout(r, (retryCount + 1) * 2000));
        return this.request(endpoint, method, apiKey, body, headers, timeoutMs, retryCount + 1);
      }
      throw err;
    }
  }

  _rawRequest(endpoint, method = 'GET', apiKey = '', body = null, headers = {}, timeoutMs = 25000) {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const parsed = new URL(fullUrl);
    const transport = parsed.protocol === 'http:' ? http : https;

    const requestHeaders = {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'User-Agent': 'NEXUS-Workbench-App',
      'Accept': 'application/json',
      ...headers,
    };

    let postData = null;
    if (body !== null && body !== undefined) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
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
        reject(new Error(`Connection to ${this.name} timed out after ${timeoutMs}ms`));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  /**
   * Streams chat completions via standard Server-Sent Events (SSE).
   * @param {string} apiKey
   * @param {string} model
   * @param {Array<Object>} messages
   * @param {Object} options
   * @returns {AsyncIterable<Object>}
   */
  async *streamChatCompletions(apiKey, model, messages, options = {}) {
    const fullUrl = this.baseUrl.endsWith('/chat/completions')
      ? this.baseUrl
      : `${this.baseUrl}/chat/completions`;
    const parsed = new URL(fullUrl);
    const transport = parsed.protocol === 'http:' ? http : https;

    const requestHeaders = {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'User-Agent': 'NEXUS-Workbench-App',
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const payload = {
      model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 3000,
      stream: true,
      ...(options.extraBody || {}),
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema || { type: 'object', properties: {} },
        },
      }));
      payload.tool_choice = 'auto';
    }

    const postData = JSON.stringify(payload);
    requestHeaders['Content-Length'] = Buffer.byteLength(postData);

    const abortSignal = options.abortSignal;
    let req;

    const chunkQueue = [];
    let resolveNext = null;
    let rejectNext = null;
    let streamEnded = false;
    let streamError = null;

    const pushChunk = (item) => {
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        rejectNext = null;
        resolve(item);
      } else {
        chunkQueue.push(item);
      }
    };

    const pushError = (err) => {
      streamError = err;
      if (rejectNext) {
        const reject = rejectNext;
        resolveNext = null;
        rejectNext = null;
        reject(err);
      }
    };

    const pushEnd = () => {
      streamEnded = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        rejectNext = null;
        resolve(null);
      }
    };

    req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: requestHeaders,
        timeout: options.timeoutMs || 45000,
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errBody = '';
          res.on('data', (d) => (errBody += d));
          res.on('end', () => {
            pushError(new Error(`HTTP ${res.statusCode}: ${errBody || res.statusMessage}`));
          });
          return;
        }

        let buffer = '';
        const accumulatedToolCalls = new Map();

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep partial line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]') {
              continue;
            }
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              try {
                const parsedData = JSON.parse(dataStr);
                const choice = parsedData.choices?.[0];
                if (choice) {
                  const delta = choice.delta || {};
                  const finishReason = choice.finish_reason || null;

                  if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index !== undefined ? tc.index : 0;
                      if (!accumulatedToolCalls.has(idx)) {
                        accumulatedToolCalls.set(idx, {
                          id: tc.id || `call_${Date.now()}_${idx}`,
                          name: tc.function?.name || '',
                          arguments: '',
                        });
                      }
                      const existing = accumulatedToolCalls.get(idx);
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name = tc.function.name;
                      if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                    }
                  }

                  let assembledToolCalls = null;
                  if (finishReason === 'tool_calls' || (finishReason === 'stop' && accumulatedToolCalls.size > 0)) {
                    assembledToolCalls = Array.from(accumulatedToolCalls.values()).map((tc) => {
                      let args = {};
                      try {
                        args = JSON.parse(tc.arguments);
                      } catch (e) {
                        args = { raw: tc.arguments };
                      }
                      return {
                        type: 'tool_call',
                        callId: tc.id,
                        toolName: tc.name,
                        arguments: args,
                      };
                    });
                  }

                  pushChunk({
                    content: delta.content || '',
                    role: delta.role || 'assistant',
                    toolCalls: assembledToolCalls,
                    finishReason,
                    raw: parsedData,
                  });
                }
              } catch (parseErr) {
                // Ignore transient unparsed line
              }
            }
          }
        });

        res.on('end', () => {
          if (accumulatedToolCalls.size > 0) {
            const assembled = Array.from(accumulatedToolCalls.values()).map((tc) => {
              let args = {};
              try {
                args = JSON.parse(tc.arguments);
              } catch (e) {
                args = { raw: tc.arguments };
              }
              return {
                type: 'tool_call',
                callId: tc.id,
                toolName: tc.name,
                arguments: args,
              };
            });
            pushChunk({
              content: '',
              role: 'assistant',
              toolCalls: assembled,
              finishReason: 'tool_calls',
            });
          }
          pushEnd();
        });

        res.on('error', (err) => {
          pushError(err);
        });
      }
    );

    req.on('error', (err) => pushError(err));
    req.on('timeout', () => {
      req.destroy();
      pushError(new Error(`Stream connection to ${this.name} timed out`));
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        if (req && !req.destroyed) req.destroy();
        pushError(new Error('Stream aborted by client'));
      });
    }

    req.write(postData);
    req.end();

    try {
      while (true) {
        if (streamError) throw streamError;
        if (chunkQueue.length > 0) {
          const item = chunkQueue.shift();
          if (item) yield item;
        } else if (streamEnded) {
          break;
        } else {
          const item = await new Promise((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
          if (item) yield item;
        }
      }
    } finally {
      if (req && !req.destroyed) {
        req.destroy();
      }
    }
  }

  async getAvailableModels(apiKey, configuredModel = null) {
    if (!this.isConfigured(apiKey)) {
      return {
        authenticated: false,
        reachable: false,
        error: `${this.name} API key is missing or not configured`,
        models: [],
        configuredModel: configuredModel || this.getDefaultModel(),
        configuredModelAvailable: false,
      };
    }

    try {
      const res = await this.request('/models', 'GET', apiKey, null, {}, 15000);
      const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);

      const normalized = rawList
        .filter((m) => {
          const id = (m.id || '').toLowerCase();
          if (
            id.includes('embed') ||
            id.includes('whisper') ||
            id.includes('tts') ||
            id.includes('dall-e') ||
            id.includes('audio') ||
            id.includes('moderation') ||
            id.includes('guard')
          ) {
            return false;
          }
          return true;
        })
        .map((m) => ({
          id: m.id,
          name: m.id,
          active: m.active !== false,
          contextWindow: m.context_window || m.contextWindow || 8192,
          ownedBy: m.owned_by || m.ownedBy || this.name,
          capabilities: {
            chat: true,
            tools: true,
            vision: Boolean(m.id && (m.id.includes('vision') || m.id.includes('4o') || m.id.includes('vl'))),
          },
        }));

      this.lastDiscoveryAt = Date.now();
      if (normalized.length > 0) {
        this.dynamicModels = normalized;
      }

      const activeTarget = configuredModel || this.getDefaultModel();
      const isAvailable = normalized.some((m) => m.id === activeTarget);

      return {
        authenticated: true,
        reachable: true,
        models: normalized,
        configuredModel: activeTarget,
        configuredModelAvailable: isAvailable,
        totalModels: normalized.length,
        lastDiscoveryAt: this.lastDiscoveryAt,
      };
    } catch (err) {
      const statusCode = err.statusCode || 0;
      const isAuthError = statusCode === 401 || statusCode === 403 || (err.message && (err.message.includes('auth') || err.message.includes('key')));
      return {
        authenticated: !isAuthError && statusCode !== 0,
        reachable: statusCode > 0,
        error: isAuthError ? `Authentication/permission failed for ${this.name} (HTTP ${statusCode}): ${err.message}` : `Connection failed: ${err.message}`,
        statusCode,
        models: [],
        configuredModel: configuredModel || this.getDefaultModel(),
        configuredModelAvailable: false,
      };
    }
  }

  async validateModelAvailability(apiKey, modelId) {
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

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: `${this.name} API key is missing or empty` };
    }

    const diag = await this.getAvailableModels(apiKey);
    if (diag.authenticated && diag.reachable) {
      return { valid: true, models: this.getModels() };
    }

    return {
      valid: false,
      error: diag.error || `Invalid ${this.name} API key or connection failed.`,
      statusCode: diag.statusCode,
    };
  }

  async generateAgentPlan(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error(`${this.name} API key is not configured`);
    }

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

    const selectedModel = model || this.getDefaultModel();
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
      systemPrompt = `${contextPrefix}You are NEXUS AI Assistant powered by ${this.name}.
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
      systemPrompt = `${contextPrefix}You are NEXUS Autonomous AI Agent powered by ${this.name}.
Analyze the workspace and task, then output a structured JSON plan with maximum ${maxSteps} steps.${readOnlyDirective}
Active editor file: "${relativeTarget}". Treat it as the primary analysis target. All proposedEdits must target this file.

Workspace files context:
${fileSummaries}

Respond ONLY with a valid JSON object strictly matching this schema:
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

    await this.validateModelAvailability(apiKey, selectedModel);

    const requestBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: intent === 'GENERAL_CHAT' ? `User message: "${task}"` : `Task Directive: "${task}"\nGenerate the structured execution plan in JSON.` },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    };

    if (this.options.supportsJsonMode !== false) {
      requestBody.response_format = { type: 'json_object' };
    }

    let res;
    try {
      res = await this.request('/chat/completions', 'POST', apiKey, requestBody, {}, 35000);
    } catch (apiErr) {
      if (apiErr.data?.error?.message && apiErr.data.error.message.includes('response_format')) {
        delete requestBody.response_format;
        res = await this.request('/chat/completions', 'POST', apiKey, requestBody, {}, 35000);
      } else {
        throw apiErr;
      }
    }

    const content = res.data?.choices?.[0]?.message?.content || '';
    if (!content || !content.trim()) {
      throw new Error(`Empty response from ${this.name} API`);
    }

    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (mErr) {}
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid JSON format returned from ${this.name} model ${selectedModel}`);
    }

    const normalizedSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return {
      summary: parsed.summary || `Plan generated by ${this.name} (${selectedModel})`,
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
      rawResponse: content,
    };
  }

  async generateCodeAction(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error(`${this.name} API key is not configured`);
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
    const contextPrefix = continuumContextText ? `${continuumContextText}\n\n---\n\n` : '';

    const systemPrompt = `${contextPrefix}You are an expert AI code assistant integrated into NEXUS Workbench powered by ${this.name}.
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

    await this.validateModelAvailability(apiKey, selectedModel);

    const requestBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Code Selection:\n\`\`\`${language}\n${selection}\n\`\`\`\n\nFull File Context (reference):\n\`\`\`${language}\n${(fullFile || '').slice(0, 3000)}\n\`\`\``,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    };

    const res = await this.request('/chat/completions', 'POST', apiKey, requestBody, {}, 25000);
    const text = res.data?.choices?.[0]?.message?.content || 'No response generated.';

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

module.exports = OpenAICompatibleProvider;
