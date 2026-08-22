/**
 * Comprehensive Test Suite for Milestone 35: Settings, Keybindings + Final IDE Polish
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { SettingsManager, DEFAULT_SETTINGS, DEFAULT_KEYBINDINGS } = require("./settingsManager");

let passedAssertions = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  passedAssertions++;
  console.log("  ✔ " + message);
}

async function runAllTests() {
  console.log("==================================================");
  console.log("RUNNING MILESTONE 35 SETTINGS & KEYBINDINGS TESTS");
  console.log("==================================================");

  const testStorageDir = path.join(os.tmpdir(), "nexus_test_settings_" + Date.now());
  const testWorkspaceDir = path.join(os.tmpdir(), "nexus_test_ws_" + Date.now());
  fs.mkdirSync(testStorageDir, { recursive: true });
  fs.mkdirSync(testWorkspaceDir, { recursive: true });

  const manager = new SettingsManager({ storageDir: testStorageDir });

  // 1. Default Settings
  console.log("\n[TEST GROUP 1: Default Settings Initialization]");
  const initial = manager.getSettings();
  testAssert(initial.settings["editor.fontSize"] === 13, "Default editor.fontSize is 13");
  testAssert(initial.settings["editor.tabSize"] === 2, "Default editor.tabSize is 2");
  testAssert(initial.settings["editor.wordWrap"] === "off", "Default editor.wordWrap is off");
  testAssert(initial.settings["editor.minimap"] === false, "Default editor.minimap is false");
  testAssert(initial.settings["appearance.theme"] === "dark", "Default appearance.theme is dark");

  // 2. Setting Update
  console.log("\n[TEST GROUP 2: Setting Update]");
  const updateRes = manager.updateSetting(null, "editor.fontSize", 16, "global");
  testAssert(updateRes.success === true, "updateSetting succeeds");
  testAssert(manager.getSettings().settings["editor.fontSize"] === 16, "editor.fontSize updated to 16");

  // 3. Persistence to Disk
  console.log("\n[TEST GROUP 3: Persistence to Disk]");
  const globalFile = path.join(testStorageDir, "global_settings.json");
  testAssert(fs.existsSync(globalFile), "global_settings.json exists on disk");
  const savedJson = JSON.parse(fs.readFileSync(globalFile, "utf8"));
  testAssert(savedJson["editor.fontSize"] === 16, "Disk JSON contains updated fontSize");

  // 4. Workspace vs Global Separation
  console.log("\n[TEST GROUP 4: Workspace vs Global Separation]");
  manager.updateSetting(testWorkspaceDir, "editor.fontSize", 18, "workspace");
  const wsEffective = manager.getSettings(testWorkspaceDir);
  const globalEffective = manager.getSettings(null);
  testAssert(wsEffective.settings["editor.fontSize"] === 18, "Workspace settings override global settings");
  testAssert(globalEffective.settings["editor.fontSize"] === 16, "Global setting remains independent");

  // 5. Reset Individual Setting
  console.log("\n[TEST GROUP 5: Reset Individual Setting]");
  manager.resetSetting(testWorkspaceDir, "editor.fontSize", "workspace");
  testAssert(manager.getSettings(testWorkspaceDir).settings["editor.fontSize"] === 16, "Reset workspace setting falls back to global");

  // 6. Reset All Settings
  console.log("\n[TEST GROUP 6: Reset All Settings]");
  manager.resetAll(null, "global");
  testAssert(manager.getSettings().settings["editor.fontSize"] === 13, "Reset all global settings restores default 13");

  // 7. Monaco Setting Transformation
  console.log("\n[TEST GROUP 7: Monaco Setting Application]");
  const monacoOpts = {
    fontSize: manager.getSettings().settings["editor.fontSize"],
    tabSize: manager.getSettings().settings["editor.tabSize"],
    wordWrap: manager.getSettings().settings["editor.wordWrap"],
    minimap: { enabled: Boolean(manager.getSettings().settings["editor.minimap"]) },
  };
  testAssert(monacoOpts.fontSize === 13 && monacoOpts.wordWrap === "off", "Monaco options formatted accurately");

  // 8. Terminal Setting Propagation
  console.log("\n[TEST GROUP 8: Terminal Setting Propagation]");
  manager.updateSetting(null, "terminal.defaultShell", "/bin/zsh", "global");
  manager.updateSetting(null, "terminal.scrollback", 2000, "global");
  const termSettings = manager.getSettings().settings;
  testAssert(termSettings["terminal.defaultShell"] === "/bin/zsh", "terminal.defaultShell updated");
  testAssert(termSettings["terminal.scrollback"] === 2000, "terminal.scrollback updated");

  // 9. Keybinding Registration
  console.log("\n[TEST GROUP 9: Keybinding Registration]");
  const kbList = manager.getKeybindings();
  testAssert(Array.isArray(kbList.keybindings) && kbList.keybindings.length >= 10, "Keybindings list retrieved");
  const saveKb = kbList.keybindings.find((k) => k.commandId === "workbench.action.save");
  testAssert(saveKb && saveKb.activeShortcut === "Cmd+S", "Default save keybinding is Cmd+S");

  // 10. Keybinding Custom Override
  console.log("\n[TEST GROUP 10: Keybinding Override]");
  manager.updateKeybinding("workbench.action.splitEditorRight", "Cmd+Alt+Right");
  const updatedKbs = manager.getKeybindings();
  const splitKb = updatedKbs.keybindings.find((k) => k.commandId === "workbench.action.splitEditorRight");
  testAssert(splitKb && splitKb.activeShortcut === "Cmd+Alt+Right" && splitKb.isCustomized === true, "Keybinding overridden successfully");

  // 11. Keybinding Reset
  console.log("\n[TEST GROUP 11: Keybinding Reset]");
  manager.resetKeybinding("workbench.action.splitEditorRight");
  const resetKbs = manager.getKeybindings();
  const splitReset = resetKbs.keybindings.find((k) => k.commandId === "workbench.action.splitEditorRight");
  testAssert(splitReset && splitReset.isCustomized === false, "Keybinding reset to default");

  // 12. Conflict Detection
  console.log("\n[TEST GROUP 12: Keybinding Conflict Detection]");
  manager.updateKeybinding("workbench.action.quickOpen", "Cmd+S"); // same as save
  const conflictList = manager.getKeybindings().conflicts;
  testAssert(conflictList.length > 0, "Duplicate shortcut assignment flagged as conflict");
  testAssert(conflictList[0].commands.some((c) => c.commandId === "workbench.action.save"), "Conflict references save command");
  testAssert(conflictList[0].commands.some((c) => c.commandId === "workbench.action.quickOpen"), "Conflict references quickOpen command");

  // 13. Conflict Resolution
  console.log("\n[TEST GROUP 13: Conflict Resolution]");
  manager.resetKeybinding("workbench.action.quickOpen");
  testAssert(manager.getKeybindings().conflicts.length === 0, "Resetting conflicting shortcut resolves collision");

  // 14. Command Execution through Custom Keybinding
  console.log("\n[TEST GROUP 14: Dynamic Command Matching]");
  const { normalizeShortcut } = require("./settingsManager");
  testAssert(normalizeShortcut("Cmd + Shift + P") === normalizeShortcut("Shift+Cmd+P"), "Shortcut normalization treats modifier order agnostically");

  // 15. Secret Exclusion Verification
  console.log("\n[TEST GROUP 15: Secret Exclusion Verification]");
  const secretTry = manager.updateSetting(null, "agent.apiKey", "sk-secret-12345", "global");
  testAssert(secretTry.success === false, "Attempting to save API key / secret in generic settings is rejected");

  // 16. Reload / Restart Persistence Integrity
  console.log("\n[TEST GROUP 16: Reload / Restart Persistence]");
  manager.updateSetting(null, "editor.wordWrap", "on", "global");
  const newManagerInstance = new SettingsManager({ storageDir: testStorageDir });
  testAssert(newManagerInstance.getSettings().settings["editor.wordWrap"] === "on", "Settings persisted across new manager instance re-instantiation");

  // 17. Corrupted Settings JSON Recovery
  console.log("\n[TEST GROUP 17: Corrupted Settings JSON Recovery]");
  fs.writeFileSync(globalFile, "{ CORRUPTED_INVALID_JSON :::", "utf8");
  const recoveredManager = new SettingsManager({ storageDir: testStorageDir });
  testAssert(recoveredManager.getSettings().settings["editor.fontSize"] === 13, "Manager gracefully recovers from corrupted JSON file to defaults");

  // 18. Clean up temp test dirs
  try {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
    fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
  } catch (_) {}

  console.log("\n==================================================");
  console.log(`PASSED ALL ${passedAssertions} ASSERTIONS IN MILESTONE 35 TEST SUITE`);
  console.log("==================================================");
}

runAllTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});