import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

let mainWindow: BrowserWindow | null = null;

function buildFileTree(dirPath: string): any {
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

  let children: any[] = [];
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
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

  // Sort directories first, then files
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

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/desktop';
  mainWindow.loadURL(startUrl);

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

ipcMain.handle('fs:read-file', async (_, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:read-dir', async (_, dirPath: string) => {
  try {
    const tree = buildFileTree(dirPath);
    return { success: true, tree };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('engine:analyze', async (_, filePath: string) => {
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

ipcMain.handle('engine:safe-remove', async (_, filePath: string, lines: number[]) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentLines = content.split('\n');
    
    // Filter out target line numbers (1-indexed)
    const linesToKeep = lines.map(l => l - 1);
    const newLines = contentLines.filter((_, idx) => !linesToKeep.includes(idx));
    
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    return { success: true, newContent: newLines.join('\n') };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});
