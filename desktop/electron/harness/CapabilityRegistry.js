/**
 * NEXUS CODEX HARNESS - CAPABILITY REGISTRY
 * Central capability abstraction coordinating native tools, external MCP tools, and skills.
 * Enforces risk policies, role-based visibility, secret filtering, and event emission.
 */

const {
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
  EVENT_TYPES,
  generateCapabilityId,
} = require("./types");
const secretFilter = require("../../security/secretFilter");
const { harnessEventBus } = require("./eventBus");
const { toolRegistry: defaultToolRegistry } = require("./ToolRegistry");

class CapabilityRegistry {
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.capabilities = new Map(); // capabilityId -> Capability Definition
    this.nameIndex = new Map(); // name -> capabilityId
  }

  /**
   * Registers a normalized capability.
   * @param {Object} cap
   * @param {string} [cap.id]
   * @param {string} cap.name
   * @param {string} [cap.description]
   * @param {string} [cap.source]
   * @param {string} [cap.type]
   * @param {Object} [cap.inputSchema]
   * @param {string} [cap.riskLevel]
   * @param {boolean|Function} [cap.requiresApproval]
   * @param {Function} [cap.execute]
   * @param {Object} [cap.metadata]
   * @param {boolean} [cap.enabled]
   * @returns {Object} Registered capability descriptor
   */
  registerCapability(cap) {
    if (!cap || typeof cap !== "object") {
      throw new Error("[HARNESS-CAPABILITY] Invalid capability definition: must be an object");
    }
    if (!cap.name || typeof cap.name !== "string") {
      throw new Error("[HARNESS-CAPABILITY] Capability name is required and must be a string");
    }

    const id = cap.id || generateCapabilityId();
    const type = cap.type || CAPABILITY_TYPE.NEXUS_TOOL;
    const source = cap.source || (type === CAPABILITY_TYPE.MCP_TOOL ? "mcp" : type === CAPABILITY_TYPE.SKILL ? "skill" : "nexus");
    const riskLevel = cap.riskLevel || (cap.requiresApproval ? CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED : CAPABILITY_RISK_LEVEL.SAFE);
    const enabled = cap.enabled !== undefined ? Boolean(cap.enabled) : true;

    // For executable tools (NEXUS_TOOL or MCP_TOOL), execute handler is required
    if (type !== CAPABILITY_TYPE.SKILL && typeof cap.execute !== "function") {
      throw new Error(`[HARNESS-CAPABILITY] Capability tool "${cap.name}" must provide an execute function`);
    }

    const capability = {
      id,
      name: cap.name,
      description: cap.description || "",
      source,
      type,
      inputSchema: cap.inputSchema || { type: "object", properties: {} },
      riskLevel,
      requiresApproval: cap.requiresApproval !== undefined ? cap.requiresApproval : (riskLevel === CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED || riskLevel === CAPABILITY_RISK_LEVEL.HIGH_RISK),
      execute: cap.execute || null,
      metadata: cap.metadata ? { ...cap.metadata } : {},
      enabled,
      registeredAt: Date.now(),
    };

    this.capabilities.set(id, capability);
    this.nameIndex.set(capability.name, id);

    // If it is an executable tool, register or update onto the underlying ToolRegistry
    if (capability.type !== CAPABILITY_TYPE.SKILL && this.toolRegistry && capability.execute) {
      this.toolRegistry.register({
        name: capability.name,
        description: capability.description,
        inputSchema: capability.inputSchema,
        requiresApproval: capability.requiresApproval,
        execute: capability.execute,
      });
    }

    if (this.eventBus && typeof this.eventBus.emit === "function") {
      this.eventBus.emit(EVENT_TYPES.CAPABILITY_REGISTERED, {
        payload: {
          capabilityId: capability.id,
          name: capability.name,
          type: capability.type,
          source: capability.source,
          riskLevel: capability.riskLevel,
          enabled: capability.enabled,
        },
      });
    }

    return capability;
  }

  /**
   * Retrieves a capability by ID or Name.
   * @param {string} idOrName
   * @returns {Object|null}
   */
  getCapability(idOrName) {
    if (!idOrName || typeof idOrName !== "string") return null;
    if (this.capabilities.has(idOrName)) {
      return this.capabilities.get(idOrName);
    }
    const id = this.nameIndex.get(idOrName);
    if (id && this.capabilities.has(id)) {
      return this.capabilities.get(id);
    }
    return null;
  }

  /**
   * Checks if a capability exists.
   * @param {string} idOrName
   * @returns {boolean}
   */
  hasCapability(idOrName) {
    return Boolean(this.getCapability(idOrName));
  }

  /**
   * Enables a capability.
   * @param {string} idOrName
   * @returns {boolean}
   */
  enableCapability(idOrName) {
    const cap = this.getCapability(idOrName);
    if (!cap) return false;
    cap.enabled = true;

    if (this.eventBus && typeof this.eventBus.emit === "function") {
      this.eventBus.emit(EVENT_TYPES.CAPABILITY_ENABLED, {
        payload: { capabilityId: cap.id, name: cap.name },
      });
    }
    return true;
  }

  /**
   * Disables a capability.
   * @param {string} idOrName
   * @returns {boolean}
   */
  disableCapability(idOrName) {
    const cap = this.getCapability(idOrName);
    if (!cap) return false;
    cap.enabled = false;

    if (this.eventBus && typeof this.eventBus.emit === "function") {
      this.eventBus.emit(EVENT_TYPES.CAPABILITY_DISABLED, {
        payload: { capabilityId: cap.id, name: cap.name },
      });
    }
    return true;
  }

  /**
   * Unregisters a capability by ID or name.
   * @param {string} idOrName
   * @returns {boolean}
   */
  unregisterCapability(idOrName) {
    const cap = this.getCapability(idOrName);
    if (!cap) return false;

    this.capabilities.delete(cap.id);
    if (this.nameIndex.get(cap.name) === cap.id) {
      this.nameIndex.delete(cap.name);
    }
    return true;
  }

  /**
   * Unregisters all capabilities provided by a specific MCP server.
   * @param {string} serverId
   * @returns {number} Count of removed capabilities
   */
  unregisterCapabilitiesByServerId(serverId) {
    if (!serverId) return 0;
    let count = 0;
    for (const cap of Array.from(this.capabilities.values())) {
      if (cap.metadata && cap.metadata.serverId === serverId) {
        this.unregisterCapability(cap.id);
        count++;
      }
    }
    return count;
  }

  /**
   * Unregisters all capabilities from a given source (e.g. 'project', 'mcp').
   * @param {string} source
   * @returns {number} Count of removed capabilities
   */
  unregisterCapabilitiesBySource(source) {
    if (!source) return 0;
    let count = 0;
    for (const cap of Array.from(this.capabilities.values())) {
      if (cap.source === source || (cap.metadata && cap.metadata.source === source)) {
        this.unregisterCapability(cap.id);
        count++;
      }
    }
    return count;
  }

  /**
   * Lists registered capabilities with optional filtering.
   * @param {Object} [filter]
   * @returns {Array<Object>}
   */
  listCapabilities(filter = {}) {
    let list = Array.from(this.capabilities.values());

    if (filter.type) {
      list = list.filter((c) => c.type === filter.type);
    }
    if (filter.source) {
      list = list.filter((c) => c.source === filter.source);
    }
    if (filter.riskLevel) {
      list = list.filter((c) => c.riskLevel === filter.riskLevel);
    }
    if (filter.enabled !== undefined) {
      list = list.filter((c) => c.enabled === Boolean(filter.enabled));
    }
    if (filter.serverId) {
      list = list.filter((c) => c.metadata && c.metadata.serverId === filter.serverId);
    }

    return list.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      source: c.source,
      type: c.type,
      inputSchema: c.inputSchema,
      riskLevel: c.riskLevel,
      requiresApproval: typeof c.requiresApproval === "function" ? "conditional" : Boolean(c.requiresApproval),
      metadata: c.metadata,
      enabled: c.enabled,
    }));
  }

  /**
   * Evaluates and filters capabilities permitted for a specific turn execution context.
   * Enforces role policies, intent scoping, and subagent restriction ceilings.
   * @param {Object} options
   * @param {string} [options.role] - Subagent role e.g. "researcher", "coder", "tester", "reviewer"
   * @param {string} [options.intent] - "GENERAL_CHAT" | "READ_ONLY" | "MUTATION"
   * @param {Array<string>} [options.allowedTools] - Explicit tool allowlist
   * @param {boolean} [options.isChild] - Whether turn is running in a child subagent thread
   * @returns {Array<Object>} Permitted capabilities
   */
  filterCapabilitiesForTurn(options = {}) {
    const {
      role = "parent",
      intent = "MUTATION",
      allowedTools = null,
      isChild = false,
    } = options;

    if (intent === "GENERAL_CHAT") {
      return [];
    }

    let activeCaps = Array.from(this.capabilities.values()).filter((c) => c.enabled);

    // 1. Filter out permanently blocked capabilities
    activeCaps = activeCaps.filter((c) => c.riskLevel !== CAPABILITY_RISK_LEVEL.BLOCKED);

    // 2. Intent-based filtering
    if (intent === "READ_ONLY") {
      // In READ_ONLY, exclude file mutation and destructive actions
      activeCaps = activeCaps.filter((c) => {
        if (c.name === "apply_patch") return false;
        if (c.metadata && c.metadata.allowMutation === true) return false;
        if (c.riskLevel === CAPABILITY_RISK_LEVEL.HIGH_RISK && (!c.metadata || c.metadata.isReadOnly !== true)) return false;
        return true;
      });
    }

    // 3. Subagent role constraints
    if (isChild || (role && role.toLowerCase() !== "parent")) {
      const r = (role || "").toLowerCase();
      if (r === "researcher") {
        // Researcher can only read, search, and run read-only external tools
        activeCaps = activeCaps.filter((c) => {
          if (c.name === "apply_patch") return false;
          if (c.name === "run_command" && (!c.metadata || !c.metadata.isReadOnly)) return false;
          if (c.name.startsWith("swarm_")) return false; // Child cannot spawn sub-swarms
          if (c.metadata && c.metadata.allowMutation === true) return false;
          return true;
        });
      } else if (r === "reviewer") {
        // Reviewer inspects and runs tests
        activeCaps = activeCaps.filter((c) => {
          if (c.name === "apply_patch") return false;
          if (c.name.startsWith("swarm_")) return false;
          if (c.metadata && c.metadata.allowMutation === true) return false;
          return true;
        });
      } else if (r === "coder" || r === "tester") {
        activeCaps = activeCaps.filter((c) => {
          if (c.name.startsWith("swarm_")) return false; // Child cannot spawn sub-swarms
          return true;
        });
      }
    }

    // 4. Explicit tool allowlist constraint if provided
    if (Array.isArray(allowedTools) && allowedTools.length > 0) {
      const allowedSet = new Set(allowedTools);
      activeCaps = activeCaps.filter((c) => allowedSet.has(c.name) || allowedSet.has(c.id));
    }

    return activeCaps;
  }

  /**
   * Synchronizes registered capabilities with an existing ToolRegistry instance.
   * @param {import("./ToolRegistry").ToolRegistry} [targetRegistry]
   */
  syncWithToolRegistry(targetRegistry = this.toolRegistry) {
    if (!targetRegistry) return;
    for (const cap of this.capabilities.values()) {
      if (cap.enabled && cap.type !== CAPABILITY_TYPE.SKILL && cap.execute) {
        targetRegistry.register({
          name: cap.name,
          description: cap.description,
          inputSchema: cap.inputSchema,
          requiresApproval: cap.requiresApproval,
          execute: cap.execute,
        });
      }
    }
  }

  /**
   * Clears all capabilities (for testing isolation).
   */
  clear() {
    this.capabilities.clear();
    this.nameIndex.clear();
  }
}

const capabilityRegistry = new CapabilityRegistry();

module.exports = {
  CapabilityRegistry,
  capabilityRegistry,
};
