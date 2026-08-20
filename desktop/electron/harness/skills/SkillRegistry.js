/**
 * NEXUS CODEX HARNESS - SKILL REGISTRY (Milestone 14 Hardened)
 * Manages reusable, structured engineering guidance and instructions.
 * Resolves skills deterministically based on turn context, dependency requirements (requires),
 * scoping, and active status without model overhead.
 */

const crypto = require("crypto");
const {
  CAPABILITY_TYPE,
  EVENT_TYPES,
  SKILL_STATUS,
  SKILL_SCOPE,
  generateSkillId,
} = require("../types");
const { harnessEventBus } = require("../eventBus");
const { capabilityRegistry: defaultCapabilityRegistry } = require("../CapabilityRegistry");

class SkillRegistry {
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.capabilityRegistry = options.capabilityRegistry || defaultCapabilityRegistry;
    this.skills = new Map(); // skillId -> Skill Descriptor
    this.nameIndex = new Map(); // name -> skillId

    this._registerBuiltinSkills();
  }

  /**
   * Validates a skill definition structure.
   * @param {Object} skill
   * @returns {boolean}
   */
  validateSkill(skill) {
    if (!skill || typeof skill !== "object") {
      throw new Error("[HARNESS-SKILLS] Skill definition must be an object");
    }
    if (!skill.name || typeof skill.name !== "string" || !skill.name.trim()) {
      throw new Error("[HARNESS-SKILLS] Skill name is required and must be a string");
    }
    if (!skill.instructions || typeof skill.instructions !== "string" || !skill.instructions.trim()) {
      throw new Error(`[HARNESS-SKILLS] Skill "${skill.name}" must provide instructions text`);
    }
    return true;
  }

  /**
   * Registers a skill in the registry and as a capability in CapabilityRegistry.
   * @param {Object} skillDef
   * @returns {Object} Registered skill descriptor
   */
  registerSkill(skillDef = {}) {
    this.validateSkill(skillDef);

    const skillId = skillDef.skillId || skillDef.id || generateSkillId();
    const name = skillDef.name.trim();
    const version = skillDef.version || "1.0.0";
    const description = skillDef.description || `Engineering guidance skill for ${name}`;
    const source = skillDef.source || "skill";
    const scope = skillDef.scope || (source === "builtin" ? SKILL_SCOPE.BUILTIN : source === "project" ? SKILL_SCOPE.PROJECT : SKILL_SCOPE.SUBAGENT);
    const enabled = skillDef.enabled !== undefined ? Boolean(skillDef.enabled) : true;
    const status = skillDef.status || (enabled ? SKILL_STATUS.ACTIVE : SKILL_STATUS.DISABLED);

    const triggers = Array.isArray(skillDef.triggers) ? skillDef.triggers.map((t) => String(t).toLowerCase()) : [];
    const instructions = skillDef.instructions.trim();
    const allowedTools = Array.isArray(skillDef.allowedTools) ? [...skillDef.allowedTools] : null;
    const constraints = Array.isArray(skillDef.constraints) ? [...skillDef.constraints] : [];
    const requires = Array.isArray(skillDef.requires) ? [...skillDef.requires] : [];

    const configHash = skillDef.configHash || crypto.createHash("sha256").update(`${name}:${version}:${instructions}`).digest("hex").slice(0, 16);

    const skill = {
      skillId,
      name,
      version,
      description,
      source,
      scope,
      status,
      triggers,
      instructions,
      allowedTools,
      constraints,
      requires,
      enabled,
      configHash,
      loadedAt: Date.now(),
      metadata: skillDef.metadata ? { ...skillDef.metadata, source, scope, requires } : { source, scope, requires },
      registeredAt: Date.now(),
    };

    this.skills.set(skillId, skill);
    this.nameIndex.set(name.toLowerCase(), skillId);

    // Register into CapabilityRegistry as a SKILL capability
    if (this.capabilityRegistry) {
      this.capabilityRegistry.registerCapability({
        id: skillId,
        name,
        description,
        source,
        type: CAPABILITY_TYPE.SKILL,
        enabled,
        metadata: {
          skillId,
          version,
          source,
          scope,
          triggers,
          constraints,
          allowedTools,
          requires,
        },
      });
    }

    return skill;
  }

  /**
   * Atomically updates an existing skill with a new definition after validation.
   * If new definition is invalid, throws and leaves previous active version untouched.
   * @param {string} skillId
   * @param {Object} newSkillDef
   * @returns {Object} Updated skill
   */
  updateSkill(skillId, newSkillDef = {}) {
    const existing = this.getSkill(skillId);
    if (!existing) {
      throw new Error(`[HARNESS-SKILLS] Skill "${skillId}" not found for update`);
    }

    const name = newSkillDef.name ? newSkillDef.name.trim() : existing.name;
    const version = newSkillDef.version || existing.version;
    const description = newSkillDef.description || existing.description;
    const instructions = newSkillDef.instructions !== undefined ? (newSkillDef.instructions || '').trim() : existing.instructions;
    const triggers = Array.isArray(newSkillDef.triggers) ? newSkillDef.triggers.map((t) => String(t).toLowerCase()) : existing.triggers;
    const allowedTools = Array.isArray(newSkillDef.allowedTools) ? [...newSkillDef.allowedTools] : existing.allowedTools;
    const constraints = Array.isArray(newSkillDef.constraints) ? [...newSkillDef.constraints] : existing.constraints;
    const requires = Array.isArray(newSkillDef.requires) ? [...newSkillDef.requires] : existing.requires;
    const enabled = newSkillDef.enabled !== undefined ? Boolean(newSkillDef.enabled) : existing.enabled;
    const status = enabled ? SKILL_STATUS.ACTIVE : SKILL_STATUS.DISABLED;

    // Validate merged representation before applying
    this.validateSkill({
      name,
      instructions,
    });

    if (existing.name && existing.name.toLowerCase() !== name.toLowerCase()) {
      this.nameIndex.delete(existing.name.toLowerCase());
    }

    const configHash = newSkillDef.configHash || crypto.createHash("sha256").update(`${name}:${version}:${instructions}`).digest("hex").slice(0, 16);

    existing.name = name;
    existing.version = version;
    existing.description = description;
    existing.instructions = instructions;
    existing.triggers = triggers;
    existing.allowedTools = allowedTools;
    existing.constraints = constraints;
    existing.requires = requires;
    existing.enabled = enabled;
    existing.status = status;
    existing.configHash = configHash;
    existing.loadedAt = Date.now();

    this.nameIndex.set(name.toLowerCase(), skillId);

    if (this.capabilityRegistry) {
      this.capabilityRegistry.registerCapability({
        id: skillId,
        name,
        description,
        source: existing.source,
        type: CAPABILITY_TYPE.SKILL,
        enabled,
        metadata: {
          skillId,
          version,
          source: existing.source,
          scope: existing.scope,
          triggers,
          constraints,
          allowedTools,
          requires,
        },
      });
    }

    if (this.eventBus && typeof this.eventBus.emit === "function") {
      this.eventBus.emit(EVENT_TYPES.SKILL_RELOADED, {
        payload: {
          skillId,
          name,
          version,
        },
      });
    }

    return existing;
  }

  /**
   * Enables a skill.
   * @param {string} idOrName
   * @returns {boolean}
   */
  enableSkill(idOrName) {
    const skill = this.getSkill(idOrName);
    if (!skill) return false;

    skill.enabled = true;
    skill.status = SKILL_STATUS.ACTIVE;

    if (this.capabilityRegistry) {
      this.capabilityRegistry.enableCapability(skill.skillId);
    }
    return true;
  }

  /**
   * Disables a skill.
   * @param {string} idOrName
   * @returns {boolean}
   */
  disableSkill(idOrName) {
    const skill = this.getSkill(idOrName);
    if (!skill) return false;

    skill.enabled = false;
    skill.status = SKILL_STATUS.DISABLED;

    if (this.capabilityRegistry) {
      this.capabilityRegistry.disableCapability(skill.skillId);
    }
    return true;
  }

  /**
   * Unregisters a skill by ID or Name.
   * @param {string} idOrName
   * @returns {boolean}
   */
  unregisterSkill(idOrName) {
    const skill = this.getSkill(idOrName);
    if (!skill) return false;

    this.skills.delete(skill.skillId);
    this.nameIndex.delete(skill.name.toLowerCase());

    if (this.capabilityRegistry && typeof this.capabilityRegistry.unregisterCapability === "function") {
      this.capabilityRegistry.unregisterCapability(skill.skillId);
    }
    return true;
  }

  /**
   * Unregisters all project-level skills (retaining built-in skills).
   * @returns {number} Number of removed skills
   */
  unregisterProjectSkills() {
    let count = 0;
    for (const skill of Array.from(this.skills.values())) {
      if (skill.source === "project" || skill.metadata?.source === "project") {
        this.unregisterSkill(skill.skillId);
        count++;
      }
    }
    return count;
  }

  /**
   * Retrieves a skill by ID or Name.
   * @param {string} idOrName
   * @returns {Object|null}
   */
  getSkill(idOrName) {
    if (!idOrName || typeof idOrName !== "string") return null;
    if (this.skills.has(idOrName)) {
      return this.skills.get(idOrName);
    }
    const lower = idOrName.toLowerCase();
    const id = this.nameIndex.get(lower);
    if (id && this.skills.has(id)) {
      return this.skills.get(id);
    }
    return null;
  }

  /**
   * Lists all registered skills.
   * @returns {Array<Object>}
   */
  listSkills() {
    return Array.from(this.skills.values()).map((s) => ({
      skillId: s.skillId,
      name: s.name,
      version: s.version,
      description: s.description,
      source: s.source,
      scope: s.scope,
      status: s.status,
      triggers: s.triggers,
      allowedTools: s.allowedTools,
      constraints: s.constraints,
      requires: s.requires,
      enabled: s.enabled,
      configHash: s.configHash,
      loadedAt: s.loadedAt,
    }));
  }

  /**
   * Checks if all dependencies of a skill are satisfied.
   * @param {Object} skill
   * @returns {boolean}
   */
  checkDependenciesSatisfied(skill) {
    if (!skill || !Array.isArray(skill.requires) || skill.requires.length === 0) {
      return true;
    }

    for (const dep of skill.requires) {
      const depName = String(dep).trim();
      if (!depName) continue;

      // 1. Check if registered capability exists and is enabled
      const cap = this.capabilityRegistry ? this.capabilityRegistry.getCapability(depName) : null;
      if (cap && cap.enabled) {
        continue;
      }

      // 2. Check if registered skill exists and is active
      const depSkill = this.getSkill(depName);
      if (depSkill && depSkill.enabled && depSkill.status === SKILL_STATUS.ACTIVE) {
        continue;
      }

      // Dependency missing or disabled
      return false;
    }

    return true;
  }

  /**
   * Deterministically resolves relevant skills for a given turn context.
   * Inspects prompt text, active file path, intent, explicit skill requests, and dependencies.
   * @param {Object} context
   * @param {string} [context.userInput]
   * @param {string} [context.activeFilePath]
   * @param {string} [context.intent]
   * @param {Array<string>} [context.requestedSkills]
   * @returns {Array<Object>} Resolved matching skills
   */
  resolveSkills(context = {}) {
    const {
      userInput = "",
      activeFilePath = "",
      requestedSkills = [],
    } = context;

    const inputLower = (userInput || "").toLowerCase();
    const fileLower = (activeFilePath || "").toLowerCase();
    const requestedSet = new Set(requestedSkills.map((s) => String(s).toLowerCase()));

    const resolved = [];

    for (const skill of this.skills.values()) {
      if (!skill.enabled || skill.status !== SKILL_STATUS.ACTIVE) continue;

      // Check dependency resolution
      if (!this.checkDependenciesSatisfied(skill)) {
        continue;
      }

      let isMatch = false;

      // 1. Check explicit request
      if (requestedSet.has(skill.skillId.toLowerCase()) || requestedSet.has(skill.name.toLowerCase())) {
        isMatch = true;
      }

      // 2. Check trigger keywords / patterns
      if (!isMatch && skill.triggers.length > 0) {
        for (const trigger of skill.triggers) {
          if (trigger.startsWith("regex:")) {
            try {
              const rx = new RegExp(trigger.slice(6), "i");
              if (rx.test(inputLower) || rx.test(fileLower)) {
                isMatch = true;
                break;
              }
            } catch (e) {}
          } else if (inputLower.includes(trigger) || fileLower.includes(trigger)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        resolved.push(skill);
        if (this.eventBus && typeof this.eventBus.emit === "function") {
          this.eventBus.emit(EVENT_TYPES.SKILL_RESOLVED, {
            payload: {
              skillId: skill.skillId,
              name: skill.name,
              version: skill.version,
            },
          });
        }
      }
    }

    return resolved;
  }

  /**
   * Registers default built-in skills.
   * @private
   */
  _registerBuiltinSkills() {
    this.registerSkill({
      skillId: "skill_git_workflow",
      name: "Git Workflow",
      version: "1.0.0",
      description: "Best practices for atomic commits, branch safety, and diff inspection.",
      source: "builtin",
      scope: SKILL_SCOPE.BUILTIN,
      triggers: ["git", "commit", "branch", "pull request", "merge", "rebase", "diff", "checkout", "stash"],
      instructions: "Follow atomic commit practices. Inspect diffs before committing. Never force-push or mutate remote branch history without confirmation.",
      constraints: ["No hard resets without verification", "Verify branch clean state before switching"],
      allowedTools: ["run_command", "search_workspace", "read_file"],
    });

    this.registerSkill({
      skillId: "skill_test_driven_development",
      name: "Test Driven Development",
      version: "1.0.0",
      description: "Verify failing tests first, make surgical edits, and ensure 100% green verification.",
      source: "builtin",
      scope: SKILL_SCOPE.BUILTIN,
      triggers: ["test", "pytest", "jest", "unit test", "spec", "coverage", "assertion", "failing test", "regression"],
      instructions: "Identify or write a reproduction test first. Apply minimal code changes to pass the test. Run regression test suite to ensure zero regressions.",
      constraints: ["Always run verification suite after patching", "Do not mock critical test boundaries unless necessary"],
      allowedTools: ["run_tests", "run_command", "read_file", "search_workspace", "apply_patch"],
    });

    this.registerSkill({
      skillId: "skill_clean_refactoring",
      name: "Clean Refactoring",
      version: "1.0.0",
      description: "Refactor code for readability and performance while maintaining 100% functional equivalence.",
      source: "builtin",
      scope: SKILL_SCOPE.BUILTIN,
      triggers: ["refactor", "clean up", "redundant", "dead code", "duplicate", "extract function", "simplify"],
      instructions: "Preserve public interfaces and signatures. Eliminate dead code and redundant operations. Ensure tests pass before and after refactoring.",
      constraints: ["Maintain behavioral equivalence", "Preserve existing comments and docstrings"],
      allowedTools: ["read_file", "search_workspace", "apply_patch", "run_tests"],
    });

    this.registerSkill({
      skillId: "skill_security_audit",
      name: "Security Audit & Hardening",
      version: "1.0.0",
      description: "Identify and remediate security vulnerabilities, secret leaks, and unvalidated inputs.",
      source: "builtin",
      scope: SKILL_SCOPE.BUILTIN,
      triggers: ["security", "vulnerability", "audit", "cve", "secret", "injection", "sanitize", "hardcoded"],
      instructions: "Check for hardcoded secrets, SQL injection, path traversal, and unvalidated user inputs. Use secret filtering and bounded scopes.",
      constraints: ["Never log raw secrets", "Enforce input validation at system boundaries"],
      allowedTools: ["read_file", "search_workspace", "apply_patch", "run_tests"],
    });

    this.registerSkill({
      skillId: "skill_deployment",
      name: "Deployment Guidance",
      version: "1.0.0",
      description: "Guidance and constraints for building, packaging, and deploying applications.",
      source: "builtin",
      scope: SKILL_SCOPE.BUILTIN,
      triggers: ["deploy", "deployment", "production", "release", "docker", "publish", "pipeline", "ci/cd"],
      instructions: "Ensure production build passes (npm run build). Verify environment variables are configured. Do not run destructive deploy commands without explicit operator approval.",
      constraints: ["Deployment actions require operator approval", "Always run build verification prior to release"],
      allowedTools: ["run_command", "run_tests", "read_file"],
    });
  }

  /**
   * Clears registered skills (except builtins if re-init requested).
   */
  clear() {
    this.skills.clear();
    this.nameIndex.clear();
  }
}

const skillRegistry = new SkillRegistry();

module.exports = {
  SkillRegistry,
  skillRegistry,
};
