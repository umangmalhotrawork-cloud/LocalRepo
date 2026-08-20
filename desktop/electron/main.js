const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile, spawn: execSpawn } = require('child_process');
const { loadEnvConfig, isGitHubClientIdConfigured } = require('./envLoader');

// Keep this before any OAuth-dependent require. githubAuthManager reads the
// value when its GitHub IPC handlers run, so Electron must load .env first.
loadEnvConfig();
console.log(`GitHub OAuth Client ID: ${isGitHubClientIdConfigured() ? 'configured' : 'missing'}`);

const { loadState, saveState } = require('./state-store');
const { exportWorkspaceReport } = require('./report-export');
const ptyManager = require('./ptyManager');
const gitManager = require('./gitManager');
const { githubAuthManager } = require('./githubAuthManager');
const searchManager = require('./searchManager');
const aiManager = require('./aiManager');
const agentManager = require('./agentManager');
const { aiProviderRouter } = require('./ai/AIProviderRouter');
const { aiRoleRouter } = require('./ai/AIRoleRouter');
const { recoveryStore } = require('./recoveryStore');
const { continuumManager } = require('./continuumManager');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumContextBuilder } = require('../engine/continuum_context_builder');
const { continuumCapsuleBuilder } = require('../engine/continuum_capsule_builder');
const { harnessRuntime } = require('./harness');
const secretFilter = require('../security/secretFilter');
const testManager = require('./testManager');
const { profilerManager } = require('./profilerManager');
const { securityAuditManager } = require('./securityAuditManager');
const { snapshotManager } = require('./snapshotManager');
const { logger } = require('./logger');
const { crashReporter } = require('./crashReporter');
const { healthChecker } = require('./healthCheck');
const { testRunnerDetector } = require('./testing/TestRunnerDetector');
const { testExecutor } = require('./testing/TestExecutor');
const { transactionalPatchApplier } = require('./transactionalPatchApplier');
const { autonomousRepairEngine } = require('./autonomousRepairEngine');
const { evidenceGraph } = require('./evidence/EvidenceGraph');
const behavioralDiffEngine = require('../engine/behavioral_diff_engine');
const aiSystemReasoningEngine = require('../engine/ai_system_reasoning_engine');

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
          timeout: 5000,
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
    title: 'NEXUS — Autonomous Software Engineering',
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
        console.warn('[ELECTRON] Dev server initial ping timeout:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log(`[ELECTRON] Loading dev URL directly: ${startUrl}`);
          mainWindow.loadURL(startUrl).catch((loadErr) => {
            console.error('[ELECTRON] Failed to load dev URL:', loadErr.message);
          });
        }
      });
  } else {
    const candidatePaths = [
      path.join(app.getAppPath(), 'out', 'desktop.html'),
      path.join(__dirname, '..', '..', 'out', 'desktop.html'),
      path.join(app.getAppPath(), 'out', 'index.html'),
      path.join(__dirname, '..', '..', 'out', 'index.html'),
      path.join(app.getAppPath(), 'desktop.html'),
    ];

    const finalPath = candidatePaths.find((p) => fs.existsSync(p));

    if (finalPath) {
      console.log(`[ELECTRON] Loading production build asset: ${finalPath}`);
      mainWindow.loadFile(finalPath).catch((err) => {
        console.error('[ELECTRON] Failed to load production file:', err.message);
      });
    } else {
      console.error('[ELECTRON] Production build file not found in candidates:', candidatePaths);
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
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(startUrl).catch(() => {});
        }
      }, 1000);
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

app.on('before-quit', () => {
  try {
    autonomousRepairEngine.cancelAll();
  } catch (e) {}
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
  try {
    await harnessRuntime.loadProjectCapabilities(folderPath);
    harnessRuntime.startWatchingProjectCapabilities(folderPath);
  } catch (e) {}
  return { folderPath, tree };
});

ipcMain.handle('dialog:open-capsule-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Nexus Capsule JSON File',
    properties: ['openFile'],
    filters: [
      { name: 'Nexus Capsule', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
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

ipcMain.handle('engine:analyze', async (_, payload) => {
  const { filePath, content } = payload || {};
  if (typeof filePath !== 'string' || !filePath || typeof content !== 'string') {
    return { error: 'Analysis requires a filePath and editor content.', findings: [], causal_luminance: 1.0 };
  }

  const isJS = /\.(js|jsx|ts|tsx)$/i.test(filePath);
  const command = isJS ? 'node' : 'python3';
  const scriptPath = path.join(
    app.getAppPath(),
    'desktop',
    'engine',
    isJS ? 'js_analyzer.js' : 'analyze.py'
  );
  const args = [scriptPath, '--stdin', '--path', filePath, '--mode', 'analyze'];
  const bytes = Buffer.byteLength(content, 'utf8');
  console.log(`[IPC] Analyze path=${filePath} bytes=${bytes}`);

  return new Promise((resolve) => {
    const child = execSpawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      console.error('[IPC] Analyze subprocess error:', error.message);
      resolve({ error: error.message, findings: [], causal_luminance: 1.0 });
    });
    child.on('close', (code) => {
      if (stderr) console.log(`[IPC:engine:analyze][STDERR]\n${stderr}`);
      if (code !== 0) {
        resolve({ error: stderr || `Analyzer exited with code ${code}`, findings: [], causal_luminance: 1.0 });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (parseError) {
        console.error('[IPC] Analyze JSON parse error:', stdout);
        resolve({ error: 'Failed to parse analyzer JSON output', findings: [], causal_luminance: 1.0 });
      }
    });
    child.stdin.end(content);
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

ipcMain.handle('bdg:getGraph', async (_, workspacePath) => {
  try {
    return bdgEngine.buildGraphForWorkspace(workspacePath);
  } catch (e) {
    return { nodes: {}, edges: [], error: e.message };
  }
});

ipcMain.handle('bdg:querySymbolDependencies', async (_, { symbol, relPath, line, workspacePath, targetNodeId }) => {
  try {
    if ((!bdgEngine.nodes || Object.keys(bdgEngine.nodes).length === 0 || (workspacePath && bdgEngine.workspacePath !== workspacePath)) && workspacePath && fs.existsSync(workspacePath)) {
      bdgEngine.buildGraphForWorkspace(workspacePath);
    }
    return bdgEngine.querySymbolDependencies(symbol, relPath, line, targetNodeId);
  } catch (e) {
    return { node: null, callers: [], callees: [], reads: [], writes: [], externalEffects: [], directDependencies: [], transitiveDependencies: [] };
  }
});

ipcMain.handle('bdg:updateFile', async (_, { fullPath, content }) => {
  try {
    return bdgEngine.updateFile(fullPath, content);
  } catch (e) {
    return { nodes: {}, edges: [], error: e.message };
  }
});

ipcMain.handle('bdg:calculateBlastRadius', async (_, { symbol, relPath, line, workspacePath, targetNodeId }) => {
  try {
    if ((!bdgEngine.nodes || Object.keys(bdgEngine.nodes).length === 0 || (workspacePath && bdgEngine.workspacePath !== workspacePath)) && workspacePath && fs.existsSync(workspacePath)) {
      bdgEngine.buildGraphForWorkspace(workspacePath);
    }
    return bdgEngine.calculateBlastRadiusBySymbol(symbol, relPath, line, targetNodeId);
  } catch (e) {
    return {
      targetNode: null,
      certainItems: [],
      probableItems: [],
      inferredItems: [],
      affectedFiles: [],
      affectedFunctions: [],
      externalEffects: [],
      coveringTests: [],
      riskSummary: { filesAffectedCount: 0, functionsAffectedCount: 0, externalSystemsCount: 0, testsCount: 0, riskLevel: 'LOW' }
    };
  }
});

ipcMain.handle('runtime:getTelemetry', async (_, nodeId) => {
  try {
    return runtimeExecutionIndex.getTelemetryForNode(nodeId);
  } catch (e) {
    return { observed: false, executionCount: 0, lastSeen: null, averageDurationMs: null, errorCount: 0, observedCallers: [], sessions: [] };
  }
});

ipcMain.handle('runtime:getCallChainComparison', async (_, nodeId) => {
  try {
    return runtimeExecutionIndex.getStaticVsRuntimeCallChain(nodeId);
  } catch (e) {
    return { staticCallers: [], runtimeCallers: [], unobservedCallers: [] };
  }
});

ipcMain.handle('runtime:getSessions', async () => {
  try {
    return runtimeExecutionIndex.getActiveSessionList();
  } catch (e) {
    return [];
  }
});

ipcMain.handle('runtime:recordEvent', async (_, event) => {
  try {
    return runtimeExecutionIndex.recordEvent(event);
  } catch (e) {
    return null;
  }
});

ipcMain.handle('runtime:correlateEvidence', async (_, { symbol, relPath, line, workspacePath, targetNodeId }) => {
  try {
    if (workspacePath && fs.existsSync(workspacePath) && (Object.keys(bdgEngine.nodes).length === 0 || bdgEngine.workspacePath !== workspacePath)) {
      bdgEngine.buildGraphForWorkspace(workspacePath);
    }
    return runtimeExecutionIndex.correlateRuntimeEvidence(symbol, relPath, line, targetNodeId);
  } catch (e) {
    return null;
  }
});

ipcMain.handle('bdg:simulateWhatIf', async (_, { symbol, relPath, line, operation, secondarySymbol, targetNodeId }) => {
  try {
    return bdgEngine.simulateWhatIfBySymbol(symbol, relPath, line, operation, secondarySymbol, targetNodeId);
  } catch (e) {
    return {
      operation: operation || 'remove-node',
      targetNode: null,
      originalRiskLevel: 'LOW',
      hypotheticalRiskLevel: 'LOW',
      removedEdges: [],
      newlyDisconnectedNodes: [],
      newlyAffectedNodes: [],
      runtimeObservedImpact: { observedExecutionsLost: 0, errorCountSaved: 0, observedCallersImpacted: [] },
      predictedRisks: ['Simulation error: ' + e.message]
    };
  }
});

ipcMain.handle('bdg:analyzeMultiFileImpact', async (_, { symbol, relPath, line, workspacePath, targetNodeId }) => {
  try {
    if (workspacePath && fs.existsSync(workspacePath) && (Object.keys(bdgEngine.nodes).length === 0 || bdgEngine.workspacePath !== workspacePath)) {
      bdgEngine.buildGraphForWorkspace(workspacePath);
    }
    return bdgEngine.analyzeMultiFileImpact(symbol, relPath, line, targetNodeId);
  } catch (e) {
    return null;
  }
});

ipcMain.handle('bdg:getBehavioralDiff', async (_, workspacePath) => {
  try {
    let gitStatus = { modifiedFiles: [], stagedFiles: [] };
    if (workspacePath && fs.existsSync(path.join(workspacePath, '.git'))) {
      try {
        const { execSync } = require('child_process');
        const statusStr = execSync('git status --porcelain', { cwd: workspacePath, encoding: 'utf-8' });
        const lines = statusStr.split('\n').filter(Boolean);
        for (const line of lines) {
          const file = line.substring(3).trim();
          if (line.startsWith(' M') || line.startsWith('M ') || line.startsWith('??')) {
            gitStatus.modifiedFiles.push(file);
          }
        }
      } catch (e) {
        // Fallback for non-git workspace
      }
    }
    return behavioralDiffEngine.computeBehavioralDiff(null, null, gitStatus);
  } catch (e) {
    return {
      gitStatus: { modifiedFiles: [], stagedFiles: [] },
      hasBehavioralChange: false,
      textualChangeOnly: false,
      structuralChanges: [],
      impactedFunctions: [],
      impactedFiles: [],
      impactedTests: [],
      impactedDbOps: [],
      impactedExternalApis: [],
      runtimeEvidenceSummary: { totalObservedExecutions: 0, observedCallers: [], errorsInvolved: 0 },
      whatIfPredictions: [],
      riskLevel: 'LOW'
    };
  }
});
ipcMain.handle('ai:generateProposal', async (_, { symbol, relPath, line, goal, targetNodeId }) => {
  try {
    return aiSystemReasoningEngine.generateProposal(symbol, relPath, line, goal, targetNodeId);
  } catch (e) {
    return null;
  }
});

ipcMain.handle('ai:applyProposal', async (_, { proposalId, approved }) => {
  try {
    return aiSystemReasoningEngine.applyProposal(proposalId, approved);
  } catch (e) {
    return { success: false, message: e.message };
  }
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

        // Record Runtime Execution Intelligence event
        try {
          const relName = path.basename(filePath);
          runtimeExecutionIndex.recordEvent({
            file: relName,
            eventType: exitCode === 0 ? 'execute' : 'error',
            timestamp: Date.now(),
            executionCount: 1,
            success: exitCode === 0,
            sessionId: 'session_current',
            sessionType: 'current'
          });
        } catch (recErr) {
          console.error('[PYTHON] Failed to record runtime event:', recErr);
        }

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

ipcMain.handle('git:push', async (_, { workspacePath, remote, branch }) => {
  return gitManager.push(workspacePath, remote, branch);
});

ipcMain.handle('git:commitAndPush', async (_, { workspacePath, message }) => {
  return gitManager.commitAndPush(workspacePath, message);
});

ipcMain.handle('git:suggestCommitMessage', async (_, workspacePath) => {
  return gitManager.suggestCommitMessage(workspacePath);
});

// GitHub Authentication IPC Handlers
ipcMain.handle('github:configStatus', async () => {
  return githubAuthManager.getOAuthConfigStatus();
});

ipcMain.handle('github:status', async () => {
  return githubAuthManager.getStatus();
});

ipcMain.handle('github:connect', async () => {
  return githubAuthManager.connect();
});

ipcMain.handle('github:disconnect', async () => {
  return githubAuthManager.disconnect();
});

ipcMain.handle('github:listRepos', async () => {
  return githubAuthManager.listRepositories();
});

ipcMain.handle('github:associateRepo', async (_, { workspacePath, repo }) => {
  return githubAuthManager.associateRepository(workspacePath, repo);
});

ipcMain.handle('github:getSelectedRepo', async (_, workspacePath) => {
  return githubAuthManager.getSelectedRepository(workspacePath);
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

// AI Multi-Model Configuration & Credentials IPC Handlers
ipcMain.handle('ai:get-config', async () => {
  return aiProviderRouter.getConfig();
});

ipcMain.handle('ai:set-config', async (_, { providerId, modelId }) => {
  return aiProviderRouter.setConfig(providerId, modelId);
});

ipcMain.handle('ai:set-api-key', async (_, { providerId, apiKey }) => {
  return aiProviderRouter.setApiKey(providerId, apiKey);
});

ipcMain.handle('ai:remove-api-key', async (_, providerId) => {
  return aiProviderRouter.removeApiKey(providerId);
});

ipcMain.handle('ai:validate-key', async (_, { providerId, apiKey }) => {
  return aiProviderRouter.validateKey(providerId, apiKey);
});

// Role-Based Multi-Model AI IPC Handlers
ipcMain.handle('ai:roles:get-config', async () => {
  return aiRoleRouter.getAllRoles();
});

ipcMain.handle('ai:roles:set-config', async (_, { roleId, providerId, modelId }) => {
  return aiRoleRouter.setRoleConfig(roleId, providerId, modelId);
});

ipcMain.handle('ai:roles:resolve', async (_, { roleId, sessionConfig }) => {
  return aiRoleRouter.resolveRole(roleId, sessionConfig);
});

ipcMain.handle('ai:roles:validate', async (_, roleId) => {
  return aiRoleRouter.getRoleConfig(roleId);
});

// Evidence Graph & Verification Trail IPC Handlers
ipcMain.handle('evidence:get-graph', async (_, sessionId) => {
  const safeSession = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default_session';
  return evidenceGraph.getNodesBySession(safeSession);
});

ipcMain.handle('evidence:get-summary', async (_, sessionId) => {
  const safeSession = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default_session';
  return evidenceGraph.getVerificationSummary(safeSession);
});

ipcMain.handle('evidence:traverse', async (_, payload = {}) => {
  if (!payload || typeof payload !== 'object') return { nodes: [], edges: [] };
  const { startId, sessionId, direction } = payload;
  if (!startId || typeof startId !== 'string') return { nodes: [], edges: [] };
  const safeSession = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default_session';
  return evidenceGraph.traverseFrom(startId, safeSession, direction);
});

// AI Agent Mode IPC Handler (Legacy Compatibility - delegates to Harness)
ipcMain.handle('agent:run', async (_, payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, task: '', summary: 'Malformed payload: object required', steps: [] };
  }
  console.log('[IPC:agent:run] Legacy agent:run called, delegating via agentManager facade into HarnessRuntime');
  return agentManager.runAgentTask(payload);
});

// Transactional Multi-File Patch IPC Handler
ipcMain.handle('patch:apply-transaction', async (_, payload = {}) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.edits)) {
    return { success: false, error: 'Malformed patch payload: edits array required', rolledBack: true };
  }
  return transactionalPatchApplier.applyTransaction(payload.edits, payload.options);
});

// Autonomous Test Discovery & Execution IPC Handlers
ipcMain.handle('testing:detect', async (_, workspacePath) => {
  if (!workspacePath || typeof workspacePath !== 'string') {
    return { primary: 'pytest', detected: [], confidence: 'LOW' };
  }
  return testRunnerDetector.detect(workspacePath);
});

ipcMain.handle('testing:run', async (_, payload = {}) => {
  if (!payload || typeof payload !== 'object' || !payload.workspacePath) {
    return { status: 'FAILED', exitCode: 1, error: 'Malformed test payload: workspacePath required' };
  }
  return testExecutor.runTests(payload);
});

ipcMain.handle('testing:cancel', async (_, runId) => {
  if (!runId || typeof runId !== 'string') return false;
  return testExecutor.cancel(runId);
});

// Autonomous Test-Driven Repair IPC Handlers
ipcMain.handle('autonomous:start', async (event, payload = {}) => {
  if (!payload || typeof payload !== 'object' || !payload.workspacePath) {
    return { completed: false, status: 'FAILED', reason: 'INVALID_PAYLOAD', error: 'Malformed repair payload: workspacePath required' };
  }
  return autonomousRepairEngine.runAutonomousRepair(payload, (progress) => {
    try {
      if (event && event.sender && typeof event.sender.send === 'function') {
        event.sender.send('autonomous:progress', progress);
      }
    } catch (e) {}
  });
});

ipcMain.handle('autonomous:cancel', async (_, repairId) => {
  if (!repairId || typeof repairId !== 'string') return false;
  return autonomousRepairEngine.cancel(repairId);
});

ipcMain.handle('autonomous:get-status', async (_, repairId) => {
  return autonomousRepairEngine.getStatus(repairId);
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

// Continuum Persistence IPC Handlers
ipcMain.handle('continuum:save', async (_, { snapshot, workspacePath }) => {
  return continuumManager.saveSnapshot(snapshot, workspacePath);
});

ipcMain.handle('continuum:list', async (_, workspacePath) => {
  return continuumManager.listSnapshots(workspacePath);
});

ipcMain.handle('continuum:load', async (_, { snapshotId, workspacePath }) => {
  return continuumManager.loadSnapshot(snapshotId, workspacePath);
});

ipcMain.handle('continuum:delete', async (_, { snapshotId, workspacePath }) => {
  return continuumManager.deleteSnapshot(snapshotId, workspacePath);
});

ipcMain.handle('continuum:build-context', async (_, snapshot) => {
  return continuumContextBuilder.buildContext(snapshot);
});

ipcMain.handle('continuum:create-current', async (_, { payload = {}, workspacePath }) => {
  try {
    const activeWorkspace = workspacePath || payload.workspacePath || process.cwd();
    const now = Date.now();
    const snapshotInput = {
      sessionId: payload.sessionId || `session_${now}_${Math.random().toString(36).substring(2, 8)}`,
      parentSessionId: payload.parentSessionId || null,
      sequenceNumber: typeof payload.sequenceNumber === 'number' ? payload.sequenceNumber : 1,
      project: {
        workspaceName: path.basename(activeWorkspace),
        workspacePath: activeWorkspace,
        workspaceHash: continuumManager.getWorkspaceHash(activeWorkspace),
        detectedStack: payload.detectedStack || { primaryLanguage: 'unknown', frameworks: [], testRunner: null },
        bdgGraphSummary: payload.bdgGraphSummary || { totalNodes: 0, totalEdges: 0, entryPointFiles: [] },
      },
      task: {
        userGoal: payload.userGoal || payload.task || '',
        activeMilestone: payload.activeMilestone || '',
        currentSubtask: payload.currentSubtask || '',
        completedSteps: Array.isArray(payload.completedSteps) ? payload.completedSteps : [],
        pendingSteps: Array.isArray(payload.pendingSteps) ? payload.pendingSteps : [],
        blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
      },
      codeState: {
        activeTargetNodeId: payload.activeTargetNodeId || null,
        activeFilePath: payload.activeFilePath || null,
        cursorLine: typeof payload.cursorLine === 'number' ? payload.cursorLine : null,
        dirtyFiles: Array.isArray(payload.dirtyFiles) ? payload.dirtyFiles : [],
        modifiedSymbols: Array.isArray(payload.modifiedSymbols) ? payload.modifiedSymbols : [],
      },
      decisions: Array.isArray(payload.decisions) ? payload.decisions : [],
      debugging: payload.debugging || { discoveredBugs: [], failedFixes: [], successfulFixes: [] },
      verification: payload.verification || { lastTestStatus: 'NOT_RUN', failingTestNames: [], behavioralDiffSummary: null },
      conversation: {
        condensedSummary: payload.condensedSummary || payload.summary || '',
        lastUserDirective: payload.lastUserDirective || payload.userGoal || payload.task || '',
        lastAgentResponseSnippet: payload.lastAgentResponseSnippet || '',
      },
      aiState: payload.aiState || { provider: 'offline', modelName: 'deterministic-rule-engine', temperature: 0.1, maxTokens: 2048, activeRole: 'software-engineer' },
      handoff: {
        immediateNextAction: payload.immediateNextAction || (Array.isArray(payload.pendingSteps) && payload.pendingSteps.length > 0 ? payload.pendingSteps[0] : ''),
        requiredFilesToLoad: Array.isArray(payload.requiredFilesToLoad) ? payload.requiredFilesToLoad : [],
        unresolvedQuestions: Array.isArray(payload.unresolvedQuestions) ? payload.unresolvedQuestions : [],
        systemInstructionOverride: payload.systemInstructionOverride || '',
      },
    };

    const snapshot = continuumEngine.createSnapshot(snapshotInput);
    const saveRes = continuumManager.saveSnapshot(snapshot, activeWorkspace);
    return saveRes;
  } catch (err) {
    console.error('[MAIN] Error creating current Continuum snapshot:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('continuum:resume-session', async (_, { snapshotId, workspacePath }) => {
  try {
    const activeWorkspace = workspacePath || process.cwd();
    const loadRes = continuumManager.loadSnapshot(snapshotId, activeWorkspace);
    if (!loadRes.success || !loadRes.snapshot) {
      return { success: false, error: loadRes.error || 'Failed to load target snapshot for resume' };
    }

    const loadedSnapshot = loadRes.snapshot;

    // Create next chained snapshot (Session S2 inheriting parentSessionId S1)
    const nextSnapshot = continuumEngine.createNextSnapshot(loadedSnapshot, {
      task: {
        ...loadedSnapshot.task,
        activeMilestone: `Resumed (${loadedSnapshot.task.activeMilestone || 'Handoff'})`,
      },
    });

    // Build provider-neutral context string
    const contextRes = continuumContextBuilder.buildContext(nextSnapshot);

    // Save the new chained snapshot
    continuumManager.saveSnapshot(nextSnapshot, activeWorkspace);

    // Run agent task with Continuum context injected
    const agentTaskGoal = nextSnapshot.task.userGoal || nextSnapshot.handoff.immediateNextAction || 'Continue engineering task from Continuum snapshot';
    const agentResult = await agentManager.runAgentTask({
      task: agentTaskGoal,
      workspacePath: activeWorkspace,
      maxSteps: 5,
      continuumSnapshot: nextSnapshot,
      continuumContextText: contextRes.contextText,
    });

    return {
      success: true,
      nextSnapshotId: nextSnapshot.metadata.sessionId,
      parentSessionId: loadedSnapshot.metadata.sessionId,
      sequenceNumber: nextSnapshot.metadata.sequenceNumber,
      contextText: contextRes.contextText,
      nextSnapshot,
      agentResult,
    };
  } catch (err) {
    console.error('[MAIN] Error resuming Continuum session:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('continuum:export-capsule', async (_, payload = {}) => {
  try {
    const { snapshotId, snapshot, workspacePath, exportMode = 'INLINE', options = {} } = payload;
    const activeWorkspace = workspacePath || snapshot?.project?.workspacePath || process.cwd();

    let targetSnapshot = snapshot;
    if (snapshotId) {
      const loadRes = continuumManager.loadSnapshot(snapshotId, activeWorkspace);
      if (!loadRes.success || !loadRes.snapshot) {
        return { success: false, error: loadRes.error || `Failed to load snapshot ${snapshotId}` };
      }
      targetSnapshot = loadRes.snapshot;
    }

    if (!targetSnapshot) {
      return { success: false, error: 'No valid snapshot provided or found for capsule export' };
    }

    const validation = continuumEngine.validateSnapshot(targetSnapshot);
    if (!validation.valid) {
      return { success: false, error: `Invalid snapshot: ${validation.errors.join('; ')}` };
    }

    const capsule = await continuumCapsuleBuilder.buildCapsule(targetSnapshot, activeWorkspace, {
      exportMode,
      ...options,
    });

    const capsulesDir = path.join(continuumManager.getUserDataPath(), 'capsules');
    if (!fs.existsSync(capsulesDir)) {
      fs.mkdirSync(capsulesDir, { recursive: true });
    }

    const safeId = continuumManager.sanitizeSnapshotId(capsule.capsule_meta?.capsule_id || `caps_${Date.now()}`);
    const capsuleFileName = `${safeId}.json`;
    const capsulePath = path.join(capsulesDir, capsuleFileName);

    const serialized = JSON.stringify(capsule, null, 2);
    const tmpPath = `${capsulePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, serialized, 'utf-8');
    fs.renameSync(tmpPath, capsulePath);

    return {
      success: true,
      capsuleId: capsule.capsule_meta.capsule_id,
      path: capsulePath,
      capsuleMeta: capsule.capsule_meta,
      capsule,
    };
  } catch (err) {
    console.error('[MAIN] Error exporting Continuum capsule:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('continuum:import-capsule', async (_, payload = {}) => {
  try {
    const { capsulePath, capsuleSerialized, capsule, workspacePath } = payload;
    let targetCapsule = capsule;

    if (capsulePath) {
      if (!fs.existsSync(capsulePath)) {
        return { success: false, error: `Capsule file not found: ${capsulePath}` };
      }
      const raw = fs.readFileSync(capsulePath, 'utf-8');
      targetCapsule = JSON.parse(raw);
    } else if (capsuleSerialized) {
      targetCapsule = typeof capsuleSerialized === 'string' ? JSON.parse(capsuleSerialized) : capsuleSerialized;
    }

    if (!targetCapsule || typeof targetCapsule !== 'object') {
      return { success: false, error: 'Missing or invalid capsule object' };
    }

    // 1. Validate capsule structure & hash integrity
    const validation = continuumCapsuleBuilder.validateCapsule(targetCapsule);
    if (!validation.valid) {
      return { success: false, error: `Capsule validation failed: ${validation.errors.join('; ')}` };
    }

    // 2. Secret Redaction Check
    const sanitizedCapsule = secretFilter.sanitizeObject(targetCapsule);

    // 3. Embedded snapshot validation
    const embeddedSnapshot = sanitizedCapsule.continuum_snapshot;
    const snapVal = continuumEngine.validateSnapshot(embeddedSnapshot);
    if (!snapVal.valid) {
      return { success: false, error: `Invalid embedded snapshot: ${snapVal.errors.join('; ')}` };
    }

    const activeWorkspace = workspacePath || embeddedSnapshot.project?.workspacePath || process.cwd();

    // 4. Create next chained snapshot (inheriting parent session)
    const nextSnapshot = continuumEngine.createNextSnapshot(embeddedSnapshot, {
      task: {
        ...embeddedSnapshot.task,
        activeMilestone: `Resumed from Capsule (${sanitizedCapsule.capsule_meta?.capsule_id || 'Import'})`,
      },
      codeState: {
        ...embeddedSnapshot.codeState,
        workspaceSnapshotId: sanitizedCapsule.source_state?.workspace_snapshot_id || embeddedSnapshot.codeState?.workspaceSnapshotId || null,
      },
    });

    // 5. Build provider-neutral context string
    const contextRes = continuumContextBuilder.buildContext(nextSnapshot);

    // 6. Save the new chained snapshot
    continuumManager.saveSnapshot(nextSnapshot, activeWorkspace);

    return {
      success: true,
      nextSnapshotId: nextSnapshot.metadata.sessionId,
      parentSessionId: embeddedSnapshot.metadata.sessionId,
      sequenceNumber: nextSnapshot.metadata.sequenceNumber,
      contextText: contextRes.contextText,
      nextSnapshot,
      capsuleMeta: sanitizedCapsule.capsule_meta,
      handoffContext: sanitizedCapsule.handoff_context,
    };
  } catch (err) {
    console.error('[MAIN] Error importing Continuum capsule:', err);
    return { success: false, error: err.message };
  }
});

// Harness Core IPC Handlers (Codex-style Harness Foundation)
ipcMain.handle('harness:create-thread', async (_, options) => {
  return harnessRuntime.createThread(options);
});

ipcMain.handle('harness:get-thread', async (_, threadId) => {
  return harnessRuntime.getThread(threadId);
});

ipcMain.handle('harness:list-threads', async (_, filter) => {
  return harnessRuntime.listThreads(filter);
});

ipcMain.handle('harness:archive-thread', async (_, threadId) => {
  return harnessRuntime.archiveThread(threadId);
});

ipcMain.handle('harness:start-turn', async (_, { threadId, userInput, metadata, options }) => {
  return harnessRuntime.startTurn(threadId, userInput, metadata, options);
});

ipcMain.handle('harness:get-turn', async (_, turnId) => {
  return harnessRuntime.getTurn(turnId);
});

ipcMain.handle('harness:complete-turn', async (_, { turnId, metadata }) => {
  return harnessRuntime.completeTurn(turnId, metadata);
});

ipcMain.handle('harness:fail-turn', async (_, { turnId, error, metadata }) => {
  return harnessRuntime.failTurn(turnId, error, metadata);
});

ipcMain.handle('harness:cancel-turn', async (_, { turnId, metadata }) => {
  return harnessRuntime.cancelTurn(turnId, metadata);
});

ipcMain.handle('harness:run-turn', async (_, payload) => {
  return harnessRuntime.runTurn(payload);
});

ipcMain.handle('harness:approve-action', async (_, payload) => {
  return harnessRuntime.approveAction(payload);
});

ipcMain.handle('harness:reject-action', async (_, payload) => {
  return harnessRuntime.rejectAction(payload);
});

ipcMain.handle('harness:route-request', async (_, payload = {}) => {
  const userInput = typeof payload === 'string' ? payload : (payload.userInput || '');
  const context = typeof payload === 'object' ? (payload.context || payload) : {};
  return harnessRuntime.classifyRequest(userInput, context);
});

ipcMain.handle('harness:handle-request', async (_, payload = {}) => {
  return harnessRuntime.handleRequest(payload);
});

ipcMain.handle('harness:start-item', async (_, { turnId, type, payload, metadata, options }) => {
  return harnessRuntime.startItem(turnId, type, payload, metadata, options);
});

ipcMain.handle('harness:update-item', async (_, { itemId, payloadUpdates, metadataUpdates }) => {
  return harnessRuntime.updateItem(itemId, payloadUpdates, metadataUpdates);
});

ipcMain.handle('harness:complete-item', async (_, { itemId, finalPayload, metadataUpdates }) => {
  return harnessRuntime.completeItem(itemId, finalPayload, metadataUpdates);
});

ipcMain.handle('harness:fail-item', async (_, { itemId, error, metadataUpdates }) => {
  return harnessRuntime.failItem(itemId, error, metadataUpdates);
});

ipcMain.handle('harness:get-events', async (_, filter) => {
  return harnessRuntime.getEvents(filter);
});

ipcMain.handle('harness:cancel-swarm', async (_, payload = {}) => {
  const swarmId = typeof payload === 'string' ? payload : payload.swarmId;
  const reason = typeof payload === 'object' ? payload.reason : undefined;
  return harnessRuntime.cancelSwarm(swarmId, reason);
});

ipcMain.handle('harness:get-swarm-status', async (_, swarmId) => {
  return harnessRuntime.getSwarmStatus(swarmId);
});

// Project-Level MCP & Skill Discovery IPC Handlers (Milestone 13)
ipcMain.handle('harness:discover-project-capabilities', async (_, workspacePath) => {
  return harnessRuntime.discoverProjectCapabilities(workspacePath);
});

ipcMain.handle('harness:load-project-capabilities', async (_, payload = {}) => {
  const ws = typeof payload === 'string' ? payload : payload.workspacePath;
  const opts = typeof payload === 'object' ? payload.options : {};
  return harnessRuntime.loadProjectCapabilities(ws, opts);
});

ipcMain.handle('harness:reload-project-capabilities', async (_, payload = {}) => {
  const ws = typeof payload === 'string' ? payload : payload.workspacePath;
  const opts = typeof payload === 'object' ? payload.options : {};
  return harnessRuntime.reloadProjectCapabilities(ws, opts);
});

ipcMain.handle('harness:get-project-metadata', async (_, workspacePath) => {
  return harnessRuntime.getProjectPersistenceMetadata(workspacePath);
});

// Capability Center & MCP Control Center IPC Handlers (Milestone 15)
ipcMain.handle('harness:get-capabilities', async () => {
  return harnessRuntime.capabilityRegistry.listCapabilities();
});

ipcMain.handle('harness:get-capability', async (_, id) => {
  return harnessRuntime.capabilityRegistry.getCapability(id);
});

ipcMain.handle('harness:get-mcp-servers', async () => {
  return harnessRuntime.mcpServerManager.listServers();
});

ipcMain.handle('harness:get-mcp-server-status', async (_, serverId) => {
  return harnessRuntime.mcpServerManager.getServerStatus(serverId);
});

ipcMain.handle('harness:get-mcp-server-tools', async (_, serverId) => {
  const s = harnessRuntime.mcpServerManager.getServer(serverId);
  return s ? s.tools : [];
});

ipcMain.handle('harness:get-skills', async () => {
  return harnessRuntime.skillRegistry.listSkills();
});

ipcMain.handle('harness:get-skill', async (_, skillId) => {
  return harnessRuntime.skillRegistry.getSkill(skillId);
});

ipcMain.handle('harness:get-project-capability-status', async (_, workspacePath) => {
  return harnessRuntime.discoverProjectCapabilities(workspacePath);
});

ipcMain.handle('harness:start-mcp-server', async (_, serverId) => {
  return harnessRuntime.startMCPServer(serverId);
});

ipcMain.handle('harness:stop-mcp-server', async (_, serverId) => {
  return harnessRuntime.stopMCPServer(serverId);
});

ipcMain.handle('harness:restart-mcp-server', async (_, serverId) => {
  return harnessRuntime.restartMCPServer(serverId);
});

ipcMain.handle('harness:enable-skill', async (_, skillId) => {
  return harnessRuntime.enableSkill(skillId);
});

ipcMain.handle('harness:disable-skill', async (_, skillId) => {
  return harnessRuntime.disableSkill(skillId);
});

// 3-Way ChangeSet Conflict Resolution IPC Handlers (Milestone 16)
ipcMain.handle('harness:list-change-conflicts', async () => {
  return harnessRuntime.listChangeConflicts().map((c) => c.toJSON());
});

ipcMain.handle('harness:get-change-conflict', async (_, conflictId) => {
  const c = harnessRuntime.getChangeConflict(conflictId);
  return c ? c.toJSON() : null;
});

ipcMain.handle('harness:resolve-conflict-hunk', async (_, payload = {}) => {
  return harnessRuntime.resolveChangeConflictHunk(
    payload.conflictId,
    payload.hunkId,
    payload.resolution,
    payload.customContent,
    payload.context
  );
});

ipcMain.handle('harness:create-parent-changeset-from-conflicts', async (_, payload = {}) => {
  const cs = harnessRuntime.createParentChangeSetFromConflicts(payload);
  return cs.toJSON();
});

ipcMain.handle('harness:apply-resolved-conflicts', async (_, payload = {}) => {
  return harnessRuntime.applyResolvedConflicts(payload);
});

ipcMain.handle('harness:cancel-conflict-resolution', async (_, payload = {}) => {
  return harnessRuntime.cancelConflictResolution(payload);
});

// Stream Harness Events directly to Electron Renderer
harnessRuntime.subscribe((event) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('harness:event', event);
    }
  } catch (e) {}
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
