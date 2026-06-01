import { contextBridge, ipcRenderer } from 'electron';

if (!process.contextIsolated) {
  throw new Error('contextIsolation must be enabled in the BrowserWindow');
}

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateChecking: (callback: () => void) => {
      ipcRenderer.on('update-checking', () => callback());
    },
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-available', (_event, info) => callback(info));
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-not-available', (_event, info) => callback(info));
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('update-progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update-error', (_event, error) => callback(error));
    },
    restartApp: () => {
      ipcRenderer.send('app:restart');
    },
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    printPreview: () => ipcRenderer.invoke('print:preview'),
    printSystemPreview: () => ipcRenderer.invoke('print:systemPreview'),
  });
} catch (error) {
  console.error('Failed to expose electronAPI:', error);
}