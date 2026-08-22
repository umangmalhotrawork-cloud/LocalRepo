/**
 * NEXUS SETTINGS & KEYBINDINGS MANAGER (Milestone 35)
 * 
 * Authoritative settings and keybinding store supporting global and workspace-scoped
 * configuration, conflict detection, safety filtering (no secret persistence),
 * and corrupted JSON recovery.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const secretFilter = require("../security/secretFilter");

const DEFAULT_SETTINGS = {
  // Editor
  "editor.fontSize": 13,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.wordWrap": "off", // "off" | "on" | "wordWrapColumn" | "bounded"
  "editor.minimap": false,
  "editor.lineNumbers": "on", // "on" | "off" | "relative"
  "editor.bracketPairColorization": true,
  "editor.formatOnSave": false,
  "editor.cursorBlinking": "smooth",
  "editor.smoothScrolling": true,

  // Appearance / UI
  "appearance.theme": "dark",
  "appearance.sidebarVisible": true,
  "appearance.bottomPanelVisible": true,
  "appearance.editorSplitDefault": "vertical", // "vertical" | "horizontal"

  // Terminal
  "terminal.defaultShell": "",
  "terminal.fontSize": 12,
  "terminal.scrollback": 1000,

  // AI / Agent
  "agent.preferredProvider": "gemini",
  "agent.preferredModel": "gemini-2.5-pro",
  "agent.approvalBehavior": "manual", // "manual" | "auto"
  "agent.streamingEnabled": true,
};

const DEFAULT_KEYBINDINGS = [
  { commandId: "workbench.action.save", title: "File: Save", defaultShortcut: "Cmd+S", category: "File" },
  { commandId: "workbench.action.closeTab", title: "View: Close Current Tab", defaultShortcut: "Cmd+W", category: "View" },
  { commandId: "workbench.action.quickOpen", title: "File: Quick Open / Search Files", defaultShortcut: "Cmd+P", category: "File" },
  { commandId: "workbench.action.commandPalette", title: "View: Command Palette", defaultShortcut: "Cmd+K", category: "View" },
  { commandId: "workbench.action.findInFiles", title: "Search: Find in Files", defaultShortcut: "Cmd+Shift+F", category: "Search" },
  { commandId: "workbench.action.symbols", title: "Search: Go to Symbol", defaultShortcut: "Cmd+T", category: "Search" },
  { commandId: "workbench.action.splitEditorRight", title: "View: Split Editor Right", defaultShortcut: "Cmd+\\", category: "View" },
  { commandId: "workbench.action.focusGroup1", title: "View: Focus First Editor Group", defaultShortcut: "Cmd+1", category: "View" },
  { commandId: "workbench.action.focusGroup2", title: "View: Focus Second Editor Group", defaultShortcut: "Cmd+2", category: "View" },
  { commandId: "workbench.action.sourceControl", title: "View: Toggle Source Control", defaultShortcut: "Cmd+Shift+G", category: "Git" },
  { commandId: "workbench.action.testExplorer", title: "View: Toggle Test Explorer", defaultShortcut: "Cmd+Shift+T", category: "Testing" },
  { commandId: "workbench.action.profiler", title: "View: Toggle Profiler", defaultShortcut: "Cmd+Shift+P", category: "Profiling" },
  { commandId: "workbench.action.securityAudit", title: "View: Toggle Security Audit", defaultShortcut: "Cmd+Shift+S", category: "Security" },
  { commandId: "workbench.action.agentChat", title: "AI: Toggle Agent Panel", defaultShortcut: "Cmd+Shift+I", category: "AI" },
  { commandId: "debug.start", title: "Debug: Start / Continue Debugging", defaultShortcut: "F5", category: "Debug" },
  { commandId: "debug.stepOver", title: "Debug: Step Over", defaultShortcut: "F10", category: "Debug" },
  { commandId: "debug.stepInto", title: "Debug: Step Into", defaultShortcut: "F11", category: "Debug" },
  { commandId: "debug.stepOut", title: "Debug: Step Out", defaultShortcut: "Shift+F11", category: "Debug" },
  { commandId: "debug.stop", title: "Debug: Stop Debugging", defaultShortcut: "Shift+F5", category: "Debug" },
  { commandId: "debug.toggleBreakpoint", title: "Debug: Toggle Breakpoint", defaultShortcut: "F9", category: "Debug" },
  { commandId: "git.refreshGutter", title: "Git: Refresh Gutter Annotations", defaultShortcut: "Cmd+Shift+R", category: "Git" },
];

function normalizeShortcut(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/control/g, "ctrl")
    .replace(/command/g, "cmd")
    .replace(/meta/g, "cmd")
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
    .sort()
    .join("+");
}

class SettingsManager {
  constructor(options = {}) {
    const defaultDir = path.join(os.tmpdir(), "nexus_global_settings");
    this.storageDir = options.storageDir || defaultDir;
    this.globalSettingsFile = path.join(this.storageDir, "global_settings.json");
    this.customKeybindingsFile = path.join(this.storageDir, "custom_keybindings.json");
    this.workspaceSettingsCache = new Map(); // workspacePath -> settings object
    this.globalSettings = { ...DEFAULT_SETTINGS };
    this.customKeybindings = {}; // commandId -> customShortcut string

    this.ensureStorageDir();
    this.loadGlobalSettings();
    this.loadCustomKeybindings();
  }

  ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {
      console.warn("[SETTINGS] Failed to create storage dir:", e.message);
    }
  }

  loadGlobalSettings() {
    if (!fs.existsSync(this.globalSettingsFile)) {
      this.saveGlobalSettings();
      return;
    }
    try {
      const raw = fs.readFileSync(this.globalSettingsFile, "utf8");
      const parsed = JSON.parse(raw);
      this.globalSettings = { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.warn("[SETTINGS] Corrupted global settings file, resetting to defaults:", e.message);
      this.globalSettings = { ...DEFAULT_SETTINGS };
      this.saveGlobalSettings();
    }
  }

  saveGlobalSettings() {
    this.ensureStorageDir();
    try {
      // Exclude any inadvertent secret keys
      const safe = {};
      for (const [k, v] of Object.entries(this.globalSettings)) {
        if (!k.toLowerCase().includes("key") && !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("token") && !k.toLowerCase().includes("password")) {
          safe[k] = v;
        }
      }
      fs.writeFileSync(this.globalSettingsFile, JSON.stringify(safe, null, 2), "utf8");
    } catch (e) {
      console.warn("[SETTINGS] Failed to save global settings:", e.message);
    }
  }

  loadCustomKeybindings() {
    if (!fs.existsSync(this.customKeybindingsFile)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.customKeybindingsFile, "utf8");
      this.customKeybindings = JSON.parse(raw) || {};
    } catch (e) {
      console.warn("[SETTINGS] Corrupted keybindings file, resetting to defaults:", e.message);
      this.customKeybindings = {};
    }
  }

  saveCustomKeybindings() {
    this.ensureStorageDir();
    try {
      fs.writeFileSync(this.customKeybindingsFile, JSON.stringify(this.customKeybindings, null, 2), "utf8");
    } catch (e) {
      console.warn("[SETTINGS] Failed to save custom keybindings:", e.message);
    }
  }

  getWorkspaceSettingsPath(workspacePath) {
    if (!workspacePath) return null;
    return path.join(workspacePath, ".nexus", "settings.json");
  }

  loadWorkspaceSettings(workspacePath) {
    if (!workspacePath) return {};
    if (this.workspaceSettingsCache.has(workspacePath)) {
      return this.workspaceSettingsCache.get(workspacePath);
    }

    const wsFile = this.getWorkspaceSettingsPath(workspacePath);
    if (!wsFile || !fs.existsSync(wsFile)) {
      this.workspaceSettingsCache.set(workspacePath, {});
      return {};
    }

    try {
      const raw = fs.readFileSync(wsFile, "utf8");
      const parsed = JSON.parse(raw) || {};
      this.workspaceSettingsCache.set(workspacePath, parsed);
      return parsed;
    } catch (e) {
      console.warn("[SETTINGS] Corrupted workspace settings file:", e.message);
      this.workspaceSettingsCache.set(workspacePath, {});
      return {};
    }
  }

  saveWorkspaceSettings(workspacePath, settings) {
    if (!workspacePath) return;
    const wsFile = this.getWorkspaceSettingsPath(workspacePath);
    if (!wsFile) return;

    try {
      const dir = path.dirname(wsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(wsFile, JSON.stringify(settings, null, 2), "utf8");
      this.workspaceSettingsCache.set(workspacePath, settings);
    } catch (e) {
      console.warn("[SETTINGS] Failed to save workspace settings:", e.message);
    }
  }

  /**
   * Get all effective merged settings for a workspace.
   */
  getSettings(workspacePath) {
    const wsSettings = workspacePath ? this.loadWorkspaceSettings(workspacePath) : {};
    const merged = { ...DEFAULT_SETTINGS, ...this.globalSettings, ...wsSettings };
    return {
      settings: merged,
      defaults: DEFAULT_SETTINGS,
      workspaceOverrides: wsSettings,
    };
  }

  /**
   * Update a specific setting in global or workspace scope.
   */
  updateSetting(workspacePath, key, value, scope = "global") {
    // Prohibit storing credentials/secrets
    const lk = String(key).toLowerCase();
    if (lk.includes("password") || lk.includes("secret") || (lk.includes("apikey") && !lk.startsWith("agent.preferred"))) {
      return { success: false, error: "SecurityError: Secrets and API keys must not be stored in generic settings" };
    }

    if (scope === "workspace" && workspacePath) {
      const wsSettings = this.loadWorkspaceSettings(workspacePath);
      wsSettings[key] = value;
      this.saveWorkspaceSettings(workspacePath, wsSettings);
    } else {
      this.globalSettings[key] = value;
      this.saveGlobalSettings();
    }

    return {
      success: true,
      key,
      value,
      scope,
      ...this.getSettings(workspacePath),
    };
  }

  /**
   * Reset a setting to its default value.
   */
  resetSetting(workspacePath, key, scope = "global") {
    if (scope === "workspace" && workspacePath) {
      const wsSettings = this.loadWorkspaceSettings(workspacePath);
      delete wsSettings[key];
      this.saveWorkspaceSettings(workspacePath, wsSettings);
    } else {
      if (DEFAULT_SETTINGS[key] !== undefined) {
        this.globalSettings[key] = DEFAULT_SETTINGS[key];
      } else {
        delete this.globalSettings[key];
      }
      this.saveGlobalSettings();
    }

    return {
      success: true,
      key,
      scope,
      ...this.getSettings(workspacePath),
    };
  }

  /**
   * Reset all settings in the given scope.
   */
  resetAll(workspacePath, scope = "global") {
    if (scope === "workspace" && workspacePath) {
      this.saveWorkspaceSettings(workspacePath, {});
    } else {
      this.globalSettings = { ...DEFAULT_SETTINGS };
      this.saveGlobalSettings();
    }

    return {
      success: true,
      scope,
      ...this.getSettings(workspacePath),
    };
  }

  /**
   * Get all registered keybindings with their active and default shortcuts.
   */
  getKeybindings() {
    const keybindings = DEFAULT_KEYBINDINGS.map((kb) => {
      const custom = this.customKeybindings[kb.commandId];
      return {
        ...kb,
        activeShortcut: custom || kb.defaultShortcut,
        customShortcut: custom || null,
        isCustomized: Boolean(custom && custom !== kb.defaultShortcut),
      };
    });

    const conflicts = this.detectConflicts(keybindings);
    return {
      keybindings,
      conflicts,
    };
  }

  /**
   * Detects duplicate shortcut assignments.
   */
  detectConflicts(keybindingsList) {
    const list = keybindingsList || this.getKeybindings().keybindings;
    const shortcutMap = new Map(); // normalizedShortcut -> commandId[]
    const conflicts = [];

    for (const item of list) {
      const norm = normalizeShortcut(item.activeShortcut);
      if (!norm) continue;

      if (!shortcutMap.has(norm)) {
        shortcutMap.set(norm, [item]);
      } else {
        shortcutMap.get(norm).push(item);
      }
    }

    for (const [norm, items] of shortcutMap.entries()) {
      if (items.length > 1) {
        conflicts.push({
          normalizedShortcut: norm,
          shortcut: items[0].activeShortcut,
          commands: items.map((i) => ({ commandId: i.commandId, title: i.title })),
          message: "Conflicting shortcut \"" + items[0].activeShortcut + "\" is assigned to multiple commands: " + items.map((i) => i.title).join(", "),
        });
      }
    }

    return conflicts;
  }

  /**
   * Update or assign a custom keybinding to a command.
   */
  updateKeybinding(commandId, shortcut) {
    if (!commandId) return { success: false, error: "Missing commandId" };

    const cleanShortcut = (shortcut || "").trim();
    if (!cleanShortcut) {
      delete this.customKeybindings[commandId];
    } else {
      this.customKeybindings[commandId] = cleanShortcut;
    }

    this.saveCustomKeybindings();

    const kbData = this.getKeybindings();
    return {
      success: true,
      commandId,
      shortcut: cleanShortcut,
      ...kbData,
    };
  }

  /**
   * Reset a command keybinding to its default shortcut.
   */
  resetKeybinding(commandId) {
    if (!commandId) return { success: false, error: "Missing commandId" };
    delete this.customKeybindings[commandId];
    this.saveCustomKeybindings();

    return {
      success: true,
      commandId,
      ...this.getKeybindings(),
    };
  }

  /**
   * Reset all keybindings to defaults.
   */
  resetAllKeybindings() {
    this.customKeybindings = {};
    this.saveCustomKeybindings();
    return {
      success: true,
      ...this.getKeybindings(),
    };
  }
}

const settingsManager = new SettingsManager();

module.exports = {
  SettingsManager,
  settingsManager,
  DEFAULT_SETTINGS,
  DEFAULT_KEYBINDINGS,
  normalizeShortcut,
};
