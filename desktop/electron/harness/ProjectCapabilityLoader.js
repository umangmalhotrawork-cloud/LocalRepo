/**
 * NEXUS CODEX HARNESS - PROJECT CAPABILITY LOADER (Milestone 13)
 * Discovers, validates, and hydrates project-level MCP servers (.nexus/mcp.json)
 * and custom engineering skills (.nexus/skills/*.md) into the Harness CapabilityRegistry.
 * 
 * Enforces strict security boundaries:
 * - Untrusted project configuration input validation
 * - Path traversal prevention
 * - Secret and API key sanitization
 * - Safe hot reloading without destroying active working servers on invalid updates
 * - Role-based subagent capability ceilings
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  CAPABILITY_TYPE,
  CAPABILITY_RISK_LEVEL,
  MCP_SERVER_STATUS,
  MCP_TRANSPORT,
  EVENT_TYPES,
  DEFAULT_PROJECT_CAPABILITY_LIMITS,
  generateMCPServerId,
  generateSkillId,
} = require('./types');
const secretFilter = require('../../security/secretFilter');
const { harnessEventBus } = require('./eventBus');
const { capabilityRegistry: defaultCapabilityRegistry } = require('./CapabilityRegistry');
const { mcpServerManager: defaultMCPServerManager } = require('./mcp/MCPServerManager');
const { MCPToolAdapter } = require('./mcp/MCPToolAdapter');
const { skillRegistry: defaultSkillRegistry } = require('./skills/SkillRegistry');

class ProjectCapabilityLoader {
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.capabilityRegistry = options.capabilityRegistry || defaultCapabilityRegistry;
    this.mcpServerManager = options.mcpServerManager || defaultMCPServerManager;
    this.skillRegistry = options.skillRegistry || defaultSkillRegistry;
    this.limits = {
      ...DEFAULT_PROJECT_CAPABILITY_LIMITS,
      ...(options.limits || {}),
    };

    this.activeWatchers = new Map(); // workspacePath -> Array<{ watcher, timer }>
    this.loadedConfigs = new Map(); // workspacePath -> { mcpServers: [], skills: [], configHash: '' }
  }

  /**
   * Helper: Resolves and verifies that a relative subpath resides strictly within the workspace root.
   * Prevents directory traversal attacks (../, absolute paths outside workspace).
   * @param {string} workspacePath
   * @param {string} relativeOrSubPath
   * @returns {string|null} Resolved absolute path if safe, null if traversal detected
   */
  resolveSafeWorkspacePath(workspacePath, relativeOrSubPath) {
    if (!workspacePath || typeof workspacePath !== 'string') return null;
    if (!relativeOrSubPath || typeof relativeOrSubPath !== 'string') return null;

    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTarget = path.resolve(resolvedWorkspace, relativeOrSubPath);

    if (resolvedTarget === resolvedWorkspace || resolvedTarget.startsWith(resolvedWorkspace + path.sep)) {
      return resolvedTarget;
    }
    return null;
  }

  /**
   * Computes a SHA-256 hash for raw string or buffer content.
   * @param {string|Buffer} content
   * @returns {string}
   */
  hashContent(content) {
    if (!content) return '';
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Discovers the .nexus configuration directory and capability files in a workspace.
   * @param {string} workspacePath
   * @returns {Object} Discovery descriptor
   */
  discoverProjectConfig(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      return {
        exists: false,
        nexusDir: null,
        hasMCPConfig: false,
        mcpConfigPath: null,
        hasSkillsDir: false,
        skillsDir: null,
        skillFiles: [],
      };
    }

    const nexusDir = this.resolveSafeWorkspacePath(workspacePath, '.nexus');
    if (!nexusDir || !fs.existsSync(nexusDir)) {
      return {
        exists: false,
        nexusDir: null,
        hasMCPConfig: false,
        mcpConfigPath: null,
        hasSkillsDir: false,
        skillsDir: null,
        skillFiles: [],
      };
    }

    let isDir = false;
    try {
      isDir = fs.statSync(nexusDir).isDirectory();
    } catch (e) {
      isDir = false;
    }

    if (!isDir) {
      return {
        exists: false,
        nexusDir: null,
        hasMCPConfig: false,
        mcpConfigPath: null,
        hasSkillsDir: false,
        skillsDir: null,
        skillFiles: [],
      };
    }

    // Check .nexus/mcp.json
    const mcpConfigPath = path.join(nexusDir, 'mcp.json');
    let hasMCPConfig = false;
    try {
      if (fs.existsSync(mcpConfigPath) && fs.statSync(mcpConfigPath).isFile()) {
        hasMCPConfig = true;
      }
    } catch (e) {
      hasMCPConfig = false;
    }

    // Check .nexus/skills
    const skillsDir = path.join(nexusDir, 'skills');
    let hasSkillsDir = false;
    const skillFiles = [];
    try {
      if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
        hasSkillsDir = true;
        const entries = fs.readdirSync(skillsDir);
        for (const entry of entries) {
          if (entry.endsWith('.md') && !entry.startsWith('.')) {
            const entryPath = path.join(skillsDir, entry);
            try {
              if (fs.statSync(entryPath).isFile()) {
                skillFiles.push(entryPath);
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      hasSkillsDir = false;
    }

    return {
      exists: true,
      nexusDir,
      hasMCPConfig,
      mcpConfigPath: hasMCPConfig ? mcpConfigPath : null,
      hasSkillsDir,
      skillsDir: hasSkillsDir ? skillsDir : null,
      skillFiles,
    };
  }

  /**
   * Loads and validates .nexus/mcp.json configuration file.
   * @param {string} workspacePath
   * @returns {Object} { success, servers, errors, warnings, rawConfig, configHash }
   */
  loadMCPConfig(workspacePath) {
    const discovery = this.discoverProjectConfig(workspacePath);
    if (!discovery.hasMCPConfig || !discovery.mcpConfigPath) {
      return {
        success: true,
        servers: [],
        errors: [],
        warnings: [],
        rawConfig: null,
        configHash: '',
      };
    }

    const errors = [];
    const warnings = [];
    let rawText = '';
    let parsed = null;

    try {
      rawText = fs.readFileSync(discovery.mcpConfigPath, 'utf-8');
    } catch (err) {
      errors.push(`Failed to read .nexus/mcp.json: ${err.message}`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: null, configHash: '' };
    }

    if (rawText.length > 512 * 1024) {
      errors.push(`.nexus/mcp.json exceeds maximum allowed file size of 512KB (${rawText.length} bytes)`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: null, configHash: '' };
    }

    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      errors.push(`Malformed JSON in .nexus/mcp.json: ${err.message}`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: null, configHash: '' };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push(`.nexus/mcp.json must be a JSON object with a top-level "servers" array`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: null, configHash: '' };
    }

    const rawServers = parsed.servers;
    if (!Array.isArray(rawServers)) {
      errors.push(`Top-level property "servers" in .nexus/mcp.json must be an array`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: parsed, configHash: '' };
    }

    if (rawServers.length > this.limits.maxServers) {
      errors.push(`Server count (${rawServers.length}) exceeds safety limit of ${this.limits.maxServers}`);
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return { success: false, servers: [], errors, warnings, rawConfig: parsed, configHash: '' };
    }

    const normalizedServers = [];
    const seenServerIds = new Set();

    for (let i = 0; i < rawServers.length; i++) {
      const s = rawServers[i];
      const indexLabel = `Server #${i + 1}`;

      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        errors.push(`${indexLabel} must be a configuration object`);
        continue;
      }

      // ID validation
      const id = String(s.id || s.name || '').trim();
      if (!id) {
        errors.push(`${indexLabel} is missing required "id" or "name"`);
        continue;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        errors.push(`${indexLabel} id "${id}" contains invalid characters (only alphanumeric, hyphens, underscores permitted)`);
        continue;
      }
      if (seenServerIds.has(id.toLowerCase())) {
        errors.push(`Duplicate server ID "${id}" detected in .nexus/mcp.json`);
        continue;
      }
      seenServerIds.add(id.toLowerCase());

      const name = s.name ? String(s.name).trim() : id;
      const transport = (s.transport || MCP_TRANSPORT.STDIO).toLowerCase();

      // Transport validation
      if (!Object.values(MCP_TRANSPORT).includes(transport)) {
        errors.push(`${indexLabel} ("${id}") specifies unsupported transport "${transport}". Supported: [${Object.values(MCP_TRANSPORT).join(', ')}]`);
        continue;
      }

      // Command / URL validation
      let command = s.command ? String(s.command).trim() : null;
      let url = s.url ? String(s.url).trim() : null;

      if (transport === MCP_TRANSPORT.STDIO) {
        if (!command) {
          errors.push(`${indexLabel} ("${id}") requires a non-empty "command" for stdio transport`);
          continue;
        }
      } else if (transport === MCP_TRANSPORT.SSE) {
        if (!url) {
          errors.push(`${indexLabel} ("${id}") requires a valid "url" for sse transport`);
          continue;
        }
        try {
          new URL(url);
        } catch (e) {
          errors.push(`${indexLabel} ("${id}") specifies invalid URL: "${url}"`);
          continue;
        }
      }

      // Args validation & bounding
      let rawArgs = Array.isArray(s.args) ? s.args : [];
      if (rawArgs.length > this.limits.maxArgsLength) {
        errors.push(`${indexLabel} ("${id}") args length (${rawArgs.length}) exceeds limit of ${this.limits.maxArgsLength}`);
        continue;
      }

      let totalArgsChars = 0;
      const safeArgs = [];
      for (const arg of rawArgs) {
        const strArg = String(arg);
        totalArgsChars += strArg.length;
        // Check for suspicious path traversal in arguments
        if (strArg.includes('..') && (strArg.includes('/') || strArg.includes('\\'))) {
          // If arg looks like a path outside workspace, check safety
          const testResolved = path.resolve(workspacePath, strArg);
          if (!testResolved.startsWith(path.resolve(workspacePath) + path.sep) && testResolved !== path.resolve(workspacePath)) {
            errors.push(`${indexLabel} ("${id}") contains path traversal in argument: "${strArg}"`);
            break;
          }
        }
        safeArgs.push(secretFilter.sanitizeString(strArg));
      }

      if (totalArgsChars > this.limits.maxTotalArgsChars) {
        errors.push(`${indexLabel} ("${id}") total args character length exceeds limit of ${this.limits.maxTotalArgsChars}`);
        continue;
      }

      // CWD validation & path traversal check
      let safeCwd = workspacePath;
      if (s.cwd) {
        const checkCwd = this.resolveSafeWorkspacePath(workspacePath, s.cwd);
        if (!checkCwd) {
          errors.push(`${indexLabel} ("${id}") cwd "${s.cwd}" escapes workspace boundary (path traversal rejected)`);
          continue;
        }
        safeCwd = checkCwd;
      }

      // Environment validation and secret filtering
      const safeEnv = {};
      if (s.env && typeof s.env === 'object' && !Array.isArray(s.env)) {
        for (const [k, v] of Object.entries(s.env)) {
          const lowerK = k.toLowerCase();
          // Never allow injecting raw provider keys or secret tokens
          if (
            lowerK.includes('api_key') ||
            lowerK.includes('apikey') ||
            lowerK.includes('secret') ||
            lowerK.includes('token') ||
            lowerK.includes('password') ||
            lowerK.includes('auth')
          ) {
            warnings.push(`${indexLabel} ("${id}") env variable "${k}" matches secret key pattern and was filtered`);
            continue;
          }
          if (typeof v === 'string') {
            safeEnv[k] = secretFilter.sanitizeString(v);
          } else {
            safeEnv[k] = String(v);
          }
        }
      }

      // Risk level validation
      let riskLevel = s.riskLevel || CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED;
      if (!Object.values(CAPABILITY_RISK_LEVEL).includes(riskLevel)) {
        warnings.push(`${indexLabel} ("${id}") specifies invalid riskLevel "${s.riskLevel}", defaulting to REVIEW_REQUIRED`);
        riskLevel = CAPABILITY_RISK_LEVEL.REVIEW_REQUIRED;
      }

      // Enabled state
      const enabled = s.enabled !== undefined ? Boolean(s.enabled) : true;

      // Tools normalization (if pre-declared in config)
      const rawTools = Array.isArray(s.tools) ? s.tools : [];
      const normalizedTools = rawTools.map((t) => ({
        name: t.name || `${id}_tool`,
        description: t.description || `Tool provided by MCP server ${id}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
        riskLevel: t.riskLevel || riskLevel,
        requiresApproval: t.requiresApproval !== undefined ? t.requiresApproval : (riskLevel !== CAPABILITY_RISK_LEVEL.SAFE),
        networkAllowed: Boolean(t.networkAllowed || s.networkAllowed),
        isReadOnly: t.isReadOnly !== undefined ? Boolean(t.isReadOnly) : (riskLevel === CAPABILITY_RISK_LEVEL.SAFE),
        allowMutation: Boolean(t.allowMutation),
        serverId: id,
        source: 'project',
      }));

      normalizedServers.push({
        id,
        serverId: id,
        name,
        transport,
        command,
        url,
        args: safeArgs,
        cwd: safeCwd,
        env: safeEnv,
        enabled,
        riskLevel,
        tools: normalizedTools,
        policy: {
          networkAllowed: Boolean(s.networkAllowed),
          allowedCwd: safeCwd,
        },
        source: 'project',
      });
    }

    if (errors.length > 0) {
      this._emitConfigInvalid(workspacePath, 'mcp', errors);
      return {
        success: false,
        servers: normalizedServers,
        errors,
        warnings,
        rawConfig: parsed,
        configHash: this.hashContent(rawText),
      };
    }

    const configHash = this.hashContent(rawText);

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(EVENT_TYPES.MCP_CONFIG_LOADED, {
        payload: {
          workspacePath,
          serverCount: normalizedServers.length,
          enabledCount: normalizedServers.filter((s) => s.enabled).length,
          configHash,
        },
      });
    }

    return {
      success: true,
      servers: normalizedServers,
      errors: [],
      warnings,
      rawConfig: parsed,
      configHash,
    };
  }

  /**
   * Parses Markdown frontmatter and instructions from a skill file.
   * Supports standard YAML-like frontmatter enclosed in '---'.
   * @param {string} rawContent
   * @param {string} filePath
   * @returns {Object} { metadata: Object, instructions: string, error?: string }
   */
  parseSkillFrontmatter(rawContent, filePath) {
    if (!rawContent || typeof rawContent !== 'string') {
      return { metadata: {}, instructions: '', error: 'Skill file is empty' };
    }

    const trimmed = rawContent.trim();
    let metadata = {};
    let instructions = trimmed;

    if (trimmed.startsWith('---')) {
      const endFm = trimmed.indexOf('\n---', 3);
      if (endFm !== -1) {
        const fmBlock = trimmed.slice(3, endFm).trim();
        instructions = trimmed.slice(endFm + 4).trim();

        // Safe YAML-like key: value line parser
        const lines = fmBlock.split('\n');
        let currentKey = null;
        let currentList = null;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith('#')) continue;

          // List item under current list key
          if (trimmedLine.startsWith('- ') && currentKey) {
            const val = trimmedLine.slice(2).trim().replace(/^['"]|['"]$/g, '');
            if (!currentList) currentList = [];
            currentList.push(val);
            metadata[currentKey] = currentList;
            continue;
          }

          const colonIdx = trimmedLine.indexOf(':');
          if (colonIdx !== -1) {
            const key = trimmedLine.slice(0, colonIdx).trim();
            const rawVal = trimmedLine.slice(colonIdx + 1).trim();

            currentKey = key;
            currentList = null;

            if (rawVal === '' || rawVal === '[]') {
              metadata[key] = [];
              currentList = metadata[key];
            } else if (rawVal === 'true') {
              metadata[key] = true;
            } else if (rawVal === 'false') {
              metadata[key] = false;
            } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
              // Comma-separated list in brackets [a, b, c]
              const items = rawVal.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
              metadata[key] = items;
            } else if (key === 'triggers' || key === 'allowedTools' || key === 'constraints') {
              // Allow comma-separated strings for convenience
              if (rawVal.includes(',')) {
                metadata[key] = rawVal.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
              } else {
                metadata[key] = [rawVal.replace(/^['"]|['"]$/g, '')];
              }
            } else {
              metadata[key] = rawVal.replace(/^['"]|['"]$/g, '');
            }
          }
        }
      }
    }

    return { metadata, instructions: secretFilter.sanitizeString(instructions) };
  }

  /**
   * Discovers and parses all .nexus/skills/*.md files in a workspace.
   * @param {string} workspacePath
   * @returns {Object} { success, skills, errors, warnings, configHash }
   */
  loadSkills(workspacePath) {
    const discovery = this.discoverProjectConfig(workspacePath);
    if (!discovery.hasSkillsDir || discovery.skillFiles.length === 0) {
      return {
        success: true,
        skills: [],
        errors: [],
        warnings: [],
        configHash: '',
      };
    }

    const errors = [];
    const warnings = [];
    const skills = [];
    const seenSkillIds = new Set();
    let combinedSkillHash = '';

    if (discovery.skillFiles.length > this.limits.maxSkills) {
      errors.push(`Skill count (${discovery.skillFiles.length}) exceeds safety limit of ${this.limits.maxSkills}`);
      this._emitConfigInvalid(workspacePath, 'skills', errors);
      return { success: false, skills: [], errors, warnings, configHash: '' };
    }

    for (const filePath of discovery.skillFiles) {
      const fileName = path.basename(filePath);
      const defaultId = fileName.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      let rawContent = '';
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > this.limits.maxSkillFileBytes) {
          const errStr = `Skill file "${fileName}" exceeds max size of ${this.limits.maxSkillFileBytes} bytes (${stats.size} bytes)`;
          errors.push(errStr);
          this._emitSkillLoadFailed(workspacePath, defaultId, errStr);
          continue;
        }
        rawContent = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        const errStr = `Failed to read skill file "${fileName}": ${err.message}`;
        errors.push(errStr);
        this._emitSkillLoadFailed(workspacePath, defaultId, errStr);
        continue;
      }

      combinedSkillHash += this.hashContent(rawContent);

      const parsed = this.parseSkillFrontmatter(rawContent, filePath);
      const meta = parsed.metadata || {};

      const id = String(meta.id || defaultId).trim();
      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const errStr = `Skill "${fileName}" has invalid ID "${id}"`;
        errors.push(errStr);
        this._emitSkillLoadFailed(workspacePath, id, errStr);
        continue;
      }

      if (seenSkillIds.has(id.toLowerCase())) {
        const errStr = `Duplicate skill ID "${id}" found in "${fileName}"`;
        errors.push(errStr);
        this._emitSkillLoadFailed(workspacePath, id, errStr);
        continue;
      }
      seenSkillIds.add(id.toLowerCase());

      const name = String(meta.name || id).trim();
      const version = String(meta.version || '1.0.0').trim();
      const description = secretFilter.sanitizeString(String(meta.description || `Project skill for ${name}`).slice(0, this.limits.maxDescriptionChars));

      let triggers = [];
      if (Array.isArray(meta.triggers)) {
        triggers = meta.triggers.map((t) => secretFilter.sanitizeString(String(t).toLowerCase()));
      } else if (typeof meta.triggers === 'string') {
        triggers = meta.triggers.split(',').map((t) => secretFilter.sanitizeString(t.trim().toLowerCase())).filter(Boolean);
      }

      let allowedTools = null;
      if (Array.isArray(meta.allowedTools)) {
        allowedTools = meta.allowedTools.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof meta.allowedTools === 'string') {
        allowedTools = meta.allowedTools.split(',').map((t) => t.trim()).filter(Boolean);
      }

      let constraints = [];
      if (Array.isArray(meta.constraints)) {
        constraints = meta.constraints.map((c) => secretFilter.sanitizeString(String(c).trim())).filter(Boolean);
      }

      let requires = [];
      if (Array.isArray(meta.requires)) {
        requires = meta.requires.map((r) => String(r).trim()).filter(Boolean);
      } else if (typeof meta.requires === 'string') {
        requires = meta.requires.split(',').map((r) => r.trim()).filter(Boolean);
      }

      const instructions = secretFilter.sanitizeString(parsed.instructions || '');
      if (!instructions.trim()) {
        const errStr = `Skill "${name}" in "${fileName}" contains no instructions text`;
        errors.push(errStr);
        this._emitSkillLoadFailed(workspacePath, id, errStr);
        continue;
      }

      if (instructions.length > this.limits.maxInstructionsChars) {
        warnings.push(`Skill "${name}" instructions truncated to max length of ${this.limits.maxInstructionsChars}`);
      }

      const enabled = meta.enabled !== undefined ? Boolean(meta.enabled) : true;

      const skillRecord = {
        skillId: id,
        id,
        name,
        version,
        description,
        triggers,
        allowedTools,
        constraints,
        requires,
        instructions: instructions.slice(0, this.limits.maxInstructionsChars),
        enabled,
        source: 'project',
        filePath,
        metadata: {
          source: 'project',
          filePath,
          ...meta,
        },
      };

      skills.push(skillRecord);

      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit(EVENT_TYPES.SKILL_DISCOVERED, {
          payload: {
            workspacePath,
            skillId: id,
            name,
            version,
            filePath,
          },
        });
      }
    }

    return {
      success: errors.length === 0,
      skills,
      errors,
      warnings,
      configHash: this.hashContent(combinedSkillHash),
    };
  }

  /**
   * Hydrates project-declared MCP servers and skills into the active runtime registries.
   * @param {string} workspacePath
   * @param {Object} [options]
   * @returns {Promise<Object>} Hydration summary
   */
  async hydrateCapabilities(workspacePath, options = {}) {
    if (!workspacePath) {
      return { success: true, serverCount: 0, skillCount: 0, errors: [] };
    }

    const mcpResult = this.loadMCPConfig(workspacePath);
    const skillsResult = this.loadSkills(workspacePath);

    const errors = [...mcpResult.errors, ...skillsResult.errors];
    const warnings = [...mcpResult.warnings, ...skillsResult.warnings];

    let startedServers = 0;

    // 1. Hydrate MCP Servers
    if (mcpResult.success && mcpResult.servers.length > 0) {
      for (const serverDef of mcpResult.servers) {
        try {
          const registered = this.mcpServerManager.registerServer({
            serverId: serverDef.serverId,
            name: serverDef.name,
            transport: serverDef.transport,
            tools: serverDef.tools,
            processConfig: {
              command: serverDef.command,
              args: serverDef.args,
              cwd: serverDef.cwd,
              env: serverDef.env,
            },
            policy: serverDef.policy,
            source: 'project',
            enabled: serverDef.enabled,
          });

          // Start only enabled servers automatically
          if (serverDef.enabled) {
            try {
              await this.mcpServerManager.startServer(serverDef.serverId);
              startedServers++;
            } catch (startErr) {
              warnings.push(`MCP Server "${serverDef.name}" failed to start: ${startErr.message}`);
            }
          }
        } catch (regErr) {
          errors.push(`Failed to register MCP server "${serverDef.name}": ${regErr.message}`);
        }
      }
    }

    // 2. Hydrate Skills
    let registeredSkills = 0;
    if (skillsResult.skills.length > 0) {
      for (const skillDef of skillsResult.skills) {
        try {
          this.skillRegistry.registerSkill({
            ...skillDef,
            source: 'project',
          });
          registeredSkills++;
        } catch (skillErr) {
          errors.push(`Failed to register skill "${skillDef.name}": ${skillErr.message}`);
        }
      }
    }

    const configHash = this.hashContent(`${mcpResult.configHash}:${skillsResult.configHash}`);

    this.loadedConfigs.set(workspacePath, {
      mcpServers: mcpResult.servers,
      skills: skillsResult.skills,
      configHash,
      hydratedAt: Date.now(),
    });

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(EVENT_TYPES.PROJECT_CAPABILITIES_DISCOVERED, {
        payload: {
          workspacePath,
          serverCount: mcpResult.servers.length,
          enabledServerCount: mcpResult.servers.filter((s) => s.enabled).length,
          startedServers,
          skillCount: registeredSkills,
          errors,
          warnings,
          configHash,
        },
      });
    }

    return {
      success: errors.length === 0,
      workspacePath,
      serverCount: mcpResult.servers.length,
      startedServers,
      skillCount: registeredSkills,
      errors,
      warnings,
      configHash,
    };
  }

  /**
   * Alias for hydrateCapabilities.
   * @param {string} workspacePath
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async loadProjectCapabilities(workspacePath, options = {}) {
    return this.hydrateCapabilities(workspacePath, options);
  }

  /**
   * Safely reloads project capabilities without tearing down running servers on invalid configs.
   * @param {string} workspacePath
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async reloadProjectCapabilities(workspacePath, options = {}) {
    if (!workspacePath) {
      return { success: false, error: 'workspacePath required' };
    }

    const previousConfig = this.loadedConfigs.get(workspacePath);

    // 1. Validate new MCP Config
    const newMcpResult = this.loadMCPConfig(workspacePath);
    let mcpReloaded = false;

    if (newMcpResult.success) {
      // Unregister previous project servers that are no longer present or need updating
      const newServerIds = new Set(newMcpResult.servers.map((s) => s.serverId));
      const existingServers = this.mcpServerManager.listServers().filter((s) => s.source === 'project');

      // Stop and unregister removed servers
      for (const s of existingServers) {
        if (!newServerIds.has(s.serverId)) {
          await this.mcpServerManager.unregisterServer(s.serverId);
        }
      }

      // Update or start new servers
      for (const serverDef of newMcpResult.servers) {
        const existing = this.mcpServerManager.getServer(serverDef.serverId);
        if (existing) {
          await this.mcpServerManager.unregisterServer(serverDef.serverId);
        }
        this.mcpServerManager.registerServer({
          ...serverDef,
          source: 'project',
        });
        if (serverDef.enabled) {
          try {
            await this.mcpServerManager.startServer(serverDef.serverId);
          } catch (e) {}
        }
      }

      mcpReloaded = true;
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit(EVENT_TYPES.MCP_CONFIG_RELOADED, {
          payload: {
            workspacePath,
            serverCount: newMcpResult.servers.length,
          },
        });
      }
    }

    // 2. Validate and Reload Skills
    const newSkillsResult = this.loadSkills(workspacePath);
    let skillsReloaded = false;

    const prevSkills = previousConfig?.skills || [];
    const prevSkillsMap = new Map(prevSkills.map((s) => [s.skillId, s]));
    const newSkillIds = new Set(newSkillsResult.skills.map((s) => s.skillId));

    if (newSkillsResult.skills.length > 0 || prevSkills.length > 0) {
      // Unregister removed skill files only if truly deleted from disk
      for (const oldSkill of prevSkills) {
        if (!newSkillIds.has(oldSkill.skillId)) {
          const fileStillExists = oldSkill.filePath && fs.existsSync(oldSkill.filePath);
          if (!fileStillExists) {
            this.skillRegistry.unregisterSkill(oldSkill.skillId);
          }
        }
      }

      // Atomically update or register new valid skills
      for (const skillDef of newSkillsResult.skills) {
        const existing = this.skillRegistry.getSkill(skillDef.skillId);
        if (existing) {
          try {
            this.skillRegistry.updateSkill(skillDef.skillId, skillDef);
          } catch (e) {
            // Keep previous valid version active
          }
        } else {
          this.skillRegistry.registerSkill({
            ...skillDef,
            source: 'project',
          });
        }
      }

      skillsReloaded = true;
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit(EVENT_TYPES.SKILL_RELOADED, {
          payload: {
            workspacePath,
            skillCount: newSkillsResult.skills.length,
          },
        });
      }
    }

    const configHash = this.hashContent(`${newMcpResult.configHash}:${newSkillsResult.configHash}`);
    this.loadedConfigs.set(workspacePath, {
      mcpServers: newMcpResult.servers,
      skills: newSkillsResult.skills,
      configHash,
      reloadedAt: Date.now(),
    });

    return {
      success: newMcpResult.success && newSkillsResult.success,
      workspacePath,
      mcpReloaded,
      skillsReloaded,
      serverCount: newMcpResult.servers.length,
      skillCount: newSkillsResult.skills.length,
      errors: [...newMcpResult.errors, ...newSkillsResult.errors],
      warnings: [...newMcpResult.warnings, ...newSkillsResult.warnings],
    };
  }

  /**
   * Starts a lightweight filesystem watcher for hot reloading project capabilities.
   * @param {string} workspacePath
   */
  startWatching(workspacePath) {
    if (!workspacePath) return;
    this.stopWatching(workspacePath);

    const discovery = this.discoverProjectConfig(workspacePath);
    if (!discovery.exists || !discovery.nexusDir) return;

    const watchers = [];
    let debounceTimer = null;

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          await this.reloadProjectCapabilities(workspacePath);
        } catch (e) {}
      }, 300);
    };

    try {
      // Watch .nexus directory
      const nexusWatcher = fs.watch(discovery.nexusDir, { recursive: true }, () => {
        scheduleReload();
      });
      watchers.push({ watcher: nexusWatcher, timer: () => { if (debounceTimer) clearTimeout(debounceTimer); } });
    } catch (e) {
      // Fallback: non-fatal if fs.watch is unavailable or unsupported
    }

    this.activeWatchers.set(workspacePath, watchers);
  }

  /**
   * Stops active watchers for a workspace.
   * @param {string} workspacePath
   */
  stopWatching(workspacePath) {
    if (!workspacePath) return;
    const watchers = this.activeWatchers.get(workspacePath);
    if (Array.isArray(watchers)) {
      for (const w of watchers) {
        try {
          if (w.timer) w.timer();
          if (w.watcher && typeof w.watcher.close === 'function') {
            w.watcher.close();
          }
        } catch (e) {}
      }
    }
    this.activeWatchers.delete(workspacePath);
  }

  /**
   * Stops all active workspace watchers.
   */
  unwatchAll() {
    for (const ws of Array.from(this.activeWatchers.keys())) {
      this.stopWatching(ws);
    }
  }

  /**
   * Extracts safe, normalized metadata for persistence.
   * Excludes raw secrets, API keys, or memory pointers.
   * @param {string} workspacePath
   * @returns {Object} Safe persistence descriptor
   */
  getPersistenceMetadata(workspacePath) {
    const config = this.loadedConfigs.get(workspacePath);
    const mcpServers = this.mcpServerManager.listServers().filter((s) => s.source === 'project');
    const projectSkills = this.skillRegistry.listSkills().filter((s) => s.source === 'project');

    return {
      workspacePath,
      mcpServerIds: mcpServers.map((s) => s.serverId),
      enabledServerIds: mcpServers.filter((s) => s.enabled).map((s) => s.serverId),
      serverStatuses: Object.fromEntries(mcpServers.map((s) => [s.serverId, s.status])),
      skillIds: projectSkills.map((s) => s.skillId),
      skillVersions: Object.fromEntries(projectSkills.map((s) => [s.skillId, s.version])),
      configHash: config?.configHash || '',
      updatedAt: Date.now(),
    };
  }

  _emitConfigInvalid(workspacePath, section, errors) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(EVENT_TYPES.PROJECT_CAPABILITY_CONFIG_INVALID, {
        payload: {
          workspacePath,
          section,
          errors: secretFilter.sanitizeObject(errors),
        },
      });
    }
  }

  _emitSkillLoadFailed(workspacePath, skillId, error) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(EVENT_TYPES.SKILL_LOAD_FAILED, {
        payload: {
          workspacePath,
          skillId,
          error: secretFilter.sanitizeString(error),
        },
      });
    }
  }
}

const projectCapabilityLoader = new ProjectCapabilityLoader();

module.exports = {
  ProjectCapabilityLoader,
  projectCapabilityLoader,
};
