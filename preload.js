// Preload script for Electron
// This script runs in the context of the renderer process
// but has access to Node.js APIs

const { contextBridge, ipcMain } = require('electron');

// You can expose specific APIs to the renderer process here
// Example:
// contextBridge.exposeInMainWorld('electronAPI', {
//   sendMessage: (message) => ipcMain.send('message', message)
// });
