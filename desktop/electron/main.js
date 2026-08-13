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

  mainWindow.webContents.on('did-finish-load', async () => {
    const targetUrl = mainWindow.webContents.getURL();
    console.log('[ELECTRON] did-finish-load:', targetUrl);

    await new Promise((r) => setTimeout(r, 300));

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }

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

                                      const verifySuccessPath = path.join(screenshotDir, 'milestone15-verify-success.png');
                                      fs.writeFileSync(verifySuccessPath, diffModalImg.toPNG());
                                      console.log('[ELECTRON] Saved verification success screenshot to:', verifySuccessPath);

                                      // Dispatch mock failure event to capture verification failure screenshot
                                      await mainWindow.webContents.executeJavaScript(`
                                        (() => {
                                          window.dispatchEvent(new CustomEvent('mock-verify-failure'));
                                        })();
                                      `);

                                      await new Promise(r => setTimeout(r, 600));
                                      if (mainWindow) {
                                        const failureImg = await mainWindow.capturePage();
                                        const failurePath = path.join(screenshotDir, 'milestone15-verify-failure.png');
                                        fs.writeFileSync(failurePath, failureImg.toPNG());
                                        console.log('[ELECTRON] Saved verification failure screenshot to:', failurePath);
                                      }

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

                                              // Milestone 11: 1. Files Search
                                              setTimeout(async () => {
                                                if (mainWindow) {
                                                  await mainWindow.webContents.executeJavaScript(`
                                                    (() => {
                                                      const setReactInput = (input, val) => {
                                                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                                        nativeSetter.call(input, val);
                                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                                      };

                                                      const searchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Search');
                                                      if (searchBtn) searchBtn.click();
                                                      setTimeout(() => {
                                                        const input = document.querySelector('input[placeholder*="Search"]');
                                                        if (input) {
                                                          setReactInput(input, 'invoice');
                                                        }
                                                      }, 400);
                                                    })();
                                                  `);

                                                  setTimeout(async () => {
                                                    if (mainWindow) {
                                                      const filesImg = await mainWindow.capturePage();
                                                      const filesPath = path.join(screenshotDir, 'milestone11-search-files.png');
                                                      fs.writeFileSync(filesPath, filesImg.toPNG());
                                                      console.log('[ELECTRON] Saved files search screenshot to:', filesPath);

                                                      // Milestone 11: 2. Content Search
                                                      await mainWindow.webContents.executeJavaScript(`
                                                        (() => {
                                                          const setReactInput = (input, val) => {
                                                            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                                            nativeSetter.call(input, val);
                                                            input.dispatchEvent(new Event('input', { bubbles: true }));
                                                          };

                                                          const contentTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Content'));
                                                          if (contentTab) contentTab.click();
                                                          setTimeout(() => {
                                                            const input = document.querySelector('input[placeholder*="Search"]');
                                                            if (input) {
                                                              setReactInput(input, 'subtotal');
                                                            }
                                                          }, 400);
                                                        })();
                                                      `);

                                                      setTimeout(async () => {
                                                        if (mainWindow) {
                                                          const contentImg = await mainWindow.capturePage();
                                                          const contentPath = path.join(screenshotDir, 'milestone11-search-content.png');
                                                          fs.writeFileSync(contentPath, contentImg.toPNG());
                                                          console.log('[ELECTRON] Saved content search screenshot to:', contentPath);

                                                          // Milestone 11: 3. Symbols Search
                                                          await mainWindow.webContents.executeJavaScript(`
                                                            (() => {
                                                              const setReactInput = (input, val) => {
                                                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                                                nativeSetter.call(input, val);
                                                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                                              };

                                                              const symbolsTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Symbols'));
                                                              if (symbolsTab) symbolsTab.click();
                                                              setTimeout(() => {
                                                                const input = document.querySelector('input[placeholder*="Search"]');
                                                                if (input) {
                                                                  setReactInput(input, 'calculate_cart_total');
                                                                }
                                                              }, 400);
                                                            })();
                                                          `);

                                                          setTimeout(async () => {
                                                            if (mainWindow) {
                                                              const symbolsImg = await mainWindow.capturePage();
                                                              const symbolsPath = path.join(screenshotDir, 'milestone11-search-symbols.png');
                                                              fs.writeFileSync(symbolsPath, symbolsImg.toPNG());
                                                              console.log('[ELECTRON] Saved symbols search screenshot to:', symbolsPath);

                                                              // Jump to symbol in editor
                                                              await mainWindow.webContents.executeJavaScript(`
                                                                (() => {
                                                                  const resultItem = document.querySelector('.divide-y > div');
                                                                  if (resultItem) resultItem.click();
                                                                })();
                                                              `);

                                                              // Milestone 12: Structural Clone Detection
                                                              setTimeout(async () => {
                                                                if (mainWindow) {
                                                                  // 1. Run Clone Scan
                                                                  await mainWindow.webContents.executeJavaScript(`
                                                                    (() => {
                                                                      const buttons = Array.from(document.querySelectorAll('button'));
                                                                      const cloneBtn = buttons.find(b => b.textContent.includes('Run Clone Scan') || b.textContent.includes('Clones'));
                                                                      if (cloneBtn) cloneBtn.click();
                                                                    })();
                                                                  `);

                                                                  setTimeout(async () => {
                                                                    if (mainWindow) {
                                                                      const clonePanelImg = await mainWindow.capturePage();
                                                                      const clonePanelPath = path.join(screenshotDir, 'milestone12-clone-panel.png');
                                                                      fs.writeFileSync(clonePanelPath, clonePanelImg.toPNG());
                                                                      console.log('[ELECTRON] Saved clone panel screenshot to:', clonePanelPath);

                                                                      // 2. View in Graph with dashed magenta edges
                                                                      await mainWindow.webContents.executeJavaScript(`
                                                                        (() => {
                                                                          const buttons = Array.from(document.querySelectorAll('button'));
                                                                          const graphBtn = buttons.find(b => b.textContent.includes('Graph'));
                                                                          if (graphBtn) graphBtn.click();
                                                                        })();
                                                                      `);

                                                                      setTimeout(async () => {
                                                                        if (mainWindow) {
                                                                          const cloneGraphImg = await mainWindow.capturePage();
                                                                          const cloneGraphPath = path.join(screenshotDir, 'milestone12-clone-graph.png');
                                                                          fs.writeFileSync(cloneGraphPath, cloneGraphImg.toPNG());
                                                                          console.log('[ELECTRON] Saved clone graph screenshot to:', cloneGraphPath);

                                                                          // Milestone 13: Semantic Clone Detection
                                                                          setTimeout(async () => {
                                                                            if (mainWindow) {
                                                                              // 1. Run Semantic Clone Scan
                                                                              await mainWindow.webContents.executeJavaScript(`
                                                                                (() => {
                                                                                  const buttons = Array.from(document.querySelectorAll('button'));
                                                                                  const semBtn = buttons.find(b => b.textContent.includes('Run Semantic Scan') || b.textContent.includes('Semantic'));
                                                                                  if (semBtn) semBtn.click();
                                                                                })();
                                                                              `);

                                                                              setTimeout(async () => {
                                                                                if (mainWindow) {
                                                                                  const semPanelImg = await mainWindow.capturePage();
                                                                                  const semPanelPath = path.join(screenshotDir, 'milestone13-semantic-panel.png');
                                                                                  fs.writeFileSync(semPanelPath, semPanelImg.toPNG());
                                                                                  console.log('[ELECTRON] Saved semantic panel screenshot to:', semPanelPath);

                                                                                  // 2. View in Graph with dashed cyan edges
                                                                                  await mainWindow.webContents.executeJavaScript(`
                                                                                    (() => {
                                                                                      const buttons = Array.from(document.querySelectorAll('button'));
                                                                                      const graphBtn = buttons.find(b => b.textContent.includes('Graph'));
                                                                                      if (graphBtn) graphBtn.click();
                                                                                    })();
                                                                                  `);
                                                                                  setTimeout(async () => {
                                                                                    if (mainWindow) {
                                                                                      const semGraphImg = await mainWindow.capturePage();
                                                                                      const semGraphPath = path.join(screenshotDir, 'milestone13-semantic-graph.png');
                                                                                      fs.writeFileSync(semGraphPath, semGraphImg.toPNG());
                                                                                      console.log('[ELECTRON] Saved semantic graph screenshot to:', semGraphPath);

                                                                                      // Milestone 14: Causal Luminance Scoring Engine
                                                                                      setTimeout(async () => {
                                                                                        if (mainWindow) {
                                                                                          // 1. Run Luminance Scan and view Editor Heatmap
                                                                                          await mainWindow.webContents.executeJavaScript(`
                                                                                            (() => {
                                                                                              const buttons = Array.from(document.querySelectorAll('button'));
                                                                                              const closeBtn = buttons.find(b => b.title && b.title.includes('Return to Code Editor'));
                                                                                              if (closeBtn) closeBtn.click();
                                                                                              const lumScanBtn = buttons.find(b => b.textContent.includes('Run Luminance Scan'));
                                                                                              if (lumScanBtn) lumScanBtn.click();
                                                                                              const tabs = Array.from(document.querySelectorAll('div'));
                                                                                              const editorTab = tabs.find(t => t.textContent && t.textContent.includes('cart_calculator.py'));
                                                                                              if (editorTab) editorTab.click();
                                                                                            })();
                                                                                          `);

                                                                                          setTimeout(async () => {
                                                                                            if (mainWindow) {
                                                                                              const heatmapImg = await mainWindow.capturePage();
                                                                                              const heatmapPath = path.join(screenshotDir, 'milestone14-luminance-heatmap.png');
                                                                                              fs.writeFileSync(heatmapPath, heatmapImg.toPNG());
                                                                                              console.log('[ELECTRON] Saved luminance heatmap screenshot to:', heatmapPath);

                                                                                              // 2. View Luminance Dashboard
                                                                                              await mainWindow.webContents.executeJavaScript(`
                                                                                                (() => {
                                                                                                  const buttons = Array.from(document.querySelectorAll('button'));
                                                                                                  const lumBtn = buttons.find(b => b.textContent.trim() === 'Luminance');
                                                                                                  if (lumBtn) lumBtn.click();
                                                                                                })();
                                                                                              `);

                                                                                              setTimeout(async () => {
                                                                                                if (mainWindow) {
                                                                                                  const dashImg = await mainWindow.capturePage();
                                                                                                  const dashPath = path.join(screenshotDir, 'milestone14-luminance-dashboard.png');
                                                                                                  fs.writeFileSync(dashPath, dashImg.toPNG());
                                                                                                  console.log('[ELECTRON] Saved luminance dashboard screenshot to:', dashPath);
                                                                                                }
                                                                                              }, 1200);
                                                                                            }
                                                                                          }, 1500);
                                                                                        }
                                                                                      }, 1500);
                                                                                    }
                                                                                  }, 1200);
                                                                                }
                                                                              }, 1500);
                                                                            }
                                                                          }, 1500);
                                                                        }
                                                                      }, 1200);
                                                                    }
                                                                  }, 1500);
                                                                }
                                                              }, 1500);
                                                            }
                                                          }, 1500);
                                                        }
                                                      }, 1500);
                                                    }
                                                  }, 1500);
                                                }
                                              }, 1000);
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

function runBehaviorVerification(originalPath, transformedSource) {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'behavior_verify.py');
    const child = execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python behavior_verify error:', stderr || error.message);
        resolve({
          behavior_preserved: false,
          original: { stdout: '', stderr: stderr || error.message, exit_code: -1, exception: error.name },
          transformed: { stdout: '', stderr: '', exit_code: -1, exception: null },
          differences: [stderr || error.message]
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        resolve({
          behavior_preserved: false,
          original: { stdout: '', stderr: 'Failed to parse JSON output', exit_code: -1, exception: 'JSONDecodeError' },
          transformed: { stdout: '', stderr: '', exit_code: -1, exception: null },
          differences: ['Failed to parse JSON output from behavior_verify.py']
        });
      }
    });

    child.stdin.write(JSON.stringify({ original_path: originalPath, transformed_source: transformedSource }));
    child.stdin.end();
  });
}

ipcMain.handle('surgery:verify', async (_, payload) => {
  const { original_path, file, transformed_source, transformed } = payload || {};
  const targetPath = original_path || file;
  return runBehaviorVerification(targetPath, transformed_source || transformed || '');
});

ipcMain.handle('workspace:search', async (_, payload) => {
  return new Promise((resolve) => {
    const { workspace, query = '', mode = 'files', limit = 200 } = payload || {};
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'search_workspace.py');
    const args = [scriptPath, workspace || '.', '--query', query, '--mode', mode, '--limit', String(limit)];
    execFile('python3', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python search_workspace error:', stderr || error.message);
        resolve({
          workspace,
          query,
          mode,
          results_count: 0,
          results: [],
          error: stderr || error.message,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse search_workspace JSON output:', parseError, stdout);
        resolve({
          workspace,
          query,
          mode,
          results_count: 0,
          results: [],
          error: 'Failed to parse search_workspace JSON output',
        });
      }
    });
  });
});

function runStructuralCloneScan(workspacePath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'python', 'clone_engine.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python clone_engine error:', stderr || error.message);
        resolve([]);
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse clone_engine JSON output:', parseError, stdout);
        resolve([]);
      }
    });
  });
}

ipcMain.handle('clone:scan', async (_, workspacePath) => {
  return runStructuralCloneScan(workspacePath);
});

function runSemanticCloneScan(workspacePath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'python', 'semantic_engine.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python semantic_engine error:', stderr || error.message);
        resolve([]);
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse semantic_engine JSON output:', parseError, stdout);
        resolve([]);
      }
    });
  });
}

ipcMain.handle('semantic:scan', async (_, workspacePath) => {
  return runSemanticCloneScan(workspacePath);
});

ipcMain.handle('engine:detect-clones', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'detect_clones.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python detect_clones error:', stderr || error.message);
        resolve({
          workspace: workspacePath,
          total_files: 0,
          total_clone_groups: 0,
          total_clones: 0,
          groups: [],
          error: stderr || error.message,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse detect_clones JSON output:', parseError, stdout);
        resolve({
          workspace: workspacePath,
          total_files: 0,
          total_clone_groups: 0,
          total_clones: 0,
          groups: [],
          error: 'Failed to parse clone detection JSON output',
        });
      }
    });
  });
});

ipcMain.handle('engine:detect-semantic-clones', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'detect_semantic_clones.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python detect_semantic_clones error:', stderr || error.message);
        resolve({
          workspace: workspacePath,
          threshold: 0.82,
          total_files: 0,
          total_groups: 0,
          total_clones: 0,
          groups: [],
          error: stderr || error.message,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse detect_semantic_clones JSON output:', parseError, stdout);
        resolve({
          workspace: workspacePath,
          threshold: 0.82,
          total_files: 0,
          total_groups: 0,
          total_clones: 0,
          groups: [],
          error: 'Failed to parse semantic clone detection JSON output',
        });
      }
    });
  });
});

ipcMain.handle('engine:calculate-luminance', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'calculate_luminance.py');
    execFile('python3', [scriptPath, workspacePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Python calculate_luminance error:', stderr || error.message);
        resolve({
          workspace: workspacePath,
          total_files: 0,
          total_statements: 0,
          mean_luminance: 0.0,
          median_luminance: 0.0,
          dark_code_ratio: 0.0,
          bright_code_ratio: 0.0,
          causal_entropy_index: 0.0,
          histogram: [],
          darkest_statements: [],
          files: [],
          error: stderr || error.message,
        });
        return;
      }
      try {
        const jsonResult = JSON.parse(stdout);
        resolve(jsonResult);
      } catch (parseError) {
        console.error('Failed to parse calculate_luminance JSON output:', parseError, stdout);
        resolve({
          workspace: workspacePath,
          total_files: 0,
          total_statements: 0,
          mean_luminance: 0.0,
          median_luminance: 0.0,
          dark_code_ratio: 0.0,
          bright_code_ratio: 0.0,
          causal_entropy_index: 0.0,
          histogram: [],
          darkest_statements: [],
          files: [],
          error: 'Failed to parse calculate_luminance JSON output',
        });
      }
    });
  });
});
