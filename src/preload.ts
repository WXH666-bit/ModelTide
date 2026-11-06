import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge } from './types';
const bridge: Bridge = {
  query: q => ipcRenderer.invoke('query', q), state: () => ipcRenderer.invoke('state'),
  action: action => ipcRenderer.invoke('action', action), settings: settings => ipcRenderer.invoke('settings', settings),
  subscribe: callback => { const listener = (_e: Electron.IpcRendererEvent, s: any) => callback(s); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); }
};
contextBridge.exposeInMainWorld('modeltide', bridge);
