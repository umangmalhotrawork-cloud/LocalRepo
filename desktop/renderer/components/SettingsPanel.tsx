"use client";

import React, { useState, useMemo } from "react";
import {
  Settings,
  Sliders,
  Type,
  Layout,
  Terminal,
  Bot,
  Keyboard,
  RotateCcw,
  Search,
  AlertTriangle,
  Check,
  X,
  Edit2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useSettings, KeybindingItem } from "../hooks/useSettings";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  settingsHook: ReturnType<typeof useSettings>;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  workspacePath,
  settingsHook,
}: SettingsPanelProps) {
  const {
    settings,
    defaults,
    workspaceOverrides,
    keybindings,
    conflicts,
    updateSetting,
    resetSetting,
    resetAll,
    updateKeybinding,
    resetKeybinding,
    resetAllKeybindings,
  } = settingsHook;

  const [activeTab, setActiveTab] = useState<"editor" | "appearance" | "terminal" | "agent" | "keybindings">("editor");
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<"global" | "workspace">("global");
  const [editingKeybinding, setEditingKeybinding] = useState<KeybindingItem | null>(null);
  const [keybindingInput, setKeybindingInput] = useState("");

  const filteredKeybindings = useMemo(() => {
    if (!searchQuery.trim()) return keybindings;
    const q = searchQuery.toLowerCase();
    return keybindings.filter(
      (kb) =>
        kb.title.toLowerCase().includes(q) ||
        kb.commandId.toLowerCase().includes(q) ||
        kb.category.toLowerCase().includes(q) ||
        kb.activeShortcut.toLowerCase().includes(q)
    );
  }, [keybindings, searchQuery]);

  if (!isOpen) return null;

  const renderSettingRow = (
    key: string,
    title: string,
    description: string,
    control: React.ReactNode
  ) => {
    const isModified = settings[key] !== defaults[key];
    const isWsOverridden = workspaceOverrides[key] !== undefined;

    if (
      searchQuery.trim() &&
      !title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !key.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return null;
    }

    return (
      <div
        key={key}
        className="p-3 rounded-xl bg-[#0a0a0f] border border-[#1a1a24] hover:border-[#272738] transition-colors flex items-center justify-between gap-4"
      >
        <div className="space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200 text-xs">{title}</span>
            {isWsOverridden && (
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[9.5px] font-bold">
                Workspace
              </span>
            )}
            {isModified && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Modified from default" />
            )}
          </div>
          <p className="text-[11px] text-zinc-400">{description}</p>
          <span className="text-[10px] text-zinc-600 font-mono">{key}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {control}
          {isModified && (
            <button
              onClick={() => resetSetting(key, scope)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a24] transition-colors cursor-pointer"
              title="Reset to Default"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 font-mono select-none">
      <div className="w-full max-w-4xl h-[85vh] bg-[#07070a] border border-[#1f1f2a] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="h-14 bg-[#0a0a10] border-b border-[#1f1f2a] px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">SETTINGS & PREFERENCES</h2>
              <p className="text-[10.5px] text-zinc-500">Configure editor, appearance, terminal, AI, and keybindings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Scope Switcher */}
            <div className="flex items-center bg-[#121218] p-0.5 rounded-lg border border-[#242436] text-[11px]">
              <button
                onClick={() => setScope("global")}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                  scope === "global" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                User (Global)
              </button>
              <button
                onClick={() => setScope("workspace")}
                className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                  scope === "workspace" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Workspace
              </button>
            </div>

            {/* Reset All */}
            <button
              onClick={() => {
                if (confirm(`Reset all ${scope} settings to defaults?`)) {
                  resetAll(scope);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-[#151520] hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-[#272738] hover:border-rose-500/40 text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a24] transition-colors cursor-pointer"
              title="Close Settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="h-10 bg-[#09090d] border-b border-[#1a1a24] px-5 flex items-center gap-2 shrink-0">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings by keyword (e.g. font, wrap, minimap, terminal, keybinding)..."
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-white text-xs">
              Clear
            </button>
          )}
        </div>

        {/* Conflict Warning Alert Banner */}
        {conflicts.length > 0 && (
          <div className="bg-amber-950/80 border-b border-amber-500/40 px-5 py-2 flex items-center gap-3 text-amber-200 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Keybinding Conflict Detected: </span>
              <span>{conflicts[0].message}</span>
            </div>
            <button
              onClick={() => setActiveTab("keybindings")}
              className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-500/50 text-[10.5px] font-bold text-amber-100 hover:bg-amber-800"
            >
              Resolve
            </button>
          </div>
        )}

        {/* Main Body: Tabs + Settings Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-52 border-r border-[#1a1a24] bg-[#050508] p-3 space-y-1 shrink-0">
            {[
              { id: "editor", label: "Editor", icon: Type },
              { id: "appearance", label: "Appearance", icon: Layout },
              { id: "terminal", label: "Terminal", icon: Terminal },
              { id: "agent", label: "AI / Agent", icon: Bot },
              { id: "keybindings", label: "Keyboard Shortcuts", icon: Keyboard },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e16]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Detail Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-[#07070b] space-y-3">
            {activeTab === "editor" && (
              <>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Editor Options</div>

                {renderSettingRow(
                  "editor.fontSize",
                  "Font Size",
                  "Controls the font size in pixels for Monaco editor instances.",
                  <input
                    type="number"
                    min={10}
                    max={28}
                    value={settings["editor.fontSize"] || 13}
                    onChange={(e) => updateSetting("editor.fontSize", Number(e.target.value), scope)}
                    className="w-20 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 text-center"
                  />
                )}

                {renderSettingRow(
                  "editor.tabSize",
                  "Tab Size",
                  "Number of spaces a tab is equal to.",
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={settings["editor.tabSize"] || 2}
                    onChange={(e) => updateSetting("editor.tabSize", Number(e.target.value), scope)}
                    className="w-20 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 text-center"
                  />
                )}

                {renderSettingRow(
                  "editor.wordWrap",
                  "Word Wrap",
                  "Controls whether lines should wrap or continue horizontally.",
                  <select
                    value={settings["editor.wordWrap"] || "off"}
                    onChange={(e) => updateSetting("editor.wordWrap", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="off">off (No wrap)</option>
                    <option value="on">on (Viewport width)</option>
                    <option value="wordWrapColumn">wordWrapColumn</option>
                    <option value="bounded">bounded</option>
                  </select>
                )}

                {renderSettingRow(
                  "editor.minimap",
                  "Minimap",
                  "Controls whether the code overview minimap is shown on the editor right edge.",
                  <input
                    type="checkbox"
                    checked={Boolean(settings["editor.minimap"])}
                    onChange={(e) => updateSetting("editor.minimap", e.target.checked, scope)}
                    className="w-4 h-4 rounded bg-[#12121c] border-[#242436] accent-cyan-400 cursor-pointer"
                  />
                )}

                {renderSettingRow(
                  "editor.lineNumbers",
                  "Line Numbers",
                  "Controls line numbers display on editor margin.",
                  <select
                    value={settings["editor.lineNumbers"] || "on"}
                    onChange={(e) => updateSetting("editor.lineNumbers", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="on">on</option>
                    <option value="off">off</option>
                    <option value="relative">relative</option>
                  </select>
                )}

                {renderSettingRow(
                  "editor.bracketPairColorization",
                  "Bracket Pair Colorization",
                  "Colorizes matching bracket pairs with distinct hues.",
                  <input
                    type="checkbox"
                    checked={Boolean(settings["editor.bracketPairColorization"])}
                    onChange={(e) => updateSetting("editor.bracketPairColorization", e.target.checked, scope)}
                    className="w-4 h-4 rounded bg-[#12121c] border-[#242436] accent-cyan-400 cursor-pointer"
                  />
                )}

                {renderSettingRow(
                  "editor.formatOnSave",
                  "Format On Save",
                  "Automatically formats the active document when saving.",
                  <input
                    type="checkbox"
                    checked={Boolean(settings["editor.formatOnSave"])}
                    onChange={(e) => updateSetting("editor.formatOnSave", e.target.checked, scope)}
                    className="w-4 h-4 rounded bg-[#12121c] border-[#242436] accent-cyan-400 cursor-pointer"
                  />
                )}
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Appearance Options</div>

                {renderSettingRow(
                  "appearance.theme",
                  "Theme",
                  "Controls the overall application and editor dark theme palette.",
                  <select
                    value={settings["appearance.theme"] || "dark"}
                    onChange={(e) => updateSetting("appearance.theme", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="dark">Nexus Obsidian (Dark)</option>
                    <option value="midnight">Midnight Cyan</option>
                    <option value="cyberpunk">Cyberpunk Neon</option>
                  </select>
                )}

                {renderSettingRow(
                  "appearance.editorSplitDefault",
                  "Default Editor Split Direction",
                  "Controls whether new editor groups split vertically or horizontally by default.",
                  <select
                    value={settings["appearance.editorSplitDefault"] || "vertical"}
                    onChange={(e) => updateSetting("appearance.editorSplitDefault", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="vertical">Vertical (Side by side)</option>
                    <option value="horizontal">Horizontal (Stacked)</option>
                  </select>
                )}

                {renderSettingRow(
                  "appearance.sidebarVisible",
                  "Sidebar Visible by Default",
                  "Controls initial visibility of the left tool sidebar.",
                  <input
                    type="checkbox"
                    checked={Boolean(settings["appearance.sidebarVisible"])}
                    onChange={(e) => updateSetting("appearance.sidebarVisible", e.target.checked, scope)}
                    className="w-4 h-4 rounded bg-[#12121c] border-[#242436] accent-cyan-400 cursor-pointer"
                  />
                )}
              </>
            )}

            {activeTab === "terminal" && (
              <>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Terminal Options</div>

                {renderSettingRow(
                  "terminal.defaultShell",
                  "Default Shell Path",
                  "Custom shell executable path (e.g. /bin/zsh, /bin/bash). Leave empty for system default.",
                  <input
                    type="text"
                    value={settings["terminal.defaultShell"] || ""}
                    placeholder="/bin/zsh"
                    onChange={(e) => updateSetting("terminal.defaultShell", e.target.value, scope)}
                    className="w-48 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                )}

                {renderSettingRow(
                  "terminal.fontSize",
                  "Terminal Font Size",
                  "Font size for integrated terminal sessions.",
                  <input
                    type="number"
                    min={10}
                    max={24}
                    value={settings["terminal.fontSize"] || 12}
                    onChange={(e) => updateSetting("terminal.fontSize", Number(e.target.value), scope)}
                    className="w-20 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 text-center"
                  />
                )}

                {renderSettingRow(
                  "terminal.scrollback",
                  "Scrollback Buffer Lines",
                  "Maximum lines of terminal output buffer retained per tab.",
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    value={settings["terminal.scrollback"] || 1000}
                    onChange={(e) => updateSetting("terminal.scrollback", Number(e.target.value), scope)}
                    className="w-24 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 text-center"
                  />
                )}
              </>
            )}

            {activeTab === "agent" && (
              <>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">AI / Agent Preferences</div>

                {renderSettingRow(
                  "agent.preferredProvider",
                  "Default AI Provider",
                  "Default model provider for Agent turns and chat completions.",
                  <select
                    value={settings["agent.preferredProvider"] || "gemini"}
                    onChange={(e) => updateSetting("agent.preferredProvider", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI GPT</option>
                  </select>
                )}

                {renderSettingRow(
                  "agent.preferredModel",
                  "Default Model",
                  "Specific model identifier to dispatch tasks to.",
                  <input
                    type="text"
                    value={settings["agent.preferredModel"] || "gemini-2.5-pro"}
                    onChange={(e) => updateSetting("agent.preferredModel", e.target.value, scope)}
                    className="w-48 px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                )}

                {renderSettingRow(
                  "agent.approvalBehavior",
                  "Tool Approval Mode",
                  "Whether mutating actions require explicit manual approval.",
                  <select
                    value={settings["agent.approvalBehavior"] || "manual"}
                    onChange={(e) => updateSetting("agent.approvalBehavior", e.target.value, scope)}
                    className="px-2 py-1 bg-[#12121c] border border-[#242436] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="manual">Manual (Prompt for approval)</option>
                    <option value="auto">Autonomous (Auto-apply non-destructive)</option>
                  </select>
                )}

                {renderSettingRow(
                  "agent.streamingEnabled",
                  "Token Streaming",
                  "Enable real-time token streaming for AI reasoning and responses.",
                  <input
                    type="checkbox"
                    checked={Boolean(settings["agent.streamingEnabled"])}
                    onChange={(e) => updateSetting("agent.streamingEnabled", e.target.checked, scope)}
                    className="w-4 h-4 rounded bg-[#12121c] border-[#242436] accent-cyan-400 cursor-pointer"
                  />
                )}
              </>
            )}

            {activeTab === "keybindings" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Configured Keyboard Shortcuts ({filteredKeybindings.length})
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("Reset all custom keybindings to defaults?")) {
                        resetAllKeybindings();
                      }
                    }}
                    className="px-2 py-1 rounded bg-[#12121c] hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border border-[#242436] text-[10.5px] font-bold cursor-pointer"
                  >
                    Reset All Shortcuts
                  </button>
                </div>

                <div className="rounded-xl border border-[#1a1a24] overflow-hidden bg-[#0a0a0f]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#1a1a24] bg-[#0d0d14] text-[10.5px] text-zinc-500 uppercase tracking-wider">
                        <th className="p-2.5 font-bold">Command</th>
                        <th className="p-2.5 font-bold">Category</th>
                        <th className="p-2.5 font-bold">Keybinding</th>
                        <th className="p-2.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#15151f]">
                      {filteredKeybindings.map((kb) => {
                        const isConflicted = conflicts.some((c) =>
                          c.commands.some((cmd) => cmd.commandId === kb.commandId)
                        );

                        return (
                          <tr key={kb.commandId} className="hover:bg-[#0e0e18] transition-colors">
                            <td className="p-2.5 font-mono">
                              <div className="text-zinc-200 font-bold">{kb.title}</div>
                              <div className="text-[10px] text-zinc-600">{kb.commandId}</div>
                            </td>
                            <td className="p-2.5 text-zinc-400 text-[11px]">{kb.category}</td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-[#161622] border border-[#262638] text-cyan-300 font-bold font-mono text-[11px]">
                                  {kb.activeShortcut}
                                </span>
                                {kb.isCustomized && (
                                  <span className="text-[9.5px] text-purple-400 font-bold">(custom)</span>
                                )}
                                {isConflicted && (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Conflict</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingKeybinding(kb);
                                    setKeybindingInput(kb.activeShortcut);
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-[#1a1a28] cursor-pointer"
                                  title="Edit shortcut"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {kb.isCustomized && (
                                  <button
                                    onClick={() => resetKeybinding(kb.commandId)}
                                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#1a1a28] cursor-pointer"
                                    title="Reset to default"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Edit Keybinding */}
        {editingKeybinding && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0a0a10] border border-[#242436] rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1f1f2a] pb-3">
                <span className="font-bold text-white text-xs">Edit Keybinding</span>
                <button
                  onClick={() => setEditingKeybinding(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <span className="text-zinc-400 text-xs font-bold">{editingKeybinding.title}</span>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Type new shortcut combination (e.g. Cmd+Shift+K, Ctrl+Alt+T, F8).
                </p>
              </div>

              <input
                autoFocus
                type="text"
                value={keybindingInput}
                onChange={(e) => setKeybindingInput(e.target.value)}
                placeholder="e.g. Cmd+Shift+K"
                className="w-full px-3 py-2 bg-[#050508] border border-[#2a2a40] rounded-lg text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1f1f2a]">
                <button
                  type="button"
                  onClick={() => setEditingKeybinding(null)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (keybindingInput.trim()) {
                      updateKeybinding(editingKeybinding.commandId, keybindingInput.trim());
                    }
                    setEditingKeybinding(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-400 text-black font-bold text-xs cursor-pointer hover:bg-cyan-300"
                >
                  Save Shortcut
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
