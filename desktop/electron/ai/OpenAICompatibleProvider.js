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

  request(endpoint, method = 'GET', apiKey = '', body = null, headers = {}, timeoutMs = 25000) {
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

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: `${this.name} API key is missing or empty` };
    }

    try {
      const res = await this.request('/models', 'GET', apiKey, null, {}, 12000);
      const rawModels = res.data?.data || (Array.isArray(res.data) ? res.data : []);

      if (Array.isArray(rawModels) && rawModels.length > 0) {
        // Filter and map relevant models
        const mapped = rawModels
          .filter((m) => {
            const id = (m.id || '').toLowerCase();
            // Filter out non-chat / whisper / embedding models if possible
            if (id.includes('embed') || id.includes('whisper') || id.includes('tts') || id.includes('dall-e') || id.includes('audio') || id.includes('moderation') || id.includes('guard')) {
              return false;
            }
            return true;
          })
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
          }));

        if (mapped.length > 0) {
          // Prepend default model if present in static list
          const combinedMap = new Map();
          for (const sm of this.staticModels) combinedMap.set(sm.id, sm);
          for (const dm of mapped) {
            if (!combinedMap.has(dm.id)) {
              combinedMap.set(dm.id, dm);
            }
          }
          this.dynamicModels = Array.from(combinedMap.values());
        }
      }

      return { valid: true, models: this.getModels() };
    } catch (err) {
      const code = err.statusCode;
      let userFriendly = err.message;
      if (code === 401 || userFriendly.toLowerCase().includes('invalid') || userFriendly.toLowerCase().includes('auth')) {
        userFriendly = `Invalid ${this.name} API key. Please verify your credentials.`;
      } else if (code === 429) {
        userFriendly = `${this.name} rate limit or quota exceeded.`;
      }
      return { valid: false, error: userFriendly, statusCode: code };
    }
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

    const systemPrompt = `${contextPrefix}You are NEXUS Autonomous AI Agent powered by ${this.name}.
Analyze the workspace and task, then output a structured JSON plan with maximum ${maxSteps} steps.${readOnlyDirective}
Active editor file: "${relativeTarget}". Treat it as the primary analysis target. All proposedEdits must target this file.

Workspace files context:
${fileSummaries}

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "summary": "<High level execution summary>",
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

    const requestBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task Directive: "${task}"\nGenerate the structured execution plan in JSON.` },
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
