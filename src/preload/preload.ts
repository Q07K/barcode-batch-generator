import { contextBridge, ipcRenderer } from 'electron';

// Preload script for barcode batch generator
// 윈도우 컨트롤 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
});