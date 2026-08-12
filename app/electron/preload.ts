import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:read-dir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  analyzeFile: (filePath: string) => ipcRenderer.invoke('engine:analyze', filePath),
  safeRemove: (filePath: string, lines: number[]) => ipcRenderer.invoke('engine:safe-remove', filePath, lines),
});
