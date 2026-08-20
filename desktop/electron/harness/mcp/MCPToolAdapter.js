/**
 * NEXUS CODEX HARNESS - MCP TOOL ADAPTER
 * Normalizes external Model Context Protocol (MCP) tool declarations and execution
 * into standard provider-neutral Harness tool calls and tool results.
 */

const {
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
} = require("../types");
const secretFilter = require("../../../security/secretFilter");

class MCPToolAdapter {
  /**
   * Normalizes an MCP tool declaration into a standard Capability / Tool specification.
   * @param {Object} mcpTool
   * @param {string} mcpTool.name - Tool name
   * @param {string} [mcpTool.description] - Tool description
   * @param {Object} [mcpTool.inputSchema] - JSON Schema for input
   * @param {string} [mcpTool.serverId] - Associated MCP Server ID
   * @param {string} [mcpTool.riskLevel] - "SAFE" | "REVIEW_REQUIRED" | "HIGH_RISK" | "BLOCKED"
   * @param {boolean|Function} [mcpTool.requiresApproval]
   * @param {Function} [mcpTool.handler] - Direct execution handler if available
   * @param {import("./MCPServerManager").MCPServerManager} [serverManager]
   * @returns {Object} Normalized Capability definition
   */
  static normalizeTool(mcpTool = {}, serverManager = null) {
    if (!mcpTool || typeof mcpTool !== "object") {
      throw new Error("[HARNESS-MCP-ADAPTER] Invalid MCP tool definition: must be an object");
    }
    if (!mcpTool.name || typeof mcpTool.name !== "string" || !mcpTool.name.trim()) {
      throw new Error("[HARNESS-MCP-ADAPTER] MCP tool name is required");
    }

    const name = mcpTool.name.trim();
    const serverId = mcpTool.serverId || "mcp_default";
    const description = mcpTool.description || `External MCP capability provided by server "${serverId}"`;
    const inputSchema = mcpTool.inputSchema || { type: "object", properties: {} };
    
    // Evaluate risk policy
    let riskLevel = mcpTool.riskLevel || CAPABILITY_RISK_LEVEL.SAFE;
    if (mcpTool.blocked || riskLevel === CAPABILITY_RISK_LEVEL.BLOCKED) {
      riskLevel = CAPABILITY_RISK_LEVEL.BLOCKED;
    } else if (mcpTool.isDestructive || mcpTool.allowMutation || mcpTool.hasShellAccess) {
      riskLevel = mcpTool.hasShellAccess ? CAPABILITY_RISK_LEVEL.HIGH_RISK : CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED;
    }

    const requiresApproval = mcpTool.requiresApproval !== undefined
      ? mcpTool.requiresApproval
      : (riskLevel === CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED || riskLevel === CAPABILITY_RISK_LEVEL.HIGH_RISK);

    // Build the execution bridge
    const execute = async (args = {}, context = {}) => {
      const callId = context.callId || `mcp_call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Policy check
      if (riskLevel === CAPABILITY_RISK_LEVEL.BLOCKED) {
        return {
          type: "tool_result",
          callId,
          toolName: name,
          success: false,
          result: null,
          error: `Security Boundary: MCP tool "${name}" is permanently blocked by security policy.`,
        };
      }

      if (requiresApproval && !context.isApproved && context.approvalMode !== "auto") {
        return {
          type: "tool_result",
          callId,
          toolName: name,
          success: false,
          requiresApproval: true,
          policyDecision: {
            safe: false,
            riskLevel,
            requiresApproval: true,
            reason: `External MCP tool "${name}" requires operator review before execution.`,
          },
          error: `External tool "${name}" execution paused: requires operator approval (${riskLevel}).`,
        };
      }

      // 2. Sanitize arguments before sending to external MCP server
      const sanitizedArgs = secretFilter.sanitizeObject(args || {});

      try {
        let rawResult;
        if (typeof mcpTool.handler === "function") {
          rawResult = await mcpTool.handler(sanitizedArgs, context);
        } else if (serverManager && typeof serverManager.executeToolOnServer === "function") {
          rawResult = await serverManager.executeToolOnServer(serverId, name, sanitizedArgs, context);
        } else {
          throw new Error(`No execution handler or MCPServerManager available for tool "${name}"`);
        }

        // 3. Normalize and sanitize output
        const isSuccess = rawResult && rawResult.success !== false && !rawResult.isError;
        const sanitizedOutput = secretFilter.sanitizeObject(
          rawResult !== undefined ? (rawResult.result !== undefined ? rawResult.result : rawResult) : {}
        );

        return {
          type: "tool_result",
          callId,
          toolName: name,
          success: isSuccess,
          result: isSuccess ? sanitizedOutput : null,
          error: !isSuccess ? secretFilter.sanitizeString(rawResult?.error || "External tool execution failed") : null,
          metadata: {
            serverId,
            source: "mcp",
            executionTimeMs: rawResult?.executionTimeMs,
          },
        };
      } catch (err) {
        return {
          type: "tool_result",
          callId,
          toolName: name,
          success: false,
          result: null,
          error: secretFilter.sanitizeString(err.message || `MCP Tool "${name}" execution error`),
          metadata: { serverId, source: "mcp" },
        };
      }
    };

    const source = mcpTool.source || "mcp";

    return {
      name,
      description,
      source,
      type: CAPABILITY_TYPE.MCP_TOOL,
      inputSchema,
      riskLevel,
      requiresApproval,
      execute,
      metadata: {
        serverId,
        source,
        networkAllowed: Boolean(mcpTool.networkAllowed),
        isReadOnly: mcpTool.isReadOnly !== undefined ? Boolean(mcpTool.isReadOnly) : (riskLevel === CAPABILITY_RISK_LEVEL.SAFE),
        allowMutation: Boolean(mcpTool.allowMutation),
        ...(mcpTool.metadata || {}),
      },
    };
  }
}

module.exports = {
  MCPToolAdapter,
};
