const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile, spawn: execSpawn } = require('child_process');
const { loadState, saveState } = require('./state-store');
const { exportWorkspaceReport } = require('./report-export');
const ptyManager = require('./ptyManager');
const gitManager = require('./gitManager');
const searchManager = require('./searchManager');
const aiManager = require('./aiManager');
const agentManager = require('./agentManager');
const { recoveryStore } = require('./recoveryStore');
const testManager = require('./testManager');
const { profilerManager } = require('./profilerManager');
const { securityAuditManager } = require('./securityAuditManager');
const { snapshotManager } = require('./snapshotManager');
const { logger } = require('./logger');
const { crashReporter } = require('./crashReporter');
const { healthChecker } = require('./healthCheck');

process.on('uncaughtException', (err) => {
  logger.error('MAIN', `Uncaught exception: ${err.message}`, { stack: err.stack });
  crashReporter.recordCrash(err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('MAIN', `Unhandled rejection: ${reason}`);
});

recoveryStore.startHeartbeat();

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

function waitForServer(targetUrl, maxRetries = 40, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let isFinished = false;
    let activeTimer = null;
    let activeRequest = null;

    let parsedUrl;
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
          if (attempts % 5 === 0) {
            console.log(`[ELECTRON] Waiting for dev server at ${targetUrl} (attempt ${attempts}/${maxRetries}): ${err.message}`);
          }
          activeTimer = setTimeout(check, intervalMs);
        } else {
          cleanup();
          reject(new Error(`Failed to connect to dev server at ${targetUrl} after ${attempts} attempts: ${err.message}`));
        }
      });

      activeRequest.on('timeout', () => {
        if (isFinished) return;
        if (activeRequest) activeRequest.destroy();
        if (attempts < maxRetries) {
          activeTimer = setTimeout(check, intervalMs);
        } else {
          cleanup();
          reject(new Error(`Connection to ${targetUrl} timed out after ${attempts} attempts`));
        }
      });
    }

    check();
  });
}

function createWindow() {
  let loadedSuccessfully = false;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Echo Nullity — Desktop IDE',
    backgroundColor: '#050505',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || Boolean(process.env.ELECTRON_START_URL));
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/desktop';

  // Prevent unwanted secondary popups or navigation loops
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url !== startUrl && !url.startsWith('http://localhost:3000')) {
      event.preventDefault();
    }
  });

  if (isDev) {
    console.log(`[ELECTRON] Dev mode active. Waiting for Next.js dev server at ${startUrl}...`);
    waitForServer(startUrl, 40, 500)
      .then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log(`[ELECTRON] Dev server ready. Loading URL: ${startUrl}`);
          mainWindow.loadURL(startUrl).catch((err) => {
            console.error('[ELECTRON] Failed to load dev URL:', err.message);
          });
        }
      })
      .catch((err) => {
        console.error('[ELECTRON] Fatal: Next.js dev server unavailable:', err.message);
        console.error('[ELECTRON] Please start Next.js dev server first using `npm run electron:dev` or `npm run dev`.');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      });
  } else {
    const prodPath = path.join(__dirname, '..', '..', 'out', 'desktop.html');
    const fallbackProdPath = path.join(__dirname, '..', '..', 'out', 'index.html');
    const finalPath = fs.existsSync(prodPath) ? prodPath : fallbackProdPath;

    if (fs.existsSync(finalPath)) {
      console.log(`[ELECTRON] Loading production build asset: ${finalPath}`);
      mainWindow.loadFile(finalPath).catch((err) => {
        console.error('[ELECTRON] Failed to load production file:', err.message);
      });
    } else {
      console.error('[ELECTRON] Production build file not found at:', finalPath);
    }
  }

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[RENDERER:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    loadedSuccessfully = true;
    const targetUrl = mainWindow.webContents.getURL();
    console.log('[ELECTRON] did-finish-load:', targetUrl);
    console.log('[ELECTRON] URL:', mainWindow.webContents.getURL());
    console.log('[ELECTRON] main frame load successful');

    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }

    if (process.env.ELECTRON_AUTO_SCREENSHOT === 'true') {
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

                                              // Milestone 16: Surgery History & Time Travel Screenshots
                                              await mainWindow.webContents.executeJavaScript(`
                                                (() => {
                                                  window.dispatchEvent(new CustomEvent('mock-history-drawer'));
                                                })();
                                              `);
                                              await new Promise(r => setTimeout(r, 600));
                                              if (mainWindow) {
                                                const histImg = await mainWindow.capturePage();
                                                const histPath = path.join(screenshotDir, 'milestone16-history-drawer.png');
                                                fs.writeFileSync(histPath, histImg.toPNG());
                                                console.log('[ELECTRON] Saved history drawer screenshot to:', histPath);
                                              }

                                              await mainWindow.webContents.executeJavaScript(`
                                                (() => {
                                                  window.dispatchEvent(new CustomEvent('mock-restore-confirm'));
                                                })();
                                              `);
                                              await new Promise(r => setTimeout(r, 600));
                                              if (mainWindow) {
                                                const confirmImg = await mainWindow.capturePage();
                                                const confirmPath = path.join(screenshotDir, 'milestone16-restore-confirmation.png');
                                                fs.writeFileSync(confirmPath, confirmImg.toPNG());
                                                console.log('[ELECTRON] Saved restore confirmation screenshot to:', confirmPath);
                                              }

                                              await mainWindow.webContents.executeJavaScript(`
                                                (() => {
                                                  window.dispatchEvent(new CustomEvent('mock-execute-restore'));
                                                })();
                                              `);
                                              await new Promise(r => setTimeout(r, 600));
                                              if (mainWindow) {
                                                const afterRestoreImg = await mainWindow.capturePage();
                                                const afterRestorePath = path.join(screenshotDir, 'milestone16-after-restore.png');
                                                fs.writeFileSync(afterRestorePath, afterRestoreImg.toPNG());
                                                console.log('[ELECTRON] Saved after restore screenshot to:', afterRestorePath);
                                              }

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
  }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error(`[ELECTRON] did-fail-load (${errorCode}): ${errorDescription}`);
    if (isMainFrame && !loadedSuccessfully && errorCode !== -3) {
      setTimeout(() => loadWithRetry(startUrl), 1000);
    }
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
    const isJS = Boolean(filePath && filePath.match(/\.(js|jsx|ts|tsx)$/i));
    const command = isJS ? 'node' : 'python3';
    const scriptPath = isJS
      ? path.join(app.getAppPath(), 'desktop', 'engine', 'js_analyzer.js')
      : path.join(app.getAppPath(), 'desktop', 'engine', 'analyze.py');

    execFile(command, [scriptPath, filePath, '--mode', 'analyze'], (error, stdout, stderr) => {
      if (error) {
        console.error('Analyze error:', stderr || error.message);
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
    const isJS = Boolean(filePath && filePath.match(/\.(js|jsx|ts|tsx)$/i));
    const command = isJS ? 'node' : 'python3';
    const scriptPath = isJS
      ? path.join(app.getAppPath(), 'desktop', 'engine', 'js_analyzer.js')
      : path.join(app.getAppPath(), 'desktop', 'engine', 'analyze.py');

    execFile(command, [scriptPath, filePath, '--mode', 'rewrite'], (error, stdout, stderr) => {
      if (error) {
        console.error('Rewrite error:', stderr || error.message);
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

ipcMain.handle('report:export-pldi', async (_, workspacePath) => {
  return new Promise((resolve) => {
    const ws = workspacePath || path.join(app.getAppPath(), 'demo-workspaces', 'ai_cart_project');
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'pldi_report.py');
    execFile('python3', [scriptPath, ws], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) return resolve({ success: false, error: stderr || error.message });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse PLDI report export output' });
      }
    });
  });
});

ipcMain.handle('behavior:fingerprint', async (_, filePath) => {
  return new Promise((resolve) => {
    const isJS = filePath.match(/\.(js|jsx|ts|tsx)$/i);
    const scriptPath = isJS
      ? path.join(app.getAppPath(), 'desktop', 'engine', 'js_behavior_fingerprint.js')
      : path.join(app.getAppPath(), 'desktop', 'engine', 'behavior_fingerprint.py');
    const runner = isJS ? 'node' : 'python3';

    execFile(runner, [scriptPath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) return resolve({ error: stderr || error.message, functions: [] });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: 'Failed to parse behavioral fingerprint JSON output', functions: [] });
      }
    });
  });
});

ipcMain.handle('behavior:compare-fingerprints', async (_, payload) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'behavior_compare.js');
    const child = execFile('node', [scriptPath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) return resolve({ compatible: false, error: stderr || error.message, summary: {} });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ compatible: false, error: 'Failed to parse fingerprint comparison JSON output', summary: {} });
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
});

ipcMain.handle('behavior:history', async (_, payload) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'git_behavior_history.js');
    const child = execFile('node', [scriptPath, '--json'], { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) return resolve({ error: stderr || error.message, timeline: [] });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: 'Failed to parse Git behavioral history JSON output', timeline: [] });
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
});

ipcMain.handle('behavior:impact-radius', async (_, payload) => {
  return new Promise((resolve) => {
    try {
      const { computeBehavioralImpactRadius } = require('../engine/behavioral_impact_radius');
      const result = computeBehavioralImpactRadius(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, summary: { global_severity: 'NO_CHANGE' }, impacted_nodes: [] });
    }
  });
});

ipcMain.handle('behavior:propagation-timeline', async (_, payload) => {
  return new Promise((resolve) => {
    try {
      const { calculatePropagationTimeline } = require('../engine/temporal_impact_propagation');
      const result = calculatePropagationTimeline(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, timeline: [], summary: {} });
    }
  });
});

ipcMain.handle('behavior:blast-radius', async (_, payload) => {
  return new Promise(async (resolve) => {
    try {
      const { calculateBehavioralBlastRadius } = require('../engine/behavioral_blast_radius');
      const result = await calculateBehavioralBlastRadius(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, root_changed_functions: [], impacted_functions: [], blast_radius_score: 0.0, summary: {} });
    }
  });
});

ipcMain.handle('behavior:counterfactual', async (_, payload) => {
  return new Promise(async (resolve) => {
    try {
      const { computeCounterfactualAnalysis } = require('../engine/counterfactual_engine');
      const result = await computeCounterfactualAnalysis(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, equivalence_score: 0.0, safe_to_remove: false, changed_observations: 0, confidence: 0.0, trace_diff: [] });
    }
  });
});

ipcMain.handle('behavior:patch-firewall', async (_, payload) => {
  return new Promise(async (resolve) => {
    try {
      const { evaluateAIPatchFirewall } = require('../engine/ai_patch_firewall');
      const result = await evaluateAIPatchFirewall(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, files: [], risk_score: 100, risk_level: 'HIGH_RISK', safe_to_auto_apply: false, summary: { changed_hunks: 0, safe_removals: 0, behavior_changes: 0, impacted_functions: 0 } });
    }
  });
});

ipcMain.handle('behavior:repository-firewall', async (_, payload) => {
  return new Promise(async (resolve) => {
    try {
      const { evaluateRepositoryPatchFirewall } = require('../engine/repository_patch_firewall');
      const result = await evaluateRepositoryPatchFirewall(payload);
      resolve(result);
    } catch (e) {
      resolve({
        schema_version: 1,
        error: e.message,
        repository_path: payload.repository_path || process.cwd(),
        files_analyzed: 0,
        hunks_analyzed: 0,
        risky_hunks: 0,
        safe_hunks: 0,
        affected_files: [],
        top_risky_hunks: [],
        max_blast_radius_score: 0,
        risk_score: 100,
        risk_level: 'HIGH_RISK',
        merge_recommendation: 'BLOCK',
        safe_to_auto_apply: false,
      });
    }
  });
});

ipcMain.handle('behavior:semantic-intent-drift', async (_, payload) => {
  return new Promise((resolve) => {
    try {
      const { analyzeSemanticIntentDrift } = require('../engine/semantic_intent_drift');
      const result = analyzeSemanticIntentDrift(payload);
      resolve(result);
    } catch (e) {
      resolve({ schema_version: 1, error: e.message, drift_score: 0.0, drift_level: 'NONE', intent_changes: [], confidence: 0.0 });
    }
  });
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

function runAppendHistory(entry) {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'surgery_history.py');
    const child = execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve({ success: false, error: 'Failed to append history' });
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch (e) { resolve({ success: false, error: 'JSON parse error' }); }
    });
    child.stdin.write(JSON.stringify({ cmd: 'append', entry }));
    child.stdin.end();
  });
}

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
        if (jsonResult && jsonResult.success) {
          console.log('[ELECTRON] Logging surgery apply event to history...');
          runAppendHistory({
            file_path: file,
            operation_type: 'APPLY_SURGERY',
            removed_lines: approved_lines,
            before_source: jsonResult.original_source || '',
            after_source: jsonResult.transformed_source || '',
            behavior_preserved: true,
            luminance_before: 0.65,
            luminance_after: 1.00,
          });
        }
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
        if (jsonResult && jsonResult.success) {
          console.log('[ELECTRON] Logging surgery undo event to history...');
          runAppendHistory({
            file_path: file,
            operation_type: 'UNDO_SURGERY',
            removed_lines: [],
            before_source: jsonResult.before_source || '',
            after_source: jsonResult.after_source || jsonResult.restored_source || '',
            behavior_preserved: true,
            luminance_before: 1.00,
            luminance_after: 0.65,
          });
        }
        resolve(jsonResult);
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse undo_surgery JSON output' });
      }
    });
  });
});

ipcMain.handle('history:list', async () => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'surgery_history.py');
    const child = execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve({ success: false, entries: [] });
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch (e) { resolve({ success: false, entries: [] }); }
    });
    child.stdin.write(JSON.stringify({ cmd: 'list' }));
    child.stdin.end();
  });
});

ipcMain.handle('history:get', async (_, id) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'surgery_history.py');
    const child = execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve({ success: false, error: 'Failed to fetch entry' });
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch (e) { resolve({ success: false, error: 'JSON parse error' }); }
    });
    child.stdin.write(JSON.stringify({ cmd: 'get', id }));
    child.stdin.end();
  });
});

ipcMain.handle('history:append', async (_, entry) => {
  return runAppendHistory(entry);
});

ipcMain.handle('history:restore', async (_, id) => {
  return new Promise((resolve) => {
    console.log(`[ELECTRON] Restoring surgery checkpoint: ${id}`);
    const scriptPath = path.join(app.getAppPath(), 'desktop', 'engine', 'surgery_history.py');
    const child = execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve({ success: false, error: 'Failed to restore checkpoint' });
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch (e) { resolve({ success: false, error: 'JSON parse error' }); }
    });
    child.stdin.write(JSON.stringify({ cmd: 'restore', id }));
    child.stdin.end();
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

// PTY Integrated Terminal IPC Handlers
ipcMain.handle('terminal:create', async (event, options) => {
  return ptyManager.createTerminal(options, event.sender);
});

ipcMain.handle('terminal:write', async (_, { id, data }) => {
  ptyManager.write(id, data);
});

ipcMain.handle('terminal:resize', async (_, { id, cols, rows }) => {
  ptyManager.resize(id, cols, rows);
});

ipcMain.handle('terminal:kill', async (_, id) => {
  ptyManager.kill(id);
});

ipcMain.handle('terminal:restart', async (event, id) => {
  return ptyManager.restart(id, event.sender);
});

ipcMain.handle('terminal:list', async () => {
  return ptyManager.list();
});

// Python Direct File Execution IPC Handler
console.log('[PYTHON] IPC handler registered');
ipcMain.handle('python:run-file', async (event, filePath) => {
  console.log('[PYTHON] IPC run-file invoked for:', filePath);
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

    function startProcess(bin) {
      console.log(`[PYTHON] Spawning process ${bin} -u for file:`, filePath);
      let child;
      try {
        child = execSpawn(bin, ['-u', filePath], {
          cwd,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
      } catch (err) {
        console.error(`[PYTHON] Exception spawning ${bin}:`, err);
        return null;
      }

      if (!child || !child.pid) return null;

      child.on('error', (err) => {
        console.error(`[PYTHON] Process error on ${bin}:`, err);
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
        child.stdout.on('data', (chunk) => {
          console.log('[PYTHON][STDOUT]', chunk.toString());
          event.sender.send('python:output', {
            filePath,
            data: chunk.toString(),
            type: 'stdout',
          });
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          console.log('[PYTHON][STDERR]', chunk.toString());
          event.sender.send('python:output', {
            filePath,
            data: chunk.toString(),
            type: 'stderr',
          });
        });
      }

      child.on('close', (code) => {
        const exitCode = code !== null ? code : 1;
        console.log(`[PYTHON] Process closed with exit code:`, exitCode);
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
      console.error('[PYTHON] Failed to spawn python3 or python');
      event.sender.send('python:output', {
        filePath,
        data: `\n[ERROR] Python executable not found. Verify python3 or python is installed and available on PATH.\n`,
        isError: true,
      });
      resolve({ success: false, error: 'Python executable not found' });
    }
  });
});

// Git Source Control IPC Handlers
ipcMain.handle('git:status', async (_, workspacePath) => {
  return gitManager.getStatus(workspacePath);
});

ipcMain.handle('git:diff', async (_, { workspacePath, file, staged }) => {
  return gitManager.getDiff(workspacePath, file, staged);
});

ipcMain.handle('git:stage', async (_, { workspacePath, file }) => {
  return gitManager.stage(workspacePath, file);
});

ipcMain.handle('git:unstage', async (_, { workspacePath, file }) => {
  return gitManager.unstage(workspacePath, file);
});

ipcMain.handle('git:stageAll', async (_, workspacePath) => {
  return gitManager.stageAll(workspacePath);
});

ipcMain.handle('git:unstageAll', async (_, workspacePath) => {
  return gitManager.unstageAll(workspacePath);
});

ipcMain.handle('git:commit', async (_, { workspacePath, message }) => {
  return gitManager.commit(workspacePath, message);
});

ipcMain.handle('git:branches', async (_, workspacePath) => {
  return gitManager.getBranches(workspacePath);
});

ipcMain.handle('git:checkout', async (_, { workspacePath, branch }) => {
  return gitManager.checkout(workspacePath, branch);
});

ipcMain.handle('git:createBranch', async (_, { workspacePath, branch }) => {
  return gitManager.createBranch(workspacePath, branch);
});

ipcMain.handle('git:discard', async (_, { workspacePath, file }) => {
  return gitManager.discard(workspacePath, file);
});

// Workspace Search & Replace IPC Handlers
ipcMain.handle('search:run', async (_, payload) => {
  return searchManager.runSearch(payload);
});

ipcMain.handle('search:replace', async (_, payload) => {
  return searchManager.replaceSingle(payload);
});

ipcMain.handle('search:replaceAll', async (_, payload) => {
  return searchManager.replaceAll(payload);
});

ipcMain.handle('search:cancel', async (_, id) => {
  return searchManager.cancelSearch(id);
});

// AI Code Actions IPC Handler
ipcMain.handle('ai:code-action', async (_, payload) => {
  return aiManager.runCodeAction(payload);
});

// AI Agent Mode IPC Handler
ipcMain.handle('agent:run', async (_, payload) => {
  return agentManager.runAgentTask(payload);
});

// Crash Recovery & Session Restore IPC Handlers
ipcMain.handle('recovery:save', async (_, payload) => {
  return recoveryStore.saveSnapshot(payload.workspacePath, payload.snapshot);
});

ipcMain.handle('recovery:load', async (_, workspacePath) => {
  return recoveryStore.loadSnapshot(workspacePath);
});

ipcMain.handle('recovery:clear', async (_, workspacePath) => {
  return recoveryStore.clearSnapshot(workspacePath);
});

ipcMain.handle('recovery:list', async () => {
  return recoveryStore.listSnapshots();
});

ipcMain.handle('recovery:check-crash', async () => {
  return recoveryStore.checkCrashState();
});

// Test Explorer & Coverage IPC Handlers
ipcMain.handle('test:discover', async (_, workspacePath) => {
  return testManager.discoverTests(workspacePath);
});

ipcMain.handle('test:run', async (_, payload) => {
  return testManager.runTest(payload);
});

ipcMain.handle('test:run-file', async (_, payload) => {
  return testManager.runFile(payload);
});

ipcMain.handle('test:run-all', async (_, payload) => {
  return testManager.runAll(payload);
});

ipcMain.handle('test:coverage', async (_, payload) => {
  return testManager.getCoverage(payload);
});

// Performance Profiler IPC Handlers
ipcMain.handle('profiler:python', async (_, payload) => {
  return profilerManager.profilePythonCPU(payload.code, payload.filePath);
});

ipcMain.handle('profiler:javascript', async (_, payload) => {
  return profilerManager.profileJavaScript(payload.code, payload.filePath);
});

ipcMain.handle('profiler:memory', async (_, payload) => {
  return profilerManager.profilePythonMemory(payload.code, payload.filePath);
});

ipcMain.handle('profiler:react', async (_, payload) => {
  return profilerManager.recordReactMetric(payload.component, payload.renderDurationMs, payload.isWasted);
});

ipcMain.handle('profiler:export', async (_, payload) => {
  return profilerManager.exportReport(payload);
});

// Security & Dependency Audit IPC Handlers
ipcMain.handle('security:scan', async (_, workspacePath) => {
  return securityAuditManager.scanWorkspace(workspacePath);
});

ipcMain.handle('security:export', async (_, payload) => {
  return securityAuditManager.exportReport(payload.report, payload.format);
});

// Workspace Snapshots & Checkpoints IPC Handlers
ipcMain.handle('snapshot:create', async (_, payload) => {
  return snapshotManager.createSnapshot(payload);
});

ipcMain.handle('snapshot:list', async (_, workspacePath) => {
  return snapshotManager.listSnapshots(workspacePath);
});

ipcMain.handle('snapshot:get', async (_, payload) => {
  return snapshotManager.getSnapshot(payload.workspacePath, payload.snapshotId);
});

ipcMain.handle('snapshot:compare', async (_, payload) => {
  return snapshotManager.compareSnapshots(payload);
});

ipcMain.handle('snapshot:restore-file', async (_, payload) => {
  return snapshotManager.restoreFile(payload);
});

ipcMain.handle('snapshot:restore-workspace', async (_, payload) => {
  return snapshotManager.restoreWorkspace(payload);
});

ipcMain.handle('snapshot:delete', async (_, payload) => {
  return snapshotManager.deleteSnapshot(payload.workspacePath, payload.snapshotId);
});

// Production Hardening, Diagnostics & Health Check IPC Handlers
ipcMain.handle('health:check', async () => {
  return healthChecker.runStartupHealthCheck();
});

ipcMain.handle('crash:report', async (_, payload) => {
  return crashReporter.recordCrash(payload.error, payload.context);
});

ipcMain.handle('crash:list', async () => {
  return crashReporter.listCrashes();
});

ipcMain.handle('logger:log', async (_, payload) => {
  logger.write(payload.level || 'info', payload.category || 'RENDERER', payload.message, payload.meta);
  return { success: true };
});

ipcMain.handle('logger:recent', async (_, limit) => {
  return logger.getRecentLogs(limit || 100);
});

// Local-only Telemetry Storage
const telemetryState = {
  enabled: true,
  anonymousCounts: {
    appLaunches: 1,
    crashes: 0,
    recoveryRestores: 0,
    snapshotRestores: 0,
  },
};

ipcMain.handle('telemetry:get', async () => {
  return telemetryState;
});

ipcMain.handle('telemetry:set', async (_, enabled) => {
  telemetryState.enabled = Boolean(enabled);
  return telemetryState;
});

ipcMain.handle('telemetry:track', async (_, eventName) => {
  if (telemetryState.enabled && telemetryState.anonymousCounts[eventName] !== undefined) {
    telemetryState.anonymousCounts[eventName] += 1;
  }
  return telemetryState;
});

app.on('will-quit', () => {
  logger.info('MAIN', 'Application shutting down cleanly');
  recoveryStore.updateHeartbeat(true);
  ptyManager.cleanupAll();
});
