const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  getDefaultDemoWorkspace: () => ipcRenderer.invoke('engine:get-default-demo-workspace'),
  readDir: (dirPath) => ipcRenderer.invoke('fs:read-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  fileExists: (filePath) => ipcRenderer.invoke('fs:file-exists', filePath),
  analyzeFile: (filePath) => ipcRenderer.invoke('engine:analyze', filePath),
  previewSafeRemove: (filePath) => ipcRenderer.invoke('engine:preview-safe-remove', filePath),
  applySafeRemove: (filePath, transformedContent) => ipcRenderer.invoke('engine:apply-safe-remove', filePath, transformedContent),
  restoreBackup: (filePath) => ipcRenderer.invoke('engine:restore-backup', filePath),
});
