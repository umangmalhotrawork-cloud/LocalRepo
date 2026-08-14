import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, spawn as execSpawn } from 'child_process';
import * as http from 'http';

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

function waitForServer(targetUrl: string, maxRetries = 40, intervalMs = 500): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let isFinished = false;
    let activeTimer: NodeJS.Timeout | null = null;
    let activeRequest: http.ClientRequest | null = null;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${targetUrl}`));
    }

    function cleanup() {
      isFinished = true;
      if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
      }
      if (activeRequest) {
        try {
          activeRequest.destroy();
        } catch (e) {}
        activeRequest = null;
      }
    }

    function check() {
      if (isFinished) return;
      attempts++;

      activeRequest = http.get(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 3000,
          path: parsedUrl.pathname,
          timeout: 1000,
        },
        (res) => {
          if (isFinished) return;
          if (res.statusCode && res.statusCode < 500) {
            cleanup();
            console.log(`[ELECTRON] Dev server is ready at ${targetUrl} (statusCode=${res.statusCode}, attempt=${attempts})`);
            resolve(true);
          } else if (attempts < maxRetries) {
            activeTimer = setTimeout(check, intervalMs);
          } else {
            cleanup();
            reject(new Error(`Server returned status ${res.statusCode} after ${attempts} attempts`));
          }
        }
      );

      activeRequest.on('error', (err) => {
        if (isFinished) return;
        if (attempts < maxRetries) {
          activeTimer = setTimeout(check, intervalMs);
        } else {
          cleanup();
          reject(new Error(`Failed to connect: ${err.message}`));
        }
      });

      activeRequest.on('timeout', () => {
        if (isFinished) return;
        if (activeRequest) activeRequest.destroy();
        if (attempts < maxRetries) {
          activeTimer = setTimeout(check, intervalMs);
        } else {
          cleanup();
          reject(new Error(`Connection timed out`));
        }
      });
    }

    check();
  });
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

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || Boolean(process.env.ELECTRON_START_URL));
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/desktop';

  if (isDev) {
    waitForServer(startUrl, 40, 500)
      .then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(startUrl).catch((err) => {
            console.error('[ELECTRON] Failed to load URL:', err.message);
          });
        }
      })
      .catch((err) => {
        console.error('[ELECTRON] Dev server unavailable:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      });
  } else {
    const prodPath = path.join(__dirname, '..', '..', 'out', 'desktop.html');
    const fallbackProdPath = path.join(__dirname, '..', '..', 'out', 'index.html');
    const finalPath = fs.existsSync(prodPath) ? prodPath : fallbackProdPath;
    if (fs.existsSync(finalPath)) {
      mainWindow.loadFile(finalPath);
    }
  }

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
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'analyze.py');
    execFile('python3', [scriptPath, filePath, '--mode', 'analyze'], (error, stdout, stderr) => {
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

ipcMain.handle('python:run-file', async (event, filePath: string) => {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: 'No active file provided' };
  }
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File does not exist: ${filePath}` };
  }
  if (!filePath.endsWith('.py')) {
    return { success: false, error: 'Active file is not a Python (.py) file' };
  }

  return new Promise((resolve) => {
    const cwd = path.dirname(filePath);

    function startProcess(bin: string): any {
      let child: any;
      try {
        child = execSpawn(bin, ['-u', filePath], {
          cwd,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
      } catch (err) {
        return null;
      }

      if (!child || !child.pid) return null;

      child.on('error', (err: any) => {
        if (bin === 'python3') {
          const fallback = startProcess('python');
          if (fallback) return;
        }
        event.sender.send('python:output', {
          filePath,
          data: `\n[ERROR] Process spawn failure: ${err.message}\n`,
          isError: true,
        });
        resolve({ success: false, error: `Process spawn failure: ${err.message}` });
      });

      if (child.stdout) {
        child.stdout.on('data', (chunk: any) => {
          console.log('[PYTHON][STDOUT]', chunk.toString());
          event.sender.send('python:output', {
            filePath,
            data: chunk.toString(),
            type: 'stdout',
          });
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk: any) => {
          console.log('[PYTHON][STDERR]', chunk.toString());
          event.sender.send('python:output', {
            filePath,
            data: chunk.toString(),
            type: 'stderr',
          });
        });
      }

      child.on('close', (code: number | null) => {
        const exitCode = code !== null ? code : 1;
        event.sender.send('python:output', {
          filePath,
          exitCode,
          type: 'exit',
        });
        resolve({ success: exitCode === 0, exitCode });
      });

      return child;
    }

    const spawned = startProcess('python3') || startProcess('python');
    if (!spawned) {
      event.sender.send('python:output', {
        filePath,
        data: `\n[ERROR] Python executable not found.\n`,
        isError: true,
      });
      resolve({ success: false, error: 'Python executable not found' });
    }
  });
});
