'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linguaDesktop', {
  isDesktop: true,
  platform: process.platform,
  startCapture: (mode) => ipcRenderer.invoke('desktop:start-capture', mode),
  captureAutoFrame: (token) => ipcRenderer.invoke('desktop:auto-capture', token),
  stopAuto: () => ipcRenderer.invoke('desktop:stop-auto'),
  status: () => ipcRenderer.invoke('desktop:status'),
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  saveSettings: (payload) => ipcRenderer.invoke('desktop:save-settings', payload),
  getDisclaimerHidden: () => ipcRenderer.invoke('desktop:get-disclaimer-hidden'),
  setDisclaimerHidden: (hidden) => ipcRenderer.invoke('desktop:set-disclaimer-hidden', hidden),
  setHotkey: (accelerator) => ipcRenderer.invoke('desktop:set-hotkey', accelerator),
  setAutoHotkey: (accelerator) => ipcRenderer.invoke('desktop:set-auto-hotkey', accelerator),
  suspendHotkey: () => ipcRenderer.invoke('desktop:suspend-hotkey'),
  resumeHotkey: () => ipcRenderer.invoke('desktop:resume-hotkey'),
  updateResult: (payload) => ipcRenderer.send('desktop:result', payload),
  updateInline: (payload) => ipcRenderer.send('desktop:inline-result', payload),
  updateInlineStatus: (payload) => ipcRenderer.send('desktop:inline-status', payload),
  onCapture: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:capture', handler);
    return () => ipcRenderer.removeListener('desktop:capture', handler);
  },
  onAutoStart: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:auto-start', handler);
    return () => ipcRenderer.removeListener('desktop:auto-start', handler);
  },
  onAutoStop: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:auto-stop', handler);
    return () => ipcRenderer.removeListener('desktop:auto-stop', handler);
  },
  onInlineCancel: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:inline-cancel', handler);
    return () => ipcRenderer.removeListener('desktop:inline-cancel', handler);
  },
  onCancelled: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:cancelled', handler);
    return () => ipcRenderer.removeListener('desktop:cancelled', handler);
  },
  onError: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:error', handler);
    return () => ipcRenderer.removeListener('desktop:error', handler);
  }
});
