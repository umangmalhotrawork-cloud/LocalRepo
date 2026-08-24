import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:read-dir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  analyzeFile: (payload: { filePath: string; content: string }) => ipcRenderer.invoke('engine:analyze', payload),
  safeRemove: (filePath: string, lines: number[]) => ipcRenderer.invoke('engine:safe-remove', filePath, lines),
  runPythonFile: (filePath: string) => ipcRenderer.invoke('python:run-file', filePath),
  onPythonOutput: (callback: (data: any) => void) => {
    const listener = (_: any, arg: any) => callback(arg);
    ipcRenderer.on('python:output', listener);
    return () => ipcRenderer.removeListener('python:output', listener);
  },
  github: {
    configStatus: () => ipcRenderer.invoke('github:configStatus'),
    status: () => ipcRenderer.invoke('github:status'),
    connect: () => ipcRenderer.invoke('github:connect'),
    disconnect: () => ipcRenderer.invoke('github:disconnect'),
    listRepos: () => ipcRenderer.invoke('github:listRepos'),
    associateRepo: (payload: { workspacePath: string; repo: any }) => ipcRenderer.invoke('github:associateRepo', payload),
    getSelectedRepo: (workspacePath: string) => ipcRenderer.invoke('github:getSelectedRepo', workspacePath),
    resolveLocalPath: (payload: { repo: any; currentWorkspacePath?: string }) => ipcRenderer.invoke('github:resolveLocalPath', payload),
    selectCloneDestination: (defaultName?: string) => ipcRenderer.invoke('github:selectCloneDestination', defaultName),
    cloneRepo: (payload: { repo: any; destinationDir: string }) => ipcRenderer.invoke('github:cloneRepo', payload),
  },
});
