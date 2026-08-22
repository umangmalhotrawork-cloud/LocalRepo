/**
 * NEXUS CODEX HARNESS - MODEL ADAPTER
 * Normalizes multi-model prompt formatting, tool declarations, and tool-call responses
 * across OpenAI, Gemini, Claude, Groq, DeepSeek, Grok, and simulated test handlers.
 */

const { aiProviderRouter } = require('../ai/AIProviderRouter');
const secretFilter = require('../../security/secretFilter');

class ModelAdapter {
  constructor(router = aiProviderRouter) {
    this.router = router;
  }

  /**
   * Formats tool definitions into a provider-neutral schema declaration block.
   * @param {Array<Object>} tools
   * @returns {string} Formatted tool specification instructions
   */
  formatToolsPrompt(tools = []) {
    if (!tools || tools.length === 0) return '';

    const lines = [
      '## AVAILABLE TOOLS',
      'You have access to the following tools to inspect, verify, and mutate the workspace:',
      '',
    ];

    for (const tool of tools) {
      lines.push(`### Tool: \`${tool.name}\``);
      lines.push(`${tool.description}`);
      lines.push('Input JSON Schema:');
      lines.push('```json');
      lines.push(JSON.stringify(tool.inputSchema || {}, null, 2));
      lines.push('```');
      lines.push('');
    }

    lines.push('## TOOL CALL PROTOCOL');
    lines.push('When you need to use one or more tools, respond with a JSON code block containing the tool call:');
    lines.push('```json');
    lines.push('{');
    lines.push('  "tool_calls": [');
    lines.push('    {');
    lines.push('      "callId": "call_1",');
    lines.push('      "toolName": "read_file",');
    lines.push('      "arguments": { "path": "src/main.py" }');
    lines.push('    }');
    lines.push('  ]');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('## CRITICAL CODE MUTATION & PROPOSED CHANGES RULES');
    lines.push('1. Whenever you propose, plan, or execute a code change, fix, refactor, or edit (or when the user asks to propose a fix, show a diff, or create a ChangeSet), you MUST invoke the `apply_patch` tool with your proposed edits.');
    lines.push('2. Invoking `apply_patch` is safe and non-destructive: it stages changes into an authoritative ChangeSet, calculates diffs, evaluates Patch Firewall safety, and requests user approval before anything touches disk.');
    lines.push('3. Do NOT output proposed code diffs solely as plain markdown text without invoking `apply_patch`. You MUST issue the `apply_patch` tool call to create the ChangeSet.');
    lines.push('When you have completed the task and have all necessary information, provide your final response directly as conversational text without any tool calls.');

    return lines.join('\n');
  }

  /**
   * Parses raw model text or structured response into a normalized ModelTurnOutput.
   * @param {string|Object} rawResponse
   * @returns {{ role: string, content: string|null, toolCalls: Array<Object> }}
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse) {
      return {
        role: 'assistant',
        content: '',
        toolCalls: [],
      };
    }

    // 1. If provider returned native structured tool calls (e.g. OpenAI / Groq tool_calls or toolCalls)
    const rawCalls = rawResponse.tool_calls || rawResponse.toolCalls;
    if (typeof rawResponse === 'object' && Array.isArray(rawCalls) && rawCalls.length > 0) {
      const toolCalls = rawCalls.map((tc, idx) => {
        let args = tc.function?.arguments || tc.arguments || tc.args || {};
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (e) { args = { raw: args }; }
        }
        return {
          type: 'tool_call',
          callId: tc.id || tc.callId || `call_${Date.now()}_${idx}`,
          toolName: tc.function?.name || tc.toolName || tc.name || tc.tool,
          arguments: args,
        };
      });

      return {
        role: 'assistant',
        content: rawResponse.content || null,
        toolCalls,
      };
    }

    const text = typeof rawResponse === 'string' ? rawResponse : (rawResponse.content || rawResponse.text || JSON.stringify(rawResponse));

    // 2. Check for explicit ```json { "tool_calls": [...] } ``` blocks
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    const foundToolCalls = [];
    let textWithoutToolJson = text;

    while ((match = jsonBlockRegex.exec(text)) !== null) {
      const candidateStr = match[1].trim();
      try {
        const parsed = JSON.parse(candidateStr);
        if (parsed && Array.isArray(parsed.tool_calls)) {
          for (let i = 0; i < parsed.tool_calls.length; i++) {
            const tc = parsed.tool_calls[i];
            if (tc && (tc.toolName || tc.tool || tc.name)) {
              foundToolCalls.push({
                type: 'tool_call',
                callId: tc.callId || tc.id || `call_${Date.now()}_${i}`,
                toolName: tc.toolName || tc.tool || tc.name,
                arguments: tc.arguments || tc.args || {},
              });
            }
          }
          textWithoutToolJson = textWithoutToolJson.replace(match[0], '').trim();
        } else if (parsed && (parsed.toolName || parsed.tool) && parsed.arguments) {
          foundToolCalls.push({
            type: 'tool_call',
            callId: parsed.callId || `call_${Date.now()}_0`,
            toolName: parsed.toolName || parsed.tool,
            arguments: parsed.arguments || parsed.args || {},
          });
          textWithoutToolJson = textWithoutToolJson.replace(match[0], '').trim();
        }
      } catch (e) {
        // Not a JSON tool call block, continue
      }
    }

    // 3. Check for standalone JSON without markdown block
    if (foundToolCalls.length === 0 && text.trim().startsWith('{') && text.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(text.trim());
        if (parsed && Array.isArray(parsed.tool_calls)) {
          for (let i = 0; i < parsed.tool_calls.length; i++) {
            const tc = parsed.tool_calls[i];
            if (tc && (tc.toolName || tc.tool || tc.name)) {
              foundToolCalls.push({
                type: 'tool_call',
                callId: tc.callId || tc.id || `call_${Date.now()}_${i}`,
                toolName: tc.toolName || tc.tool || tc.name,
                arguments: tc.arguments || tc.args || {},
              });
            }
          }
          textWithoutToolJson = '';
        } else if (parsed && (parsed.toolName || parsed.tool)) {
          foundToolCalls.push({
            type: 'tool_call',
            callId: parsed.callId || `call_${Date.now()}_0`,
            toolName: parsed.toolName || parsed.tool,
            arguments: parsed.arguments || parsed.args || {},
          });
          textWithoutToolJson = '';
        }
      } catch (e) {}
    }

    return {
      role: 'assistant',
      content: secretFilter.sanitizeString(textWithoutToolJson || (foundToolCalls.length === 0 ? text : '')),
      toolCalls: foundToolCalls,
    };
  }

  /**
   * Invokes the model with conversational messages and tool definitions.
   * @param {Array<Object>} messages - Array of { role, content, tool_calls, tool_call_id }
   * @param {Array<Object>} tools - Array of tool declarations from ToolRegistry
   * @param {Object} options - { providerId, modelId, modelHandler, workspacePath, intent }
   * @returns {Promise<{ role: string, content: string|null, toolCalls: Array<Object> }>}
   */
  async invoke(messages = [], tools = [], options = {}) {
    // 1. If a custom or mock model handler is provided (e.g. for offline unit tests), use it directly
    if (typeof options.modelHandler === 'function') {
      const rawRes = await options.modelHandler(messages, tools, options);
      return this.normalizeResponse(rawRes);
    }

    // 2. Resolve target AI provider through AIProviderRouter
    const resolved = this.router.resolveProviderAndModel(options.providerId, options.modelId);
    if (!resolved) {
      throw new Error(
        `[HARNESS-MODELADAPTER] No configured AI provider available for providerId "${options.providerId || this.router.activeProviderId}". ` +
        `The iterative agent loop requires an active, configured provider or custom modelHandler.`
      );
    }

    const { provider, apiKey, modelId } = resolved;

    // 3. Build system prompt & messages
    const systemMessage = messages.find((m) => m.role === 'system');
    let existingSystemText = systemMessage ? systemMessage.content : 'You are NEXUS Autonomous AI Pair Programmer.';
    
    // Only include markdown tools prompt if native tools parameter is not supported/passed
    if (tools && tools.length > 0) {
      existingSystemText += '\n\n## RULES: When proposing or editing code, invoke apply_patch to create a ChangeSet.';
    }

    // Filter out existing system message to avoid duplicates
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Convert tool results in conversation into compact formatted user observation
    const formattedMessages = conversationMessages.map((m) => {
      if (m.role === 'tool') {
        const compactJson = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return {
          role: 'user',
          content: `[TOOL_RESULT for call "${m.tool_call_id}"]: ${compactJson}`,
        };
      }
      return {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };
    });

    const fullMessages = [
      { role: 'system', content: existingSystemText },
      ...formattedMessages,
    ];

    // 4. Call provider endpoint
    let rawText = '';
    if (typeof provider.request === 'function') {
      // OpenAI-compatible endpoint (Groq, OpenAI, DeepSeek, Grok)
      const requestPayload = {
        model: modelId,
        messages: fullMessages,
        temperature: 0.1,
        max_tokens: 3000,
      };

      if (tools && tools.length > 0) {
        requestPayload.tools = tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema || { type: 'object', properties: {} },
          },
        }));
        requestPayload.tool_choice = 'auto';
      }

      const res = await provider.request(
        '/chat/completions',
        'POST',
        apiKey,
        requestPayload,
        {},
        35000
      );
      const choiceMessage = res.data?.choices?.[0]?.message;
      return this.normalizeResponse(choiceMessage || res.data?.choices?.[0] || res.data?.choices?.[0]?.text || '');
    } else if (typeof provider.generateAgentPlan === 'function') {
      // General provider fallback
      const lastUserMsg = [...formattedMessages].reverse().find((m) => m.role === 'user')?.content || 'Continue task';
      const planRes = await provider.generateAgentPlan(apiKey, modelId, {
        task: `${combinedSystemPrompt}\n\n${lastUserMsg}`,
        workspacePath: options.workspacePath || process.cwd(),
      });
      rawText = planRes?.rawResponse || planRes?.summary || JSON.stringify(planRes);
      return this.normalizeResponse(rawText);
    } else {
      throw new Error(`[HARNESS-MODELADAPTER] Provider "${provider.getId()}" does not support iterative invocation.`);
    }
  }

  /**
   * Streams model output progressively as normalized deltas.
   * Supports native provider SSE streaming or clean non-streaming fallback.
   * @param {Array<Object>} messages
   * @param {Array<Object>} tools
   * @param {Object} options
   * @returns {AsyncIterable<{ type: string, delta?: string, accumulated?: string, toolCalls?: Array<Object>, finishReason?: string|null, sequence?: number }>}
   */
  async *stream(messages = [], tools = [], options = {}) {
    let sequence = 0;
    let accumulatedText = '';

    // 1. If mock or custom model handler is provided
    if (typeof options.modelHandler === 'function') {
      const handlerRes = options.modelHandler(messages, tools, options);

      // Check if handler returns an AsyncIterable or generator
      if (handlerRes && typeof handlerRes[Symbol.asyncIterator] === 'function') {
        for await (const chunk of handlerRes) {
          sequence++;
          const deltaStr = typeof chunk === 'string' ? chunk : (chunk.delta || chunk.content || '');
          accumulatedText += deltaStr;
          yield {
            type: chunk.toolCalls ? 'tool_call_delta' : 'message_delta',
            delta: deltaStr,
            accumulated: accumulatedText,
            toolCalls: chunk.toolCalls || null,
            finishReason: chunk.finishReason || null,
            sequence,
          };
        }
        return;
      }

      // Non-streaming handler: await and yield one assembled completed response
      const rawRes = await handlerRes;
      const normalized = this.normalizeResponse(rawRes);
      yield {
        type: normalized.toolCalls.length > 0 ? 'tool_call_delta' : 'message_delta',
        delta: normalized.content || '',
        accumulated: normalized.content || '',
        toolCalls: normalized.toolCalls,
        finishReason: 'stop',
        sequence: 1,
      };
      return;
    }

    // 2. Resolve provider and model
    const resolved = this.router.resolveProviderAndModel(options.providerId, options.modelId);
    if (!resolved) {
      throw new Error(
        `[HARNESS-MODELADAPTER] No configured AI provider available for providerId "${options.providerId || this.router.activeProviderId}". ` +
        `The iterative agent loop requires an active, configured provider or custom modelHandler.`
      );
    }

    const { provider, apiKey, modelId } = resolved;

    // 3. Build system prompt & messages
    const systemMessage = messages.find((m) => m.role === 'system');
    let existingSystemText = systemMessage ? systemMessage.content : 'You are NEXUS Autonomous AI Pair Programmer.';
    if (tools && tools.length > 0) {
      existingSystemText += '\n\n## RULES: When proposing or editing code, invoke apply_patch to create a ChangeSet.';
    }

    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const formattedMessages = conversationMessages.map((m) => {
      if (m.role === 'tool') {
        const compactJson = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return {
          role: 'user',
          content: `[TOOL_RESULT for call "${m.tool_call_id}"]: ${compactJson}`,
        };
      }
      return {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };
    });

    const fullMessages = [
      { role: 'system', content: existingSystemText },
      ...formattedMessages,
    ];

    // 4. Native SSE Streaming if supported
    if (typeof provider.streamChatCompletions === 'function') {
      try {
        const stream = provider.streamChatCompletions(apiKey, modelId, fullMessages, {
          temperature: 0.1,
          maxTokens: options.maxTokens ?? 1500,
          tools,
          abortSignal: options.abortSignal,
        });

        let capturedNativeToolCalls = [];

        for await (const chunk of stream) {
          sequence++;
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            capturedNativeToolCalls = chunk.toolCalls;
            yield {
              type: 'tool_call_delta',
              delta: '',
              accumulated: accumulatedText,
              toolCalls: capturedNativeToolCalls,
              finishReason: chunk.finishReason || null,
              sequence,
            };
          }
          if (chunk.content) {
            accumulatedText += chunk.content;
            yield {
              type: 'message_delta',
              delta: chunk.content,
              accumulated: accumulatedText,
              finishReason: chunk.finishReason || null,
              sequence,
            };
          }
        }

        if (capturedNativeToolCalls.length > 0) {
          return;
        }

        // Parse accumulated text for JSON tool calls if any
        const normalized = this.normalizeResponse(accumulatedText);
        if (normalized.toolCalls.length > 0) {
          yield {
            type: 'tool_call_delta',
            delta: '',
            accumulated: normalized.content,
            toolCalls: normalized.toolCalls,
            finishReason: 'stop',
            sequence: sequence + 1,
          };
        }
        if (this.router && typeof this.router.recordSlotRequest === 'function') {
          this.router.recordSlotRequest(resolved.provider.getId(), 'SUCCESS', resolved.modelId);
        }
        return;
      } catch (streamErr) {
        if (options.abortSignal?.aborted) {
          throw streamErr;
        }
        const { parseRateLimitError } = require('../ai/types');
        const rateInfo = parseRateLimitError(streamErr, options.providerId || resolved?.provider?.getId(), options.modelId || resolved?.modelId);
        if (this.router && typeof this.router.recordSlotRequest === 'function') {
          this.router.recordSlotRequest(
            options.providerId || resolved?.provider?.getId(),
            rateInfo ? '429_RATE_LIMIT' : 'ERROR',
            options.modelId || resolved?.modelId
          );
        }
        if (rateInfo) {
          streamErr.isRateLimit = true;
          streamErr.rateInfo = rateInfo;
          throw streamErr;
        }
        // If streaming failed for other non-rate-limit reasons and wasn't aborted, fall back to non-streaming invoke below
      }
    }

    // 5. Non-streaming fallback
    const fallbackRes = await this.invoke(messages, tools, options);
    yield {
      type: fallbackRes.toolCalls.length > 0 ? 'tool_call_delta' : 'message_delta',
      delta: fallbackRes.content || '',
      accumulated: fallbackRes.content || '',
      toolCalls: fallbackRes.toolCalls,
      finishReason: 'stop',
      sequence: 1,
    };
  }
}

const modelAdapter = new ModelAdapter();

module.exports = {
  ModelAdapter,
  modelAdapter,
};
