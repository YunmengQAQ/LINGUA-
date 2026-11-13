'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onInit: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('overlay:init', (_event, payload) => callback(payload));
  },
  select: (selection) => ipcRenderer.send('overlay:select', selection),
  cancel: () => ipcRenderer.send('overlay:cancel'),
  onInlineBegin: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('overlay:inline-begin', (_event, payload) => callback(payload));
  },
  onInlineBlocks: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('overlay:inline-blocks', (_event, payload) => callback(payload));
  },
  onInlineStatus: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('overlay:inline-status', (_event, payload) => callback(payload));
  }
});
