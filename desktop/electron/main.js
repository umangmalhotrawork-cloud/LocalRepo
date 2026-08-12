const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { loadState, saveState } = require('./state-store');
const { exportWorkspaceReport } = require('./report-export');

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

  mainWindow.maximize();

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

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[RENDERER:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[ELECTRON] did-finish-load:', mainWindow.webContents.getURL());
    setTimeout(async () => {
      try {
        if (mainWindow) {
          const image = await mainWindow.capturePage();
          const screenshotDir = path.join(app.getAppPath(), 'desktop', 'screenshots');
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          const screenshotPath = path.join(screenshotDir, 'phase3-editor-completion.png');
          fs.writeFileSync(screenshotPath, image.toPNG());
          console.log('[ELECTRON] Saved verification screenshot to:', screenshotPath);

          // Click Project Scan tab and capture workspace report screenshot
          await mainWindow.webContents.executeJavaScript(`
            (() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const projBtn = buttons.find(b => b.textContent.includes('Project Scan'));
              if (projBtn) projBtn.click();
            })();
          `);

          setTimeout(async () => {
            if (mainWindow) {
              const image2 = await mainWindow.capturePage();
              const screenshotPath2 = path.join(screenshotDir, 'milestone4-workspace-scan.png');
              fs.writeFileSync(screenshotPath2, image2.toPNG());
              console.log('[ELECTRON] Saved verification screenshot to:', screenshotPath2);

              // Switch back to Active File and open Safe Remove Surgery Diff Drawer
              await mainWindow.webContents.executeJavaScript(`
                (() => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  const fileBtn = buttons.find(b => b.textContent.includes('Active File'));
                  if (fileBtn) fileBtn.click();
                  setTimeout(() => {
                    const surgeryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Safe Remove Surgery') || b.textContent.includes('Apply Safe Remove Surgery'));
                    if (surgeryBtn) surgeryBtn.click();
                  }, 300);
                })();
              `);

              setTimeout(async () => {
                if (mainWindow) {
                  const image3 = await mainWindow.capturePage();
                  const screenshotPath3 = path.join(screenshotDir, 'milestone5-differential-verification.png');
                  fs.writeFileSync(screenshotPath3, image3.toPNG());
                  console.log('[ELECTRON] Saved verification screenshot to:', screenshotPath3);

                  // Close diff drawer and switch to Workspace Dashboard
                  await mainWindow.webContents.executeJavaScript(`
                    (() => {
                      const buttons = Array.from(document.querySelectorAll('button'));
                      const cancelBtn = buttons.find(b => b.textContent.trim() === 'Cancel');
                      if (cancelBtn) cancelBtn.click();
                      setTimeout(() => {
                        const dashBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dashboard'));
                        if (dashBtn) dashBtn.click();
                      }, 200);
                    })();
                  `);

                  setTimeout(async () => {
                    if (mainWindow) {
                      const image4 = await mainWindow.capturePage();
                      const screenshotPath4 = path.join(screenshotDir, 'milestone6-workspace-dashboard.png');
                      fs.writeFileSync(screenshotPath4, image4.toPNG());
                      console.log('[ELECTRON] Saved verification screenshot to:', screenshotPath4);

                      // Switch to Workspace Graph Panel
                      await mainWindow.webContents.executeJavaScript(`
                        (() => {
                          const buttons = Array.from(document.querySelectorAll('button'));
                          const graphBtn = buttons.find(b => b.textContent.includes('Graph'));
                          if (graphBtn) graphBtn.click();
                        })();
                      `);

                      setTimeout(async () => {
                        if (mainWindow) {
                          const image5 = await mainWindow.capturePage();
                          const screenshotPath5 = path.join(screenshotDir, 'milestone7-workspace-graph.png');
                          fs.writeFileSync(screenshotPath5, image5.toPNG());
                          console.log('[ELECTRON] Saved verification screenshot to:', screenshotPath5);

                          // Trigger Export Report
                          await mainWindow.webContents.executeJavaScript(`
                            (() => {
                              const buttons = Array.from(document.querySelectorAll('button'));
                              const exportBtn = buttons.find(b => b.textContent.includes('Export Report'));
                              if (exportBtn) exportBtn.click();
                            })();
                          `);

                          setTimeout(async () => {
                            if (mainWindow) {
                              const image6 = await mainWindow.capturePage();
                              const screenshotPath6 = path.join(screenshotDir, 'milestone9-report-export.png');
                              fs.writeFileSync(screenshotPath6, image6.toPNG());
                              console.log('[ELECTRON] Saved export screenshot to:', screenshotPath6);

                              // Open exported HTML report in a browser window to capture rendered report screenshot
                              const possibleDirs = [
                                path.join(app.getAppPath(), 'demo-workspaces', 'ai_cart_project', 'exports'),
                                path.join(app.getAppPath(), 'exports'),
                                path.join(app.getPath('downloads')),
                              ];

                              for (const exportBaseDir of possibleDirs) {
                                try {
                                  if (fs.existsSync(exportBaseDir)) {
                                    const entries = fs.readdirSync(exportBaseDir).filter(f => f.startsWith('EchoNullity-Report-'));
                                    if (entries.length > 0) {
                                      entries.sort();
                                      const latestExport = entries[entries.length - 1];
                                      const htmlFilePath = path.join(exportBaseDir, latestExport, 'report.html');
                                      if (fs.existsSync(htmlFilePath)) {
                                        const reportWin = new BrowserWindow({
                                          width: 1200,
                                          height: 900,
                                          show: false,
                                          webPreferences: { nodeIntegration: false, contextIsolation: true },
                                        });
                                        await reportWin.loadFile(htmlFilePath);
                                        setTimeout(async () => {
                                          const reportImg = await reportWin.capturePage();
                                          const reportScreenshotPath = path.join(screenshotDir, 'milestone9-rendered-html-report.png');
                                          fs.writeFileSync(reportScreenshotPath, reportImg.toPNG());
                                          console.log('[ELECTRON] Saved rendered report screenshot to:', reportScreenshotPath);
                                          reportWin.close();
                                        }, 800);
                                        break;
                                      }
                                    }
                                  }
                                } catch (e) {
                                  console.error('[ELECTRON] Error searching for exported html report:', e);
                                }
                              }

                              // Milestone 10: Switch to Editor and open Surgery Diff Preview
                              setTimeout(async () => {
                                if (mainWindow) {
                                  await mainWindow.webContents.executeJavaScript(`
                                    (() => {
                                      const buttons = Array.from(document.querySelectorAll('button'));
                                      const graphBtn = buttons.find(b => b.textContent.includes('Graph'));
                                      if (graphBtn) graphBtn.click();
                                      setTimeout(() => {
                                        const surgeryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Safe Remove Surgery'));
                                        if (surgeryBtn) surgeryBtn.click();
                                      }, 600);
                                    })();
                                  `);

                                  setTimeout(async () => {
                                    if (mainWindow) {
                                      const diffModalImg = await mainWindow.capturePage();
                                      const diffScreenshotPath = path.join(screenshotDir, 'milestone10-surgery-diff-preview.png');
                                      fs.writeFileSync(diffScreenshotPath, diffModalImg.toPNG());
                                      console.log('[ELECTRON] Saved surgery diff preview screenshot to:', diffScreenshotPath);

                                      // Deselect line 12 (hunk 4) and click Apply Surgery
                                      await mainWindow.webContents.executeJavaScript(`
                                        (() => {
                                          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                                          if (checkboxes.length >= 4) {
                                            checkboxes[3].click(); // uncheck line 12
                                          }
                                          setTimeout(() => {
                                            const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply Surgery'));
                                            if (applyBtn) applyBtn.click();
                                          }, 400);
                                        })();
                                      `);

                                      setTimeout(async () => {
                                        if (mainWindow) {
                                          const afterApplyImg = await mainWindow.capturePage();
                                          const afterApplyPath = path.join(screenshotDir, 'milestone10-after-apply.png');
                                          fs.writeFileSync(afterApplyPath, afterApplyImg.toPNG());
                                          console.log('[ELECTRON] Saved after-apply screenshot to:', afterApplyPath);

                                          // Click Undo Surgery
                                          await mainWindow.webContents.executeJavaScript(`
                                            (() => {
                                              const undoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Undo Surgery'));
                                              if (undoBtn) undoBtn.click();
                                            })();
                                          `);

                                          setTimeout(async () => {
                                            if (mainWindow) {
                                              const afterUndoImg = await mainWindow.capturePage();
                                              const afterUndoPath = path.join(screenshotDir, 'milestone10-after-undo.png');
                                              fs.writeFileSync(afterUndoPath, afterUndoImg.toPNG());
                                              console.log('[ELECTRON] Saved after-undo screenshot to:', afterUndoPath);
                                            }
                                          }, 1500);
                                        }
                                      }, 1500);
                                    }
                                  }, 1500);
                                }
                              }, 1500);
                            }
                          }, 1200);
                        }
                      }, 1000);
                    }
                  }, 1000);
                }
              }, 1200);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('[ELECTRON] Error capturing screenshot:', err);
      }
    }, 2500);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[ELECTRON] did-fail-load (${errorCode}): ${errorDescription}`);
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
ipcMain.handle('engine:get-default-demo-workspace', async () => {
  const demoPath = path.join(app.getAppPath(), 'demo-workspaces', 'ai_cart_project');
  if (fs.existsSync(demoPath)) {
    const tree = buildFileTree(demoPath);
    return { folderPath: demoPath, tree };
  }
  return null;
});

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

ipcMain.handle('fs:write-file', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:file-exists', async (_, filePath) => {
  try {
    const exists = fs.existsSync(filePath);
    return { success: true, exists };
  } catch (e) {
    return { success: false, exists: false, error: e.message };
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

ipcMain.handle('engine:preview-safe-remove', async (_, filePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'analyze.py');
    execFile('python3', [scriptPath, filePath, '--mode', 'rewrite'], (error, stdout, stderr) => {
      if (error) {
        console.error('Python rewrite error:', stderr || error.message);
        resolve({
          error: stderr || error.message,
          transformed_source: '',
          changed_lines: [],
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        resolve({
          error: 'Failed to parse rewrite JSON output',
          transformed_source: '',
          changed_lines: [],
        });
      }
    });
  });
});

ipcMain.handle('engine:apply-safe-remove', async (_, filePath, transformedContent) => {
  try {
    let backupPath = `${filePath}.bak`;
    if (fs.existsSync(backupPath)) backupPath = `${filePath}.${Date.now()}.bak`;

    if (fs.existsSync(filePath)) {
      const originalContent = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(backupPath, originalContent, 'utf-8');
    }

    fs.writeFileSync(filePath, transformedContent, 'utf-8');
    return { success: true, backupPath, transformedContent };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('engine:restore-backup', async (_, filePath) => {
  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const files = fs.readdirSync(dir);
    const bakFiles = files
      .filter(f => f.startsWith(base) && f.endsWith('.bak'))
      .sort((a, b) => b.localeCompare(a));

    if (bakFiles.length === 0) {
      return { success: false, error: `No backup file found for ${base}` };
    }

    const backupFile = path.join(dir, bakFiles[0]);
    const restoredContent = fs.readFileSync(backupFile, 'utf-8');
    fs.writeFileSync(filePath, restoredContent, 'utf-8');
    
    return { success: true, restoredContent, backupPath: backupFile };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('engine:scan-workspace', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'scan_workspace.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Python workspace scan error:', stderr || error.message);
        resolve({
          error: stderr || error.message,
          workspace: workspacePath,
          files_scanned: 0,
          total_ghost_lines: 0,
          total_lines: 0,
          ghost_ratio: 0,
          files: [],
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse scan_workspace JSON output:', parseError);
        resolve({
          error: 'Failed to parse workspace scan JSON output',
          workspace: workspacePath,
          files_scanned: 0,
          total_ghost_lines: 0,
          total_lines: 0,
          ghost_ratio: 0,
          files: [],
        });
      }
    });
  });
});

ipcMain.handle('engine:verify-equivalence', async (_, filePath, transformedContent) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'verify_equivalence.py');
    const child = execFile('python3', [scriptPath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python verify equivalence error:', stderr || error.message);
        resolve({
          verified: false,
          status: 'VERIFICATION_PROCESS_ERROR',
          error: stderr || error.message,
          original: null,
          transformed: null,
          delta_ms: 0,
          outputs_match: false,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse verify_equivalence JSON output:', parseError, stdout);
        resolve({
          verified: false,
          status: 'VERIFICATION_PARSE_ERROR',
          error: 'Failed to parse verification JSON output',
          original: null,
          transformed: null,
          delta_ms: 0,
          outputs_match: false,
        });
      }
    });

    if (child.stdin) {
      child.stdin.write(transformedContent || '');
      child.stdin.end();
    }
  });
});

ipcMain.handle('engine:build-workspace-graph', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'build_workspace_graph.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python build_workspace_graph error:', stderr || error.message);
        resolve({
          workspace: workspacePath,
          nodes: [],
          edges: [],
          error: stderr || error.message,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse build_workspace_graph JSON output:', parseError, stdout);
        resolve({
          workspace: workspacePath,
          nodes: [],
          edges: [],
          error: 'Failed to parse workspace graph JSON output',
        });
      }
    });
  });
});

ipcMain.handle('state:load', async () => {
  return loadState();
});

ipcMain.handle('state:save', async (_, state) => {
  return saveState(state);
});

ipcMain.handle('report:export', async (_, payload) => {
  return exportWorkspaceReport(payload, mainWindow);
});

ipcMain.handle('surgery:preview', async (_, payload) => {
  const { file, approved_lines = [] } = payload;
  const absPath = path.isAbsolute(file) ? file : path.join(app.getAppPath(), file);
  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const approvedSet = new Set(approved_lines);
    const transformed = lines.filter((_, idx) => !approvedSet.has(idx + 1)).join('\n');
    return {
      success: true,
      file: absPath,
      original_source: content,
      transformed_source: transformed,
      approved_lines,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('surgery:apply', async (_, payload) => {
  return new Promise((resolve) => {
    const { file, approved_lines = [] } = payload;
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'apply_surgery.py');
    const args = [scriptPath, file, '--lines', ...approved_lines.map(String)];
    execFile('python3', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python apply_surgery error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse apply_surgery JSON output' });
      }
    });
  });
});

ipcMain.handle('surgery:undo', async (_, payload) => {
  return new Promise((resolve) => {
    const { file } = payload;
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'undo_surgery.py');
    execFile('python3', [scriptPath, file], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python undo_surgery error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse undo_surgery JSON output' });
      }
    });
  });
});
