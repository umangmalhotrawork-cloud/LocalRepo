"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface KeybindingItem {
  commandId: string;
  title: string;
  defaultShortcut: string;
  activeShortcut: string;
  customShortcut: string | null;
  category: string;
  isCustomized: boolean;
}

export interface KeybindingConflict {
  normalizedShortcut: string;
  shortcut: string;
  commands: Array<{ commandId: string; title: string }>;
  message: string;
}

export interface SettingsState {
  settings: Record<string, any>;
  defaults: Record<string, any>;
  workspaceOverrides: Record<string, any>;
  keybindings: KeybindingItem[];
  conflicts: KeybindingConflict[];
  loaded: boolean;
}

const DEFAULT_FALLBACK_SETTINGS: Record<string, any> = {
  "editor.fontSize": 13,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.wordWrap": "off",
  "editor.minimap": false,
  "editor.lineNumbers": "on",
  "editor.bracketPairColorization": true,
  "editor.formatOnSave": false,
  "editor.cursorBlinking": "smooth",
  "editor.smoothScrolling": true,
  "appearance.theme": "dark",
  "appearance.sidebarVisible": true,
  "appearance.bottomPanelVisible": true,
  "appearance.editorSplitDefault": "vertical",
  "terminal.defaultShell": "",
  "terminal.fontSize": 12,
  "terminal.scrollback": 1000,
  "agent.preferredProvider": "gemini",
  "agent.preferredModel": "gemini-2.5-pro",
  "agent.approvalBehavior": "manual",
  "agent.streamingEnabled": true,
};

export function useSettings(workspacePath?: string) {
  const [settings, setSettings] = useState<Record<string, any>>(DEFAULT_FALLBACK_SETTINGS);
  const [defaults, setDefaults] = useState<Record<string, any>>(DEFAULT_FALLBACK_SETTINGS);
  const [workspaceOverrides, setWorkspaceOverrides] = useState<Record<string, any>>({});
  const [keybindings, setKeybindings] = useState<KeybindingItem[]>([]);
  const [conflicts, setConflicts] = useState<KeybindingConflict[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  const reloadSettings = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.settings?.get) {
        const res = await window.electronAPI.settings.get(workspacePath || "");
        if (res && res.settings) {
          setSettings(res.settings);
          if (res.defaults) setDefaults(res.defaults);
          if (res.workspaceOverrides) setWorkspaceOverrides(res.workspaceOverrides);
        }
      }
      if (typeof window !== "undefined" && window.electronAPI?.keybindings?.get) {
        const kbRes = await window.electronAPI.keybindings.get();
        if (kbRes && Array.isArray(kbRes.keybindings)) {
          setKeybindings(kbRes.keybindings);
          setConflicts(kbRes.conflicts || []);
        }
      }
    } catch (err) {
      console.warn("[USE_SETTINGS] Failed to load settings:", err);
    } finally {
      setLoaded(true);
    }
  }, [workspacePath]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSetting = async (key: string, value: any, scope: "global" | "workspace" = "global") => {
    // Optimistic UI update
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (scope === "workspace") {
      setWorkspaceOverrides((prev) => ({ ...prev, [key]: value }));
    }

    try {
      if (typeof window !== "undefined" && window.electronAPI?.settings?.update) {
        const res = await window.electronAPI.settings.update({
          workspacePath: workspacePath || "",
          key,
          value,
          scope,
        });
        if (res && res.settings) {
          setSettings(res.settings);
          if (res.workspaceOverrides) setWorkspaceOverrides(res.workspaceOverrides);
        }
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to update setting:", err);
    }
  };

  const resetSetting = async (key: string, scope: "global" | "workspace" = "global") => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.settings?.reset) {
        const res = await window.electronAPI.settings.reset({
          workspacePath: workspacePath || "",
          key,
          scope,
        });
        if (res && res.settings) {
          setSettings(res.settings);
          if (res.workspaceOverrides) setWorkspaceOverrides(res.workspaceOverrides);
        }
      } else {
        setSettings((prev) => ({ ...prev, [key]: defaults[key] }));
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to reset setting:", err);
    }
  };

  const resetAll = async (scope: "global" | "workspace" = "global") => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.settings?.resetAll) {
        const res = await window.electronAPI.settings.resetAll({
          workspacePath: workspacePath || "",
          scope,
        });
        if (res && res.settings) {
          setSettings(res.settings);
          if (res.workspaceOverrides) setWorkspaceOverrides(res.workspaceOverrides);
        }
      } else {
        setSettings(defaults);
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to reset all settings:", err);
    }
  };

  const updateKeybinding = async (commandId: string, shortcut: string) => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.keybindings?.update) {
        const res = await window.electronAPI.keybindings.update({
          commandId,
          shortcut,
        });
        if (res && Array.isArray(res.keybindings)) {
          setKeybindings(res.keybindings);
          setConflicts(res.conflicts || []);
        }
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to update keybinding:", err);
    }
  };

  const resetKeybinding = async (commandId: string) => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.keybindings?.reset) {
        const res = await window.electronAPI.keybindings.reset(commandId);
        if (res && Array.isArray(res.keybindings)) {
          setKeybindings(res.keybindings);
          setConflicts(res.conflicts || []);
        }
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to reset keybinding:", err);
    }
  };

  const resetAllKeybindings = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI?.keybindings?.resetAll) {
        const res = await window.electronAPI.keybindings.resetAll();
        if (res && Array.isArray(res.keybindings)) {
          setKeybindings(res.keybindings);
          setConflicts(res.conflicts || []);
        }
      }
    } catch (err) {
      console.error("[USE_SETTINGS] Failed to reset all keybindings:", err);
    }
  };

  /**
   * Matches an incoming KeyboardEvent against the configured keybindings table.
   */
  const matchEventToCommand = useCallback(
    (e: KeyboardEvent): string | null => {
      const isCmd = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      const key = e.key.toUpperCase();

      for (const item of keybindings) {
        const parts = item.activeShortcut.split("+").map((p) => p.trim());
        const hasCmd = parts.some((p) => p.toLowerCase() === "cmd" || p.toLowerCase() === "ctrl");
        const hasShift = parts.some((p) => p.toLowerCase() === "shift");
        const hasAlt = parts.some((p) => p.toLowerCase() === "alt" || p.toLowerCase() === "opt");
        const mainKey = parts.find(
          (p) => !["cmd", "ctrl", "shift", "alt", "opt"].includes(p.toLowerCase())
        );

        if (hasCmd === isCmd && hasShift === isShift && hasAlt === isAlt) {
          if (mainKey && (mainKey.toUpperCase() === key || mainKey.toLowerCase() === e.key.toLowerCase())) {
            return item.commandId;
          }
        }
      }
      return null;
    },
    [keybindings]
  );

  return {
    settings,
    defaults,
    workspaceOverrides,
    keybindings,
    conflicts,
    loaded,
    updateSetting,
    resetSetting,
    resetAll,
    updateKeybinding,
    resetKeybinding,
    resetAllKeybindings,
    matchEventToCommand,
    reloadSettings,
  };
}
