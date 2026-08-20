/**
 * NEXUS CODEX HARNESS - MCP SERVER MANAGER (Milestone 14 Hardened)
 * Manages the lifecycle, process sandboxing, environment sanitization, transport abstraction,
 * tool discovery validation, cancellation, and execution of Model Context Protocol (MCP) server instances.
 */

const {
  MCP_SERVER_STATUS,
  MCP_TRANSPORT,
  EVENT_TYPES,
  generateMCPServerId,
} = require("../types");
const { MCPToolAdapter } = require("./MCPToolAdapter");
const {
  createMCPTransport,
  SAFE_ENV_ALLOWLIST,
} = require("./MCPTransport");
const secretFilter = require("../../../security/secretFilter");
const { harnessEventBus } = require("../eventBus");
const { capabilityRegistry: defaultCapabilityRegistry } = require("../CapabilityRegistry");

class MCPServerManager {
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.capabilityRegistry = options.capabilityRegistry || defaultCapabilityRegistry;
    this.servers = new Map(); // serverId -> Server Record
    this.transports = new Map(); // serverId -> MCPTransport
    this.inFlightRequests = new Map(); // callId -> { serverId, toolName, turnId }
  }

  /**
   * Validates tool schema definition exposed by an MCP server.
   * @param {Object} toolDef
   * @returns {{ valid: boolean, error?: string }}
   */
  validateToolSchema(toolDef) {
    if (!toolDef || typeof toolDef !== "object") {
      return { valid: false, error: "Tool definition must be an object" };
    }
    if (!toolDef.name || typeof toolDef.name !== "string" || !toolDef.name.trim()) {
      return { valid: false, error: "Tool name is required and must be a non-empty string" };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(toolDef.name.trim())) {
      return { valid: false, error: `Tool name "${toolDef.name}" contains invalid characters` };
    }
    if (toolDef.inputSchema && typeof toolDef.inputSchema !== "object") {
      return { valid: false, error: `Tool "${toolDef.name}" inputSchema must be an object` };
    }
    return { valid: true };
  }

  /**
   * Sanitizes environment variables for external server processes.
   * @param {Object} [customEnv]
   * @returns {Object} Safe environment
   */
  createSafeEnvironment(customEnv = {}) {
    const safeEnv = {};
    for (const key of SAFE_ENV_ALLOWLIST) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key];
      }
    }

    if (customEnv && typeof customEnv === "object") {
      for (const [k, v] of Object.entries(customEnv)) {
        const lowerK = k.toLowerCase();
        if (
          lowerK.includes("api_key") ||
          lowerK.includes("apikey") ||
          lowerK.includes("secret") ||
          lowerK.includes("token") ||
          lowerK.includes("password")
        ) {
          continue;
        }
        if (typeof v === "string") {
          safeEnv[k] = secretFilter.sanitizeString(v);
        }
      }
    }
    return safeEnv;
  }

  /**
   * Registers a new MCP server configuration.
   * @param {Object} config
   * @returns {Object} Registered server record
   */
  registerServer(config = {}) {
    if (!config || typeof config !== "object") {
      throw new Error("[HARNESS-MCP-SERVER] Server config must be an object");
    }
    if (!config.name || typeof config.name !== "string") {
      throw new Error("[HARNESS-MCP-SERVER] Server name is required");
    }

    const serverId = config.serverId || generateMCPServerId();
    const transport = config.transport || (config.handler ? MCP_TRANSPORT.IN_PROCESS : MCP_TRANSPORT.STDIO);

    if (transport === MCP_TRANSPORT.STDIO && !config.processConfig?.command && !config.command) {
      throw new Error(`[HARNESS-MCP-SERVER] STDIO server "${config.name}" requires processConfig.command`);
    }

    const rawTools = Array.isArray(config.tools) ? config.tools : [];
    const validTools = [];
    for (const t of rawTools) {
      const v = this.validateToolSchema(t);
      if (v.valid) {
        validTools.push({
          ...t,
          serverId,
        });
      }
    }

    const serverRecord = {
      serverId,
      name: config.name,
      transport,
      status: MCP_SERVER_STATUS.REGISTERED,
      enabled: config.enabled !== undefined ? Boolean(config.enabled) : true,
      source: config.source || "mcp",
      tools: validTools,
      processConfig: config.processConfig ? {
        command: config.processConfig.command || config.command,
        args: Array.isArray(config.processConfig.args) ? config.processConfig.args : (config.args || []),
        cwd: config.processConfig.cwd || config.cwd || null,
        env: config.processConfig.env || config.env || {},
        url: config.processConfig.url || config.url || null,
      } : {
        command: config.command,
        args: config.args || [],
        cwd: config.cwd || null,
        env: config.env || {},
        url: config.url || null,
      },
      handler: config.handler || null,
      policy: config.policy || { networkAllowed: false, allowedCwd: null },
      metadata: config.metadata || {},
      registeredAt: Date.now(),
      startedAt: null,
      stoppedAt: null,
      lastError: null,
    };

    this.servers.set(serverId, serverRecord);
    return serverRecord;
  }

  /**
   * Starts an MCP server instance, discovers and validates tools, and registers them into CapabilityRegistry.
   * @param {string} serverId
   * @returns {Promise<Object>} Updated server record
   */
  async startServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`[HARNESS-MCP-SERVER] Server "${serverId}" not found`);
    }

    if (server.status === MCP_SERVER_STATUS.RUNNING) {
      return server;
    }

    server.status = MCP_SERVER_STATUS.STARTING;

    try {
      // Clean up previous transport if exists
      if (this.transports.has(serverId)) {
        try {
          await this.transports.get(serverId).close();
        } catch (e) {}
        this.transports.delete(serverId);
      }

      // Instantiate unified transport
      const transportInstance = createMCPTransport({
        ...server,
        processConfig: server.processConfig,
        handler: server.handler,
        tools: server.tools,
      });

      // Bind transport lifecycle events
      transportInstance.on("error", (errMsg) => {
        server.status = MCP_SERVER_STATUS.FAILED;
        server.lastError = secretFilter.sanitizeString(errMsg);
        if (this.capabilityRegistry) {
          this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
        }
        if (this.eventBus && typeof this.eventBus.emit === "function") {
          this.eventBus.emit(EVENT_TYPES.MCP_SERVER_FAILED, {
            payload: { serverId, error: server.lastError },
          });
        }
      });

      transportInstance.on("exit", ({ code, signal, isClean }) => {
        server.stoppedAt = Date.now();
        if (isClean) {
          server.status = MCP_SERVER_STATUS.STOPPED;
          if (this.eventBus && typeof this.eventBus.emit === "function") {
            this.eventBus.emit(EVENT_TYPES.MCP_SERVER_STOPPED, {
              payload: { serverId, exitCode: code, signal },
            });
          }
        } else {
          server.status = MCP_SERVER_STATUS.FAILED;
          server.lastError = `Process crashed with code ${code} (${signal || "none"})`;
          if (this.capabilityRegistry) {
            this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
          }
          if (this.eventBus && typeof this.eventBus.emit === "function") {
            this.eventBus.emit(EVENT_TYPES.MCP_SERVER_FAILED, {
              payload: { serverId, error: server.lastError, exitCode: code, signal },
            });
          }
        }
        this.transports.delete(serverId);
      });

      transportInstance.on("stateChange", ({ state, error }) => {
        if (state === "CONNECTED") {
          server.status = MCP_SERVER_STATUS.RUNNING;
          server.lastError = null;
        } else if (state === "FAILED") {
          server.status = MCP_SERVER_STATUS.FAILED;
          server.lastError = error || "Connection failed";
          if (this.capabilityRegistry) {
            this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
          }
          if (this.eventBus && typeof this.eventBus.emit === "function") {
            this.eventBus.emit(EVENT_TYPES.MCP_SERVER_FAILED, {
              payload: { serverId, error: server.lastError },
            });
          }
        } else if (state === "DISCONNECTED") {
          server.status = MCP_SERVER_STATUS.STOPPED;
        }
      });

      this.transports.set(serverId, transportInstance);

      // Connect transport
      await transportInstance.connect();

      server.status = MCP_SERVER_STATUS.RUNNING;
      server.startedAt = Date.now();
      server.lastError = null;

      // Tool Discovery & Capability Registration
      if (this.capabilityRegistry) {
        for (const toolDef of server.tools) {
          const validation = this.validateToolSchema(toolDef);
          if (validation.valid) {
            const normalized = MCPToolAdapter.normalizeTool({
              ...toolDef,
              source: server.source || toolDef.source || "mcp",
            }, this);
            this.capabilityRegistry.registerCapability(normalized);
          }
        }
      }

      if (this.eventBus && typeof this.eventBus.emit === "function") {
        this.eventBus.emit(EVENT_TYPES.MCP_SERVER_STARTED, {
          payload: {
            serverId: server.serverId,
            name: server.name,
            transport: server.transport,
            toolCount: server.tools.length,
          },
        });
      }

      return server;
    } catch (err) {
      server.status = MCP_SERVER_STATUS.FAILED;
      server.lastError = secretFilter.sanitizeString(err.message);
      if (this.capabilityRegistry) {
        this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
      }
      if (this.eventBus && typeof this.eventBus.emit === "function") {
        this.eventBus.emit(EVENT_TYPES.MCP_SERVER_FAILED, {
          payload: { serverId, error: server.lastError },
        });
      }
      throw err;
    }
  }

  /**
   * Gracefully stops an MCP server.
   * @param {string} serverId
   * @returns {Promise<Object>}
   */
  async stopServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`[HARNESS-MCP-SERVER] Server "${serverId}" not found`);
    }

    if (server.status === MCP_SERVER_STATUS.STOPPED) {
      return server;
    }

    // Abort in-flight requests on this server
    for (const [callId, info] of Array.from(this.inFlightRequests.entries())) {
      if (info.serverId === serverId) {
        this.cancelTool(callId, `Server "${server.name}" stopped`);
      }
    }

    const transport = this.transports.get(serverId);
    if (transport) {
      try {
        await transport.close();
      } catch (e) {}
      this.transports.delete(serverId);
    }

    if (this.capabilityRegistry) {
      this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
    }

    server.status = MCP_SERVER_STATUS.STOPPED;
    server.stoppedAt = Date.now();

    if (this.eventBus && typeof this.eventBus.emit === "function") {
      this.eventBus.emit(EVENT_TYPES.MCP_SERVER_STOPPED, {
        payload: { serverId: server.serverId, name: server.name },
      });
    }

    return server;
  }

  /**
   * Restarts an MCP server.
   * @param {string} serverId
   * @returns {Promise<Object>}
   */
  async restartServer(serverId) {
    await this.stopServer(serverId);
    return this.startServer(serverId);
  }

  /**
   * Cancels an in-flight tool invocation.
   * @param {string} callId
   * @param {string} [reason]
   * @returns {boolean}
   */
  cancelTool(callId, reason = "Tool invocation cancelled") {
    const req = this.inFlightRequests.get(callId);
    if (!req) return false;

    const transport = this.transports.get(req.serverId);
    if (transport && typeof transport.cancel === "function") {
      transport.cancel(callId, reason);
    }
    this.inFlightRequests.delete(callId);
    return true;
  }

  /**
   * Cancels all in-flight tools running for a specific parent turn.
   * @param {string} turnId
   * @param {string} [reason]
   * @returns {number} Number of cancelled requests
   */
  cancelTurnTools(turnId, reason = "Parent turn cancelled") {
    if (!turnId) return 0;
    let count = 0;
    for (const [callId, req] of Array.from(this.inFlightRequests.entries())) {
      if (req.turnId === turnId) {
        this.cancelTool(callId, reason);
        count++;
      }
    }
    return count;
  }

  /**
   * Retrieves a server descriptor by ID.
   * @param {string} serverId
   * @returns {Object|null}
   */
  getServer(serverId) {
    return this.servers.get(serverId) || null;
  }

  /**
   * Returns current status of an MCP server.
   * @param {string} serverId
   * @returns {string}
   */
  getServerStatus(serverId) {
    const s = this.getServer(serverId);
    return s ? s.status : "NOT_FOUND";
  }

  /**
   * Unregisters an MCP server, stopping its process and removing capabilities.
   * @param {string} serverId
   * @returns {Promise<boolean>}
   */
  async unregisterServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return false;

    try {
      await this.stopServer(serverId);
    } catch (e) {}

    if (this.capabilityRegistry && typeof this.capabilityRegistry.unregisterCapabilitiesByServerId === "function") {
      this.capabilityRegistry.unregisterCapabilitiesByServerId(serverId);
    }

    this.servers.delete(serverId);
    this.transports.delete(serverId);
    return true;
  }

  /**
   * Lists all registered MCP servers with metadata.
   * @returns {Array<Object>}
   */
  listServers() {
    return Array.from(this.servers.values()).map((s) => ({
      serverId: s.serverId,
      name: s.name,
      transport: s.transport,
      status: s.status,
      enabled: s.enabled,
      source: s.source,
      toolCount: s.tools.length,
      startedAt: s.startedAt,
      lastError: s.lastError,
      policy: s.policy,
      metadata: s.metadata,
    }));
  }

  /**
   * Executes a tool provided by a registered MCP server.
   * @param {string} serverId
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async executeToolOnServer(serverId, toolName, args = {}, context = {}) {
    const server = this.getServer(serverId);
    if (!server) {
      throw new Error(`MCP Server "${serverId}" is not registered`);
    }
    if (server.status !== MCP_SERVER_STATUS.RUNNING) {
      throw new Error(`MCP Server "${server.name}" is currently ${server.status}. It must be RUNNING to execute tools.`);
    }

    const transport = this.transports.get(serverId);
    if (!transport) {
      throw new Error(`No active transport for server "${server.name}"`);
    }

    const callId = context.callId || `mcp_call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const turnId = context.turnId || null;

    this.inFlightRequests.set(callId, { serverId, toolName, turnId });
    const startTime = Date.now();

    try {
      const rawRes = await transport.send(toolName, args, { ...context, callId });
      const executionTimeMs = Date.now() - startTime;
      this.inFlightRequests.delete(callId);

      return {
        success: rawRes && rawRes.success !== false,
        result: rawRes?.result !== undefined ? rawRes.result : rawRes,
        error: rawRes?.error || null,
        executionTimeMs,
      };
    } catch (err) {
      this.inFlightRequests.delete(callId);
      const executionTimeMs = Date.now() - startTime;
      throw err;
    }
  }

  /**
   * Cleans up all running servers.
   */
  async shutdown() {
    for (const serverId of Array.from(this.servers.keys())) {
      try {
        await this.stopServer(serverId);
      } catch (e) {}
    }
    this.servers.clear();
    this.transports.clear();
    this.inFlightRequests.clear();
  }
}

const mcpServerManager = new MCPServerManager();

module.exports = {
  MCPServerManager,
  mcpServerManager,
  SAFE_ENV_ALLOWLIST,
};
