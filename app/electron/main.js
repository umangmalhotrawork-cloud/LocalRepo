const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let mainWindow = null;

function buildFileTree(dirPath) {
  const name = path.basename(dirPath);
  let isDirectory = false;
  try {
    const stat = fs.statSync(dirPath);
    isDirectory = stat.isDirectory();
  } catch (e) {
    return null;
  }

  if (!isDirectory) {
    return { name, path: dirPath, isDirectory: false };
  }

  let children = [];
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__' || item === '.next') {
        continue;
      }
      const fullPath = path.join(dirPath, item);
      const childTree = buildFileTree(fullPath);
      if (childTree) {
        children.push(childTree);
      }
    }
  } catch (e) {
    console.error('Error reading dir:', e);
  }

  children.sort((a, b) => {
    if (a.isDirectory === b.isDirectory) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory ? -1 : 1;
  });

  return { name, path: dirPath, isDirectory: true, children };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Echo Nullity — Desktop IDE',
    backgroundColor: '#050505',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000/desktop';

  const loadWithRetry = (url, attempts = 0) => {
    if (!mainWindow) return;
    console.log(`[ELECTRON] Attempting to load URL (${attempts + 1}):`, url);
    mainWindow.loadURL(url).catch((err) => {
      console.log(`[ELECTRON] Dev server not ready yet (${err.message}). Retrying in 1s...`);
      if (attempts < 30) {
        setTimeout(() => loadWithRetry(url, attempts + 1), 1000);
      } else {
        console.error('[ELECTRON] Failed to load renderer URL after max retries:', url);
      }
    });
  };

  loadWithRetry(startUrl);

  // Open DevTools automatically for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[ELECTRON] WebContents did-fail-load (${errorCode}): ${errorDescription}`);
    setTimeout(() => loadWithRetry(startUrl), 1000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('dialog:open-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const tree = buildFileTree(folderPath);
  return { folderPath, tree };
});

ipcMain.handle('fs:read-file', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:read-dir', async (_, dirPath) => {
  try {
    const tree = buildFileTree(dirPath);
    return { success: true, tree };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('engine:analyze', async (_, filePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'app', 'engine', 'analyze.py');
    execFile('python3', [scriptPath, filePath], (error, stdout, stderr) => {
      if (error) {
        console.error('Python analyze error:', stderr || error.message);
        resolve({
          error: stderr || error.message,
          findings: [],
          causal_luminance: 1.0,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        resolve({
          error: 'Failed to parse analyzer JSON output',
          findings: [],
          causal_luminance: 1.0,
        });
      }
    });
  });
});

ipcMain.handle('engine:safe-remove', async (_, filePath, lines) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentLines = content.split('\n');
    const linesToKeep = lines.map(l => l - 1);
    const newLines = contentLines.filter((_, idx) => !linesToKeep.includes(idx));
    
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    return { success: true, newContent: newLines.join('\n') };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
