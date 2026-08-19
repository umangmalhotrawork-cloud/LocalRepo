/**
 * NEXUS Multi-Model AI Architecture - Gemini Provider Adapter
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const AIProvider = require('./AIProvider');
const { PROVIDER_IDS } = require('./types');

class GeminiProvider extends AIProvider {
  constructor() {
    super(
      PROVIDER_IDS.GEMINI,
      'Gemini',
      [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      ],
      'gemini-1.5-flash'
    );
  }

  async validateKey(apiKey) {
    if (!this.isConfigured(apiKey)) {
      return { valid: false, error: 'Gemini API key is missing' };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const responseText = await new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`API returned status ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Connection timed out'));
        });
      });

      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed.models)) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid response from Gemini API' };
    } catch (err) {
      return { valid: false, error: err.message || 'Key validation failed' };
    }
  }

  async generateAgentPlan(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error('Gemini API key is not configured');
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

    const selectedModel = model || this.defaultModel;
    const relativeTarget = path.relative(workspacePath, targetFile) || path.basename(targetFile);
    const orderedFiles = [targetFile, ...files.filter((file) => path.resolve(file) !== path.resolve(targetFile))];

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

    const systemPrompt = `${contextPrefix}You are NEXUS Autonomous AI Agent powered by Gemini.
Analyze the workspace and task, then output a structured JSON plan with maximum ${maxSteps} steps.${readOnlyDirective}
Task: "${task}"
Active editor file: "${relativeTarget}". Treat it as the primary analysis target. All proposedEdits must target this file.

Workspace files context:
${fileSummaries}

Format strictly as JSON:
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

    const requestBody = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const responseText = await new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
          timeout: 20000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('error', reject);
          res.on('aborted', () => reject(new Error('Gemini API response aborted')));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else if (res.statusCode === 400 || res.statusCode === 403) {
              reject(new Error('Invalid Gemini API key or request parameters'));
            } else if (res.statusCode === 429) {
              reject(new Error('Gemini API rate limit exceeded'));
            } else {
              reject(new Error(`Gemini API error (Status ${res.statusCode})`));
            }
          });
        }
      );

      req.on('error', (err) => reject(new Error(`Network error connecting to Gemini: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Gemini API request timed out'));
      });
      req.write(requestBody);
      req.end();
    });

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Malformed response received from Gemini API');
    }

    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON structure returned by Gemini model');
    }

    let agentData;
    try {
      agentData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error('Failed to parse Gemini plan JSON');
    }

    if (activeFilePath && Array.isArray(agentData.steps)) {
      const hasWrongTarget = agentData.steps.some((step) =>
        (step.proposedEdits || []).some((edit) =>
          path.resolve(workspacePath, edit.filePath) !== path.resolve(targetFile)
        )
      );
      if (hasWrongTarget) {
        throw new Error('Gemini plan did not target the active editor file');
      }
    }

    if (intent === 'READ_ONLY') {
      agentData.taskIntent = 'READ_ONLY';
      if (Array.isArray(agentData.steps)) {
        agentData.steps.forEach((step) => {
          step.proposedEdits = [];
          if (step.filesRead && Array.isArray(step.filesRead)) {
            step.filesRead = Array.from(new Set(step.filesRead));
          }
        });
      }
    }

    return agentData;
  }

  async generateCodeAction(apiKey, model, payload = {}) {
    if (!this.isConfigured(apiKey)) {
      throw new Error('Gemini API key is not configured');
    }

    const {
      action = 'explain',
      language = 'python',
      filePath = '',
      selection = '',
      fullFile = '',
      continuumContextText = '',
    } = payload;

    const selectedModel = model || this.defaultModel;
    const contextPrefix = continuumContextText ? `${continuumContextText}\n\n---\n\n` : '';
    const systemPrompt = `${contextPrefix}You are an expert AI code assistant integrated into NEXUS Workbench.
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

If your response proposes replacement code for the selection, ensure the replacement is valid.`;

    const requestBody = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nCode Selection:\n\`\`\`${language}\n${selection}\n\`\`\`\n\nFull File Context (reference):\n\`\`\`${language}\n${fullFile.slice(0, 3000)}\n\`\`\`` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const responseText = await new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
          timeout: 15000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else if (res.statusCode === 400 || res.statusCode === 403) {
              reject(new Error('Invalid Gemini API key or request parameters'));
            } else if (res.statusCode === 429) {
              reject(new Error('Gemini API rate limit exceeded'));
            } else {
              reject(new Error(`Gemini API returned status ${res.statusCode}`));
            }
          });
        }
      );

      req.on('error', (err) => reject(new Error(`Network error connecting to Gemini: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Gemini API request timed out'));
      });

      req.write(requestBody);
      req.end();
    });

    const json = JSON.parse(responseText);
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

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
    };
  }
}

module.exports = GeminiProvider;
