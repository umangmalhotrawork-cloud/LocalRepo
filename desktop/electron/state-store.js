const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STATE_FILE_NAME = 'workspace-state.json';

function getStateFilePath() {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, STATE_FILE_NAME);
  } catch (err) {
    console.error('[STATE-STORE] Failed to get userData path:', err);
    return path.join(__dirname, '..', STATE_FILE_NAME);
  }
}

function loadState() {
  const filePath = getStateFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      console.log('[STATE-STORE] No previous state file found at:', filePath);
      return null;
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    if (!rawData || !rawData.trim()) {
      return null;
    }
    const parsed = JSON.parse(rawData);
    console.log('[STATE-STORE] Successfully loaded state from:', filePath);
    return parsed;
  } catch (err) {
    console.error('[STATE-STORE] Error reading state file:', err);
    return null;
  }
}

function saveState(state) {
  const filePath = getStateFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    console.log('[STATE-STORE] Successfully saved state to:', filePath);
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
