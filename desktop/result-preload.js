'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resultAPI', {
  onState: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('result:state', (_event, state) => callback(state));
  },
  close: () => ipcRenderer.send('result:close'),
  copy: (text) => ipcRenderer.invoke('result:copy', text),
  setPosition: (x, y) => ipcRenderer.send('result:set-position', x, y)
});
