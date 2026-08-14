const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STATE_FILE_NAME = 'workspace-state.json';

function getStateFilePath() {
  try {
    if (app && typeof app.getPath === 'function') {
      const userDataPath = app.getPath('userData');
      if (userDataPath) return path.join(userDataPath, STATE_FILE_NAME);
    }
  } catch (err) {}
  return path.join(process.cwd(), '.echo-nullity-recovery', STATE_FILE_NAME);
}

function sanitizeState(state) {
  if (!state || typeof state !== 'object') return null;
  return {
    folderPath: typeof state.folderPath === 'string' ? state.folderPath : '',
    openTabs: Array.isArray(state.openTabs)
      ? state.openTabs
          .filter((t) => t && typeof t.path === 'string')
          .map((t) => ({
            path: String(t.path),
            name: typeof t.name === 'string' ? t.name : String(t.path).split('/').pop() || 'file',
          }))
      : [],
    activeTabPath: typeof state.activeTabPath === 'string' ? state.activeTabPath : '',
    mainView: typeof state.mainView === 'string' ? state.mainView : 'editor',
    explorerWidth: typeof state.explorerWidth === 'number' && !isNaN(state.explorerWidth) ? state.explorerWidth : 260,
    analysisWidth: typeof state.analysisWidth === 'number' && !isNaN(state.analysisWidth) ? state.analysisWidth : 400,
    consoleHeight: typeof state.consoleHeight === 'number' && !isNaN(state.consoleHeight) ? state.consoleHeight : 220,
    editorStates: (state.editorStates && typeof state.editorStates === 'object') ? state.editorStates : {},
    timestamp: typeof state.timestamp === 'number' ? state.timestamp : Date.now(),
  };
}

function loadState() {
  const filePath = getStateFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData || !rawData.trim()) {
      return null;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(rawData);
    } catch (e) {
      console.warn('[STATE-STORE] Corrupt state file detected, ignoring:', e.message);
      return null;
    }
    return sanitizeState(parsed);
  } catch (err) {
    console.error('[STATE-STORE] Error reading state file:', err);
    return null;
  }
}

function saveState(state) {
  const filePath = getStateFilePath();
  try {
    const cleanState = sanitizeState(state);
    if (!cleanState) return { success: false, error: 'Invalid state structure' };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(cleanState, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error('[STATE-STORE] Error writing state file:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  loadState,
  saveState,
};
