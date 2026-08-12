const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readDir: (dirPath) => ipcRenderer.invoke('fs:read-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  analyzeFile: (filePath) => ipcRenderer.invoke('engine:analyze', filePath),
  safeRemove: (filePath, lines) => ipcRenderer.invoke('engine:safe-remove', filePath, lines),
});
